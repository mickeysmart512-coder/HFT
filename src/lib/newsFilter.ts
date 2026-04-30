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

const NEWS_XML_URL = 'https://www.forexfactory.com/ff_calendar_thisweek.xml';
const PROXY_URL = 'https://api.allorigins.win/raw?url=';

export async function fetchHighImpactNews(): Promise<NewsEvent[]> {
  try {
    const response = await fetch(PROXY_URL + encodeURIComponent(NEWS_XML_URL), { 
      cache: 'no-store'
    });
    
    if (!response.ok) throw new Error(`Proxy/News API returned ${response.status}`);
    
    const xmlText = await response.text();
    
    // Simple XML parser using regex to avoid heavy dependencies
    const eventRegex = /<event>([\s\S]*?)<\/event>/g;
    const events: NewsEvent[] = [];
    let match;

    while ((match = eventRegex.exec(xmlText)) !== null) {
      const content = match[1];
      const getVal = (tag: string) => {
        const m = new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`).exec(content);
        return m ? m[1] : '';
      };

      const title = getVal('title');
      const country = getVal('country');
      const dateStr = getVal('date'); // e.g., 04-25-2024
      const timeStr = getVal('time'); // e.g., 8:30am
      const impact = getVal('impact') as any;

      if (country === 'USD') {
        // Parse date/time into ISO string
        // Note: Forex Factory XML dates are usually MM-DD-YYYY
        const [m, d, y] = dateStr.split('-');
        let hour = 0;
        let min = 0;
        
        if (timeStr) {
          const tMatch = /(\d+):(\d+)(am|pm)/i.exec(timeStr);
          if (tMatch) {
            hour = parseInt(tMatch[1]);
            min = parseInt(tMatch[2]);
            if (tMatch[3].toLowerCase() === 'pm' && hour < 12) hour += 12;
            if (tMatch[3].toLowerCase() === 'am' && hour === 12) hour = 0;
          }
        }

        // Construct date in ET (Forex Factory default usually) or assume UTC for simplicity
        const date = new Date(Date.UTC(parseInt(y), parseInt(m) - 1, parseInt(d), hour, min));

        events.push({
          title,
          country,
          date: date.toISOString(),
          impact,
          forecast: getVal('forecast'),
          previous: getVal('previous')
        });
      }
    }

    return events;
  } catch (error: any) {
    console.error('[NEWS ERROR]', error);
    return [{ title: 'FETCH_ERROR', country: 'USD', date: new Date().toISOString(), impact: 'High', forecast: '', previous: '' }] as any;
  }
}

export function isNewsWindowActive(events: NewsEvent[]): { isLocked: boolean; event: NewsEvent | null } {
  const now = new Date();
  const WINDOW_MS = 30 * 60 * 1000; // 30 minutes

  for (const event of events) {
    // IGNORE FETCH_ERROR - Do not lock if news sync failed
    if (event.title === 'FETCH_ERROR') continue;
    if (event.impact !== 'High') continue;

    const eventTime = new Date(event.date);
    const diff = Math.abs(now.getTime() - eventTime.getTime());

    if (diff <= WINDOW_MS) {
      return { isLocked: true, event };
    }
  }

  return { isLocked: false, event: null };
}
