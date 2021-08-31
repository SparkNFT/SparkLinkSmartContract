# RoyaltyNFT & SparkNFT
黄教授您好，我们目前的开发进度是有关合约的开发已经完成，同时基于您的文章，我们产生了一些新的想法并开发了两个版本的合约。

## RoyaltyNFT:
主要功能板块有强制收取版税比例，控制最低版税金额，publish issue(一个系列的NFT)，设定支持的ERC20代币。
### 数据结构介绍:
- issue
对于一个系列的出版物，比如(破报第一期)，对应一个issue存储这些信息，包括：
1. issue_id 标识该issue的唯一序列号
2. royalty_fee 版税比例(百分比计数)
3. publisher 标记出版人的地址，用于版税回报
4. total_edition_amount 用于记录该系列出版的NFT总量
5. remain_edition_amount 用于记录该系列剩余能够出版的NFT数量
6. ipfs_hash 用于记录NFT的metadata的存储位置
7. name 该系列NFT的名字
8. base_royaltyfee [] 这个mapping用来存储基准版税，对应每一个ERC-20token有一个基准的版税值
8. first_sell_price [] 该mapping用来存储初次售卖NFT的价格，对应每一个ERC-20 token有一个价格



- edition
1. NFT_id 对应每一个NFT有一个唯一标识的index
2. transfer_price 用于二级市场进行交易的定价，初始化设置成0,由owner进行设定。
3. token_addr 记录该次交易使用的ERC20代币地址
4. is_on_sale 记录该NFT是否已经挂单准备交易


### 工作流程:
- IPFS存储：
publisher在出版之前会在前端将内容(形式不限于文字，pdf，图片，音乐，视频等)上传IPFS或者arweave上。
同时在这个阶段出版人可以限制上传内容是否加密，如果内容加密，那么在用户购入NFT时会获得该内容的解锁密钥。

- 出版:
在publisher上传内容至平台后会生成IPFS Hash用于存储该系列NFT的metadata。
接下来publisher使用合约进行出版，创建一个issue(一个issue包含多个NFT)传入参数包括:
所支持的多个ERC20代币的地址(数组，对应每个代币)
版税比例(百分比计数)
版税基准(当百分比计算小于版税基准时按照基准计算版税)(数组，对应每个代币)
issue名字
ipfs hash(此处为metadata存储的位置，除文件外还包含名字等信息)
初次发售价格(数组，对应每个代币)
发售的数量
- 初次mint
publish在出版时仅支付创建issue的gas消耗，初次发售由买方支付铸造NFT的费用。
在这个阶段，买方通过支付publisher设定的初始价格铸造NFT。
铸造出的NFT除了带有唯一标识符，URI(定位资源位置)外还带有用于交易的三个额外属性:
price，token_addr与is_on_sale
- 二级市场交易
在二级市场交易中，NFT的拥有者可以通过设置is_on_sale，设定NFT为等待出售的状态。
并且给出本次交易接受的ERC20代币的地址(token_addr)以及售卖定价。
接下来由买方竞价，整个过程脱离于NFT合约本身，合约仅暴露修改价格与买方付款的接口。
在竞价结束之后，NFT拥有者对买方进行授权，由买方转走NFT，合约在本交易中扣除所设定的金额，转给卖方，同时扣除版税转给该系列的publisher。
如果按比例计算版税得到的值小于基准版税，会按照基准版税扣除。

- 该版本目前存在的问题
1. 为了避免用户将price设置成0,进行私下交易，规避版税的问题，我们设置了版税基准，在按比例计算不足基准时，按照基准值强制扣税。但在这样的情况下，由于transferfrom在opensea上由opensea调取，而opensea是不会去支付合约扣除的这部分费用的，所以是无法在opensea上售卖的，而opensea的版税是以中心化的方式收取的。
2. 同时这个系列的NFT除了特定的publisher地址，其他用户是不支持赠送功能的，也就是赠送的时候依旧需要用户消耗版税基准金额的费用。
3. 并且存在由于要传入并记录多个ERC20token，gas费开销会增加一些。
4. 整体上来看，该版本的NFT是一个强publisher，弱holder的一个NFT，其中NFT拥有者主要目的是为了支持该NFT的继续运行与出版，用购买token的方式支持这个系列的存续。
## SparkNFT
在看过黄教授的文章之后，我们产生出了借助去中心化的读者替代中心化的出版社，通过他们代替出版社进行分发的想法。
当我看到一本很好的杂志时，比如说《破报》，这时我自然会产生分享给朋友的欲望，在这个过程中，《破报》多了一位读者，我的朋友通过我了解到了一部优秀的作品，但我本身其实并没有经济上的获利。
但这种分享行为其实可以被定义为一种劳动，而对于作品的传播是有益处的，通过区块链与NFT使我们能够去中心化地记录这样一个传播的链条，同时使价值以代币的形式流通在这个链条上。
由于我们想要通过每一个读者代替出版社传播作品，实际上某种程度上这个合约将作品的一部分拥有权让渡给了读者，使得每个读者能够在传播作品时获得收益。
主要区别是我们在NFT中加入了记录父节点的这样一个变量，使得合约能够存储NFT传播的记录。

### 数据结构介绍:
- issue

1. issue_id 标识该issue的唯一序列号
2. royalty_fee 版税比例(百分比计数)
3. shill_times 
4. total_amount 
6. ipfs_hash 用于记录NFT的metadata的存储位置
7. name 该系列NFT的名字
9. base_royaltyfee [] 这个mapping用来存储基准版税，对应每一个ERC-20token有一个基准的版税值
8. first_sell_price [] 该mapping用来存储初次售卖NFT的价格，对应每一个ERC-20 token有一个价格



- edition
1. NFT_id 对应每一个NFT有一个唯一标识的index
2. transfer_price 用于二级市场进行交易的定价，初始化设置成0,由owner进行设定。
3. token_addr 记录该次交易使用的ERC20代币地址
4. is_on_sale 记录该NFT是否已经挂单准备交易
工作流程：
- IPFS存储
这阶段同样是publisher上传作品，可以选择是否加密，如果想要降低成本就选择按照时间付费的IPFS，如果想要永久存储就arwearve。
- 出版：
publisher在出版时传入一下几个参数:
issue的名字
版税（按照百分比计数）（此处实际上是上一级NFT从下一级NFT的利润中抽取的比例）
shill_times 每一个NFT可以铸造的子NFT的最大数量
ipfs_hash(metadata_的存储位置)
- 初次铸造根节点NFT(自动)
publisher创建一个issue之后，自动生成这个issue的rootNFT，该NFT可以铸造shill_times次一级NFT，我们假设为10次。
- 铸造第二级NFT 
与其他NFT不同，在用户获得NFT之后，除了直接将该NFT挂出售卖外，还可以生成邀请链接分享给好友，好友进入链接之后可以通过该NFT铸造一个新的子NFT。
在该过程中，消耗父节点NFT的一次shill机会。
- 二级节点进行分享，由其他用户铸造三级NFT(此处可递推至第N级)
  同样的，铸造出的NFT也可以再次铸造属于他的字节点，铸造价格由issue传入时的价格决定，逐级递减，每次级衰减loss_ratio(暂定90%)。
- NFT交易转让
此部分逻辑与royaltyNFT接近，取消了ERC20支持与最低版税机制，使得场外交易可以进行，支持赠送同时可以使用opensea交易。
- 领取奖金池并抽税
royaltyfee，即版税并不是发生在交易转让，铸造新的NFT的阶段。
用户的所有收益会暂存在合约中，当用户领取收益时会剔除royaltyfee的部分，转移到父节点NFT的奖金池之中。

通过这样的方式，我们存储了一个树形结构在合约之中，并出让了部分的获利权限给读者，使得我们能够通过每个单体的读者代替出版社来进行内容的分发。
从而使得整个体系的获益最大化。
