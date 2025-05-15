// src/utils/date.ts

/**
 * Format a date in standard format (MM/DD/YYYY)
 */
export function formatDate(date: Date | string | number): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric'
  });
}

/**
 * Format a date for input fields (YYYY-MM-DD)
 */
export function formatDateForInput(date: Date | string | number): string {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

/**
 * Get the start and end of a date range
 */
export function getDateRange(range: 'current-month' | 'last-month' | 'current-year' | 'last-year' | 'custom', 
                            customStart?: string, customEnd?: string): { start: Date, end: Date } {
  const now = new Date();
  
  switch (range) {
    case 'current-month':
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0)
      };
    case 'last-month':
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        end: new Date(now.getFullYear(), now.getMonth(), 0)
      };
    case 'current-year':
      return {
        start: new Date(now.getFullYear(), 0, 1),
        end: new Date(now.getFullYear(), 11, 31)
      };
    case 'last-year':
      return {
        start: new Date(now.getFullYear() - 1, 0, 1),
        end: new Date(now.getFullYear() - 1, 11, 31)
      };
    case 'custom':
      return {
        start: customStart ? new Date(customStart) : new Date(),
        end: customEnd ? new Date(customEnd) : new Date()
      };
  }
}