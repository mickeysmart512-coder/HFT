'use client';

import { useState, useEffect, useRef } from 'react';
import { analyzeSMC } from '../lib/smcEngine';
import { isTradingSessionValid } from '../lib/sessionTiming';
import { isNewsWindowActive, NewsEvent } from '../lib/newsFilter';

export interface LlmTraderData {
  bias: string;
  signal: 'BUY' | 'SELL' | 'NEUTRAL' | 'WAIT';
  confidence: number;
  reasoning: string;
  currentPrice: number | null;
  logs: string[];
  candles: any[] | null;
  isLiquiditySweep: boolean;
  hasCHoCH: boolean;
  validSetup: boolean;
  resources: { rss: string; heapUsed: string } | null;
}

export function useLlmTrader(chartTimeframe: string = '5m') {
  const [data, setData] = useState<LlmTraderData>({
    bias: 'CALC...',
    signal: 'NEUTRAL',
    confidence: 0,
    reasoning: 'Awaiting first candle closure...',
    currentPrice: null,
    logs: ['LLM Trader Initialized. Awaiting pipeline...'],
    candles: null,
    isLiquiditySweep: false,
    hasCHoCH: false,
    validSetup: false,
    resources: null,
  });
  
  const [newsEvents, setNewsEvents] = useState<NewsEvent[]>([]);

  const lastClosedTimeRef = useRef<number | null>(null);
  const isProcessingRef = useRef<boolean>(false);

  useEffect(() => {
    let isCancelled = false;
    let logBuffer: string[] = ['Starting inference cycle...'];

    const appendLog = (msg: string) => {
      console.log(`[LLM Trader] ${msg}`);
      logBuffer.push(`${new Date().toLocaleTimeString()} - ${msg}`);
      if (logBuffer.length > 20) logBuffer.shift();
    };

    const commitState = (updates: Partial<LlmTraderData>) => {
      if (isCancelled) return;
      setData(prev => ({
        ...prev,
        ...updates,
        logs: [...logBuffer] // clone
      }));
    };

    async function fetchCandles(tf: string) {
      const res = await fetch(`/api/nas100?interval=${tf}`, { cache: 'no-store' });
      if (!res.ok) {
        if (res.status === 404) throw new Error('API ROUTE NOT FOUND (404)');
        if (res.status === 500) throw new Error('DATA TIMEOUT');
        throw new Error(`Failed to fetch ${tf}`);
      }
      const json = await res.json();
      if (json.error === 'DATA TIMEOUT') throw new Error('DATA TIMEOUT');
      return json.candles || [];
    }

    async function runPipeline() {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      try {
        // Fetch the candles for the chart UI
        const chartCandles = await fetchCandles(chartTimeframe);

        if (chartCandles.length === 0) throw new Error('No chart candles returned.');

        const currentPrice = Number(chartCandles[chartCandles.length - 1].close);

        const mappedChartCandles = chartCandles.map((c: any) => ({
          ...c,
          time: typeof c.date === 'number' ? c.date : Math.floor(new Date(c.date).getTime() / 1000)
        }));

        commitState({ currentPrice, candles: mappedChartCandles });

        // Logic to detect if a 5-minute candle closed
        // We'll fetch the 5m data specifically to check for closures
        const m5CandlesRaw = chartTimeframe === '5m' ? chartCandles : await fetchCandles('5m');
        if (m5CandlesRaw.length < 2) return;

        const latestClosedM5 = m5CandlesRaw[m5CandlesRaw.length - 2];
        const latestClosedTime = typeof latestClosedM5.date === 'number' ? latestClosedM5.date : new Date(latestClosedM5.date).getTime();

        if (lastClosedTimeRef.current === null) {
          lastClosedTimeRef.current = latestClosedTime;
          appendLog('Synchronized to current 5-minute candle.');
          return;
        }

        // Has a new 5-minute candle closed?
        if (latestClosedTime > lastClosedTimeRef.current) {
          lastClosedTimeRef.current = latestClosedTime;
          appendLog(`5m candle closed at ${currentPrice}. Fetching 1m data for LLM analysis...`);

          const sessionTiming = isTradingSessionValid();
          const newsCheck = isNewsWindowActive(newsEvents);

          if (newsCheck.isLocked) {
            commitState({
              bias: 'SYSTEM LOCKED',
              signal: 'SYSTEM LOCKED - PENDING NEWS' as any,
              reasoning: `High Impact News (${newsCheck.event?.title}) at ${new Date(newsCheck.event?.date || '').toLocaleTimeString()}.`,
              validSetup: false
            });
            appendLog(`[News Filter] Market locked due to High Impact News: ${newsCheck.event?.title}`);
            return;
          }

          commitState({
            bias: sessionTiming.isValid ? 'ANALYZING' : sessionTiming.statusMsg
          });

          // Get 1m candles for micro structure
          const m1CandlesRaw = await fetchCandles('1m');

          // Map for SMC
          const mappedM5 = m5CandlesRaw.map((c: any) => ({
            ...c,
            time: typeof c.date === 'number' ? c.date : Math.floor(new Date(c.date).getTime() / 1000)
          }));

          const smcResult = analyzeSMC(mappedM5, 3);

          const isLiquiditySweep = smcResult.sweeps.length > 0;
          const hasCHoCH = smcResult.hasChoCh;

          // Extract the 3 most recent significant highs/lows
          const recentHighs = smcResult.pivots.filter(p => p.type === 'HIGH').slice(-3).map(p => p.price);
          const recentLows = smcResult.pivots.filter(p => p.type === 'LOW').slice(-3).map(p => p.price);

          let lastSweepStr = 'NONE';
          if (smcResult.latestSweep) {
            const type = smcResult.latestSweep.type;
            const isBreakout = smcResult.latestSweep.isBreakout;
            const price = smcResult.latestSweep.pivotPrice;
            lastSweepStr = `${type}_${isBreakout ? 'BREAKOUT' : 'SWEEP'}_AT_${price.toFixed(2)}`;
          }

          // Construct payload
          const payload = {
            session: smcResult.latestSweep ? smcResult.latestSweep.sessionTime : (sessionTiming.isValid ? 'NY_OPEN' : sessionTiming.statusMsg),
            bsl_levels: recentHighs,
            ssl_levels: recentLows,
            last_sweep: lastSweepStr,
            choch_detected: smcResult.hasChoCh,
            currentPrice,
            m1Candles: m1CandlesRaw.slice(-5),
            m5Candles: m5CandlesRaw.slice(-5)
          };

          appendLog('Sending SMC payload to Gemini 1.5 Pro...');

          const llmRes = await fetch('/api/analyze-trade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (!llmRes.ok) throw new Error('LLM API Error');

          const llmData = await llmRes.json();

          if (llmData.error) throw new Error(llmData.error);

          appendLog(`LLM Response: ${llmData.signal} (${llmData.confidence}%)`);

          const validSetup = llmData.signal === 'BUY' || llmData.signal === 'SELL';

          commitState({
            signal: llmData.signal,
            confidence: llmData.confidence,
            reasoning: llmData.reasoning,
            bias: llmData.signal === 'NEUTRAL' || llmData.signal === 'WAIT' ? 'NEUTRAL' : (llmData.signal === 'BUY' ? 'BULLISH' : 'BEARISH'),
            isLiquiditySweep,
            hasCHoCH,
            validSetup
          });
        }
      } catch (err: any) {
        if (err.message === 'DATA TIMEOUT' || err.message.includes('fetch') || err.message.includes('404')) {
          appendLog('CONNECTION ERROR - RETRYING');
        } else {
          appendLog(`Error: ${err.message}`);
        }
        // Prevent infinite loading UI on absolute failures
        setData(prev => {
          if (prev.candles === null) return { ...prev, candles: [], logs: [...logBuffer] };
          return prev;
        });
      } finally {
        isProcessingRef.current = false;
      }
    }

    async function fetchNews() {
      try {
        const res = await fetch('/api/news');
        const json = await res.json();
        if (json.events) setNewsEvents(json.events);
      } catch (err) {
        console.error('Failed to fetch news:', err);
      }
    }

    async function checkHealth() {
      try {
        const res = await fetch('/api/health');
        const json = await res.json();
        const serverEST = json.serverTimeEST;
        const localTime = new Date().toLocaleTimeString();
        appendLog(`[System] Server Time (EST): ${serverEST}`);
        appendLog(`[System] Local Time: ${localTime}`);
        
        if (json.resources) {
          commitState({ resources: { rss: json.resources.rss, heapUsed: json.resources.heapUsed } });
        }
        
        if (!json.environment.gemini_key) {
          appendLog('[CRITICAL ERROR] GEMINI_API_KEY is missing from environment!');
          commitState({ bias: 'CONFIG ERROR', reasoning: 'CRITICAL: GEMINI_API_KEY NOT FOUND' });
        }
        if (!json.environment.deriv_token) {
          appendLog('[System] Warning: No DERIV_API_TOKEN found in server env. Using UI-provided token.');
        }
      } catch (err) {
        console.error('Health check failed', err);
      }
    }

    checkHealth();
    fetchNews();
    runPipeline();
    const interval = setInterval(runPipeline, 5000);
    const newsInterval = setInterval(fetchNews, 300000); // Update news every 5 mins

    return () => {
      isCancelled = true;
      clearInterval(interval);
      clearInterval(newsInterval);
    };
  }, [chartTimeframe]);

  return {
    ...data, addLog: (msg: string) => {
      setData(prev => ({
        ...prev,
        logs: [`${new Date().toLocaleTimeString()} - ${msg}`, ...prev.logs].slice(0, 20)
      }));
    }
  };
}
