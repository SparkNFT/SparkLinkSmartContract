.PHONY: build test prepare

prepare:
	yarn

build:
	yarn hardhat compile

test: build
	yarn hardhat test
