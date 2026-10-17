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

function escapeHtml(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getReadableEngineName(providerId: string, modelName?: string): string {
  if (providerId === 'claude_sonnet' || providerId === 'claude') {
    return 'Claude Sonnet 5.5';
  }
  if (providerId === 'claude_haiku') {
    return 'Claude Haiku 5.5';
  }
  if (providerId === 'claude_fable') {
    return 'Claude Fable 5.1';
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

export function buildVedicWordContent(
  context: VedicHouseContext,
  narrative: LLMThreePartNarrative
): string {
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

  const now = new Date();
  const formattedTimestamp = now.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const scopeLabel = context.isComprehensiveMonthly || !context.houseNumber
    ? 'Full-Month 12-Bhava Comprehensive Synthesis'
    : `House ${context.houseNumber} (${context.rashiName || 'Bhava'}) Activation`;

  const scenariosToRender = (narrative.supplementaryScenarios && narrative.supplementaryScenarios.length > 0)
    ? narrative.supplementaryScenarios
    : [
        {
          id: 'career_job',
          domain: 'career_job',
          title: 'Career & Professional Trajectory',
          verdict: 'Active Momentum / Professional Progress',
          astrologicalReasoning: `10th house Karma and 6th house service receive favorable drishti. The active PD Lord (${context.activeDasha.pratyantardasha}) activates workplace responsibilities and professional visibility.`,
          practicalGuidance: 'Seize key initiatives mid-month; maintain collaborative dialogue with supervisors and prioritize execution over speculation.',
          confidenceScore: 0.85,
          timingWindow: narrative.peakDateRange || 'Days 8–24'
        },
        {
          id: 'love_romance',
          domain: 'love_romance',
          title: 'Love & Romantic Manifestation',
          verdict: 'Emotional Clarity / Constructive Bonding',
          astrologicalReasoning: 'Venus and Moon transits in relation to 5th and 7th lords foster affectionate warmth. Transit drishti softens prior misunderstandings.',
          practicalGuidance: 'Open communication yields mutual trust; avoid sensitive discussions during Chandrashtama dates.',
          confidenceScore: 0.82,
          timingWindow: 'Mid-Month Window'
        },
        {
          id: 'finance_wealth',
          domain: 'finance_wealth',
          title: 'Wealth & Capital Inflows',
          verdict: 'Resource Inflow / Prudent Asset Growth',
          astrologicalReasoning: '2nd house liquid reserves and 11th house gains indicate favorable inflow channels. Sarvashtakavarga strength supports calculated financial decisions.',
          practicalGuidance: 'Channel excess liquidity into secure collateral or high-stability instruments; defer speculative bets.',
          confidenceScore: 0.80,
          timingWindow: narrative.peakDateRange || 'Days 10–22'
        },
        {
          id: 'health_vitality',
          domain: 'health_vitality',
          title: 'Health & Physical Vitality',
          verdict: 'Stamina Stable / Pacing Recommended',
          astrologicalReasoning: '6th house and lagna lord configurations maintain solid constitutional resilience. Pacing recommended during Moon ingress.',
          practicalGuidance: 'Maintain regular sleep cycles, stay well-hydrated, and adopt moderate daily cardiovascular pacing.',
          confidenceScore: 0.88,
          timingWindow: 'Continuous Monthly Balance'
        },
        {
          id: 'family_home',
          domain: 'family_home',
          title: 'Family & Domestic Ambiance',
          verdict: 'Harmonious Foundation / Property Stability',
          astrologicalReasoning: '4th house Sukha and maternal significations remain well-supported under benefic rays and domestic peace alignment.',
          practicalGuidance: 'Invest time in domestic organization; celebrate familial milestones and support maternal health needs.',
          confidenceScore: 0.86,
          timingWindow: 'Entire Evaluated Month'
        }
      ];

  // Microsoft Word HTML format with Word namespaces
  const docHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>Tamil Om Vedic Horoscope Report</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page WordSection1 {
      size: 21.0cm 29.7cm;
      margin: 2.0cm 2.0cm 2.0cm 2.0cm;
      mso-header-margin: 1.0cm;
      mso-footer-margin: 1.0cm;
      mso-paper-source: 0;
    }
    div.WordSection1 {
      page: WordSection1;
    }
    body {
      font-family: Calibri, 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.45;
      color: #1e293b;
      margin: 0;
      padding: 0;
    }
    h1 {
      font-size: 20pt;
      font-weight: bold;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 2pt;
      border-bottom: 2pt solid #d97706;
      padding-bottom: 4pt;
    }
    h2 {
      font-size: 13pt;
      font-weight: bold;
      color: #0f172a;
      background: #f1f5f9;
      border-left: 4pt solid #d97706;
      padding: 4pt 8pt;
      margin-top: 14pt;
      margin-bottom: 6pt;
    }
    h3 {
      font-size: 11pt;
      font-weight: bold;
      color: #0f172a;
      margin-top: 8pt;
      margin-bottom: 3pt;
    }
    p {
      margin-top: 0;
      margin-bottom: 6pt;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10pt;
    }
    td, th {
      padding: 6pt 8pt;
      border: 1pt solid #cbd5e1;
      font-size: 10pt;
      vertical-align: top;
    }
    th {
      background-color: #f8fafc;
      font-weight: bold;
      color: #475569;
      text-align: left;
    }
    .badge {
      display: inline-block;
      padding: 2pt 6pt;
      font-size: 9pt;
      font-weight: bold;
      border-radius: 3pt;
    }
    .badge-amber {
      background-color: #fef3c7;
      color: #92400e;
      border: 1pt solid #fde68a;
    }
    .badge-sky {
      background-color: #e0f2fe;
      color: #0369a1;
      border: 1pt solid #bae6fd;
    }
    .badge-emerald {
      background-color: #dcfce7;
      color: #15803d;
      border: 1pt solid #bbf7d0;
    }
    .verdict-box {
      background-color: #fffbeb;
      border: 1.5pt solid #f59e0b;
      border-left: 5pt solid #d97706;
      padding: 8pt 12pt;
      margin-bottom: 12pt;
    }
    .deep-dive-box {
      background-color: #f8fafc;
      border: 1pt solid #e2e8f0;
      padding: 6pt 8pt;
      margin-top: 4pt;
      margin-bottom: 6pt;
      font-size: 9.5pt;
    }
    .footer-text {
      font-size: 9pt;
      color: #64748b;
      border-top: 1pt solid #e2e8f0;
      padding-top: 6pt;
      margin-top: 20pt;
    }
  </style>
</head>
<body>
<div class="WordSection1">

  <!-- Main Header -->
  <h1>TAMIL OM VEDIC HOROSCOPE ENGINE</h1>
  <p style="font-size: 10pt; color: #64748b; margin-bottom: 10pt;">
    Parashara &amp; Jaimini Classical Transit Synthesis &amp; Predictive Analysis
  </p>

  <!-- Metadata Summary Table -->
  <table>
    <tr style="background-color: #f8fafc;">
      <th style="width: 25%;">GENERATED FOR MONTH</th>
      <th style="width: 25%;">GENERATED ENGINE</th>
      <th style="width: 25%;">GENERATED TIMESTAMP</th>
      <th style="width: 25%;">TIME TAKEN</th>
    </tr>
    <tr>
      <td>
        <strong style="font-size: 11pt; color: #0f172a;">${escapeHtml(timePeriodText)}</strong><br>
        <span style="font-size: 9pt; color: #64748b;">${escapeHtml(scopeLabel)}</span>
      </td>
      <td>
        <strong style="font-size: 11pt; color: #b45309;">${escapeHtml(engineDisplayName)}</strong><br>
        <span style="font-size: 9pt; color: #64748b;">Model: ${escapeHtml(modelName)}</span>
      </td>
      <td>
        <strong>${escapeHtml(formattedTimestamp)}</strong><br>
        <span style="font-size: 9pt; color: #64748b;">Tamil Om Ephemeris Sync</span>
      </td>
      <td>
        <strong style="color: #16a34a; font-size: 11pt;">${escapeHtml(formatDuration(narrative.executionTimeMs))}</strong><br>
        <span style="font-size: 9pt; color: #64748b;">Confidence: ${(narrative.overallConfidence * 100).toFixed(0)}%</span>
      </td>
    </tr>
  </table>

  <!-- 1. Vimshottari Dasha Hierarchy -->
  <h2>1. VIMSHOTTARI DASHA HIERARCHY</h2>
  <table>
    <tr>
      <td style="background-color: #fef3c7; border: 1pt solid #fde68a; width: 33%;">
        <span style="font-size: 8.5pt; font-weight: bold; color: #92400e;">MAHADASHA (MD)</span><br>
        <strong style="font-size: 13pt; color: #0f172a;">${escapeHtml(context.activeDasha.mahadasha || 'Lord')}</strong><br>
        <span style="font-size: 9pt; color: #64748b;">Primary Karmic Ruler</span>
      </td>
      <td style="background-color: #e0f2fe; border: 1pt solid #bae6fd; width: 33%;">
        <span style="font-size: 8.5pt; font-weight: bold; color: #0369a1;">ANTARDASHA (AD)</span><br>
        <strong style="font-size: 13pt; color: #0f172a;">${escapeHtml(context.activeDasha.antardasha || 'Lord')}</strong><br>
        <span style="font-size: 9pt; color: #64748b;">Sub-Period Manifestor</span>
      </td>
      <td style="background-color: #dcfce7; border: 1pt solid #bbf7d0; width: 34%;">
        <span style="font-size: 8.5pt; font-weight: bold; color: #15803d;">PRATYANTARDASHA (PD)</span><br>
        <strong style="font-size: 13pt; color: #0f172a;">${escapeHtml(context.activeDasha.pratyantardasha || 'Lord')}</strong><br>
        <span style="font-size: 9pt; color: #64748b;">Peak: ${escapeHtml(narrative.peakDateRange || 'Entire Month')}</span>
      </td>
    </tr>
  </table>

  <!-- Planetary Alignment -->
  ${(context.natalOccupants && context.natalOccupants.length > 0) || (context.transitOccupants && context.transitOccupants.length > 0) ? `
  <table>
    <tr>
      <th style="width: 50%;">NATAL GRAHAS (BIRTH GRID)</th>
      <th style="width: 50%;">TRANSIT GRAHAS (GOCHARA EPHEMERIS)</th>
    </tr>
    <tr>
      <td>
        ${context.natalOccupants && context.natalOccupants.length > 0
          ? context.natalOccupants.map(o => `<strong>${escapeHtml(o.body_name)}</strong> ${o.degree_sputa ? `(${escapeHtml(o.degree_sputa)})` : ''} ${o.nakshatra_name ? `• ${escapeHtml(o.nakshatra_name)}` : ''}`).join('<br>')
          : 'Empty or not specified'}
      </td>
      <td>
        ${context.transitOccupants && context.transitOccupants.length > 0
          ? context.transitOccupants.map(t => `<strong>${escapeHtml(t.graha_key)}</strong> ${t.degree_sputa ? `(${escapeHtml(t.degree_sputa)})` : ''} ${t.nakshatra_name ? `• ${escapeHtml(t.nakshatra_name)} P${t.pada || '?'}` : ''}${t.is_retrograde ? ' [R]' : ''}`).join('<br>')
          : 'Governed via Drishti'}
      </td>
    </tr>
  </table>
  ` : ''}

  <!-- 2. Dual Evaluation & Bottom-Line Synthesis -->
  <h2>2. BOTTOM-LINE SYNTHESIS &amp; NATAL EVALUATION</h2>

  ${narrative.natalPromiseVsTransitDelivery ? `
  <table>
    <tr>
      <td style="width: 50%; background-color: #fef3c7; border: 1pt solid #fde68a;">
        <strong style="color: #92400e;">1. NATAL PROMISE (D1/D9) — ${((narrative.natalPromiseVsTransitDelivery.natalPromiseScore || 0.88) * 100).toFixed(0)}%</strong><br>
        <p style="margin-top: 4pt; font-size: 9.5pt;">${escapeHtml(narrative.natalPromiseVsTransitDelivery.natalPromiseVerdict)}</p>
      </td>
      <td style="width: 50%; background-color: #e0f2fe; border: 1pt solid #bae6fd;">
        <strong style="color: #0369a1;">2. GOCHARA TRANSIT DELIVERY — ${((narrative.natalPromiseVsTransitDelivery.transitDeliveryScore || 0.78) * 100).toFixed(0)}%</strong><br>
        <p style="margin-top: 4pt; font-size: 9.5pt;">${escapeHtml(narrative.natalPromiseVsTransitDelivery.transitDeliveryVerdict)}</p>
      </td>
    </tr>
    <tr>
      <td colspan="2" style="background-color: #f1f5f9;">
        <strong>Synthesis Fruition Verdict:</strong> ${escapeHtml(narrative.natalPromiseVsTransitDelivery.synthesisVerdict)}
      </td>
    </tr>
  </table>
  ` : ''}

  <div class="verdict-box">
    <strong style="color: #b45309; font-size: 10pt; text-transform: uppercase;">Bottom-Line Synthesis Verdict:</strong><br>
    <p style="font-size: 11pt; color: #0f172a; margin-top: 4pt; margin-bottom: 0;">
      ${escapeHtml(cleanNarrativeText(narrative.summarySentence) || 'Vedic Parashara synthesis completed.')}
    </p>
  </div>

  <!-- 3. Core Parashara 3-Part Predictions -->
  <h2>3. CORE PARASHARA PREDICTIVE ANALYSIS</h2>

  <table>
    <tr>
      <th style="background-color: #fef3c7; color: #92400e; width: 30%;">Part 1: Probability &amp; Scope (${(narrative.overallConfidence * 100).toFixed(0)}%)</th>
      <td>${escapeHtml(cleanNarrativeText(narrative.part1_probabilityAndScope))}</td>
    </tr>
    <tr>
      <th style="background-color: #e0f2fe; color: #0369a1;">Part 2: Financial &amp; Resources</th>
      <td>${escapeHtml(cleanNarrativeText(narrative.part2_financialAndResources))}</td>
    </tr>
    <tr>
      <th style="background-color: #dcfce7; color: #15803d;">Part 3: Micro-Timing Window (${escapeHtml(narrative.peakDateRange || 'Month')})</th>
      <td>${escapeHtml(cleanNarrativeText(narrative.part3_microTimingWindow))}</td>
    </tr>
  </table>

  <!-- 4. All 5 Core Life Domains -->
  <h2>4. COMPREHENSIVE 5-DOMAIN LIFE PREDICTIONS</h2>

  ${scenariosToRender.map((sc: any, idx: number) => {
    const title = (sc.title || sc.domain).replace(/^[^\w\s]+/, '').trim();
    const conf = ((sc.confidenceScore ?? 0.85) * 100).toFixed(0);

    return `
    <div style="border: 1pt solid #cbd5e1; padding: 10pt; margin-bottom: 12pt; background-color: #ffffff;">
      <h3 style="color: #0f172a; margin-top: 0; font-size: 12pt; border-bottom: 1pt solid #e2e8f0; padding-bottom: 4pt;">
        4.${idx + 1} ${escapeHtml(title)} 
        <span class="badge badge-amber" style="margin-left: 8pt;">${escapeHtml(sc.verdict || 'Evaluated')}</span>
        <span style="float: right; font-size: 9pt; font-weight: normal; color: #64748b;">
          Window: <strong>${escapeHtml(sc.timingWindow || 'Active Month')}</strong> | Confidence: <strong>${conf}%</strong>
        </span>
      </h3>

      <!-- Deep Dive Specifics -->
      ${sc.id === 'career_job' ? `
        ${sc.employmentStatusInference ? `
        <div class="deep-dive-box" style="border-left: 3pt solid #b45309;">
          <strong style="color: #b45309;">Native Employment State: [${escapeHtml(sc.employmentStatusInference.label)}]</strong><br>
          <strong>Astrological Deduction (10th Karma &amp; 6th Service):</strong> ${escapeHtml(sc.employmentStatusInference.inferenceReasoning)}
        </div>` : ''}

        ${sc.jobSearchAnalysis ? `
        <div class="deep-dive-box" style="border-left: 3pt solid #0284c7;">
          <strong style="color: #0284c7;">Job Search &amp; Transition Phase [Momentum: ${escapeHtml(sc.jobSearchAnalysis.momentum || 'Active')}]:</strong><br>
          <strong>Struggle vs Current:</strong> ${escapeHtml(sc.jobSearchAnalysis.pastStruggleVsCurrentPhase)}<br>
          <strong>Auspicious Window:</strong> ${escapeHtml(sc.jobSearchAnalysis.timingAuspiciousness)}
        </div>` : ''}

        ${sc.newJobAcquisition ? `
        <div class="deep-dive-box" style="border-left: 3pt solid #16a34a;">
          <strong style="color: #16a34a;">New Job Acquisition &amp; Role Mood:</strong><br>
          <strong>Role &amp; Mood:</strong> ${escapeHtml(sc.newJobAcquisition.jobTypeAndMood)}<br>
          <strong>Workplace Atmosphere:</strong> ${escapeHtml(sc.newJobAcquisition.workplaceAtmosphere)}<br>
          <strong>Comparison:</strong> ${escapeHtml(sc.newJobAcquisition.comparisonWithCurrentRole)}
        </div>` : ''}

        ${sc.existingJobPhase ? `
        <div class="deep-dive-box" style="border-left: 3pt solid #4f46e5;">
          <strong style="color: #4f46e5;">Existing Job Phase (For Native Currently Serving):</strong><br>
          <strong>Workplace Climate:</strong> ${escapeHtml(sc.existingJobPhase.currentPhaseNature)}<br>
          <strong>Retention vs Exit Advice:</strong> ${escapeHtml(sc.existingJobPhase.retentionVsExitAdvice)}
        </div>` : ''}
      ` : ''}

      ${sc.id === 'love_romance' ? `
        ${sc.crushStatusInference ? `
        <div class="deep-dive-box" style="border-left: 3pt solid #e11d48;">
          <strong style="color: #e11d48;">Crush Outlook &amp; Potential [New Attraction: ${escapeHtml(sc.crushStatusInference.newCrushProbability || 'Moderate')}]:</strong><br>
          <strong>Existing Trajectory:</strong> ${escapeHtml(sc.crushStatusInference.existingCrushTrajectory)}<br>
          <strong>Attraction Trigger:</strong> ${escapeHtml(sc.crushStatusInference.newCrushDetails)}
        </div>` : ''}

        ${sc.romanceAtmosphere ? `
        <div class="deep-dive-box" style="border-left: 3pt solid #b45309;">
          <strong style="color: #b45309;">Romance Chemistry (${sc.romanceAtmosphere.chemistryRating || 80}%) &amp; Emotional Weather:</strong><br>
          ${escapeHtml(sc.romanceAtmosphere.emotionalWeather)}
        </div>` : ''}

        ${sc.manifestationPath ? `
        <div class="deep-dive-box" style="border-left: 3pt solid #16a34a;">
          <strong style="color: #16a34a;">Love Manifestation Horizon [${escapeHtml(sc.manifestationPath.outcomeLabel || 'Favorable')}]:</strong><br>
          <strong>Likelihood:</strong> ${escapeHtml(sc.manifestationPath.manifestationLikelihood)}<br>
          <strong>Astrological Reasoning (5th, 7th &amp; D9):</strong> ${escapeHtml(sc.manifestationPath.astrologicalPathReasoning)}
        </div>` : ''}
      ` : ''}

      ${sc.id === 'finance_wealth' && sc.financeDetails ? `
        <div class="deep-dive-box" style="border-left: 3pt solid #b45309;">
          <strong style="color: #b45309;">Liquid Cashflow &amp; Asset Inflow Breakdown:</strong><br>
          <strong>Liquidity vs Outflow:</strong> ${escapeHtml(sc.financeDetails.liquidityVsOutflow)}<br>
          <strong>Windfalls &amp; Speculation:</strong> ${escapeHtml(sc.financeDetails.windfallAndSpeculation)}<br>
          <strong>Debt &amp; Asset Financing:</strong> ${escapeHtml(sc.financeDetails.debtAndAssetFinancing)}
        </div>
      ` : ''}

      ${sc.id === 'health_vitality' && sc.healthDetails ? `
        <div class="deep-dive-box" style="border-left: 3pt solid #e11d48;">
          <strong style="color: #e11d48;">Health Significations &amp; Vulnerable Zones [${(sc.healthDetails.vulnerableZones || []).map((z: string) => escapeHtml(z)).join(', ')}]:</strong><br>
          <strong>Mental Tranquility (Sukha):</strong> ${escapeHtml(sc.healthDetails.mentalTranquilityAndStress)}<br>
          <strong>Holistic Remedies:</strong> ${escapeHtml(sc.healthDetails.holisticRemedies)}
        </div>
      ` : ''}

      ${sc.id === 'family_home' && sc.familyDetails ? `
        <div class="deep-dive-box" style="border-left: 3pt solid #4f46e5;">
          <strong style="color: #4f46e5;">Domestic Ambiance &amp; Maternal Significations:</strong><br>
          <strong>Domestic Ambiance:</strong> ${escapeHtml(sc.familyDetails.domesticAmbiance)}<br>
          <strong>Maternal Wellbeing:</strong> ${escapeHtml(sc.familyDetails.maternalWellbeing)}<br>
          <strong>Property &amp; Relocation:</strong> ${escapeHtml(sc.familyDetails.propertyAndRelocation)}
        </div>
      ` : ''}

      <!-- Detailed Paragraphs if any -->
      ${sc.detailedParagraphs && sc.detailedParagraphs.length > 0 ? `
        <div style="background-color: #f8fafc; padding: 6pt 8pt; margin-top: 6pt; font-size: 9.5pt;">
          <strong>In-Depth Astrological Analysis &amp; Vedic Synthesis:</strong><br>
          ${sc.detailedParagraphs.map((para: string) => `<p style="margin-top: 3pt; margin-bottom: 4pt;">${escapeHtml(para)}</p>`).join('')}
        </div>
      ` : ''}

      <p style="margin-top: 8pt; margin-bottom: 4pt; font-size: 10pt;">
        <strong>Astrological Causal Rationale (Drishti &amp; Karakatwa):</strong><br>
        ${escapeHtml(sc.astrologicalReasoning || 'Consistent with astrological indicators.')}
      </p>

      <p style="margin-top: 4pt; margin-bottom: 2pt; font-size: 10pt; color: #16a34a;">
        <strong>Practical Remedial Guidance:</strong><br>
        <span style="color: #1e293b;">${escapeHtml(sc.practicalGuidance || 'Align timing with active planetary windows.')}</span>
      </p>
    </div>
    `;
  }).join('')}

  <!-- Extended Reasoning Log (if available) -->
  ${narrative.thinkingContent ? `
  <h2>5. EXTENDED REASONING AUDIT LOG</h2>
  <div style="background-color: #f8fafc; border: 1pt solid #cbd5e1; padding: 8pt; font-family: 'Courier New', monospace; font-size: 8.5pt; color: #334155; white-space: pre-wrap;">
    ${escapeHtml(narrative.thinkingContent)}
  </div>
  ` : ''}

  <!-- Footer -->
  <div class="footer-text">
    Tamil Om Vedic Horoscope Engine • Deterministic Sputa &amp; Parashara Ingress Synthesis • ${escapeHtml(timePeriodText)}
  </div>

</div>
</body>
</html>`;

  return docHtml;
}

export function generateVedicWordReport(
  context: VedicHouseContext,
  narrative: LLMThreePartNarrative
): void {
  const wordContent = buildVedicWordContent(context, narrative);
  const blob = new Blob(['\ufeff' + wordContent], {
    type: 'application/msword;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);

  const monthName = MONTH_NAMES[context.selectedMonth] || `Month${context.selectedMonth + 1}`;
  const year = context.selectedYear;

  let providerTag = 'Gemini';
  if (narrative.providerUsed === 'local_qwen') {
    providerTag = 'Ollama-7B';
  } else if (narrative.providerUsed === 'claude_sonnet' || narrative.providerUsed === 'claude') {
    providerTag = 'Claude-Sonnet';
  } else if (narrative.providerUsed === 'claude_haiku') {
    providerTag = 'Claude-Haiku';
  } else if (narrative.providerUsed === 'claude_fable') {
    providerTag = 'Claude-Fable-5.1';
  } else if (narrative.providerUsed === 'gemini_pro') {
    providerTag = 'Gemini';
  }

  const a = document.createElement('a');
  a.href = url;
  a.download = `${monthName}_${year}_${providerTag}_AstroPredictions.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
