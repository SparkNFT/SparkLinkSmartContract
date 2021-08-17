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
        //
        uint256 issue_id;
        address publisher;
        mapping (address => uint256) baseline;
        mapping (address => bool) special_edition;
        uint256 total_edition_amount;
        address special_payment_addr;
    }
    
    struct Edition {
        uint256 NFT_id;
        uint256 transfer_price;
        address token_address;
        uint256 issue_id;
    }
    mapping (uint256 => Issue) issue_series;
    mapping (uint256 => Edition) editions;





}