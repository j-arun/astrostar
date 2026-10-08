import { jsPDF } from 'jspdf';
import { VedicHouseContext, LLMThreePartNarrative, LLM_PROVIDERS } from './llm/types';

export function generateVedicPdfReport(
  context: VedicHouseContext,
  narrative: LLMThreePartNarrative
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 14;

  const checkPageBreak = (spaceNeeded: number) => {
    if (y + spaceNeeded > pageHeight - 16) {
      doc.addPage();
      drawPageBorderAndFooter();
      y = 18;
    }
  };

  const drawPageBorderAndFooter = () => {
    // Subtle page border
    doc.setDrawColor(218, 165, 32); // Golden border
    doc.setLineWidth(0.4);
    doc.rect(8, 8, pageWidth - 16, pageHeight - 16);

    // Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(
      'Vedic Parashara Inference Report • Private LLM Audit Protocol • Page ' +
        doc.internal.pages.length,
      pageWidth / 2,
      pageHeight - 11,
      { align: 'center' }
    );
  };

  // --- HEADER SECTION ---
  doc.setFillColor(15, 23, 42); // Dark slate header
  doc.rect(margin, y, contentWidth, 24, 'F');

  doc.setTextColor(245, 158, 11); // Amber
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('VEDIC PARASHARA ASTROLOGICAL INFERENCE REPORT', margin + 6, y + 9);

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const timePeriodText = `${MONTH_NAMES[context.selectedMonth] || 'Active Month'} ${context.selectedYear}`;

  doc.setTextColor(203, 213, 225); // Slate 300
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    `House ${context.houseNumber} (${context.rashiName} / ${context.tamilName}) • Period: ${timePeriodText}`,
    margin + 6,
    y + 16
  );

  doc.setTextColor(52, 211, 153); // Emerald
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(
    context.isEventActive ? '● EVENT ACTIVE' : '○ INACTIVE/DORMANT',
    pageWidth - margin - 8,
    y + 9,
    { align: 'right' }
  );

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    `Activation Score: ${context.activationScore.toFixed(2)}`,
    pageWidth - margin - 8,
    y + 16,
    { align: 'right' }
  );

  y += 28;

  // --- SECTION 1: TIME PERIOD & DASHA LORDS (MD / AD / PD) ---
  checkPageBreak(38);
  doc.setFillColor(248, 250, 252); // Light background card
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 34, 2, 2, 'FD');

  doc.setTextColor(180, 83, 9); // Amber 700
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`1. TIME PERIOD (${timePeriodText}) & DASHA LORDS (MD / AD / PD)`, margin + 4, y + 6);

  // 3-Column Dasha Grid
  const colW = (contentWidth - 8) / 3;
  const startColY = y + 10;

  // MD
  doc.setFillColor(254, 243, 199);
  doc.roundedRect(margin + 4, startColY, colW - 2, 20, 1.5, 1.5, 'F');
  doc.setTextColor(146, 64, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('MAHADASHA (MD)', margin + 6, startColY + 5);
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.text(context.activeDasha.mahadasha || 'Lord', margin + 6, startColY + 12);
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Primary Planetary Period', margin + 6, startColY + 17);

  // AD
  doc.setFillColor(224, 242, 254);
  doc.roundedRect(margin + 4 + colW, startColY, colW - 2, 20, 1.5, 1.5, 'F');
  doc.setTextColor(3, 105, 161);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('ANTARDASHA (AD)', margin + 6 + colW, startColY + 5);
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.text(context.activeDasha.antardasha || 'Lord', margin + 6 + colW, startColY + 12);
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Sub-Period Manifestor', margin + 6 + colW, startColY + 17);

  // PD
  doc.setFillColor(220, 252, 231);
  doc.roundedRect(margin + 4 + colW * 2, startColY, colW - 2, 20, 1.5, 1.5, 'F');
  doc.setTextColor(21, 128, 61);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('PRATYANTARDASHA (PD)', margin + 6 + colW * 2, startColY + 5);
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.text(context.activeDasha.pratyantardasha || 'Lord', margin + 6 + colW * 2, startColY + 12);
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Window: ${narrative.peakDateRange || 'Active Month'}`, margin + 6 + colW * 2, startColY + 17);

  y += 38;

  // --- SECTION 2: CHART SIGNIFICATIONS & ASHTAKAVARGA ---
  checkPageBreak(30);
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 26, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('2. CHART SIGNIFICATIONS & GRAHA PLACEMENTS', margin + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);

  const natalText = context.natalOccupants.length > 0
    ? context.natalOccupants.map(o => `${o.body_name}${o.degree_sputa ? ` (${o.degree_sputa})` : ''}`).join(', ')
    : 'None (Vacant House)';
  const transitText = context.transitOccupants.length > 0
    ? context.transitOccupants.map(t => `${t.graha_key}${t.degree_sputa ? ` (${t.degree_sputa})` : ''}${t.is_retrograde ? ' [R]' : ''}`).join(', ')
    : 'None';

  doc.text(`• Natal Grahas in House: ${natalText}`, margin + 6, y + 12);
  doc.text(`• Active Transit Triggers: ${transitText}`, margin + 6, y + 17);
  doc.text(
    `• Target House: House ${context.houseNumber} (${context.rashiName}) | Lagna: ${context.isLagna ? 'Ascendant' : 'Bhava ' + context.houseNumber} | Cycle: ${context.activeDasha.startDate || 'Current'} to ${context.activeDasha.endDate || 'Active'}`,
    margin + 6,
    y + 22
  );

  y += 30;

  // --- SECTION 3: LLM INFERENCE DETAILS & WIRE AUDIT ---
  checkPageBreak(24);
  const providerName = LLM_PROVIDERS[narrative.providerUsed]?.name || narrative.providerUsed;
  const isLocal = narrative.providerUsed === 'local_qwen';

  doc.setFillColor(15, 23, 42); // Dark banner
  doc.roundedRect(margin, y, contentWidth, 20, 2, 2, 'F');

  doc.setTextColor(245, 158, 11);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('3. LLM INFERENCE ENGINE & PRIVATE TELEMETRY', margin + 4, y + 6);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    `Provider: ${providerName} ${isLocal ? `(Private Local LLM - ${narrative.endpointUsed})` : '(Cloud LLM)'}`,
    margin + 4,
    y + 11
  );
  doc.text(
    `Execution Latency: ${narrative.executionTimeMs} ms • Confidence: ${(narrative.overallConfidence * 100).toFixed(0)}% • Model: ${narrative.ollamaStats?.model || (isLocal ? 'qwen2.5:7b-instruct' : 'gemini-3.8-flash')}`,
    margin + 4,
    y + 16
  );

  if (narrative.memoryPurged) {
    doc.setTextColor(52, 211, 153);
    doc.text('✓ VRAM & Prompt Memory: PURGED', pageWidth - margin - 6, y + 16, { align: 'right' });
  }

  y += 24;

  // USER QUERY (IF PRESENT)
  if (context.userQuery) {
    checkPageBreak(16);
    doc.setFillColor(254, 249, 195);
    doc.roundedRect(margin, y, contentWidth, 12, 1.5, 1.5, 'F');
    doc.setTextColor(133, 77, 14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('INQUIRY / USER PROMPT:', margin + 4, y + 5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(66, 32, 6);
    doc.text(`"${context.userQuery}"`, margin + 4, y + 9);
    y += 15;
  }

  // BOTTOM-LINE SYNTHESIS BOX
  checkPageBreak(24);
  doc.setFillColor(255, 251, 235); // Amber-50
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.6);

  const summaryLines = doc.splitTextToSize(
    narrative.summarySentence || 'Parashara synthesis completed.',
    contentWidth - 10
  );
  const summaryBoxH = Math.max(18, summaryLines.length * 4.5 + 8);
  doc.roundedRect(margin, y, contentWidth, summaryBoxH, 2, 2, 'FD');

  doc.setTextColor(180, 83, 9);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('BOTTOM-LINE SYNTHESIS:', margin + 4, y + 6);

  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(summaryLines, margin + 4, y + 11);

  y += summaryBoxH + 4;

  // --- 3-PART PARASHARA INFERENCE BLOCKS ---

  // Helper for narrative block
  const renderPartBlock = (
    title: string,
    content: string,
    badge: string,
    headerColor: [number, number, number],
    bgColor: [number, number, number]
  ) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const textLines = doc.splitTextToSize(content || 'No commentary provided.', contentWidth - 10);
    const boxHeight = Math.max(22, textLines.length * 4.2 + 10);

    checkPageBreak(boxHeight + 4);

    doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentWidth, boxHeight, 2, 2, 'FD');

    // Header strip inside card
    doc.setTextColor(headerColor[0], headerColor[1], headerColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(title, margin + 4, y + 6);

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7.5);
    doc.text(badge, pageWidth - margin - 6, y + 6, { align: 'right' });

    // Body
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.text(textLines, margin + 4, y + 11);

    y += boxHeight + 4;
  };

  // PART 1
  renderPartBlock(
    'PART 1: EVENT PROBABILITY & SCOPE',
    narrative.part1_probabilityAndScope,
    `Confidence: ${(narrative.overallConfidence * 100).toFixed(0)}%`,
    [180, 83, 9], // Amber
    [255, 255, 255]
  );

  // PART 2
  renderPartBlock(
    'PART 2: FINANCIAL & RESOURCE SOURCES',
    narrative.part2_financialAndResources,
    'Signification Analysis',
    [2, 132, 199], // Sky
    [255, 255, 255]
  );

  // PART 3
  renderPartBlock(
    'PART 3: MICRO-TIMING WINDOW (PRATYANTARDASHA)',
    narrative.part3_microTimingWindow,
    `Peak: ${narrative.peakDateRange || 'Active Window'}`,
    [16, 185, 129], // Emerald
    [255, 255, 255]
  );

  // SUPPLEMENTARY CROSS-DOMAIN SCENARIOS IN PDF
  if (narrative.supplementaryScenarios && narrative.supplementaryScenarios.length > 0) {
    checkPageBreak(25);
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(margin, y, contentWidth, 7, 1.5, 1.5, 'F');
    doc.setTextColor(245, 158, 11);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('SUPPLEMENTARY CROSS-DOMAIN IMPACT READOUTS (BHAVAT BHAVAM & DRISHTI)', margin + 4, y + 4.8);
    y += 9;

    for (const sc of narrative.supplementaryScenarios) {
      renderPartBlock(
        `${sc.title.toUpperCase()} [${sc.verdict}]`,
        `Reasoning: ${sc.astrologicalReasoning}\n\nActionable Guidance: ${sc.practicalGuidance}`,
        `Window: ${sc.timingWindow} | Confidence: ${(sc.confidenceScore * 100).toFixed(0)}%`,
        [79, 70, 229], // Indigo
        [248, 250, 252]
      );
    }
  }

  // WIRE AUDIT FOOTER NOTE
  checkPageBreak(16);
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, y, contentWidth, 12, 1.5, 1.5, 'F');
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(
    `Cryptographic Telemetry: Engine Protocol v2.5 • Endpoint: ${narrative.endpointUsed} • Status: ${narrative.connectionStatus}`,
    margin + 4,
    y + 5
  );
  doc.text(
    `Compliant with Parashara Hora Shastra principles (Mahadasha-Antardasha-Pratyantardasha alignment).`,
    margin + 4,
    y + 9
  );

  // Draw borders on all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(218, 165, 32);
    doc.setLineWidth(0.4);
    doc.rect(8, 8, pageWidth - 16, pageHeight - 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `Vedic Parashara Inference Report • Private LLM Audit Protocol • Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Save PDF file
  const filename = `Vedic_Inference_H${context.houseNumber}_${context.rashiName}_MD_${context.activeDasha.mahadasha}_AD_${context.activeDasha.antardasha}_PD_${context.activeDasha.pratyantardasha}.pdf`;
  doc.save(filename);
}
