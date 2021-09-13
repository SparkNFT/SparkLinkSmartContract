import { use, expect } from "chai";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { SparkNFT } from "../artifacts/typechain/SparkNFT";
import { BigNumber } from "@ethersproject/bignumber";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import spark_constant from "./spark_constant";
import helper from "./helper";
import { utils } from "ethers";
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

  it('Should NFT name and symbol initialized properly in contract creator', async () => {
    expect(await sparkNFT.name()).to.equal(spark_constant.airpod_ctor_parameters._name);
    expect(await sparkNFT.symbol()).to.equal(spark_constant.airpod_ctor_parameters._symbol);
  });

  context('publish()', async () => {
    it('Should publish reject invalid parameters', async () => {
      // should revert with no valid royalty fee
      { 
        let invalid_parameter = spark_constant.invalid_publish_royalty_fee;
        let error_info = "SparkNFT: Royalty fee should less than 100.";
        await expect(sparkNFT.publish(
          invalid_parameter._first_sell_price, 
          invalid_parameter._royalty_fee, 
          invalid_parameter._shill_times, 
          invalid_parameter.ipfs_hash
        )).to.be.revertedWith(error_info);
      }
      // should revert with royalty fee overflow
      {
        let invalid_parameter = spark_constant.invalid_publish_royalty_fee_overflow;
        await expect(sparkNFT.publish(
          invalid_parameter._first_sell_price, 
          invalid_parameter._royalty_fee, 
          invalid_parameter._shill_times, 
          invalid_parameter.ipfs_hash
        )).to.be.reverted;
      }
      // should revert with shill times overflow      
      {
        let invalid_parameter = spark_constant.invalid_publish_shill_times_overflow;
        await expect(sparkNFT.publish(
          invalid_parameter._first_sell_price, 
          invalid_parameter._royalty_fee, 
          invalid_parameter._shill_times, 
          invalid_parameter.ipfs_hash
        )).to.be.reverted;
      }
      // should revert with first sell price overflow
      {
        let invalid_parameter = spark_constant.invalid_publish_price_overflow;
        await expect(sparkNFT.publish(
          invalid_parameter._first_sell_price, 
          invalid_parameter._royalty_fee, 
          invalid_parameter._shill_times, 
          invalid_parameter.ipfs_hash
        )).to.be.reverted;
      }
      // should revert with ipfs hash overflow
      {
        let invalid_parameter = spark_constant.invalid_publish_ipfs_hash_overflow;
        await expect(sparkNFT.publish(
          invalid_parameter._first_sell_price, 
          invalid_parameter._royalty_fee, 
          invalid_parameter._shill_times, 
          invalid_parameter.ipfs_hash
        )).to.be.reverted;
      }
    });

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

    
  it('should work when shill times is zero', async (): Promise<void> => {
    const other = accounts[1];
    const special_parameters = spark_constant.publish_zero_shill_times;
    const publish_event = await helper.publish(
        sparkNFT, special_parameters._first_sell_price, special_parameters._royalty_fee ,special_parameters._shill_times , special_parameters.ipfs_hash);
    const transfer_event = (await sparkNFT.queryFilter(sparkNFT.filters.Transfer(ethers.constants.AddressZero, owner.address, null)))[0];
    expect(transfer_event.args.from).to.eq(ethers.constants.AddressZero);
    expect(transfer_event.args.to).to.eq(owner.address);
  });

  context('acceptShill()', async () => {
    it('Should acceptShill reject invalid parameters', async () => {
        let other = accounts[1];
        let error_info = "SparkNFT: This NFT is not exist.";
        let invalid_parameter = spark_constant.nft_id_not_exist;
        await expect(sparkNFT.connect(other).acceptShill(invalid_parameter)
        ).to.be.revertedWith(error_info);
    });

    it('Should acceptShill reject not enough ETH', async () => {
        let other = accounts[1];
        const publish_event = await helper.publish(sparkNFT);
        let error_info = "SparkNFT: incorrect ETH";
        const root_nft_id = publish_event.args.rootNFTId;
        await expect(
          sparkNFT.connect(other).acceptShill(root_nft_id, {value: 0})
        ).to.be.revertedWith(error_info);
    });

    it('Should acceptShill reject no remain shill times', async () => {
        let other = accounts[1];
        let loop_times = 10;
        const publish_event = await helper.publish(sparkNFT);
        let error_info = "SparkNFT: There is no remain shill times for this NFT.";
        const root_nft_id = publish_event.args.rootNFTId;
        for (let i = 0; i < loop_times; i += 1) {
          await helper.accept_shill(sparkNFT, other, root_nft_id);
        }
        await expect(
          sparkNFT.connect(other).acceptShill(root_nft_id, {value: 100})
        ).to.be.revertedWith(error_info);
    });

    it('should mint a NFT from an issue', async (): Promise<void> => {
      const other = accounts[1];
      const first_sell_price = BigNumber.from(100);
      const publish_event = await helper.publish(sparkNFT, first_sell_price)
      const root_nft_id = publish_event.args.rootNFTId;
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
    
    it('should mint an owner NFT after remain_shill_times decrease to 0', async (): Promise<void> => {
      const other = accounts[1];
      const shill_price = BigNumber.from(100);
      const publish_event = await helper.publish(sparkNFT, shill_price);
      const root_nft_id = publish_event.args.rootNFTId;
      const issue_id = await sparkNFT.getIssueIdByNFTId(root_nft_id);
      const shill_times = await sparkNFT.getShillTimesByIssueId(issue_id);
      for (let i = 1; i < shill_times; i +=1) {
        await helper.accept_shill(sparkNFT, other, root_nft_id, shill_price);
      }
      await sparkNFT.connect(other).acceptShill(root_nft_id, { value: BigNumber.from(100) })
      const transfer_event = (await sparkNFT.queryFilter(sparkNFT.filters.Transfer(ethers.constants.AddressZero, owner.address, null)))[0];
      expect(transfer_event.args.from).to.eq(ethers.constants.AddressZero);
      expect(transfer_event.args.to).to.eq(owner.address);
    });

    it('should work when first sell price is zero', async (): Promise<void> => {
      const other = accounts[1];
      const special_parameters = spark_constant.publish_zero_first_sell_price;
      const publish_event = await helper.publish(
          sparkNFT, special_parameters._first_sell_price, special_parameters._royalty_fee ,special_parameters._shill_times , special_parameters.ipfs_hash);
      const root_nft_id = publish_event.args.rootNFTId;
      const issue_id = await sparkNFT.getIssueIdByNFTId(root_nft_id);
      const shill_price = await sparkNFT.getShillPriceByNFTId(root_nft_id);
      const shill_times = await sparkNFT.getShillTimesByIssueId(issue_id);
      for (let i = 1; i < shill_times; i +=1) {
        await helper.accept_shill(sparkNFT, other, root_nft_id, shill_price);
      }
      await sparkNFT.connect(other).acceptShill(root_nft_id, { value: 0 })
      const transfer_event = (await sparkNFT.queryFilter(sparkNFT.filters.Transfer(ethers.constants.AddressZero, owner.address, null)))[0];
      expect(transfer_event.args.from).to.eq(ethers.constants.AddressZero);
      expect(transfer_event.args.to).to.eq(owner.address);
    });    
    
    it('should work when royalty fee is zero', async (): Promise<void> => {
      const other = accounts[1];
      const special_parameters = spark_constant.publish_zero_royalty_fee;
      const publish_event = await helper.publish(
          sparkNFT, special_parameters._first_sell_price, special_parameters._royalty_fee ,special_parameters._shill_times , special_parameters.ipfs_hash);
      const root_nft_id = publish_event.args.rootNFTId;
      const issue_id = await sparkNFT.getIssueIdByNFTId(root_nft_id);
      const shill_price = await sparkNFT.getShillPriceByNFTId(root_nft_id);
      const shill_times = await sparkNFT.getShillTimesByIssueId(issue_id);
      for (let i = 1; i < shill_times; i +=1) {
        await helper.accept_shill(sparkNFT, other, root_nft_id, shill_price);
      }
      await sparkNFT.connect(other).acceptShill(root_nft_id, { value: shill_price })
      const transfer_event = (await sparkNFT.queryFilter(sparkNFT.filters.Transfer(ethers.constants.AddressZero, owner.address, null)))[0];
      expect(transfer_event.args.from).to.eq(ethers.constants.AddressZero);
      expect(transfer_event.args.to).to.eq(owner.address);
    });    
    
    it('should work when shill times is one', async (): Promise<void> => {
      const other = accounts[1];
      const special_parameters = spark_constant.publish_one_shill_times;
      const publish_event = await helper.publish(
          sparkNFT, special_parameters._first_sell_price, special_parameters._royalty_fee ,special_parameters._shill_times , special_parameters.ipfs_hash);
      const root_nft_id = publish_event.args.rootNFTId;
      const issue_id = await sparkNFT.getIssueIdByNFTId(root_nft_id);
      const shill_price = await sparkNFT.getShillPriceByNFTId(root_nft_id);
      const shill_times = await sparkNFT.getShillTimesByIssueId(issue_id);
      await sparkNFT.connect(other).acceptShill(root_nft_id, { value: shill_price })
      const transfer_event = (await sparkNFT.queryFilter(sparkNFT.filters.Transfer(ethers.constants.AddressZero, owner.address, null)))[0];
      expect(transfer_event.args.from).to.eq(ethers.constants.AddressZero);
      expect(transfer_event.args.to).to.eq(owner.address);
    }); 

    it('should shill_price decrease by loss ratio', async (): Promise<void> => {
      const loop_times = 17;
      const other = accounts[2];
      const base_account_index = 3;
      let shill_price = BigNumber.from(100);
      const publish_event = await helper.publish(sparkNFT, shill_price);
      const root_nft_id = publish_event.args.rootNFTId;
      let issue_id = await sparkNFT.getIssueIdByNFTId(root_nft_id);
      let royalty_fee = await sparkNFT.getRoyaltyFeeByIssueId(issue_id);
      let sub_royalty_fee = (BigNumber.from(100)).sub(royalty_fee);
      let father_nft_id = root_nft_id;
      let new_nft_id = (await helper.accept_shill(sparkNFT, other, root_nft_id, shill_price)).args.tokenId;
      expect(await sparkNFT.getProfitByNFTId(father_nft_id)).to.eq(shill_price);
      shill_price = shill_price.mul(spark_constant.loss_ratio).div(100);
      for (let i = 0; i < loop_times; i += 1) {
        father_nft_id = new_nft_id;
        new_nft_id = (await helper.accept_shill(sparkNFT, accounts[base_account_index+i], new_nft_id, shill_price)).args.tokenId;
        expect((await sparkNFT.getProfitByNFTId(father_nft_id))).to.eq(BigNumber.from(Math.ceil(Number(shill_price)*Number(sub_royalty_fee)/100)));
        shill_price = shill_price.mul(spark_constant.loss_ratio).div(100);
      }
    });

  });
  context('claimProfit()', async () => {
    it('Should claimProfit reject none exist Edition', async () => {
      {
        let other = accounts[1];
        let error_info = "SparkNFT: Edition is not exist.";
        let invalid_parameter = spark_constant.nft_id_not_exist;
        await expect(sparkNFT.connect(other).claimProfit(invalid_parameter)
        ).to.be.revertedWith(error_info);
      }
    });

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

    it("should transfer ETH from contract balance to owner balance", async (): Promise<void> => {
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

    it("should profit spread from the bottom to the top", async (): Promise<void> => {
      const loop_times = 17;
      const caller = accounts[1];
      const base_account_index = 2;
      let shill_prices:BigNumber[] = new Array;
      let nft_ids:BigNumber[] = new Array;
      let profits:BigNumber[] = new Array(loop_times+1);
      let claim_increases:BigNumber[] = new Array(loop_times+1);
      shill_prices.push(BigNumber.from(100));
      const publish_event = await helper.publish(sparkNFT, shill_prices[0]);
      // length is loop_times+1
      nft_ids.push(publish_event.args.rootNFTId);
      let issue_id = await sparkNFT.getIssueIdByNFTId(nft_ids[0]);
      let royalty_fee = await sparkNFT.getRoyaltyFeeByIssueId(issue_id);
      for (let i = 0; i < loop_times; i += 1){
        nft_ids.push((await helper.accept_shill(sparkNFT, accounts[base_account_index+i], nft_ids[i], shill_prices[i])).args.tokenId);
        shill_prices.push(shill_prices[i].mul(spark_constant.loss_ratio).div(100));
      }
      profits[loop_times] = BigNumber.from(0);
      claim_increases[loop_times] = BigNumber.from(0);
      profits[loop_times-1] = (await sparkNFT.getShillPriceByNFTId(nft_ids[loop_times-1]));
      claim_increases[loop_times-1] = profits[loop_times-1].sub(profits[loop_times-1].mul(royalty_fee).div(100))
      for (let i = loop_times-2; i >= 0; i -= 1){
        profits[i] = profits[i+1].mul(royalty_fee).div(100).add(await sparkNFT.getShillPriceByNFTId(nft_ids[i]));
        claim_increases[i] = profits[i].sub(profits[i].mul(royalty_fee).div(100));
      }
      for (let i = loop_times-1; i >= 1; i -= 1) {
       expect(shill_prices[i].sub(shill_prices[i].mul(royalty_fee).div(100))).to.eq(await sparkNFT.getProfitByNFTId(nft_ids[i]));
      }
      for (let i = 0; i < loop_times; i += 1) {
        expect(await sparkNFT.getEditionIdByNFTId(nft_ids[i])).to.eq(i+1);
      }
      claim_increases[0] = profits[0];
      for (let i = loop_times-1; i >= 0; i -= 1) {
        let before_balance = await ethers.provider.getBalance(await sparkNFT.ownerOf(nft_ids[i]));
        let claim_event = await helper.claim_profit(sparkNFT, caller, nft_ids[i]);
        let amount = claim_event.args.amount;
        let after_balance = await ethers.provider.getBalance(await sparkNFT.ownerOf(nft_ids[i]));
        expect(amount).to.eq(after_balance.sub(before_balance));
        expect(claim_increases[i]).to.eq(amount);
      }
    }) 
    
    it("should profit spread from the bottom to the top when royalty fee is 100", async (): Promise<void> => {
      const loop_times = 17;
      const caller = accounts[1];
      const base_account_index = 2;
      let shill_prices:BigNumber[] = new Array;
      let nft_ids:BigNumber[] = new Array;
      let profits:BigNumber[] = new Array(loop_times+1);
      let claim_increases:BigNumber[] = new Array(loop_times+1);
      let special_parameters = spark_constant.publish_one_hundred_royalty_fee; 
      const publish_event = await helper.publish(
        sparkNFT, special_parameters._first_sell_price, special_parameters._royalty_fee ,special_parameters._shill_times , special_parameters.ipfs_hash);
      // length is loop_times+1
      nft_ids.push(publish_event.args.rootNFTId);
      let issue_id = await sparkNFT.getIssueIdByNFTId(nft_ids[0]);   
      let first_sell_price = await sparkNFT.getShillPriceByNFTId(publish_event.args.rootNFTId);
      shill_prices.push(first_sell_price);
      let royalty_fee = await sparkNFT.getRoyaltyFeeByIssueId(issue_id);
      for (let i = 0; i < loop_times; i += 1){
        nft_ids.push((await helper.accept_shill(sparkNFT, accounts[base_account_index+i], nft_ids[i], shill_prices[i])).args.tokenId);
        shill_prices.push(shill_prices[i].mul(spark_constant.loss_ratio).div(100));
      }
      profits[loop_times] = BigNumber.from(0);
      claim_increases[loop_times] = BigNumber.from(0);
      profits[loop_times-1] = (await sparkNFT.getShillPriceByNFTId(nft_ids[loop_times-1]));
      claim_increases[loop_times-1] = profits[loop_times-1].sub(profits[loop_times-1].mul(royalty_fee).div(100))
      for (let i = loop_times-2; i >= 0; i -= 1){
        profits[i] = profits[i+1].mul(royalty_fee).div(100).add(await sparkNFT.getShillPriceByNFTId(nft_ids[i]));
        claim_increases[i] = profits[i].sub(profits[i].mul(royalty_fee).div(100));
      }
      for (let i = loop_times-1; i >= 1; i -= 1) {
       expect(shill_prices[i].sub(shill_prices[i].mul(royalty_fee).div(100))).to.eq(await sparkNFT.getProfitByNFTId(nft_ids[i]));
      }
      for (let i = 0; i < loop_times; i += 1) {
        expect(await sparkNFT.getEditionIdByNFTId(nft_ids[i])).to.eq(i+1);
      }
      claim_increases[0] = profits[0];
      for (let i = loop_times-1; i >= 0; i -= 1) {
        let before_balance = await ethers.provider.getBalance(await sparkNFT.ownerOf(nft_ids[i]));
        let claim_event = await helper.claim_profit(sparkNFT, caller, nft_ids[i]);
        let amount = claim_event.args.amount;
        let after_balance = await ethers.provider.getBalance(await sparkNFT.ownerOf(nft_ids[i]));
        expect(amount).to.eq(after_balance.sub(before_balance));
        expect(claim_increases[i]).to.eq(amount);
      }
    })
  });
  context('determinePriceAndApprove()', async () => {
    it('Should determinePriceAndApprove reject none exist Edition', async () => {
      {
        let other = accounts[1];
        let caller = accounts[2];
        let error_info = "SparkNFT: NFT's price should set by owner of it.";
        const publish_event = await helper.publish(sparkNFT);
        let root_nft_id = publish_event.args.rootNFTId;
        await expect(sparkNFT.connect(caller).determinePriceAndApprove(root_nft_id, BigNumber.from(12), other.address)
        ).to.be.revertedWith(error_info);
      }
    });

    it('Should determinePriceAndApprove reject none exist Edition', async () => {
      {
        let other = accounts[1];
        let error_info = "SparkNFT: The NFT you want to buy is not exist.";
        let invalid_parameter = spark_constant.nft_id_not_exist;
        await expect(sparkNFT.connect(other).determinePriceAndApprove(invalid_parameter, BigNumber.from(12), owner.address)
        ).to.be.revertedWith(error_info);
      }
    });

    it('Should determinePriceAndApprove reject approve to owner', async () => {
      {
        let other = accounts[1];
        let error_info = "SparkNFT: approval to current owner";
        const publish_event = await helper.publish(sparkNFT);
        let root_nft_id = publish_event.args.rootNFTId;
        await expect(sparkNFT.connect(owner).determinePriceAndApprove(root_nft_id, BigNumber.from(12), owner.address)
        ).to.be.revertedWith(error_info);
      }
    });

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

    it('should determine and approve several times work', async () => {
      const owner = accounts[1];
      const receiver = accounts[2];
      const transfer_event = await helper.accept_shill(sparkNFT, owner);
      const nft_id = transfer_event.args.tokenId;
      const transfer_price = BigNumber.from(100);
      let loop_times = 5;
      for (let i = 0; i < loop_times; i += 1) {
        await sparkNFT
          .connect(owner)
          .determinePriceAndApprove(nft_id, transfer_price.mul(i), accounts[i+3].address);
        const event = (await sparkNFT.queryFilter(sparkNFT.filters.DeterminePriceAndApprove()))[i];
        expect(event.args.NFT_id).to.eq(nft_id);
        expect(event.args.transfer_price).to.eq(transfer_price.mul(i));
        expect(event.args.to).to.eq(accounts[i+3].address);
      }
    });
  });

  context('determinePrice()', async () => {
    it('Should determinePrice reject none exist Edition', async () => {
      {
        let other = accounts[1];
        let error_info = "SparkNFT: The NFT you want to buy is not exist.";
        let invalid_parameter = spark_constant.nft_id_not_exist;
        await expect(sparkNFT.connect(other).determinePrice(invalid_parameter, BigNumber.from(12))
        ).to.be.revertedWith(error_info);
      }
    });

    it('should determine a price', async () => {
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

    it('should determine a price several times work', async () => {
      const owner = accounts[1];
      const receiver = accounts[2];
      const transfer_event = await helper.accept_shill(sparkNFT, owner);
      const nft_id = transfer_event.args.tokenId;
      const transfer_price = BigNumber.from(100);
      let loop_times = 5;
      for (let i = 0; i < loop_times; i += 1) {
        await sparkNFT
          .connect(owner)
          .determinePrice(nft_id, transfer_price.mul(i));
        const event = (await sparkNFT.queryFilter(sparkNFT.filters.DeterminePrice()))[i];
        expect(event.args.NFT_id).to.eq(nft_id);
        expect(event.args.transfer_price).to.eq(transfer_price.mul(i));
      }
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

      await sparkNFT.connect(receiver)["safeTransferFrom(address,address,uint256)"](
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

    it('should transfer give correct profit to seller', async () => {
      let publish_event = await helper.publish(sparkNFT);
      const nft_id = publish_event.args.rootNFTId;
      const price_base = BigNumber.from(100);
      const price_increase = BigNumber.from(11451);
      const loop_times = 10;
      for (let i = 0; i < loop_times; i += 1) {
        await sparkNFT.connect(accounts[i]).determinePriceAndApprove(nft_id, price_base.add(price_increase.mul(i)), accounts[i+1].address);
        const before_owner_balance = await ethers.provider.getBalance(accounts[i].address);
        await sparkNFT.connect(accounts[i+1])["safeTransferFrom(address,address,uint256)"](
          accounts[i].address,
          accounts[i+1].address,
          nft_id,
          { value: price_base.add(price_increase.mul(i))}
        );      
        let transfer_event = (await sparkNFT.queryFilter(sparkNFT.filters.Transfer(
          accounts[i].address,
          accounts[i+1].address,
          nft_id
        )))[0];
        expect(transfer_event.args.from).to.eq(accounts[i].address);
        expect(transfer_event.args.to).to.eq(accounts[i+1].address);
        expect(transfer_event.args.tokenId).to.eq(nft_id);
        let claim_event = (await sparkNFT.queryFilter(sparkNFT.filters.Claim(
          nft_id,
          accounts[i].address,
          null
        )))[0]
        const after_owner_balance = await ethers.provider.getBalance(accounts[i].address);
        expect(claim_event.args.amount).to.eq(price_base.add(price_increase.mul(i)));
        expect(after_owner_balance.sub(before_owner_balance)).to.eq(price_base.add(price_increase.mul(i)));
      }
    })

    it('should transfer give correct profit to seller and father NFT holder', async () => {
      const owner = accounts[0];
      const caller = accounts[1];
      const base_account_index = 2;
      let publish_event = await helper.publish(sparkNFT);
      const root_nft_id = publish_event.args.rootNFTId;
      const issue_id = await sparkNFT.getIssueIdByNFTId(root_nft_id);
      const royalty_fee = await sparkNFT.getRoyaltyFeeByIssueId(issue_id);
      let accept_shill_event = await helper.accept_shill(sparkNFT, accounts[2], root_nft_id);
      let nft_id = accept_shill_event.args.tokenId;
      const price_base = BigNumber.from(100);
      const price_increase = BigNumber.from(11451);
      const loop_times = 15;
      await sparkNFT.connect(caller).claimProfit(root_nft_id);
      for (let i = base_account_index; i < loop_times; i += 1) {
        let transfer_price = price_base.add(price_increase.mul(i));
        let transfer_royalty_price = transfer_price.mul(royalty_fee).div(100);
        let transfer_remain_price = transfer_price.sub(transfer_royalty_price);
        await sparkNFT.connect(accounts[i]).determinePriceAndApprove(nft_id, transfer_price, accounts[i+1].address);
        const before_owner_balance = await ethers.provider.getBalance(accounts[i].address);
        const before_father_balance = await ethers.provider.getBalance(owner.address);
        await sparkNFT.connect(accounts[i+1])["safeTransferFrom(address,address,uint256)"](
          accounts[i].address,
          accounts[i+1].address,
          nft_id,
          { value: price_base.add(price_increase.mul(i))}
        );
        let transfer_event = (await sparkNFT.queryFilter(sparkNFT.filters.Transfer(
          accounts[i].address,
          accounts[i+1].address,
          nft_id
        )))[0];
        expect(transfer_event.args.from).to.eq(accounts[i].address);
        expect(transfer_event.args.to).to.eq(accounts[i+1].address);
        expect(transfer_event.args.tokenId).to.eq(nft_id);
        let transfer_claim_event = (await sparkNFT.queryFilter(sparkNFT.filters.Claim(
          nft_id,
          accounts[i].address,
          null
        )))[0]
        await sparkNFT.connect(caller).claimProfit(root_nft_id);
        let claim_father_event = (await sparkNFT.queryFilter(sparkNFT.filters.Claim(
          root_nft_id,
          owner.address,
          null
        )))[i-base_account_index+1];
        expect(claim_father_event.args.amount).to.eq(transfer_royalty_price);
        const after_father_balance = await ethers.provider.getBalance(owner.address);
        const after_owner_balance = await ethers.provider.getBalance(accounts[i].address);
        expect(transfer_claim_event.args.amount).to.eq(transfer_remain_price);
        expect(after_owner_balance.sub(before_owner_balance)).to.eq(transfer_remain_price);
        expect(after_father_balance.sub(before_father_balance)).to.eq(transfer_royalty_price);
      }
    })
  });

  context('approve()', async () => {
    it('Should approve reject approve to owner', async () => {
      {
        let other = accounts[1];
        let error_info = "SparkNFT: approval to current owner";
        const publish_event = await helper.publish(sparkNFT);
        let root_nft_id = publish_event.args.rootNFTId;
        await expect(sparkNFT.connect(owner).approve(owner.address, root_nft_id)
          ).to.be.revertedWith(error_info);
      }
    });

    it('Should approve reject caller who is not owner', async () => {
      {
        let other = accounts[1];
        let caller = accounts[3];
        let error_info = "SparkNFT: approve caller is not owner nor approved for all";
        const publish_event = await helper.publish(sparkNFT);
        let root_nft_id = publish_event.args.rootNFTId;
        await expect(sparkNFT.connect(caller).approve(other.address, root_nft_id)
          ).to.be.revertedWith(error_info);
      }
    });

    it("should approve an NFT from owner", async () => {
      let publish_event = await helper.publish(sparkNFT);
      let root_nft_id = publish_event.args.rootNFTId;
      let owner = accounts[0];
      let other = accounts[1];
      await sparkNFT.connect(owner).approve(other.address, root_nft_id);
      const event = (await sparkNFT.queryFilter(sparkNFT.filters.Approval()))[0];
      expect(other.address).to.eq(event.args.approved);
    })
  });

  context('setApprovalForAll()', async () => {
    it('Should setApprovalForAll reject approve to caller', async () => {
      {
        await helper.publish(sparkNFT);
        let owner = accounts[0];
        let error_info = "SparkNFT: approve to caller";
        await expect(sparkNFT.connect(owner).setApprovalForAll(owner.address, true)).to.be.revertedWith(error_info);
      }
    });

    it("should approve all an NFT from owner", async () => {
      await helper.publish(sparkNFT);
      let owner = accounts[0];
      let other = accounts[1];
      await sparkNFT.connect(owner).setApprovalForAll(other.address, true);
      expect(true).to.eq(await sparkNFT.isApprovedForAll(owner.address,other.address));
    })

    it("should chancel approve all an NFT from owner", async () => {
      await helper.publish(sparkNFT);
      let owner = accounts[0];
      let other = accounts[1];
      await sparkNFT.connect(owner).setApprovalForAll(other.address, true);
      expect(true).to.eq(await sparkNFT.isApprovedForAll(owner.address,other.address));
      await sparkNFT.connect(owner).setApprovalForAll(other.address, false);
      expect(false).to.eq(await sparkNFT.isApprovedForAll(owner.address,other.address));
    })
  })

  context('setURI()', async () => {
    it("should setURI work", async () => {
      const publish_event = await helper.publish(sparkNFT);
      const tokenId = publish_event.args.rootNFTId;
      const ipfs_hash = spark_constant.hash_2._hash;
      const URI = spark_constant.hash_2._URI;
      const SetURI_event = await helper.setURI(sparkNFT, owner, tokenId, ipfs_hash);
      expect("0x"+ipfs_hash).to.eq(SetURI_event.args.new_URI);
      expect(await sparkNFT.tokenURI(tokenId)).to.eq(URI);
    })
    it ("should setURI reverted with invalid Id", async () => {
      const invalid_parameter = spark_constant.overflow_NFT_id_value;
      await expect(sparkNFT.connect(owner).setURI(invalid_parameter, Buffer.from(spark_constant.hash_2._hash, "hex"))).to.be.reverted;
    })
    it ("should setURI reverted with invalid Id", async () => {
      const invalid_parameter = spark_constant.nft_id_not_exist;
      await expect(sparkNFT.connect(owner).setURI(invalid_parameter, Buffer.from(spark_constant.hash_2._hash, "hex"))).to.be.reverted;
    })
    it ("should setURI reverted with account not owner", async () => {
      const caller = accounts[1];
      const publish_event = await helper.publish(sparkNFT);
      const tokenId = publish_event.args.rootNFTId;
      const error_info = "SparkNFT: Only owner can set token URI";
      await expect(sparkNFT.connect(caller).setURI(tokenId, Buffer.from(spark_constant.hash_2._hash, "hex"))).to.be.revertedWith(error_info);
    })
  })

  context("label()", async () => {
    it("should label work and emit Label event", async () => {
      const publish_event = await helper.publish(sparkNFT);
      const tokenId = publish_event.args.rootNFTId;
      const label = spark_constant.label1;
      await sparkNFT.connect(owner).label(tokenId, label);
      const label_event = (await sparkNFT.queryFilter(sparkNFT.filters.Label(tokenId, null)))[0];
      expect(label_event.args.content).to.eq(label);
    })
    it("should label work and emit Label event with UTF8", async () => {
      const publish_event = await helper.publish(sparkNFT);
      const tokenId = publish_event.args.rootNFTId;
      const label = spark_constant.label1;
      await sparkNFT.connect(owner).label(tokenId, label);
      const label_event = (await sparkNFT.queryFilter(sparkNFT.filters.Label(tokenId, null)))[0];
      expect(label_event.args.content).to.eq(label);
    })
    it ("should label reverted with invalid Id", async () => {
      const invalid_parameter = spark_constant.overflow_NFT_id_value;
      const label = spark_constant.label1;
      await expect(sparkNFT.connect(owner).label(invalid_parameter,label)).to.be.reverted;
    })
    it ("should label reverted with invalid Id", async () => {
      const invalid_parameter = spark_constant.nft_id_not_exist;
      const label = spark_constant.label1;
      await expect(sparkNFT.connect(owner).label(invalid_parameter,label)).to.be.reverted;
    })
    it ("should setURI reverted with account not owner", async () => {
      const caller = accounts[1];
      const publish_event = await helper.publish(sparkNFT);
      const tokenId = publish_event.args.rootNFTId;
      const label = spark_constant.label1;
      const error_info = "SparkNFT: Only owner can label this NFT";
      await expect(sparkNFT.connect(caller).label(tokenId, label)).to.be.revertedWith(error_info);
    })
  })

  context('getApproved()', async () => {
    it("should getApproved correct approve address", async () => {
      let publish_event = await helper.publish(sparkNFT);
      let root_nft_id = publish_event.args.rootNFTId;
      let owner = accounts[0];
      let other = accounts[1];
      await sparkNFT.connect(owner).approve(other.address, root_nft_id);
      expect(other.address).to.eq(await sparkNFT.getApproved(root_nft_id));
    })

    it("should getApproved reject none exist token", async () => {
      let invalid_parameter = spark_constant.nft_id_not_exist;
      let error_info = "SparkNFT: approved query for nonexistent token";
      await expect(sparkNFT.getApproved(invalid_parameter)).to.be.revertedWith(error_info);
    })

    
    it("should getApproved reject overflow tokenId", async () => {
      let invalid_parameter = spark_constant.overflow_NFT_id_value;
      let error_info = "SparkNFT: value doesn't fit in 64 bits";
      await expect(sparkNFT.getApproved(invalid_parameter)).to.be.revertedWith(error_info);
    })
  })

  context('getFatherByNFTId()', async () => {
    it("should getFatherByNFTId reject none exist token", async () => {
      let invalid_parameter = spark_constant.nft_id_not_exist;
      let error_info = "SparkNFT: Edition is not exist.";
      await expect(sparkNFT.getFatherByNFTId(invalid_parameter)).to.be.revertedWith(error_info);
    })
  })

  context('getTransferPriceByNFTId()', async () => {
    it("should getTransferPriceByNFTId reject none exist token", async () => {
      let invalid_parameter = spark_constant.nft_id_not_exist;
      let error_info = "SparkNFT: Edition is not exist.";
      await expect(sparkNFT.getTransferPriceByNFTId(invalid_parameter)).to.be.revertedWith(error_info);
    })
  })

  context('getShillPriceByNFTId()', async () => {
    it("should getShillPriceByNFTId reject none exist token", async () => {
      let invalid_parameter = spark_constant.nft_id_not_exist;
      let error_info = "SparkNFT: Edition is not exist.";
      await expect(sparkNFT.getShillPriceByNFTId(invalid_parameter)).to.be.revertedWith(error_info);
    })
  })

  context('getRemainShillTimesByNFTId()', async () => {
    it("should getRemainShillTimesByNFTId reject none exist token", async () => {
      let invalid_parameter = spark_constant.nft_id_not_exist;
      let error_info = "SparkNFT: Edition is not exist.";
      await expect(sparkNFT.getRemainShillTimesByNFTId(invalid_parameter)).to.be.revertedWith(error_info);
    })
  })

  context('getDepthByNFTId()', async () => {
    it("should getDepthByNFTId reject none exist token", async () => {
      let invalid_parameter = spark_constant.nft_id_not_exist;
      let error_info = "SparkNFT: Edition is not exist.";
      await expect(sparkNFT.getDepthByNFTId(invalid_parameter)).to.be.revertedWith(error_info);
    })
  })
});
