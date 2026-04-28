import { NextResponse } from 'next/server';
import { fetchHighImpactNews } from '@/lib/newsFilter';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const events = await fetchHighImpactNews();
    return NextResponse.json({ events });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
