// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
// import {}

const hre = require("hardhat");
async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');
  const network_name = String(hre.network.name);
  console.log(network_name);
  let swapRouterAddress: String;
  let swapFactoryAddress: String;
  let DAORouterAddress01: String;
  let DAORouterAddress02: String;
  const pancakeSwapFactory = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
  const pancakeSwapRouter02 = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
  const quickSwapFactory = "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32";
  const quickSwapRouter02 = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";
  const uniSwapFactory = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
  const uniSwapRouter02 = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
  const DAO_Router_01 = "0x5245841D384C48EA47F16da587b31D23e194cb4a";
  const DAO_Router_02 = "0x63c8D73CedD89a42CbA911f890FDcA94648b7bAF";
  DAORouterAddress01 = DAO_Router_01;
  DAORouterAddress02 = DAO_Router_02;
  if (network_name == "BSC")
  {
    swapRouterAddress = pancakeSwapRouter02;
    swapFactoryAddress  = pancakeSwapFactory;
  }
  else if (network_name == "matic")
  {
    swapRouterAddress = quickSwapRouter02;
    swapFactoryAddress = quickSwapFactory;
  }
  else if (network_name == "ETH")
  {
    swapRouterAddress = uniSwapRouter02;
    swapFactoryAddress = uniSwapFactory;
  }
  else{
    return;
  }
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());
  console.log("SwapRouterAddress: " + swapRouterAddress);
  console.log("SwapFactoryAddress: " + swapFactoryAddress);
  // We get the contract to deploy
  const SparkLink = await ethers.getContractFactory("SparkLink");
  const sparkLink = await SparkLink.deploy(DAORouterAddress01, DAORouterAddress02,swapRouterAddress, swapFactoryAddress);

  await sparkLink.deployed();

  console.log("SparkLink deployed to:", sparkLink.address);
}
// module.exports = main()
// // We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
