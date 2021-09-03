import { ethers } from "hardhat";
import { BigNumber } from "@ethersproject/bignumber";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { SparkNFT } from "../artifacts/typechain/SparkNFT";
import spark_constant from "./spark_constant";
export default {
  /*
   * Returns Publish() event
   */
  async publish(
    contract: SparkNFT,
    first_sell_price = BigNumber.from(100),
    royalty_fee = BigNumber.from(30),
    shill_times = BigNumber.from(10),
    ipfs_hash = Buffer.from(spark_constant.default_hash_1._hash, 'hex'),
  ) {
    await contract.publish(
      first_sell_price,
      royalty_fee,
      shill_times,
      ipfs_hash,
    );
    const publish_event = (await contract.queryFilter(contract.filters.Publish()))[0];
    return publish_event;
  },

  /*
   * Returns Mint() event.
   * will call publish() if nft_id is not given.
   */
  async accept_shill(contract: SparkNFT, caller_account: SignerWithAddress, nft_id?: BigNumber, value?: BigNumber) {
    if (!nft_id) {
      nft_id = (await this.publish(contract)).args.rootNFTId;
    }
    if (!value) {
      value = BigNumber.from(100);
    }
    await contract.connect(caller_account).acceptShill(nft_id, { value:  value})
    const transfer_event = (await contract.queryFilter(contract.filters.Transfer(ethers.constants.AddressZero, caller_account.address, null)))[0];
    return transfer_event;
  },

  async claim_profit(contract: SparkNFT, caller_account: SignerWithAddress, NFT_id: BigNumber) {
    await contract.connect(caller_account).claimProfit(NFT_id);
    const claim_event = (await contract.queryFilter(contract.filters.Claim(NFT_id, await contract.ownerOf(NFT_id), null)))[0];
    return claim_event;
  }

}
