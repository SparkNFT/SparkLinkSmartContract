import { use, expect } from "chai";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { SparkNFT } from "../artifacts/typechain/SparkNFT";
import { BigNumber } from "@ethersproject/bignumber";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import spark_constant from "./spark_constant";
import helper from "./helper";

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

  it('Should NFT name and symbol initialized properly in contract creator', async () => {
    expect(await sparkNFT.name()).to.equal(spark_constant.airpod_ctor_parameters._name);
    expect(await sparkNFT.symbol()).to.equal(spark_constant.airpod_ctor_parameters._symbol);
  });

  context('publish()', async () => {
    it('should publish an issue and emit event successfully', async () => {
      const event = await helper.publish(sparkNFT)

      expect(event.args.issue_id).to.eq(1);
      expect(event.args.publisher).to.hexEqual(owner.address);
      let root_nft_id = BigNumber.from("0x100000000").add(1);
      let issue_id = await sparkNFT.getIssueIdByNFTId(root_nft_id);
      expect(event.args.rootNFTId).to.eq(BigNumber.from(root_nft_id));
      expect(await sparkNFT.tokenURI(root_nft_id)).to.eq(spark_constant.default_hash_1._URI);
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
      const contract_balance_before_acceptShill = await ethers.provider.getBalance(sparkNFT.address);
      const transfer_event = await helper.accept_shill(sparkNFT, other, root_nft_id);
      const contract_balance_after_acceptShill = await ethers.provider.getBalance(sparkNFT.address);
      expect(contract_balance_after_acceptShill.sub(contract_balance_before_acceptShill)).to.eq(await sparkNFT.getShillPriceByNFTId(root_nft_id));
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
    it('should emit Claim event', async (): Promise<void> => {
      const other = accounts[1];
      const caller = accounts[2];
      const first_sell_price = BigNumber.from(100);
      const publish_event = await helper.publish(sparkNFT, first_sell_price)
      const root_nft_id = publish_event.args.rootNFTId;
      await helper.accept_shill(sparkNFT, other, root_nft_id);
      const claim_event = await helper.claim_profit(sparkNFT, caller, root_nft_id);
      expect(claim_event.args.NFT_id).to.eq(root_nft_id);
      expect(claim_event.args.receiver).to.eq(owner.address);
      expect(claim_event.args.amount).to.eq(await sparkNFT.getShillPriceByNFTId(root_nft_id));
      
    });
    it("should transfer from contract balance to owner balance", async (): Promise<void> => {
      const other = accounts[1];
      const caller = accounts[2];
      const first_sell_price = BigNumber.from(100);
      const publish_event = await helper.publish(sparkNFT, first_sell_price)
      const root_nft_id = publish_event.args.rootNFTId;
      await helper.accept_shill(sparkNFT, other, root_nft_id);
      const contract_balance_before_claimProfit = await ethers.provider.getBalance(sparkNFT.address);
      const owner_balance_before_claimProfit = await ethers.provider.getBalance(owner.address);
      await helper.claim_profit(sparkNFT, caller, root_nft_id);
      const contract_balance_after_claimProfit = await ethers.provider.getBalance(sparkNFT.address);
      const owner_balance_after_claimProfit = await ethers.provider.getBalance(owner.address);
      expect(contract_balance_before_claimProfit.sub(contract_balance_after_claimProfit)).
        to.eq(await sparkNFT.getShillPriceByNFTId(root_nft_id));
      expect(owner_balance_after_claimProfit.sub(owner_balance_before_claimProfit)).
        to.eq(await sparkNFT.getShillPriceByNFTId(root_nft_id));
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
