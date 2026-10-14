import { VedicHouseContext, LLMThreePartNarrative } from './llm/types';
import { generateVedicPdfReport } from './pdfReportGenerator';
import { generateVedicHtmlReport } from './htmlReportGenerator';
import { generateVedicWordReport } from './wordReportGenerator';

export type ExportFormat = 'pdf' | 'html' | 'word';

export function exportVedicReport(
  format: ExportFormat,
  context: VedicHouseContext,
  narrative: LLMThreePartNarrative
): void {
  switch (format) {
    case 'pdf':
      generateVedicPdfReport(context, narrative);
      break;
    case 'html':
      generateVedicHtmlReport(context, narrative);
      break;
    case 'word':
      generateVedicWordReport(context, narrative);
      break;
  }
}

export function exportAllVedicReports(
  context: VedicHouseContext,
  narrative: LLMThreePartNarrative
): void {
  // Trigger all 3 downloads cleanly with slight delays to avoid browser download blocking
  generateVedicPdfReport(context, narrative);
  setTimeout(() => {
    generateVedicHtmlReport(context, narrative);
  }, 400);
  setTimeout(() => {
    generateVedicWordReport(context, narrative);
  }, 800);
}

export {
  generateVedicPdfReport,
  generateVedicHtmlReport,
  generateVedicWordReport
};
