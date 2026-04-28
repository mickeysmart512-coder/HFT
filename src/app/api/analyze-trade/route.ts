import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { isTradingSessionValid } from '@/lib/sessionTiming';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await request.json();
  const { currentPrice, m1Candles, m5Candles, bsl_levels, ssl_levels, last_sweep, choch_detected, session } = body;

  try {
    // 1. Strict Session Window Check (NY Time)
    const sessionCheck = isTradingSessionValid();
    if (!sessionCheck.isValid) {
      return NextResponse.json({
        signal: 'NEUTRAL',
        confidence: 0,
        reasoning: sessionCheck.statusMsg,
        timestamp: new Date().toISOString()
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set.");
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Explicit schema for Gemini to ensure perfect JSON
    const schema = {
      description: "SMC Trade Analysis",
      type: SchemaType.OBJECT,
      properties: {
        signal: {
          type: SchemaType.STRING,
          description: "Trading signal: BUY, SELL, or NEUTRAL",
        },
        confidence: {
          type: SchemaType.NUMBER,
          description: "Confidence level from 0 to 100",
        },
        reasoning: {
          type: SchemaType.STRING,
          description: "Concise reasoning for the signal",
        },
      },
      required: ["signal", "confidence", "reasoning"],
    };

    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-pro",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema as any,
      }
    });

    const systemPrompt = `You are an institutional algorithmic trader specializing in NAS100 Smart Money Concepts (SMC). 
Your task is to analyze market structure and identify high-probability setups.
Rule: Look for Liquidity Sweeps (BSL/SSL) followed by a Change of Character (ChoCh).
Output must be strictly JSON matching the provided schema.`;

    const userPrompt = `
CURRENT MARKET DATA:
Price: ${currentPrice}
Active Session: ${session}

STRUCTURE:
BSL (Highs): ${JSON.stringify(bsl_levels)}
SSL (Lows): ${JSON.stringify(ssl_levels)}
Last Sweep: ${last_sweep}
ChoCh Detected: ${choch_detected}

CANDLE HISTORY:
M1 (Micro): ${JSON.stringify(m1Candles.map((c: any) => ({ o: c.open, h: c.high, l: c.low, c: c.close })))}
M5 (Macro): ${JSON.stringify(m5Candles.map((c: any) => ({ o: c.open, h: c.high, l: c.low, c: c.close })))}

Analyze and provide the signal.`;

    console.log('[Gemini API] Sending payload to model...');
    console.log('[Gemini API] Current Price:', currentPrice);
    console.log('[Gemini API] Last Sweep:', last_sweep);

    const result = await model.generateContent([systemPrompt, userPrompt]);
    const responseText = result.response.text();
    const parsed = JSON.parse(responseText);

    return NextResponse.json({
      signal: parsed.signal || 'NEUTRAL',
      confidence: parsed.confidence || 0,
      reasoning: parsed.reasoning || 'No reasoning provided.',
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('[Gemini API Error] FULL ERROR:', error);
    if (error.response) {
      console.error('[Gemini API Error] Response Data:', JSON.stringify(error.response, null, 2));
    }
    
    // Fallback to Local SMC Logic if AI is down
    let fallbackSignal = 'NEUTRAL';
    let fallbackReasoning = 'AI OFFLINE - Using Local SMC Logic';
    let fallbackConfidence = 50;

    if (choch_detected && last_sweep && last_sweep !== 'NONE') {
      if (last_sweep.startsWith('SSL')) {
        fallbackSignal = 'BUY';
        fallbackReasoning = 'Local Logic: SSL Sweep + ChoCh detected.';
        fallbackConfidence = 60;
      } else if (last_sweep.startsWith('BSL')) {
        fallbackSignal = 'SELL';
        fallbackReasoning = 'Local Logic: BSL Sweep + ChoCh detected.';
        fallbackConfidence = 60;
      }
    }

    return NextResponse.json({
      signal: fallbackSignal,
      confidence: fallbackConfidence,
      reasoning: fallbackReasoning,
      timestamp: new Date().toISOString()
    });
  }
}
