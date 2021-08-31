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