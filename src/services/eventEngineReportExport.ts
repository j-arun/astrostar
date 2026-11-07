import { jsPDF } from 'jspdf';
import { createReportFilenameTimestamp } from './reportFilename';

export interface EventEngineReportGate {
  nakshatraName: string;
  rashiName: string;
  houseFromLagna: number;
  houseFromRashi: number;
  anatomicalSeat: string;
  significations: string;
  perspective: 'lagna' | 'rashi' | 'combined';
  activeGrahas: { name: string; passageWindow?: string; isExalted?: boolean }[];
  moonIngressWindow?: string;
}

export interface EventEngineReportEvent {
  id: string;
  title: string;
  narrative: string;
  probabilityScore: number;
  isHighProbability: boolean;
  portfolio?: string;
  gateTrigger?: string;
}

export interface EventEngineReportData {
  personName: string;
  personId: string;
  birthLagna: string;
  janmaRashi: string;
  selectedMonth: number;
  selectedYear: number;
  monthName: string;
  mahadasha: string;
  antardasha: string;
  pratyantardasha: string;
  dashaStartDate?: string;
  dashaEndDate?: string;
  deliveringHand: string;
  gates: EventEngineReportGate[];
  events: EventEngineReportEvent[];
  modelUsed?: string;
  executionTimeMs?: number;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Builds and downloads the Event Manufacturing Engine PDF Report
 */
export function exportEventEnginePdf(data: EventEngineReportData): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 14;

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 16) {
      doc.addPage();
      y = 16;
    }
  };

  // 1. TOP HEADER BANNER
  doc.setFillColor(30, 27, 75); // Indigo 950
  doc.rect(margin, y, contentWidth, 26, 'F');
  doc.setDrawColor(129, 140, 248); // Indigo 400
  doc.setLineWidth(0.6);
  doc.rect(margin, y, contentWidth, 26, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('EVENT MANUFACTURING ENGINE REPORT', margin + 6, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(216, 180, 254); // Purple 300
  doc.text(`Parashara & Nadi Entry Gate Manifestation | Horizon: ${data.monthName} ${data.selectedYear}`, margin + 6, y + 15);

  doc.setFontSize(7.5);
  doc.setTextColor(199, 210, 254);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} | Model: ${data.modelUsed || 'Vedic LLM Engine'}`, margin + 6, y + 21);

  y += 30;

  // 2. DASHA & PROFILE METADATA GRID
  checkPageBreak(24);
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.rect(margin, y, contentWidth, 20, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.rect(margin, y, contentWidth, 20, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);

  // Left Col: Profile & Coordinates
  doc.text(`Profile: ${data.personName} (${data.personId})`, margin + 4, y + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Ascendant (Lagna): ${data.birthLagna} (House 1)  |  Janma Rashi: ${data.janmaRashi} (Moon)`, margin + 4, y + 11);
  doc.text(`Active Delivering Hand: ${data.deliveringHand} (Saral Delivery Focus)`, margin + 4, y + 16);

  // Right Col: Dasha Hierarchy
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Active Dasha Hierarchy:', margin + contentWidth / 2 + 6, y + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Mahadasha (MD): ${data.mahadasha}`, margin + contentWidth / 2 + 6, y + 10);
  doc.text(`Antardasha (AD): ${data.antardasha} (Delivering Hand)`, margin + contentWidth / 2 + 6, y + 14.5);
  doc.text(`Pratyantardasha (PD): ${data.pratyantardasha} (Month Teeth)`, margin + contentWidth / 2 + 6, y + 18.5);

  y += 24;

  // 3. SECTION 1: THE THREE NAKSHATRA ENTRY GATES
  checkPageBreak(12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 27, 75);
  doc.text(`1. The Three Nakshatra Entry Gates for ${data.deliveringHand}`, margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Planetary passages across these gates manufacture tangible events and somatic conditions', margin, y + 4.5);
  y += 8;

  // Render 3 Gate Cards
  for (let i = 0; i < data.gates.length; i++) {
    const gate = data.gates[i];
    checkPageBreak(32);

    doc.setFillColor(241, 245, 249); // Slate 100
    doc.rect(margin, y, contentWidth, 27, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentWidth, 27, 'S');

    // Gate Title & Number
    doc.setFillColor(147, 51, 234); // Purple 600
    doc.circle(margin + 5, y + 5.5, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text(`${i + 1}`, margin + 4.2, y + 6.5);

    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`${gate.nakshatraName} Gate (${gate.rashiName})`, margin + 10, y + 6.5);

    // Perspective Badge
    const pStr = gate.perspective === 'lagna' ? 'From Lagna (Asc)' : gate.perspective === 'rashi' ? 'From Janma (Moon)' : 'Combined (Dual)';
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(109, 40, 217);
    doc.text(`[Perspective: ${pStr}]`, margin + contentWidth - 45, y + 6.5);

    // House Coordinates & Anatomical Seat
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(`Coordinates: House ${gate.houseFromLagna} from Lagna  |  House ${gate.houseFromRashi} from Janma Rashi`, margin + 4, y + 12);
    doc.text(`Anatomical Seat: ${gate.anatomicalSeat} (${gate.significations})`, margin + 4, y + 16.5);

    // Grahas Passing Through Gate
    const grahaListStr = gate.activeGrahas.length > 0
      ? gate.activeGrahas.map(g => `${g.name}${g.passageWindow ? ` (${g.passageWindow})` : ''}`).join(', ')
      : 'No transiting planets in this sign (Clear Gate)';
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(190, 18, 60); // Rose 700
    doc.text('Grahas Active in Gate: ', margin + 4, y + 21.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    const splitGrahas = doc.splitTextToSize(grahaListStr, contentWidth - 40);
    doc.text(splitGrahas[0] || '', margin + 35, y + 21.5);

    if (gate.moonIngressWindow) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6.8);
      doc.setTextColor(161, 98, 7);
      doc.text(`Moon Ingress Trigger: ${gate.moonIngressWindow}`, margin + contentWidth - 55, y + 25.5);
    }

    y += 30;
  }

  y += 2;

  // 4. SECTION 2: MANUFACTURED PROBABLE EVENTS
  checkPageBreak(14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 27, 75);
  doc.text(`2. Manufactured Probable Events (${data.events.length} Forecasts)`, margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Synthesized directly from planetary gate ingress, Lagna somatic seats, and Dasha fruition', margin, y + 4.5);
  y += 8;

  if (data.events.length === 0) {
    checkPageBreak(18);
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, contentWidth, 16, 'F');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('No manufactured events generated yet for this period. Click "Manufacture Events in LLM" in the app.', margin + 6, y + 9);
    y += 20;
  } else {
    for (let j = 0; j < data.events.length; j++) {
      const evt = data.events[j];
      checkPageBreak(28);

      doc.setFillColor(255, 255, 255);
      doc.rect(margin, y, contentWidth, 24, 'F');
      doc.setDrawColor(evt.isHighProbability ? 168 : 226, evt.isHighProbability ? 85 : 232, evt.isHighProbability ? 247 : 240);
      doc.setLineWidth(evt.isHighProbability ? 0.6 : 0.3);
      doc.rect(margin, y, contentWidth, 24, 'S');

      // Event Title & Number
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`Event ${j + 1}.  ${evt.title}`, margin + 4, y + 5.5);

      // Probability Badge
      doc.setFontSize(7.5);
      if (evt.probabilityScore >= 70) {
        doc.setTextColor(16, 185, 129); // Emerald 500
      } else if (evt.probabilityScore >= 50) {
        doc.setTextColor(217, 119, 6); // Amber 600
      } else {
        doc.setTextColor(100, 116, 139);
      }
      doc.text(`${evt.probabilityScore}% Probable${evt.isHighProbability ? ' [HIGH]' : ''}`, margin + contentWidth - 36, y + 5.5);

      // Portfolio Tag
      if (evt.portfolio) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.8);
        doc.setTextColor(124, 58, 237);
        doc.text(`[${evt.portfolio}]`, margin + contentWidth - 52, y + 5.5);
      }

      // 1-2 Line Manifestation Narrative
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      const splitNarrative = doc.splitTextToSize(evt.narrative, contentWidth - 8);
      doc.text(splitNarrative.slice(0, 2), margin + 4, y + 11.5);

      // Trigger Mechanism
      if (evt.gateTrigger) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.8);
        doc.setTextColor(109, 40, 217);
        doc.text('Trigger Mechanism: ', margin + 4, y + 20.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        const splitTrigger = doc.splitTextToSize(evt.gateTrigger, contentWidth - 32);
        doc.text(splitTrigger[0] || '', margin + 28, y + 20.5);
      }

      y += 27;
    }
  }

  // 5. PAGE FOOTERS
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(148, 163, 184);
    doc.text('Tamil Om Vedic Astrology — Event Manufacturing Engine', margin, pageHeight - 6);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth / 2, pageHeight - 6, { align: 'center' });
    doc.text(`${data.monthName} ${data.selectedYear}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
  }

  // Download PDF
  const filename = `Event_Manufacturing_${data.deliveringHand.replace(/\s+/g, '_')}_${data.monthName}_${data.selectedYear}_${createReportFilenameTimestamp()}.pdf`;
  doc.save(filename);
}

/**
 * Builds and downloads the Event Manufacturing Engine Standalone HTML Report
 */
export function exportEventEngineHtml(data: EventEngineReportData): void {
  const pTag = (p: 'lagna' | 'rashi' | 'combined') => p === 'lagna' ? 'From Lagna (Asc)' : p === 'rashi' ? 'From Janma (Moon)' : 'Combined (Dual)';

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Event Manufacturing Engine Report - ${data.monthName} ${data.selectedYear}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      margin: 0;
      padding: 30px 20px;
      line-height: 1.5;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .header {
      background: linear-gradient(135deg, #312e81 0%, #1e1b4b 100%);
      border: 1px solid #6366f1;
      padding: 24px;
      border-radius: 12px;
      margin-bottom: 24px;
    }
    .header h1 {
      margin: 0 0 6px 0;
      font-size: 24px;
      color: #ffffff;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .header .subtitle {
      color: #c7d2fe;
      font-size: 13px;
      margin-bottom: 12px;
    }
    .header .meta-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      font-size: 12px;
      color: #cbd5e1;
      border-top: 1px solid rgba(255, 255, 255, 0.15);
      padding-top: 10px;
    }
    .section-title {
      font-size: 16px;
      font-weight: 800;
      color: #ffffff;
      margin: 24px 0 6px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .section-sub {
      font-size: 12px;
      color: #94a3b8;
      margin-bottom: 16px;
    }
    .grid-gates {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .gate-card {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 16px;
    }
    .gate-card .gate-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .gate-card .gate-title {
      font-weight: 800;
      font-size: 14px;
      color: #f8fafc;
    }
    .gate-card .badge {
      font-size: 10px;
      font-weight: bold;
      padding: 2px 8px;
      border-radius: 6px;
      background: rgba(168, 85, 247, 0.2);
      color: #d8b4fe;
      border: 1px solid rgba(168, 85, 247, 0.4);
    }
    .gate-card .coords {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      font-size: 11px;
      margin-bottom: 10px;
      text-align: center;
    }
    .gate-card .coord-box {
      background: #1e293b;
      padding: 6px;
      border-radius: 6px;
      border: 1px solid #334155;
    }
    .gate-card .coord-box strong {
      color: #38bdf8;
      display: block;
    }
    .gate-card .anatomy {
      font-size: 11px;
      background: rgba(30, 41, 59, 0.6);
      padding: 8px;
      border-radius: 6px;
      margin-bottom: 10px;
      border-left: 3px solid #a855f7;
    }
    .gate-card .grahas-in-gate {
      font-size: 11px;
      border-top: 1px solid #334155;
      padding-top: 8px;
      color: #cbd5e1;
    }
    .events-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .event-card {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 18px;
    }
    .event-card.high-prob {
      border-color: rgba(168, 85, 247, 0.5);
      background: linear-gradient(180deg, rgba(30, 27, 75, 0.3) 0%, #0f172a 100%);
    }
    .event-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .event-title {
      font-size: 14px;
      font-weight: 800;
      color: #f8fafc;
    }
    .prob-badge {
      font-size: 11px;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 6px;
      font-family: monospace;
      background: rgba(16, 185, 129, 0.2);
      color: #6ee7b7;
      border: 1px solid rgba(16, 185, 129, 0.4);
    }
    .event-narrative {
      font-size: 12.5px;
      background: #1e293b;
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid #334155;
      color: #e2e8f0;
      margin-bottom: 8px;
    }
    .event-trigger {
      font-size: 11px;
      color: #94a3b8;
    }
    .event-trigger strong {
      color: #c084fc;
    }
    .footer {
      margin-top: 30px;
      padding-top: 16px;
      border-top: 1px solid #334155;
      font-size: 11px;
      color: #64748b;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      body {
        background: #ffffff;
        color: #0f172a;
        padding: 0;
      }
      .container {
        border: none;
        box-shadow: none;
        padding: 0;
        background: #ffffff;
      }
      .header {
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        color: #0f172a;
      }
      .header h1 { color: #0f172a; }
      .header .subtitle { color: #475569; }
      .header .meta-bar { color: #334155; }
      .gate-card, .event-card, .event-narrative {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        color: #1e293b;
      }
      .section-title { color: #0f172a; }
      .prob-badge { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
      .event-title, .gate-card .gate-title { color: #0f172a; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Event Manufacturing Engine Report</h1>
      <div class="subtitle">Parashara &amp; Nadi Astrological Timing Horizon: <strong>${data.monthName} ${data.selectedYear}</strong></div>
      <div class="meta-bar">
        <span><strong>Profile:</strong> ${data.personName} (${data.personId})</span>
        <span><strong>Lagna:</strong> ${data.birthLagna} (1st House)</span>
        <span><strong>Janma Rashi:</strong> ${data.janmaRashi} (Moon)</span>
        <span><strong>Delivering Hand:</strong> ${data.deliveringHand}</span>
        <span><strong>Dasha:</strong> ${data.mahadasha} MD &bull; ${data.antardasha} AD &bull; ${data.pratyantardasha} PD</span>
      </div>
    </div>

    <div class="section-title">1. Three Nakshatra Entry Gates (${data.deliveringHand})</div>
    <div class="section-sub">Planetary passages across these gates manufacture tangible somatic and experiential events</div>

    <div class="grid-gates">
      ${data.gates.map((g, idx) => `
        <div class="gate-card">
          <div class="gate-header">
            <span class="gate-title">${idx + 1}. ${g.nakshatraName} (${g.rashiName})</span>
            <span class="badge">${pTag(g.perspective)}</span>
          </div>
          <div class="coords">
            <div class="coord-box">
              <span>From Lagna</span>
              <strong>House ${g.houseFromLagna}</strong>
            </div>
            <div class="coord-box">
              <span>From Janma</span>
              <strong>House ${g.houseFromRashi}</strong>
            </div>
          </div>
          <div class="anatomy">
            <strong>Anatomical Seat:</strong> ${g.anatomicalSeat}<br>
            <span style="color: #94a3b8; font-size: 10px;">${g.significations}</span>
          </div>
          <div class="grahas-in-gate">
            <strong>Grahas in Gate:</strong> ${
              g.activeGrahas.length > 0
                ? g.activeGrahas.map(gr => `${gr.name}${gr.passageWindow ? ` (${gr.passageWindow})` : ''}`).join(', ')
                : 'None (Clear Gate)'
            }
            ${g.moonIngressWindow ? `<br><span style="color: #f59e0b; font-size: 10px;">Moon Ingress Trigger: ${g.moonIngressWindow}</span>` : ''}
          </div>
        </div>
      `).join('')}
    </div>

    <div class="section-title">2. Manufactured Probable Events (${data.events.length} Forecasts)</div>
    <div class="section-sub">Synthesized from planetary gate passages, Lagna somatic seats, and Dasha fruition</div>

    <div class="events-list">
      ${data.events.length > 0 ? data.events.map((evt, idx) => `
        <div class="event-card ${evt.isHighProbability ? 'high-prob' : ''}">
          <div class="event-header">
            <span class="event-title">Event ${idx + 1}. ${evt.title}</span>
            <div>
              ${evt.portfolio ? `<span style="font-size: 10px; font-weight: bold; background: #334155; padding: 2px 6px; border-radius: 4px; margin-right: 6px;">${evt.portfolio}</span>` : ''}
              <span class="prob-badge">${evt.probabilityScore}% Probable${evt.isHighProbability ? ' &bull; High' : ''}</span>
            </div>
          </div>
          <div class="event-narrative">${evt.narrative}</div>
          ${evt.gateTrigger ? `<div class="event-trigger"><strong>Trigger Mechanism:</strong> ${evt.gateTrigger}</div>` : ''}
        </div>
      `).join('') : '<p style="color: #94a3b8; font-style: italic;">No events manufactured yet for this period. Click "Manufacture Events in LLM" in the app.</p>'}
    </div>

    <div class="footer">
      <span>Tamil Om Vedic Astrology — Event Manufacturing Engine</span>
      <span>Generated: ${new Date().toLocaleDateString()}</span>
      <span>${data.monthName} ${data.selectedYear}</span>
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const filename = `Event_Manufacturing_${data.deliveringHand.replace(/\s+/g, '_')}_${data.monthName}_${data.selectedYear}_${createReportFilenameTimestamp()}.html`;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
