// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
contract Heterotopia is ERC721URIStorage , Ownable{
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;
    Counters.Counter private _issueIds;
    struct Issue {
        // The publisher publishes a series of NFTs with the same content and different NFT_id each time.
        // This structure is used to store the public attributes of same series of NFTs.
        uint256 issue_id;
        // Used to identify which series it is.
        address publisher;
        // Publisher of this series NFTs
        uint256 total_edition_amount;
        // Number of NFTs included in this series
        uint256 royalty_fee;
        // royalty_fee for every transfer expect from or to exclude address, max is 100;
        mapping (address => uint256) baseline;
        // List of tokens(address) can be accepted for payment.
        // And specify the series of NFTs should be sold at an amount not less than the amount of the baseline.
        // If baseline[tokens] == 0, then this token will not be accepted.
        // `A token address` can be ERC-20 token contract address or `address(0)`(ETH).
        mapping (address => bool) special_edition;
        // Each series of NFT contains several special NFTs and only accepts a specified token for payment
        address special_payment_addr;
        // The token(address) can be accepted for special edition.
    }

    struct Edition {
        // Information used to decribe an NFT.
        uint256 tokenId;
        // Index of this NFT.
        uint256 transfer_price;
        // The price of the NFT in the transaction is determined before the transaction, and the initial value 0 is restored after the transaction.
        address token_address;
        // The tokens used in this transcation, determined together with the price.
        uint256 issue_id;
        // Indicate which series this NFT belongs to.
    }
    mapping (uint256 => Issue) private issues_by_id;
    mapping (uint256 => Edition) private editions_by_id;
    // Address which will not be taken fee in secondary transcation.
    mapping (address => bool) private _is_exclude_from_fee;
    event determinePriceSuccess(
        uint256 tokenId,
        address token_address,
        uint256 transfer_price
    );

    event publishSuccess(
        uint256 issue_id,
        address publisher,
        uint256 total_edition_amount,
        uint256 _special_edition_amount, 
        address _special_payment_addr, 
        address[] token_addrs
    );

    event transferSuccess(
        uint256 tokenId,
        address from,
        address to,
        uint256 transfer_price
    );

    constructor(string memory _name, string memory _symbol) ERC721(_name, _symbol) {


    }


    /**
     * @dev Determine NFT price before transfer.
     *
     * Requirements:
     * 
     * - `_tokenId` transferred token id.
     * - `_token_address` address of the token this transcation used, address(0) represent ETH.
     * - `_transfer_price` The amount of `_token_address` should be payed for `_tokenId`
     *
     * Emits a {determinePriceSuccess} event, which contains:
     * - `_tokenId` transferred token id.
     * - `_token_address` address of the token this transcation used, address(0) represent ETH.
     * - `_transfer_price` The amount of `_token_address` should be payed for `_tokenId`
     */
    function publish(
        address[] memory _token_addrs, 
        uint256[] memory _base_prices, 
        uint256 _special_edition_amount, 
        address _special_payment_addr
    ) external onlyOwner{
        _tokenIds.increment();
        uint64 max_64 = type(uint64).max;
        require((_tokenIds.current()) <= max_64, "value doesn't fit in 64 bits");
        uint64 new_asset_id = uint64(_tokenIds.current());
        Issue storage issue = issues_by_id[new_asset_id];
    
    }
    /**
     * @dev Determine NFT price before transfer.
     *
     * Requirements:
     * 
     * - `_tokenId` transferred token id.
     * - `_token_address` address of the token this transcation used, address(0) represent ETH.
     * - `_transfer_price` The amount of `_token_address` should be payed for `_tokenId`
     *
     * Emits a {determinePriceSuccess} event, which contains:
     * - `_tokenId` transferred token id.
     * - `_token_address` address of the token this transcation used, address(0) represent ETH.
     * - `_transfer_price` The amount of `_token_address` should be payed for `_tokenId`
     */
    function determine_price(
        uint256 _tokenId, 
        address _token_address,
        uint256 _transfer_price
    ) public {
        require(msg.sender == ownerOf(_tokenId), "Heterotopia: NFT's price should set by onwer of it.");
        editions_by_id[_tokenId].transfer_price = _transfer_price;
        editions_by_id[_tokenId].token_address = _token_address;
        emit determinePriceSuccess(_tokenId, _token_address, _transfer_price);
    }
    function _beforeTokenTransfer (
        address from,
        address to,
        uint256 tokenId
    ) internal override {
        
        if (!_is_exclude_from_fee[from] && !_is_exclude_from_fee[to]) {
            require(editions_by_id[tokenId].transfer_price != 0, "Heterotopia: transfer_price should be set");
            // 抽手续费
        } 
    }
    function _afterTokenTransfer (
        uint256 _tokenId
    ) internal {
        editions_by_id[_tokenId].transfer_price = 0;
    }

    function transferFrom(
        address from, 
        address to, 
        uint256 tokenId
    ) public override {

        super.transferFrom(from, to, tokenId);
        _afterTokenTransfer(tokenId);

    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory _data
    ) public override {
        
        super.safeTransferFrom(from, to, tokenId, _data);
        _afterTokenTransfer(tokenId);
    }
    

    function calculateRoyaltyFee(uint256 _amount, uint256 _royalty_fee) private view returns (uint256) {
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
    
    function setRoyaltyPercent(uint256 _issue_id, uint256 _royalty_fee) external onlyOwner {
        require(_royalty_fee <= 100, "Heterotopia: royalty fee can not exceed 100.");
        issues_by_id[_issue_id].royalty_fee = _royalty_fee;
    }
    
    function isExcludedFromFee(address account) public view returns(bool) {
        return _is_exclude_from_fee[account];
    }
}