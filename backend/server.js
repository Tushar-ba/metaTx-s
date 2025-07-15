const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors("*"));
app.use(express.json());

// Contract ABIs - In production, these should be imported from files
const FORWARDER_ABI = [
  "function getNonce(address from) public view returns (uint256)",
  "function verify((address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data) req, bytes signature) public view returns (bool)",
  "function execute((address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data) req, bytes signature) public payable returns (bool, bytes memory)"
];

const NFT_ABI = [
  "function mint(address to) public returns (uint256)",
  "function gaslessTransfer(address to, uint256 tokenId) public",
  "function gaslessApprove(address to, uint256 tokenId) public",
  "function ownerOf(uint256 tokenId) public view returns (address)",
  "function getApproved(uint256 tokenId) public view returns (address)",
  "function balanceOf(address owner) public view returns (uint256)",
  "function totalSupply() public view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)",
  "event NFTMinted(address indexed to, uint256 indexed tokenId)",
  "event NFTTransferred(address indexed from, address indexed to, uint256 indexed tokenId)"
];

// Configuration - These should be set via environment variables
const config = {
  rpcUrl: process.env.RPC_URL || 'http://localhost:8545',
  privateKey: process.env.RELAYER_PRIVATE_KEY,
  forwarderAddress: process.env.FORWARDER_ADDRESS,
  nftAddress: process.env.NFT_ADDRESS,
  chainId: parseInt(process.env.CHAIN_ID) || 31337
};

// Initialize provider and signer
let provider, signer, forwarderContract, nftContract;

try {
  provider = new ethers.JsonRpcProvider(config.rpcUrl);
  if (config.privateKey) {
    signer = new ethers.Wallet(config.privateKey, provider);
  }
  
  if (config.forwarderAddress && signer) {
    forwarderContract = new ethers.Contract(config.forwarderAddress, FORWARDER_ABI, signer);
  }
  
  if (config.nftAddress && signer) {
    nftContract = new ethers.Contract(config.nftAddress, NFT_ABI, signer);
  }
} catch (error) {
  console.error('Error initializing contracts:', error.message);
}

// Helper function to create typed data for EIP-712 signature
function createTypedData(chainId, verifyingContract, message) {
  return {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' }
      ],
      ForwardRequest: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'gas', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'data', type: 'bytes' }
      ]
    },
    domain: {
      name: 'MinimalForwarder',
      version: '0.0.1',
      chainId: chainId,
      verifyingContract: verifyingContract
    },
    primaryType: 'ForwardRequest',
    message: message
  };
}

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    contracts: {
      forwarder: config.forwarderAddress,
      nft: config.nftAddress
    }
  });
});

// Get user's nonce
app.get('/nonce/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!forwarderContract) {
      return res.status(500).json({ error: 'Forwarder contract not initialized' });
    }

    const nonce = await forwarderContract.getNonce(address);
    res.json({ nonce: nonce.toString() });
  } catch (error) {
    console.error('Error getting nonce:', error);
    res.status(500).json({ error: 'Failed to get nonce', details: error.message });
  }
});

// Get NFT info
app.get('/nft/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!nftContract) {
      return res.status(500).json({ error: 'NFT contract not initialized' });
    }

    const balance = await nftContract.balanceOf(address);
    const totalSupply = await nftContract.totalSupply();
    
    res.json({ 
      balance: balance.toString(), 
      totalSupply: totalSupply.toString() 
    });
  } catch (error) {
    console.error('Error getting NFT info:', error);
    res.status(500).json({ error: 'Failed to get NFT info', details: error.message });
  }
});

// Check transaction details
app.get('/check-tx/:txHash', async (req, res) => {
  try {
    const { txHash } = req.params;
    
    if (!provider) {
      return res.status(500).json({ error: 'Provider not initialized' });
    }

    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    console.log('🔍 Checking transaction:', txHash);
    
    const response = {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      status: receipt.status,
      gasUsed: receipt.gasUsed.toString(),
      events: []
    };

    // Parse events
    receipt.logs.forEach((log, index) => {
      try {
        if (log.address.toLowerCase() === config.nftAddress.toLowerCase()) {
          const parsedLog = nftContract.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog) {
            response.events.push({
              index,
              contract: 'NFT',
              event: parsedLog.name,
              args: parsedLog.args
            });
            console.log(`  📧 NFT Event ${index}: ${parsedLog.name}`, parsedLog.args);
          } else {
            response.events.push({
              index,
              contract: 'NFT',
              event: 'Unknown Event',
              address: log.address,
              topics: log.topics
            });
            console.log(`  📧 NFT Event ${index}: Unknown signature from ${log.address}`);
          }
        } else if (log.address.toLowerCase() === config.forwarderAddress.toLowerCase()) {
          response.events.push({
            index,
            contract: 'Forwarder',
            event: 'Unknown',
            address: log.address
          });
          console.log(`  📧 Forwarder Event ${index} at ${log.address}`);
        } else {
          response.events.push({
            index,
            contract: 'Other',
            address: log.address
          });
          console.log(`  📧 Other Event ${index} from ${log.address}`);
        }
      } catch (e) {
        response.events.push({
          index,
          contract: 'Unparseable',
          address: log.address,
          error: e.message,
          topics: log.topics,
          data: log.data
        });
        console.log(`  ❌ Unparseable event ${index} from ${log.address}:`, e.message);
        console.log(`    Topics:`, log.topics);
      }
    });

    res.json(response);
  } catch (error) {
    console.error('Error checking transaction:', error);
    res.status(500).json({ error: 'Failed to check transaction', details: error.message });
  }
});

// Execute meta transaction
app.post('/relay', async (req, res) => {
  try {
    const { request, signature } = req.body;
    
    if (!forwarderContract) {
      return res.status(500).json({ error: 'Forwarder contract not initialized' });
    }

    // Verify the request format
    const requiredFields = ['from', 'to', 'value', 'gas', 'nonce', 'data'];
    for (const field of requiredFields) {
      if (request[field] === undefined) {
        return res.status(400).json({ error: `Missing required field: ${field}` });
      }
    }

    // Verify the signature
    const isValid = await forwarderContract.verify(request, signature);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    console.log('Executing meta transaction:', {
      from: request.from,
      to: request.to,
      gas: request.gas,
      data: request.data
    });

    // Log more details about what function is being called
    if (request.to === config.nftAddress) {
      try {
        const decodedData = nftContract.interface.parseTransaction({ data: request.data });
        console.log('🎨 NFT Function being called:', decodedData.name, 'with args:', decodedData.args);
      } catch (e) {
        console.log('Could not decode function data:', request.data);
      }
    }

    // Execute the meta transaction
    const tx = await forwarderContract.execute(request, signature);
    console.log('📡 Meta transaction submitted:', tx.hash);
    
    const receipt = await tx.wait();
    console.log('✅ Meta transaction confirmed:', {
      hash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      status: receipt.status
    });

    // Log all events from the transaction
    console.log('📜 Transaction events:');
    receipt.logs.forEach((log, index) => {
      try {
        if (log.address.toLowerCase() === config.nftAddress.toLowerCase()) {
          const parsedLog = nftContract.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          if (parsedLog) {
            console.log(`  ${index}: NFT Event - ${parsedLog.name}:`, parsedLog.args);
          } else {
            console.log(`  ${index}: NFT Event (unknown signature) from ${log.address}`);
            console.log(`    Topics:`, log.topics);
          }
        } else if (log.address.toLowerCase() === config.forwarderAddress.toLowerCase()) {
          console.log(`  ${index}: Forwarder Event at block ${receipt.blockNumber}`);
        } else {
          console.log(`  ${index}: Other Event from ${log.address}`);
        }
      } catch (e) {
        console.log(`  ${index}: Unparseable event from ${log.address}:`, e.message);
        console.log(`    Topics:`, log.topics);
        console.log(`    Data:`, log.data);
      }
    });

    res.json({
      success: true,
      txHash: receipt.hash,
      gasUsed: receipt.gasUsed.toString(),
      blockNumber: receipt.blockNumber,
      nftContractAddress: config.nftAddress,
      forwarderContractAddress: config.forwarderAddress
    });
  } catch (error) {
    console.error('❌ Error executing meta transaction:', error);
    res.status(500).json({ 
      error: 'Failed to execute meta transaction', 
      details: error.message 
    });
  }
});

// Create meta transaction request for minting
app.post('/create-mint-request', async (req, res) => {
  try {
    const { from, to } = req.body;
    
    if (!from || !to) {
      return res.status(400).json({ error: 'Missing from or to address' });
    }

    if (!forwarderContract || !nftContract) {
      return res.status(500).json({ error: 'Contracts not initialized' });
    }

    // Get nonce
    const nonce = await forwarderContract.getNonce(from);
    
    // Encode the mint function call
    const data = nftContract.interface.encodeFunctionData('mint', [to]);
    
    const request = {
      from: from,
      to: config.nftAddress,
      value: '0',
      gas: '500000', // Estimate gas
      nonce: nonce.toString(),
      data: data
    };

    // Create typed data for signing
    const typedData = createTypedData(config.chainId, config.forwarderAddress, request);

    res.json({ request, typedData });
  } catch (error) {
    console.error('Error creating mint request:', error);
    res.status(500).json({ 
      error: 'Failed to create mint request', 
      details: error.message 
    });
  }
});

// Create meta transaction request for transfer
app.post('/create-transfer-request', async (req, res) => {
  try {
    const { from, to, tokenId } = req.body;
    
    if (!from || !to || tokenId === undefined) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    if (!forwarderContract || !nftContract) {
      return res.status(500).json({ error: 'Contracts not initialized' });
    }

    // Get nonce
    const nonce = await forwarderContract.getNonce(from);
    
    // Encode the gasless transfer function call
    const data = nftContract.interface.encodeFunctionData('gaslessTransfer', [to, tokenId]);
    
    const request = {
      from: from,
      to: config.nftAddress,
      value: '0',
      gas: '500000', // Estimate gas
      nonce: nonce.toString(),
      data: data
    };

    // Create typed data for signing
    const typedData = createTypedData(config.chainId, config.forwarderAddress, request);

    res.json({ request, typedData });
  } catch (error) {
    console.error('Error creating transfer request:', error);
    res.status(500).json({ 
      error: 'Failed to create transfer request', 
      details: error.message 
    });
  }
});

// Create meta transaction request for approval
app.post('/create-approve-request', async (req, res) => {
  try {
    const { from, to, tokenId } = req.body;
    
    if (!from || !to || tokenId === undefined) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    if (!forwarderContract || !nftContract) {
      return res.status(500).json({ error: 'Contracts not initialized' });
    }

    // Get nonce
    const nonce = await forwarderContract.getNonce(from);
    
    // Encode the gasless approve function call
    const data = nftContract.interface.encodeFunctionData('gaslessApprove', [to, tokenId]);
    
    const request = {
      from: from,
      to: config.nftAddress,
      value: '0',
      gas: '500000', // Estimate gas
      nonce: nonce.toString(),
      data: data
    };

    // Create typed data for signing
    const typedData = createTypedData(config.chainId, config.forwarderAddress, request);

    res.json({ request, typedData });
  } catch (error) {
    console.error('Error creating approve request:', error);
    res.status(500).json({ 
      error: 'Failed to create approve request', 
      details: error.message 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Gasless backend server running on port ${PORT}`);
  console.log('Configuration:');
  console.log('- RPC URL:', config.rpcUrl);
  console.log('- Chain ID:', config.chainId);
  console.log('- Forwarder Address:', config.forwarderAddress);
  console.log('- NFT Address:', config.nftAddress);
  console.log('- Relayer Address:', signer ? signer.address : 'Not configured');
}); 