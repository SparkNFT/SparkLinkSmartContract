// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
contract royaltyNFT is ERC721URIStorage , Ownable{
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;
    Counters.Counter private _issueIds;
    struct Issue {
        // The publisher publishes a series of NFTs with the same content and different NFT_id each time.
        // This structure is used to store the public attributes of same series of NFTs.
        uint192 issue_id;
        // Used to identify which series it is.
        address publisher;
        // Publisher of this series NFTs
        uint64 total_edition_amount;
        // Number of NFTs included in this series
        uint64 remain_edition_amount;
        // Number of NFTs have not been minted in this series
        uint8 royalty_fee;
        // royalty_fee for every transfer expect from or to exclude address, max is 100;
        string ipfs_hash;
        // Metadata json file.
        string name;
        // issue's name
        mapping (address => uint256) baseline;
        // List of tokens(address) can be accepted for payment.
        // And specify the min fee should be toke when series of NFTs are sold.
        // If baseline[tokens] == 0, then this token will not be accepted.
        // `A token address` can be ERC-20 token contract address or `address(0)`(ETH).
        mapping (address => uint256) first_sell_price;
        // The price should be payed when this series NTFs are minted.
    }

    struct Edition {
        // Information used to decribe an NFT.
        uint256 NFT_id;
        // Index of this NFT.
        uint256 price;
        // The price of the NFT in the transaction is determined before the transaction.
        address token_addr;
        // The tokens used in this transcation, determined together with the price.
        bool is_on_sale;
    }
    mapping (uint256 => Issue) private issues_by_id;
    mapping (uint256 => Edition) private editions_by_id;
    // Address which will not be taken fee in secondary transcation.
    event determinePriceSuccess(
        uint256 NFT_id,
        address token_addr,
        uint256 price
    );
    // ? 在一个event中塞进去多个数组会不会影响gas开销
    event publishSuccess(
        string name,
        uint192 issue_id,
        address publisher,
        uint256 total_edition_amount,
        uint8 royalty_fee,
	    address[] supported_token_addrs,
	    uint256[] baseline,
	    uint256[] first_sell_price
    );

    event transferSuccess(
        uint256 NFT_id;
        address from,
        address to,
        uint256 price
    );

    //----------------------------------------------------------------------------------------------------
    constructor(string memory _name, string memory _symbol) ERC721(_name, _symbol) {

        // 避免出现第一个检测不存在的情况，Issue从1开始标号
        _issueIds.increment();
    }


    /**
     * @dev Determine NFT price before transfer.
     *
     * Requirements:
     * 
     * - `_NFT_id` transferred token id.
     * - `_token_addr` address of the token this transcation used, address(0) represent ETH.
     * - `_price` The amount of `_token_addr` should be payed for `_NFT_id`
     *
     * Emits a {determinePriceSuccess} event, which contains:
     * - `_NFT_id` transferred token id.
     * - `_token_addr` address of the token this transcation used, address(0) represent ETH.
     * - `_price` The amount of `_token_addr` should be payed for `_NFT_id`
     */
     // ？ 这个地方有个问题，按照这篇文章https://gus-tavo-guim.medium.com/public-vs-external-functions-in-solidity-b46bcf0ba3ac
     // 在external函数之中使用calldata进行传参数的gas消耗应该会更少一点
     // 但是大部分地方能看到的都是memory
    function publish(
        address[] memory _token_addrs, 
        uint256[] memory _base_prices,
        uint256[] memory _first_sell_price,
        uint8 _royalty_fee，
        uint64 _total_edition_amount,
        string _name,
        string _ipfs_hash
    ) external {
        _issueIds.increment();
        uint192 max_192 = type(uint192).max;
        require((_issueIds.current()) <= max_192, "royaltyNFT: value doesn't fit in 192 bits");
        uint192 new_issue_id = uint64(_issueIds.current());
        Issue storage new_issue = issues_by_id[new_issue_id];
        new_issue.name = _name;
        new_issue.issue_id = new_issue_id;
        new_issue.royalty_fee = _royalty_fee;
        new_issue.total_edition_amount = _total_edition_amount;
        new_issue.remain_edition_amount = _total_edition_amount;
        // ?此处的ipfshash是代表着pdf还是metadata
        new_issue.ipfs_hash = _ipfs_hash;
        for (int _token_addr_id = 0; _token_addr_id < _token_addrs.length; _token_addr_id++){
            new_issue.baseline[_token_addr[_token_addr_id]] = _base_prices[_token_addr_id];
            new_issue.first_sell_price[_token_addr[_token_addr_id]] = _first_sell_price[_token_addr_id];
        }
    }
    function mintNFT(
        uint192 _issue_id, 
        address _token_addr
    ) public payable returns (uint128) {
        require(issues_by_id[_issue_id].remain_edition_amount) > 0, "royaltyNFT: There is no NFT remain in this issue.");
        uint128 new_edition_id = uint128(issues_by_id[_issue_id].total_edition_amount - issues_by_id[_issue_id].remain_edition_amount);
        uint128 new_NFT_id = (_issue_id << 64) | new_edition_id;
        storage new_NFT = edition_by_id[new_edition_id];
        new_NFT.NFT_id = new_NFT_id;
        new_NFT.price = 0;
        new_NFT.token_addr = 0;
        new_NFT.is_on_sale = false;
        issues_by_id[_issue_id].remain_edition_amount -= 1;
        _safeMint(msg.sender, new_NFT_id);
        return new_NFT_id;
    }

    /**
     * @dev Determine NFT price before transfer.
     *
     * Requirements:
     * 
     * - `_NFT_id` transferred token id.
     * - `_token_addr` address of the token this transcation used, address(0) represent ETH.
     * - `_price` The amount of `_token_addr` should be payed for `_NFT_id`
     *
     * Emits a {determinePriceSuccess} event, which contains:
     * - `_NFT_id` transferred token id.
     * - `_token_addr` address of the token this transcation used, address(0) represent ETH.
     * - `_price` The amount of `_token_addr` should be payed for `_NFT_id`
     */
    function determine_price(
        uint256 _NFT_id, 
        address _token_addr,
        uint256 _price
    ) public {
        require(msg.sender == ownerOf(_NFT_id), "royaltyNFT: NFT's price should set by onwer of it.");
        editions_by_id[_NFT_id].price = _price;
        editions_by_id[_NFT_id].token_addr = _token_addr;
        emit determinePriceSuccess(_NFT_id, _token_addr, _price);
    }
    function _beforeTokenTransfer (
        address from,
        address to,
        uint256 NFT_id
    ) internal override {
        
        if (!_is_exclude_from_fee[from] && !_is_exclude_from_fee[to]) {
            require(editions_by_id[NFT_id].price != 0, "royaltyNFT: price should be set");
            // 抽手续费
        } 
    }
    function _afterTokenTransfer (
        uint256 _NFT_id
    ) internal {
        editions_by_id[_NFT_id].price = 0;
    }

    function transferFrom(
        address from, 
        address to, 
        uint256 NFT_id
    ) public payable override {

        super.transferFrom(from, to, NFT_id);
        _afterTokenTransfer(NFT_id);

    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 NFT_id;
        bytes memory _data
    ) public payable override {
        
        super.safeTransferFrom(from, to, NFT_id, _data);
        _afterTokenTransfer(NFT_id);
    }
    function isIssueExist(uint192 _issue_id) public view return (bool) {
        if (issues_by_id[_issue_id].issue_id == 0)
            return false;
        return true;
    }
    function isEditionExist(uint256 _NFT_id) public view return (bool) {
        if (edition_by_id[_NFT_id].NFT_id == 0)
            return false;
        return true;
    }

    function getIssueIdByNFTId(uint256 _NFT_id) public view return(uint192) {
        return uint192(_NFT_id >> 64);
    }

    function getNFTIdByIssueId(uint192 _issue_id) public view return(uint256 [] memory) {
        uint256 [] memory NFT_ids = new uint256 [](issues_by_id[_issue_id].total_edition_amount);
        for (int edition_id = 0; edition_id < issues_by_id[_issue_id].total_edition_amount; edition_id++){
            NFT_ids[edition_id] = uint256(_issue_id << 64 | edition_id);
        }
        return NFT_ids;
    }

    function calculateRoyaltyFee(uint256 _amount, uint8 _royalty_fee) private view returns (uint256) {
        return _amount.mul(_royalty_fee).div(
            10**2
        );
    }
    function excludeFromRoyaltyFee(address account) public onlyOwner {
        _is_exclude_from_fee[account] = true;
    }
    
    function includeInRoyaltyFee(address account) public onlyOwner {
        _is_exclude_from_fee[account] = false;
    }
    
    function setRoyaltyPercent(uint64 _issue_id, uint8 _royalty_fee) external onlyOwner {
        require(_royalty_fee <= 100, "royaltyNFT: royalty fee can not exceed 100.");
        issues_by_id[_issue_id].royalty_fee = _royalty_fee;
    }
}