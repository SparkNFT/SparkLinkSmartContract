import { use, expect } from "chai";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { SparkNFT } from "../artifacts/typechain/SparkNFT";
import { BigNumber } from "@ethersproject/bignumber";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

use(solidity);

describe("SparkNFT", function () {
  let sparkNFT: SparkNFT;
  let owner: SignerWithAddress;
  let accounts: SignerWithAddress[];

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    owner = accounts[0]
    const SparkNFTFactory = await ethers.getContractFactory("SparkNFT");
    sparkNFT = (await SparkNFTFactory.deploy()) as SparkNFT;
    sparkNFT = (await sparkNFT.deployed()).connect(owner);
  })

  it("Should return the new greeting once it's changed", async () => {
    expect(await sparkNFT.name()).to.equal("SparkNFT");
    expect(await sparkNFT.symbol()).to.equal("SparkNFT");
  });

  it('should publish an issue and emit event successfully', async () => {
    const publish_tx = await sparkNFT.publish(BigNumber.from(100), BigNumber.from(30), BigNumber.from(10), "TestIssue", "IPFSHASH");
    const receipt = await publish_tx.wait();
    const event = receipt.events?.filter((ev) => { return ev.event == "Publish" })[0]!;

    // console.log(`Publish event: ${event.topics[0]}`);
    // issue_id
    expect(event.topics[1]).to.eq(BigNumber.from(1));
    // publisher
    expect(event.topics[2]).to.hexEqual(owner.address);

    // TODO: check event.data
  })
});
