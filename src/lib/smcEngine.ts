export interface Candle {
  date: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  time?: number;
}

export interface Pivot {
  type: 'HIGH' | 'LOW';
  index: number;
  price: number;
  candle: Candle;
}

export interface Sweep {
  type: 'BSL' | 'SSL'; 
  pivotPrice: number;
  sweepCandle: Candle;
  sweepIndex: number;
  isBreakout: boolean; 
  sessionTime: 'PRE-MARKET' | 'NY_OPEN' | 'AFTER-HOURS';
}

export interface SMCResult {
  pivots: Pivot[];
  sweeps: Sweep[];
  hasChoCh: boolean;
  choChDirection: 'BULLISH' | 'BEARISH' | null;
  choChCandle: Candle | null;
  latestSweep: Sweep | null;
}

function getSessionTime(candle: Candle): 'PRE-MARKET' | 'NY_OPEN' | 'AFTER-HOURS' {
  // Deriv epoch is in seconds, standard dates are ISO strings.
  let timestampMs = 0;
  if (typeof candle.date === 'number') {
    // If it's a raw epoch integer
    timestampMs = candle.date > 9999999999 ? candle.date : candle.date * 1000;
  } else if (typeof candle.date === 'string') {
    timestampMs = new Date(candle.date).getTime();
  } else if (candle.time) {
    timestampMs = candle.time * 1000;
  } else {
    timestampMs = Date.now();
  }

  const date = new Date(timestampMs);
  const nyTimeStr = date.toLocaleString("en-US", { timeZone: "America/New_York" });
  const nyDate = new Date(nyTimeStr);
  const hours = nyDate.getHours();
  const minutes = nyDate.getMinutes();
  const currentMinutes = hours * 60 + minutes;

  // 8:30 AM = 510 mins, 11:00 AM = 660 mins
  if (currentMinutes < 510) return 'PRE-MARKET';
  if (currentMinutes >= 510 && currentMinutes <= 660) return 'NY_OPEN';
  return 'AFTER-HOURS';
}

export function analyzeSMC(candles: Candle[], length = 5): SMCResult {
  if (candles.length < length * 2 + 1) {
    return { pivots: [], sweeps: [], hasChoCh: false, choChDirection: null, choChCandle: null, latestSweep: null };
  }

  const pivots: Pivot[] = [];

  // 1. Swing Highs / Swing Lows (Liquidity Pools) - 5 candles left/right
  for (let i = length; i < candles.length - length; i++) {
    let isHigh = true;
    let isLow = true;

    for (let j = 1; j <= length; j++) {
      if (candles[i].high <= candles[i - j].high || candles[i].high <= candles[i + j].high) isHigh = false;
      if (candles[i].low >= candles[i - j].low || candles[i].low >= candles[i + j].low) isLow = false;
    }

    if (isHigh) pivots.push({ type: 'HIGH', index: i, price: candles[i].high, candle: candles[i] });
    if (isLow) pivots.push({ type: 'LOW', index: i, price: candles[i].low, candle: candles[i] });
  }

  // 2. Sweep vs Breakout Detection
  const sweeps: Sweep[] = [];
  
  for (let i = length * 2; i < candles.length; i++) {
    const c = candles[i];
    
    // Check backwards for nearest pivot swept
    for (let p = pivots.length - 1; p >= 0; p--) {
      const pivot = pivots[p];
      if (pivot.index >= i) continue;

      if (pivot.type === 'HIGH') {
        if (c.high > pivot.price) {
          const isBreakout = c.close > pivot.price; // Full body close above
          sweeps.push({ type: 'BSL', pivotPrice: pivot.price, sweepCandle: c, sweepIndex: i, isBreakout, sessionTime: getSessionTime(c) });
          break; 
        }
      } else if (pivot.type === 'LOW') {
        if (c.low < pivot.price) {
          const isBreakout = c.close < pivot.price; // Full body close below
          sweeps.push({ type: 'SSL', pivotPrice: pivot.price, sweepCandle: c, sweepIndex: i, isBreakout, sessionTime: getSessionTime(c) });
          break;
        }
      }
    }
  }

  // 3. ChoCh Detection (Restricted to 3-5 candles after a sweep)
  let hasChoCh = false;
  let choChDirection: 'BULLISH' | 'BEARISH' | null = null;
  let choChCandle: Candle | null = null;
  
  const latestSweep = sweeps.length > 0 ? sweeps[sweeps.length - 1] : null;

  if (latestSweep) {
    const sweepIndex = latestSweep.sweepIndex;
    
    // Find immediate opposite structural point PRIOR to the sweep.
    let oppositePivot: Pivot | null = null;
    for (let p = pivots.length - 1; p >= 0; p--) {
      const pivot = pivots[p];
      if (pivot.index < sweepIndex) {
        if (latestSweep.type === 'SSL' && pivot.type === 'HIGH') {
          oppositePivot = pivot;
          break;
        } else if (latestSweep.type === 'BSL' && pivot.type === 'LOW') {
          oppositePivot = pivot;
          break;
        }
      }
    }

    if (oppositePivot) {
      // Look forward max 5 candles after the sweep
      const limit = Math.min(candles.length, sweepIndex + 6);
      for (let i = sweepIndex + 1; i < limit; i++) {
        const c = candles[i];
        if (latestSweep.type === 'SSL') {
          if (c.close > oppositePivot.price) {
            hasChoCh = true;
            choChDirection = 'BULLISH';
            choChCandle = c;
            break;
          }
        } else if (latestSweep.type === 'BSL') {
          if (c.close < oppositePivot.price) {
            hasChoCh = true;
            choChDirection = 'BEARISH';
            choChCandle = c;
            break;
          }
        }
      }
    }
  }

  return { pivots, sweeps, hasChoCh, choChDirection, choChCandle, latestSweep };
}
