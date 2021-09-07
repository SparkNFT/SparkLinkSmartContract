# SparkNFT Smart Contract API

## Contract ABI interface

List of functions (follow the link to the comment):

- [publish](./../contracts/SparkNFT.sol)
- [acceptShill]()
- [claimProfit]()
- [determinePrice]()
- [determinePriceAndApprove]()


Besides, `SparkNFT Smart Contract` is also a special ERC-721 NFT (attached a tree data structure).

- Therefore, it supports NFT-721 interfaces, like `ownerOf`, `balanceOf`.
- Since it is special, the behavior of `mint` is very different from common ERC-721 NFT.
  There are two methods to mint a new NFT.
  When publisher `publish` an issue (represent an series of NFTs), contract will generate a root NFT and transfer it to him.
  Then other buyer can using `acceptShill` with a NFT ID mint a NFT which is a child NFT of the NFT ID it used.
  In the second progress, buyer need pay for this NFT's price to the owner of the NFT ID he inputs.
  And when some one mint NFT from new this NFT, the owner of its father NFT will get part of amount it sells. 
- There are some slight differences at the behavior of `token transfer` function.
  This token is integrated a price mechanism, if token's price is determined by owner, `transfer` function will check if the value of this transaction is equal price. 

## `Edition` data structure
- 
## `Issue` data structure(abstract)
- To reduce gas costs due to storage, we storage 

## Function Briefing

### 1. publish

Publisher can call this function to create an issue (e.g a book) which contains several NFT with same or similar content.
The publisher need to provide four elements: first sell price, royalty fee percent, shill times and IPFS hash.

**`function publish(uint128 _first_sell_price, uint8 _royalty_fee, uint8 _shill_times, bytes32 _ipfs_hash)`**

- Parameters:
  - `_first_sell_price`:  