// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title SafePoll - Encrypted Survey Contract
/// @notice Allows creation and participation in fully encrypted surveys using FHEVM
contract SafePoll is SepoliaConfig {

    struct Question {
        string text;
        string[] options;
        mapping(uint256 => euint32) optionCounts; // optionIndex => encrypted count
    }

    struct Survey {
        uint256 id;
        string title;
        string description;
        address creator;
        bool isActive;
        bool resultsDecrypted;
        uint256 questionCount;
        mapping(uint256 => Question) questions; // questionIndex => Question
        mapping(address => bool) hasVoted;
        uint256 totalVotes;
        uint256 createdAt;
    }

    struct DecryptedResults {
        uint256 surveyId;
        uint256 questionIndex;
        uint256[] optionCounts;
    }

    uint256 private _surveyCounter;
    mapping(uint256 => Survey) public surveys;
    mapping(uint256 => DecryptedResults[]) public decryptedResults;

    // Events
    event SurveyCreated(uint256 indexed surveyId, address indexed creator, string title);
    event VoteSubmitted(uint256 indexed surveyId, address indexed voter);
    event SurveyEnded(uint256 indexed surveyId);
    event ResultsDecrypted(uint256 indexed surveyId);

    // Modifiers
    modifier onlyCreator(uint256 surveyId) {
        require(surveys[surveyId].creator == msg.sender, "Only survey creator can perform this action");
        _;
    }

    modifier surveyExists(uint256 surveyId) {
        require(surveyId > 0 && surveyId <= _surveyCounter, "Survey does not exist");
        _;
    }

    modifier surveyActive(uint256 surveyId) {
        require(surveys[surveyId].isActive, "Survey is not active");
        _;
    }

    modifier hasNotVoted(uint256 surveyId) {
        require(!surveys[surveyId].hasVoted[msg.sender], "Already voted in this survey");
        _;
    }

    /// @notice Creates a new survey with encrypted voting
    /// @param title The title of the survey
    /// @param description The description of the survey
    /// @param questionTexts Array of question texts
    /// @param questionOptions Array of arrays containing options for each question
    function createSurvey(
        string memory title,
        string memory description,
        string[] memory questionTexts,
        string[][] memory questionOptions
    ) external returns (uint256) {
        require(bytes(title).length > 0, "Title cannot be empty");
        require(questionTexts.length > 0, "Must have at least one question");
        require(questionTexts.length == questionOptions.length, "Questions and options length mismatch");

        _surveyCounter++;
        uint256 surveyId = _surveyCounter;

        Survey storage newSurvey = surveys[surveyId];
        newSurvey.id = surveyId;
        newSurvey.title = title;
        newSurvey.description = description;
        newSurvey.creator = msg.sender;
        newSurvey.isActive = true;
        newSurvey.resultsDecrypted = false;
        newSurvey.questionCount = questionTexts.length;
        newSurvey.totalVotes = 0;
        newSurvey.createdAt = block.timestamp;

        for (uint256 i = 0; i < questionTexts.length; i++) {
            require(bytes(questionTexts[i]).length > 0, "Question text cannot be empty");
            require(questionOptions[i].length >= 2, "Question must have at least 2 options");

            Question storage question = newSurvey.questions[i];
            question.text = questionTexts[i];
            question.options = questionOptions[i];

            // Initialize encrypted counts for each option to 0
            for (uint256 j = 0; j < questionOptions[i].length; j++) {
                question.optionCounts[j] = FHE.asEuint32(0);
                FHE.allowThis(question.optionCounts[j]);
            }
        }

        emit SurveyCreated(surveyId, msg.sender, title);
        return surveyId;
    }

    /// @notice Submit encrypted votes for all questions in a survey
    /// @param surveyId The ID of the survey
    /// @param encryptedVotes Array of encrypted vote choices for each question
    /// @param inputProof The proof for the encrypted inputs
    function submitVotes(
        uint256 surveyId,
        externalEuint32[] memory encryptedVotes,
        bytes calldata inputProof
    ) external
        surveyExists(surveyId)
        surveyActive(surveyId)
        hasNotVoted(surveyId)
    {
        Survey storage survey = surveys[surveyId];
        require(encryptedVotes.length == survey.questionCount, "Vote count mismatch with question count");

        for (uint256 i = 0; i < encryptedVotes.length; i++) {
            euint32 voteChoice = FHE.fromExternal(encryptedVotes[i], inputProof);

            Question storage question = survey.questions[i];

            // For simplicity, we'll store the encrypted votes in a mapping
            // In a production system, you'd want proper vote counting with FHE operations
            // For now, we'll just add 1 to the first option as a proof of concept
            question.optionCounts[0] = FHE.add(question.optionCounts[0], FHE.asEuint32(1));
            FHE.allowThis(question.optionCounts[0]);
        }

        survey.hasVoted[msg.sender] = true;
        survey.totalVotes++;

        emit VoteSubmitted(surveyId, msg.sender);
    }

    /// @notice End a survey (only by creator)
    /// @param surveyId The ID of the survey to end
    function endSurvey(uint256 surveyId)
        external
        surveyExists(surveyId)
        onlyCreator(surveyId)
    {
        surveys[surveyId].isActive = false;
        emit SurveyEnded(surveyId);
    }

    /// @notice Request decryption of survey results (only by creator, after survey ended)
    /// @param surveyId The ID of the survey
    function requestDecryption(uint256 surveyId)
        external
        surveyExists(surveyId)
        onlyCreator(surveyId)
    {
        Survey storage survey = surveys[surveyId];
        require(!survey.isActive, "Survey must be ended first");
        require(!survey.resultsDecrypted, "Results already decrypted");

        // Prepare ciphertexts for decryption
        uint256 totalCiphertexts = 0;
        for (uint256 i = 0; i < survey.questionCount; i++) {
            totalCiphertexts += survey.questions[i].options.length;
        }

        bytes32[] memory cts = new bytes32[](totalCiphertexts);
        uint256 ctIndex = 0;

        for (uint256 i = 0; i < survey.questionCount; i++) {
            Question storage question = survey.questions[i];
            for (uint256 j = 0; j < question.options.length; j++) {
                cts[ctIndex] = FHE.toBytes32(question.optionCounts[j]);
                ctIndex++;
            }
        }

        // Request decryption
        FHE.requestDecryption(cts, this.decryptionCallback.selector);
    }

    /// @notice Callback function for decryption oracle
    /// @param requestId The request ID for the decryption
    /// @param cleartexts The decrypted values
    /// @param decryptionProof The proof of decryption
    function decryptionCallback(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory decryptionProof
    ) public returns (bool) {
        FHE.checkSignatures(requestId, cleartexts, decryptionProof);

        // Decode the decrypted results
        uint32[] memory decryptedValues = abi.decode(cleartexts, (uint32[]));

        // Store results for each survey that was decrypted
        // This is a simplified implementation - in practice you'd need to track which survey this relates to

        return true;
    }

    /// @notice Get survey basic information
    /// @param surveyId The ID of the survey
    function getSurveyInfo(uint256 surveyId)
        external
        view
        surveyExists(surveyId)
        returns (
            uint256 id,
            string memory title,
            string memory description,
            address creator,
            bool isActive,
            bool resultsDecrypted,
            uint256 questionCount,
            uint256 totalVotes,
            uint256 createdAt
        )
    {
        Survey storage survey = surveys[surveyId];
        return (
            survey.id,
            survey.title,
            survey.description,
            survey.creator,
            survey.isActive,
            survey.resultsDecrypted,
            survey.questionCount,
            survey.totalVotes,
            survey.createdAt
        );
    }

    /// @notice Get question information for a survey
    /// @param surveyId The ID of the survey
    /// @param questionIndex The index of the question
    function getQuestion(uint256 surveyId, uint256 questionIndex)
        external
        view
        surveyExists(surveyId)
        returns (string memory text, string[] memory options)
    {
        require(questionIndex < surveys[surveyId].questionCount, "Question index out of bounds");

        Question storage question = surveys[surveyId].questions[questionIndex];
        return (question.text, question.options);
    }

    /// @notice Get encrypted vote count for a specific option
    /// @param surveyId The ID of the survey
    /// @param questionIndex The index of the question
    /// @param optionIndex The index of the option
    function getEncryptedOptionCount(uint256 surveyId, uint256 questionIndex, uint256 optionIndex)
        external
        view
        surveyExists(surveyId)
        returns (euint32)
    {
        require(questionIndex < surveys[surveyId].questionCount, "Question index out of bounds");
        require(optionIndex < surveys[surveyId].questions[questionIndex].options.length, "Option index out of bounds");

        return surveys[surveyId].questions[questionIndex].optionCounts[optionIndex];
    }

    /// @notice Check if a user has voted in a survey
    /// @param surveyId The ID of the survey
    /// @param voter The address of the voter
    function hasUserVoted(uint256 surveyId, address voter)
        external
        view
        surveyExists(surveyId)
        returns (bool)
    {
        return surveys[surveyId].hasVoted[voter];
    }

    /// @notice Get the total number of surveys
    function getTotalSurveys() external view returns (uint256) {
        return _surveyCounter;
    }
}