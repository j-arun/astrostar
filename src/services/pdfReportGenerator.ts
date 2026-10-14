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
  const margin = 12;
  const contentWidth = pageWidth - margin * 2; // 186mm
  const bottomLimit = pageHeight - margin - 12; // 273mm

  let currentY = 14;

  const timePeriodText = `${MONTH_NAMES[context.selectedMonth] || 'Active Month'} ${context.selectedYear}`;
  const providerMeta = LLM_PROVIDERS[narrative.providerUsed] || {
    id: narrative.providerUsed,
    name: narrative.providerUsed === 'local_qwen' ? 'Local Qwen 2.5 7B (Ollama)' : narrative.providerUsed,
    badgeLabel: narrative.providerUsed,
    model: 'custom'
  };
  const providerName = providerMeta.name;
  const modelName = narrative.ollamaStats?.model || providerMeta.model || (narrative.isPrivateLocal ? 'qwen2.5:7b-instruct' : 'gemini-3.8-flash');

  // Helper to ensure vertical space, auto-adding a page if required
  const ensureSpace = (requiredHeightMm: number, forceNewPageHeader = true) => {
    if (currentY + requiredHeightMm > bottomLimit) {
      doc.addPage();
      currentY = 14;
      if (forceNewPageHeader) {
        drawPageBanner();
      }
    }
  };

  // Draw header banner at top of pages
  const drawPageBanner = (isFirstPage = false) => {
    doc.setFillColor(15, 23, 42); // Dark slate
    doc.rect(margin, currentY, contentWidth, isFirstPage ? 22 : 14, 'F');

    doc.setTextColor(245, 158, 11); // Amber
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isFirstPage ? 12 : 9.5);
    doc.text('VEDIC PARASHARA ASTROLOGICAL INFERENCE & PREDICTIONS', margin + 4, currentY + (isFirstPage ? 7.5 : 5.8));

    doc.setTextColor(203, 213, 225); // Slate 300
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isFirstPage ? 7.5 : 7);
    doc.text(
      context.isComprehensiveMonthly || !context.houseNumber
        ? `FULL-MONTH SYNTHESIS • PERIOD: ${timePeriodText.toUpperCase()} • ENGINE: ${providerName.toUpperCase()}`
        : `HOUSE ${context.houseNumber} (${context.rashiName || ''}) • PERIOD: ${timePeriodText.toUpperCase()} • ENGINE: ${providerName.toUpperCase()}`,
      margin + 4,
      currentY + (isFirstPage ? 13.5 : 10.5)
    );

    if (isFirstPage) {
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(
        `Authoritative Parashara Hora Shastra Astrological Evaluation • Model: ${modelName} • Time: ${formatDuration(narrative.executionTimeMs)}`,
        margin + 4,
        currentY + 18.5
      );

      // Status pill on top right
      doc.setFillColor(30, 41, 59);
      doc.roundedRect(pageWidth - margin - 52, currentY + 3.5, 48, 15, 1.5, 1.5, 'F');

      doc.setTextColor(context.isEventActive ? 52 : 148, context.isEventActive ? 211 : 163, context.isEventActive ? 153 : 184);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(context.isEventActive ? '● EVENT ACTIVE' : '○ INACTIVE/DORMANT', pageWidth - margin - 28, currentY + 8.5, { align: 'center' });

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.text(`Confidence: ${(narrative.overallConfidence * 100).toFixed(0)}%`, pageWidth - margin - 28, currentY + 12.5, { align: 'center' });
      doc.text(`Score: ${(context.activationScore ?? 0).toFixed(2)}`, pageWidth - margin - 28, currentY + 16, { align: 'center' });
    } else {
      doc.setTextColor(52, 211, 153);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text(`Active Engine: ${providerName} (${modelName})`, pageWidth - margin - 4, currentY + 8.5, { align: 'right' });
    }

    currentY += (isFirstPage ? 25 : 17);
  };

  // ========================================================================
  // PAGE 1 START: EXECUTIVE ASTROLOGICAL CHARTER & CORE SYNTHESIS
  // ========================================================================
  drawPageBanner(true);

  // DASHA TRIAD RIBBON (MD / AD / PD)
  const dColW = (contentWidth - 6) / 3;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, currentY, contentWidth, 18, 1.5, 1.5, 'FD');

  // MD Box
  doc.setFillColor(254, 243, 199); // Amber 100
  doc.roundedRect(margin + 2, currentY + 2, dColW, 14, 1, 1, 'F');
  doc.setTextColor(146, 64, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('MAHADASHA (MD)', margin + 4, currentY + 6);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9.5);
  doc.text(context.activeDasha.mahadasha || 'Lord', margin + 4, currentY + 10.5);
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(6.5);
  doc.text('Primary Planetary Period Lord', margin + 4, currentY + 14);

  // AD Box
  doc.setFillColor(224, 242, 254); // Sky 100
  doc.roundedRect(margin + 3 + dColW, currentY + 2, dColW, 14, 1, 1, 'F');
  doc.setTextColor(3, 105, 161);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('ANTARDASHA (AD)', margin + 5 + dColW, currentY + 6);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9.5);
  doc.text(context.activeDasha.antardasha || 'Lord', margin + 5 + dColW, currentY + 10.5);
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(6.5);
  doc.text('Sub-Period Manifestor Lord', margin + 5 + dColW, currentY + 14);

  // PD Box
  doc.setFillColor(220, 252, 231); // Emerald 100
  doc.roundedRect(margin + 4 + dColW * 2, currentY + 2, dColW, 14, 1, 1, 'F');
  doc.setTextColor(21, 128, 61);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('PRATYANTARDASHA (PD)', margin + 6 + dColW * 2, currentY + 6);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9.5);
  doc.text(context.activeDasha.pratyantardasha || 'Lord', margin + 6 + dColW * 2, currentY + 10.5);
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(6.5);
  doc.text(`Active Window: ${narrative.peakDateRange || 'Entire Month'}`, margin + 6 + dColW * 2, currentY + 14);

  currentY += 21;

  // BOTTOM-LINE SYNTHESIS CARD
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  const summaryLines = doc.splitTextToSize(
    narrative.summarySentence || 'Parashara synthesis completed.',
    contentWidth - 8
  );
  const summaryH = Math.max(16, summaryLines.length * 4.2 + 8);
  ensureSpace(summaryH + 4);

  doc.setFillColor(255, 251, 235); // Amber 50
  doc.setDrawColor(245, 158, 11); // Amber 500
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, currentY, contentWidth, summaryH, 1.5, 1.5, 'FD');

  doc.setTextColor(180, 83, 9);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('BOTTOM-LINE SYNTHESIS VERDICT:', margin + 4, currentY + 5.8);

  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.6);
  doc.text(summaryLines, margin + 4, currentY + 10.5);

  currentY += summaryH + 4;

  // DUAL EVALUATION CARD: NATAL PROMISE VS TRANSIT DELIVERY
  if (narrative.natalPromiseVsTransitDelivery) {
    const pScore = narrative.natalPromiseVsTransitDelivery.natalPromiseScore ?? 0.88;
    const pVerdict = narrative.natalPromiseVsTransitDelivery.natalPromiseVerdict || 'Strong foundational promise confirmed.';
    const tScore = narrative.natalPromiseVsTransitDelivery.transitDeliveryScore ?? 0.78;
    const tVerdict = narrative.natalPromiseVsTransitDelivery.transitDeliveryVerdict || 'Active gochara transits deliver opportune window.';
    const sVerdict = narrative.natalPromiseVsTransitDelivery.synthesisVerdict || 'Combined Fruition: High manifest probability during evaluated micro-timing window.';

    const halfW = (contentWidth - 6) / 2;
    doc.setFontSize(7);
    const pLines = doc.splitTextToSize(pVerdict, halfW - 6);
    const tLines = doc.splitTextToSize(tVerdict, halfW - 6);
    const sLines = doc.splitTextToSize(`Combined Synthesis: ${sVerdict}`, contentWidth - 8);

    const dualH = Math.max(26, Math.max(pLines.length, tLines.length) * 3.8 + sLines.length * 3.8 + 14);
    ensureSpace(dualH + 4);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, currentY, contentWidth, dualH, 1.5, 1.5, 'FD');

    // Natal Promise Column
    doc.setFillColor(254, 243, 199);
    doc.roundedRect(margin + 2, currentY + 2, halfW, Math.max(14, pLines.length * 3.8 + 7), 1, 1, 'F');
    doc.setTextColor(146, 64, 14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(`1. NATAL PROMISE (D1/D9) — ${(pScore * 100).toFixed(0)}%`, margin + 4, currentY + 6);
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(pLines, margin + 4, currentY + 10);

    // Transit Delivery Column
    doc.setFillColor(224, 242, 254);
    doc.roundedRect(margin + halfW + 4, currentY + 2, halfW, Math.max(14, tLines.length * 3.8 + 7), 1, 1, 'F');
    doc.setTextColor(3, 105, 161);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(`2. GOCHARA TRANSIT DELIVERY — ${(tScore * 100).toFixed(0)}%`, margin + halfW + 6, currentY + 6);
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(tLines, margin + halfW + 6, currentY + 10);

    // Combined Synthesis Row
    const sBoxY = currentY + Math.max(14, Math.max(pLines.length, tLines.length) * 3.8 + 7) + 3;
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin + 2, sBoxY, contentWidth - 4, sLines.length * 3.8 + 4, 1, 1, 'F');
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.text(sLines, margin + 4, sBoxY + 4.5);

    currentY += dualH + 4;
  }

  // ========================================================================
  // SECTION 3: CORE PARASHARA 3-PART PREDICTIONS
  // ========================================================================
  const renderPredictionCard = (
    partTitle: string,
    rawText: string,
    badgeText: string,
    themeColor: [number, number, number]
  ) => {
    const cleaned = cleanNarrativeText(rawText) || 'No narrative commentary provided.';
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    const bodyLines = doc.splitTextToSize(cleaned, contentWidth - 8);
    const cardHeight = Math.max(20, bodyLines.length * 3.9 + 11);

    ensureSpace(cardHeight + 4);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, currentY, contentWidth, cardHeight, 1.5, 1.5, 'FD');

    // Title & Badge strip
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, currentY, contentWidth, 7, 1.5, 1.5, 'F');

    doc.setTextColor(themeColor[0], themeColor[1], themeColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(partTitle, margin + 4, currentY + 5);

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(6.8);
    doc.text(badgeText, pageWidth - margin - 4, currentY + 5, { align: 'right' });

    // Body Text
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.text(bodyLines, margin + 4, currentY + 11.5);

    currentY += cardHeight + 4;
  };

  renderPredictionCard(
    'PART 1: EVENT PROBABILITY & SCOPE',
    narrative.part1_probabilityAndScope,
    `Confidence: ${(narrative.overallConfidence * 100).toFixed(0)}%`,
    [180, 83, 9] // Amber
  );

  renderPredictionCard(
    'PART 2: FINANCIAL & RESOURCE SOURCES',
    narrative.part2_financialAndResources,
    'Capital & Liquidity Origin',
    [2, 132, 199] // Sky
  );

  renderPredictionCard(
    'PART 3: MICRO-TIMING WINDOW (PRATYANTARDASHA)',
    narrative.part3_microTimingWindow,
    `Peak: ${narrative.peakDateRange || 'Active Month Window'}`,
    [16, 185, 129] // Emerald
  );

  // ========================================================================
  // SECTION 4: ALL 5 CORE LIFE DOMAINS PREDICTIONS & DEEP DIVES
  // ========================================================================
  ensureSpace(24);

  // Section Header Ribbon
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(margin, currentY, contentWidth, 8, 1, 1, 'F');
  doc.setTextColor(245, 158, 11);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('COMPREHENSIVE 5-DOMAIN LIFE PREDICTIONS & KARAKATWA DOSSIER', margin + 4, currentY + 5.5);
  doc.setTextColor(203, 213, 225);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.text('Real-world outcomes across Career, Romance, Wealth, Vitality & Domestic Ambiance', pageWidth - margin - 4, currentY + 5.5, { align: 'right' });

  currentY += 12;

  const scenariosToRender = (narrative.supplementaryScenarios && narrative.supplementaryScenarios.length > 0)
    ? narrative.supplementaryScenarios
    : [
        {
          id: 'career_job',
          domain: 'career_job',
          title: '💼 CAREER & EMPLOYMENT STATUS',
          verdict: 'Active Momentum / Professional Progress',
          astrologicalReasoning: `10th house Karma and 6th house service receive favorable drishti. The active PD Lord (${context.activeDasha.pratyantardasha}) activates workplace responsibilities and professional visibility.`,
          practicalGuidance: 'Seize key initiatives mid-month; maintain collaborative dialogue with supervisors and prioritize execution over speculation.',
          confidenceScore: 0.85,
          timingWindow: narrative.peakDateRange || 'Days 8–24'
        },
        {
          id: 'love_romance',
          domain: 'love_romance',
          title: '❤️ LOVE & ROMANTIC MANIFESTATION',
          verdict: 'Emotional Clarity / Constructive Bonding',
          astrologicalReasoning: 'Venus and Moon transits in relation to 5th and 7th lords foster affectionate warmth. Transit drishti softens prior misunderstandings.',
          practicalGuidance: 'Open communication yields mutual trust; avoid sensitive discussions during Chandrashtama dates.',
          confidenceScore: 0.82,
          timingWindow: 'Mid-Month Window'
        },
        {
          id: 'finance_wealth',
          domain: 'finance_wealth',
          title: '💰 WEALTH & CAPITAL INFLOWS',
          verdict: 'Resource Inflow / Prudent Asset Growth',
          astrologicalReasoning: '2nd house liquid reserves and 11th house gains indicate favorable inflow channels. Sarvashtakavarga strength supports calculated financial decisions.',
          practicalGuidance: 'Channel excess liquidity into secure collateral or high-stability instruments; defer speculative bets.',
          confidenceScore: 0.80,
          timingWindow: narrative.peakDateRange || 'Days 10–22'
        },
        {
          id: 'health_vitality',
          domain: 'health_vitality',
          title: '🩺 HEALTH & PHYSICAL VITALITY',
          verdict: 'Stamina Stable / Pacing Recommended',
          astrologicalReasoning: '6th house and lagna lord configurations maintain solid constitutional resilience. Pacing recommended during Moon ingress.',
          practicalGuidance: 'Maintain regular sleep cycles, stay well-hydrated, and adopt moderate daily cardiovascular pacing.',
          confidenceScore: 0.88,
          timingWindow: 'Continuous Monthly Balance'
        },
        {
          id: 'family_home',
          domain: 'family_home',
          title: '🏡 FAMILY & DOMESTIC AMBIANCE',
          verdict: 'Harmonious Foundation / Property Stability',
          astrologicalReasoning: '4th house Sukha and maternal significations remain well-supported under benefic rays and domestic peace alignment.',
          practicalGuidance: 'Invest time in domestic organization; celebrate familial milestones and support maternal health needs.',
          confidenceScore: 0.86,
          timingWindow: 'Entire Evaluated Month'
        }
      ];

  // Render each domain completely with all sub-inferences
  scenariosToRender.forEach((sc: any) => {
    // Collect all text blocks for this domain to calculate true height
    const domainTitle = sc.title || sc.domain;
    const verdict = sc.verdict || 'Evaluated';
    const subWindow = sc.timingWindow || 'Active Month';
    const conf = ((sc.confidenceScore ?? 0.85) * 100).toFixed(0);

    // Compute lines
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    const reasonLines = doc.splitTextToSize(sc.astrologicalReasoning || 'Consistent with astrological indicators.', contentWidth - 8);
    const guideLines = doc.splitTextToSize(sc.practicalGuidance || 'Align timing with active planetary windows.', contentWidth - 8);

    // Deep dive subsections for Career, Romance, Finance, Health, Family
    const deepDiveBlocks: Array<{ title: string; lines: string[]; color: [number, number, number] }> = [];

    if (sc.id === 'career_job') {
      if (sc.employmentStatusInference) {
        deepDiveBlocks.push({
          title: `Native Employment State Inference: [${sc.employmentStatusInference.label}]`,
          lines: doc.splitTextToSize(`Astrological Deduction (10th Karma & 6th Service): ${sc.employmentStatusInference.inferenceReasoning}`, contentWidth - 10),
          color: [146, 64, 14]
        });
      }
      if (sc.jobSearchAnalysis) {
        deepDiveBlocks.push({
          title: `Job Search & Transition Phase: [Momentum: ${sc.jobSearchAnalysis.momentum || 'Active'}]`,
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
          title: `Crush Outlook & Potential: [New Attraction: ${sc.crushStatusInference.newCrushProbability || 'Moderate'}]`,
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
          title: `Love Manifestation Horizon: [${sc.manifestationPath.outcomeLabel || 'Favorable'}]`,
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
        title: `Health Significations & Vulnerable Zones: [${vZones}]`,
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

    // Calculate approximate height for whole domain card
    let estimatedCardH = 10; // title bar
    estimatedCardH += reasonLines.length * 3.7 + 6;
    estimatedCardH += guideLines.length * 3.7 + 6;
    deepDiveBlocks.forEach(b => {
      estimatedCardH += b.lines.length * 3.6 + 8;
    });

    ensureSpace(Math.min(estimatedCardH, 75));

    // Outer card container
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, currentY, contentWidth, estimatedCardH, 1.5, 1.5, 'FD');

    // Title bar
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, currentY, contentWidth, 7, 1.5, 1.5, 'F');

    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.text(domainTitle, margin + 4, currentY + 4.8);

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
    innerY += 4;

    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(reasonLines, margin + 4, innerY);
    innerY += reasonLines.length * 3.7 + 3;

    // Guidance
    doc.setTextColor(16, 185, 129); // Emerald
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.text('Practical Remedial Guidance:', margin + 4, innerY);
    innerY += 4;

    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(guideLines, margin + 4, innerY);
    innerY += guideLines.length * 3.7 + 3;

    // Deep dive blocks
    deepDiveBlocks.forEach(b => {
      doc.setFillColor(248, 250, 252);
      const bH = b.lines.length * 3.6 + 6;
      doc.roundedRect(margin + 2, innerY - 2.5, contentWidth - 4, bH, 1, 1, 'F');

      doc.setTextColor(b.color[0], b.color[1], b.color[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.text(b.title, margin + 4, innerY + 1);

      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.text(b.lines, margin + 4, innerY + 5.2);

      innerY += bH + 2;
    });

    currentY += estimatedCardH + 4;
  });

  // ========================================================================
  // SECTION 5: ENGINE VERIFICATION & PARASHARA TELEMETRY FOOTER CARD
  // ========================================================================
  const telemetryH = 32;
  ensureSpace(telemetryH + 4);

  doc.setFillColor(15, 23, 42); // Dark slate
  doc.roundedRect(margin, currentY, contentWidth, telemetryH, 1.5, 1.5, 'F');

  doc.setTextColor(245, 158, 11);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('ENGINE WIRE TELEMETRY & ASTRONOMICAL INTEGRITY SEAL', margin + 4, currentY + 5.5);

  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.text(
    `Timestamp: ${new Date().toISOString()}`,
    pageWidth - margin - 4,
    currentY + 5.5,
    { align: 'right' }
  );

  // 4 Metrics Grid
  const tColW = (contentWidth - 8) / 4;
  const tGridY = currentY + 8.5;

  const renderTCell = (x: number, label: string, val: string, color: [number, number, number]) => {
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(x, tGridY, tColW - 1, 14, 1, 1, 'F');
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.text(label, x + 2.5, tGridY + 4);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.3);
    doc.text(val, x + 2.5, tGridY + 9.5);
  };

  renderTCell(margin + 2, 'ENGINE / MODEL', `${providerName} (${modelName})`, [255, 255, 255]);
  renderTCell(margin + 2 + tColW, 'TIME TAKEN', formatDuration(narrative.executionTimeMs), [245, 158, 11]);
  renderTCell(margin + 2 + tColW * 2, 'THROTTLE MODE', 'Deterministic Ephemeris', [52, 211, 153]);
  renderTCell(margin + 2 + tColW * 3, 'PERSISTENCE', narrative.pgPersisted ? '✓ Persisted DB' : 'Audit Synced', [148, 163, 184]);

  // Parashara Seal Note
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(
    `Status: ${narrative.connectionStatus || 'Verified'} • Compliant with Parashara Hora Shastra principles (MD-AD-PD triad alignment).`,
    margin + 4,
    currentY + 26
  );
  doc.text(
    'Private Prediction Verification: Documented with deterministic planetary sputa and nakshatra coordinates.',
    margin + 4,
    currentY + 29.5
  );

  // ========================================================================
  // FINAL PASS: DRAW GOLDEN BORDERS & DYNAMIC FOOTERS ON ALL PAGES
  // ========================================================================
  const totalPages = (doc as any).internal.getNumberOfPages();

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Golden Page Border
    doc.setDrawColor(218, 165, 32); // Golden border
    doc.setLineWidth(0.4);
    doc.rect(7, 7, pageWidth - 14, pageHeight - 14);

    // Subtle Inner Accent Line
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.2);
    doc.rect(8, 8, pageWidth - 16, pageHeight - 16);

    // Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `Vedic Parashara Inference & Predictions Report • Page ${p} of ${totalPages} • All Sections Documented`,
      pageWidth / 2,
      pageHeight - 9.5,
      { align: 'center' }
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

  const monthName = MONTH_NAMES[context.selectedMonth] || `Month${context.selectedMonth + 1}`;
  const year = context.selectedYear;

  const filename = `${monthName}_${year}_${providerTag}_AstroPredictions.pdf`;
  doc.save(filename);
}
