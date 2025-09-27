import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

/**
 * Tutorial: Deploy and Interact Locally (--network localhost)
 * ===========================================================
 *
 * 1. From a separate terminal window:
 *
 *   npx hardhat node
 *
 * 2. Deploy the SafePoll contract
 *
 *   npx hardhat --network localhost deploy
 *
 * 3. Interact with the SafePoll contract
 *
 *   npx hardhat --network localhost task:create-survey --title "Test Survey" --description "A test survey"
 *   npx hardhat --network localhost task:get-survey --survey-id 1
 *   npx hardhat --network localhost task:submit-vote --survey-id 1
 *
 *
 * Tutorial: Deploy and Interact on Sepolia (--network sepolia)
 * ===========================================================
 *
 * 1. Deploy the SafePoll contract
 *
 *   npx hardhat --network sepolia deploy
 *
 * 2. Interact with the SafePoll contract
 *
 *   npx hardhat --network sepolia task:create-survey --title "Test Survey" --description "A test survey"
 *   npx hardhat --network sepolia task:get-survey --survey-id 1
 *
 */

/**
 * Example:
 *   - npx hardhat --network localhost task:address
 *   - npx hardhat --network sepolia task:address
 */
task("task:address", "Prints the SafePoll address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;

  const safePoll = await deployments.get("SafePoll");

  console.log("SafePoll address is " + safePoll.address);
});

/**
 * Example:
 *   - npx hardhat --network localhost task:create-survey --title "Test Survey" --description "A test survey"
 *   - npx hardhat --network sepolia task:create-survey --title "Test Survey" --description "A test survey"
 */
task("task:create-survey", "Creates a new survey")
  .addOptionalParam("address", "Optionally specify the SafePoll contract address")
  .addParam("title", "The survey title")
  .addParam("description", "The survey description")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const safePollDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("SafePoll");
    console.log(`SafePoll: ${safePollDeployment.address}`);

    const signers = await ethers.getSigners();
    const safePollContract = await ethers.getContractAt("SafePoll", safePollDeployment.address);

    // Example survey with 2 questions
    const questionTexts = [
      "What is your favorite programming language?",
      "How many years of programming experience do you have?"
    ];

    const questionOptions = [
      ["JavaScript", "Python", "Solidity", "Rust"],
      ["0-1 years", "2-5 years", "6-10 years", "10+ years"]
    ];

    const tx = await safePollContract
      .connect(signers[0])
      .createSurvey(taskArguments.title, taskArguments.description, questionTexts, questionOptions);

    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);

    // Get the survey ID from events
    const events = receipt?.logs || [];
    for (const event of events) {
      try {
        const parsedEvent = safePollContract.interface.parseLog(event);
        if (parsedEvent?.name === "SurveyCreated") {
          console.log(`Survey created with ID: ${parsedEvent.args.surveyId}`);
          console.log(`Creator: ${parsedEvent.args.creator}`);
          console.log(`Title: ${parsedEvent.args.title}`);
        }
      } catch (e) {
        // Skip non-matching events
      }
    }

    console.log(`SafePoll createSurvey succeeded!`);
  });

/**
 * Example:
 *   - npx hardhat --network localhost task:get-survey --survey-id 1
 *   - npx hardhat --network sepolia task:get-survey --survey-id 1
 */
task("task:get-survey", "Gets survey information")
  .addOptionalParam("address", "Optionally specify the SafePoll contract address")
  .addParam("surveyId", "The survey ID")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const surveyId = parseInt(taskArguments.surveyId);
    if (!Number.isInteger(surveyId) || surveyId <= 0) {
      throw new Error(`Argument --survey-id must be a positive integer`);
    }

    const safePollDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("SafePoll");
    console.log(`SafePoll: ${safePollDeployment.address}`);

    const signers = await ethers.getSigners();
    const safePollContract = await ethers.getContractAt("SafePoll", safePollDeployment.address);

    try {
      const surveyInfo = await safePollContract.getSurveyInfo(surveyId);

      console.log(`Survey Information:`);
      console.log(`ID: ${surveyInfo[0]}`);
      console.log(`Title: ${surveyInfo[1]}`);
      console.log(`Description: ${surveyInfo[2]}`);
      console.log(`Creator: ${surveyInfo[3]}`);
      console.log(`Is Active: ${surveyInfo[4]}`);
      console.log(`Results Decrypted: ${surveyInfo[5]}`);
      console.log(`Question Count: ${surveyInfo[6]}`);
      console.log(`Total Votes: ${surveyInfo[7]}`);
      console.log(`Created At: ${new Date(Number(surveyInfo[8]) * 1000).toISOString()}`);

      // Get question details
      for (let i = 0; i < Number(surveyInfo[6]); i++) {
        const question = await safePollContract.getQuestion(surveyId, i);
        console.log(`\nQuestion ${i + 1}: ${question[0]}`);
        console.log(`Options: ${question[1].join(", ")}`);
      }

    } catch (error) {
      console.error(`Error getting survey: ${error}`);
    }
  });

/**
 * Example:
 *   - npx hardhat --network localhost task:submit-vote --survey-id 1
 *   - npx hardhat --network sepolia task:submit-vote --survey-id 1
 */
task("task:submit-vote", "Submits encrypted votes to a survey")
  .addOptionalParam("address", "Optionally specify the SafePoll contract address")
  .addParam("surveyId", "The survey ID")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    const surveyId = parseInt(taskArguments.surveyId);
    if (!Number.isInteger(surveyId) || surveyId <= 0) {
      throw new Error(`Argument --survey-id must be a positive integer`);
    }

    await fhevm.initializeCLIApi();

    const safePollDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("SafePoll");
    console.log(`SafePoll: ${safePollDeployment.address}`);

    const signers = await ethers.getSigners();
    const safePollContract = await ethers.getContractAt("SafePoll", safePollDeployment.address);

    try {
      // Get survey info to know how many questions
      const surveyInfo = await safePollContract.getSurveyInfo(surveyId);
      const questionCount = Number(surveyInfo[6]);

      console.log(`Survey: ${surveyInfo[1]}`);
      console.log(`Questions: ${questionCount}`);

      // For demo purposes, let's vote for option 0 for all questions
      const votes = Array(questionCount).fill(0);

      // Create encrypted input for all votes
      const encryptedInput = fhevm.createEncryptedInput(safePollDeployment.address, signers[0].address);
      for (const vote of votes) {
        encryptedInput.add32(vote);
      }
      const encryptedVotes = await encryptedInput.encrypt();

      console.log(`Submitting votes: ${votes.join(", ")}`);

      const tx = await safePollContract
        .connect(signers[0])
        .submitVotes(surveyId, encryptedVotes.handles, encryptedVotes.inputProof);

      console.log(`Wait for tx:${tx.hash}...`);
      const receipt = await tx.wait();
      console.log(`tx:${tx.hash} status=${receipt?.status}`);

      console.log(`Vote submission succeeded!`);

    } catch (error) {
      console.error(`Error submitting vote: ${error}`);
    }
  });

/**
 * Example:
 *   - npx hardhat --network localhost task:end-survey --survey-id 1
 *   - npx hardhat --network sepolia task:end-survey --survey-id 1
 */
task("task:end-survey", "Ends a survey (creator only)")
  .addOptionalParam("address", "Optionally specify the SafePoll contract address")
  .addParam("surveyId", "The survey ID")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const surveyId = parseInt(taskArguments.surveyId);
    if (!Number.isInteger(surveyId) || surveyId <= 0) {
      throw new Error(`Argument --survey-id must be a positive integer`);
    }

    const safePollDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("SafePoll");
    console.log(`SafePoll: ${safePollDeployment.address}`);

    const signers = await ethers.getSigners();
    const safePollContract = await ethers.getContractAt("SafePoll", safePollDeployment.address);

    try {
      const tx = await safePollContract
        .connect(signers[0])
        .endSurvey(surveyId);

      console.log(`Wait for tx:${tx.hash}...`);
      const receipt = await tx.wait();
      console.log(`tx:${tx.hash} status=${receipt?.status}`);

      console.log(`Survey ${surveyId} ended successfully!`);

    } catch (error) {
      console.error(`Error ending survey: ${error}`);
    }
  });

/**
 * Example:
 *   - npx hardhat --network localhost task:get-total-surveys
 *   - npx hardhat --network sepolia task:get-total-surveys
 */
task("task:get-total-surveys", "Gets the total number of surveys")
  .addOptionalParam("address", "Optionally specify the SafePoll contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const safePollDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("SafePoll");
    console.log(`SafePoll: ${safePollDeployment.address}`);

    const safePollContract = await ethers.getContractAt("SafePoll", safePollDeployment.address);

    const totalSurveys = await safePollContract.getTotalSurveys();
    console.log(`Total surveys: ${totalSurveys}`);
  });