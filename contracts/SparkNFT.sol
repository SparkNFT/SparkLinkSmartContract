// SPDX-License-Identifier: MIT

pragma solidity >= 0.8.0;

import "./IERC721Receiver.sol";
import "./IERC721Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "hardhat/console.sol";
contract SparkNFT is Context, ERC165, IERC721, IERC721Metadata{
    using Address for address;
    using Counters for Counters.Counter;
    Counters.Counter private _issueIds;
    // 由于时间关系先写中文注释
    // Issue 用于存储一系列的NFT，他们对应同一个URI，以及一系列相同的属性，在结构体中存储
    // 重要的有royalty_fee 用于存储手续费抽成比例
    // base_royaltyfee 当按照比例计算的手续费小于这个值的时候，取用这个值
    // 以这样的方式增大其传播性，同时使得上层的NFT具备价值
    // shill_times 代表这个issue中的一个NFT最多能够产出多少份子NFT
    // total_amount 这个issue总共产出了多少份NFT，同时用于新产出的NFT标号，标号从1开始
    // first_sell_price 规定了根节点的NFT mint 子节点的费用，之后所有的子节点mint出新节点的费用不会高于这个值
    struct Issue {
        // The publisher publishes a series of NFTs with the same content and different NFT_id each time.
        // This structure is used to store the public attributes of same series of NFTs.
        // uint32 issue_id;
        // Number of NFTs have not been minted in this series
        uint8 royalty_fee;
        // Used to identify which series it is.
        // Publisher of this series NFTs
        uint8 shill_times;
        uint32 total_amount;
        // Metadata json file.
        // issue's name
        // List of tokens(address) can be acceptd for payment.
        // And specify the min fee should be toke when series of NFTs are sold.
        // If base_royaltyfee[tokens] == 0, then this token will not be acceptd.
        // `A token address` can be ERC-20 token contract address or `address(0)`(ETH).
        uint128 first_sell_price;
        // The price should be payed when this series NTFs are minted.
        // 这两个mapping如果存在token_addr看价格是不可以等于0的，如果等于0的话会导致判不支持
        // 由于这个价格是写死的，可能会诱导用户的付款倾向
    }
    // 存储NFT相关信息的结构体
    // father_id存储它父节点NFT的id
    // transfer_price 在决定出售的时候设定，买家调起transferFrom付款并转移
    // shillPrice存储从这个子节点mint出新的NFT的价格是多少
    // 此处可以优化，并不需要每一个节点都去存一个，只需要一层存一个就可以了，但是需要NFT_id调整编号的方式与节点在树上的位置强相关
    // is_on_sale 在卖家决定出售的时候将其设置成true，交易完成时回归false，出厂默认为false
    // remain_shill_times 记录该NFT剩余可以产生的NFT
    struct Edition {
        // Information used to decribe an NFT.
        // uint64 NFT_id;
        // 这个地方可以优化成editionid
        uint64 father_id;
        // Index of this NFT.
        uint128 shillPrice;
        // The price of the NFT in the transaction is determined before the transaction.
        uint8 remain_shill_times;
        address owner;
        bytes32 ipfs_hash;
        uint128 transfer_price;
        uint128 profit;
        // royalty_fee for every transfer expect from or to exclude address, max is 100;
    }
    // 分别存储issue与editions
    mapping (uint32 => Issue) private issues_by_id;
    mapping (uint64 => Edition) private editions_by_id;
    // 确定价格成功后的事件
    event DeterminePrice(
        uint64 indexed NFT_id,
        uint128 transfer_price
    );
    // 确定价格的同时approve买家可以操作owner的NFT
    event DeterminePriceAndApprove(
        uint64 indexed NFT_id,
        uint128 transfer_price,
        address indexed to
    );
    // 除上述变量外，该事件还返回根节点的NFTId
    event Publish(
	    uint32 indexed issue_id,
        address indexed publisher,
        uint64 rootNFTId
    );
    // 获取自己的收益成功
    event Claim(
        uint64 indexed NFT_id,
        address indexed receiver,
        uint128 amount
    );
    // Token name
    string private _name;

    // Token symbol
    string private _symbol;
    uint8 constant loss_ratio = 90;

    // Mapping owner address to token count
    mapping(address => uint64) private _balances;

    // Mapping from token ID to approved address
    mapping(uint64 => address) private _tokenApprovals;

    // Mapping from owner to operator approvals
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    // Optional mapping for token URIs
    //----------------------------------------------------------------------------------------------------
    /**
     * @dev Initializes the contract by setting a `name` and a `symbol` to the token collection.
     */
    constructor() {
        _name = "SparkNFT";
        _symbol = "SparkNFT";
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
        require(owner != address(0), "SparkNFT: balance query for the zero address");
        return _balances[owner];
    }

    /**
     * @dev See {IERC721-ownerOf}.
     */
    function ownerOf(uint256 tokenId) public view virtual override returns (address) {
        address owner = editions_by_id[uint256toUint64(tokenId)].owner;
        require(owner != address(0), "SparkNFT: owner query for nonexistent token");
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
    function approve(address to, uint256 tokenId) public virtual override {
        address owner = ownerOf(tokenId);
        require(to != owner, "SparkNFT: approval to current owner");
        require(
            _msgSender() == owner || isApprovedForAll(owner, _msgSender()),
            "SparkNFT: approve caller is not owner nor approved for all"
        );

        _approve(to, uint256toUint64(tokenId));
    }

    /**
     * @dev See {IERC721-getApproved}.
     */
    function getApproved(uint256 tokenId) public view virtual override returns (address) {
        require(isEditionExist(uint256toUint64(tokenId)), "SparkNFT: approved query for nonexistent token");

        return _tokenApprovals[uint256toUint64(tokenId)];
    }

    /**
     * @dev See {IERC721-setApprovalForAll}.
     */
    function setApprovalForAll(address operator, bool approved) public virtual override {
        require(operator != _msgSender(), "SparkNFT: approve to caller");
        _operatorApprovals[_msgSender()][operator] = approved;
        emit ApprovalForAll(_msgSender(), operator, approved);
    }

    /**
     * @dev See {IERC721-isApprovedForAll}.
     */
    function isApprovedForAll(address owner, address operator) public view virtual override returns (bool) {
        return _operatorApprovals[owner][operator];
    }

    function _baseURI() internal pure returns (string memory) {
        return "https://ipfs.io/ipfs/";
    } /**
     * @dev See {IERC721Metadata-tokenURI}.
     */
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(isEditionExist(uint256toUint64(tokenId)), "SparkNFT: URI query for nonexistent token");

        bytes32  _ipfs_hash = editions_by_id[uint256toUint64(tokenId)].ipfs_hash;
        string memory base = _baseURI();
        return string(abi.encodePacked(base, _ipfs_hash));
        
    }

    /**
     * @dev Sets `_tokenURI` as the tokenURI of `tokenId`.
     *
     * Requirements:
     *
     * - `tokenId` must exist.
     */
    // 这个函数保留，可能用于二次创作来修改URI
    function _setTokenURI(uint64 tokenId, bytes32 ipfs_hash) internal virtual {
        require(isEditionExist(tokenId), "SparkNFT: URI set of nonexistent token");
        editions_by_id[tokenId].ipfs_hash = ipfs_hash;
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
     * Emits a {DeterminePrice} event, which contains:
     * - `_NFT_id` transferred token id.
     * - `_token_addr` address of the token this transcation used, address(0) represent ETH.
     * - `_price` The amount of `_token_addr` should be payed for `_NFT_id`
     */

    // publish函数分为这样几个部分
    // 首先检验传入的参数是否正确，是否出现了不符合逻辑的上溢现象
    // 然后获取issueid
    // 接下来调用私有函数去把对应的变量赋值
    // 初始化根节点NFT
    // 触发事件，将数据上到log中
    function publish(
        uint128 _first_sell_price,
        uint8 _royalty_fee,
        uint8 _shill_times,
        bytes32 _ipfs_hash
    ) external {
        require(_royalty_fee <= 100, "SparkNFT: Royalty fee should less than 100.");
        _issueIds.increment();
        require(_issueIds.current() <= type(uint32).max, "SparkNFT: value doesn't fit in 32 bits.");
        uint32 new_issue_id = uint32(_issueIds.current());
        Issue storage new_issue = issues_by_id[new_issue_id];
        // new_issue.issue_id = new_issue_id;
        new_issue.royalty_fee = _royalty_fee;
        new_issue.shill_times = _shill_times;
        new_issue.first_sell_price = _first_sell_price;
        uint64 rootNFTId =  _initialRootEdition(new_issue_id, _ipfs_hash);
        emit Publish(
            new_issue_id,
            msg.sender,
            rootNFTId
        );
    }
    function _initialRootEdition(uint32 _issue_id, bytes32 ipfs_hash) internal returns (uint64) {
        issues_by_id[_issue_id].total_amount += 1;
        uint32 new_edition_id = issues_by_id[_issue_id].total_amount;
        uint64 new_NFT_id = getNftIdByEditionIdAndIssueId(_issue_id, new_edition_id);
        require(!isEditionExist(new_NFT_id), "SparkNFT: token already minted");
        require(
            _checkOnERC721Received(address(0), msg.sender, new_NFT_id, ""),
            "SparkNFT: transfer to non ERC721Receiver implementer"
        );
        Edition storage new_NFT = editions_by_id[new_NFT_id];
        // new_NFT.NFT_id = new_NFT_id;
        new_NFT.remain_shill_times = issues_by_id[_issue_id].shill_times;
        new_NFT.shillPrice = issues_by_id[_issue_id].first_sell_price;
        new_NFT.owner = msg.sender;
        new_NFT.ipfs_hash = ipfs_hash;
        _balances[msg.sender] += 1;
        emit Transfer(address(0), msg.sender, new_NFT_id);
        return new_NFT_id;
    }
    // 由于存在loss ratio 我希望mint的时候始终按照比例收税
    // 接受shill的函数，也就是mint新的NFT
    // 传入参数是新的NFT的父节点的NFTid
    // 首先还是检查参数是否正确，同时加入判断以太坊是否够用的检测
    // 如果是根节点就不进行手续费扣款
    // 接下来mintNFT
    // 最后触发事件
    function acceptShill(
        uint64 _NFT_id
    ) public payable {
        require(isEditionExist(_NFT_id), "SparkNFT: This NFT is not exist.");
        require(editions_by_id[_NFT_id].remain_shill_times > 0, "SparkNFT: There is no remain shill times for this NFT.");
        require(msg.value == editions_by_id[_NFT_id].shillPrice, "SparkNFT: not enought ETH");
        _addProfit( _NFT_id, editions_by_id[_NFT_id].shillPrice);
        _mintNFT(_NFT_id, msg.sender);
        editions_by_id[_NFT_id].remain_shill_times -= 1;
        if (editions_by_id[_NFT_id].remain_shill_times == 0) {
            _mintNFT(_NFT_id, ownerOf(_NFT_id));
        }
    }

    function _mintNFT(
        uint64 _NFT_id,
        address _owner
    ) internal returns (uint64) {
        uint32 _issue_id = getIssueIdByNFTId(_NFT_id);
        issues_by_id[_issue_id].total_amount += 1;
        uint32 new_edition_id = issues_by_id[_issue_id].total_amount;
        uint64 new_NFT_id = getNftIdByEditionIdAndIssueId(_issue_id, new_edition_id);
        require(
            _checkOnERC721Received(address(0), _owner, new_NFT_id, ""),
            "SparkNFT: transfer to non ERC721Receiver implementer"
        );
        Edition storage new_NFT = editions_by_id[new_NFT_id];
        // new_NFT.NFT_id = new_NFT_id;
        new_NFT.remain_shill_times = issues_by_id[_issue_id].shill_times;
        new_NFT.father_id = _NFT_id;
        new_NFT.shillPrice = editions_by_id[_NFT_id].shillPrice - calculateFee(editions_by_id[_NFT_id].shillPrice, loss_ratio);
        new_NFT.owner = _owner;
        new_NFT.ipfs_hash = editions_by_id[_NFT_id].ipfs_hash;
        _balances[_owner] += 1;
        emit Transfer(address(0), _owner, new_NFT_id);
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
     */
    function determinePrice(
        uint64 _NFT_id,
        uint128 _price
    ) public {
        require(isEditionExist(_NFT_id), "SparkNFT: The NFT you want to buy is not exist.");
        require(msg.sender == ownerOf(_NFT_id), "SparkNFT: NFT's price should set by onwer of it.");
        editions_by_id[_NFT_id].transfer_price = _price;
        emit DeterminePrice(_NFT_id, _price);
    }

    function determinePriceAndApprove(
        uint64 _NFT_id,
        uint128 _price,
        address _to
    ) public {
        determinePrice(_NFT_id, _price);
        approve(_to, _NFT_id);
        emit DeterminePriceAndApprove(_NFT_id, _price, _to);
    }
    // 将flag在转移后重新设置
    function _afterTokenTransfer (
        uint64 _NFT_id
    ) internal {
        // Clear approvals from the previous owner
        _approve(address(0), _NFT_id);
        editions_by_id[_NFT_id].transfer_price = 0;
    }
    // 加入一个owner调取transfer不需要check是否onsale
    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external payable override{
        _transfer(from, to, uint256toUint64(tokenId));
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external payable override{
       _safeTransfer(from, to, uint256toUint64(tokenId), "");
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes calldata _data
    ) external payable override {
        _safeTransfer(from, to, uint256toUint64(tokenId), _data);
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
        uint64 tokenId
    ) internal virtual {
        require(ownerOf(tokenId) == from, "SparkNFT: transfer of token that is not own");
        require(_isApprovedOrOwner(_msgSender(), tokenId), "SparkNFT: transfer caller is not owner nor approved");
        require(to != address(0), "SparkNFT: transfer to the zero address");
        if (msg.sender != ownerOf(tokenId)) {
            require(msg.value == editions_by_id[tokenId].transfer_price, "SparkNFT: not enought ETH");
            _addProfit(tokenId, editions_by_id[tokenId].transfer_price);
            claimProfit(tokenId);
        }
        else {
            claimProfit(tokenId);
        }
        _afterTokenTransfer(tokenId);
        _balances[from] -= 1;
        _balances[to] += 1;
        editions_by_id[tokenId].owner = to;
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
        uint64 tokenId,
        bytes memory _data
    ) internal virtual {
        _transfer(from, to, tokenId);
        require(_checkOnERC721Received(from, to, tokenId, _data), "SparkNFT: transfer to non ERC721Receiver implementer");
    }

    function claimProfit(uint64 _NFT_id) public {
        require(isEditionExist(_NFT_id), "SparkNFT: Edition is not exist.");
        if (editions_by_id[_NFT_id].profit != 0) {
            uint128 amount = editions_by_id[_NFT_id].profit;
            editions_by_id[_NFT_id].profit = 0;
            if (getFatherByNFTId(_NFT_id) != 0) {
                uint128 _royalty_fee = calculateFee(editions_by_id[_NFT_id].profit, issues_by_id[getIssueIdByNFTId(_NFT_id)].royalty_fee);
                _addProfit( getFatherByNFTId(_NFT_id), _royalty_fee);
                amount -= _royalty_fee;
            }
            payable(ownerOf(_NFT_id)).transfer(amount);
            emit Claim(
                _NFT_id,
                ownerOf(_NFT_id),
                amount
            );
        }
    }
    /**
     * @dev Returns whether `spender` is allowed to manage `tokenId`.
     *
     * Requirements:
     *
     * - `tokenId` must exist.
     */
    function _isApprovedOrOwner(address spender, uint64 tokenId) internal view virtual returns (bool) {
        require(isEditionExist(tokenId), "SparkNFT: operator query for nonexistent token");
        address owner = ownerOf(tokenId);
        return (spender == owner || getApproved(tokenId) == spender || isApprovedForAll(owner, spender));
    }

    /**
     * @dev Approve `to` to operate on `tokenId`
     *
     * Emits a {Approval} event.
     */
    function _approve(address to, uint64 tokenId) internal virtual {
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
        uint64 tokenId,
        bytes memory _data
    ) private returns (bool) {
        if (to.isContract()) {
            try IERC721Receiver(to).onERC721Received(_msgSender(), from, tokenId, _data) returns (bytes4 retval) {
                return retval == IERC721Receiver.onERC721Received.selector;
            } catch (bytes memory reason) {
                if (reason.length == 0) {
                    revert("SparkNFT: transfer to non ERC721Receiver implementer");
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
    /**
     * @dev Returns whether `tokenId` exists.
     *
     * Tokens can be managed by their owner or approved accounts via {approve} or {setApprovalForAll}.
     *
     * Tokens start existing when they are minted (`_mint`),
     * and stop existing when they are burned (`_burn`).
     */

    function _addProfit(uint64 _NFT_id, uint128 _increase) internal {
        editions_by_id[_NFT_id].profit = editions_by_id[_NFT_id].profit+_increase;
    }

    function _subProfit(uint64 _NFT_id, uint128 _decrease) internal {
        editions_by_id[_NFT_id].profit = editions_by_id[_NFT_id].profit-_decrease;
    }
    function _addTotalAmount(uint32 _issue_id) internal {
        require(getTotalAmountByIssueId(_issue_id) < type(uint32).max, "SparkNFT: There is no left in this issue.");
        editions_by_id[getRootNFTIdByIssueId(_issue_id)].father_id += 1;
    }

    function isIssueExist(uint32 _issue_id) public view returns (bool) {
        return (issues_by_id[_issue_id].total_amount != 0);
    }
    function isEditionExist(uint64 _NFT_id) public view returns (bool) {
        return (editions_by_id[_NFT_id].owner != address(0));
    }
    
    function getRoyaltyFeeByIssueId(uint32 _issue_id) public view returns (uint8) {
        require(isIssueExist(_issue_id), "SparkNFT: This issue is not exist.");
        return issues_by_id[_issue_id].royalty_fee;
    }

    function getShellTimesByIssyeId(uint32 _issue_id) public view returns (uint8) {
        require(isIssueExist(_issue_id), "SparkNFT: This issue is not exist.");
        return issues_by_id[_issue_id].shill_times;
    }

    function getTotalAmountByIssueId(uint32 _issue_id) public view returns (uint32) {
        require(isEditionExist(getRootNFTIdByIssueId(_issue_id)), "SparkNFT: This issue is not exist.");
        return getBottomUint32FromUint64(editions_by_id[getRootNFTIdByIssueId(_issue_id)].father_id);
    }

    function getFatherByNFTId(uint64 _NFT_id) public view returns (uint64) {
        require(isEditionExist(_NFT_id), "SparkNFT: Edition is not exist.");
        return editions_by_id[_NFT_id].father_id;
    }

    function getTransferPriceByNFTId(uint64 _NFT_id) public view returns (uint128) {
        require(isEditionExist(_NFT_id), "SparkNFT: Edition is not exist.");
        return editions_by_id[_NFT_id].transfer_price;
    }

    function getShillPriceByNFTId(uint64 _NFT_id) public view returns (uint128) {
        require(isEditionExist(_NFT_id), "SparkNFT: Edition is not exist.");
        return editions_by_id[_NFT_id].shillPrice;
    }

    function getRemainShillTimesByNFTId(uint64 _NFT_id) public view returns (uint8) {
        require(isEditionExist(_NFT_id), "SparkNFT: Edition is not exist.");
        return editions_by_id[_NFT_id].remain_shill_times;
    }
  
    function getNftIdByEditionIdAndIssueId(uint32 _issue_id, uint32 _edition_id) internal pure returns (uint64) {
        return (uint64(_issue_id)<<32)|uint64(_edition_id);
    }

    function getRootNFTIdByIssueId(uint32 _issue_id) internal pure returns (uint64) {
        return (uint64(_issue_id<<32) | uint64(1));
    }

    function getLossRatio() public pure returns (uint8) {
        return loss_ratio;
    }
   
    function getIssueIdByNFTId(uint64 _NFT_id) public pure returns (uint32) {
        return uint32(_NFT_id >> 32);
    }

    /**
     * position      position in a memory block
     * size          data size
     * base          base data
     * unbox() extracts the data out of a 256bit word with the given position and returns it
     * base is checked by validRange() to make sure it is not over size 
    **/
    function getUint8FromUint64(uint8 position, uint64 data64) internal pure returns (uint8 data8) {
        // (((1 << size) - 1) & base >> position)
        assembly {
            data8 := and(sub(shl(8, 1), 1), shr(position, data64))
        }
    }
    
    function getBottomUint32FromUint64(uint64 data64) internal pure returns (uint32 data32) {
        // (((1 << size) - 1) & base >> position)
        assembly {
            data32 := and(sub(shl(32, 1), 1), data64)
        }
    }

    /**
     * _box          32byte data to be modified
     * position      position in a memory block
     * size          data size
     * data          data to be inserted
     * rewriteBox() updates a 32byte word with a data at the given position with the specified size
    **/

    function reWriteUint8InUint64(uint8 position, uint8 data8, uint64 data64) internal pure returns (uint64 boxed) {
        assembly {
            // mask = ~((1 << 8 - 1) << position)
            // _box = (mask & _box) | ()data << position)
            boxed := or( and(data64, not(shl(position, sub(shl(8, 1), 1)))), shl(position, data8))
        }
    }

    function uint256toUint64(uint256 value) internal pure returns (uint64) {
        require(value <= type(uint64).max, "SparkNFT: value doesn't fit in 64 bits");
        return uint64(value);
    }
    
    function calculateFee(uint128 _amount, uint8 _fee_percent) internal pure returns (uint128) {
        return _amount*_fee_percent/10**2;
    }
}
