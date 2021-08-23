// SPDX-License-Identifier: MIT

pragma solidity >= 0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./IERC721Receiver.sol";
import "./IERC721Metadata.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
contract royaltyNFT is Context, ERC165, IERC721, IERC721Metadata{
    using Address for address;
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;
    using SafeMath for uint256;
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
    event determinePriceAndApproveSuccess(
        uint256 NFT_id,
        address token_addr,
        uint256 transfer_price,
        address to
    );
    // ? 在一个event中塞进去多个数组会不会影响gas开销
    event publishSuccess(
        string name,
        uint192 issue_id,
        address payable publisher,
        uint256 total_edition_amount,
        uint8 royalty_fee
    );
    // 三个数组变量需要用其他的办法获取，比如说public函数，不能够放在一个事件里面

    event buySuccess (
        address publisher,
        uint256 NFT_id,
        address transfer_token_addr,
        uint256 transfer_price,
        address buyer
    );
    event transferSuccess(
        uint256 NFT_id,
        address from,
        address to,
        uint256 transfer_price,
        address transfer_token_addr
    );
    // Token name
    string private _name;

    // Token symbol
    string private _symbol;

    // Mapping from token ID to owner address
    mapping(uint256 => address) private _owners;

    // Mapping owner address to token count
    mapping(address => uint256) private _balances;

    // Mapping from token ID to approved address
    mapping(uint256 => address) private _tokenApprovals;

    // Mapping from owner to operator approvals
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    // Optional mapping for token URIs
    mapping(uint256 => string) private _tokenURIs;
    //----------------------------------------------------------------------------------------------------
    /**
     * @dev Initializes the contract by setting a `name` and a `symbol` to the token collection.
     */
    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;

        _issueIds.increment();
    }
    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
        return
            interfaceId == type(IERC721).interfaceId ||
            interfaceId == type(IERC721Metadata).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    /**
     * @dev See {IERC721-balanceOf}.
     */
    function balanceOf(address owner) public view virtual override returns (uint256) {
        require(owner != address(0), "ERC721: balance query for the zero address");
        return _balances[owner];
    }

    /**
     * @dev See {IERC721-ownerOf}.
     */
    function ownerOf(uint256 tokenId) public view virtual override returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "ERC721: owner query for nonexistent token");
        return owner;
    }

    /**
     * @dev See {IERC721Metadata-name}.
     */
    function name() public view virtual override returns (string memory) {
        return _name;
    }

    /**
     * @dev See {IERC721Metadata-symbol}.
     */
    function symbol() public view virtual override returns (string memory) {
        return _symbol;
    }

    /**
     * @dev See {IERC721-approve}.
     */
    function approve(address to, uint256 tokenId) public payable virtual override {
        address owner = ownerOf(tokenId);
        require(to != owner, "ERC721: approval to current owner");

        require(
            _msgSender() == owner || isApprovedForAll(owner, _msgSender()),
            "ERC721: approve caller is not owner nor approved for all"
        );

        _approve(to, tokenId);
    }

    /**
     * @dev See {IERC721-getApproved}.
     */
    function getApproved(uint256 tokenId) public view virtual override returns (address) {
        require(_exists(tokenId), "ERC721: approved query for nonexistent token");

        return _tokenApprovals[tokenId];
    }

    /**
     * @dev See {IERC721-setApprovalForAll}.
     */
    function setApprovalForAll(address operator, bool approved) public virtual override {
        require(operator != _msgSender(), "ERC721: approve to caller");

        _operatorApprovals[_msgSender()][operator] = approved;
        emit ApprovalForAll(_msgSender(), operator, approved);
    }

    /**
     * @dev See {IERC721-isApprovedForAll}.
     */
    function isApprovedForAll(address owner, address operator) public view virtual override returns (bool) {
        return _operatorApprovals[owner][operator];
    }

    function _baseURI() internal view returns (string memory) {
        return "ipfs.io/ipfs/";
    } /**
     * @dev See {IERC721Metadata-tokenURI}.
     */
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_exists(tokenId), "ERC721URIStorage: URI query for nonexistent token");

        string memory _tokenURI = _tokenURIs[tokenId];
        string memory base = _baseURI();

        // If there is no base URI, return the token URI.
        if (bytes(base).length == 0) {
            return _tokenURI;
        }
        // If both are set, concatenate the baseURI and tokenURI (via abi.encodePacked).
        if (bytes(_tokenURI).length > 0) {
            return string(abi.encodePacked(base, _tokenURI));
        }

        return bytes(base).length > 0 ? string(abi.encodePacked(base, uint256Tostr(tokenId))) : "";
    }

    /**
     * @dev Sets `_tokenURI` as the tokenURI of `tokenId`.
     *
     * Requirements:
     *
     * - `tokenId` must exist.
     */
    function _setTokenURI(uint256 tokenId, string memory _tokenURI) internal virtual {
        require(_exists(tokenId), "ERC721URIStorage: URI set of nonexistent token");
        _tokenURIs[tokenId] = _tokenURI;
    }

    /**
     * @dev Destroys `tokenId`.
     * The approval is cleared when the token is burned.
     *
     * Requirements:
     *
     * - `tokenId` must exist.
     *
     * Emits a {Transfer} event.
     */
    function _burn(uint256 tokenId) internal {
        address owner = ownerOf(tokenId);
        // Clear approvals
        _approve(address(0), tokenId);

        _balances[owner] -= 1;
        delete _owners[tokenId];

        if (bytes(_tokenURIs[tokenId]).length != 0) {
            delete _tokenURIs[tokenId];
        }

        emit Transfer(owner, address(0), tokenId);
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
     // 如何检测他传入的erc20地址是一个正常的地址
    function publish(
        address[] memory _token_addrs, 
        uint256[] memory _base_royaltyfee,
        uint256[] memory _first_sell_price,
        uint8 _royalty_fee,
        uint64 _total_edition_amount,
        string memory _issue_name,
        string memory _ipfs_hash
    ) external {
        require(_royalty_fee <= 100, "royaltyNFT: royalty fee should less than 100.");
        require(_token_addrs.length == _base_royaltyfee.length && _base_royaltyfee.length == _first_sell_price.length, 
                "royaltyNFT: token address array length should be equal to others.");
        _issueIds.increment();
        uint192 max_192 = type(uint192).max;
        uint64 max_64 = type(uint64).max;
        require(_total_edition_amount <= max_64, "royaltyNFT: Edition amount doesn't fit in 64 bits");
        require((_issueIds.current()) <= max_192, "royaltyNFT: Issue id doesn't fit in 192 bits");
        uint192 new_issue_id = uint64(_issueIds.current());
        Issue storage new_issue = issues_by_id[new_issue_id];
        new_issue.name = _issue_name;
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
        emit publishSuccess(
            new_issue.name, 
            new_issue.issue_id, 
            new_issue.publisher, 
            new_issue.total_edition_amount, 
            new_issue.royalty_fee
        );
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
            IERC20(_token_addr).safeTransferFrom(msg.sender, issues_by_id[_issue_id].publisher, issues_by_id[_issue_id].first_sell_price[_token_addr]);
        }
        uint256 NFT_id = _mintNFT(_issue_id);

        emit buySuccess (
            issues_by_id[_issue_id].publisher,
            NFT_id,
            _token_addr,
            issues_by_id[_issue_id].first_sell_price[_token_addr],
            msg.sender
        );

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
        require(isEditionExist(_NFT_id), "royaltyNFT: The NFT you want to buy is not exist.");
        require(msg.sender == ownerOf(_NFT_id), "royaltyNFT: NFT's price should set by onwer of it.");
        require(issues_by_id[getIssueIdByNFTId(_NFT_id)].base_royaltyfee[_token_addr] != 0, "royaltyNFT: The token your selected is not supported.");
        editions_by_id[_NFT_id].transfer_price = _price;
        editions_by_id[_NFT_id].token_addr = _token_addr;
        editions_by_id[_NFT_id].is_on_sale = true;
        emit determinePriceSuccess(_NFT_id, _token_addr, _price);
    }

    function determinePriceAndApprove(
        uint256 _NFT_id, 
        address _token_addr,
        uint256 _price,
        address _to
    ) public {
        determinePrice(_NFT_id, _token_addr, _price);
        approve(_to, _NFT_id);
    }
    
    function _afterTokenTransfer (
        uint256 _NFT_id
    ) internal {
        editions_by_id[_NFT_id].transfer_price = 0;
    }

    function transferFrom(
        address from, 
        address to, 
        uint256 NFT_id
    ) public payable override{
        require(_isApprovedOrOwner(_msgSender(), NFT_id), "royaltyNFT: transfer caller is not owner nor approved");
        require(isEditionExist(NFT_id), "royaltyNFT: Edition is not exist.");
        if (to != issues_by_id[getIssueIdByNFTId(NFT_id)].publisher && from != issues_by_id[getIssueIdByNFTId(NFT_id)].publisher) {
            require(editions_by_id[NFT_id].is_on_sale, "royaltyNFT: This NFT is not on sale.");
            uint256 royalty_fee = calculateRoyaltyFee(editions_by_id[NFT_id].transfer_price, issues_by_id[getIssueIdByNFTId(NFT_id)].royalty_fee);
            if (royalty_fee < issues_by_id[getIssueIdByNFTId(NFT_id)].base_royaltyfee[editions_by_id[NFT_id].token_addr]){
                royalty_fee = issues_by_id[getIssueIdByNFTId(NFT_id)].base_royaltyfee[editions_by_id[NFT_id].token_addr];
            }
            // 如果大于存在一个改价的情况
            if (editions_by_id[NFT_id].token_addr == address(0)) {
                require(msg.value == editions_by_id[NFT_id].transfer_price, "royaltyNFT: not enought ETH");
                issues_by_id[getIssueIdByNFTId(NFT_id)].publisher.transfer(royalty_fee);
                payable(ownerOf(NFT_id)).transfer(editions_by_id[NFT_id].transfer_price.sub(royalty_fee));
            }
            else {
                IERC20(editions_by_id[NFT_id].token_addr).safeTransferFrom(msg.sender, issues_by_id[getIssueIdByNFTId(NFT_id)].publisher, royalty_fee);
                IERC20(editions_by_id[NFT_id].token_addr).safeTransferFrom(msg.sender, ownerOf(NFT_id), editions_by_id[NFT_id].transfer_price.sub(royalty_fee));
            }
        } 

        _transfer(from, to, NFT_id);
        _afterTokenTransfer(NFT_id);

    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 NFT_id
    ) public payable override{
      
        require(_isApprovedOrOwner(_msgSender(), NFT_id), "royaltyNFT: transfer caller is not owner nor approved");
        require(isEditionExist(NFT_id), "royaltyNFT: Edition is not exist.");
        if (to != issues_by_id[getIssueIdByNFTId(NFT_id)].publisher && from != issues_by_id[getIssueIdByNFTId(NFT_id)].publisher) {
            require(editions_by_id[NFT_id].is_on_sale, "royaltyNFT: This NFT is not on sale.");
            uint256 royalty_fee = calculateRoyaltyFee(editions_by_id[NFT_id].transfer_price, issues_by_id[getIssueIdByNFTId(NFT_id)].royalty_fee);
            if (royalty_fee < issues_by_id[getIssueIdByNFTId(NFT_id)].base_royaltyfee[editions_by_id[NFT_id].token_addr]){
                royalty_fee = issues_by_id[getIssueIdByNFTId(NFT_id)].base_royaltyfee[editions_by_id[NFT_id].token_addr];
            }
            // 如果大于存在一个改价的情况
            if (editions_by_id[NFT_id].token_addr == address(0)) {
                require(msg.value == editions_by_id[NFT_id].transfer_price, "royaltyNFT: not enought ETH");
                issues_by_id[getIssueIdByNFTId(NFT_id)].publisher.transfer(royalty_fee);
                payable(ownerOf(NFT_id)).transfer(editions_by_id[NFT_id].transfer_price.sub(royalty_fee));
            }
            else {
                IERC20(editions_by_id[NFT_id].token_addr).safeTransferFrom(msg.sender, issues_by_id[getIssueIdByNFTId(NFT_id)].publisher, royalty_fee);
                IERC20(editions_by_id[NFT_id].token_addr).safeTransferFrom(msg.sender, ownerOf(NFT_id), editions_by_id[NFT_id].transfer_price.sub(royalty_fee));
            }
        } 

        _safeTransfer(from, to, NFT_id, "");
        _afterTokenTransfer(NFT_id);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 NFT_id,
        bytes calldata _data
    ) public payable override {
        safeTransferFrom(from, to, NFT_id);
    }
    /**
     * @dev Transfers `tokenId` from `from` to `to`.
     *  As opposed to {transferFrom}, this imposes no restrictions on msg.sender.
     *
     * Requirements:
     *
     * - `to` cannot be the zero address.
     * - `tokenId` token must be owned by `from`.
     *
     * Emits a {Transfer} event.
     */
    function _transfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual {
        require(ownerOf(tokenId) == from, "ERC721: transfer of token that is not own");
        require(to != address(0), "ERC721: transfer to the zero address");

        // Clear approvals from the previous owner
        _approve(address(0), tokenId);

        _balances[from] -= 1;
        _balances[to] += 1;
        _owners[tokenId] = to;

        emit Transfer(from, to, tokenId);
    }

     /**
     * @dev Safely transfers `tokenId` token from `from` to `to`, checking first that contract recipients
     * are aware of the ERC721 protocol to prevent tokens from being forever locked.
     *
     * `_data` is additional data, it has no specified format and it is sent in call to `to`.
     *
     * This internal function is equivalent to {safeTransferFrom}, and can be used to e.g.
     * implement alternative mechanisms to perform token transfer, such as signature-based.
     *
     * Requirements:
     *
     * - `from` cannot be the zero address.
     * - `to` cannot be the zero address.
     * - `tokenId` token must exist and be owned by `from`.
     * - If `to` refers to a smart contract, it must implement {IERC721Receiver-onERC721Received}, which is called upon a safe transfer.
     *
     * Emits a {Transfer} event.
     */
    function _safeTransfer(
        address from,
        address to,
        uint256 tokenId,
        bytes memory _data
    ) internal virtual {
        _transfer(from, to, tokenId);
        require(_checkOnERC721Received(from, to, tokenId, _data), "ERC721: transfer to non ERC721Receiver implementer");
    }
    function isIssueExist(uint192 _issue_id) public view returns (bool) {
        return (issues_by_id[_issue_id].issue_id != 0);
    }
    function isEditionExist(uint256 _NFT_id) public view returns (bool) {
        return (editions_by_id[_NFT_id].NFT_id != 0);
    }

    function getIssueIdByNFTId(uint256 _NFT_id) public view returns (uint192) {
        return uint192(_NFT_id >> 64);
    }

    function getNFTIdByIssueId(uint192 _issue_id) public view returns (uint256 [] memory) {
        uint256 [] memory NFT_ids = new uint256 [](issues_by_id[_issue_id].total_edition_amount);
        for (uint256 editions_id = 0; editions_id < issues_by_id[_issue_id].total_edition_amount; editions_id++){
            NFT_ids[editions_id] = uint256(_issue_id << 64 | editions_id);
        }
        return NFT_ids;
    }

    function calculateRoyaltyFee(uint256 _amount, uint8 _royalty_fee) private view returns (uint256) {
        return _amount.mul(_royalty_fee).div(
            10**2
        );
    }
    
    function setRoyaltyPercent(uint64 _issue_id, uint8 _royalty_fee) external {
        require(_royalty_fee <= 100, "royaltyNFT: royalty fee can not exceed 100.");
        issues_by_id[_issue_id].royalty_fee = _royalty_fee;
    } /**
     * @dev Returns whether `tokenId` exists.
     *
     * Tokens can be managed by their owner or approved accounts via {approve} or {setApprovalForAll}.
     *
     * Tokens start existing when they are minted (`_mint`),
     * and stop existing when they are burned (`_burn`).
     */
    function _exists(uint256 tokenId) internal view virtual returns (bool) {
        return _owners[tokenId] != address(0);
    }

    /**
     * @dev Returns whether `spender` is allowed to manage `tokenId`.
     *
     * Requirements:
     *
     * - `tokenId` must exist.
     */
    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view virtual returns (bool) {
        require(_exists(tokenId), "ERC721: operator query for nonexistent token");
        address owner = ownerOf(tokenId);
        return (spender == owner || getApproved(tokenId) == spender || isApprovedForAll(owner, spender));
    }

    /**
     * @dev Safely mints `tokenId` and transfers it to `to`.
     *
     * Requirements:
     *
     * - `tokenId` must not exist.
     * - If `to` refers to a smart contract, it must implement {IERC721Receiver-onERC721Received}, which is called upon a safe transfer.
     *
     * Emits a {Transfer} event.
     */
    function _safeMint(address to, uint256 tokenId) internal virtual {
        _safeMint(to, tokenId, "");
    }

    /**
     * @dev Same as {xref-ERC721-_safeMint-address-uint256-}[`_safeMint`], with an additional `data` parameter which is
     * forwarded in {IERC721Receiver-onERC721Received} to contract recipients.
     */
    function _safeMint(
        address to,
        uint256 tokenId,
        bytes memory _data
    ) internal virtual {
        _mint(to, tokenId);
        require(
            _checkOnERC721Received(address(0), to, tokenId, _data),
            "ERC721: transfer to non ERC721Receiver implementer"
        );
    }

    /**
     * @dev Mints `tokenId` and transfers it to `to`.
     *
     * WARNING: Usage of this method is discouraged, use {_safeMint} whenever possible
     *
     * Requirements:
     *
     * - `tokenId` must not exist.
     * - `to` cannot be the zero address.
     *
     * Emits a {Transfer} event.
     */
    function _mint(address to, uint256 tokenId) internal virtual {
        require(to != address(0), "ERC721: mint to the zero address");
        require(!_exists(tokenId), "ERC721: token already minted");

        _balances[to] += 1;
        _owners[tokenId] = to;

        emit Transfer(address(0), to, tokenId);
    }


    /**
     * @dev Approve `to` to operate on `tokenId`
     *
     * Emits a {Approval} event.
     */
    function _approve(address to, uint256 tokenId) internal virtual {
        _tokenApprovals[tokenId] = to;
        emit Approval(ownerOf(tokenId), to, tokenId);
    }

    /**
     * @dev Internal function to invoke {IERC721Receiver-onERC721Received} on a target address.
     * The call is not executed if the target address is not a contract.
     *
     * @param from address representing the previous owner of the given token ID
     * @param to target address that will receive the tokens
     * @param tokenId uint256 ID of the token to be transferred
     * @param _data bytes optional data to send along with the call
     * @return bool whether the call correctly returned the expected magic value
     */
    function _checkOnERC721Received(
        address from,
        address to,
        uint256 tokenId,
        bytes memory _data
    ) private returns (bool) {
        if (to.isContract()) {
            try IERC721Receiver(to).onERC721Received(_msgSender(), from, tokenId, _data) returns (bytes4 retval) {
                return retval == IERC721Receiver.onERC721Received.selector;
            } catch (bytes memory reason) {
                if (reason.length == 0) {
                    revert("ERC721: transfer to non ERC721Receiver implementer");
                } else {
                    assembly {
                        revert(add(32, reason), mload(reason))
                    }
                }
            }
        } else {
            return true;
        }
    }
    function uint256Tostr(uint256 _i) internal pure returns (string memory _uintAsString) {
    if (_i == 0) {
        return "0";
    }
    uint256 j = _i;
    uint256 len;
    while (j != 0) {
        len++;
        j /= 10;
    }
    bytes memory bstr = new bytes(len);
    uint256 k = len - 1;
    while (_i != 0) {
        bstr[k--] = bytes1(uint8(48 + _i % 10));
        _i /= 10;
    }
    return string(bstr);
}
}