import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';
import PortfolioDashboard from './components/PortfolioDashboard';
import YieldOptimizer from './components/YieldOptimizer';
import RiskAnalyzer from './components/RiskAnalyzer';
import TokenSelector from './components/TokenSelector';

// Contract ABIs (simplified imports)
import PortfolioTrackerABI from './abis/PortfolioTracker.json';
import YieldOptimizerABI from './abis/YieldOptimizer.json';

const CONTRACT_ADDRESSES = {
  portfolioTracker: '0x...', // Replace with deployed
  yieldOptimizer: '0x...'     // Replace with deployed
};

function App() {
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [account, setAccount] = useState<string>('');
  const [portfolioContract, setPortfolioContract] = useState<ethers.Contract | null>(null);
  const [yieldContract, setYieldContract] = useState<ethers.Contract | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'yield' | 'risk'>('dashboard');

  // Initialize Web3
  const initWeb3 = async () => {
    if (window.ethereum) {
      try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
        const web3Signer = web3Provider.getSigner();
        const userAccount = await web3Signer.getAddress();

        setProvider(web3Provider);
        setSigner(web3Signer);
        setAccount(userAccount);

        // Initialize contracts
        const portfolio = new ethers.Contract(
          CONTRACT_ADDRESSES.portfolioTracker,
          PortfolioTrackerABI,
          web3Signer
        );

        const yieldOpt = new ethers.Contract(
          CONTRACT_ADDRESSES.yieldOptimizer,
          YieldOptimizerABI,
          web3Signer
        );

        setPortfolioContract(portfolio);
        setYieldContract(yieldOpt);

      } catch (error) {
        console.error('Error connecting to MetaMask:', error);
      }
    } else {
      alert('Please install MetaMask!');
    }
  };

  useEffect(() => {
    initWeb3();
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>🤖 Blockfolio AI</h1>
        <p>AI-Powered Crypto Portfolio Management</p>
        
        {account && (
          <div className="wallet-info">
            <span>Connected: {account.substring(0, 6)}...{account.substring(account.length - 4)}</span>
          </div>
        )}
        
        <nav className="tabs">
          <button 
            className={activeTab === 'dashboard' ? 'active' : ''}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 Portfolio
          </button>
          <button 
            className={activeTab === 'yield' ? 'active' : ''}
            onClick={() => setActiveTab('yield')}
          >
            💰 Yield Optimizer
          </button>
          <button 
            className={activeTab === 'risk' ? 'active' : ''}
            onClick={() => setActiveTab('risk')}
          >
            🛡️ Risk Analyzer
          </button>
        </nav>
      </header>

      <main className="App-main">
        {!provider ? (
          <div className="connect-wallet">
            <h2>Connect Your Wallet</h2>
            <button onClick={initWeb3} className="connect-button">
              Connect MetaMask
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && portfolioContract && (
              <PortfolioDashboard 
                contract={portfolioContract}
                account={account}
                provider={provider}
              />
            )}
            
            {activeTab === 'yield' && yieldContract && (
              <YieldOptimizer 
                contract={yieldContract}
                account={account}
              />
            )}
            
            {activeTab === 'risk' && (
              <RiskAnalyzer 
                account={account}
                portfolioContract={portfolioContract}
              />
            )}
          </>
        )}
      </main>

      <footer className="App-footer">
        <p>Blockfolio AI • Secure • Transparent • AI-Optimized</p>
        <p className="disclaimer">
          ⚠️ This is a demo project. Crypto investments are risky.
        </p>
      </footer>
    </div>
  );
}

export default App;
