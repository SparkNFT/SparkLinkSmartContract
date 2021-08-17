// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract Heterotopia is ERC721URIStorage {
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;
    struct Issue {
        // The publisher publishes a series of NFTs with the same content and different NFT_id each time.
        // This structure is used to store the public attributes of same series of NFTs.
        uint256 issue_id;
        // Used to identify which series it is.
        address publisher;
        // Publisher of this series NFTs
        uint256 total_edition_amount;
        // Number of NFTs included in this series
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
        uint256 NFT_id;
        // Index of this NFT.
        uint256 transfer_price;
        // The price of the NFT in the transaction is determined before the transaction, and the initial value 0 is restored after the transaction.
        address token_address;
        // The tokens used in this transcation, determined together with the price.
        uint256 issue_id;
        // Indicate which series this NFT belongs to.
    }
    mapping (uint256 => Issue) issues;
    mapping (uint256 => Edition) editions;

    event determinePriceSuccess(
        uint256 token_id,
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
    uint256 NFT_id,
    address from,
    address to,
    uint256 transfer_price
    );
}