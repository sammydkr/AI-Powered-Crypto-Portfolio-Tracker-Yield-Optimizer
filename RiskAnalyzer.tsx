import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

interface RiskAnalyzerProps {
  account: string;
  portfolioContract: ethers.Contract | null;
}

interface TokenRisk {
  token: string;
  riskScore: number;
  suggestedAllocation: number;
  currentAllocation: number;
}

const RiskAnalyzer: React.FC<RiskAnalyzerProps> = ({ account, portfolioContract }) => {
  const [riskScore, setRiskScore] = useState<number>(0);
  const [tokenRisks, setTokenRisks] = useState<TokenRisk[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  const analyzePortfolio = async () => {
    if (!portfolioContract || !account) return;
    
    setIsAnalyzing(true);
    
    try {
      // Fetch portfolio data
      const portfolio = await portfolioContract.getPortfolio(account);
      const positions = portfolio.positions;
      
      // Extract tokens
      const tokens = positions.map((p: any) => p.symbol);
      
      // Call AI backend for risk analysis
      const response = await fetch('http://localhost:5000/analyze-risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokens,
          riskTolerance: 5 // Default moderate
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        const analysis = data.analysis;
        setRiskScore(analysis.portfolio_risk_score);
        
        // Map token risks
        const risks: TokenRisk[] = [];
        for (const [token, risk] of Object.entries(analysis.token_risks)) {
          const allocation = analysis.suggested_allocations[token] || 0;
          
          // Find current allocation
          const position = positions.find((p: any) => p.symbol === token);
          const currentAlloc = position ? position.percentage : 0;
          
          risks.push({
            token,
            riskScore: risk as number,
            suggestedAllocation: allocation,
            currentAllocation: currentAlloc
          });
        }
        
        setTokenRisks(risks);
        setRecommendations(analysis.recommendations.map((r: any) => r.message));
      }
    } catch (error) {
      console.error('Risk analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (portfolioContract && account) {
      analyzePortfolio();
    }
  }, [portfolioContract, account]);

  const getRiskColor = (score: number) => {
    if (score < 30) return '#10B981'; // Green
    if (score < 60) return '#F59E0B'; // Yellow
    return '#EF4444'; // Red
  };

  return (
    <div className="risk-analyzer">
      <h2>🛡️ AI Risk Analysis</h2>
      
      {isAnalyzing ? (
        <div className="loading">Analyzing portfolio risk...</div>
      ) : (
        <>
          <div className="risk-score-card">
            <h3>Portfolio Risk Score</h3>
            <div 
              className="risk-circle"
              style={{ borderColor: getRiskColor(riskScore) }}
            >
              <span style={{ color: getRiskColor(riskScore) }}>
                {riskScore.toFixed(1)}
              </span>
            </div>
            <p className="risk-assessment">
              {riskScore < 30 ? 'Low Risk' : 
               riskScore < 60 ? 'Moderate Risk' : 'High Risk'}
            </p>
          </div>

          <div className="token-risks">
            <h3>Token-by-Token Analysis</h3>
            <table>
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Risk Score</th>
                  <th>Current %</th>
                  <th>Suggested %</th>
                </tr>
              </thead>
              <tbody>
                {tokenRisks.map((tokenRisk, index) => (
                  <tr key={index}>
                    <td>{tokenRisk.token}</td>
                    <td>
                      <span style={{ color: getRiskColor(tokenRisk.riskScore) }}>
                        {tokenRisk.riskScore.toFixed(1)}
                      </span>
                    </td>
                    <td>{tokenRisk.currentAllocation.toFixed(1)}%</td>
                    <td>{tokenRisk.suggestedAllocation.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {recommendations.length > 0 && (
            <div className="recommendations">
              <h3>🤖 AI Recommendations</h3>
              <ul>
                {recommendations.map((rec, index) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </div>
          )}

          <button onClick={analyzePortfolio} className="analyze-button">
            🔄 Re-analyze Portfolio
          </button>
        </>
      )}
    </div>
  );
};

export default RiskAnalyzer;
