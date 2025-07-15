const { ethers, upgrades } = require("hardhat");

async function main() {
    console.log("🚀 Deploying Gasless Marketplace System...");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    // 1. Deploy the Forwarder
    console.log("\n📡 Deploying MarketplaceForwarder...");
    const MarketplaceForwarder = await ethers.getContractFactory("MarketplaceForwarder");
    const forwarder = await upgrades.deployProxy(
        MarketplaceForwarder,
        [
            "MarketplaceForwarder", // EIP-712 domain name
            deployer.address        // Owner
        ],
        { 
            initializer: 'initialize',
            kind: 'uups' // Use UUPS proxy pattern
        }
    );
    await forwarder.waitForDeployment();
    const forwarderAddress = await forwarder.getAddress();
    console.log("✅ MarketplaceForwarder deployed to:", forwarderAddress);

    // 2. Deploy the Marketplace
    console.log("\n🏪 Deploying GaslessMarketplace...");
    const GaslessMarketplace = await ethers.getContractFactory("GaslessMarketplace");
    const marketplace = await upgrades.deployProxy(
        GaslessMarketplace,
        [
            forwarderAddress,     // Trusted forwarder
            deployer.address,     // Owner
            deployer.address,     // Fee recipient
            250                   // 2.5% marketplace fee
        ],
        { 
            initializer: 'initialize',
            kind: 'uups'
        }
    );
    await marketplace.waitForDeployment();
    const marketplaceAddress = await marketplace.getAddress();
    console.log("✅ GaslessMarketplace deployed to:", marketplaceAddress);

    // 3. Add supported payment tokens
    console.log("\n💰 Setting up payment tokens...");
    
    // Add USDC (example address - update for your network)
    const USDC_ADDRESS = "0xA0b86a33E6441b50bf5eE77FF10b5e7C3F4B4e3A"; // Example
    try {
        const tx = await marketplace.addPaymentToken(USDC_ADDRESS);
        await tx.wait();
        console.log("✅ Added USDC as payment token");
    } catch (error) {
        console.log("⚠️ USDC address may not exist on this network");
    }

    // 4. Verification info
    console.log("\n📋 Deployment Summary:");
    console.log("=".repeat(50));
    console.log("Network:", await ethers.provider.getNetwork());
    console.log("Deployer:", deployer.address);
    console.log("MarketplaceForwarder:", forwarderAddress);
    console.log("GaslessMarketplace:", marketplaceAddress);
    console.log("Marketplace Fee:", "2.5%");
    console.log("Fee Recipient:", deployer.address);

    // 5. Save deployment info
    const deploymentInfo = {
        network: (await ethers.provider.getNetwork()).name,
        chainId: (await ethers.provider.getNetwork()).chainId,
        deployer: deployer.address,
        contracts: {
            MarketplaceForwarder: forwarderAddress,
            GaslessMarketplace: marketplaceAddress
        },
        config: {
            marketplaceFee: 250,
            feeRecipient: deployer.address
        },
        timestamp: new Date().toISOString()
    };

    // Write to file
    const fs = require('fs');
    fs.writeFileSync(
        'marketplace-deployment.json', 
        JSON.stringify(deploymentInfo, null, 2)
    );
    console.log("💾 Deployment info saved to marketplace-deployment.json");

    console.log("\n🎉 Deployment completed successfully!");
    console.log("\n📝 Next steps:");
    console.log("1. Verify contracts on block explorer");
    console.log("2. Update frontend with new contract addresses");
    console.log("3. Test gasless listing functionality");
    console.log("4. Test purchase functionality");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    }); 