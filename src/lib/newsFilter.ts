/**
 * News Filter Utility — Economic Calendar Integration
 * Fetches high-impact news events to prevent trading during volatile windows.
 */

export interface NewsEvent {
  title: string;
  country: string;
  date: string; // ISO String
  impact: 'High' | 'Medium' | 'Low' | 'Holiday';
  forecast: string;
  previous: string;
}

const NEWS_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

export async function fetchHighImpactNews(): Promise<NewsEvent[]> {
  try {
    const response = await fetch(NEWS_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`News API returned ${response.status}`);
    
    const data = await response.json();
    
    // Filter for USD events (all impact levels for UI)
    return data.filter((event: any) => 
      event.country === 'USD'
    ).map((event: any) => ({
      title: event.title,
      country: event.country,
      date: event.date,
      impact: event.impact,
      forecast: event.forecast,
      previous: event.previous
    }));
  } catch (error: any) {
    console.error('[NEWS ERROR]', error);
    // Return a special object indicating a fetch failure
    return [{ title: 'FETCH_ERROR', country: 'USD', date: new Date().toISOString(), impact: 'High', forecast: '', previous: '' }] as any;
  }
}

export function isNewsWindowActive(events: NewsEvent[]): { isLocked: boolean; event: NewsEvent | null } {
  const now = new Date();
  const WINDOW_MS = 30 * 60 * 1000; // 30 minutes

  for (const event of events) {
    const eventTime = new Date(event.date);
    const diff = Math.abs(now.getTime() - eventTime.getTime());

    if (diff <= WINDOW_MS) {
      return { isLocked: true, event };
    }
  }

  return { isLocked: false, event: null };
}
