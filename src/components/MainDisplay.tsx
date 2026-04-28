'use client';

import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";
import { LineChart } from "lucide-react";
import { createChart, IChartApi, ISeriesApi, CandlestickSeries, UTCTimestamp } from "lightweight-charts";

interface MainDisplayProps {
  candles?: any[] | null;
  timeframe?: string;
  onTimeframeChange?: (tf: string) => void;
  className?: string;
}

export function MainDisplay({ candles, timeframe = '5m', onTimeframeChange, className }: MainDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  // Initialize the chart once on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: 'rgba(255,255,255,0.4)',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: {
        vertLine: { color: 'rgba(34,211,238,0.3)', width: 1, style: 1 },
        horzLine: { color: 'rgba(34,211,238,0.3)', width: 1, style: 1 },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        textColor: 'rgba(255,255,255,0.4)',
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        timeVisible: true,
        secondsVisible: false,
      },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    seriesRef.current = series;

    // Resize observer
    const observer = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Update candle data whenever it changes
  useEffect(() => {
    console.log('RAW_CANDLE_DATA:', candles);
    console.log('CHART_DATA_CHECK:', candles?.length ?? 0, 'candles received');
    
    if (!seriesRef.current || !candles || candles.length === 0) return;

    const chartData = candles
      .map((c: any) => {
        // Support both timestamp from API (c.time is UNIX) or ISO date (c.date)
        let time: UTCTimestamp;
        if (c.time) {
          time = Math.floor(Number(c.time)) as UTCTimestamp;
        } else if (c.date) {
          time = Math.floor(new Date(c.date).getTime() / 1000) as UTCTimestamp;
        } else {
          return null;
        }
        const open  = Number(c.open);
        const high  = Number(c.high);
        const low   = Number(c.low);
        const close = Number(c.close);
        if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) return null;
        return { time, open, high, low, close };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => (a.time as number) - (b.time as number))
      // Deduplicate by timestamp (lightweight-charts crashes on dupes)
      .filter((c, i, arr) => i === 0 || c.time !== arr[i - 1].time);

    console.log('CHART_DATA_MAPPED:', chartData.length, 'valid candles', chartData[0], '...', chartData[chartData.length - 1]);

    if (chartData.length > 0) {
      seriesRef.current.setData(chartData);
      // Use update for the last candle to ensure smooth real-time movement
      seriesRef.current.update(chartData[chartData.length - 1]);
      chartRef.current?.timeScale().fitContent();
    }
  }, [candles]);

  return (
    <div className={cn("flex flex-col relative rounded-xl border border-border-card bg-back-card overflow-hidden shadow-2xl min-h-[400px]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-card bg-back-panel/40 flex-none">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <LineChart className="w-4 h-4 text-brand-blue" />
            <h2 className="text-sm font-semibold tracking-wide text-fore-base uppercase">Price Chart · NAS100</h2>
          </div>
          <div className="flex bg-back-base/50 rounded-md p-0.5 border border-border-card">
            {['1m', '5m', '15m'].map((tf) => (
              <button
                key={tf}
                onClick={() => onTimeframeChange?.(tf)}
                className={cn(
                  "px-2 py-0.5 text-[10px] font-bold rounded transition-colors",
                  timeframe === tf 
                    ? "bg-brand-blue text-white" 
                    : "text-fore-muted hover:text-fore-base"
                )}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {candles && candles.length > 0 ? (
            <span className="text-[10px] font-mono text-brand-neon/60 uppercase tracking-widest">{candles.length} Candles</span>
          ) : (
            <span className="text-[10px] font-mono text-fore-muted/30 uppercase tracking-widest animate-pulse">Awaiting Data...</span>
          )}
        </div>
      </div>

      {/* Chart or Loader */}
      <div className="flex-1 relative">
        {/* Subtle grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

        {!candles || candles.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10">
            <div className="w-12 h-12 rounded-full border-2 border-brand-neon/20 border-t-brand-neon animate-spin" />
            <p className="text-[10px] font-mono text-brand-neon/50 tracking-widest uppercase">Initializing Chart Engine...</p>
          </div>
        ) : null}

        <div ref={containerRef} className="absolute inset-0" />

        {/* Chart Overlay Label */}
        <div className="absolute top-4 left-4 z-20 pointer-events-none">
          <div className="flex flex-col">
            <span className="text-lg font-black text-fore-base/20 tracking-tighter uppercase leading-none">NAS100</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-brand-blue/30 uppercase tracking-[0.2em]">{timeframe}</span>
              <span className="w-1 h-1 rounded-full bg-brand-neon/20" />
              <span className="text-[10px] font-bold text-fore-muted/20 uppercase tracking-[0.2em]">DERIV LIVE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
