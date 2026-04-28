export function isTradingSessionValid(): { isValid: boolean; statusMsg: string } {
  const now = new Date();
  
  // Explicitly use New York timezone
  const nyString = now.toLocaleString("en-US", { timeZone: "America/New_York" });
  const nyDate = new Date(nyString);
  
  const dayOfWeek = nyDate.getDay();
  // 0 is Sunday, 6 is Saturday.
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return { isValid: false, statusMsg: 'MARKET CLOSED' };
  }

  const hours = nyDate.getHours();
  const minutes = nyDate.getMinutes();

  const currentMinutesSinceMidnight = hours * 60 + minutes;
  
  // 9:30 AM = 570 minutes
  // 12:00 PM = 720 minutes
  const sessionStart = 9 * 60 + 30;
  const sessionEnd = 12 * 60;

  if (currentMinutesSinceMidnight >= sessionStart && currentMinutesSinceMidnight <= sessionEnd) {
    return { isValid: true, statusMsg: 'SESSION ACTIVE' };
  }

  return { isValid: false, statusMsg: 'WAITING FOR SESSION' };
}
