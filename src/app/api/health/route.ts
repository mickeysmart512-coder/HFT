import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ 
    status: "alive",
    timestamp: new Date().toISOString(),
    service: "AI_Terminal_V2"
  });
}
