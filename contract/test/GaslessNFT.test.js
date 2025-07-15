const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Gasless NFT Transaction Tests", function () {
  let forwarder, nft;
  let owner, user, relayer, recipient;
  let domain;

  beforeEach(async function () {
    [owner, user, relayer, recipient] = await ethers.getSigners();

    // Deploy MinimalForwarder
    const MinimalForwarder = await ethers.getContractFactory("MinimalForwarder");
    forwarder = await MinimalForwarder.deploy();
    await forwarder.waitForDeployment();

    // Deploy GaslessNFT
    const GaslessNFT = await ethers.getContractFactory("GaslessNFT");
    const baseURI = "https://api.example.com/nft/";
    nft = await GaslessNFT.deploy(await forwarder.getAddress(), baseURI);
    await nft.waitForDeployment();

    // Set up domain for EIP-712 signatures
    const forwarderAddress = await forwarder.getAddress();
    const chainId = await ethers.provider.getNetwork().then(n => n.chainId);
    
    domain = {
      name: "MinimalForwarder",
      version: "0.0.1",
      chainId: chainId,
      verifyingContract: forwarderAddress
    };
  });

  describe("Contract Deployment", function () {
    it("Should deploy contracts correctly", async function () {
      expect(await forwarder.getAddress()).to.not.equal(ethers.ZeroAddress);
      expect(await nft.getAddress()).to.not.equal(ethers.ZeroAddress);
    });

    it("Should set correct NFT name and symbol", async function () {
      expect(await nft.name()).to.equal("GaslessNFT");
      expect(await nft.symbol()).to.equal("GNFT");
    });
  });

  describe("Meta Transaction Functionality", function () {
    it("Should get correct nonce for user", async function () {
      const nonce = await forwarder.getNonce(user.address);
      expect(nonce).to.equal(0);
    });

    it("Should increment nonce after transaction", async function () {
      // Create a mint request
      const nonce = await forwarder.getNonce(user.address);
      const data = nft.interface.encodeFunctionData("mint", [user.address]);
      
      const request = {
        from: user.address,
        to: await nft.getAddress(),
        value: 0,
        gas: 500000,
        nonce: nonce,
        data: data
      };

      // Sign the request
      const types = {
        ForwardRequest: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "gas", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "data", type: "bytes" }
        ]
      };

      const signature = await user.signTypedData(domain, types, request);

      // Execute the meta transaction
      await forwarder.connect(relayer).execute(request, signature);

      // Check nonce incremented
      const newNonce = await forwarder.getNonce(user.address);
      expect(newNonce).to.equal(1);
    });
  });

  describe("Gasless NFT Operations", function () {
    let tokenId;

    beforeEach(async function () {
      // Mint an NFT to user for testing transfers and approvals
      await nft.connect(owner).mint(user.address);
      tokenId = 0; // First token
    });

    it("Should mint NFT via meta transaction", async function () {
      const initialBalance = await nft.balanceOf(recipient.address);
      
      // Create mint request
      const nonce = await forwarder.getNonce(user.address);
      const data = nft.interface.encodeFunctionData("mint", [recipient.address]);
      
      const request = {
        from: user.address,
        to: await nft.getAddress(),
        value: 0,
        gas: 500000,
        nonce: nonce,
        data: data
      };

      // Sign and execute
      const types = {
        ForwardRequest: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "gas", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "data", type: "bytes" }
        ]
      };

      const signature = await user.signTypedData(domain, types, request);
      await forwarder.connect(relayer).execute(request, signature);

      // Verify mint
      const newBalance = await nft.balanceOf(recipient.address);
      expect(newBalance).to.equal(initialBalance + 1n);
    });

    it("Should transfer NFT via gasless transaction", async function () {
      // Verify initial ownership
      expect(await nft.ownerOf(tokenId)).to.equal(user.address);
      
      // Create gasless transfer request
      const nonce = await forwarder.getNonce(user.address);
      const data = nft.interface.encodeFunctionData("gaslessTransfer", [recipient.address, tokenId]);
      
      const request = {
        from: user.address,
        to: await nft.getAddress(),
        value: 0,
        gas: 500000,
        nonce: nonce,
        data: data
      };

      // Sign and execute
      const types = {
        ForwardRequest: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "gas", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "data", type: "bytes" }
        ]
      };

      const signature = await user.signTypedData(domain, types, request);
      await forwarder.connect(relayer).execute(request, signature);

      // Verify transfer
      expect(await nft.ownerOf(tokenId)).to.equal(recipient.address);
    });

    it("Should approve NFT via gasless transaction", async function () {
      // Create gasless approve request
      const nonce = await forwarder.getNonce(user.address);
      const data = nft.interface.encodeFunctionData("gaslessApprove", [recipient.address, tokenId]);
      
      const request = {
        from: user.address,
        to: await nft.getAddress(),
        value: 0,
        gas: 500000,
        nonce: nonce,
        data: data
      };

      // Sign and execute
      const types = {
        ForwardRequest: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "gas", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "data", type: "bytes" }
        ]
      };

      const signature = await user.signTypedData(domain, types, request);
      await forwarder.connect(relayer).execute(request, signature);

      // Verify approval
      expect(await nft.getApproved(tokenId)).to.equal(recipient.address);
    });
  });

  describe("Security Tests", function () {
    it("Should reject invalid signatures", async function () {
      const nonce = await forwarder.getNonce(user.address);
      const data = nft.interface.encodeFunctionData("mint", [user.address]);
      
      const request = {
        from: user.address,
        to: await nft.getAddress(),
        value: 0,
        gas: 500000,
        nonce: nonce,
        data: data
      };

      // Sign with wrong signer
      const types = {
        ForwardRequest: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "gas", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "data", type: "bytes" }
        ]
      };

      const wrongSignature = await relayer.signTypedData(domain, types, request);

      // Should revert
      await expect(
        forwarder.connect(relayer).execute(request, wrongSignature)
      ).to.be.revertedWith("MinimalForwarder: signature does not match request");
    });

    it("Should reject replay attacks", async function () {
      const nonce = await forwarder.getNonce(user.address);
      const data = nft.interface.encodeFunctionData("mint", [user.address]);
      
      const request = {
        from: user.address,
        to: await nft.getAddress(),
        value: 0,
        gas: 500000,
        nonce: nonce,
        data: data
      };

      const types = {
        ForwardRequest: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "gas", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "data", type: "bytes" }
        ]
      };

      const signature = await user.signTypedData(domain, types, request);

      // Execute first time - should succeed
      await forwarder.connect(relayer).execute(request, signature);

      // Execute second time - should fail (replay attack)
      await expect(
        forwarder.connect(relayer).execute(request, signature)
      ).to.be.revertedWith("MinimalForwarder: signature does not match request");
    });

    it("Should only allow token owner to approve", async function () {
      // Mint NFT to user
      await nft.connect(owner).mint(user.address);
      const tokenId = 0;

      // Try to approve from non-owner via meta transaction
      const nonce = await forwarder.getNonce(relayer.address); // Using relayer instead of user
      const data = nft.interface.encodeFunctionData("gaslessApprove", [recipient.address, tokenId]);
      
      const request = {
        from: relayer.address, // Non-owner trying to approve
        to: await nft.getAddress(),
        value: 0,
        gas: 500000,
        nonce: nonce,
        data: data
      };

      const types = {
        ForwardRequest: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "gas", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "data", type: "bytes" }
        ]
      };

      const signature = await relayer.signTypedData(domain, types, request);

      // Should revert because relayer is not the owner
      await expect(
        forwarder.connect(relayer).execute(request, signature)
      ).to.be.revertedWith("GaslessNFT: approve caller is not owner nor approved");
    });
  });

  describe("Event Emissions", function () {
    it("Should emit NFTMinted event on mint", async function () {
      const nonce = await forwarder.getNonce(user.address);
      const data = nft.interface.encodeFunctionData("mint", [user.address]);
      
      const request = {
        from: user.address,
        to: await nft.getAddress(),
        value: 0,
        gas: 500000,
        nonce: nonce,
        data: data
      };

      const types = {
        ForwardRequest: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "gas", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "data", type: "bytes" }
        ]
      };

      const signature = await user.signTypedData(domain, types, request);
      
      await expect(forwarder.connect(relayer).execute(request, signature))
        .to.emit(nft, "NFTMinted")
        .withArgs(user.address, 0);
    });

    it("Should emit NFTTransferred event on transfer", async function () {
      // First mint an NFT
      await nft.connect(owner).mint(user.address);
      const tokenId = 0;

      // Then transfer it
      const nonce = await forwarder.getNonce(user.address);
      const data = nft.interface.encodeFunctionData("gaslessTransfer", [recipient.address, tokenId]);
      
      const request = {
        from: user.address,
        to: await nft.getAddress(),
        value: 0,
        gas: 500000,
        nonce: nonce,
        data: data
      };

      const types = {
        ForwardRequest: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "gas", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "data", type: "bytes" }
        ]
      };

      const signature = await user.signTypedData(domain, types, request);
      
      await expect(forwarder.connect(relayer).execute(request, signature))
        .to.emit(nft, "NFTTransferred")
        .withArgs(user.address, recipient.address, tokenId);
    });
  });
}); 