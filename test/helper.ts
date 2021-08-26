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
    issue_name = "TestIssue",
    ipfs_hash = "IPFSHASH",
  ) {
    await contract.publish(
      first_sell_price,
      royalty_fee,
      shill_times,
      issue_name,
      ipfs_hash,
    );
    const publish_event = (await contract.queryFilter(contract.filters.Publish()))[0];
    return publish_event;
  },

  /*
   * Returns Mint() event.
   * will call publish() if root_nft_id is not given.
   */
  async accept_shill(contract: SparkNFT, other_account: SignerWithAddress, root_nft_id?: BigNumber) {
    if (!root_nft_id) {
      root_nft_id = (await this.publish(contract)).args.rootNFTId;
    }

    await contract.connect(other_account).accepetShill(root_nft_id, { value: BigNumber.from(100) })
    const mint_event = (await contract.queryFilter(contract.filters.Mint(null, null, other_account.address)))[0];
    return mint_event;
  }
}
