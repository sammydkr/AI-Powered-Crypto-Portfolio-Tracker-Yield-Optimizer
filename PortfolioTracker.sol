// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract PortfolioTracker is ReentrancyGuard, Ownable {
    struct Portfolio {
        address owner;
        string name;
        uint256 totalValueUSD;
        uint256 riskScore; // 1-100, lower = safer
        uint256 created;
        uint256 lastUpdated;
        TokenPosition[] positions;
    }
    
    struct TokenPosition {
        address tokenAddress;
        string symbol;
        uint256 amount;
        uint256 valueUSD;
        uint256 percentage;
    }
    
    struct Transaction {
        address user;
        string action; // "BUY", "SELL", "DEPOSIT", "WITHDRAW"
        address token;
        uint256 amount;
        uint256 timestamp;
        uint256 usdValue;
    }
    
    // Chainlink Price Feeds
    mapping(address => AggregatorV3Interface) public priceFeeds;
    mapping(address => Portfolio) public portfolios;
    mapping(address => Transaction[]) public userTransactions;
    
    uint256 public portfolioCount;
    address[] public supportedTokens;
    
    event PortfolioCreated(address indexed user, uint256 portfolioId, string name);
    event PositionAdded(address indexed user, address token, uint256 amount);
    event RiskScoreUpdated(address indexed user, uint256 newScore);
    
    constructor() Ownable(msg.sender) {
        // Initialize with major tokens
        supportedTokens.push(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2); // WETH
        supportedTokens.push(0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599); // WBTC
        supportedTokens.push(0xdAC17F958D2ee523a2206206994597C13D831ec7); // USDT
    }
    
    function createPortfolio(string memory _name) external {
        require(bytes(_name).length > 0, "Name required");
        require(portfolios[msg.sender].owner == address(0), "Portfolio exists");
        
        Portfolio storage newPortfolio = portfolios[msg.sender];
        newPortfolio.owner = msg.sender;
        newPortfolio.name = _name;
        newPortfolio.created = block.timestamp;
        newPortfolio.lastUpdated = block.timestamp;
        
        portfolioCount++;
        emit PortfolioCreated(msg.sender, portfolioCount, _name);
    }
    
    function addPosition(
        address _token,
        uint256 _amount,
        uint256 _priceUSD
    ) external nonReentrant {
        require(portfolios[msg.sender].owner == msg.sender, "No portfolio");
        require(_amount > 0, "Amount must be > 0");
        
        Portfolio storage portfolio = portfolios[msg.sender];
        
        // Add to positions
        portfolio.positions.push(TokenPosition({
            tokenAddress: _token,
            symbol: _getSymbol(_token),
            amount: _amount,
            valueUSD: _amount * _priceUSD / 1e18,
            percentage: 0 // Will calculate later
        }));
        
        // Update total value
        portfolio.totalValueUSD += _amount * _priceUSD / 1e18;
        portfolio.lastUpdated = block.timestamp;
        
        // Record transaction
        userTransactions[msg.sender].push(Transaction({
            user: msg.sender,
            action: "BUY",
            token: _token,
            amount: _amount,
            timestamp: block.timestamp,
            usdValue: _amount * _priceUSD / 1e18
        }));
        
        emit PositionAdded(msg.sender, _token, _amount);
    }
    
    function updateRiskScore(uint256 _score) external {
        require(_score >= 1 && _score <= 100, "Score 1-100");
        require(portfolios[msg.sender].owner == msg.sender, "No portfolio");
        
        portfolios[msg.sender].riskScore = _score;
        portfolios[msg.sender].lastUpdated = block.timestamp;
        
        emit RiskScoreUpdated(msg.sender, _score);
    }
    
    function getPortfolio(address _user) external view returns (
        address owner,
        string memory name,
        uint256 totalValueUSD,
        uint256 riskScore,
        TokenPosition[] memory positions,
        uint256 created,
        uint256 lastUpdated
    ) {
        Portfolio storage p = portfolios[_user];
        return (
            p.owner,
            p.name,
            p.totalValueUSD,
            p.riskScore,
            p.positions,
            p.created,
            p.lastUpdated
        );
    }
    
    function getTransactions(address _user, uint256 _limit) external view returns (Transaction[] memory) {
        uint256 length = userTransactions[_user].length;
        uint256 resultSize = _limit < length ? _limit : length;
        
        Transaction[] memory result = new Transaction[](resultSize);
        for (uint256 i = 0; i < resultSize; i++) {
            result[i] = userTransactions[_user][length - 1 - i];
        }
        return result;
    }
    
    function _getSymbol(address _token) internal pure returns (string memory) {
        // Simplified - in reality you'd call token's symbol() function
        if (_token == 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2) return "WETH";
        if (_token == 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599) return "WBTC";
        if (_token == 0xdAC17F958D2ee523a2206206994597C13D831ec7) return "USDT";
        return "UNKNOWN";
    }
}
