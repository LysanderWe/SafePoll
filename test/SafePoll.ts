import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { SafePoll, SafePoll__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
  charlie: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("SafePoll")) as SafePoll__factory;
  const safePollContract = (await factory.deploy()) as SafePoll;
  const safePollContractAddress = await safePollContract.getAddress();

  return { safePollContract, safePollContractAddress };
}

describe("SafePoll", function () {
  let signers: Signers;
  let safePollContract: SafePoll;
  let safePollContractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = {
      deployer: ethSigners[0],
      alice: ethSigners[1],
      bob: ethSigners[2],
      charlie: ethSigners[3]
    };
  });

  beforeEach(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ safePollContract, safePollContractAddress } = await deployFixture());
  });

  describe("Survey Creation", function () {
    it("should create a survey with multiple questions", async function () {
      const title = "Programming Survey";
      const description = "A survey about programming preferences";
      const questionTexts = [
        "What is your favorite programming language?",
        "How many years of programming experience do you have?"
      ];
      const questionOptions = [
        ["JavaScript", "Python", "Solidity", "Rust"],
        ["0-1 years", "2-5 years", "6-10 years", "10+ years"]
      ];

      const tx = await safePollContract
        .connect(signers.alice)
        .createSurvey(title, description, questionTexts, questionOptions);

      const receipt = await tx.wait();

      // Check for SurveyCreated event
      const events = receipt?.logs || [];
      let surveyCreatedEvent = null;

      for (const event of events) {
        try {
          const parsedEvent = safePollContract.interface.parseLog(event);
          if (parsedEvent?.name === "SurveyCreated") {
            surveyCreatedEvent = parsedEvent;
            break;
          }
        } catch (e) {
          // Skip non-matching events
        }
      }

      expect(surveyCreatedEvent).to.not.be.null;
      expect(surveyCreatedEvent?.args.surveyId).to.eq(1);
      expect(surveyCreatedEvent?.args.creator).to.eq(signers.alice.address);
      expect(surveyCreatedEvent?.args.title).to.eq(title);

      // Verify survey info
      const surveyInfo = await safePollContract.getSurveyInfo(1);
      expect(surveyInfo[0]).to.eq(1); // id
      expect(surveyInfo[1]).to.eq(title); // title
      expect(surveyInfo[2]).to.eq(description); // description
      expect(surveyInfo[3]).to.eq(signers.alice.address); // creator
      expect(surveyInfo[4]).to.eq(true); // isActive
      expect(surveyInfo[5]).to.eq(false); // resultsDecrypted
      expect(surveyInfo[6]).to.eq(2); // questionCount
      expect(surveyInfo[7]).to.eq(0); // totalVotes

      // Verify questions
      const question0 = await safePollContract.getQuestion(1, 0);
      expect(question0[0]).to.eq(questionTexts[0]);
      expect(question0[1]).to.deep.eq(questionOptions[0]);

      const question1 = await safePollContract.getQuestion(1, 1);
      expect(question1[0]).to.eq(questionTexts[1]);
      expect(question1[1]).to.deep.eq(questionOptions[1]);
    });

    it("should increment total surveys counter", async function () {
      expect(await safePollContract.getTotalSurveys()).to.eq(0);

      await safePollContract
        .connect(signers.alice)
        .createSurvey("Survey 1", "Description 1", ["Question 1"], [["Option A", "Option B"]]);

      expect(await safePollContract.getTotalSurveys()).to.eq(1);

      await safePollContract
        .connect(signers.bob)
        .createSurvey("Survey 2", "Description 2", ["Question 2"], [["Option X", "Option Y"]]);

      expect(await safePollContract.getTotalSurveys()).to.eq(2);
    });

    it("should reject survey creation with empty title", async function () {
      await expect(
        safePollContract
          .connect(signers.alice)
          .createSurvey("", "Description", ["Question"], [["Option A", "Option B"]])
      ).to.be.revertedWith("Title cannot be empty");
    });

    it("should reject survey creation with no questions", async function () {
      await expect(
        safePollContract
          .connect(signers.alice)
          .createSurvey("Title", "Description", [], [])
      ).to.be.revertedWith("Must have at least one question");
    });

    it("should reject survey creation with insufficient options", async function () {
      await expect(
        safePollContract
          .connect(signers.alice)
          .createSurvey("Title", "Description", ["Question"], [["Only One Option"]])
      ).to.be.revertedWith("Question must have at least 2 options");
    });
  });

  describe("Voting", function () {
    beforeEach(async function () {
      // Create a test survey before each voting test
      await safePollContract
        .connect(signers.alice)
        .createSurvey(
          "Test Survey",
          "A test survey",
          ["Question 1", "Question 2"],
          [["Option A", "Option B", "Option C"], ["Option X", "Option Y"]]
        );
    });

    it("should allow users to submit encrypted votes", async function () {
      // Encrypt votes: Option A (0) for question 1, Option Y (1) for question 2
      const votes = [0, 1];

      const encryptedInput = await fhevm
        .createEncryptedInput(safePollContractAddress, signers.bob.address);

      for (const vote of votes) {
        encryptedInput.add32(vote);
      }

      const encryptedVotes = await encryptedInput.encrypt();

      const tx = await safePollContract
        .connect(signers.bob)
        .submitVotes(1, encryptedVotes.handles, encryptedVotes.inputProof);

      const receipt = await tx.wait();

      // Check for VoteSubmitted event
      const events = receipt?.logs || [];
      let voteSubmittedEvent = null;

      for (const event of events) {
        try {
          const parsedEvent = safePollContract.interface.parseLog(event);
          if (parsedEvent?.name === "VoteSubmitted") {
            voteSubmittedEvent = parsedEvent;
            break;
          }
        } catch (e) {
          // Skip non-matching events
        }
      }

      expect(voteSubmittedEvent).to.not.be.null;
      expect(voteSubmittedEvent?.args.surveyId).to.eq(1);
      expect(voteSubmittedEvent?.args.voter).to.eq(signers.bob.address);

      // Verify user has voted
      expect(await safePollContract.hasUserVoted(1, signers.bob.address)).to.eq(true);

      // Verify total votes increased
      const surveyInfo = await safePollContract.getSurveyInfo(1);
      expect(surveyInfo[7]).to.eq(1); // totalVotes
    });

    it("should allow multiple users to vote", async function () {
      // Bob votes
      const bobVotes = [0, 1]; // Option A, Option Y
      const bobEncryptedInput = await fhevm
        .createEncryptedInput(safePollContractAddress, signers.bob.address);
      for (const vote of bobVotes) {
        bobEncryptedInput.add32(vote);
      }
      const bobEncryptedVotes = await bobEncryptedInput.encrypt();

      await safePollContract
        .connect(signers.bob)
        .submitVotes(1, bobEncryptedVotes.handles, bobEncryptedVotes.inputProof);

      // Charlie votes
      const charlieVotes = [2, 0]; // Option C, Option X
      const charlieEncryptedInput = await fhevm
        .createEncryptedInput(safePollContractAddress, signers.charlie.address);
      for (const vote of charlieVotes) {
        charlieEncryptedInput.add32(vote);
      }
      const charlieEncryptedVotes = await charlieEncryptedInput.encrypt();

      await safePollContract
        .connect(signers.charlie)
        .submitVotes(1, charlieEncryptedVotes.handles, charlieEncryptedVotes.inputProof);

      // Verify both users have voted
      expect(await safePollContract.hasUserVoted(1, signers.bob.address)).to.eq(true);
      expect(await safePollContract.hasUserVoted(1, signers.charlie.address)).to.eq(true);

      // Verify total votes
      const surveyInfo = await safePollContract.getSurveyInfo(1);
      expect(surveyInfo[7]).to.eq(2); // totalVotes
    });

    it("should reject double voting", async function () {
      // Bob votes first time
      const votes = [0, 1];
      const encryptedInput = await fhevm
        .createEncryptedInput(safePollContractAddress, signers.bob.address);
      for (const vote of votes) {
        encryptedInput.add32(vote);
      }
      const encryptedVotes = await encryptedInput.encrypt();

      await safePollContract
        .connect(signers.bob)
        .submitVotes(1, encryptedVotes.handles, encryptedVotes.inputProof);

      // Bob tries to vote again
      const secondEncryptedInput = await fhevm
        .createEncryptedInput(safePollContractAddress, signers.bob.address);
      for (const vote of votes) {
        secondEncryptedInput.add32(vote);
      }
      const secondEncryptedVotes = await secondEncryptedInput.encrypt();

      await expect(
        safePollContract
          .connect(signers.bob)
          .submitVotes(1, secondEncryptedVotes.handles, secondEncryptedVotes.inputProof)
      ).to.be.revertedWith("Already voted in this survey");
    });

    it("should reject voting with wrong number of answers", async function () {
      // Try to submit only 1 vote for a survey with 2 questions
      const encryptedInput = await fhevm
        .createEncryptedInput(safePollContractAddress, signers.bob.address)
        .add32(0);
      const encryptedVotes = await encryptedInput.encrypt();

      await expect(
        safePollContract
          .connect(signers.bob)
          .submitVotes(1, encryptedVotes.handles, encryptedVotes.inputProof)
      ).to.be.revertedWith("Vote count mismatch with question count");
    });

    it("should reject voting on non-existent survey", async function () {
      const votes = [0, 1];
      const encryptedInput = await fhevm
        .createEncryptedInput(safePollContractAddress, signers.bob.address);
      for (const vote of votes) {
        encryptedInput.add32(vote);
      }
      const encryptedVotes = await encryptedInput.encrypt();

      await expect(
        safePollContract
          .connect(signers.bob)
          .submitVotes(999, encryptedVotes.handles, encryptedVotes.inputProof)
      ).to.be.revertedWith("Survey does not exist");
    });
  });

  describe("Survey Management", function () {
    beforeEach(async function () {
      // Create a test survey
      await safePollContract
        .connect(signers.alice)
        .createSurvey(
          "Test Survey",
          "A test survey",
          ["Question 1"],
          [["Option A", "Option B"]]
        );
    });

    it("should allow creator to end survey", async function () {
      // Verify survey is initially active
      let surveyInfo = await safePollContract.getSurveyInfo(1);
      expect(surveyInfo[4]).to.eq(true); // isActive

      const tx = await safePollContract
        .connect(signers.alice)
        .endSurvey(1);

      const receipt = await tx.wait();

      // Check for SurveyEnded event
      const events = receipt?.logs || [];
      let surveyEndedEvent = null;

      for (const event of events) {
        try {
          const parsedEvent = safePollContract.interface.parseLog(event);
          if (parsedEvent?.name === "SurveyEnded") {
            surveyEndedEvent = parsedEvent;
            break;
          }
        } catch (e) {
          // Skip non-matching events
        }
      }

      expect(surveyEndedEvent).to.not.be.null;
      expect(surveyEndedEvent?.args.surveyId).to.eq(1);

      // Verify survey is now inactive
      surveyInfo = await safePollContract.getSurveyInfo(1);
      expect(surveyInfo[4]).to.eq(false); // isActive
    });

    it("should reject ending survey by non-creator", async function () {
      await expect(
        safePollContract
          .connect(signers.bob)
          .endSurvey(1)
      ).to.be.revertedWith("Only survey creator can perform this action");
    });

    it("should reject voting on ended survey", async function () {
      // End the survey
      await safePollContract
        .connect(signers.alice)
        .endSurvey(1);

      // Try to vote
      const encryptedInput = await fhevm
        .createEncryptedInput(safePollContractAddress, signers.bob.address)
        .add32(0);
      const encryptedVotes = await encryptedInput.encrypt();

      await expect(
        safePollContract
          .connect(signers.bob)
          .submitVotes(1, encryptedVotes.handles, encryptedVotes.inputProof)
      ).to.be.revertedWith("Survey is not active");
    });

    it("should reject ending non-existent survey", async function () {
      await expect(
        safePollContract
          .connect(signers.alice)
          .endSurvey(999)
      ).to.be.revertedWith("Survey does not exist");
    });
  });

  describe("Encrypted Vote Counts", function () {
    beforeEach(async function () {
      // Create a test survey
      await safePollContract
        .connect(signers.alice)
        .createSurvey(
          "Test Survey",
          "A test survey",
          ["Question 1"],
          [["Option A", "Option B", "Option C"]]
        );
    });

    it("should return encrypted vote counts for options", async function () {
      // Get encrypted count for option 0 (should be initialized to 0)
      const encryptedCount = await safePollContract.getEncryptedOptionCount(1, 0, 0);

      // The encrypted count should be a valid bytes32 value (not zero hash since it's encrypted 0)
      expect(encryptedCount).to.not.eq(ethers.ZeroHash);
    });

    it("should reject getting counts for invalid indices", async function () {
      await expect(
        safePollContract.getEncryptedOptionCount(1, 1, 0) // Invalid question index
      ).to.be.revertedWith("Question index out of bounds");

      await expect(
        safePollContract.getEncryptedOptionCount(1, 0, 3) // Invalid option index
      ).to.be.revertedWith("Option index out of bounds");
    });
  });
});