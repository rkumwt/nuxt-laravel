const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Carbon's format('d M Y'), e.g. "07 Oct 2026" (UTC, like the Laravel app)
export const formatDayMonthYear = (date: Date) =>
  `${String(date.getUTCDate()).padStart(2, "0")} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;

// Inclusive whole-day range, like whereBetween([start 00:00:00, end 23:59:59])
export const dayRange = (start: string, end: string) => ({
  gte: new Date(`${start}T00:00:00.000Z`),
  lte: new Date(`${end}T23:59:59.999Z`),
});
