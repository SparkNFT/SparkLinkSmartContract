// SPDX-License-Identifier: MIT

pragma solidity >= 0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "./IERC721.sol";
contract royaltyNFT is Context, ERC165, IERC721, IERC721Metadata{
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;
    Counters.Counter private _issueIds;
    struct Issue {
        // The publisher publishes a series of NFTs with the same content and different NFT_id each time.
        // This structure is used to store the public attributes of same series of NFTs.
        uint192 issue_id;
        // Used to identify which series it is.
        address payable publisher;
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
        mapping (address => uint256) base_royaltyfee;
        // List of tokens(address) can be accepted for payment.
        // And specify the min fee should be toke when series of NFTs are sold.
        // If base_royaltyfee[tokens] == 0, then this token will not be accepted.
        // `A token address` can be ERC-20 token contract address or `address(0)`(ETH).
        mapping (address => uint256) first_sell_price;
        // The price should be payed when this series NTFs are minted.
        // 这两个mapping如果存在token_addr看价格是不可以等于0的，如果等于0的话会导致判不支持
        // 由于这个价格是写死的，可能会诱导用户的付款倾向
    }

    struct Edition {
        // Information used to decribe an NFT.
        uint256 NFT_id;
        // Index of this NFT.
        uint256 transfer_price;
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
        uint256 transfer_price
    );
    // ? 在一个event中塞进去多个数组会不会影响gas开销
    event publishSuccess(
        string name,
        uint192 issue_id,
        address payable publisher,
        uint256 total_edition_amount,
        uint8 royalty_fee,
	    address[] token_addrs,
	    uint256[] base_royaltyfee,
	    uint256[] first_sell_price
    );

    event buySuccess (
        address publisher,
        uint256 NFT_id,
        uint256 transfer_price,
        address transfer_token_addr,
        address buyer
    );
    event transferSuccess(
        uint256 NFT_id,
        address from,
        address to,
        uint256 transfer_price,
        address transfer_token_addr
    );

    //----------------------------------------------------------------------------------------------------
    constructor(string memory _name, string memory _symbol) ERC721(_name, _symbol) {

        // 避免出现第一个检测不存在的情况，Issue从1开始标号
        _issueIds.increment();
    }

    function _baseURI() internal view override returns (string memory) {
        return "ipfs.io/ipfs/";
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
        uint256[] memory _base_royaltyfee,
        uint256[] memory _first_sell_price,
        uint8 _royalty_fee,
        uint64 _total_edition_amount,
        string memory _name,
        string memory _ipfs_hash
    ) external {
        _issueIds.increment();
        uint192 max_192 = type(uint192).max;
        require((_issueIds.current()) <= max_192, "royaltyNFT: value doesn't fit in 192 bits");
        uint192 new_issue_id = uint64(_issueIds.current());
        Issue storage new_issue = issues_by_id[new_issue_id];
        new_issue.name = _name;
        new_issue.issue_id = new_issue_id;
        new_issue.publisher = payable(msg.sender);
        new_issue.royalty_fee = _royalty_fee;
        new_issue.total_edition_amount = _total_edition_amount;
        new_issue.remain_edition_amount = _total_edition_amount;
        // ?此处的ipfshash是代表着pdf还是metadata
        new_issue.ipfs_hash = _ipfs_hash;
        for (uint8 _token_addr_id = 0; _token_addr_id < _token_addrs.length; _token_addr_id++){
            new_issue.base_royaltyfee[_token_addrs[_token_addr_id]] = _base_royaltyfee[_token_addr_id];
            new_issue.first_sell_price[_token_addrs[_token_addr_id]] = _first_sell_price[_token_addr_id];
        }
        emit publishSuccess();
    }

    function buy(
        uint192 _issue_id, 
        address _token_addr
    ) public payable {
        require(isIssueExist(_issue_id), "royaltyNFT: This issue is not exist.");
        require(issues_by_id[_issue_id].first_sell_price[_token_addr] != 0, "royaltyNFT: The token your selected is not supported.");
        if (_token_addr == address(0)) {
            require(msg.value == issues_by_id[_issue_id].first_sell_price[_token_addr], "royaltyNFT: not enought ETH");
            issues_by_id[_issue_id].publisher.transfer(issues_by_id[_issue_id].first_sell_price[_token_addr]);
        }
        else {
            IERC20(_token_addr).safeTransferFrom(msg.sender, address(this), issues_by_id[_issue_id].first_sell_price[_token_addr]);
        }
        _mintNFT(_issue_id);

    }



    function _mintNFT(
        uint192 _issue_id
    ) internal returns (uint256) {
        require((issues_by_id[_issue_id].remain_edition_amount > 0), "royaltyNFT: There is no NFT remain in this issue.");
        uint128 new_editions_id = uint128(issues_by_id[_issue_id].total_edition_amount - issues_by_id[_issue_id].remain_edition_amount);
        uint256 new_NFT_id = (_issue_id << 64) | new_editions_id;
        Edition storage new_NFT = editions_by_id[new_editions_id];
        new_NFT.NFT_id = new_NFT_id;
        new_NFT.transfer_price = 0;
        new_NFT.token_addr = address(0);
        new_NFT.is_on_sale = false;
        issues_by_id[_issue_id].remain_edition_amount -= 1;
        _setTokenURI(new_NFT_id, issues_by_id[_issue_id].ipfs_hash);
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
    function determinePrice(
        uint256 _NFT_id, 
        address _token_addr,
        uint256 _price
    ) public {
        require(msg.sender == ownerOf(_NFT_id), "royaltyNFT: NFT's price should set by onwer of it.");
        editions_by_id[_NFT_id].price = _price;
        editions_by_id[_NFT_id].token_addr = _token_addr;
        emit determinePriceSuccess(_NFT_id, _token_addr, _price);
    }

    function determinePriceAndApprove() public {
        
    }
    

    function _beforeTokenTransfer (
        address from,
        address to,
        uint256 NFT_id
    ) internal override {
        
        if (to != issues_by_id[getIssueIdByNFTId(NFT_id)].publisher && from != issues_by_id[getIssueIdByNFTId(NFT_id)]) {
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
        uint256 NFT_id,
        bytes memory _data
    ) public payable override {
        
        super.safeTransferFrom(from, to, NFT_id, _data);
        _afterTokenTransfer(NFT_id);
    }
    function isIssueExist(uint192 _issue_id) public view returns (bool) {
        if (issues_by_id[_issue_id].issue_id == 0)
            return false;
        return true;
    }
    function isEditionExist(uint256 _NFT_id) public view returns (bool) {
        if (editions_by_id[_NFT_id].NFT_id == 0)
            return false;
        return true;
    }

    function getIssueIdByNFTId(uint256 _NFT_id) public view returns (uint192) {
        return uint192(_NFT_id >> 64);
    }

    function getNFTIdByIssueId(uint192 _issue_id) public view returns (uint256 [] memory) {
        uint256 [] memory NFT_ids = new uint256 [](issues_by_id[_issue_id].total_edition_amount);
        for (int editions_id = 0; editions_id < issues_by_id[_issue_id].total_edition_amount; editions_id++){
            NFT_ids[editions_id] = uint256(_issue_id << 64 | editions_id);
        }
        return NFT_ids;
    }

    function calculateRoyaltyFee(uint256 _amount, uint8 _royalty_fee) private view returns (uint256) {
        return _amount.mul(_royalty_fee).div(
            10**2
        );
    }
    
    function setRoyaltyPercent(uint64 _issue_id, uint8 _royalty_fee) external onlyOwner {
        require(_royalty_fee <= 100, "royaltyNFT: royalty fee can not exceed 100.");
        issues_by_id[_issue_id].royalty_fee = _royalty_fee;
    }
}