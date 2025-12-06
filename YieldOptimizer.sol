// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
}

interface ICompound {
    function mint(uint mintAmount) external returns (uint);
    function redeem(uint redeemTokens) external returns (uint);
}

contract YieldOptimizer is ReentrancyGuard {
    struct YieldStrategy {
        string name;
        address protocol;
        uint256 apy; // Annual Percentage Yield
        uint256 minDeposit;
        uint256 riskLevel; // 1-10
        bool active;
    }
    
    struct UserDeposit {
        address user;
        address token;
        uint256 amount;
        uint256 strategyId;
        uint256 depositedAt;
        uint256 estimatedYield;
    }
    
    address public constant UNISWAP_ROUTER = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
    address public constant COMPOUND_ETH = 0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5;
    
    YieldStrategy[] public strategies;
    mapping(address => UserDeposit[]) public userDeposits;
    mapping(address => uint256) public totalDeposits;
    
    event StrategyAdded(uint256 indexed id, string name, uint256 apy);
    event Deposited(address indexed user, uint256 strategyId, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount, uint256 yield);
    
    constructor() {
        // Initialize with popular strategies
        strategies.push(YieldStrategy({
            name: "Compound ETH",
            protocol: COMPOUND_ETH,
            apy: 350, // 3.5% in basis points
            minDeposit: 0.1 ether,
            riskLevel: 2,
            active: true
        }));
        
        strategies.push(YieldStrategy({
            name: "AAVE USDC",
            protocol: 0xBcca60bB61934080951369a648Fb03DF4F96263C,
            apy: 280,
            minDeposit: 100 * 10**6, // 100 USDC
            riskLevel: 3,
            active: true
        }));
    }
    
    function addStrategy(
        string memory _name,
        address _protocol,
        uint256 _apy,
        uint256 _minDeposit,
        uint256 _riskLevel
    ) external {
        strategies.push(YieldStrategy({
            name: _name,
            protocol: _protocol,
            apy: _apy,
            minDeposit: _minDeposit,
            riskLevel: _riskLevel,
            active: true
        }));
        
        emit StrategyAdded(strategies.length - 1, _name, _apy);
    }
    
    function deposit(uint256 _strategyId, address _token, uint256 _amount) external nonReentrant {
        require(_strategyId < strategies.length, "Invalid strategy");
        YieldStrategy storage strategy = strategies[_strategyId];
        require(strategy.active, "Strategy inactive");
        require(_amount >= strategy.minDeposit, "Below minimum");
        
        // Transfer tokens from user
        IERC20(_token).transferFrom(msg.sender, address(this), _amount);
        
        // Calculate estimated yield (simplified)
        uint256 estimatedYield = (_amount * strategy.apy * 365 days) / (10000 * 365 days);
        
        userDeposits[msg.sender].push(UserDeposit({
            user: msg.sender,
            token: _token,
            amount: _amount,
            strategyId: _strategyId,
            depositedAt: block.timestamp,
            estimatedYield: estimatedYield
        }));
        
        totalDeposits[msg.sender] += _amount;
        
        // In reality, you'd deposit to the actual protocol here
        // _depositToProtocol(strategy.protocol, _token, _amount);
        
        emit Deposited(msg.sender, _strategyId, _amount);
    }
    
    function withdraw(uint256 _depositId) external nonReentrant {
        require(_depositId < userDeposits[msg.sender].length, "Invalid deposit");
        UserDeposit storage depositInfo = userDeposits[msg.sender][_depositId];
        
        // Calculate actual yield based on time
        uint256 timeElapsed = block.timestamp - depositInfo.depositedAt;
        uint256 actualYield = (depositInfo.amount * strategies[depositInfo.strategyId].apy * timeElapsed) / 
                             (10000 * 365 days);
        
        uint256 totalToReturn = depositInfo.amount + actualYield;
        
        // Return tokens to user
        IERC20(depositInfo.token).transfer(msg.sender, totalToReturn);
        
        // Remove deposit
        _removeDeposit(msg.sender, _depositId);
        
        emit Withdrawn(msg.sender, depositInfo.amount, actualYield);
    }
    
    function getOptimalStrategy(uint256 _riskTolerance, uint256 _amount) external view returns (uint256) {
        uint256 bestStrategy = 0;
        uint256 bestScore = 0;
        
        for (uint256 i = 0; i < strategies.length; i++) {
            if (!strategies[i].active || strategies[i].minDeposit > _amount) continue;
            
            // Simplified scoring: APY * (10 - risk) / 10
            uint256 riskPenalty = 10 - (strategies[i].riskLevel > 10 ? 10 : strategies[i].riskLevel);
            uint256 score = (strategies[i].apy * riskPenalty) / 10;
            
            if (score > bestScore) {
                bestScore = score;
                bestStrategy = i;
            }
        }
        
        return bestStrategy;
    }
    
    function _removeDeposit(address _user, uint256 _index) internal {
        uint256 lastIndex = userDeposits[_user].length - 1;
        if (_index != lastIndex) {
            userDeposits[_user][_index] = userDeposits[_user][lastIndex];
        }
        userDeposits[_user].pop();
        totalDeposits[_user] -= userDeposits[_user][_index].amount;
    }
}
