const { ethers } = require("hardhat");

async function main() {
  console.log("Starting deployment of gasless transaction contracts...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Deploy MinimalForwarder first
  console.log("\nDeploying MinimalForwarder...");
  const MinimalForwarder = await ethers.getContractFactory("MinimalForwarder");
  const forwarder = await MinimalForwarder.deploy();
  await forwarder.waitForDeployment();
  
  const forwarderAddress = await forwarder.getAddress();
  console.log("MinimalForwarder deployed to:", forwarderAddress);

  // Deploy GaslessNFT with deployer as trusted forwarder
  console.log("\nDeploying GaslessNFT...");
  const baseURI = "https://api.example.com/nft/";
  const GaslessNFT = await ethers.getContractFactory("GaslessNFT");
  
  // Option 1: Use deployer as trusted forwarder (uncomment next line)
  // const nft = await GaslessNFT.deploy(deployer.address, baseURI);
  
  // Option 2: Use MinimalForwarder as trusted forwarder (current default)
  const nft = await GaslessNFT.deploy(forwarderAddress, baseURI);
  
  await nft.waitForDeployment();
  
  const nftAddress = await nft.getAddress();
  console.log("GaslessNFT deployed to:", nftAddress);

  // Save deployment addresses to a file
  const deploymentInfo = {
    network: await ethers.provider.getNetwork(),
    deployer: deployer.address,
    contracts: {
      MinimalForwarder: forwarderAddress,
      GaslessNFT: nftAddress
    },
    timestamp: new Date().toISOString()
  };

  const fs = require('fs');
  fs.writeFileSync(
    './deployment-addresses.json', 
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\n=== Deployment Summary ===");
  console.log("Network:", deploymentInfo.network.name);
  console.log("MinimalForwarder:", forwarderAddress);
  console.log("GaslessNFT:", nftAddress);
  console.log("Deployment info saved to deployment-addresses.json");

  // Verify contracts (optional, comment out if not needed)
  if (process.env.ETHERSCAN_API_KEY) {
    console.log("\nVerifying contracts...");
    try {
      await hre.run("verify:verify", {
        address: forwarderAddress,
        constructorArguments: [],
      });

      await hre.run("verify:verify", {
        address: nftAddress,
        constructorArguments: [forwarderAddress, baseURI],
      });
      console.log("Contracts verified successfully!");
    } catch (error) {
      console.log("Verification failed:", error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 