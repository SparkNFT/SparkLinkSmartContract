import { use, expect } from "chai";
import { solidity } from "ethereum-waffle";
import { artifacts, ethers } from "hardhat";
import { SparkLink } from "../artifacts/typechain/SparkLink";
import { TestTokenA } from "../artifacts/typechain/TestTokenA";
import { BurnToken } from "../artifacts/typechain/BurnToken";
import { BigNumber } from "@ethersproject/bignumber";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import spark_constant from "./spark_constant";
import helper from "./helper";
import { utils } from "ethers";
import exp from "constants";
import jsonABI_UniswapV2Factory from "@uniswap/v2-core/build/UniswapV2Factory.json";
import jsonABI_UniswapV2Router02 from "@uniswap/v2-periphery/build/UniswapV2Router02.json";
import jsonABI_WETH9 from "@uniswap/v2-periphery/build/WETH9.json";
import { connect } from "http2";
import { Contract } from "hardhat/internal/hardhat-network/stack-traces/model";
import { Address } from "cluster";
use(solidity);

describe("SparkLink", function () {
  let SparkLink: SparkLink;
  let owner: SignerWithAddress;
  let caller: SignerWithAddress;
  let aha : SignerWithAddress;
  let accounts: SignerWithAddress[];
  let UniswapV2FactoryInterface = new ethers.utils.Interface(jsonABI_UniswapV2Factory.abi);
  let UniswapV2Factory;
  let UniswapV2FactoryAddress:String;
  let UniswapV2Router02Interface = new ethers.utils.Interface(jsonABI_UniswapV2Router02.abi);
  let UniswapV2Router02;
  let UniswapV2Router02Address:String;
  let WETH9Interface = new ethers.utils.Interface(jsonABI_WETH9.abi);
  let WETH9;

  beforeEach(async () => {
    accounts = await ethers.getSigners();
    owner = accounts[0];
    caller = accounts[19];
    aha = accounts[18];
    let UniswapV2FactoryFactory = new ethers.ContractFactory(UniswapV2FactoryInterface, jsonABI_UniswapV2Factory.evm.bytecode.object, owner);
    let UniswapV2FactoryContract = await UniswapV2FactoryFactory.deploy(owner.address);
    UniswapV2Factory = (await UniswapV2FactoryContract.deployed()).connect(owner);
    let WETH9Factory = new ethers.ContractFactory(WETH9Interface, jsonABI_WETH9.evm.bytecode.object, owner);
    let WETH9Contract = await WETH9Factory.deploy();
    WETH9 = (await WETH9Contract.deployed()).connect(owner)
    let UniswapV2Router02Factory = new ethers.ContractFactory(UniswapV2Router02Interface, jsonABI_UniswapV2Router02.evm.bytecode.object, owner);
    let UniswapV2Router02Contract = await UniswapV2Router02Factory.deploy(UniswapV2Factory.address, WETH9.address);
    let UniswapV2Router02 = (await UniswapV2Router02Contract.deployed()).connect(owner);
    UniswapV2FactoryAddress = UniswapV2Factory.address;
    UniswapV2Router02Address =  UniswapV2Router02.address;
    const SparkLinkFactory = await ethers.getContractFactory("SparkLink");
    SparkLink = (await SparkLinkFactory.deploy(caller.address, aha.address, UniswapV2Router02Address, UniswapV2FactoryAddress)) as SparkLink;
    SparkLink = (await SparkLink.deployed()).connect(owner);
  });

  it('Should NFT name and symbol initialized properly in contract creator', async () => {
    expect(await SparkLink.name()).to.equal(spark_constant.airpod_ctor_parameters._name);
    expect(await SparkLink.symbol()).to.equal(spark_constant.airpod_ctor_parameters._symbol);
  });

  context('publish()', async () => {
    it('Should publish reject invalid parameters', async () => {
      // should revert with no valid royalty fee
      { 
        let invalid_parameter = spark_constant.invalid_publish_royalty_fee;
        let error_info = "SparkLink: Royalty fee should be <= 100%.";
        await expect(SparkLink.publish(
          invalid_parameter._first_sell_price, 
          invalid_parameter._royalty_fee, 
          invalid_parameter._shill_times, 
          invalid_parameter.ipfs_hash,
          invalid_parameter.token_addr,
          invalid_parameter.is_free,
          invalid_parameter.is_NC,
          invalid_parameter.is_ND
        )).to.be.revertedWith(error_info);
      }
      // should revert with royalty fee overflow
      {
        let invalid_parameter = spark_constant.invalid_publish_royalty_fee_overflow;
        await expect(SparkLink.publish(
          invalid_parameter._first_sell_price, 
          invalid_parameter._royalty_fee, 
          invalid_parameter._shill_times, 
          invalid_parameter.ipfs_hash,
          invalid_parameter.token_addr,
          invalid_parameter.is_free,
          invalid_parameter.is_NC,
          invalid_parameter.is_ND
        )).to.be.reverted;
      }
      // should revert with shill times overflow      
      {
        let invalid_parameter = spark_constant.invalid_publish_shill_times_overflow;
        await expect(SparkLink.publish(
          invalid_parameter._first_sell_price, 
          invalid_parameter._royalty_fee, 
          invalid_parameter._shill_times, 
          invalid_parameter.ipfs_hash,
          invalid_parameter.token_addr,
          invalid_parameter.is_free,
          invalid_parameter.is_NC,
          invalid_parameter.is_ND
        )).to.be.reverted;
      }
      // should revert with first sell price overflow
      {
        let invalid_parameter = spark_constant.invalid_publish_price_overflow;
        await expect(SparkLink.publish(
          invalid_parameter._first_sell_price, 
          invalid_parameter._royalty_fee, 
          invalid_parameter._shill_times, 
          invalid_parameter.ipfs_hash,
          invalid_parameter.token_addr,
          invalid_parameter.is_free,
          invalid_parameter.is_NC,
          invalid_parameter.is_ND
        )).to.be.reverted;
      }
      // should revert with ipfs hash overflow
      {
        let invalid_parameter = spark_constant.invalid_publish_ipfs_hash_overflow;
        await expect(SparkLink.publish(
          invalid_parameter._first_sell_price, 
          invalid_parameter._royalty_fee, 
          invalid_parameter._shill_times, 
          invalid_parameter.ipfs_hash,
          invalid_parameter.token_addr,
          invalid_parameter.is_free,
          invalid_parameter.is_NC,
          invalid_parameter.is_ND
        )).to.be.reverted;
      }
    });

    it('should publish an issue and emit event successfully', async () => {
      const event = await helper.publish(SparkLink)

      expect(event.args.publisher).to.hexEqual(owner.address);
      let root_nft_id = BigNumber.from("0x100000000").add(1);
      expect(event.args.rootNFTId).to.eq(BigNumber.from(root_nft_id));
      expect(await SparkLink.tokenURI(root_nft_id)).to.eq(spark_constant.default_hash_1._URI);
      expect(await SparkLink.getShillTimesByNFTId(root_nft_id)).to.eq(10);
      expect(await SparkLink.getShillPriceByNFTId(root_nft_id)).to.eq(BigNumber.from(100));
      expect(await SparkLink.getTotalAmountByNFTId(root_nft_id)).to.eq(1);
      expect(await SparkLink.getRemainShillTimesByNFTId(root_nft_id)).to.eq(10);
    });    

    it('should publish an issue and emit event successfully with test token', async () => {
      const TestTokenA = await ethers.getContractFactory('TestTokenA');
      const testTokenA = await TestTokenA.deploy(spark_constant.testTokenMintAmount);
      let testTokenAContract = await testTokenA.deployed();
      let test_token_parameter = spark_constant.valid_publish_parameters;
      test_token_parameter.token_addr = testTokenAContract.address;
      const event = await helper.publish(
        SparkLink,
        test_token_parameter._first_sell_price,
        test_token_parameter._royalty_fee,
        test_token_parameter._shill_times,
        test_token_parameter.ipfs_hash,
        testTokenAContract.address
        );
      expect(event.args.publisher).to.hexEqual(owner.address);
      let root_nft_id = BigNumber.from("0x100000000").add(1);
      expect(event.args.rootNFTId).to.eq(BigNumber.from(root_nft_id));
      expect(await SparkLink.tokenURI(root_nft_id)).to.eq(spark_constant.default_hash_1._URI);
      expect(await SparkLink.getShillTimesByNFTId(root_nft_id)).to.eq(10);
      expect(await SparkLink.getShillPriceByNFTId(root_nft_id)).to.eq(test_token_parameter._first_sell_price);
      expect(await SparkLink.getTotalAmountByNFTId(root_nft_id)).to.eq(1);
      expect(await SparkLink.getRemainShillTimesByNFTId(root_nft_id)).to.eq(10);
    });

    it('should publish an issue and emit event successfully with burn token', async () => {
      const BurnToken = await ethers.getContractFactory('BurnToken');
      const burnToken = await BurnToken.deploy(spark_constant.testTokenMintAmount);
      let BurnTokenContract = await burnToken.deployed();
      let test_token_parameter = spark_constant.valid_publish_parameters;
      test_token_parameter.token_addr = BurnTokenContract.address;
      const event = await helper.publish(
        SparkLink,
        test_token_parameter._first_sell_price,
        test_token_parameter._royalty_fee,
        test_token_parameter._shill_times,
        test_token_parameter.ipfs_hash,
        BurnTokenContract.address
        );
      expect(event.args.publisher).to.hexEqual(owner.address);
      let root_nft_id = BigNumber.from("0x100000000").add(1);
      expect(event.args.rootNFTId).to.eq(BigNumber.from(root_nft_id));
      expect(await SparkLink.tokenURI(root_nft_id)).to.eq(spark_constant.default_hash_1._URI);
      expect(await SparkLink.getShillTimesByNFTId(root_nft_id)).to.eq(10);
      expect(await SparkLink.getShillPriceByNFTId(root_nft_id)).to.eq(test_token_parameter._first_sell_price);
      expect(await SparkLink.getTotalAmountByNFTId(root_nft_id)).to.eq(1);
      expect(await SparkLink.getRemainShillTimesByNFTId(root_nft_id)).to.eq(10);
    });

    it('should work when shill times is zero', async (): Promise<void> => {
      const other = accounts[1];
      const special_parameters = spark_constant.publish_zero_shill_times;
      const publish_event = await helper.publish(
          SparkLink, special_parameters._first_sell_price, special_parameters._royalty_fee ,special_parameters._shill_times , special_parameters.ipfs_hash);
      const transfer_event = (await SparkLink.queryFilter(SparkLink.filters.Transfer(ethers.constants.AddressZero, owner.address, null)))[0];
      expect(transfer_event.args.from).to.eq(ethers.constants.AddressZero);
      expect(transfer_event.args.to).to.eq(owner.address);
    });

});

  context('acceptShill()', async () => {
    it('Should acceptShill reject invalid parameters', async () => {
        let other = accounts[1];
        let error_info = "SparkLink: This NFT does not exist";
        let invalid_parameter = spark_constant.nft_id_not_exist;
        await expect(SparkLink.connect(other).acceptShill(invalid_parameter)
        ).to.be.revertedWith(error_info);
    });

    it('Should acceptShill reject not enough ETH', async () => {
        let other = accounts[1];
        const publish_event = await helper.publish(SparkLink);
        let error_info = "SparkLink: Wrong price";
        const root_nft_id = publish_event.args.rootNFTId;
        await expect(
          SparkLink.connect(other).acceptShill(root_nft_id, {value: 0})
        ).to.be.revertedWith(error_info);
    });

    it('Should acceptShill reject no remain shill times', async () => {
        let other = accounts[1];
        let loop_times = 10;
        const publish_event = await helper.publish(SparkLink);
        let error_info = "SparkLink: There is no remaining shill time for this NFT";
        const root_nft_id = publish_event.args.rootNFTId;
        for (let i = 0; i < loop_times; i += 1) {
          await helper.accept_shill(SparkLink, other, root_nft_id);
        }
        await expect(
          SparkLink.connect(other).acceptShill(root_nft_id, {value: 100})
        ).to.be.revertedWith(error_info);
    });

    it('should mint a NFT from an issue', async (): Promise<void> => {
      const other = accounts[1];
      const first_sell_price = BigNumber.from(100);
      const publish_event = await helper.publish(SparkLink, first_sell_price)
      const root_nft_id = publish_event.args.rootNFTId;
      const contract_balance_before_acceptShill = await ethers.provider.getBalance(SparkLink.address);
      const transfer_event = await helper.accept_shill(SparkLink, other, root_nft_id);
      const contract_balance_after_acceptShill = await ethers.provider.getBalance(SparkLink.address);
      expect(contract_balance_after_acceptShill.sub(contract_balance_before_acceptShill)).to.eq(await SparkLink.getShillPriceByNFTId(root_nft_id));
      expect(transfer_event.args.to).to.eq(other.address);
      const new_NFT_id = transfer_event.args.tokenId;
      expect(await SparkLink.getRemainShillTimesByNFTId(root_nft_id)).to.eq(9);
      expect(await SparkLink.getProfitByNFTId(root_nft_id)).to.eq(100*(100-spark_constant.DAO_fee)/100);
      expect(await SparkLink.getRemainShillTimesByNFTId(new_NFT_id)).to.eq(10);
      expect(await SparkLink.getFatherByNFTId(new_NFT_id)).to.eq(root_nft_id);
      expect(await SparkLink.getShillPriceByNFTId(new_NFT_id)).to.eq(first_sell_price.mul(spark_constant.loss_ratio).div(100));
      expect(await SparkLink.ownerOf(new_NFT_id)).to.eq(other.address);
      expect(await SparkLink.balanceOf(other.address)).to.eq(1);
      expect(await SparkLink.tokenURI(new_NFT_id)).to.eq(await SparkLink.tokenURI(root_nft_id));
      const father_id = await SparkLink.getFatherByNFTId(transfer_event.args.tokenId);
      expect(father_id).to.eq(root_nft_id)
    });
    
    it('should mint an owner NFT after remain_shill_times decrease to 0', async (): Promise<void> => {
      const other = accounts[1];
      const shill_price = BigNumber.from(100);
      const publish_event = await helper.publish(SparkLink, shill_price);
      const root_nft_id = publish_event.args.rootNFTId;
      const shill_times = await SparkLink.getShillTimesByNFTId(root_nft_id);
      for (let i = 1; i < shill_times; i +=1) {
        await helper.accept_shill(SparkLink, other, root_nft_id, shill_price);
      }
      await SparkLink.connect(other).acceptShill(root_nft_id, { value: BigNumber.from(100) })
      const transfer_event = (await SparkLink.queryFilter(SparkLink.filters.Transfer(ethers.constants.AddressZero, owner.address, null)))[0];
      expect(transfer_event.args.from).to.eq(ethers.constants.AddressZero);
      expect(transfer_event.args.to).to.eq(owner.address);
    });

    it('should work when first sell price is zero', async (): Promise<void> => {
      const other = accounts[1];
      const special_parameters = spark_constant.publish_zero_first_sell_price;
      const publish_event = await helper.publish(
          SparkLink, special_parameters._first_sell_price, special_parameters._royalty_fee ,special_parameters._shill_times , special_parameters.ipfs_hash);
      const root_nft_id = publish_event.args.rootNFTId;
      const shill_price = await SparkLink.getShillPriceByNFTId(root_nft_id);
      const shill_times = await SparkLink.getShillTimesByNFTId(root_nft_id);
      for (let i = 1; i < shill_times; i +=1) {
        await helper.accept_shill(SparkLink, other, root_nft_id, shill_price);
      }
      await SparkLink.connect(other).acceptShill(root_nft_id, { value: 0 })
      const transfer_event = (await SparkLink.queryFilter(SparkLink.filters.Transfer(ethers.constants.AddressZero, owner.address, null)))[0];
      expect(transfer_event.args.from).to.eq(ethers.constants.AddressZero);
      expect(transfer_event.args.to).to.eq(owner.address);
    });    
    
    it('should work when royalty fee is zero', async (): Promise<void> => {
      const other = accounts[1];
      const special_parameters = spark_constant.publish_zero_royalty_fee;
      const publish_event = await helper.publish(
          SparkLink, special_parameters._first_sell_price, special_parameters._royalty_fee ,special_parameters._shill_times , special_parameters.ipfs_hash);
      const root_nft_id = publish_event.args.rootNFTId;
      const shill_price = await SparkLink.getShillPriceByNFTId(root_nft_id);
      const shill_times = await SparkLink.getShillTimesByNFTId(root_nft_id);
      for (let i = 1; i < shill_times; i +=1) {
        await helper.accept_shill(SparkLink, other, root_nft_id, shill_price);
      }
      await SparkLink.connect(other).acceptShill(root_nft_id, { value: shill_price })
      const transfer_event = (await SparkLink.queryFilter(SparkLink.filters.Transfer(ethers.constants.AddressZero, owner.address, null)))[0];
      expect(transfer_event.args.from).to.eq(ethers.constants.AddressZero);
      expect(transfer_event.args.to).to.eq(owner.address);
    });    
    
    it('should work when shill times is one', async (): Promise<void> => {
      const other = accounts[1];
      const special_parameters = spark_constant.publish_one_shill_times;
      const publish_event = await helper.publish(
          SparkLink, special_parameters._first_sell_price, special_parameters._royalty_fee ,special_parameters._shill_times , special_parameters.ipfs_hash);
      const root_nft_id = publish_event.args.rootNFTId;
      const shill_price = await SparkLink.getShillPriceByNFTId(root_nft_id);
      const shill_times = await SparkLink.getShillTimesByNFTId(root_nft_id);
      await SparkLink.connect(other).acceptShill(root_nft_id, { value: shill_price })
      const transfer_event = (await SparkLink.queryFilter(SparkLink.filters.Transfer(ethers.constants.AddressZero, owner.address, null)))[0];
      expect(transfer_event.args.from).to.eq(ethers.constants.AddressZero);
      expect(transfer_event.args.to).to.eq(owner.address);
    }); 

    it('should shill_price decrease by loss ratio', async (): Promise<void> => {
      const loop_times = 17;
      const other = accounts[2];
      const base_account_index = 3;
      let shill_price = BigNumber.from(1000000);
      const publish_event = await helper.publish(SparkLink, shill_price);
      const root_nft_id = publish_event.args.rootNFTId;
      let royalty_fee = await SparkLink.getRoyaltyFeeByNFTId(root_nft_id);
      let DAO_fee = spark_constant.DAO_fee;
      let sub_DAO_fee = 100 - DAO_fee;
      let sub_royalty_fee = (BigNumber.from(100)).sub(royalty_fee);
      let father_nft_id = root_nft_id;
      let new_nft_id = (await helper.accept_shill(SparkLink, other, root_nft_id, shill_price)).args.tokenId;
      expect(await SparkLink.getProfitByNFTId(father_nft_id)).to.eq(shill_price.mul(100-DAO_fee).div(100));
      shill_price = shill_price.mul(spark_constant.loss_ratio).div(100);
      for (let i = 0; i < loop_times; i += 1) {
        father_nft_id = new_nft_id;
        new_nft_id = (await helper.accept_shill(SparkLink, accounts[base_account_index+i], new_nft_id, shill_price)).args.tokenId;
        expect((await SparkLink.getProfitByNFTId(father_nft_id))).to.eq(BigNumber.from(Math.ceil(Math.ceil(Number(shill_price)*sub_DAO_fee/100)*Number(sub_royalty_fee)/100)));
        shill_price = shill_price.mul(spark_constant.loss_ratio).div(100);
      }
    });
    it('should shill_price decrease by loss ratio with test token', async (): Promise<void> => {
      const TestTokenA = await ethers.getContractFactory('TestTokenA');
      const testTokenA = await TestTokenA.deploy(spark_constant.testTokenMintAmount);
      let testTokenAContract = await testTokenA.deployed();
      let test_token_parameter = spark_constant.valid_publish_parameters;
      test_token_parameter.token_addr = testTokenAContract.address;
      const publish_event = await helper.publish(
        SparkLink,
        test_token_parameter._first_sell_price,
        test_token_parameter._royalty_fee,
        test_token_parameter._shill_times,
        test_token_parameter.ipfs_hash,
        testTokenAContract.address
      );
      const loop_times = 17;
      const other = accounts[2];
      const base_account_index = 3;
      let shill_price = test_token_parameter._first_sell_price;
      const root_nft_id = publish_event.args.rootNFTId;
      let royalty_fee = await SparkLink.getRoyaltyFeeByNFTId(root_nft_id);
      let sub_royalty_fee = (BigNumber.from(100)).sub(royalty_fee);
      let DAO_fee = spark_constant.DAO_fee;
      let sub_DAO_fee = 100-DAO_fee;
      let father_nft_id = root_nft_id;
      await testTokenAContract.connect(owner).approve(owner.address, spark_constant.testTokenMintAmount);
      await testTokenAContract.connect(owner).transferFrom(owner.address, other.address,shill_price);
      await testTokenAContract.connect(other).approve(SparkLink.address, shill_price);
      let new_nft_id = (await helper.accept_shill(SparkLink, other, root_nft_id, shill_price)).args.tokenId;
      expect(await SparkLink.getProfitByNFTId(father_nft_id)).to.eq(shill_price.sub(shill_price.mul(DAO_fee).div(100)));
      shill_price = shill_price.mul(spark_constant.loss_ratio).div(100);
      for (let i = 0; i < loop_times; i += 1) {
        father_nft_id = new_nft_id;
        await testTokenAContract.connect(owner).transferFrom(owner.address, accounts[base_account_index+i].address,shill_price);
        await testTokenAContract.connect(accounts[base_account_index+i]).approve(SparkLink.address, shill_price);
        new_nft_id = (await helper.accept_shill(SparkLink, accounts[base_account_index+i], new_nft_id, shill_price)).args.tokenId;
        expect((await SparkLink.getProfitByNFTId(father_nft_id))).to.eq(BigNumber.from(Math.ceil(Math.ceil(Number(shill_price)*sub_DAO_fee/100)*Number(sub_royalty_fee)/100)));
        shill_price = shill_price.mul(spark_constant.loss_ratio).div(100);
      }
    });
    it('should shill_price decrease by loss ratio with burn token', async (): Promise<void> => {
      const BurnToken = await ethers.getContractFactory('BurnToken');
      const burnToken = await BurnToken.deploy(spark_constant.testTokenMintAmount);
      let BurnTokenContract = await burnToken.deployed();
      let test_token_parameter = spark_constant.valid_publish_parameters;
      test_token_parameter.token_addr = BurnTokenContract.address;
      const publish_event = await helper.publish(
        SparkLink,
        test_token_parameter._first_sell_price,
        test_token_parameter._royalty_fee,
        test_token_parameter._shill_times,
        test_token_parameter.ipfs_hash,
        BurnTokenContract.address
        );
      const loop_times = 17;
      const other = accounts[2];
      const base_account_index = 3;
      let shill_price = test_token_parameter._first_sell_price;
      const root_nft_id = publish_event.args.rootNFTId;
      let royalty_fee = await SparkLink.getRoyaltyFeeByNFTId(root_nft_id);
      let sub_royalty_fee = (BigNumber.from(100)).sub(royalty_fee);
      let DAO_fee = spark_constant.DAO_fee;
      let father_nft_id = root_nft_id;
      await BurnTokenContract.connect(owner).transfer( other.address,shill_price.mul(2));
      await BurnTokenContract.connect(other).approve(SparkLink.address, shill_price);
      let new_nft_id = (await helper.accept_shill(SparkLink, other, root_nft_id, shill_price)).args.tokenId;
      expect(await SparkLink.getProfitByNFTId(father_nft_id)).to.eq(shill_price.div(2).sub(shill_price.div(2).mul(DAO_fee).div(100)));
      shill_price = shill_price.mul(spark_constant.loss_ratio).div(100);
      for (let i = 0; i < loop_times; i += 1) {
        father_nft_id = new_nft_id;
        await BurnTokenContract.connect(owner).transfer(accounts[base_account_index+i].address,shill_price.mul(2));
        await BurnTokenContract.connect(accounts[base_account_index+i]).approve(SparkLink.address, shill_price);
        new_nft_id = (await helper.accept_shill(SparkLink, accounts[base_account_index+i], new_nft_id, shill_price)).args.tokenId;
        expect((await SparkLink.getProfitByNFTId(father_nft_id))).to.eq(BigNumber.from(Math.ceil(Number(shill_price.div(2).sub(shill_price.div(2).mul(DAO_fee).div(100)))*Number(sub_royalty_fee)/100)));
        shill_price = shill_price.mul(spark_constant.loss_ratio).div(100);
      }
    });
  });
  context('claimProfit()', async () => {
    it('Should claimProfit reject none exist Edition', async () => {
      {
        let other = accounts[1];
        let error_info = "SparkLink: This edition does not exist";
        let invalid_parameter = spark_constant.nft_id_not_exist;
        await expect(SparkLink.connect(other).claimProfit(invalid_parameter)
        ).to.be.revertedWith(error_info);
      }
    });

    it('should emit Claim event', async (): Promise<void> => {
      const other = accounts[1];
      const caller = accounts[2];
      const first_sell_price = BigNumber.from(100);
      const publish_event = await helper.publish(SparkLink, first_sell_price)
      const root_nft_id = publish_event.args.rootNFTId;
      await helper.accept_shill(SparkLink, other, root_nft_id);
      const claim_event = await helper.claim_profit(SparkLink, caller, root_nft_id);
      expect(claim_event.args.NFT_id).to.eq(root_nft_id);
      expect(claim_event.args.receiver).to.eq(owner.address);
      let shillPrice = await SparkLink.getShillPriceByNFTId(root_nft_id)
      expect(claim_event.args.amount).to.eq(shillPrice.sub(shillPrice.mul(spark_constant.DAO_fee).div(100)));
    });

    it("should transfer ETH from contract balance to owner balance", async (): Promise<void> => {
      const other = accounts[1];
      const caller = accounts[2];
      const first_sell_price = BigNumber.from(100);
      const publish_event = await helper.publish(SparkLink, first_sell_price)
      const root_nft_id = publish_event.args.rootNFTId;
      await helper.accept_shill(SparkLink, other, root_nft_id);
      const contract_balance_before_claimProfit = await ethers.provider.getBalance(SparkLink.address);
      const owner_balance_before_claimProfit = await ethers.provider.getBalance(owner.address);
      await helper.claim_profit(SparkLink, caller, root_nft_id);
      const contract_balance_after_claimProfit = await ethers.provider.getBalance(SparkLink.address);
      const owner_balance_after_claimProfit = await ethers.provider.getBalance(owner.address);
      expect(contract_balance_before_claimProfit.sub(contract_balance_after_claimProfit)).
        to.eq(await SparkLink.getShillPriceByNFTId(root_nft_id));
      expect(owner_balance_after_claimProfit.sub(owner_balance_before_claimProfit)).
        to.eq(first_sell_price.sub(first_sell_price.mul(spark_constant.DAO_fee).div(100)));
    });

    it("should transfer test token A from contract balance to owner balance", async (): Promise<void> => {
      const TestTokenA = await ethers.getContractFactory('TestTokenA');
      const testTokenA = await TestTokenA.deploy(spark_constant.testTokenMintAmount);
      let testTokenAContract = await testTokenA.deployed();
      let test_token_parameter = spark_constant.valid_publish_parameters;
      test_token_parameter.token_addr = testTokenAContract.address;
      const publish_event = await helper.publish(
        SparkLink,
        test_token_parameter._first_sell_price,
        test_token_parameter._royalty_fee,
        test_token_parameter._shill_times,
        test_token_parameter.ipfs_hash,
        testTokenAContract.address
        );
      const other = accounts[1];
      const shill_price = spark_constant.valid_publish_parameters._first_sell_price;
      await testTokenAContract.connect(owner).approve(owner.address, spark_constant.testTokenMintAmount);
      await testTokenAContract.connect(owner).transferFrom(owner.address, other.address,shill_price);
      await testTokenAContract.connect(other).approve(SparkLink.address, shill_price);
      const root_nft_id = publish_event.args.rootNFTId;
      await helper.accept_shill(SparkLink, other, root_nft_id);
      const contract_balance_before_claimProfit = await testTokenAContract.balanceOf(SparkLink.address);
      const owner_balance_before_claimProfit = await testTokenAContract.balanceOf(owner.address);
      await helper.claim_profit(SparkLink, caller, root_nft_id);
      const contract_balance_after_claimProfit = await testTokenAContract.balanceOf(SparkLink.address);
      const owner_balance_after_claimProfit = await testTokenAContract.balanceOf(owner.address);
      expect(contract_balance_before_claimProfit.sub(contract_balance_after_claimProfit)).
        to.eq(shill_price);
      expect(owner_balance_after_claimProfit.sub(owner_balance_before_claimProfit)).
        to.eq(shill_price.sub(shill_price.mul(spark_constant.DAO_fee).div(100)));
    });

    it("should profit spread from the bottom to the top", async (): Promise<void> => {
      const loop_times = 17;
      const base_account_index = 2;
      let shill_prices:BigNumber[] = new Array;
      let nft_ids:BigNumber[] = new Array;
      let profits:BigNumber[] = new Array(loop_times+1);
      let claim_increases:BigNumber[] = new Array(loop_times+1);
      shill_prices.push(BigNumber.from(10000000));
      const publish_event = await helper.publish(SparkLink, shill_prices[0]);
      // length is loop_times+1
      nft_ids.push(publish_event.args.rootNFTId);
      let royalty_fee = await SparkLink.getRoyaltyFeeByNFTId(publish_event.args.rootNFTId);
      let DAO_fee = spark_constant.DAO_fee;
      for (let i = 0; i < loop_times; i += 1){
        nft_ids.push((await helper.accept_shill(SparkLink, accounts[base_account_index+i], nft_ids[i], shill_prices[i])).args.tokenId);
        shill_prices.push(shill_prices[i].mul(spark_constant.loss_ratio).div(100));
      }
      profits[loop_times] = BigNumber.from(0);
      claim_increases[loop_times] = BigNumber.from(0);
      profits[loop_times-1] = (await SparkLink.getShillPriceByNFTId(nft_ids[loop_times-1]));
      profits[loop_times-1] = profits[loop_times-1].sub(profits[loop_times-1].mul(DAO_fee).div(100));
      claim_increases[loop_times-1] = profits[loop_times-1].sub(profits[loop_times-1].mul(royalty_fee).div(100))
      for (let i = loop_times-2; i >= 0; i -= 1){
        profits[i] = profits[i+1].mul(royalty_fee).div(100).add(await SparkLink.getShillPriceByNFTId(nft_ids[i]));
        profits[i] = profits[i].sub(profits[i].mul(DAO_fee).div(100));
        claim_increases[i] = profits[i].sub(profits[i].mul(royalty_fee).div(100));
      }
      for (let i = loop_times-1; i >= 1; i -= 1) {
        shill_prices[i] = shill_prices[i].sub(shill_prices[i].mul(DAO_fee).div(100));
      }
      for (let i = loop_times-1; i >= 1; i -= 1) {
       expect(shill_prices[i].sub(shill_prices[i].mul(royalty_fee).div(100))).to.eq(await SparkLink.getProfitByNFTId(nft_ids[i]));
      }
      for (let i = 0; i < loop_times; i += 1) {
        expect(await SparkLink.getEditionIdByNFTId(nft_ids[i])).to.eq(i+1);
      }
      claim_increases[0] = profits[0];
      for (let i = loop_times-1; i >= 0; i -= 1) {
        let before_balance = await ethers.provider.getBalance(await SparkLink.ownerOf(nft_ids[i]));
        let claim_event = await helper.claim_profit(SparkLink, caller, nft_ids[i]);
        let amount = claim_event.args.amount;
        let after_balance = await ethers.provider.getBalance(await SparkLink.ownerOf(nft_ids[i]));
        expect(amount).to.eq(after_balance.sub(before_balance));
        expect(claim_increases[i]).to.eq(amount);
      }
    }) 
    
    it("should profit spread from the bottom to the top with test token A", async (): Promise<void> => {
      const TestTokenA = await ethers.getContractFactory('TestTokenA');
      const testTokenA = await TestTokenA.deploy(spark_constant.testTokenMintAmount);
      let testTokenAContract = await testTokenA.deployed();
      let test_token_parameter = spark_constant.valid_publish_parameters;
      test_token_parameter.token_addr = testTokenAContract.address;
      const loop_times = 17;
      const caller = accounts[1];
      const base_account_index = 2;
      let shill_prices:BigNumber[] = new Array;
      let nft_ids:BigNumber[] = new Array;
      let profits:BigNumber[] = new Array(loop_times+1);
      let claim_increases:BigNumber[] = new Array(loop_times+1);
      shill_prices.push(spark_constant.valid_publish_parameters._first_sell_price);
      const publish_event = await helper.publish(
        SparkLink,
        shill_prices[0],
        test_token_parameter._royalty_fee,
        test_token_parameter._shill_times,
        test_token_parameter.ipfs_hash,
        testTokenAContract.address
        );
      // length is loop_times+1
      nft_ids.push(publish_event.args.rootNFTId);
      let royalty_fee = await SparkLink.getRoyaltyFeeByNFTId(publish_event.args.rootNFTId);
      let DAO_fee = spark_constant.DAO_fee;
      for (let i = 0; i < loop_times; i += 1){
        await testTokenAContract.connect(owner).transfer(accounts[base_account_index+i].address, shill_prices[i]);
        await testTokenAContract.connect(accounts[base_account_index+i]).approve(SparkLink.address, shill_prices[i]);
        nft_ids.push((await helper.accept_shill(SparkLink, accounts[base_account_index+i], nft_ids[i], shill_prices[i])).args.tokenId);
        shill_prices.push(shill_prices[i].mul(spark_constant.loss_ratio).div(100));
      }
      profits[loop_times] = BigNumber.from(0);
      claim_increases[loop_times] = BigNumber.from(0);
      profits[loop_times-1] = (await SparkLink.getShillPriceByNFTId(nft_ids[loop_times-1]));
      profits[loop_times-1] = profits[loop_times-1].sub(profits[loop_times-1].mul(DAO_fee).div(100));
      claim_increases[loop_times-1] = profits[loop_times-1].sub(profits[loop_times-1].mul(royalty_fee).div(100))
      for (let i = loop_times-2; i >= 0; i -= 1){
        profits[i] = profits[i+1].mul(royalty_fee).div(100).add(await SparkLink.getShillPriceByNFTId(nft_ids[i]));
        profits[i] = profits[i].sub(profits[i].mul(DAO_fee).div(100));
        claim_increases[i] = profits[i].sub(profits[i].mul(royalty_fee).div(100));
      }
      for (let i = loop_times-1; i >= 1; i -= 1) {
        shill_prices[i] = shill_prices[i].sub(shill_prices[i].mul(DAO_fee).div(100));
      }
      for (let i = loop_times-1; i >= 1; i -= 1) {
       expect(shill_prices[i].sub(shill_prices[i].mul(royalty_fee).div(100))).to.eq(await SparkLink.getProfitByNFTId(nft_ids[i]));
      }
      for (let i = 0; i < loop_times; i += 1) {
        expect(await SparkLink.getEditionIdByNFTId(nft_ids[i])).to.eq(i+1);
      }
      claim_increases[0] = profits[0];
      for (let i = loop_times-1; i >= 0; i -= 1) {
        let before_balance = await await testTokenAContract.balanceOf(await SparkLink.ownerOf(nft_ids[i]));
        let claim_event = await helper.claim_profit(SparkLink, caller, nft_ids[i]);
        let amount = claim_event.args.amount;
        let after_balance = await testTokenAContract.balanceOf(await SparkLink.ownerOf(nft_ids[i]));
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
        SparkLink, special_parameters._first_sell_price, special_parameters._royalty_fee ,special_parameters._shill_times , special_parameters.ipfs_hash);
      // length is loop_times+1
      nft_ids.push(publish_event.args.rootNFTId);
      let first_sell_price = await SparkLink.getShillPriceByNFTId(publish_event.args.rootNFTId);
      shill_prices.push(first_sell_price);
      let royalty_fee = await SparkLink.getRoyaltyFeeByNFTId(publish_event.args.rootNFTId);
      let DAO_fee = spark_constant.DAO_fee;
      for (let i = 0; i < loop_times; i += 1){
        nft_ids.push((await helper.accept_shill(SparkLink, accounts[base_account_index+i], nft_ids[i], shill_prices[i])).args.tokenId);
        shill_prices.push(shill_prices[i].mul(spark_constant.loss_ratio).div(100));
      }
      profits[loop_times] = BigNumber.from(0);
      claim_increases[loop_times] = BigNumber.from(0);
      profits[loop_times-1] = (await SparkLink.getShillPriceByNFTId(nft_ids[loop_times-1]));
      profits[loop_times-1] = profits[loop_times-1].sub(profits[loop_times-1].mul(DAO_fee).div(100));
      claim_increases[loop_times-1] = profits[loop_times-1].sub(profits[loop_times-1].mul(royalty_fee).div(100))
      for (let i = loop_times-2; i >= 0; i -= 1){
        profits[i] = profits[i+1].mul(royalty_fee).div(100).add(await SparkLink.getShillPriceByNFTId(nft_ids[i]));
        profits[i] = profits[i].sub(profits[i].mul(DAO_fee).div(100));
        claim_increases[i] = profits[i].sub(profits[i].mul(royalty_fee).div(100));
      }
      for (let i = loop_times-1; i >= 1; i -= 1) {
        shill_prices[i] = shill_prices[i].sub(shill_prices[i].mul(DAO_fee).div(100));
      }
      for (let i = loop_times-1; i >= 1; i -= 1) {
        expect(shill_prices[i].sub(shill_prices[i].mul(royalty_fee).div(100))).to.eq(await SparkLink.getProfitByNFTId(nft_ids[i]));
      }
      for (let i = 0; i < loop_times; i += 1) {
        expect(await SparkLink.getEditionIdByNFTId(nft_ids[i])).to.eq(i+1);
      }
      claim_increases[0] = profits[0];
      for (let i = loop_times-1; i >= 0; i -= 1) {
        let before_balance = await ethers.provider.getBalance(await SparkLink.ownerOf(nft_ids[i]));
        let claim_event = await helper.claim_profit(SparkLink, caller, nft_ids[i]);
        let amount = claim_event.args.amount;
        let after_balance = await ethers.provider.getBalance(await SparkLink.ownerOf(nft_ids[i]));
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
        let error_info = "SparkLink: Only owner can set the price";
        const publish_event = await helper.publish(SparkLink);
        let root_nft_id = publish_event.args.rootNFTId;
        await expect(SparkLink.connect(caller).determinePriceAndApprove(root_nft_id, BigNumber.from(12), other.address)
        ).to.be.revertedWith(error_info);
      }
    });

    it('Should determinePriceAndApprove reject none exist Edition', async () => {
      {
        let other = accounts[1];
        let error_info = "SparkLink: This NFT does not exist";
        let invalid_parameter = spark_constant.nft_id_not_exist;
        await expect(SparkLink.connect(other).determinePriceAndApprove(invalid_parameter, BigNumber.from(12), owner.address)
        ).to.be.revertedWith(error_info);
      }
    });

    it('Should determinePriceAndApprove reject approve to owner', async () => {
      {
        let other = accounts[1];
        let error_info = "SparkLink: Approval to current owner"
        const publish_event = await helper.publish(SparkLink);
        let root_nft_id = publish_event.args.rootNFTId;
        await expect(SparkLink.connect(owner).determinePriceAndApprove(root_nft_id, BigNumber.from(12), owner.address)
        ).to.be.revertedWith(error_info);
      }
    });

    it('should determine a price and approve', async () => {
      const owner = accounts[1];
      const receiver = accounts[2];
      const transfer_event = await helper.accept_shill(SparkLink, owner);
      const nft_id = transfer_event.args.tokenId;
      const transfer_price = BigNumber.from(100);
      await SparkLink
        .connect(owner)
        .determinePriceAndApprove(nft_id, transfer_price, receiver.address);
      const event = (await SparkLink.queryFilter(SparkLink.filters.DeterminePriceAndApprove()))[0];
      expect(event.args.transfer_price).to.eq(transfer_price);
      expect(event.args.to).to.eq(receiver.address);
    });

    it('should determine and approve several times work', async () => {
      const owner = accounts[1];
      const receiver = accounts[2];
      const transfer_event = await helper.accept_shill(SparkLink, owner);
      const nft_id = transfer_event.args.tokenId;
      const transfer_price = BigNumber.from(100);
      let loop_times = 5;
      for (let i = 0; i < loop_times; i += 1) {
        await SparkLink
          .connect(owner)
          .determinePriceAndApprove(nft_id, transfer_price.mul(i), accounts[i+3].address);
        const event = (await SparkLink.queryFilter(SparkLink.filters.DeterminePriceAndApprove()))[i];
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
        let error_info = "SparkLink: This NFT does not exist";
        let invalid_parameter = spark_constant.nft_id_not_exist;
        await expect(SparkLink.connect(other).determinePrice(invalid_parameter, BigNumber.from(12))
                  ).to.be.revertedWith(error_info);
      }
    });

    it('should determine a price', async () => {
      const owner = accounts[1];
      const receiver = accounts[2];
      const transfer_event = await helper.accept_shill(SparkLink, owner);
      const nft_id = transfer_event.args.tokenId;
      const transfer_price = BigNumber.from(100);
      await SparkLink
        .connect(owner)
        .determinePrice(nft_id, transfer_price);
      const event = (await SparkLink.queryFilter(SparkLink.filters.DeterminePrice()))[0];
      expect(event.args.NFT_id).to.eq(nft_id);
      expect(event.args.transfer_price).to.eq(transfer_price);
    });

    it('should determine a price several times work', async () => {
      const owner = accounts[1];
      const receiver = accounts[2];
      const transfer_event = await helper.accept_shill(SparkLink, owner);
      const nft_id = transfer_event.args.tokenId;
      const transfer_price = BigNumber.from(100);
      let loop_times = 5;
      for (let i = 0; i < loop_times; i += 1) {
        await SparkLink
          .connect(owner)
          .determinePrice(nft_id, transfer_price.mul(i));
        const event = (await SparkLink.queryFilter(SparkLink.filters.DeterminePrice()))[i];
        expect(event.args.NFT_id).to.eq(nft_id);
        expect(event.args.transfer_price).to.eq(transfer_price.mul(i));
      }
    });
  });

  context('safeTransferFrom()', async () => {
    it('should transfer an NFT from one to another', async () => {
      let transfer_event = await helper.accept_shill(SparkLink, accounts[1]);
      const owner = accounts[1];
      const receiver = accounts[2];
      const nft_id = transfer_event.args.tokenId;
      const price = BigNumber.from(100);

      await SparkLink.connect(owner).determinePriceAndApprove(nft_id, price, receiver.address);

      await SparkLink.connect(receiver)["safeTransferFrom(address,address,uint256)"](
        owner.address,
        receiver.address,
        nft_id,
        { value: price }
      );

      transfer_event = (await SparkLink.queryFilter(SparkLink.filters.Transfer(
        owner.address,
        receiver.address,
        nft_id
      )))[0];

      expect(transfer_event.args.from).to.eq(owner.address);
      expect(transfer_event.args.to).to.eq(receiver.address);
      expect(transfer_event.args.tokenId).to.eq(nft_id);
    });

    it('should transfer give correct profit to seller', async () => {
      let publish_event = await helper.publish(SparkLink);
      const nft_id = publish_event.args.rootNFTId;
      const price_base = BigNumber.from(100);
      const price_increase = BigNumber.from(11451);
      const loop_times = 10;
      for (let i = 0; i < loop_times; i += 1) {
        await SparkLink.connect(accounts[i]).determinePriceAndApprove(nft_id, price_base.add(price_increase.mul(i)), accounts[i+1].address);
        const before_owner_balance = await ethers.provider.getBalance(accounts[i].address);
        await SparkLink.connect(accounts[i+1])["safeTransferFrom(address,address,uint256)"](
          accounts[i].address,
          accounts[i+1].address,
          nft_id,
          { value: price_base.add(price_increase.mul(i))}
        );      
        let transfer_event = (await SparkLink.queryFilter(SparkLink.filters.Transfer(
          accounts[i].address,
          accounts[i+1].address,
          nft_id
        )))[0];
        expect(transfer_event.args.from).to.eq(accounts[i].address);
        expect(transfer_event.args.to).to.eq(accounts[i+1].address);
        expect(transfer_event.args.tokenId).to.eq(nft_id);
        let claim_event = (await SparkLink.queryFilter(SparkLink.filters.Claim(
          nft_id,
          accounts[i].address,
          null
        )))[0];
        const after_owner_balance = await ethers.provider.getBalance(accounts[i].address);
        let true_price = price_base.add(price_increase.mul(i));
        true_price = true_price.sub(true_price.mul(spark_constant.DAO_fee).div(100));
        expect(claim_event.args.amount).to.eq(true_price);
        expect(after_owner_balance.sub(before_owner_balance)).to.eq(true_price);
      }
    })

    it('should transfer give correct profit to seller and father NFT holder', async () => {
      const owner = accounts[0];
      const base_account_index = 2;
      let publish_event = await helper.publish(SparkLink);
      const root_nft_id = publish_event.args.rootNFTId;
      const royalty_fee = await SparkLink.getRoyaltyFeeByNFTId(publish_event.args.rootNFTId);
      let accept_shill_event = await helper.accept_shill(SparkLink, accounts[2], root_nft_id);
      let nft_id = accept_shill_event.args.tokenId;
      const price_base = BigNumber.from(10000000);
      const price_increase = BigNumber.from(114510000);
      const loop_times = 15;
      await SparkLink.connect(caller).claimProfit(root_nft_id);
      for (let i = base_account_index; i < loop_times; i += 1) {
        let transfer_price = price_base.add(price_increase.mul(i));
        let exclude_DAO_transfer_price = transfer_price.sub(transfer_price.mul(spark_constant.DAO_fee).div(100));
        let transfer_royalty_price = exclude_DAO_transfer_price.mul(royalty_fee).div(100);
        let transfer_remain_price = exclude_DAO_transfer_price.sub(transfer_royalty_price);
        await SparkLink.connect(accounts[i]).determinePriceAndApprove(nft_id, transfer_price, accounts[i+1].address);
        const before_owner_balance = await ethers.provider.getBalance(accounts[i].address);
        const before_father_balance = await ethers.provider.getBalance(owner.address);
        await SparkLink.connect(accounts[i+1])["safeTransferFrom(address,address,uint256)"](
          accounts[i].address,
          accounts[i+1].address,
          nft_id,
          { value: price_base.add(price_increase.mul(i))}
        );
        let transfer_event = (await SparkLink.queryFilter(SparkLink.filters.Transfer(
          accounts[i].address,
          accounts[i+1].address,
          nft_id
        )))[0];
        expect(transfer_event.args.from).to.eq(accounts[i].address);
        expect(transfer_event.args.to).to.eq(accounts[i+1].address);
        expect(transfer_event.args.tokenId).to.eq(nft_id);
        let transfer_claim_event = (await SparkLink.queryFilter(SparkLink.filters.Claim(
          nft_id,
          accounts[i].address,
          null
        )))[0]
        await SparkLink.connect(caller).claimProfit(root_nft_id);
        let claim_father_event = (await SparkLink.queryFilter(SparkLink.filters.Claim(
          root_nft_id,
          owner.address,
          null
        )))[i-base_account_index+1];
        transfer_royalty_price = transfer_royalty_price.sub(transfer_royalty_price.mul(spark_constant.DAO_fee).div(100));
        expect(claim_father_event.args.amount).to.eq(transfer_royalty_price);
        const after_father_balance = await ethers.provider.getBalance(owner.address);
        const after_owner_balance = await ethers.provider.getBalance(accounts[i].address);
        expect(transfer_claim_event.args.amount).to.eq(transfer_remain_price);
        expect(after_owner_balance.sub(before_owner_balance)).to.eq(transfer_remain_price);
        expect(after_father_balance.sub(before_father_balance)).to.eq(transfer_royalty_price);
      }
    });
    it('should transfer give correct profit to seller and father NFT holder with test token', async () => {
      const TestTokenA = await ethers.getContractFactory('TestTokenA');
      const testTokenA = await TestTokenA.deploy(spark_constant.testTokenMintAmount);
      let testTokenAContract = await testTokenA.deployed();
      let test_token_parameter = spark_constant.valid_publish_parameters;
      test_token_parameter.token_addr = testTokenAContract.address;
      const publish_event = await helper.publish(
        SparkLink,
        test_token_parameter._first_sell_price,
        test_token_parameter._royalty_fee,
        test_token_parameter._shill_times,
        test_token_parameter.ipfs_hash,
        testTokenAContract.address
        );
      const owner = accounts[0];
      const caller = accounts[1];
      const base_account_index = 2;
      const root_nft_id = publish_event.args.rootNFTId;
      const royalty_fee = await SparkLink.getRoyaltyFeeByNFTId(publish_event.args.rootNFTId);
      await testTokenAContract.connect(owner).transfer(accounts[2].address, test_token_parameter._first_sell_price);
      await testTokenAContract.connect(accounts[2]).approve(SparkLink.address, test_token_parameter._first_sell_price);
      let accept_shill_event = await helper.accept_shill(SparkLink, accounts[2], root_nft_id);
      let nft_id = accept_shill_event.args.tokenId;
      const price_base = BigNumber.from(100);
      const price_increase = BigNumber.from(11451);
      const loop_times = 15;
      await SparkLink.connect(caller).claimProfit(root_nft_id);
      for (let i = base_account_index; i < loop_times; i += 1) {
        let transfer_price = price_base.add(price_increase.mul(i));
        let exclude_DAO_transfer_price = transfer_price.sub(transfer_price.mul(spark_constant.DAO_fee).div(100));
        let transfer_royalty_price = exclude_DAO_transfer_price.mul(royalty_fee).div(100);
        let transfer_remain_price = exclude_DAO_transfer_price.sub(transfer_royalty_price);
        await SparkLink.connect(accounts[i]).determinePriceAndApprove(nft_id, transfer_price, accounts[i+1].address);
        await testTokenAContract.connect(owner).transfer(accounts[i+1].address, price_base.add(price_increase.mul(i)));
        await testTokenAContract.connect(accounts[i+1]).approve(SparkLink.address, price_base.add(price_increase.mul(i)));
        const before_owner_balance = await testTokenAContract.balanceOf(accounts[i].address);
        const before_father_balance = await testTokenAContract.balanceOf(owner.address);
        await SparkLink.connect(accounts[i+1])["safeTransferFrom(address,address,uint256)"](
          accounts[i].address,
          accounts[i+1].address,
          nft_id,
          { value: price_base.add(price_increase.mul(i))}
        );
        let transfer_event = (await SparkLink.queryFilter(SparkLink.filters.Transfer(
          accounts[i].address,
          accounts[i+1].address,
          nft_id
        )))[0];
        expect(transfer_event.args.from).to.eq(accounts[i].address);
        expect(transfer_event.args.to).to.eq(accounts[i+1].address);
        expect(transfer_event.args.tokenId).to.eq(nft_id);
        let transfer_claim_event = (await SparkLink.queryFilter(SparkLink.filters.Claim(
          nft_id,
          accounts[i].address,
          null
        )))[0]
        await SparkLink.connect(caller).claimProfit(root_nft_id);
        let claim_father_event = (await SparkLink.queryFilter(SparkLink.filters.Claim(
          root_nft_id,
          owner.address,
          null
        )))[i-base_account_index+1];
        transfer_royalty_price = transfer_royalty_price.sub(transfer_royalty_price.mul(spark_constant.DAO_fee).div(100));
        expect(claim_father_event.args.amount).to.eq(transfer_royalty_price);
        const after_father_balance = await testTokenAContract.balanceOf(owner.address);
        const after_owner_balance = await testTokenAContract.balanceOf(accounts[i].address);
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
        let error_info = "SparkLink: Approval to current owner";
        const publish_event = await helper.publish(SparkLink);
        let root_nft_id = publish_event.args.rootNFTId;
        await expect(SparkLink.connect(owner).approve(owner.address, root_nft_id)
          ).to.be.revertedWith(error_info);
      }
    });

    it('Should approve reject caller who is not owner', async () => {
      {
        let other = accounts[1];
        let caller = accounts[3];
        let error_info = "SparkLink: Approve caller is not owner nor approved for all";
        const publish_event = await helper.publish(SparkLink);
        let root_nft_id = publish_event.args.rootNFTId;
        await expect(SparkLink.connect(caller).approve(other.address, root_nft_id)
          ).to.be.revertedWith(error_info);
      }
    });

    it("should approve an NFT from owner", async () => {
      let publish_event = await helper.publish(SparkLink);
      let root_nft_id = publish_event.args.rootNFTId;
      let owner = accounts[0];
      let other = accounts[1];
      await SparkLink.connect(owner).approve(other.address, root_nft_id);
      const event = (await SparkLink.queryFilter(SparkLink.filters.Approval()))[0];
      expect(other.address).to.eq(event.args.approved);
    })
  });

  context('setApprovalForAll()', async () => {
    it('Should setApprovalForAll reject approve to caller', async () => {
      {
        await helper.publish(SparkLink);
        let owner = accounts[0];
        let error_info = "SparkLink: Approve to caller";
        await expect(SparkLink.connect(owner).setApprovalForAll(owner.address, true)).to.be.revertedWith(error_info);
      }
    });

    it("should approve all an NFT from owner", async () => {
      await helper.publish(SparkLink);
      let owner = accounts[0];
      let other = accounts[1];
      await SparkLink.connect(owner).setApprovalForAll(other.address, true);
      expect(true).to.eq(await SparkLink.isApprovedForAll(owner.address,other.address));
    })

    it("should chancel approve all an NFT from owner", async () => {
      await helper.publish(SparkLink);
      let owner = accounts[0];
      let other = accounts[1];
      await SparkLink.connect(owner).setApprovalForAll(other.address, true);
      expect(true).to.eq(await SparkLink.isApprovedForAll(owner.address,other.address));
      await SparkLink.connect(owner).setApprovalForAll(other.address, false);
      expect(false).to.eq(await SparkLink.isApprovedForAll(owner.address,other.address));
    })
  })

  context('setURI()', async () => {
    it("should setURI work", async () => {
      const publish_event = await helper.publish(SparkLink);
      const tokenId = publish_event.args.rootNFTId;
      const ipfs_hash = spark_constant.hash_2._hash;
      const URI = spark_constant.hash_2._URI;
      const SetURI_event = await helper.setURI(SparkLink, owner, tokenId, ipfs_hash);
      expect("0x"+ipfs_hash).to.eq(SetURI_event.args.new_URI);
      expect(await SparkLink.tokenURI(tokenId)).to.eq(URI);
    })
    it ("should setURI reverted with invalid Id", async () => {
      const invalid_parameter = spark_constant.overflow_NFT_id_value;
      await expect(SparkLink.connect(owner).setURI(invalid_parameter, Buffer.from(spark_constant.hash_2._hash, "hex"))).to.be.reverted;
    })
    it ("should setURI reverted with invalid Id", async () => {
      const invalid_parameter = spark_constant.nft_id_not_exist;
      await expect(SparkLink.connect(owner).setURI(invalid_parameter, Buffer.from(spark_constant.hash_2._hash, "hex"))).to.be.reverted;
    })
    it ("should setURI reverted with account not owner", async () => {
      const caller = accounts[1];
      const publish_event = await helper.publish(SparkLink);
      const tokenId = publish_event.args.rootNFTId;
      const error_info = "SparkLink: Only owner can set the token URI";
      await expect(SparkLink.connect(caller).setURI(tokenId, Buffer.from(spark_constant.hash_2._hash, "hex"))).to.be.revertedWith(error_info);
    })
    it ("should setURI reverted with ND attribute", async () => {
      const caller = accounts[1];
      const other = accounts[2];
      const valid_parameter = spark_constant.valid_publish_parameters_with_ND;
      const publish_event = await helper.publish(
        SparkLink,
        valid_parameter._first_sell_price, 
        valid_parameter._royalty_fee, 
        valid_parameter._shill_times, 
        valid_parameter.ipfs_hash,
        valid_parameter.token_addr,
        valid_parameter.is_free,
        valid_parameter.is_NC,
        valid_parameter.is_ND
      );
      const root_nft_id = publish_event.args.rootNFTId;
      await SparkLink.connect(other).acceptShill(root_nft_id, {value: 100});
      const transfer_event = (await SparkLink.queryFilter(SparkLink.filters.Transfer(ethers.constants.AddressZero, other.address, null)))[0];;
      const tokenId = transfer_event.args.tokenId;
      const error_info = "SparkLink: NFT follows the ND protocol, only the root NFT's URI can be set.";
      await expect(SparkLink.connect(other).setURI(tokenId, Buffer.from(spark_constant.hash_2._hash, "hex"))).to.be.revertedWith(error_info);
    })
  })

  context("label()", async () => {
    it("should label work and emit Label event", async () => {
      const publish_event = await helper.publish(SparkLink);
      const tokenId = publish_event.args.rootNFTId;
      const label = spark_constant.label1;
      await SparkLink.connect(owner).label(tokenId, label);
      const label_event = (await SparkLink.queryFilter(SparkLink.filters.Label(tokenId, null)))[0];
      expect(label_event.args.content).to.eq(label);
    })
    it("should label work and emit Label event with UTF8", async () => {
      const publish_event = await helper.publish(SparkLink);
      const tokenId = publish_event.args.rootNFTId;
      const label = spark_constant.label1;
      await SparkLink.connect(owner).label(tokenId, label);
      const label_event = (await SparkLink.queryFilter(SparkLink.filters.Label(tokenId, null)))[0];
      expect(label_event.args.content).to.eq(label);
    })
    it ("should label reverted with invalid Id", async () => {
      const invalid_parameter = spark_constant.overflow_NFT_id_value;
      const label = spark_constant.label1;
      await expect(SparkLink.connect(owner).label(invalid_parameter,label)).to.be.reverted;
    })
    it ("should label reverted with invalid Id", async () => {
      const invalid_parameter = spark_constant.nft_id_not_exist;
      const label = spark_constant.label1;
      await expect(SparkLink.connect(owner).label(invalid_parameter,label)).to.be.reverted;
    })
    it ("should setURI reverted with account not owner", async () => {
      const caller = accounts[1];
      const publish_event = await helper.publish(SparkLink);
      const tokenId = publish_event.args.rootNFTId;
      const label = spark_constant.label1;
      const error_info = "SparkLink: Only owner can label this NFT";
      await expect(SparkLink.connect(caller).label(tokenId, label)).to.be.revertedWith(error_info);
    })
  })

  context('getApproved()', async () => {
    it("should getApproved correct approve address", async () => {
      let publish_event = await helper.publish(SparkLink);
      let root_nft_id = publish_event.args.rootNFTId;
      let owner = accounts[0];
      let other = accounts[1];
      await SparkLink.connect(owner).approve(other.address, root_nft_id);
      expect(other.address).to.eq(await SparkLink.getApproved(root_nft_id));
    })

    it("should getApproved reject none exist token", async () => {
      let invalid_parameter = spark_constant.nft_id_not_exist;
      let error_info = "SparkLink: Approved query for nonexistent token";
      await expect(SparkLink.getApproved(invalid_parameter)).to.be.revertedWith(error_info);
    })

    it("should getApproved reject overflow tokenId", async () => {
      let invalid_parameter = spark_constant.overflow_NFT_id_value;
      let error_info = "SparkLink: Value doesn't fit in 64 bits";
      await expect(SparkLink.getApproved(invalid_parameter)).to.be.revertedWith(error_info);
    })
  })

  context('getFatherByNFTId()', async () => {
    it("should getFatherByNFTId reject none exist token", async () => {
      let invalid_parameter = spark_constant.nft_id_not_exist;
      let error_info = "SparkLink: Edition is not exist.";
      await expect(SparkLink.getFatherByNFTId(invalid_parameter)).to.be.revertedWith(error_info);
    })

    it("should getFatherByNFTId work", async () => {
      const other = accounts[1];
      const publish_event = await helper.publish(SparkLink);
      const root_nft_id = publish_event.args.rootNFTId;
      const accept_shill_event = await helper.accept_shill(SparkLink, other, root_nft_id);
      const father_id = await SparkLink.getFatherByNFTId(accept_shill_event.args.tokenId);
      expect(father_id).to.eq(root_nft_id);
    })
  })

  context('getTransferPriceByNFTId()', async () => {
    it("should getTransferPriceByNFTId reject none exist token", async () => {
      let invalid_parameter = spark_constant.nft_id_not_exist;
      let error_info = "SparkLink: Edition is not exist.";
      await expect(SparkLink.getTransferPriceByNFTId(invalid_parameter)).to.be.revertedWith(error_info);
    })
  })

  context('getShillPriceByNFTId()', async () => {
    it("should getShillPriceByNFTId reject none exist token", async () => {
      let invalid_parameter = spark_constant.nft_id_not_exist;
      let error_info = "SparkLink: Edition is not exist.";
      await expect(SparkLink.getShillPriceByNFTId(invalid_parameter)).to.be.revertedWith(error_info);
    })
  })

  context('getRemainShillTimesByNFTId()', async () => {
    it("should getRemainShillTimesByNFTId reject none exist token", async () => {
      let invalid_parameter = spark_constant.nft_id_not_exist;
      let error_info = "SparkLink: Edition is not exist.";
      await expect(SparkLink.getRemainShillTimesByNFTId(invalid_parameter)).to.be.revertedWith(error_info);
    })
  })

  context('getDepthByNFTId()', async () => {
    it("should getDepthByNFTId reject none exist token", async () => {
      let invalid_parameter = spark_constant.nft_id_not_exist;
      let error_info = "SparkLink: Edition is not exist.";
      await expect(SparkLink.getDepthByNFTId(invalid_parameter)).to.be.revertedWith(error_info);
    })
  })
});
