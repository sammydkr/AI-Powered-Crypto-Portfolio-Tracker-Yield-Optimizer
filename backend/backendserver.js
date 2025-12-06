const express = require('express');
const Web3 = require('web3');
const { ethers } = require('ethers');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Web3 Configuration
const provider = new ethers.providers.InfuraProvider(
  'mainnet',
  process.env.INFURA_API_KEY
);

// Import Contract ABIs
const PortfolioTrackerABI = require('./abis/PortfolioTracker.json');
const YieldOptimizerABI = require('./abis/YieldOptimizer.json');

// Contract Addresses (deployed)
const CONTRACTS = {
  PORTFOLIO_TRACKER: '0x...', // Replace with deployed address
  YIELD_OPTIMIZER: '0x...'    // Replace with deployed address
};

// Initialize contracts
const portfolioContract = new ethers.Contract(
  CONTRACTS.PORTFOLIO_TRACKER,
  PortfolioTrackerABI,
  provider
);

const yieldContract = new ethers.Contract(
  CONTRACTS.YIELD_OPTIMIZER,
  YieldOptimizerABI,
  provider
);

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Get portfolio for user
app.get('/api/portfolio/:address', async (req, res) => {
  try {
    const portfolio = await portfolioContract.getPortfolio(req.params.address);
    res.json({
      success: true,
      data: {
        owner: portfolio.owner,
        name: portfolio.name,
        totalValueUSD: portfolio.totalValueUSD.toString(),
        riskScore: portfolio.riskScore.toString(),
        positions: portfolio.positions,
        created: new Date(portfolio.created * 1000).toISOString(),
        lastUpdated: new Date(portfolio.lastUpdated * 1000).toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get yield strategies
app.get('/api/strategies', async (req, res) => {
  try {
    const strategyCount = await yieldContract.strategyCount();
    const strategies = [];
    
    for (let i = 0; i < strategyCount; i++) {
      const strategy = await yieldContract.strategies(i);
      strategies.push({
        id: i,
        name: strategy.name,
        protocol: strategy.protocol,
        apy: strategy.apy.toString(),
        minDeposit: strategy.minDeposit.toString(),
        riskLevel: strategy.riskLevel.toString(),
        active: strategy.active
      });
    }
    
    res.json({ success: true, strategies });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get token prices
app.get('/api/prices/:tokens', async (req, res) => {
  try {
    const tokens = req.params.tokens.split(',');
    const prices = {};
    
    // Using CoinGecko API (simplified)
    for (const token of tokens) {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${token}&vs_currencies=usd`
      );
      const data = await response.json();
      prices[token] = data[token]?.usd || 0;
    }
    
    res.json({ success: true, prices });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Calculate optimal strategy
app.post('/api/optimize', async (req, res) => {
  try {
    const { riskTolerance, amount, tokens } = req.body;
    
    // Call AI risk analyzer (Python service)
    const aiResponse = await fetch('http://localhost:5000/analyze-risk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokens, riskTolerance })
    });
    
    const aiData = await aiResponse.json();
    
    // Get optimal strategy from contract
    const optimalStrategyId = await yieldContract.getOptimalStrategy(
      riskTolerance,
      ethers.utils.parseEther(amount.toString())
    );
    
    res.json({
      success: true,
      recommendedStrategy: optimalStrategyId.toString(),
      riskAnalysis: aiData.analysis,
      suggestedAllocation: aiData.allocation
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Transaction history
app.get('/api/transactions/:address', async (req, res) => {
  try {
    const transactions = await portfolioContract.getTransactions(
      req.params.address,
      50 // Last 50 transactions
    );
    
    res.json({
      success: true,
      transactions: transactions.map(tx => ({
        action: tx.action,
        token: tx.token,
        amount: tx.amount.toString(),
        timestamp: new Date(tx.timestamp * 1000).toISOString(),
        usdValue: tx.usdValue.toString()
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Blockfolio API running on port ${PORT}`);
});
