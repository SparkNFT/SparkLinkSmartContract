.PHONY: build test

prepare:
	yarn

build:
	yarn hardhat compile

test:
	yarn hardhat test
