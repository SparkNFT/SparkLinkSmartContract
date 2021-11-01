import { task } from "hardhat/config";
import '@typechain/hardhat'
import '@nomiclabs/hardhat-ethers'
import "@nomiclabs/hardhat-waffle";
import "hardhat-gas-reporter";
import 'hardhat-deploy';
import 'hardhat-deploy-ethers';
import chain from "./chain";

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (_args, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
export default { 
    ...chain,
    solidity: {
        version: "0.8.4",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    } ,
    gasReporter: {
        currency: 'USD',
        gasPrice: '40',
    },
    typechain: {
        outDir: 'artifacts/typechain',
        target: 'ethers-v5',
    },
    external: {
        contracts: [
          {
            artifacts: 'node_modules/@uniswap/v2-core/build',
          },
          {
            artifacts: 'node_modules/@uniswap/v2-periphery/build',
          },
        ],
      },
};
