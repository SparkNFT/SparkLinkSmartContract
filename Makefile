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

flatten:
	yarn hardhat flatten > publish.sol