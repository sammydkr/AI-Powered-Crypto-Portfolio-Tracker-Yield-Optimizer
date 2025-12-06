import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
import joblib
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)

class RiskAnalyzer:
    def __init__(self):
        # Load pre-trained model (trained on historical crypto data)
        try:
            self.model = joblib.load('risk_model.pkl')
            self.scaler = joblib.load('scaler.pkl')
        except:
            # Initialize with default weights if no model exists
            self.model = None
            self.scaler = None
        
        # Feature weights (simplified)
        self.feature_weights = {
            'volatility': 0.3,
            'market_cap': 0.2,
            'volume': 0.15,
            'correlation': 0.2,
            'liquidity': 0.15
        }
    
    def get_token_data(self, token_symbols):
        """Fetch real-time token data from CoinGecko"""
        token_data = {}
        
        for token in token_symbols:
            try:
                # Simplified - in reality, you'd fetch from multiple sources
                response = requests.get(
                    f'https://api.coingecko.com/api/v3/coins/{token}'
                )
                data = response.json()
                
                token_data[token] = {
                    'price': data['market_data']['current_price']['usd'],
                    'market_cap': data['market_data']['market_cap']['usd'],
                    'volume': data['market_data']['total_volume']['usd'],
                    'price_change_24h': data['market_data']['price_change_percentage_24h'],
                    'high_24h': data['market_data']['high_24h']['usd'],
                    'low_24h': data['market_data']['low_24h']['usd']
                }
            except Exception as e:
                print(f"Error fetching data for {token}: {e}")
                # Use default values
                token_data[token] = {
                    'price': 0,
                    'market_cap': 1000000,  # Default 1M
                    'volume': 100000,
                    'price_change_24h': 0,
                    'high_24h': 0,
                    'low_24h': 0
                }
        
        return token_data
    
    def calculate_volatility(self, prices, window=30):
        """Calculate historical volatility"""
        returns = np.diff(prices) / prices[:-1]
        return np.std(returns) * np.sqrt(365)  # Annualized
    
    def analyze_portfolio_risk(self, portfolio_tokens, risk_tolerance):
        """Analyze portfolio risk and suggest optimizations"""
        
        # Get token data
        token_data = self.get_token_data(portfolio_tokens)
        
        # Calculate risk metrics for each token
        risk_scores = {}
        allocations = {}
        
        total_market_cap = sum(data['market_cap'] for data in token_data.values())
        
        for token, data in token_data.items():
            # Calculate individual risk score (simplified)
            volatility_score = min(data['price_change_24h'] ** 2, 100)  # Simplified volatility
            market_cap_score = max(0, 100 - (data['market_cap'] / total_market_cap * 100))
            
            # Combined risk score (0-100, higher = riskier)
            risk_score = (
                volatility_score * self.feature_weights['volatility'] +
                market_cap_score * self.feature_weights['market_cap']
            )
            
            risk_scores[token] = min(100, max(1, risk_score))
            
            # Calculate suggested allocation based on risk tolerance
            # Lower allocation for riskier tokens if user is risk-averse
            if risk_tolerance < 5:  # Conservative
                allocation = (100 - risk_score) * 0.8
            elif risk_tolerance > 7:  # Aggressive
                allocation = risk_score * 0.6
            else:  # Moderate
                allocation = 50  # Equal weight
            
            allocations[token] = allocation
        
        # Normalize allocations to sum to 100%
        total_allocation = sum(allocations.values())
        if total_allocation > 0:
            allocations = {k: (v / total_allocation) * 100 for k, v in allocations.items()}
        
        # Calculate portfolio diversification score
        num_tokens = len(portfolio_tokens)
        diversification_score = min(100, num_tokens * 15)  # Up to 6-7 tokens is optimal
        
        # Overall portfolio risk
        weighted_risk = sum(
            risk_scores[token] * (allocations[token] / 100)
            for token in portfolio_tokens
        )
        
        return {
            'token_risks': risk_scores,
            'suggested_allocations': allocations,
            'portfolio_risk_score': weighted_risk,
            'diversification_score': diversification_score,
            'risk_assessment': self.get_risk_assessment(weighted_risk),
            'recommendations': self.generate_recommendations(
                weighted_risk, 
                risk_tolerance,
                portfolio_tokens
            )
        }
    
    def get_risk_assessment(self, risk_score):
        """Convert risk score to human-readable assessment"""
        if risk_score < 20:
            return "VERY_LOW"
        elif risk_score < 40:
            return "LOW"
        elif risk_score < 60:
            return "MODERATE"
        elif risk_score < 80:
            return "HIGH"
        else:
            return "VERY_HIGH"
    
    def generate_recommendations(self, risk_score, risk_tolerance, tokens):
        """Generate AI-powered investment recommendations"""
        recommendations = []
        
        if risk_score > 70 and risk_tolerance < 5:
            recommendations.append({
                'type': 'WARNING',
                'message': 'Portfolio too risky for your risk tolerance',
                'action': 'Consider reducing positions in high-volatility tokens'
            })
        
        if len(tokens) < 3:
            recommendations.append({
                'type': 'SUGGESTION',
                'message': 'Low diversification detected',
                'action': 'Add more tokens to reduce concentration risk'
            })
        
        # Yield optimization suggestions
        if risk_tolerance > 5:
            recommendations.append({
                'type': 'OPPORTUNITY',
                'message': 'Consider yield farming opportunities',
                'action': 'Check Yield Optimizer for suitable strategies'
            })
        
        return recommendations

# Initialize analyzer
analyzer = RiskAnalyzer()

@app.route('/analyze-risk', methods=['POST'])
def analyze_risk():
    data = request.json
    tokens = data.get('tokens', [])
    risk_tolerance = data.get('riskTolerance', 5)  # Default moderate
    
    if not tokens:
        return jsonify({'error': 'No tokens provided'}), 400
    
    analysis = analyzer.analyze_portfolio_risk(tokens, risk_tolerance)
    
    return jsonify({
        'success': True,
        'analysis': analysis
    })

@app.route('/train-model', methods=['POST'])
def train_model():
    """Endpoint to retrain the AI model with new data"""
    # This would fetch historical data and retrain the model
    # For now, return a placeholder
    return jsonify({
        'success': True,
        'message': 'Model training endpoint - would retrain with new data'
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
