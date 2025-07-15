const { ethers, upgrades } = require("hardhat");

async function main() {
  const trustedForwarder = "0xd04f98c88ce1054c90022ee34d566b9237a1203c"; // Replace with your forwarder address
  const NFTMetaTx = await ethers.getContractFactory("NFTMetaTx");

  console.log("Deploying NFTMetaTx...");
  const nftMetaTx = await upgrades.deployProxy(
    NFTMetaTx,
    [], // No arguments for initialize function
    {
      initializer: "initialize",
      constructorArgs: [trustedForwarder], // Pass trustedForwarder to constructor
      kind: "uups",
    }
  );

  await nftMetaTx.waitForDeployment();
  console.log("NFTMetaTx deployed to:", await nftMetaTx.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});