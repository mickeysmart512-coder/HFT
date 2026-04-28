import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const mem = process.memoryUsage();
  const now = new Date();
  const estTime = now.toLocaleString("en-US", { timeZone: "America/New_York" });
  
  return NextResponse.json({ 
    status: "alive",
    timestamp: now.toISOString(),
    serverTimeEST: estTime,
    environment: {
      gemini_key: !!process.env.GEMINI_API_KEY,
      deriv_token: !!process.env.DERIV_API_TOKEN,
      node_env: process.env.NODE_ENV
    },
    resources: {
      rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
    },
    service: "AI_Terminal_V2"
  });
}
