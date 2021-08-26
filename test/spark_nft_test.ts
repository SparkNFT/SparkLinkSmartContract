import { expect } from "chai";
import { ethers } from "hardhat";
import { SparkNFT } from "../artifacts/typechain/SparkNFT";
import { BigNumber } from "@ethersproject/bignumber";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("SparkNFT", function () {
  let sparkNFT: SparkNFT
  let accounts: SignerWithAddress[]

  beforeEach(async () => {
    const SparkNFTFactory = await ethers.getContractFactory("SparkNFT");
    sparkNFT = (await SparkNFTFactory.deploy()) as SparkNFT;
    await sparkNFT.deployed();
    accounts = await ethers.getSigners();
  })

  it("Should return the new greeting once it's changed", async function () {
    expect(await sparkNFT.name()).to.equal("SparkNFT");
    expect(await sparkNFT.symbol()).to.equal("SparkNFT");
  });

  it('should publish an issue and emit event successfully', async () => {
    const publish_tx = await sparkNFT.connect(accounts[0]).publish(BigNumber.from(100), BigNumber.from(30), BigNumber.from(10), "TestIssue", "IPFSHASH");
    const receipt = await publish_tx.wait();
    const event = receipt.events?.filter((ev) => { return ev.event == "Publish" })[0]!;

    console.log(event.topics);
    // issue_id
    expect(event.topics[1]).to.eq(BigNumber.from(1));
    // publisher
    expect(ethers.utils.hexStripZeros(event.topics[2])).to.eq(accounts[0].address.toLowerCase());
  })
});
