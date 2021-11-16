// SPDX-License-Identifier: MIT

pragma solidity >= 0.8.4;

import "./IERC721Receiver.sol";
import "./IERC721Metadata.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router01.sol";
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol';
contract SparkLink is Ownable, ERC165, IERC721, IERC721Metadata{
    using Address for address;
    using Counters for Counters.Counter;
    using SafeERC20 for IERC20;
    Counters.Counter private _issueIds;
    /*
    Abstract struct Issue {
        uint32 total_amount;
        bool is_free
        bool is_ND;
        bool is_NC;
        uint16 shill_times;
        uint8 royalty_fee;
    }
    This structure records some common attributes of a series of NFTs:
        - `royalty_fee`: the proportion of royaltyes
        - `shill_times`: the number of times a single NFT can been shared
        - `total_amount`: the total number of NFTs in the series
    To reduce gas cost, this structure is actually stored in the `father_id` attibute of root NFT
        - 0~31  `total_amount`
        - 37 `is_free`
        - 38 `is_NC`
        - 39 `is_ND`
        - 40~55 `shill_times`
        - 56~63 `royalty_fee`
    */

    struct Edition {
        // This structure stores NFT related information:
        //  - `father_id`: For root NFT it stores issue abstract sturcture
        //                 For other NFTs its stores the NFT Id of which NFT it `acceptShill` from
        // - `shill_price`: The price should be paid when others `accpetShill` from this NFT
        // - remaining_shill_times: The initial value is the shilltimes of the issue it belongs to
        //                       When others `acceptShill` from this NFT, it will subtract one until its value is 0  
        // - `owner`: record the owner of this NFT
        // - `ipfs_hash`: IPFS hash value of the URI where this NTF's metadata stores
        // - `transfer_price`: The initial value is zero
        //                   Set by `determinePrice` or `determinePriceAndApprove` before `transferFrom`
        //                   It will be checked wether equal to msg.value when `transferFrom` is called
        //                   After `transferFrom` this value will be set to zero
        // - `profit`: record the profit owner can claim (include royalty fee it should conduct to its father NFT)
        uint64 father_id;
        uint128 shill_price;
        uint16 remaining_shill_times;
        address owner;
        bytes32 ipfs_hash;
        uint128 transfer_price;
        uint128 profit;
    }

    // Emit when `determinePrice` success
    event DeterminePrice(
        uint64 indexed NFT_id,
        uint128 transfer_price
    );

    // Emit when `determinePriceAndApprove` success
    event DeterminePriceAndApprove(
        uint64 indexed NFT_id,
        uint128 transfer_price,
        address indexed to
    );

    // Emit when `publish` success
    // - `rootNFTId`: Record the Id of root NFT given to publisher 
    event Publish(
        address indexed publisher,
        uint64  indexed rootNFTId,
        address token_addr
    );

    // Emit when claimProfit success
    //- `amount`: Record the actual amount owner of this NFT received (profit - profit*royalty_fee/100)
    event Claim(
        uint64 indexed NFT_id,
        address indexed receiver,
        uint128 amount
    );
    // Emit when setURI success
    event SetURI(
        uint64 indexed NFT_id,
        bytes32 old_URI,
        bytes32 new_URI
    );

    event Label(
        uint64 indexed NFT_id,
        string content
    );

    event SetDAOFee(
        uint8 old_DAO_fee,
        uint8 new_DAO_fee
    );

    event SetLoosRatio(
        uint8 old_loss_ratio,
        uint8 new_loss_ratio
    );

    event SetDAORouter01(
        address old_router_address,
        address new_router_address
    );

    event SetDAORouter02(
        address old_router_address,
        address new_router_address
    );

    //----------------------------------------------------------------------------------------------------
    /**
     * @dev Initializes the contract by setting a `name` and a `symbol` to the token collection.
     */
    constructor(address DAO_router_address01,address DAO_router_address02, address uniswapRouterAddress, address factoryAddress) {
        uniswapV2Router =  IUniswapV2Router02(uniswapRouterAddress);
        uniswapV2Factory = IUniswapV2Factory(factoryAddress);
        DAO_router01 = DAO_router_address01;
        DAO_router02 = DAO_router_address02;
        _name = "SparkLink";
        _symbol = "SPL";
    } 
    
   /**
     * @dev Create a issue and mint a root NFT for buyer acceptShill from
     *
     * Requirements:
     *
     * - `_first_sell_price`: The price should be paid when others `accpetShill` from this NFT
     * - `_royalty_fee`: The proportion of royaltyes, it represents the ratio of the father NFT's profit from the child NFT
     *                   Its value should <= 100
     * - `_shill_times`: the number of times a single NFT can been shared
     *                   Its value should <= 65536
     * - `_ipfs_hash`: IPFS hash value of the URI where this NTF's metadata stores
     *
     * - `token_address`: list of tokens(address) can be accepted for payment.
     *                 `A token address` can be ERC-20 token contract address or `address(0)`(ETH).
     *
     * - `_is_free`:
     * - `_is_NC`: 
     * 
     * - `_is_ND`: 
     * Emits a {Publish} event.
     * - Emitted {Publish} event contains root NFT id.
     */
    function publish(
        uint128 _first_sell_price,
        uint8 _royalty_fee,
        uint16 _shill_times,
        bytes32 _ipfs_hash,
        address _token_addr,
        bool _is_free,
        bool _is_NC,
        bool _is_ND
    ) 
        external 
    {
        require(_royalty_fee <= 100, "SparkLink: Royalty fee should be <= 100%.");
        _issueIds.increment();
        require(_issueIds.current() <= type(uint32).max, "SparkLink: Value doesn't fit in 32 bits.");
        if (_token_addr != address(0))
            require(IERC20(_token_addr).totalSupply() > 0, "Not a valid ERC20 token address");
        uint32 new_issue_id = uint32(_issueIds.current());
        uint64 rootNFTId = getNftIdByEditionIdAndIssueId(new_issue_id, 1);
        require(
            _checkOnERC721Received(address(0), msg.sender, rootNFTId, ""),
            "SparkLink: Transfer to non ERC721Receiver implementer"
        );

        Edition storage new_NFT = editions_by_id[rootNFTId];
        uint64 information;
        information = reWriteUint8InUint64(56, _royalty_fee, information);
        information = reWriteUint16InUint64(40, _shill_times, information);
        information = reWriteBoolInUint64(37, _is_free, information);
        information = reWriteBoolInUint64(38, _is_NC, information);
        information = reWriteBoolInUint64(39, _is_ND, information);
        information += 1;
        token_addresses[new_issue_id] = _token_addr;
        new_NFT.father_id = information;
        new_NFT.remaining_shill_times = _shill_times;
        new_NFT.shill_price = _first_sell_price;
        new_NFT.owner = msg.sender;
        new_NFT.ipfs_hash = _ipfs_hash;
        _balances[msg.sender] += 1;
        emit Transfer(address(0), msg.sender, rootNFTId);
        emit Publish(
            msg.sender,
            rootNFTId,
            _token_addr
        );
    }

    /**
     * @dev Buy a child NFT from the _NFT_id buyer input
     *
     * Requirements:
     *
     * - `_NFT_id`: _NFT_id the father NFT id buyer mint NFT from
     *              remain shill times of the NFT_id you input should greater than 0
     * Emits a {Ttansfer} event.
     * - Emitted {Transfer} event from 0x0 address to msg.sender, contain new NFT id.
     * - New NFT id will be generater by edition id and issue id
     *   0~31 edition id
     *   32~63 issue id
     */
    function acceptShill(
        uint64 _NFT_id
    ) 
        external 
        payable 
    {
        require(isEditionExisting(_NFT_id), "SparkLink: This NFT does not exist");
        require(editions_by_id[_NFT_id].remaining_shill_times > 0, "SparkLink: There is no remaining shill time for this NFT");
        if (!isRootNFT(_NFT_id)||!getIsFreeByNFTId(_NFT_id)){
            address token_addr = getTokenAddrByNFTId(_NFT_id);
            if (token_addr == address(0)){
                require(msg.value == editions_by_id[_NFT_id].shill_price, "SparkLink: Wrong price");
                _addProfit( _NFT_id, editions_by_id[_NFT_id].shill_price);
            }
            else {
                uint256 before_balance = IERC20(token_addr).balanceOf(address(this));
                IERC20(token_addr).safeTransferFrom(msg.sender, address(this), editions_by_id[_NFT_id].shill_price);
                _addProfit( _NFT_id, uint256toUint128(IERC20(token_addr).balanceOf(address(this))-before_balance));
            }
        }
        editions_by_id[_NFT_id].remaining_shill_times -= 1;
        _mintNFT(_NFT_id, msg.sender);
        if (editions_by_id[_NFT_id].remaining_shill_times == 0)
            _mintNFT(_NFT_id, ownerOf(_NFT_id));
    }

    /**
     * @dev Transfers `tokenId` token from `from` to `to`.
     *      
     * Requirements:
     *
     * - `from` cannot be the zero address.
     * - `to` cannot be the zero address.
     * - `tokenId` token must be owned by `from`.
     * - If the caller is not `from`, it must be approved to move this token by either {approve} or {setApprovalForAll}.
     * - If `transfer_price` has been set, caller should give same value in msg.sender.
     * - Will call `claimProfit` before transfer and `transfer_price` will be set to zero after transfer. 
     * Emits a {TransferAsset} events
     */
    function transferFrom(address from, address to, uint256 tokenId) external payable override {
        _transfer(from, to, uint256toUint64(tokenId));
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external payable override{
       _safeTransfer(from, to, uint256toUint64(tokenId), "");
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata _data) external payable override {
        _safeTransfer(from, to, uint256toUint64(tokenId), _data);
    }
    
    /**
     * @dev Claim profit from reward pool of NFT.
     *      
     * Requirements:
     *
     * - `_NFT_id`: The NFT id of NFT caller claim, the profit will give to its owner.
     * - If its profit is zero the event {Claim} will not be emited.
     * Emits a {Claim} events
     */
    function claimProfit(uint64 _NFT_id) public {
        require(isEditionExisting(_NFT_id), "SparkLink: This edition does not exist");
        
        if (editions_by_id[_NFT_id].profit != 0) {
            uint128 amount = editions_by_id[_NFT_id].profit;
            address token_addr = getTokenAddrByNFTId(_NFT_id);
            if (DAO_fee != 0) {
                uint128 DAO_amount = calculateFee(amount, DAO_fee);
                amount -= DAO_amount;
                if (token_addr == address(0)) {
                    payable(DAO_router01).transfer(DAO_amount);
                }
                else if (uniswapV2Factory.getPair(token_addr, uniswapV2Router.WETH()) == address(0)) {
                    IERC20(token_addr).safeTransfer(DAO_router02,DAO_amount);
                }
                else {
                    _swapTokensForEth(token_addr, DAO_amount);
                }
            }
            editions_by_id[_NFT_id].profit = 0;
            if (!isRootNFT(_NFT_id)) {
                uint128 _royalty_fee = calculateFee(amount, getRoyaltyFeeByNFTId(_NFT_id));
                _addProfit(getFatherByNFTId(_NFT_id), _royalty_fee);
                amount -= _royalty_fee;
            }
            if (token_addr == address(0)){
                payable(ownerOf(_NFT_id)).transfer(amount);
            }
            else {
                IERC20(token_addr).safeTransfer(ownerOf(_NFT_id), amount);
            }
            emit Claim(
                _NFT_id,
                ownerOf(_NFT_id),
                amount
            );
        }
    }

    /**
     * @dev Set token URI.
     *
     * Requirements:
     *
     * - `_NFT_id`: transferred token id.
     * - `ipfs_hash`: ipfs hash value of the URI will be set.
     * Emits a {SetURI} events
     */
    function setURI(uint64 _NFT_id, bytes32 ipfs_hash) public {
        if (getIsNDByNFTId(_NFT_id)) {
            require(_NFT_id == getRootNFTIdByNFTId(_NFT_id), "SparkLink: NFT follows the ND protocol, only the root NFT's URI can be set.");
        }
        require(ownerOf(_NFT_id) == msg.sender, "SparkLink: Only owner can set the token URI");
        _setTokenURI(_NFT_id, ipfs_hash);
    }

     /**
     * @dev update token URI.
     *
     * Requirements:
     *
     * - `_NFT_id`: transferred token id.
     */
    function updateURI(uint64 _NFT_id) public{
        require(ownerOf(_NFT_id) == msg.sender, "SparkLink: Only owner can update the token URI");
        editions_by_id[_NFT_id].ipfs_hash = editions_by_id[getRootNFTIdByNFTId(_NFT_id)].ipfs_hash;
    }

    function label(uint64 _NFT_id, string memory content) public {
        require(ownerOf(_NFT_id) == msg.sender, "SparkLink: Only owner can label this NFT");
        emit Label(_NFT_id, content);
    }
    /**
     * @dev Determine NFT price before transfer.
     *
     * Requirements:
     *
     * - `_NFT_id`: transferred token id.
     * - `_price`: The amount of ETH should be payed for `_NFT_id`
     * Emits a {DeterminePrice} events
     */
    function determinePrice(
        uint64 _NFT_id,
        uint128 _price
    ) 
        public 
    {
        require(isEditionExisting(_NFT_id), "SparkLink: This NFT does not exist");
        require(msg.sender == ownerOf(_NFT_id), "SparkLink: Only owner can set the price");
        editions_by_id[_NFT_id].transfer_price = _price;
        emit DeterminePrice(_NFT_id, _price);
    }

    /**
     * @dev Determine NFT price before transfer.
     *
     * Requirements:
     *
     * - `_NFT_id`: transferred token id.
     * - `_price`: The amount of ETH should be payed for `_NFT_id`
     * - `_to`: The account address `approve` to. 
     * Emits a {DeterminePriceAndApprove} events
     */
    function determinePriceAndApprove(
        uint64 _NFT_id,
        uint128 _price,
        address _to
    ) 
        public 
    {
        determinePrice(_NFT_id, _price);
        approve(_to, _NFT_id);
        emit DeterminePriceAndApprove(_NFT_id, _price, _to);
    }

    function setDAOFee(uint8 _DAO_fee) public onlyOwner {
        require(_DAO_fee <= MAX_DAO_FEE, "SparkLink: DAO fee can not exceed 5%");
        emit SetDAOFee(DAO_fee, _DAO_fee);
        DAO_fee = _DAO_fee;
    }

    function setDAORouter01(address _DAO_router01) public onlyOwner {
        emit SetDAORouter01(DAO_router01, _DAO_router01);
        DAO_router01 = _DAO_router01;
    }

    function setDAORouter02(address _DAO_router02) public onlyOwner {
        emit SetDAORouter01(DAO_router02, _DAO_router02);
        DAO_router02 = _DAO_router02;
    }

    function setUniswapV2Router(address _uniswapV2Router) public onlyOwner {
        uniswapV2Router =  IUniswapV2Router02(_uniswapV2Router);
    }
    function setUniswapV2Factory(address _uniswapV2Factory) public onlyOwner {
        uniswapV2Factory = IUniswapV2Factory(_uniswapV2Factory);
    }

    function setLoosRatio(uint8 _loss_ratio) public onlyOwner {
        require(_loss_ratio <= MAX_LOSS_RATIO, "SparkLink: Loss ratio can not below 50%");
        emit SetLoosRatio(loss_ratio, _loss_ratio);
        loss_ratio = _loss_ratio;
    }
    /**
     * @dev See {IERC721-approve}.
     */
    function approve(address to, uint256 tokenId) public virtual override {
        address owner = ownerOf(tokenId);
        require(to != owner, "SparkLink: Approval to current owner");
        require(
            _msgSender() == owner || isApprovedForAll(owner, _msgSender()),
            "SparkLink: Approve caller is not owner nor approved for all"
        );

        _approve(to, uint256toUint64(tokenId));
    }

    /**
     * @dev See {IERC721-setApprovalForAll}.
     */
    function setApprovalForAll(address operator, bool approved) public virtual override {
        require(operator != _msgSender(), "SparkLink: Approve to caller");
        _operatorApprovals[_msgSender()][operator] = approved;
        emit ApprovalForAll(_msgSender(), operator, approved);
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
        require(owner != address(0), "SparkLink: Balance query for the zero address");
        return _balances[owner];
    }

    /**
     * @dev See {IERC721-ownerOf}.
     */
    function ownerOf(uint256 tokenId) public view virtual override returns (address) {
        address owner = editions_by_id[uint256toUint64(tokenId)].owner;
        require(owner != address(0), "SparkLink: Owner query for nonexistent token");
        return owner;
    }

    /**
     *                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        @dev See {IERC721Metadata-name}.
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
     * @dev Query NFT information set.
     *
     * Requirements:
     * - `_NFT_id`: The id of the edition queryed.
     * Return :
     * - `issue_information`: For root NFT it stores issue abstract sturcture
     * - 0~31   `total_amount`
     * - 37     `is_free`
     * - 38     `is_NC`
     * - 39     `is_ND`
     * - 40~55  `shill_times`
     * - 56~63 `royalty_fee`
     * - `father_id`: For root NFT it stores issue abstract sturcture
     *                For other NFTs its stores the NFT Id of which NFT it `acceptShill` from
     * - `shill_price`: The price should be paid when others `accpetShill` from this NFT
     * - `remaining_shill_times`: The initial value is the shilltimes of the issue it belongs to
     *                      When others `acceptShill` from this NFT, it will subtract one until its value is 0  
     * - `owner`: record the owner of this NFT
     * - `transfer_price`: The initial value is zero
     *                  Set by `determinePrice` or `determinePriceAndApprove` before `transferFrom`
     *                  It will be checked wether equal to msg.value when `transferFrom` is called
     *                  After `transferFrom` this value will be set to zero
     * - `profit`: record the profit owner can claim (include royalty fee it should conduct to its father NFT)
     * - `metadata`: IPFS hash value of the URI where this NTF's metadata stores
     */

    function getNFTInfoByNFTID(uint64 _NFT_id) 
        public view  
        returns (
            uint64 issue_information,
            uint64 father_id,
            uint128 shill_price,
            uint16 remain_shill_times,
            uint128 profit,
            string memory metadata
            ) 
    {
        require(isEditionExisting(_NFT_id), "SparkLink: Approved query for nonexistent token");
        return(
            editions_by_id[getRootNFTIdByNFTId(_NFT_id)].father_id,
            getFatherByNFTId(_NFT_id),
            editions_by_id[_NFT_id].shill_price,
            getRemainShillTimesByNFTId(_NFT_id),
            getProfitByNFTId(_NFT_id),
            tokenURI(_NFT_id)
        );
    }

    /**
     * @dev See {IERC721-getApproved}.
     */
    function getApproved(uint256 tokenId) public view virtual override returns (address) {
        require(isEditionExisting(uint256toUint64(tokenId)), "SparkLink: Approved query for nonexistent token");

        return _tokenApprovals[uint256toUint64(tokenId)];
    }

    /**
     * @dev See {IERC721-isApprovedForAll}.
     */
    function isApprovedForAll(address owner, address operator) public view virtual override returns (bool) {
        return _operatorApprovals[owner][operator];
    }

    /** 
     * @dev See {IERC721Metadata-tokenURI}.
     */
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(isEditionExisting(uint256toUint64(tokenId)), "SparkLink: URI query for nonexistent token");
        bytes32 _ipfs_hash = editions_by_id[uint256toUint64(tokenId)].ipfs_hash;
        string memory encoded_hash = _toBase58String(_ipfs_hash);
        string memory base = _baseURI();
        return string(abi.encodePacked(base, encoded_hash));
    }

  /**
     * @dev Query is issue free for first lever buyer.
     *
     * Requirements:
     * - `_NFT_id`: The id of the edition queryed.
     * Return a bool value.
     */
    function getIsFreeByNFTId(uint64 _NFT_id) public view returns (bool) {
        require(isEditionExisting(_NFT_id), "SparkLink: Edition is not exist.");
        return getBoolFromUint64(37, editions_by_id[getRootNFTIdByNFTId(_NFT_id)].father_id);
    }

    /**
     * @dev Query is issue follows the NC protocol by any NFT belongs to this issue.
     *
     * Requirements:
     * - `_NFT_id`: The id of the edition queryed.
     * Return a bool value.
     */
    function getIsNCByNFTId(uint64 _NFT_id) public view returns (bool) {
        require(isEditionExisting(_NFT_id), "SparkLink: Edition is not exist.");
        return getBoolFromUint64(38, editions_by_id[getRootNFTIdByNFTId(_NFT_id)].father_id);
    }

    /**
     * @dev Query is issue follows the ND protocol by any NFT belongs to this issue.
     *
     * Requirements:
     * - `_NFT_id`: The id of the edition queryed.
     * Return a bool value.
     */
    function getIsNDByNFTId(uint64 _NFT_id) public view returns (bool) {
        require(isEditionExisting(_NFT_id), "SparkLink: Edition is not exist.");
        return getBoolFromUint64(39, editions_by_id[getRootNFTIdByNFTId(_NFT_id)].father_id);
    }

    /**
     * @dev Query is edition exist.
     *
     * Requirements:
     * - `_NFT_id`: The id of the edition queryed.
     * Return a bool value.
     */
    function isEditionExisting(uint64 _NFT_id) public view returns (bool) {
        return (editions_by_id[_NFT_id].owner != address(0));
    }

    /**
     * @dev Query the amount of ETH a NFT can be claimed.
     *  
     * Requirements:
     * - `_NFT_id`: The id of the NFT queryed.
     * Return the value this NFT can be claimed.
     * If the NFT is not root NFT, this value will subtract royalty fee percent.
     */
    function getProfitByNFTId(uint64 _NFT_id) public view returns (uint128){
        require(isEditionExisting(_NFT_id), "SparkLink: Edition is not exist.");
        uint128 amount = editions_by_id[_NFT_id].profit;
         if (DAO_fee != 0) {
                uint128 DAO_amount = calculateFee(amount, DAO_fee);
                amount -= DAO_amount;
        }
        if (!isRootNFT(_NFT_id)) {
            uint128 _total_fee = calculateFee(amount, getRoyaltyFeeByNFTId(_NFT_id));            
            amount -= _total_fee;
        }
        return amount;
    }

    /**
     * @dev Query royalty fee percent of an issue by any NFT belongs to this issue.
     *  
     * Requirements:
     * - `_NFT_id`: The id of the NFT queryed.
     * Return royalty fee percent of this issue.
     */
    function getRoyaltyFeeByNFTId(uint64 _NFT_id) public view returns (uint8) {
        require(isEditionExisting(_NFT_id), "SparkLink: Edition is not exist.");
        return getUint8FromUint64(56, editions_by_id[getRootNFTIdByNFTId(_NFT_id)].father_id);
    }

    /**
     * @dev Query max shill times of an issue by any NFT belongs to this issue.
     *  
     * Requirements:
     * - `_NFT_id`: The id of the NFT queryed.
     * Return max shill times of this issue.
     */
    function getShillTimesByNFTId(uint64 _NFT_id) public view returns (uint16) {
        require(isEditionExisting(_NFT_id), "SparkLink: Edition is not exist.");
        return getUint16FromUint64(40, editions_by_id[getRootNFTIdByNFTId(_NFT_id)].father_id);
    }

    /**
     * @dev Query total NFT number of a issue by any NFT belongs to this issue.
     *  
     * Requirements:
     * - `_NFT_id`: The id of the NFT queryed.
     * Return total NFT number of this issue.
     */
    function getTotalAmountByNFTId(uint64 _NFT_id) public view returns (uint32) {
        require(isEditionExisting(_NFT_id), "SparkLink: Edition is not exist.");
        return getBottomUint32FromUint64(editions_by_id[getRootNFTIdByNFTId(_NFT_id)].father_id);
    }

    /**
     * @dev Query supported token address of a issue by any NFT belongs to this issue.
     *  
     * Requirements:
     * - `_NFT_id`: The id of the NFT queryed.
     * Return supported token address of this NFT.
     * Address 0 represent ETH.
     */
    function getTokenAddrByNFTId(uint64 _NFT_id) public view returns (address) {
        require(isEditionExisting(_NFT_id), "SparkLink: Edition is not exist.");
        return token_addresses[uint32(_NFT_id>>32)];
    }

    /**
     * @dev Query the id of this NFT's father NFT.
     *  
     * Requirements:
     * - `_NFT_id`: The id of the NFT queryed.
     * - This NFT should exist and not be root NFT.
     * Return the father NFT id of this NFT.
     */
    function getFatherByNFTId(uint64 _NFT_id) public view returns (uint64) {
        require(isEditionExisting(_NFT_id), "SparkLink: Edition is not exist.");
        if (isRootNFT(_NFT_id)) {
            return 0;
        }
        return editions_by_id[_NFT_id].father_id;
    }    
    
    /**
     * @dev Query transfer_price of this NFT.
     *  
     * Requirements:
     * - `_NFT_id`: The id of the NFT queryed.
     * Return transfer_price of this NFT.
     */
    function getTransferPriceByNFTId(uint64 _NFT_id) public view returns (uint128) {
        require(isEditionExisting(_NFT_id), "SparkLink: Edition is not exist.");
        return editions_by_id[_NFT_id].transfer_price;
    }

    /**
     * @dev Query shill_price of this NFT.
     *  
     * Requirements:
     * - `_NFT_id`: The id of the NFT queryed.
     * Return shill_price of this NFT.
     */
    function getShillPriceByNFTId(uint64 _NFT_id) public view returns (uint128) {
        require(isEditionExisting(_NFT_id), "SparkLink: Edition is not exist.");
        if (getIsFreeByNFTId(_NFT_id)&&isRootNFT(_NFT_id))
            return 0;
        else
            return editions_by_id[_NFT_id].shill_price;
    }

    /**
     * @dev Query remaining_shill_times of this NFT.
     *  
     * Requirements:
     * - `_NFT_id`: The id of the NFT queryed.
     * Return remaining_shill_times of this NFT.
     */
    function getRemainShillTimesByNFTId(uint64 _NFT_id) public view returns (uint16) {
        require(isEditionExisting(_NFT_id), "SparkLink: Edition is not exist.");
        return editions_by_id[_NFT_id].remaining_shill_times;
    }

    /**
     * @dev Query depth of this NFT.
     *  
     * Requirements:
     * - `_NFT_id`: The id of the NFT queryed.
     * Return depth of this NFT.
     */
    function getDepthByNFTId(uint64 _NFT_id) public view returns (uint64) {
        require(isEditionExisting(_NFT_id), "SparkLink: Edition is not exist.");
        uint64 depth = 0;
        for (depth = 0; !isRootNFT(_NFT_id); _NFT_id = getFatherByNFTId(_NFT_id)) {
            depth += 1;
        }
        return depth;
    }

    /**
     * @dev Query is this NFT is root NFT by check is its edition id is 1.
     *  
     * Requirements:
     * - `_NFT_id`: The id of the NFT queryed.
     * Return a bool value to indicate wether this NFT is root NFT.
     */
    function isRootNFT(uint64 _NFT_id) public pure returns (bool) {
        return getBottomUint32FromUint64(_NFT_id) == uint32(1);
    }

    /**
     * @dev Query root NFT id by NFT id.
     *  
     * Requirements:
     * - `_NFT_id`: The id of the NFT queryed.
     * Return a bool value to indicate wether this NFT is root NFT.
     */
    function getRootNFTIdByNFTId(uint64 _NFT_id) public pure returns (uint64) {
        return ((_NFT_id>>32)<<32 | uint64(1));
    }

    /**
     * @dev Query loss ratio of this contract.
     *  
     * Return loss ratio of this contract.
     */
    function getLossRatio() public view returns (uint8) {
        return loss_ratio;
    }
    
    /**
     * @dev Calculate edition id by NFT id.
     *  
     * Requirements:
     * - `_NFT_id`: The NFT id of the NFT caller want to get.
     * Return edition id.
     */
    function getEditionIdByNFTId(uint64 _NFT_id) public pure returns (uint32) {
        return getBottomUint32FromUint64(_NFT_id);
    }
    // Token name
    string private _name;

    // Token symbol
    string private _symbol;
    uint8 public loss_ratio = 62;
    uint8 public DAO_fee = 2;
    uint8 public constant MAX_DAO_FEE = 2;
    uint8 public constant MAX_LOSS_RATIO = 50;
    address public DAO_router01;
    address public DAO_router02;
    IUniswapV2Router02 public  uniswapV2Router;
    IUniswapV2Factory public  uniswapV2Factory;
    // Mapping owner address to token count
    mapping(address => uint64) private _balances;
    // Mapping from token ID to approved address
    mapping(uint64 => address) private _tokenApprovals;
    // Mapping from owner to operator approvals
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    mapping (uint64 => Edition) private editions_by_id;
    // mapping from issue ID to support ERC20 token address
    mapping(uint32 => address) private token_addresses;

    bytes constant private sha256MultiHash = hex"1220"; 
    bytes constant private ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

    function _swapTokensForEth(address token_addr, uint128 token_amount) private {
        // generate the uniswap pair path of token -> weth
        address[] memory path = new address[](2);
        path[0] = token_addr;
        path[1] = uniswapV2Router.WETH();

        IERC20(token_addr).approve(address(uniswapV2Router), token_amount);

        // make the swap
        uniswapV2Router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            token_amount,
            0, // accept any amount of ETH
            path,
            DAO_router01,
            block.timestamp
        );
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
    ) 
        private 
        returns (bool) 
    {
        if (to.isContract()) {
            try IERC721Receiver(to).onERC721Received(_msgSender(), from, tokenId, _data) returns (bytes4 retval) {
                return retval == IERC721Receiver.onERC721Received.selector;
            } catch (bytes memory reason) {
                if (reason.length == 0) {
                    revert("SparkLink: Transfer to non ERC721Receiver implementer");
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
     * @dev Sets `_tokenURI` as the tokenURI of `tokenId`.
     *
     * Requirements:
     *
     * - `tokenId` must exist.
     */
    function _setTokenURI(uint64 tokenId, bytes32 ipfs_hash) internal virtual {
        bytes32 old_URI = editions_by_id[tokenId].ipfs_hash;
        editions_by_id[tokenId].ipfs_hash = ipfs_hash;
        emit SetURI(tokenId, old_URI, ipfs_hash);
    }
    
     /**
     * @dev Internal function to invoke {IERC721Receiver-onERC721Received} on a target address.
     * The call is not executed if the target address is not a contract.
     *
     * @param _NFT_id NFT id of father NFT
     * @param _owner indicate the address new NFT transfer to
     * @return a uint64 store new NFT id
     **/
    function _mintNFT(
        uint64 _NFT_id,
        address _owner
    ) 
        internal 
        returns (uint64) 
    {
        _addTotalAmount(_NFT_id);
        uint32 new_edition_id = getTotalAmountByNFTId(_NFT_id);
        uint64 new_NFT_id = getNftIdByEditionIdAndIssueId(uint32(_NFT_id>>32), new_edition_id);
        require(
            _checkOnERC721Received(address(0), _owner, new_NFT_id, ""),
            "SparkLink: Transfer to non ERC721Receiver implementer"
        );
        Edition storage new_NFT = editions_by_id[new_NFT_id];
        new_NFT.remaining_shill_times = getShillTimesByNFTId(_NFT_id);
        new_NFT.father_id = _NFT_id;
        if (getIsFreeByNFTId(_NFT_id)&&isRootNFT(_NFT_id))
            new_NFT.shill_price = editions_by_id[_NFT_id].shill_price;
        else
            new_NFT.shill_price = calculateFee(editions_by_id[_NFT_id].shill_price, loss_ratio);
        if (new_NFT.shill_price == 0) {
            new_NFT.shill_price = editions_by_id[_NFT_id].shill_price;
        }
        new_NFT.owner = _owner;
        new_NFT.ipfs_hash = editions_by_id[_NFT_id].ipfs_hash;
        _balances[_owner] += 1;
        emit Transfer(address(0), _owner, new_NFT_id);
        return new_NFT_id;
    }

    /**
     * @dev Internal function to clear approve and transfer_price
     *
     * @param _NFT_id NFT id of father NFT
     **/
    function _afterTokenTransfer (uint64 _NFT_id) internal {
        // Clear approvals from the previous owner
        _approve(address(0), _NFT_id);
        editions_by_id[_NFT_id].transfer_price = 0;
    }

    /**
     * @dev Internal function to support transfer `tokenId` from `from` to `to`.
     *
     * @param from address representing the previous owner of the given token ID
     * @param to target address that will receive the tokens
     * @param tokenId uint256 ID of the token to be transferred
     * Emits a {Transfer} event.
     */
    function _transfer(
        address from,
        address to,
        uint64 tokenId
    ) 
        internal 
        virtual 
    {
        require(ownerOf(tokenId) == from, "SparkLink: Transfer of token that is not own");
        require(_isApprovedOrOwner(_msgSender(), tokenId), "SparkLink: Transfer caller is not owner nor approved");
        require(to != address(0), "SparkLink: Transfer to the zero address");
        if (msg.sender != ownerOf(tokenId)) {
            address token_addr = getTokenAddrByNFTId(tokenId);
            uint128 transfer_price = editions_by_id[tokenId].transfer_price;
            if (token_addr == address(0)){
                require(msg.value == transfer_price, "SparkLink: Price not met");
                _addProfit(tokenId, transfer_price);
            }
            else {
                uint256 before_balance = IERC20(token_addr).balanceOf(address(this));
                IERC20(token_addr).safeTransferFrom(msg.sender, address(this), transfer_price);
                _addProfit(tokenId, uint256toUint128(IERC20(token_addr).balanceOf(address(this))-before_balance));
            }
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
    ) 
        internal 
        virtual 
    {
        _transfer(from, to, tokenId);
        require(_checkOnERC721Received(from, to, tokenId, _data), "SparkLink: Transfer to non ERC721Receiver implementer");
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

    function _addProfit(uint64 _NFT_id, uint128 _increase) internal {
        editions_by_id[_NFT_id].profit = editions_by_id[_NFT_id].profit+_increase;
    }

    function _addTotalAmount(uint64 _NFT_Id) internal {
        require(getTotalAmountByNFTId(_NFT_Id) < type(uint32).max, "SparkLink: There is no left in this issue.");
        editions_by_id[getRootNFTIdByNFTId(_NFT_Id)].father_id += 1;
    }

    function _isApprovedOrOwner(address spender, uint64 tokenId) internal view virtual returns (bool) {
        require(isEditionExisting(tokenId), "SparkLink: Operator query for nonexistent token");
        address owner = ownerOf(tokenId);
        return (spender == owner || getApproved(tokenId) == spender || isApprovedForAll(owner, spender));
    }
        
    function _baseURI() internal pure returns (string memory) {
        return "https://ipfs.io/ipfs/";
    } 


    /**
     * @dev Calculate NFT id by issue id and edition id.
     *  
     * Requirements:
     * - `_issue_id`: The issue id of the NFT caller want to get.
     * - `_edition_id`: The edition id of the NFT caller want to get.
     * Return NFT id.
     */
    function getNftIdByEditionIdAndIssueId(uint32 _issue_id, uint32 _edition_id) internal pure returns (uint64) {
        return (uint64(_issue_id)<<32)|uint64(_edition_id);
    }

    function getBoolFromUint64(uint8 position, uint64 data64) internal pure returns (bool flag) {
        // (((1 << size) - 1) & base >> position)
        assembly {
            flag := and(1, shr(position, data64))
        }
    }

    function getUint8FromUint64(uint8 position, uint64 data64) internal pure returns (uint8 data8) {
        // (((1 << size) - 1) & base >> position)
        assembly {
            data8 := and(sub(shl(8, 1), 1), shr(position, data64))
        }
    }
    function getUint16FromUint64(uint8 position, uint64 data64) internal pure returns (uint16 data16) {
        // (((1 << size) - 1) & base >> position)
        assembly {
            data16 := and(sub(shl(16, 1), 1), shr(position, data64))
        }
    }
    function getBottomUint32FromUint64(uint64 data64) internal pure returns (uint32 data32) {
        // (((1 << size) - 1) & base >> position)
        assembly {
            data32 := and(sub(shl(32, 1), 1), data64)
        }
    }

    function reWriteBoolInUint64(uint8 position, bool flag, uint64 data64) internal pure returns (uint64 boxed) {
        assembly {
            // mask = ~((1 << 8 - 1) << position)
            // _box = (mask & _box) | ()data << position)
            boxed := or( and(data64, not(shl(position, 1))), shl(position, flag))
        }
    }

    
    function reWriteUint8InUint64(uint8 position, uint8 flag, uint64 data64) internal pure returns (uint64 boxed) {
        assembly {
            // mask = ~((1 << 8 - 1) << position)
            // _box = (mask & _box) | ()data << position)
            boxed := or(and(data64, not(shl(position, 1))), shl(position, flag))
        }
    }

    function reWriteUint16InUint64(uint8 position, uint16 data16, uint64 data64) internal pure returns (uint64 boxed) {
        assembly {
            // mask = ~((1 << 16 - 1) << position)
            // _box = (mask & _box) | ()data << position)
            boxed := or( and(data64, not(shl(position, sub(shl(16, 1), 1)))), shl(position, data16))
        }
    }

    function uint256toUint64(uint256 value) internal pure returns (uint64) {
        require(value <= type(uint64).max, "SparkLink: Value doesn't fit in 64 bits");
        return uint64(value);
    }

    function uint256toUint128(uint256 value) internal pure returns (uint128) {
        require(value <= type(uint128).max, "SparkLink: Value doesn't fit in 128 bits");
        return uint128(value);
    }
    
    function calculateFee(uint128 _amount, uint8 _fee_percent) internal pure returns (uint128) {
        return _amount*_fee_percent/10**2;
    }

    function _toBase58String(bytes32 con) internal pure returns (string memory) {
        
        bytes memory source = bytes.concat(sha256MultiHash,con);

        uint8[] memory digits = new uint8[](64); //TODO: figure out exactly how much is needed
        digits[0] = 0;
        uint8 digitlength = 1;
        for (uint256 i = 0; i<source.length; ++i) {
        uint carry = uint8(source[i]);
        for (uint256 j = 0; j<digitlength; ++j) {
            carry += uint(digits[j]) * 256;
            digits[j] = uint8(carry % 58);
            carry = carry / 58;
        }
        
        while (carry > 0) {
            digits[digitlength] = uint8(carry % 58);
            digitlength++;
            carry = carry / 58;
        }
        }
        //return digits;
        return string(toAlphabet(reverse(truncate(digits, digitlength))));
    }

    function toAlphabet(uint8[] memory indices) internal pure returns (bytes memory) {
        bytes memory output = new bytes(indices.length);
        for (uint256 i = 0; i<indices.length; i++) {
            output[i] = ALPHABET[indices[i]];
        }
        return output;
    }
    
    function truncate(uint8[] memory array, uint8 length) internal pure returns (uint8[] memory) {
        uint8[] memory output = new uint8[](length);
        for (uint256 i = 0; i<length; i++) {
            output[i] = array[i];
        }
        return output;
    }
  
    function reverse(uint8[] memory input) internal pure returns (uint8[] memory) {
        uint8[] memory output = new uint8[](input.length);
        for (uint256 i = 0; i<input.length; i++) {
            output[i] = input[input.length-1-i];
        }
        return output;
    }
}
