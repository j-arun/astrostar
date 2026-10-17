export function createReportFilenameTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-');
}