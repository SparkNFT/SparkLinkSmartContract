import { expect } from "chai";
import { ethers } from "hardhat";
import { SparkNFT } from "../artifacts/typechain/SparkNFT"

describe("SparkNFT", function () {
  it("Should return the new greeting once it's changed", async function () {
    const SparkNFTFactory = await ethers.getContractFactory("SparkNFT");
    const sparkNFT = (await SparkNFTFactory.deploy()) as SparkNFT;
    await sparkNFT.deployed();

    expect(await sparkNFT.name()).to.equal("SparkNFT");
    expect(await sparkNFT.symbol()).to.equal("SparkNFT");
  });
});
