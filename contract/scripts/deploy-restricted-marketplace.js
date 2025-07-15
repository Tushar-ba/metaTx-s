const { ethers, upgrades } = require("hardhat");

async function main() {
    console.log("🚀 Deploying Restricted Gasless Marketplace System...");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    // Define the relayer address (can be different from deployer)
    const RELAYER_ADDRESS = deployer.address; // Change this to your relayer address
    
    console.log("Relayer address:", RELAYER_ADDRESS);

    // 1. Deploy the Restricted Forwarder
    console.log("\n📡 Deploying RestrictedMarketplaceForwarder...");
    const RestrictedMarketplaceForwarder = await ethers.getContractFactory("RestrictedMarketplaceForwarder");
    const forwarder = await upgrades.deployProxy(
        RestrictedMarketplaceForwarder,
        [
            "RestrictedMarketplaceForwarder", // EIP-712 domain name
            deployer.address,                 // Owner
            RELAYER_ADDRESS                   // Initial authorized relayer
        ],
        { 
            initializer: 'initialize',
            kind: 'uups'
        }
    );
    await forwarder.waitForDeployment();
    const forwarderAddress = await forwarder.getAddress();
    console.log("✅ RestrictedMarketplaceForwarder deployed to:", forwarderAddress);

    // Verify relayer was set correctly
    const isAuthorized = await forwarder.isAuthorizedRelayer(RELAYER_ADDRESS);
    console.log("✅ Relayer authorization status:", isAuthorized);

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

    // 3. Add additional relayers if needed
    console.log("\n👥 Managing Relayers...");
    
    // Example: Add additional relayer addresses
    const ADDITIONAL_RELAYERS = [
        // "0x1234567890123456789012345678901234567890", // Add more relayer addresses here
    ];

    for (const relayerAddr of ADDITIONAL_RELAYERS) {
        try {
            const tx = await forwarder.addRelayer(relayerAddr);
            await tx.wait();
            console.log("✅ Added additional relayer:", relayerAddr);
        } catch (error) {
            console.log("⚠️ Failed to add relayer:", relayerAddr, error.message);
        }
    }

    // 4. Setup payment tokens
    console.log("\n💰 Setting up payment tokens...");
    
    // ETH is already supported by default
    // Add USDC example (update address for your network)
    const USDC_ADDRESS = "0xA0b86a33E6441b50bf5eE77FF10b5e7C3F4B4e3A"; // Example
    try {
        const tx = await marketplace.addPaymentToken(USDC_ADDRESS);
        await tx.wait();
        console.log("✅ Added USDC as payment token");
    } catch (error) {
        console.log("⚠️ USDC address may not exist on this network");
    }

    // 5. Verification and testing
    console.log("\n🔍 Verifying Setup...");
    
    // Check if marketplace trusts the forwarder
    const isTrusted = await marketplace.isTrustedForwarder(forwarderAddress);
    console.log("✅ Marketplace trusts forwarder:", isTrusted);
    
    // Check relayer info
    const relayerInfo = await forwarder.getRelayerInfo(RELAYER_ADDRESS);
    console.log("✅ Relayer info:", {
        isAuthorized: relayerInfo.isAuthorized,
        owner: relayerInfo.owner,
        nonce: relayerInfo.nonce.toString()
    });

    // 6. Deployment Summary
    console.log("\n📋 Deployment Summary:");
    console.log("=".repeat(60));
    console.log("Network:", (await ethers.provider.getNetwork()).name);
    console.log("Chain ID:", (await ethers.provider.getNetwork()).chainId);
    console.log("Deployer:", deployer.address);
    console.log("Authorized Relayer:", RELAYER_ADDRESS);
    console.log("RestrictedMarketplaceForwarder:", forwarderAddress);
    console.log("GaslessMarketplace:", marketplaceAddress);
    console.log("Marketplace Fee:", "2.5%");
    console.log("Fee Recipient:", deployer.address);

    // 7. Backend Configuration
    console.log("\n⚙️ Backend Configuration:");
    console.log("Add these to your .env file:");
    console.log(`FORWARDER_ADDRESS=${forwarderAddress}`);
    console.log(`MARKETPLACE_ADDRESS=${marketplaceAddress}`);
    console.log(`RELAYER_PRIVATE_KEY=<your_relayer_private_key>`);
    console.log(`CHAIN_ID=${(await ethers.provider.getNetwork()).chainId}`);

    // 8. Save deployment info
    const deploymentInfo = {
        network: (await ethers.provider.getNetwork()).name,
        chainId: Number((await ethers.provider.getNetwork()).chainId),
        deployer: deployer.address,
        relayer: RELAYER_ADDRESS,
        contracts: {
            RestrictedMarketplaceForwarder: forwarderAddress,
            GaslessMarketplace: marketplaceAddress
        },
        config: {
            marketplaceFee: 250,
            feeRecipient: deployer.address,
            authorizedRelayers: [RELAYER_ADDRESS, ...ADDITIONAL_RELAYERS]
        },
        verification: {
            marketplaceTrustsForwarder: isTrusted,
            relayerAuthorized: relayerInfo.isAuthorized
        },
        timestamp: new Date().toISOString()
    };

    const fs = require('fs');
    fs.writeFileSync(
        'restricted-marketplace-deployment.json', 
        JSON.stringify(deploymentInfo, null, 2)
    );
    console.log("💾 Deployment info saved to restricted-marketplace-deployment.json");

    console.log("\n🎉 Deployment completed successfully!");
    console.log("\n📝 Next steps:");
    console.log("1. Update your backend .env with the new addresses");
    console.log("2. Fund your relayer account with ETH for gas");
    console.log("3. Update frontend with new contract addresses");
    console.log("4. Test gasless listing functionality");
    console.log("5. Verify contracts on block explorer");
    
    // 9. Relayer management instructions
    console.log("\n👥 Relayer Management:");
    console.log("- Add relayer: forwarder.addRelayer(address)");
    console.log("- Remove relayer: forwarder.removeRelayer(address)");
    console.log("- Check authorization: forwarder.isAuthorizedRelayer(address)");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    }); 