import { use, expect } from "chai";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { SparkNFT } from "../artifacts/typechain/SparkNFT";
import { BigNumber } from "@ethersproject/bignumber";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import helper from "./helper";
import exp from "constants";

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
      const event = await helper.publish(sparkNFT)

      expect(event.args.issue_id).to.eq(1);
      expect(event.args.publisher).to.hexEqual(owner.address);
      let root_nft_id = BigNumber.from("0x100000000").add(1);
      let issue_id = await sparkNFT.getIssueIdByNFTId(root_nft_id);
      expect(event.args.rootNFTId).to.eq(BigNumber.from(root_nft_id));
      let URI = "https://ipfs.io/ipfs/QmTfCejgo2wTwqnDJs8Lu1pCNeCrCDuE4GAwkna93zdd7d";
      expect(await sparkNFT.tokenURI(root_nft_id)).to.eq(URI);
      expect(await sparkNFT.getShillTimesByIssueId(issue_id)).to.eq(10);
      expect(await sparkNFT.getShillPriceByNFTId(root_nft_id)).to.eq(BigNumber.from(100));
      expect(await sparkNFT.getTotalAmountByIssueId(issue_id)).to.eq(1);
      expect(await sparkNFT.getRemainShillTimesByNFTId(root_nft_id)).to.eq(10);
    });
  });

  context('acceptShill()', async () => {
    it('should mint a NFT from an issue', async (): Promise<void> => {
      const other = accounts[1];
      const first_sell_price = BigNumber.from(100);

      const publish_event = await helper.publish(sparkNFT, first_sell_price)
      const root_nft_id = publish_event.args.rootNFTId;
      const issue_id = await sparkNFT.getIssueIdByNFTId(root_nft_id);
      expect(await sparkNFT.isEditionExist(root_nft_id)).to.eq(true);
      expect(await sparkNFT.isIssueExist(issue_id)).to.eq(true);
      const transfer_event = await helper.accept_shill(sparkNFT, other, root_nft_id)
      expect(transfer_event.args.to).to.eq(other.address);
      const new_NFT_id = transfer_event.args.tokenId;
      expect(await sparkNFT.getRemainShillTimesByNFTId(root_nft_id)).to.eq(9);
      expect(await sparkNFT.getProfitByNFTId(root_nft_id)).to.eq(100);
      expect(await sparkNFT.getRemainShillTimesByNFTId(new_NFT_id)).to.eq(10);
      expect(await sparkNFT.getFatherByNFTId(new_NFT_id)).to.eq(root_nft_id);

      expect(await sparkNFT.getShillPriceByNFTId(new_NFT_id)).to.eq(90);
      expect(await sparkNFT.ownerOf(new_NFT_id)).to.eq(other.address);
      expect(await sparkNFT.balanceOf(other.address)).to.eq(1);
      expect(await sparkNFT.tokenURI(new_NFT_id)).to.eq(await sparkNFT.tokenURI(root_nft_id));
      const father_id = await sparkNFT.getFatherByNFTId(transfer_event.args.tokenId);
      expect(father_id).to.eq(root_nft_id)
    });
  });
  context('claim()', async () => {
    it('should claim accept shill income', async (): Promise<void> => {
      const other = accounts[1];
      const first_sell_price = BigNumber.from(100);
      const publish_event = await helper.publish(sparkNFT, first_sell_price)
      const root_nft_id = publish_event.args.rootNFTId;
      const issue_id = await sparkNFT.getIssueIdByNFTId(root_nft_id);
      const transfer_event = await helper.accept_shill(sparkNFT, other, root_nft_id)
      const new_NFT_id = transfer_event.args.tokenId;
      const before_balance = await owner.getBalance();
      console.log("before_balance: "+ before_balance);
      let claim_event = await helper.claim_profit(sparkNFT, owner, root_nft_id);
      console.log("after_balance:  "+ await owner.getBalance())
      expect(claim_event.args.NFT_id).to.eq(root_nft_id);
      expect(claim_event.args.amount).to.eq(100);
      expect(claim_event.args.receiver).to.eq(owner.address);
    });
  });
  context('determinePriceAndApprove()', async () => {
    it('should determine a price and approve', async () => {
      const owner = accounts[1];
      const receiver = accounts[2];
      const transfer_event = await helper.accept_shill(sparkNFT, owner);
      const nft_id = transfer_event.args.tokenId;
      const transfer_price = BigNumber.from(100);
      await sparkNFT
        .connect(owner)
        .determinePriceAndApprove(nft_id, transfer_price, receiver.address);

      const event = (await sparkNFT.queryFilter(sparkNFT.filters.DeterminePriceAndApprove()))[0];
      expect(event.args.transfer_price).to.eq(transfer_price);
      expect(event.args.to).to.eq(receiver.address);
    });
  });

  context('determinePrice()', async () => {
    it('should determine a price and approve', async () => {
      const owner = accounts[1];
      const receiver = accounts[2];
      const transfer_event = await helper.accept_shill(sparkNFT, owner);
      const nft_id = transfer_event.args.tokenId;
      const transfer_price = BigNumber.from(100);
      await sparkNFT
        .connect(owner)
        .determinePrice(nft_id, transfer_price);

      const event = (await sparkNFT.queryFilter(sparkNFT.filters.DeterminePrice()))[0];
      expect(event.args.NFT_id).to.eq(nft_id);
      expect(event.args.transfer_price).to.eq(transfer_price);
    });
  });
  context('safeTransferFrom()', async () => {
    it('should transfer an NFT from one to another', async () => {
      let transfer_event = await helper.accept_shill(sparkNFT, accounts[1]);
      const owner = accounts[1];
      const receiver = accounts[2];
      const nft_id = transfer_event.args.tokenId;
      const price = BigNumber.from(100);

      await sparkNFT.connect(owner).determinePriceAndApprove(nft_id, price, receiver.address);

      await sparkNFT.connect(owner)["safeTransferFrom(address,address,uint256)"](
        owner.address,
        receiver.address,
        nft_id,
        { value: price }
      );

      transfer_event = (await sparkNFT.queryFilter(sparkNFT.filters.Transfer(
        owner.address,
        receiver.address,
        nft_id
      )))[0];

      expect(transfer_event.args.from).to.eq(owner.address);
      expect(transfer_event.args.to).to.eq(receiver.address);
      expect(transfer_event.args.tokenId).to.eq(nft_id);
    });
  });

});
