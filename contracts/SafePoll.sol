// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title SafePoll - Encrypted survey with Zama FHEVM
/// @notice Users can create surveys, submit encrypted votes, and the creator can end and decrypt results.
contract SafePoll is SepoliaConfig {
    // ============ Types ============
    struct Question {
        string text;
        string[] options;
        mapping(uint256 => euint32) optionCounts; // encrypted counters per option
    }

    struct Survey {
        uint256 id;
        string title;
        string description;
        address creator;
        bool isActive;
        bool resultsDecrypted;
        uint256 questionCount;
        mapping(uint256 => Question) questions;
        mapping(address => bool) hasVoted;
        uint256 totalVotes;
        uint256 createdAt;
    }

    struct DecryptedResults {
        uint256 surveyId;
        uint256 questionIndex;
        uint256[] optionCounts; // clear counts after onchain public decryption
    }

    // ============ Storage ============
    uint256 private _surveyCounter;
    mapping(uint256 => Survey) public surveys;
    mapping(uint256 => DecryptedResults[]) public decryptedResults; // surveyId => list per question

    // requestID => metadata to rebuild the clear array per question
    struct RequestMeta {
        uint256 surveyId;
        uint256[] optionLens; // per question, number of options
        bool exists;
    }
    mapping(uint256 => RequestMeta) private _requestMeta;

    // ============ Events ============
    event SurveyCreated(uint256 indexed surveyId, address indexed creator, string title);
    event SurveyEnded(uint256 indexed surveyId);
    event VoteSubmitted(uint256 indexed surveyId, address indexed voter);
    event ResultsDecrypted(uint256 indexed surveyId);

    // ============ Modifiers ============
    modifier onlyCreator(uint256 surveyId) {
        require(msg.sender == surveys[surveyId].creator, "Not creator");
        _;
    }

    // ============ Create ============
    function createSurvey(
        string calldata title,
        string calldata description,
        string[] calldata questionTexts,
        string[][] calldata questionOptions
    ) external returns (uint256) {
        require(questionTexts.length == questionOptions.length, "Length mismatch");
        require(questionTexts.length > 0, "No questions");

        uint256 id = ++_surveyCounter;
        Survey storage s = surveys[id];
        s.id = id;
        s.title = title;
        s.description = description;
        s.creator = msg.sender;
        s.isActive = true;
        s.resultsDecrypted = false;
        s.questionCount = questionTexts.length;
        s.createdAt = block.timestamp;

        for (uint256 qi = 0; qi < questionTexts.length; qi++) {
            Question storage q = s.questions[qi];
            q.text = questionTexts[qi];
            // copy options safely (avoid nested dynamic array direct assignment)
            uint256 opts = questionOptions[qi].length;
            require(opts > 0, "No options");
            for (uint256 oi = 0; oi < opts; oi++) {
                q.options.push(questionOptions[qi][oi]);
            }
            // counts are zero-initialized encrypted values (uninitialized -> treat as 0 in FHE ops)
        }

        emit SurveyCreated(id, msg.sender, title);
        return id;
    }

    // ============ Read ============
    function getTotalSurveys() external view returns (uint256) {
        return _surveyCounter;
    }

    function getSurveyInfo(
        uint256 surveyId
    ) external view returns (
        uint256 id,
        string memory title,
        string memory description,
        address creator,
        bool isActive,
        bool resultsDecrypted,
        uint256 questionCount,
        uint256 totalVotes,
        uint256 createdAt
    ) {
        Survey storage s = surveys[surveyId];
        return (
            s.id,
            s.title,
            s.description,
            s.creator,
            s.isActive,
            s.resultsDecrypted,
            s.questionCount,
            s.totalVotes,
            s.createdAt
        );
    }

    function getQuestion(uint256 surveyId, uint256 questionIndex) external view returns (string memory text, string[] memory options) {
        Survey storage s = surveys[surveyId];
        require(questionIndex < s.questionCount, "Bad q");
        Question storage q = s.questions[questionIndex];
        return (q.text, q.options);
    }

    function getEncryptedOptionCount(
        uint256 surveyId,
        uint256 questionIndex,
        uint256 optionIndex
    ) external view returns (euint32) {
        Survey storage s = surveys[surveyId];
        require(questionIndex < s.questionCount, "Bad q");
        Question storage q = s.questions[questionIndex];
        require(optionIndex < q.options.length, "Bad o");
        return q.optionCounts[optionIndex];
    }

    function hasUserVoted(uint256 surveyId, address user) external view returns (bool) {
        return surveys[surveyId].hasVoted[user];
    }

    // ============ Vote (encrypted) ============
    /// @notice Submit encrypted selected option index per question
    /// @param surveyId the survey being voted on
    /// @param handles bytes32 handles for each question's selected option index (externalEuint32)
    /// @param inputProof relayer proof for the provided handles
    function submitVotes(uint256 surveyId, bytes32[] calldata handles, bytes calldata inputProof) external {
        Survey storage s = surveys[surveyId];
        require(s.id != 0, "No survey");
        require(s.isActive, "Ended");
        require(!s.hasVoted[msg.sender], "Voted");
        require(handles.length == s.questionCount, "Bad length");

        // constants
        euint32 one = FHE.asEuint32(1);
        euint32 zero = FHE.asEuint32(0);

        for (uint256 qi = 0; qi < s.questionCount; qi++) {
            Question storage q = s.questions[qi];
            euint32 encChoice = FHE.fromExternal(externalEuint32.wrap(handles[qi]), inputProof);

            uint256 opts = q.options.length;
            for (uint256 oi = 0; oi < opts; oi++) {
                ebool isSel = FHE.eq(encChoice, FHE.asEuint32(uint32(oi)));
                euint32 addend = FHE.select(isSel, one, zero);
                q.optionCounts[oi] = FHE.add(q.optionCounts[oi], addend);
                // keep accessible for this contract (for public decryption flow)
                FHE.allowThis(q.optionCounts[oi]);
            }
        }

        s.hasVoted[msg.sender] = true;
        s.totalVotes += 1;
        emit VoteSubmitted(surveyId, msg.sender);
    }

    // ============ End & Decrypt ============
    function endSurvey(uint256 surveyId) external onlyCreator(surveyId) {
        Survey storage s = surveys[surveyId];
        require(s.isActive, "Already ended");
        s.isActive = false;
        emit SurveyEnded(surveyId);
    }

    /// @notice Creator requests onchain public decryption of all option counts
    function requestDecryption(uint256 surveyId) external onlyCreator(surveyId) {
        Survey storage s = surveys[surveyId];
        require(!s.isActive, "Not ended");
        require(!s.resultsDecrypted, "Already");

        // collect all handles
        uint256 totalHandles;
        uint256 qc = s.questionCount;
        uint256[] memory lens = new uint256[](qc);
        for (uint256 qi = 0; qi < qc; qi++) {
            lens[qi] = s.questions[qi].options.length;
            totalHandles += lens[qi];
        }

        bytes32[] memory list = new bytes32[](totalHandles);
        uint256 k;
        for (uint256 qi = 0; qi < qc; qi++) {
            Question storage q = s.questions[qi];
            for (uint256 oi = 0; oi < q.options.length; oi++) {
                list[k++] = FHE.toBytes32(q.optionCounts[oi]);
                // mark public decryptable for HTTP public decrypt convenience, too
                FHE.makePubliclyDecryptable(q.optionCounts[oi]);
            }
        }

        uint256 reqId = FHE.requestDecryption(list, this.decryptionCallback.selector);
        _requestMeta[reqId] = RequestMeta({surveyId: surveyId, optionLens: lens, exists: true});
    }

    /// @notice Callback invoked by the Zama Decryption Oracle relayer
    /// @dev MUST verify signatures via FHE.checkSignatures to avoid forgery
    function decryptionCallback(uint256 requestId, bytes calldata cleartexts, bytes calldata decryptionProof)
        external
        returns (bool)
    {
        FHE.checkSignatures(requestId, cleartexts, decryptionProof);

        RequestMeta storage meta = _requestMeta[requestId];
        require(meta.exists, "Unknown req");

        uint256 surveyId = meta.surveyId;
        Survey storage s = surveys[surveyId];

        // parse n 32-byte words from cleartexts
        uint256 n = cleartexts.length / 32;
        uint256[] memory vals = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            uint256 word;
            assembly {
                // skip length slot (first 32 bytes), then add i*32
                word := calldataload(add(cleartexts.offset, mul(add(i, 1), 32)))
            }
            vals[i] = word;
        }

        // split per question
        uint256 idx;
        delete decryptedResults[surveyId];
        for (uint256 qi = 0; qi < meta.optionLens.length; qi++) {
            uint256 len = meta.optionLens[qi];
            uint256[] memory oc = new uint256[](len);
            for (uint256 j = 0; j < len; j++) {
                oc[j] = vals[idx++];
            }
            decryptedResults[surveyId].push(DecryptedResults({surveyId: surveyId, questionIndex: qi, optionCounts: oc}));
        }

        s.resultsDecrypted = true;
        emit ResultsDecrypted(surveyId);
        // cleanup
        delete _requestMeta[requestId];
        return true;
    }
}
