import { BigNumber } from "ethers";

const airpod_ctor_parameters = {
    _name: "SparkNFT",
    _symbol: "SparkNFT"
};

const default_hash_1 = {
    _hash: '4f0b018a3b003b7c99f97427f410cafe5707ba18d28b13cd8bfa59e08e110380',
    _URI: "https://ipfs.io/ipfs/QmTfCejgo2wTwqnDJs8Lu1pCNeCrCDuE4GAwkna93zdd7d"
};

const invalid_publish_royalty_fee = {
    _first_sell_price: BigNumber.from(1000),
    _royalty_fee: 111,
    _shill_times: 12,
    ipfs_hash: Buffer.from('4f0b018a3b003b7c99f97427f410cafe5707ba18d28b13cd8bfa59e08e110380', 'hex')
}
const invalid_publish_royalty_fee_overflow = {
    _first_sell_price: BigNumber.from(1000),
    _royalty_fee: 256,
    _shill_times: 12,
    ipfs_hash: Buffer.from('4f0b018a3b003b7c99f97427f410cafe5707ba18d28b13cd8bfa59e08e110380', 'hex')
}
const invalid_publish_shill_times_overflow = {
    _first_sell_price: BigNumber.from(1000),
    _royalty_fee: 11,
    _shill_times: 256,
    ipfs_hash: Buffer.from('4f0b018a3b003b7c99f97427f410cafe5707ba18d28b13cd8bfa59e08e110380', 'hex')
}
const invalid_publish_price_overflow = {
    _first_sell_price: BigNumber.from("0x1234567890123456789012345678901211234"),
    _royalty_fee: 11,
    _shill_times: 11,
    ipfs_hash: Buffer.from('4f0b018a3b003b7c99f97427f410cafe5707ba18d28b13cd8bfa59e08e110380', 'hex')
}
const invalid_publish_ipfs_hash_overflow = {
    _first_sell_price: BigNumber.from(1000),
    _royalty_fee: 11,
    _shill_times: 11,
    ipfs_hash: Buffer.from('4f0b018a3b003b7c99f97427f410cafe5707ba18d28b13cd8bfa59e08e11038011', 'hex')
}
const publish_one_hundred_royalty_fee = {
    _first_sell_price: BigNumber.from(1000),
    _royalty_fee: 100,
    _shill_times: 12,
    ipfs_hash: Buffer.from('4f0b018a3b003b7c99f97427f410cafe5707ba18d28b13cd8bfa59e08e110380', 'hex')
}
const publish_zero_royalty_fee = {
    _first_sell_price: BigNumber.from(1000),
    _royalty_fee: 0,
    _shill_times: 12,
    ipfs_hash: Buffer.from('4f0b018a3b003b7c99f97427f410cafe5707ba18d28b13cd8bfa59e08e110380', 'hex')
}
const publish_zero_first_sell_price = {
    _first_sell_price: BigNumber.from(0),
    _royalty_fee: 12,
    _shill_times: 12,
    ipfs_hash: Buffer.from('4f0b018a3b003b7c99f97427f410cafe5707ba18d28b13cd8bfa59e08e110380', 'hex')
}
const publish_zero_shill_times = {
    _first_sell_price: BigNumber.from(1121),
    _royalty_fee: 12,
    _shill_times: 0,
    ipfs_hash: Buffer.from('4f0b018a3b003b7c99f97427f410cafe5707ba18d28b13cd8bfa59e08e110380', 'hex')
}
const publish_one_shill_times = {
    _first_sell_price: BigNumber.from(1121),
    _royalty_fee: 12,
    _shill_times: 0,
    ipfs_hash: Buffer.from('4f0b018a3b003b7c99f97427f410cafe5707ba18d28b13cd8bfa59e08e110380', 'hex')
}
const nft_id_not_exist = BigNumber.from(114514);
const edition_id_not_exist = BigNumber.from(114514);
const issue_id_not_exist = BigNumber.from(114514);
const overflow_price_value = BigNumber.from("0x1234567890123456789012345678901211234");
const overflow_NFT_id_value = BigNumber.from("0x1234567890123456789012");
const loss_ratio = 90;
export default {
    airpod_ctor_parameters,
    default_hash_1,
    loss_ratio,
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
    publish_zero_first_sell_price,
    publish_zero_shill_times,
    publish_one_shill_times
};