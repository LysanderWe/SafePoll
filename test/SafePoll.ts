import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { SafePoll, SafePoll__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("SafePoll")) as SafePoll__factory;
  const sp = (await factory.deploy()) as SafePoll;
  const address = await sp.getAddress();
  return { sp, address };
}

describe("SafePoll (local mock)", function () {
  let signers: Signers;
  let sp: SafePoll;
  let spAddress: string;

  before(async function () {
    const s = await ethers.getSigners();
    signers = { deployer: s[0], alice: s[1], bob: s[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("This test suite runs only against the local FHEVM mock");
      this.skip();
    }
    const r = await deployFixture();
    sp = r.sp;
    spAddress = r.address;
  });

  it("creates a survey and records one vote (encrypted)", async function () {
    const title = "Test";
    const desc = "Desc";
    const qTexts = ["Q1", "Q2"];
    const qOpts = [
      ["A", "B"],
      ["X", "Y", "Z"],
    ];

    const txCreate = await sp.connect(signers.alice).createSurvey(title, desc, qTexts, qOpts);
    await txCreate.wait();

    const total = await sp.getTotalSurveys();
    expect(Number(total)).to.eq(1);

    const info = await sp.getSurveyInfo(1);
    expect(info[0]).to.eq(1n);
    expect(info[3]).to.eq(signers.alice.address);
    expect(info[4]).to.eq(true); // isActive

    // choices: Q1 -> 1 (B), Q2 -> 2 (Z)
    const encInput = fhevm.createEncryptedInput(spAddress, signers.bob.address);
    encInput.add32(1); // B
    encInput.add32(2); // Z
    const encrypted = await encInput.encrypt();

    const txVote = await sp
      .connect(signers.bob)
      .submitVotes(1, encrypted.handles as unknown as string[], encrypted.inputProof);
    await txVote.wait();

    expect(await sp.hasUserVoted(1, signers.bob.address)).to.eq(true);
    const infoAfterVote = await sp.getSurveyInfo(1);
    expect(Number(infoAfterVote[7])).to.eq(1); // totalVotes

    // Second voter
    const encInput2 = fhevm.createEncryptedInput(spAddress, signers.alice.address);
    encInput2.add32(0);
    encInput2.add32(1);
    const encrypted2 = await encInput2.encrypt();
    await (await sp
      .connect(signers.alice)
      .submitVotes(1, encrypted2.handles as unknown as string[], encrypted2.inputProof)).wait();

    const infoAfterVote2 = await sp.getSurveyInfo(1);
    expect(Number(infoAfterVote2[7])).to.eq(2); // totalVotes

    // Re-vote with same user should revert
    await expect(
      sp.connect(signers.bob).submitVotes(1, encrypted.handles as unknown as string[], encrypted.inputProof),
    ).to.be.revertedWith("Voted");
  });

  it("ends a survey and requests decryption (no revert)", async function () {
    const txCreate = await sp.connect(signers.alice).createSurvey("T", "D", ["Q"], [["A", "B"]]);
    await txCreate.wait();

    // add a vote so that counters exist and the contract has ACL via allowThis
    const encInput = fhevm.createEncryptedInput(spAddress, signers.bob.address);
    encInput.add32(1);
    const encrypted = await encInput.encrypt();
    await (await sp.connect(signers.bob).submitVotes(1, encrypted.handles as unknown as string[], encrypted.inputProof)).wait();

    const txEnd = await sp.connect(signers.alice).endSurvey(1);
    await txEnd.wait();

    const infoAfter = await sp.getSurveyInfo(1);
    expect(infoAfter[4]).to.eq(false); // isActive

    // Request decryption; on mock this will succeed but not complete any callback
    const txReq = await sp.connect(signers.alice).requestDecryption(1);
    await txReq.wait();
  });
});
