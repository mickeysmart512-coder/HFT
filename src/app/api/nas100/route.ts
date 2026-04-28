import { NextResponse } from 'next/server';
import WebSocket from 'ws';

export const dynamic = 'force-dynamic';

// Simple in-memory cache for fallback
let candleCache: Record<string, any[]> = {};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawInterval = searchParams.get('interval') || '5m';
    
    // Map standard intervals to Deriv granularity (seconds)
    const granularityMap: Record<string, number> = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
    };
    
    const granularity = granularityMap[rawInterval] || 300;
    const symbol = 'OTC_NDX'; // LOCKED: Correct symbol for Derived NAS100

    // Fetch from Deriv WebSocket with retry logic
    let candles: any[] | undefined;
    const cacheKey = `${symbol}_${granularity}`;

    try {
      candles = await fetchCandlesFromDeriv(symbol, granularity) as any[];
    } catch (err1) {
      console.warn(`First fetch attempt failed for ${symbol}, retrying...`);
      try {
        candles = await fetchCandlesFromDeriv(symbol, granularity) as any[];
      } catch (err2) {
        console.error(`Second fetch attempt failed for ${symbol}. Attempting fallback...`);
        if (candleCache[cacheKey] && candleCache[cacheKey].length > 0) {
          candles = candleCache[cacheKey];
        } else {
          throw new Error('DATA TIMEOUT');
        }
      }
    }

    if (!candles || candles.length === 0) {
      throw new Error(`No candles returned for ${symbol}`);
    }

    // Update Cache
    candleCache[cacheKey] = candles;

    // Map Deriv format to our format
    // Deriv: { epoch, open, high, low, close }
    const mappedCandles = candles.map(c => ({
      date: c.epoch, // epoch is UNIX timestamp in seconds
      open: parseFloat(c.open),
      high: parseFloat(c.high),
      low: parseFloat(c.low),
      close: parseFloat(c.close),
    }));

    return NextResponse.json({ candles: mappedCandles });
  } catch (error: any) {
    console.error('Failed to fetch NAS100 live data from Deriv:', error);
    
    // FALLBACK: Return empty array or mock data to prevent UI crash if Deriv is down
    return NextResponse.json({ error: error.message || String(error), candles: [] }, { status: 500 });
  }
}

async function fetchCandlesFromDeriv(symbol: string, granularity: number) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
    let pingInterval: NodeJS.Timeout;

    const timeout = setTimeout(() => {
      clearInterval(pingInterval);
      if (ws.readyState !== WebSocket.CLOSED) {
        ws.terminate();
      }
      reject(new Error(`Timeout for ${symbol}`));
    }, 15000);

    ws.on('open', () => {
      ws.send(JSON.stringify({
        ticks_history: symbol,
        adjust_start_time: 1,
        count: 100,
        end: "latest",
        start: 1,
        style: "candles",
        granularity: granularity
      }));

      pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ ping: 1 }));
        }
      }, 2000);
    });

    ws.on('message', (data: any) => {
      const rawStr = data.toString();
      // Skip logging pongs to avoid spam
      if (!rawStr.includes('pong')) {
         console.log('Raw Deriv Response:', rawStr);
      }
      
      const res = JSON.parse(rawStr);
      if (res.error) {
        console.error('Deriv WS Error:', res.error);
        clearTimeout(timeout);
        clearInterval(pingInterval);
        ws.terminate();
        reject(new Error(res.error.message));
      } else if (res.msg_type === 'candles') {
        clearTimeout(timeout);
        clearInterval(pingInterval);
        ws.terminate();
        resolve(res.candles);
      }
    });

    ws.on('error', (err: any) => {
      clearTimeout(timeout);
      clearInterval(pingInterval);
      if (ws.readyState !== WebSocket.CLOSED) {
        ws.terminate();
      }
      reject(err);
    });
  });
}
