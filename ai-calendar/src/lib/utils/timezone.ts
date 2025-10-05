/**
 * Timezone utility functions for handling calendar events
 */

/**
 * Get the user's timezone from the browser
 * @returns IANA timezone string (e.g., "America/New_York")
 */
export function getUserTimezone(): string {
  if (typeof window !== 'undefined') {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  // Default to UTC if running on server
  return 'UTC';
}

/**
 * Get timezone offset in minutes for a given date and timezone
 * @param date - The date to get offset for
 * @param timezone - IANA timezone string
 * @returns Offset in minutes
 */
export function getTimezoneOffset(date: Date, timezone: string): number {
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  return (tzDate.getTime() - utcDate.getTime()) / 60000;
}

/**
 * Format a date to RFC3339 format with timezone offset
 * @param date - Date to format (can be string or Date object)
 * @param timezone - IANA timezone string (optional, defaults to user timezone)
 * @returns RFC3339 formatted string with timezone offset (e.g., "2024-01-15T10:00:00-08:00")
 */
export function formatDateTimeWithTimezone(
  date: string | Date,
  timezone?: string
): string {
  const tz = timezone || getUserTimezone();
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Get the date/time in the specified timezone
  const options: Intl.DateTimeFormatOptions = {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  };
  
  const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(dateObj);
  const dateMap = new Map(parts.map(part => [part.type, part.value]));
  
  const year = dateMap.get('year');
  const month = dateMap.get('month');
  const day = dateMap.get('day');
  const hour = dateMap.get('hour');
  const minute = dateMap.get('minute');
  const second = dateMap.get('second');
  
  // Calculate timezone offset
  const offset = getTimezoneOffset(dateObj, tz);
  const offsetHours = Math.floor(Math.abs(offset) / 60);
  const offsetMinutes = Math.abs(offset) % 60;
  const offsetSign = offset >= 0 ? '+' : '-';
  const offsetString = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;
  
  // Format as RFC3339
  return `${year}-${month}-${day}T${hour}:${minute}:${second}${offsetString}`;
}

/**
 * Parse natural language date/time and format with timezone
 * @param input - Natural language input (e.g., "tomorrow at 3pm", "next Monday")
 * @param timezone - IANA timezone string
 * @returns RFC3339 formatted string with timezone offset
 */
export function parseAndFormatDateTime(
  input: string,
  timezone?: string
): string {
  const tz = timezone || getUserTimezone();
  const now = new Date();
  const lowerInput = input.toLowerCase();
  
  let targetDate = new Date();
  
  // Parse relative dates
  if (lowerInput.includes('today')) {
    // Keep today's date
  } else if (lowerInput.includes('tomorrow')) {
    targetDate.setDate(targetDate.getDate() + 1);
  } else if (lowerInput.includes('next week')) {
    targetDate.setDate(targetDate.getDate() + 7);
  } else if (lowerInput.includes('next month')) {
    targetDate.setMonth(targetDate.getMonth() + 1);
  } else {
    // Check for day names
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    for (let i = 0; i < daysOfWeek.length; i++) {
      if (lowerInput.includes(daysOfWeek[i])) {
        const targetDay = i;
        const currentDay = now.getDay();
        let daysToAdd = targetDay - currentDay;
        
        if (lowerInput.includes('next') || daysToAdd <= 0) {
          daysToAdd += 7;
        }
        
        targetDate.setDate(targetDate.getDate() + daysToAdd);
        break;
      }
    }
  }
  
  // Parse time
  const timeRegex = /(\d{1,2})\s*(?::(\d{2}))?\s*(am|pm)?/i;
  const timeMatch = lowerInput.match(timeRegex);
  
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const ampm = timeMatch[3];
    
    if (ampm) {
      if (ampm.toLowerCase() === 'pm' && hours < 12) {
        hours += 12;
      } else if (ampm.toLowerCase() === 'am' && hours === 12) {
        hours = 0;
      }
    }
    
    targetDate.setHours(hours, minutes, 0, 0);
  } else if (!lowerInput.match(/\d{4}-\d{2}-\d{2}/)) {
    // If no time specified and not an ISO date, default to 9 AM
    targetDate.setHours(9, 0, 0, 0);
  }
  
  // If the input looks like an ISO date, try to parse it directly
  if (input.match(/\d{4}-\d{2}-\d{2}/)) {
    targetDate = new Date(input);
  }
  
  return formatDateTimeWithTimezone(targetDate, tz);
}

/**
 * Add duration to a datetime and format with timezone
 * @param startDateTime - Start datetime in RFC3339 format
 * @param durationMinutes - Duration in minutes
 * @param timezone - IANA timezone string
 * @returns RFC3339 formatted end datetime with timezone offset
 */
export function addDurationToDateTime(
  startDateTime: string,
  durationMinutes: number,
  timezone?: string
): string {
  const startDate = new Date(startDateTime);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
  return formatDateTimeWithTimezone(endDate, timezone);
}

/**
 * Assemble date and time components into RFC3339 format with timezone
 * @param date - Date in YYYY-MM-DD format
 * @param hour - Hour (1-12 for 12-hour format with AM/PM, 0-23 for 24-hour)
 * @param minute - Minute (0-59)
 * @param period - 'AM', 'PM', or 'NONE' for 24-hour format
 * @param timezone - IANA timezone string
 * @returns RFC3339 formatted datetime with timezone offset
 */
export function assembleDateTime(
  date: string,
  hour: number,
  minute: number,
  period: 'AM' | 'PM' | 'NONE',
  timezone: string
): string {
  // Convert to 24-hour format
  let hour24 = hour;
  
  if (period !== 'NONE') {
    // Handle 12-hour format
    if (period === 'PM' && hour < 12) {
      hour24 = hour + 12;
    } else if (period === 'AM' && hour === 12) {
      hour24 = 0; // Midnight
    } else {
      hour24 = hour;
    }
  }
  
  // Validate hour is in valid range
  if (hour24 < 0 || hour24 > 23) {
    console.warn(`Invalid hour ${hour24} after conversion from ${hour} ${period}`);
    hour24 = Math.min(23, Math.max(0, hour24));
  }
  
  // Create datetime string
  const dateTimeStr = `${date}T${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
  
  // Format with timezone
  return formatDateTimeWithTimezone(new Date(dateTimeStr), timezone);
}