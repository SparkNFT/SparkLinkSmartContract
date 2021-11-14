.PHONY: build test prepare clean

prepare:
	yarn
	if [ ! -f chain.ts ]; then cp chain.sample.ts chain.ts; fi;

build:
	yarn hardhat compile

test: build
	yarn hardhat test

clean:
	yarn hardhat clean

check:
	yarn hardhat check

rinkeby:
	yarn hardhat run scripts/deploy.ts --network rinkeby

matic:
	yarn hardhat run scripts/deploy.ts --network matic

BSC:
	yarn hardhat run scripts/deploy.ts --network BSC

ETH:
	yarn hardhat run scripts/deploy.ts --network ETH

hh:
	yarn hardhat run scripts/deploy.ts 
flatten:
	yarn hardhat flatten ./contracts/SparkLink.sol > publish.sol