import { SMCResult } from './smcEngine';

export interface TradeSignal {
  isValid: boolean;
  signal: 'BUY' | 'SELL' | 'WAIT';
  stopLoss: number | null;
  takeProfit: number | null;
  riskReward: number | null;
  reason: string;
}

export function evaluateTradeSetup(
  smc: SMCResult,
  currentPrice: number
): TradeSignal {
  if (!smc.hasChoCh || !smc.choChDirection || !smc.latestSweep) {
    return { 
      isValid: false, 
      signal: 'WAIT', 
      stopLoss: null, 
      takeProfit: null, 
      riskReward: null, 
      reason: 'Awaiting ChoCh / Sweep' 
    };
  }

  const sweep = smc.latestSweep;
  
  // SL 2 pips above/below wick of the sweep.
  // Assuming 2.0 index points = 2 pips for NAS100
  const pipMultiplier = 2.0; 

  let stopLoss = 0;
  let takeProfit = 0;
  let signal: 'BUY' | 'SELL' = 'WAIT' as any;

  if (sweep.type === 'SSL' && smc.choChDirection === 'BULLISH') {
    signal = 'BUY';
    stopLoss = sweep.sweepCandle.low - pipMultiplier;
    
    // Find nearest BSL (Swing High) above current price
    const validTPs = smc.pivots.filter(p => p.type === 'HIGH' && p.price > currentPrice);
    if (validTPs.length === 0) {
      return { isValid: false, signal: 'WAIT', stopLoss: null, takeProfit: null, riskReward: null, reason: 'No BSL found for TP target' };
    }
    // Get closest BSL
    validTPs.sort((a, b) => a.price - b.price);
    takeProfit = validTPs[0].price;

  } else if (sweep.type === 'BSL' && smc.choChDirection === 'BEARISH') {
    signal = 'SELL';
    stopLoss = sweep.sweepCandle.high + pipMultiplier;
    
    // Find nearest SSL (Swing Low) below current price
    const validTPs = smc.pivots.filter(p => p.type === 'LOW' && p.price < currentPrice);
    if (validTPs.length === 0) {
      return { isValid: false, signal: 'WAIT', stopLoss: null, takeProfit: null, riskReward: null, reason: 'No SSL found for TP target' };
    }
    // Get closest SSL
    validTPs.sort((a, b) => b.price - a.price);
    takeProfit = validTPs[0].price;
  } else {
     return { isValid: false, signal: 'WAIT', stopLoss: null, takeProfit: null, riskReward: null, reason: 'Mismatched sweep and ChoCh direction' };
  }

  const risk = Math.abs(currentPrice - stopLoss);
  const reward = Math.abs(takeProfit - currentPrice);
  const riskReward = reward / (risk || 1); // Avoid division by zero

  if (riskReward < 2) {
    return { isValid: false, signal: 'WAIT', stopLoss, takeProfit, riskReward, reason: `RR too low: 1:${riskReward.toFixed(2)}` };
  }

  return { isValid: true, signal, stopLoss, takeProfit, riskReward, reason: 'Valid Setup - RR >= 1:2' };
}
