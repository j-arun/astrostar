import { jsPDF } from 'jspdf';
import { VedicHouseContext, LLMThreePartNarrative, LLM_PROVIDERS } from './llm/types';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${sec.toFixed(1)}s (${m}m ${s}s)`;
}

function cleanNarrativeText(text: string | undefined): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && (trimmed.includes('"summarySentence"') || trimmed.includes('"part1_probabilityAndScope"'))) {
    try {
      const parsed = JSON.parse(trimmed);
      return parsed.part1_probabilityAndScope || parsed.summarySentence || trimmed;
    } catch {
      const match = trimmed.match(/"part1_probabilityAndScope"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (match && match[1]) {
        try {
          return JSON.parse(`"${match[1]}"`);
        } catch {
          return match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
        }
      }
    }
  }
  return trimmed;
}

function getReadableEngineName(providerId: string, modelName?: string): string {
  if (providerId === 'claude_sonnet' || providerId === 'claude') {
    return 'Claude Sonnet 5.5';
  }
  if (providerId === 'claude_haiku') {
    return 'Claude Haiku 5.5';
  }
  if (providerId === 'gemini_pro') {
    return 'Google Gemini Pro';
  }
  if (providerId === 'local_qwen') {
    return 'Ollama (Qwen 2.5 7B)';
  }
  if (modelName) {
    if (modelName.toLowerCase().includes('sonnet')) return 'Claude Sonnet 5.5';
    if (modelName.toLowerCase().includes('haiku')) return 'Claude Haiku 5.5';
    if (modelName.toLowerCase().includes('gemini')) return 'Google Gemini Pro';
    if (modelName.toLowerCase().includes('qwen') || modelName.toLowerCase().includes('ollama')) return 'Ollama (Qwen 2.5 7B)';
    return modelName;
  }
  return providerId;
}

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
  const contentWidth = pageWidth - margin * 2; // 182mm
  const bottomLimit = pageHeight - 18; // 279mm max Y before auto page break

  let currentY = 14;

  const monthName = MONTH_NAMES[context.selectedMonth] || `Month ${context.selectedMonth + 1}`;
  const year = context.selectedYear;
  const timePeriodText = `${monthName} ${year}`;

  const providerMeta = LLM_PROVIDERS[narrative.providerUsed] || {
    id: narrative.providerUsed,
    name: narrative.providerUsed === 'local_qwen' ? 'Local Qwen 2.5 7B (Ollama)' : narrative.providerUsed,
    badgeLabel: narrative.providerUsed,
    model: 'custom'
  };

  const modelName = narrative.ollamaStats?.model || providerMeta.model || (narrative.isPrivateLocal ? 'qwen2.5:7b-instruct' : 'gemini-3.8-flash');
  const engineDisplayName = getReadableEngineName(narrative.providerUsed, modelName);

  // Formatted Timestamp
  const now = new Date();
  const formattedTimestamp = now.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  // Safe pagination helper: checks space and starts a new page without any repeating heavy banners
  const ensureSpace = (neededHeight: number): void => {
    if (currentY + neededHeight > bottomLimit) {
      doc.addPage();
      currentY = 16; // Clean top margin for subsequent pages (no header banner)
    }
  };

  // Helper for Section Titles
  const renderSectionHeader = (title: string, subtitle?: string) => {
    ensureSpace(14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59); // Slate 800
    doc.text(title, margin, currentY + 4.5);

    if (subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(100, 116, 139); // Slate 500
      doc.text(subtitle, pageWidth - margin, currentY + 4.5, { align: 'right' });
    }

    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.setLineWidth(0.3);
    doc.line(margin, currentY + 6.8, pageWidth - margin, currentY + 6.8);
    currentY += 10.5;
  };

  // ========================================================================
  // PAGE 1 HEADER: TAMIL OM VEDIC HOROSCOPE ENGINE (PAGE 1 ONLY)
  // ========================================================================
  // Clean, editorial title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text('TAMIL OM VEDIC HOROSCOPE ENGINE', margin, currentY + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.text('Parashara & Jaimini Classical Transit Synthesis & Predictive Analysis', margin, currentY + 8.5);

  currentY += 11;

  // Metadata Card at Top
  const metaBoxHeight = 22;
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, currentY, contentWidth, metaBoxHeight, 1.5, 1.5, 'FD');

  const colWidth = (contentWidth - 6) / 4;

  // Col 1: Scope & Month
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('GENERATED FOR MONTH', margin + 3, currentY + 4.8);
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(timePeriodText, margin + 3, currentY + 9.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(71, 85, 105);
  const scopeLabel = context.isComprehensiveMonthly || !context.houseNumber
    ? 'Full-Month 12-Bhava'
    : `House ${context.houseNumber} (${context.rashiName || ''})`;
  doc.text(scopeLabel, margin + 3, currentY + 14.5);
  doc.text(context.isEventActive ? '● Transit Active' : '○ Baseline Window', margin + 3, currentY + 18.5);

  // Col 2: Engine / Model
  const col2X = margin + 2 + colWidth;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('GENERATED ENGINE', col2X, currentY + 4.8);
  doc.setFontSize(8.5);
  doc.setTextColor(146, 64, 14); // Amber 800
  doc.text(engineDisplayName, col2X, currentY + 9.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Model: ${modelName}`, col2X, currentY + 14.5);
  doc.text(`Engine: Tamil Om Vedic`, col2X, currentY + 18.5);

  // Col 3: Generated Timestamp & Timing
  const col3X = margin + 4 + colWidth * 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('GENERATED TIMESTAMP', col3X, currentY + 4.8);
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(formattedTimestamp, col3X, currentY + 9.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(71, 85, 105);
  doc.text('Vedic Ephemeris Sync', col3X, currentY + 14.5);
  doc.text(`Deterministic Sputa`, col3X, currentY + 18.5);

  // Col 4: Time Taken & Confidence
  const col4X = margin + 6 + colWidth * 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('TIME TAKEN', col4X, currentY + 4.8);
  doc.setFontSize(9);
  doc.setTextColor(21, 128, 61); // Emerald 700
  doc.text(formatDuration(narrative.executionTimeMs), col4X, currentY + 9.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Confidence: ${(narrative.overallConfidence * 100).toFixed(0)}%`, col4X, currentY + 14.5);
  doc.text(`Activation: ${(context.activationScore ?? 0).toFixed(2)}`, col4X, currentY + 18.5);

  currentY += metaBoxHeight + 5;

  // ========================================================================
  // SECTION 1: MAHADASHA HIERARCHY (DASHA TRIAD)
  // ========================================================================
  renderSectionHeader('1. VIMSHOTTARI DASHA HIERARCHY', 'Active Mahadasha, Antardasha & Pratyantardasha');

  const dColW = (contentWidth - 6) / 3;
  const dCardH = 17;

  // Outer container
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, currentY, contentWidth, dCardH, 1.5, 1.5, 'FD');

  // MD Box
  doc.setFillColor(254, 243, 199); // Amber 100
  doc.roundedRect(margin + 1.5, currentY + 1.5, dColW, dCardH - 3, 1, 1, 'F');
  doc.setTextColor(146, 64, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('MAHADASHA (MD)', margin + 3.5, currentY + 5.5);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9.5);
  doc.text(context.activeDasha.mahadasha || 'Lord', margin + 3.5, currentY + 9.8);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('Primary Planetary Period Lord', margin + 3.5, currentY + 13.2);

  // AD Box
  doc.setFillColor(224, 242, 254); // Sky 100
  doc.roundedRect(margin + 3 + dColW, currentY + 1.5, dColW, dCardH - 3, 1, 1, 'F');
  doc.setTextColor(3, 105, 161);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('ANTARDASHA (AD)', margin + 5 + dColW, currentY + 5.5);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9.5);
  doc.text(context.activeDasha.antardasha || 'Lord', margin + 5 + dColW, currentY + 9.8);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('Sub-Period Manifestor Lord', margin + 5 + dColW, currentY + 13.2);

  // PD Box
  doc.setFillColor(220, 252, 231); // Emerald 100
  doc.roundedRect(margin + 4.5 + dColW * 2, currentY + 1.5, dColW, dCardH - 3, 1, 1, 'F');
  doc.setTextColor(21, 128, 61);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('PRATYANTARDASHA (PD)', margin + 6.5 + dColW * 2, currentY + 5.5);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9.5);
  doc.text(context.activeDasha.pratyantardasha || 'Lord', margin + 6.5 + dColW * 2, currentY + 9.8);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(`Active: ${narrative.peakDateRange || 'Entire Month'}`, margin + 6.5 + dColW * 2, currentY + 13.2);

  currentY += dCardH + 5;

  // ========================================================================
  // SECTION 2: BOTTOM-LINE SYNTHESIS & NATAL PROMISE EVALUATION
  // ========================================================================
  renderSectionHeader('2. BOTTOM-LINE SYNTHESIS & NATAL FOUNDATION', 'Core Synthesis & Dual Evaluation');

  // DUAL EVALUATION CARD: NATAL PROMISE VS TRANSIT DELIVERY (IF PRESENT)
  if (narrative.natalPromiseVsTransitDelivery) {
    const pScore = narrative.natalPromiseVsTransitDelivery.natalPromiseScore ?? 0.88;
    const pVerdict = narrative.natalPromiseVsTransitDelivery.natalPromiseVerdict || 'Strong foundational promise confirmed.';
    const tScore = narrative.natalPromiseVsTransitDelivery.transitDeliveryScore ?? 0.78;
    const tVerdict = narrative.natalPromiseVsTransitDelivery.transitDeliveryVerdict || 'Active gochara transits deliver opportune window.';
    const sVerdict = narrative.natalPromiseVsTransitDelivery.synthesisVerdict || 'Combined Fruition: High manifest probability during evaluated micro-timing window.';

    const halfW = (contentWidth - 5) / 2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    const pLines = doc.splitTextToSize(pVerdict, halfW - 6);
    const tLines = doc.splitTextToSize(tVerdict, halfW - 6);
    const sLines = doc.splitTextToSize(`Synthesis Fruition: ${sVerdict}`, contentWidth - 8);

    const dualH = Math.max(24, Math.max(pLines.length, tLines.length) * 3.8 + sLines.length * 3.8 + 14);
    ensureSpace(dualH + 4);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, currentY, contentWidth, dualH, 1.5, 1.5, 'FD');

    // Natal Promise Box
    const colBoxH = Math.max(13, pLines.length * 3.8 + 6.5);
    doc.setFillColor(254, 243, 199); // Amber 100
    doc.roundedRect(margin + 2, currentY + 2, halfW, colBoxH, 1, 1, 'F');
    doc.setTextColor(146, 64, 14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.text(`1. NATAL PROMISE (D1/D9) — ${(pScore * 100).toFixed(0)}%`, margin + 4, currentY + 5.8);
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(pLines, margin + 4, currentY + 9.8);

    // Transit Delivery Box
    const transBoxH = Math.max(13, tLines.length * 3.8 + 6.5);
    doc.setFillColor(224, 242, 254); // Sky 100
    doc.roundedRect(margin + halfW + 3, currentY + 2, halfW, transBoxH, 1, 1, 'F');
    doc.setTextColor(3, 105, 161);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.text(`2. GOCHARA TRANSIT DELIVERY — ${(tScore * 100).toFixed(0)}%`, margin + halfW + 5, currentY + 5.8);
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(tLines, margin + halfW + 5, currentY + 9.8);

    // Combined Synthesis Strip
    const sBoxY = currentY + Math.max(colBoxH, transBoxH) + 3;
    const sBoxH = sLines.length * 3.8 + 5;
    doc.setFillColor(241, 245, 249); // Slate 100
    doc.roundedRect(margin + 2, sBoxY, contentWidth - 4, sBoxH, 1, 1, 'F');
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.text(sLines, margin + 4, sBoxY + 4.5);

    currentY += dualH + 4;
  }

  // BOTTOM-LINE SYNTHESIS VERDICT CARD (Clean, clearly wrapped, prominent)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const rawSummary = cleanNarrativeText(narrative.summarySentence) || 'Vedic Parashara synthesis completed.';
  const summaryLines = doc.splitTextToSize(rawSummary, contentWidth - 10);
  const summaryCardH = Math.max(15, summaryLines.length * 4.2 + 8.5);

  ensureSpace(summaryCardH + 4);

  // Soft cream background with amber accent border
  doc.setFillColor(255, 251, 235); // Amber 50
  doc.setDrawColor(245, 158, 11); // Amber 500
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, currentY, contentWidth, summaryCardH, 1.5, 1.5, 'FD');

  // Left solid accent bar
  doc.setFillColor(245, 158, 11);
  doc.rect(margin, currentY, 2.5, summaryCardH, 'F');

  doc.setTextColor(180, 83, 9); // Amber 700
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.text('BOTTOM-LINE SYNTHESIS VERDICT:', margin + 5, currentY + 5.5);

  doc.setTextColor(30, 41, 59); // Slate 800
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.text(summaryLines, margin + 5, currentY + 10.2);

  currentY += summaryCardH + 5;

  // ========================================================================
  // SECTION 3: CORE PARASHARA 3-PART PREDICTIONS
  // ========================================================================
  renderSectionHeader('3. CORE PARASHARA PREDICTIVE ANALYSIS', 'Deterministic Vedic Timing & Ingress Breakdowns');

  const renderCleanCard = (
    partTitle: string,
    rawText: string,
    badgeText: string,
    themeColor: [number, number, number]
  ) => {
    const cleaned = cleanNarrativeText(rawText) || 'No narrative commentary provided.';
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.6);
    const bodyLines = doc.splitTextToSize(cleaned, contentWidth - 8);
    const cardHeight = Math.max(18, bodyLines.length * 4.1 + 10);

    ensureSpace(cardHeight + 4);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, currentY, contentWidth, cardHeight, 1.5, 1.5, 'FD');

    // Clean title bar
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, currentY, contentWidth, 6.5, 1.5, 1.5, 'F');

    doc.setTextColor(themeColor[0], themeColor[1], themeColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.text(partTitle, margin + 4, currentY + 4.6);

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(6.8);
    doc.text(badgeText, pageWidth - margin - 4, currentY + 4.6, { align: 'right' });

    // Body Text
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(bodyLines, margin + 4, currentY + 10.8);

    currentY += cardHeight + 4;
  };

  renderCleanCard(
    'PART 1: EVENT PROBABILITY & SCOPE',
    narrative.part1_probabilityAndScope,
    `Confidence: ${(narrative.overallConfidence * 100).toFixed(0)}%`,
    [180, 83, 9] // Amber 700
  );

  renderCleanCard(
    'PART 2: FINANCIAL & RESOURCE SOURCES',
    narrative.part2_financialAndResources,
    'Capital & Liquidity Origin',
    [2, 132, 199] // Sky 600
  );

  renderCleanCard(
    'PART 3: MICRO-TIMING WINDOW (PRATYANTARDASHA)',
    narrative.part3_microTimingWindow,
    `Peak: ${narrative.peakDateRange || 'Active Month Window'}`,
    [16, 185, 129] // Emerald 600
  );

  // ========================================================================
  // SECTION 4: ALL 5 CORE LIFE DOMAINS PREDICTIONS & DEEP DIVES
  // ========================================================================
  renderSectionHeader('4. COMPREHENSIVE 5-DOMAIN LIFE PREDICTIONS', 'Career, Love & Romance, Wealth, Vitality & Family');

  const scenariosToRender = (narrative.supplementaryScenarios && narrative.supplementaryScenarios.length > 0)
    ? narrative.supplementaryScenarios
    : [
        {
          id: 'career_job',
          domain: 'career_job',
          title: 'CAREER & EMPLOYMENT STATUS',
          verdict: 'Active Momentum / Professional Progress',
          astrologicalReasoning: `10th house Karma and 6th house service receive favorable drishti. The active PD Lord (${context.activeDasha.pratyantardasha}) activates workplace responsibilities and professional visibility.`,
          practicalGuidance: 'Seize key initiatives mid-month; maintain collaborative dialogue with supervisors and prioritize execution over speculation.',
          confidenceScore: 0.85,
          timingWindow: narrative.peakDateRange || 'Days 8–24'
        },
        {
          id: 'love_romance',
          domain: 'love_romance',
          title: 'LOVE & ROMANTIC MANIFESTATION',
          verdict: 'Emotional Clarity / Constructive Bonding',
          astrologicalReasoning: 'Venus and Moon transits in relation to 5th and 7th lords foster affectionate warmth. Transit drishti softens prior misunderstandings.',
          practicalGuidance: 'Open communication yields mutual trust; avoid sensitive discussions during Chandrashtama dates.',
          confidenceScore: 0.82,
          timingWindow: 'Mid-Month Window'
        },
        {
          id: 'finance_wealth',
          domain: 'finance_wealth',
          title: 'WEALTH & CAPITAL INFLOWS',
          verdict: 'Resource Inflow / Prudent Asset Growth',
          astrologicalReasoning: '2nd house liquid reserves and 11th house gains indicate favorable inflow channels. Sarvashtakavarga strength supports calculated financial decisions.',
          practicalGuidance: 'Channel excess liquidity into secure collateral or high-stability instruments; defer speculative bets.',
          confidenceScore: 0.80,
          timingWindow: narrative.peakDateRange || 'Days 10–22'
        },
        {
          id: 'health_vitality',
          domain: 'health_vitality',
          title: 'HEALTH & PHYSICAL VITALITY',
          verdict: 'Stamina Stable / Pacing Recommended',
          astrologicalReasoning: '6th house and lagna lord configurations maintain solid constitutional resilience. Pacing recommended during Moon ingress.',
          practicalGuidance: 'Maintain regular sleep cycles, stay well-hydrated, and adopt moderate daily cardiovascular pacing.',
          confidenceScore: 0.88,
          timingWindow: 'Continuous Monthly Balance'
        },
        {
          id: 'family_home',
          domain: 'family_home',
          title: 'FAMILY & DOMESTIC AMBIANCE',
          verdict: 'Harmonious Foundation / Property Stability',
          astrologicalReasoning: '4th house Sukha and maternal significations remain well-supported under benefic rays and domestic peace alignment.',
          practicalGuidance: 'Invest time in domestic organization; celebrate familial milestones and support maternal health needs.',
          confidenceScore: 0.86,
          timingWindow: 'Entire Evaluated Month'
        }
      ];

  // Render each domain with dynamic flow and proper text wrapping
  scenariosToRender.forEach((sc: any) => {
    const rawDomainTitle = (sc.title || sc.domain).replace(/^[^\w\s]+/, '').trim();
    const verdict = sc.verdict || 'Evaluated';
    const subWindow = sc.timingWindow || 'Active Month';
    const conf = ((sc.confidenceScore ?? 0.85) * 100).toFixed(0);

    // Compute lines with proper wrapping
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    const reasonLines = doc.splitTextToSize(sc.astrologicalReasoning || 'Consistent with astrological indicators.', contentWidth - 8);
    const guideLines = doc.splitTextToSize(sc.practicalGuidance || 'Align timing with active planetary windows.', contentWidth - 8);

    // Deep dive subsections for Career, Romance, Finance, Health, Family
    const deepDiveBlocks: Array<{ title: string; lines: string[]; color: [number, number, number] }> = [];

    if (sc.id === 'career_job') {
      if (sc.employmentStatusInference) {
        deepDiveBlocks.push({
          title: `Native Employment State: [${sc.employmentStatusInference.label}]`,
          lines: doc.splitTextToSize(`Astrological Deduction (10th Karma & 6th Service): ${sc.employmentStatusInference.inferenceReasoning}`, contentWidth - 10),
          color: [146, 64, 14]
        });
      }
      if (sc.jobSearchAnalysis) {
        deepDiveBlocks.push({
          title: `Job Search & Transition Phase [Momentum: ${sc.jobSearchAnalysis.momentum || 'Active'}]:`,
          lines: doc.splitTextToSize(`Struggle vs Current Phase: ${sc.jobSearchAnalysis.pastStruggleVsCurrentPhase} • Auspicious Offer Window: ${sc.jobSearchAnalysis.timingAuspiciousness}`, contentWidth - 10),
          color: [2, 132, 199]
        });
      }
      if (sc.newJobAcquisition) {
        deepDiveBlocks.push({
          title: 'New Job Acquisition & Workplace Atmosphere:',
          lines: doc.splitTextToSize(`Role & Mood: ${sc.newJobAcquisition.jobTypeAndMood} • Atmosphere: ${sc.newJobAcquisition.workplaceAtmosphere} • Comparison: ${sc.newJobAcquisition.comparisonWithCurrentRole}`, contentWidth - 10),
          color: [21, 128, 61]
        });
      }
      if (sc.existingJobPhase) {
        deepDiveBlocks.push({
          title: 'Existing Job Phase (For Native Currently Serving):',
          lines: doc.splitTextToSize(`Workplace Climate: ${sc.existingJobPhase.currentPhaseNature} • Retention vs Exit Advice: ${sc.existingJobPhase.retentionVsExitAdvice}`, contentWidth - 10),
          color: [79, 70, 229]
        });
      }
    } else if (sc.id === 'love_romance') {
      if (sc.crushStatusInference) {
        deepDiveBlocks.push({
          title: `Crush Outlook & Potential [New Attraction: ${sc.crushStatusInference.newCrushProbability || 'Moderate'}]:`,
          lines: doc.splitTextToSize(`Existing Trajectory: ${sc.crushStatusInference.existingCrushTrajectory} • Attraction Trigger: ${sc.crushStatusInference.newCrushDetails}`, contentWidth - 10),
          color: [225, 29, 72]
        });
      }
      if (sc.romanceAtmosphere) {
        deepDiveBlocks.push({
          title: `Romance Chemistry (${sc.romanceAtmosphere.chemistryRating || 80}%) & Emotional Weather:`,
          lines: doc.splitTextToSize(sc.romanceAtmosphere.emotionalWeather, contentWidth - 10),
          color: [180, 83, 9]
        });
      }
      if (sc.manifestationPath) {
        deepDiveBlocks.push({
          title: `Love Manifestation Horizon [${sc.manifestationPath.outcomeLabel || 'Favorable'}]:`,
          lines: doc.splitTextToSize(`Likelihood: ${sc.manifestationPath.manifestationLikelihood} • Astrological Reasoning (5th, 7th & D9): ${sc.manifestationPath.astrologicalPathReasoning}`, contentWidth - 10),
          color: [21, 128, 61]
        });
      }
    } else if (sc.id === 'finance_wealth' && sc.financeDetails) {
      deepDiveBlocks.push({
        title: 'Liquid Cashflow & Asset Inflow Breakdown:',
        lines: doc.splitTextToSize(`Liquidity vs Outflow: ${sc.financeDetails.liquidityVsOutflow} • Windfalls: ${sc.financeDetails.windfallAndSpeculation} • Asset Financing: ${sc.financeDetails.debtAndAssetFinancing}`, contentWidth - 10),
        color: [180, 83, 9]
      });
    } else if (sc.id === 'health_vitality' && sc.healthDetails) {
      const vZones = (sc.healthDetails.vulnerableZones || []).join(', ') || 'Digestive pacing, solar vitality';
      deepDiveBlocks.push({
        title: `Health Significations & Vulnerable Zones [${vZones}]:`,
        lines: doc.splitTextToSize(`Mental Tranquility (Sukha): ${sc.healthDetails.mentalTranquilityAndStress} • Holistic Remedies: ${sc.healthDetails.holisticRemedies}`, contentWidth - 10),
        color: [225, 29, 72]
      });
    } else if (sc.id === 'family_home' && sc.familyDetails) {
      deepDiveBlocks.push({
        title: 'Domestic Ambiance & Maternal Significations:',
        lines: doc.splitTextToSize(`Domestic Ambiance: ${sc.familyDetails.domesticAmbiance} • Maternal Wellbeing: ${sc.familyDetails.maternalWellbeing} • Property & Relocation: ${sc.familyDetails.propertyAndRelocation}`, contentWidth - 10),
        color: [79, 70, 229]
      });
    }

    if (sc.detailedParagraphs && sc.detailedParagraphs.length > 0) {
      sc.detailedParagraphs.forEach((pText: string, pIdx: number) => {
        deepDiveBlocks.push({
          title: `In-Depth Analysis Section ${pIdx + 1}:`,
          lines: doc.splitTextToSize(pText, contentWidth - 10),
          color: [51, 65, 85]
        });
      });
    }

    // Dynamic height calculation for this domain card so it NEVER clips or overflows
    let totalDomainH = 8; // Title bar
    totalDomainH += 4 + reasonLines.length * 3.8 + 2; // Causal reasoning
    totalDomainH += 4 + guideLines.length * 3.8 + 3; // Practical guidance
    deepDiveBlocks.forEach(b => {
      totalDomainH += 5 + b.lines.length * 3.7 + 3;
    });
    totalDomainH += 4; // Padding

    // Check if card fits on current page. If it exceeds remaining space, break page cleanly
    ensureSpace(Math.min(totalDomainH, 70));

    // Outer card container
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, currentY, contentWidth, totalDomainH, 1.5, 1.5, 'FD');

    // Title bar
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, currentY, contentWidth, 7, 1.5, 1.5, 'F');

    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.text(rawDomainTitle, margin + 4, currentY + 4.8);

    doc.setTextColor(180, 83, 9);
    doc.setFontSize(7.2);
    doc.text(`[${verdict}]`, margin + 64, currentY + 4.8);

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(6.8);
    doc.text(`Window: ${subWindow} | Confidence: ${conf}%`, pageWidth - margin - 4, currentY + 4.8, { align: 'right' });

    let innerY = currentY + 10.5;

    // Causal Reasoning
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.text('Astrological Causal Rationale (Drishti & Karakatwa):', margin + 4, innerY);
    innerY += 3.8;

    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.text(reasonLines, margin + 4, innerY);
    innerY += reasonLines.length * 3.8 + 2.5;

    // Guidance
    doc.setTextColor(16, 185, 129); // Emerald
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.text('Practical Remedial Guidance:', margin + 4, innerY);
    innerY += 3.8;

    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.text(guideLines, margin + 4, innerY);
    innerY += guideLines.length * 3.8 + 3;

    // Deep dive blocks
    deepDiveBlocks.forEach(b => {
      const bH = b.lines.length * 3.7 + 6;
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin + 2, innerY - 2, contentWidth - 4, bH, 1, 1, 'F');

      doc.setTextColor(b.color[0], b.color[1], b.color[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.text(b.title, margin + 4, innerY + 1.2);

      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(b.lines, margin + 4, innerY + 5.2);

      innerY += bH + 2;
    });

    currentY += totalDomainH + 4;
  });

  // ========================================================================
  // FINAL PASS: SUBTLE FOOTERS ON ALL PAGES (NO TELEMETRY BLACK BOXES, NO GOLDEN CLIPPING BORDERS)
  // ========================================================================
  const totalPages = (doc as any).internal.getNumberOfPages();

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Subtle bottom rule line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);

    // Clean, elegant footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text(
      'Tamil Om Vedic Horoscope Engine',
      margin,
      pageHeight - 6.5
    );

    doc.text(
      `Page ${p} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 6.5,
      { align: 'center' }
    );

    doc.text(
      timePeriodText,
      pageWidth - margin,
      pageHeight - 6.5,
      { align: 'right' }
    );
  }

  // Determine provider label for filename: Gemini | Ollama | Claude-Sonnet | Claude-Haiku
  let providerTag = 'Gemini';
  if (narrative.providerUsed === 'local_qwen') {
    providerTag = 'Ollama-7B';
  } else if (narrative.providerUsed === 'claude_sonnet' || narrative.providerUsed === 'claude') {
    providerTag = 'Claude-Sonnet';
  } else if (narrative.providerUsed === 'claude_haiku') {
    providerTag = 'Claude-Haiku';
  } else if (narrative.providerUsed === 'gemini_pro') {
    providerTag = 'Gemini';
  } else {
    providerTag = narrative.isPrivateLocal ? 'LocalLLM' : 'Gemini';
  }

  const filename = `${monthName}_${year}_${providerTag}_AstroPredictions.pdf`;
  doc.save(filename);
}
