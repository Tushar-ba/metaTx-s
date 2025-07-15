import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import axios from 'axios';
import './App.css';

const BACKEND_URL = 'http://localhost:3001';

// Contract addresses - deployed on Base Sepolia
const CONTRACTS = {
  forwarder: '0xf6de091628282Af42Be7496e0200d8AbdF0ddbF7',
  nft: '0x4B0E0B810B06248EFF5b9617df3CbD73920a142d'
};

function App() {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [nftInfo, setNftInfo] = useState({ balance: '0', totalSupply: '0' });
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [tokenId, setTokenId] = useState('');
  const [approveAddress, setApproveAddress] = useState('');
  const [transactionDetails, setTransactionDetails] = useState(null);

  useEffect(() => {
    if (account) {
      fetchNFTInfo();
    }
  }, [account]);

  const connectWallet = async () => {
    try {
      if (typeof window.ethereum !== 'undefined') {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send('eth_requestAccounts', []);
        const signer = await provider.getSigner();
        
        setProvider(provider);
        setSigner(signer);
        setAccount(accounts[0]);
        
        console.log('Connected to wallet:', accounts[0]);
      } else {
        alert('Please install MetaMask!');
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setTxStatus('Error connecting wallet: ' + error.message);
    }
  };

  const fetchNFTInfo = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/nft/${account}`);
      setNftInfo(response.data);
    } catch (error) {
      console.error('Error fetching NFT info:', error);
    }
  };

  const checkTransactionDetails = async (txHash) => {
    try {
      const response = await axios.get(`${BACKEND_URL}/check-tx/${txHash}`);
      setTransactionDetails(response.data);
      console.log('Transaction details:', response.data);
    } catch (error) {
      console.error('Error checking transaction:', error);
    }
  };

  const signMetaTransaction = async (typedData) => {
    try {
      // Sign the typed data using MetaMask
      const signature = await signer.signTypedData(
        typedData.domain,
        { ForwardRequest: typedData.types.ForwardRequest },
        typedData.message
      );
      return signature;
    } catch (error) {
      console.error('Error signing meta transaction:', error);
      throw error;
    }
  };

  const executeMetaTransaction = async (request, signature) => {
    try {
      const response = await axios.post(`${BACKEND_URL}/relay`, {
        request,
        signature
      });
      return response.data;
    } catch (error) {
      console.error('Error executing meta transaction:', error);
      throw error;
    }
  };

  const mintNFT = async () => {
    if (!account) {
      alert('Please connect your wallet first');
      return;
    }

    setLoading(true);
    setTxStatus('Creating mint request...');

    try {
      // Create mint request
      const response = await axios.post(`${BACKEND_URL}/create-mint-request`, {
        from: account,
        to: account // Mint to self
      });

      const { request, typedData } = response.data;
      
      setTxStatus('Please sign the meta transaction in MetaMask...');
      
      // Sign the meta transaction
      const signature = await signMetaTransaction(typedData);
      
      setTxStatus('Executing gasless mint transaction...');
      
      // Execute the meta transaction
      const result = await executeMetaTransaction(request, signature);
      
      setTxStatus(`✅ NFT minted successfully! TX: ${result.txHash}`);
      
      // Check transaction details
      setTimeout(() => {
        checkTransactionDetails(result.txHash);
        fetchNFTInfo();
      }, 3000);
      
    } catch (error) {
      console.error('Error minting NFT:', error);
      setTxStatus('❌ Error minting NFT: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const transferNFT = async () => {
    if (!account || !recipientAddress || !tokenId) {
      alert('Please fill all transfer fields');
      return;
    }

    setLoading(true);
    setTxStatus('Creating transfer request...');

    try {
      // Create transfer request
      const response = await axios.post(`${BACKEND_URL}/create-transfer-request`, {
        from: account,
        to: recipientAddress,
        tokenId: tokenId
      });

      const { request, typedData } = response.data;
      
      setTxStatus('Please sign the meta transaction in MetaMask...');
      
      // Sign the meta transaction
      const signature = await signMetaTransaction(typedData);
      
      setTxStatus('Executing gasless transfer transaction...');
      
      // Execute the meta transaction
      const result = await executeMetaTransaction(request, signature);
      
      setTxStatus(`✅ NFT transferred successfully! TX: ${result.txHash}`);
      
      // Clear form and refresh info
      setRecipientAddress('');
      setTokenId('');
      setTimeout(fetchNFTInfo, 2000);
      
    } catch (error) {
      console.error('Error transferring NFT:', error);
      setTxStatus('❌ Error transferring NFT: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const approveNFT = async () => {
    if (!account || !approveAddress || !tokenId) {
      alert('Please fill all approval fields');
      return;
    }

    setLoading(true);
    setTxStatus('Creating approve request...');

    try {
      // Create approve request
      const response = await axios.post(`${BACKEND_URL}/create-approve-request`, {
        from: account,
        to: approveAddress,
        tokenId: tokenId
      });

      const { request, typedData } = response.data;
      
      setTxStatus('Please sign the meta transaction in MetaMask...');
      
      // Sign the meta transaction
      const signature = await signMetaTransaction(typedData);
      
      setTxStatus('Executing gasless approve transaction...');
      
      // Execute the meta transaction
      const result = await executeMetaTransaction(request, signature);
      
      setTxStatus(`✅ NFT approved successfully! TX: ${result.txHash}`);
      
      // Clear form
      setApproveAddress('');
      
    } catch (error) {
      console.error('Error approving NFT:', error);
      setTxStatus('❌ Error approving NFT: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🚀 Gasless NFT Demo</h1>
        <p>Experience meta transactions with ERC-2771</p>
      </header>

      <main className="main-content">
        {!account ? (
          <div className="connect-section">
            <h2>Connect Your Wallet</h2>
            <button onClick={connectWallet} className="connect-btn">
              Connect MetaMask
            </button>
          </div>
        ) : (
          <div className="connected-section">
            <div className="account-info">
              <h3>Connected Account</h3>
              <p className="account-address">{account}</p>
              <div className="nft-stats">
                <p>NFTs Owned: {nftInfo.balance}</p>
                <p>Total Supply: {nftInfo.totalSupply}</p>
              </div>
            </div>

            <div className="actions-grid">
              <div className="action-card">
                <h3>🎨 Mint NFT</h3>
                <p>Mint an NFT to your address without paying gas!</p>
                <button 
                  onClick={mintNFT} 
                  disabled={loading}
                  className="action-btn mint-btn"
                >
                  {loading ? 'Processing...' : 'Mint NFT (Gasless)'}
                </button>
              </div>

              <div className="action-card">
                <h3>📤 Transfer NFT</h3>
                <input
                  type="text"
                  placeholder="Recipient Address"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  className="input-field"
                />
                <input
                  type="number"
                  placeholder="Token ID"
                  value={tokenId}
                  onChange={(e) => setTokenId(e.target.value)}
                  className="input-field"
                />
                <button 
                  onClick={transferNFT} 
                  disabled={loading || !recipientAddress || !tokenId}
                  className="action-btn transfer-btn"
                >
                  {loading ? 'Processing...' : 'Transfer NFT (Gasless)'}
                </button>
              </div>

              <div className="action-card">
                <h3>✅ Approve NFT</h3>
                <p>Approve another address to transfer your NFT</p>
                <input
                  type="text"
                  placeholder="Approve Address"
                  value={approveAddress}
                  onChange={(e) => setApproveAddress(e.target.value)}
                  className="input-field"
                />
                <input
                  type="number"
                  placeholder="Token ID"
                  value={tokenId}
                  onChange={(e) => setTokenId(e.target.value)}
                  className="input-field"
                />
                <button 
                  onClick={approveNFT} 
                  disabled={loading || !approveAddress || !tokenId}
                  className="action-btn approve-btn"
                >
                  {loading ? 'Processing...' : 'Approve NFT (Gasless)'}
                </button>
              </div>
            </div>

            {txStatus && (
              <div className="status-section">
                <h3>Transaction Status</h3>
                <p className="status-message">{txStatus}</p>
              </div>
            )}

            {transactionDetails && (
              <div className="transaction-details">
                <h3>🔍 Transaction Analysis</h3>
                <div className="details-grid">
                  <div className="detail-item">
                    <strong>Transaction Hash:</strong> 
                    <code>{transactionDetails.txHash}</code>
                  </div>
                  <div className="detail-item">
                    <strong>Block Number:</strong> {transactionDetails.blockNumber}
                  </div>
                  <div className="detail-item">
                    <strong>Status:</strong> {transactionDetails.status === 1 ? '✅ Success' : '❌ Failed'}
                  </div>
                  <div className="detail-item">
                    <strong>Gas Used:</strong> {transactionDetails.gasUsed}
                  </div>
                </div>
                
                {transactionDetails.events && transactionDetails.events.length > 0 && (
                  <div className="events-section">
                    <h4>📜 Events Emitted:</h4>
                    {transactionDetails.events.map((event, index) => (
                      <div key={index} className="event-item">
                        <strong>{event.contract} Contract:</strong> 
                        {event.event && <span> {event.event}</span>}
                        {event.args && (
                          <div className="event-args">
                            Args: {JSON.stringify(event.args, null, 2)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="explanation">
                  <p><strong>💡 Understanding the Flow:</strong></p>
                  <ol>
                    <li>Your signature is sent to the <strong>Forwarder contract</strong></li>
                    <li>Forwarder verifies your signature and calls the <strong>NFT contract</strong></li>
                    <li>The NFT is minted on the <strong>NFT contract</strong> (this appears as an internal transaction)</li>
                    <li>Both contracts may emit events during this process</li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="footer">
        <div className="info-card">
          <h3>How it works</h3>
          <ol>
            <li>🔗 Connect your MetaMask wallet</li>
            <li>✍️ Sign a meta transaction (no gas required)</li>
            <li>🚀 Backend relayer pays the gas and executes the transaction</li>
            <li>✅ Transaction completes without spending your ETH!</li>
          </ol>
        </div>
        
        <div className="contract-info">
          <h4>Contract Addresses (Base Sepolia)</h4>
          <p><strong>Forwarder:</strong> {CONTRACTS.forwarder}</p>
          <p><strong>NFT:</strong> {CONTRACTS.nft}</p>
          <p><em>🔗 Deployed and ready to use!</em></p>
        </div>
      </footer>
    </div>
  );
}

export default App;