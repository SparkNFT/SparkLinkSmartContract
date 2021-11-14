import { ethers } from "hardhat";
import { BigNumber } from "@ethersproject/bignumber";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { SparkLink } from "../artifacts/typechain/SparkLink";
// import {}
import spark_constant from "./spark_constant";
import { Address } from "cluster";
export default {
  /*
   * Returns Publish() event
   */
  async publish(
    contract: SparkLink,
    first_sell_price = BigNumber.from(100),
    royalty_fee = 30,
    shill_times = 10,
    ipfs_hash = Buffer.from(spark_constant.default_hash_1._hash, 'hex'),
    token_addr = ethers.constants.AddressZero,
    is_free = false,
    is_NC = false,
    is_ND = false
  ) {
    await contract.publish(
      first_sell_price,
      royalty_fee,
      shill_times,
      ipfs_hash,
      token_addr,
      is_free,
      is_NC,
      is_ND
    );
    const publish_event = (await contract.queryFilter(contract.filters.Publish()))[0];
    return publish_event;
  },


  // async publish_burn(
  //   contract: SparkLink,
  //   first_sell_price = BigNumber.from(100),
  //   royalty_fee =30,
  //   shill_times = 10,
  //   ipfs_hash = Buffer.from(spark_constant.default_hash_1._hash, 'hex'),
  //   token_addr = ethers.constants.AddressZero
  // ) {
  //   await contract.publish(
  //     first_sell_price,
  //     royalty_fee,
  //     shill_times,
  //     ipfs_hash,
  //     token_addr
  //   );
  //   const publish_event = (await contract.queryFilter(contract.filters.Publish()))[0];
  //   return publish_event;
  // },
  /*
   * Returns Mint() event.
   * will call publish() if nft_id is not given.
   */
  async accept_shill(contract: SparkLink, caller_account: SignerWithAddress, nft_id?: BigNumber, value?: BigNumber) {
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

  async claim_profit(contract: SparkLink, caller_account: SignerWithAddress, NFT_id: BigNumber) {
    await contract.connect(caller_account).claimProfit(NFT_id);
    const claim_event = (await contract.queryFilter(contract.filters.Claim(NFT_id, await contract.ownerOf(NFT_id))))[0];
    return claim_event;
  },

  async setURI(contract: SparkLink, caller_acount: SignerWithAddress, NFT_id:BigNumber, ipfs_hash: String) {
    await contract.connect(caller_acount).setURI(NFT_id, Buffer.from(ipfs_hash, 'hex'));
    const SetURI_event = (await contract.queryFilter(contract.filters.SetURI(NFT_id, null, null)))[0];
    return SetURI_event;
  },

  // async addLiquidity(token_addr: Address, caller_account: SignerWithAddress, ) {

  // }
}
