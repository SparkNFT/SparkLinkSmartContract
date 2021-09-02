import { ethers } from "hardhat";
import { BigNumber } from "@ethersproject/bignumber";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { SparkNFT } from "../artifacts/typechain/SparkNFT";

export default {
  /*
   * Returns Publish() event
   */
  async publish(
    contract: SparkNFT,
    first_sell_price = BigNumber.from(100),
    royalty_fee = BigNumber.from(30),
    shill_times = BigNumber.from(10),
    ipfs_hash = Buffer.from('4f0b018a3b003b7c99f97427f410cafe5707ba18d28b13cd8bfa59e08e110380', 'hex'),
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
   * will call publish() if root_nft_id is not given.
   */
  async accept_shill(contract: SparkNFT, caller_account: SignerWithAddress, root_nft_id?: BigNumber) {
    if (!root_nft_id) {
      root_nft_id = (await this.publish(contract)).args.rootNFTId;
    }

    await contract.connect(caller_account).acceptShill(root_nft_id, { value: BigNumber.from(100) })
    const transfer_event = (await contract.queryFilter(contract.filters.Transfer(ethers.constants.AddressZero, caller_account.address, null)))[0];
    return transfer_event;
  },

  async claim_profit(contract: SparkNFT, owner_account: SignerWithAddress, NFT_id: BigNumber) {
    await contract.connect(owner_account).claimProfit(NFT_id);
    const claim_event = (await contract.queryFilter(contract.filters.Claim(NFT_id, owner_account.address, null)))[0];
    return claim_event;
  }

}
