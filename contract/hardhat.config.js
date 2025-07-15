require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("hardhat-contract-sizer"); // ✅ Make sure this is required

const { vars } = require("hardhat/config");

const ADMIN_WALLET_PRIVATE_KEY = vars.get("ADMIN_WALLET_PRIVATE_KEY");

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  contractSizer: {  
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
  },
  networks: {
    polygonAmoy: {
      url: "https://polygon-amoy.g.alchemy.com/v2/_ddIu3LPEPZW1eEzgh-uUVYs46y-S_Fk",
      chainId: 80002,
      accounts: [ADMIN_WALLET_PRIVATE_KEY],
      timeout: 200000,
      pollingInterval: 2000,
    },
    polygon: {
      url: `https://polygon-rpc.com`,
      chainId: 137,
      accounts: [ADMIN_WALLET_PRIVATE_KEY],
      timeout: 200000,
      pollingInterval: 2000,
    },
    baseSepolia: {
      url: `https://sepolia.base.org`,
      chainId: 84532,
      accounts: [ADMIN_WALLET_PRIVATE_KEY],
      timeout: 200000,
      pollingInterval: 2000,
    },
  },
  etherscan: {
    apiKey: {
      polygonAmoy: "WJT11EUF78WEQCSV83H7YTK4FDR5XMZHAD",
      baseSepolia: "7BS54JGNXDYJA5VEAMS5XN5QM63UE6Q185",
    },
    customChains: [
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org/"
        }
      }
    ]
  },
};
