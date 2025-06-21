import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import { Groth16Verifier } from "../typechain-types/contracts/approach_2/verifier.sol";
import { AcademicAward } from "../typechain-types/contracts/approach_2/Award.sol";

import * as proof from "../circuits/build/approach_2/proof.json";
import publicInputs from "../circuits/build/approach_2/public.json"


describe("AcademicAward (TypeScript)", function () {
  let academicAward: AcademicAward;
  let verifier: Groth16Verifier;
  let owner: SignerWithAddress;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();
    const VerifierFactory = await ethers.getContractFactory("contracts/approach_2/verifier.sol:Groth16Verifier");
    verifier = (await VerifierFactory.deploy()) as Groth16Verifier;
    await verifier.waitForDeployment();

    const AcademicAwardFactory = await ethers.getContractFactory("contracts/approach_2/Award.sol:AcademicAward");
    const verifierAddress = await verifier.getAddress();
    academicAward = (await AcademicAwardFactory.deploy(verifierAddress)) as AcademicAward;
    await academicAward.waitForDeployment();
  });

  it("Should award an NFT for a valid proof", async function () {
    const a: [string, string] = [proof.pi_a[0], proof.pi_a[1]];
    const b: [[string, string], [string, string]] = [
      [proof.pi_b[0][1], proof.pi_b[0][0]],
      [proof.pi_b[1][1], proof.pi_b[1][0]],
    ];
    const c: [string, string] = [proof.pi_c[0], proof.pi_c[1]];

    const awardTx = await academicAward.awardNFT(a, b, c, publicInputs);

    await expect(awardTx)
      .to.emit(academicAward, "AwardMinted")
      .withArgs(owner.address, publicInputs[0], publicInputs[0]);

    expect(await academicAward.nullifiers(publicInputs[0])).to.be.true;

    expect(await academicAward.ownerOf(publicInputs[0])).to.equal(owner.address);
  });

  it("Should revert if the proof has already been used", async function () {
    const a: [string, string] = [proof.pi_a[0], proof.pi_a[1]];
    const b: [[string, string], [string, string]] = [
      [proof.pi_b[0][1], proof.pi_b[0][0]],
      [proof.pi_b[1][1], proof.pi_b[1][0]],
    ];
    const c: [string, string] = [proof.pi_c[0], proof.pi_c[1]];

    await academicAward.awardNFT(a, b, c, publicInputs);

    await expect(
      academicAward.awardNFT(a, b, c, publicInputs)
    ).to.be.revertedWithCustomError(academicAward, "ProofAlreadyUsed");
  });

  it("Should revert for an invalid proof", async function () {
    const a: [string, string] = ["0", "0"];
    const b: [[string, string], [string, string]] = [
      ["0", "0"],
      ["0", "0"],
    ];
    const c: [string, string] = ["0", "0"];

    await expect(
      academicAward.awardNFT(a, b, c, publicInputs)
    ).to.be.revertedWithCustomError(academicAward, "InvalidProof");
  });
});