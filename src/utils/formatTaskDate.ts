/**
 * Format task date/time according to the rules:
 * - Today: [TODAY • 12:30]
 * - Tomorrow: [TOMORROW • 12:30]
 * - This month: [THURS 10 • 12:30]
 * - Next month: [10 JAN • 12:30]
 */
export function formatTaskDate(dateString: string | null | undefined): string {
  if (!dateString) return "No due date";
  
  const date = new Date(dateString);
  const now = new Date();
  
  // Reset time to start of day for comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const taskDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Format time (12:30) - only if time is specified (not midnight or if it's a full timestamp)
  const hasTime = dateString.includes('T') && !dateString.endsWith('T00:00:00');
  let timeStr = '';
  if (hasTime) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    timeStr = ` • ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  
  // Check if today
  if (taskDate.getTime() === today.getTime()) {
    return hasTime ? `TODAY${timeStr}` : 'TODAY';
  }
  
  // Check if tomorrow
  if (taskDate.getTime() === tomorrow.getTime()) {
    return hasTime ? `TOMORROW${timeStr}` : 'TOMORROW';
  }
  
  // Check if this month
  if (taskDate.getMonth() === today.getMonth() && taskDate.getFullYear() === today.getFullYear()) {
    // Format: THURS 10
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THURS', 'FRI', 'SAT'];
    const dayName = dayNames[date.getDay()];
    const day = date.getDate();
    return `${dayName} ${day}${timeStr}`;
  }
  
  // Next month or later: 10 JAN
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const monthName = monthNames[date.getMonth()];
  const day = date.getDate();
  return `${day} ${monthName}${timeStr}`;
}

