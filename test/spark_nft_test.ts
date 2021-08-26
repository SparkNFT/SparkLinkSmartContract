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
    owner = accounts[0];
    const SparkNFTFactory = await ethers.getContractFactory("SparkNFT");
    sparkNFT = (await SparkNFTFactory.deploy()) as SparkNFT;
    sparkNFT = (await sparkNFT.deployed()).connect(owner);
  });

  it("Should return the new greeting once it's changed", async () => {
    expect(await sparkNFT.name()).to.equal("SparkNFT");
    expect(await sparkNFT.symbol()).to.equal("SparkNFT");
  });

  context('publish()', async () => {
    it('should publish an issue and emit event successfully', async () => {
      await sparkNFT.publish(
        BigNumber.from(100),
        BigNumber.from(30),
        BigNumber.from(10),
        "TestIssue",
        "IPFSHASH"
      );
      const filter = sparkNFT.filters.Publish();
      const results = await sparkNFT.queryFilter(filter);
      const event = results[0];

      expect(event.args.issue_id).to.eq(BigNumber.from(1));
      expect(event.args.publisher).to.hexEqual(owner.address);
      // TODO: make this rootNFTId validation match the contract.
      // expect(event.args.rootNFTId).to.eq(BigNumber.from(0));

      // Issue data
      expect(event.args.issueData.name).to.eq("TestIssue");
      expect(event.args.issueData.issue_id).to.eq(BigNumber.from(1));
      expect(event.args.issueData.total_amount).to.eq(BigNumber.from(1));
      expect(event.args.issueData.shill_times).to.eq(BigNumber.from(10));
      expect(event.args.issueData.royalty_fee).to.eq(30);
      expect(event.args.issueData.ipfs_hash).to.eq('IPFSHASH');
      expect(event.args.issueData.first_sell_price).to.eq(BigNumber.from(100))
    });
  });

  context('acceptShill()', async () => {
    it('should mint a NFT from an issue', async (): Promise<void> => {
      const other = accounts[1];
      const first_sell_price = BigNumber.from(100);

      await sparkNFT.publish(
        first_sell_price,
        BigNumber.from(30),
        BigNumber.from(10),
        "TestIssue",
        "IPFSHASH"
      );
      const publish_event = (await sparkNFT.queryFilter(sparkNFT.filters.Publish()))[0];
      const root_nft_id = publish_event.args.rootNFTId;
      expect(await sparkNFT.isEditionExist(root_nft_id)).to.eq(true);

      await sparkNFT.connect(other).accepetShill(root_nft_id, { value: first_sell_price });
      const mint_event = (await sparkNFT.queryFilter(sparkNFT.filters.Mint(null, null, other.address)))[0];

      console.log(mint_event.args.NFT_id);
    });
  });

  context('safeTransferFrom()', async () => {
    it('should transfer an NFT from one to another', async () => {

    });
  });

});
