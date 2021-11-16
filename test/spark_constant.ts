import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { utils } from "ethers";
const airpod_ctor_parameters = {
    _name: "SparkLink",
    _symbol: "SPL"
};

const testTokenMintAmount = utils.parseUnits('1000000000', 18).toString();
const default_hash_1 = {
    _hash: '4f0b018a3b003b7c99f97427f410cafe5707ba18d28b13cd8bfa59e08e110380',
    _URI: "https://ipfs.io/ipfs/QmTfCejgo2wTwqnDJs8Lu1pCNeCrCDuE4GAwkna93zdd7d"
};

const hash_2 = {
    _hash: '5084d4dfd5da02f60cc01eab0b41cd28af321597c469881d612df4adaa2b3815',
    _URI: "https://ipfs.io/ipfs/QmTkxoV1ZciKyFciWDueJDXv8bWRfD5R1YmmeMF6QojL6x"
};

const hash_3 = {
    _hash: '55b38a82d49f814f34409e141d237aef5aee996364cbba94bae0f1abdad85173',
    _URI: "https://ipfs.io/ipfs/QmU7C9hnDYnThfpCvX28bdzZpX8Dtyt8m7J6cUNfmBoN6E"
};

const valid_publish_parameters = { 
    _first_sell_price: BigNumber.from(10000000000),
    _royalty_fee: 30,
    _shill_times: 10,
    ipfs_hash: Buffer.from('4f0b018a3b003b7c99f97427f410cafe5707ba18d28b13cd8bfa59e08e110380', 'hex'),
    token_addr: ethers.constants.AddressZero,
    is_free: false,
    is_NC: false,
    is_ND:false
}
const valid_publish_parameters_with_ND = { 
    _first_sell_price: BigNumber.from(100),
    _royalty_fee: 30,
    _shill_times: 10,
    ipfs_hash: Buffer.from('4f0b018a3b003b7c99f97427f410cafe5707ba18d28b13cd8bfa59e08e110380', 'hex'),
    token_addr: ethers.constants.AddressZero,
    is_free: false,
    is_NC: false,
    is_ND: true
}
const invalid_publish_royalty_fee = {
    _first_sell_price: BigNumber.from(1000),
    _royalty_fee: 111,
    _shill_times: 12,
    ipfs_hash: Buffer.from('4f0b018a3b003b7c99f97427f410cafe5707ba18d28b13cd8bfa59e08e110380', 'hex'),
    token_addr: ethers.constants.AddressZero,
    is_free: false,
    is_NC: false,
    is_ND:false
}
const invalid_publish_royalty_fee_overflow = {
    _first_sell_price: BigNumber.from(1000),
    _royalty_fee: 256,
    _shill_times: 12,
    ipfs_hash: Buffer.from('4f0b018a3b003b7c99f97427f410cafe5707ba18d28b13cd8bfa59e08e110380', 'hex'),
    token_addr: ethers.constants.AddressZero,
    is_free: false,
    is_NC: false,
    is_ND:false
}
const invalid_publish_shill_times_overflow = {
    _first_sell_price: BigNumber.from(1000),
    _royalty_fee: 11,
    _shill_times: 65536,
    ipfs_hash: Buffer.from('4f0b018a3b003b7c99f97427f410cafe5707ba18d28b13cd8bfa59e08e110380', 'hex'),
    token_addr: ethers.constants.AddressZero,
    is_free: false,
    is_NC: false,
    is_ND:false
}
const invalid_publish_price_overflow = {
    _first_sell_price: BigNumber.from("0x1234567890123456789012345678901211234"),
    _royalty_fee: 11,
    _shill_times: 11,
    ipfs_hash: Buffer.from('4f0b018a3b003b7c99f97427f410cafe5707ba18d28b13cd8bfa59e08e110380', 'hex'),
    token_addr: ethers.constants.AddressZero,
    is_free: false,
    is_NC: false,
    is_ND:false
}
const invalid_publish_ipfs_hash_overflow = {
    _first_sell_price: BigNumber.from(1000),
    _royalty_fee: 11,
    _shill_times: 11,
    ipfs_hash: Buffer.from('4f0b018a3b003b7c99f97427f410cafe5707ba18d28b13cd8bfa59e08e11038011', 'hex'),
    token_addr: ethers.constants.AddressZero,
    is_free: false,
    is_NC: false,
    is_ND:false
}
const publish_one_hundred_royalty_fee = {
    _first_sell_price: BigNumber.from(100000000),
    _royalty_fee: 100,
    _shill_times: 12,
    ipfs_hash: Buffer.from('4f0b018a3b003b7c99f97427f410cafe5707ba18d28b13cd8bfa59e08e110380', 'hex'),
    token_addr: ethers.constants.AddressZero,
    is_free: false,
    is_NC: false,
    is_ND:false
}
const publish_zero_royalty_fee = {
    _first_sell_price: BigNumber.from(1000),
    _royalty_fee: 0,
    _shill_times: 12,
    ipfs_hash: Buffer.from('4f0b018a3b003b7c99f97427f410cafe5707ba18d28b13cd8bfa59e08e110380', 'hex'),
    token_addr: ethers.constants.AddressZero,
    is_free: false,
    is_NC: false,
    is_ND:false
}
const publish_zero_first_sell_price = {
    _first_sell_price: BigNumber.from(0),
    _royalty_fee: 12,
    _shill_times: 12,
    ipfs_hash: Buffer.from('4f0b018a3b003b7c99f97427f410cafe5707ba18d28b13cd8bfa59e08e110380', 'hex'),
    token_addr: ethers.constants.AddressZero,
    is_free: false,
    is_NC: false,
    is_ND:false
}
const publish_zero_shill_times = {
    _first_sell_price: BigNumber.from(1121),
    _royalty_fee: 12,
    _shill_times: 0,
    ipfs_hash: Buffer.from('4f0b018a3b003b7c99f97427f410cafe5707ba18d28b13cd8bfa59e08e110380', 'hex'),
    token_addr: ethers.constants.AddressZero,
    is_free: false,
    is_NC: false,
    is_ND:false
}
const publish_one_shill_times = {
    _first_sell_price: BigNumber.from(1121),
    _royalty_fee: 12,
    _shill_times: 1,
    ipfs_hash: Buffer.from('4f0b018a3b003b7c99f97427f410cafe5707ba18d28b13cd8bfa59e08e110380', 'hex'),
    token_addr: ethers.constants.AddressZero,
    is_free: false,
    is_NC: false,
    is_ND:false
}
const nft_id_not_exist = BigNumber.from(114514);
const edition_id_not_exist = BigNumber.from(114514);
const issue_id_not_exist = BigNumber.from(114514);
const overflow_price_value = BigNumber.from("0x1234567890123456789012345678901211234");
const overflow_NFT_id_value = BigNumber.from("0x1234567890123456789012");
const overflow_ipfs_hash_value = Buffer.from('4f0b018a3b003b7c99f97427f410cafe5707ba18d28b13cd8bfa59e08e11038011', 'hex');
const label1 = "huluwahuluwa yiketengshangqigegua"
const label2 = "葫芦娃葫芦娃，一颗藤上七个瓜"
const label3 = "伞兵UP"
const loss_ratio = 62;
const DAO_fee = 2;
export default {
    airpod_ctor_parameters,
    default_hash_1,
    loss_ratio,
    DAO_fee,
    publish_one_hundred_royalty_fee,
    publish_zero_royalty_fee,
    invalid_publish_royalty_fee,
    invalid_publish_royalty_fee_overflow,
    invalid_publish_shill_times_overflow,
    invalid_publish_ipfs_hash_overflow,
    invalid_publish_price_overflow,
    nft_id_not_exist,
    edition_id_not_exist,
    issue_id_not_exist,
    overflow_price_value,
    overflow_NFT_id_value,
    overflow_ipfs_hash_value,
    publish_zero_first_sell_price,
    publish_zero_shill_times,
    publish_one_shill_times,
    hash_2,
    hash_3,
    label1,
    label2,
    label3,
    testTokenMintAmount,
    valid_publish_parameters,
    valid_publish_parameters_with_ND
};