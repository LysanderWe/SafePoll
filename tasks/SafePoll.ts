import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

/**
 * SafePoll tasks
 *
 * Examples (local mock):
 *   - npx hardhat --network localhost safepoll:address
 *   - npx hardhat --network localhost safepoll:create --title "t" --desc "d" --questions "Q1;Q2" --options "A,B;X,Y,Z"
 *   - npx hardhat --network localhost safepoll:vote --id 1 --choices "0,2"
 *   - npx hardhat --network localhost safepoll:end --id 1
 *   - npx hardhat --network localhost safepoll:request-decrypt --id 1
 */

task("safepoll:address", "Prints the SafePoll address").setAction(async function (_: TaskArguments, hre) {
  const { deployments } = hre;
  const deployed = await deployments.get("SafePoll");
  console.log(`SafePoll address is ${deployed.address}`);
});

task("safepoll:create", "Create a new survey")
  .addParam("title", "Survey title")
  .addParam("desc", "Survey description")
  .addParam(
    "questions",
    "Semicolon-separated question texts. Example: 'Q1;Q2'",
  )
  .addParam(
    "options",
    "Semicolon-separated options per question, comma-separated within each. Example: 'A,B;X,Y,Z'",
  )
  .setAction(async function (args: TaskArguments, hre) {
    const { ethers, deployments } = hre;
    const deployed = await deployments.get("SafePoll");
    const sp = await ethers.getContractAt("SafePoll", deployed.address);

    const questionTexts: string[] = String(args.questions)
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const questionOptions: string[][] = String(args.options)
      .split(";")
      .map((group) => group.split(",").map((s) => s.trim()).filter((s) => s.length > 0))
      .filter((arr) => arr.length > 0);

    if (questionTexts.length === 0 || questionTexts.length !== questionOptions.length) {
      throw new Error("questions/options length mismatch or empty");
    }

    const tx = await sp.createSurvey(args.title, args.desc, questionTexts, questionOptions);
    const rc = await tx.wait();
    const ev = rc?.logs?.find(() => true);
    console.log(`Create tx: ${tx.hash}`);
    // Read back total surveys
    const total = await sp.getTotalSurveys();
    console.log(`Total surveys: ${total}`);
  });

task("safepoll:survey", "Show survey info")
  .addParam("id", "Survey id")
  .setAction(async function (args: TaskArguments, hre) {
    const { ethers, deployments } = hre;
    const deployed = await deployments.get("SafePoll");
    const sp = await ethers.getContractAt("SafePoll", deployed.address);
    const id = Number(args.id);
    const info = await sp.getSurveyInfo(id);
    console.log({ info });
    const qCount = Number(info[6]);
    for (let i = 0; i < qCount; i++) {
      const [text, options] = await sp.getQuestion(id, i);
      console.log(`Q${i}: ${text}`);
      console.log(`  options: ${options.join(", ")}`);
    }
  });

task("safepoll:vote", "Submit encrypted choices for a survey")
  .addParam("id", "Survey id")
  .addParam("choices", "Comma-separated choice indices per question, e.g. '0,2,1'")
  .setAction(async function (args: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;
    await fhevm.initializeCLIApi();

    const deployed = await deployments.get("SafePoll");
    const sp = await ethers.getContractAt("SafePoll", deployed.address);

    const id = Number(args.id);
    const info = await sp.getSurveyInfo(id);
    const qCount = Number(info[6]);

    const choiceList: number[] = String(args.choices)
      .split(",")
      .map((s) => parseInt(s.trim(), 10));
    if (choiceList.length !== qCount || choiceList.some((x) => !Number.isInteger(x) || x < 0)) {
      throw new Error(`choices must provide ${qCount} non-negative integers`);
    }

    const signers = await ethers.getSigners();
    const encInput = fhevm.createEncryptedInput(deployed.address, signers[0].address);
    for (const c of choiceList) {
      encInput.add32(c);
    }
    const encrypted = await encInput.encrypt();

    const tx = await sp.submitVotes(id, encrypted.handles as unknown as string[], encrypted.inputProof);
    await tx.wait();
    console.log(`Vote tx: ${tx.hash}`);
  });

task("safepoll:end", "End a survey (creator only)")
  .addParam("id", "Survey id")
  .setAction(async function (args: TaskArguments, hre) {
    const { ethers, deployments } = hre;
    const deployed = await deployments.get("SafePoll");
    const sp = await ethers.getContractAt("SafePoll", deployed.address);
    const tx = await sp.endSurvey(Number(args.id));
    await tx.wait();
    console.log(`End tx: ${tx.hash}`);
  });

task("safepoll:request-decrypt", "Request public decryption (creator only)")
  .addParam("id", "Survey id")
  .setAction(async function (args: TaskArguments, hre) {
    const { ethers, deployments } = hre;
    const deployed = await deployments.get("SafePoll");
    const sp = await ethers.getContractAt("SafePoll", deployed.address);
    const tx = await sp.requestDecryption(Number(args.id));
    await tx.wait();
    console.log(`Request decrypt tx: ${tx.hash}`);
  });

