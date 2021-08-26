.PHONY: build test prepare clean

prepare:
	yarn

build:
	yarn hardhat compile

test: build
	yarn hardhat test

clean:
	yarn hardhat clean
