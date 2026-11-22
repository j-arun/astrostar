import { jsPDF } from 'jspdf';
import {
  NATAL_ASPECT_ORDER,
  NATAL_ASPECT_SPECS,
  NatalAspectId,
  NatalDashaPromiseEvaluation,
  NatalMdOption,
  NatalPersonProfileInput,
  cleanNatalPlanetName
} from './natalDashaPromiseEngine';
import { NatalDashaAiSynthesisResult } from './natalDashaPromptBuilder';
import { LLM_PROVIDERS, LLMProviderId } from './llm/types';
import { createReportFilenameTimestamp } from './reportFilename';

export type NatalDashaPdfLevelKey = 'md' | 'ad' | `pd-${number}`;
export type NatalDashaDualProviderId = 'gemini_pro' | 'claude_fable';

export interface NatalDashaPdfFollowUpTurn {
  id: string;
  question: string;
  result: NatalDashaAiSynthesisResult;
  createdAt: string;
}

export type NatalDashaReportsBySlotMap = Record<
  string,
  Partial<Record<NatalDashaDualProviderId, NatalDashaAiSynthesisResult>>
>;

export type NatalDashaFollowUpsBySlotMap = Record<
  string,
  Partial<Record<NatalDashaDualProviderId, NatalDashaPdfFollowUpTurn[]>>
>;

export interface NatalDashaPdfExportInput {
  evaluation: NatalDashaPromiseEvaluation;
  profile?: Partial<NatalPersonProfileInput>;
  dashaTree: NatalMdOption[];
  aspectFilter: NatalAspectId | 'all';
  focusQuestion?: string;
  reportsBySlot: NatalDashaReportsBySlotMap;
  followUpsBySlot: NatalDashaFollowUpsBySlotMap;
  extraProviderResult?: NatalDashaAiSynthesisResult | null;
  activeReportLevel?: NatalDashaPdfLevelKey;
}

export interface NatalDashaSinglePdfInput {
  evaluation: NatalDashaPromiseEvaluation;
  profile?: Partial<NatalPersonProfileInput>;
  levelKey: NatalDashaPdfLevelKey;
  providerId: NatalDashaDualProviderId;
  report: NatalDashaAiSynthesisResult;
  followUps: NatalDashaPdfFollowUpTurn[];
  aspectFilter: NatalAspectId | 'all';
}

type RGB = [number, number, number];

const COLORS = {
  slate950: [15, 23, 42] as RGB,
  slate800: [30, 41, 59] as RGB,
  slate700: [51, 65, 85] as RGB,
  slate600: [71, 85, 105] as RGB,
  slate500: [100, 116, 139] as RGB,
  slate400: [148, 163, 184] as RGB,
  slate200: [226, 232, 240] as RGB,
  slate100: [241, 245, 249] as RGB,
  slate50: [248, 250, 252] as RGB,
  white: [255, 255, 255] as RGB,
  amber800: [146, 64, 14] as RGB,
  amber700: [180, 83, 9] as RGB,
  amber500: [245, 158, 11] as RGB,
  amber100: [254, 243, 199] as RGB,
  amber50: [255, 251, 235] as RGB,
  sky700: [3, 105, 161] as RGB,
  sky100: [224, 242, 254] as RGB,
  sky50: [240, 249, 255] as RGB,
  purple700: [126, 34, 206] as RGB,
  purple500: [168, 85, 247] as RGB,
  purple100: [243, 232, 255] as RGB,
  purple50: [250, 245, 255] as RGB,
  emerald700: [4, 120, 87] as RGB,
  emerald500: [16, 185, 129] as RGB,
  emerald100: [209, 250, 229] as RGB,
  emerald50: [236, 253, 245] as RGB,
  rose700: [190, 18, 60] as RGB,
  rose100: [255, 228, 230] as RGB,
  rose50: [255, 241, 242] as RGB
};

/**
 * Normalizes arrows, typographic quotes/dashes, Sanskrit/IAST diacritics, and non-Latin-1 glyphs
 * so jsPDF built-in Helvetica never outputs corrupted characters.
 */
export function pdfSafe(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  let text = String(raw);

  const replacements: Array<[RegExp, string]> = [
    [/[\u2192\u2794\u279C\u27A1]/g, '->'],
    [/\u2190/g, '<-'],
    [/[\u2194\u21D4]/g, '<->'],
    [/\u21D2/g, '=>'],
    [/\u2265/g, '>='],
    [/\u2264/g, '<='],
    [/\u2260/g, '!='],
    [/\u00D7/g, 'x'],
    [/\u00F7/g, '/'],
    [/[\u2018\u2019\u201A\u201B]/g, "'"],
    [/[\u201C\u201D\u201E\u201F]/g, '"'],
    [/[\u2013\u2014\u2015]/g, '-'],
    [/\u2026/g, '...'],
    [/[\u2022\u2023\u25E6\u2043]/g, '-'],
    [/[\u2605\u2606\u2B50]/g, '*'],
    [/[\u2713\u2714\u2705]/g, '[OK]'],
    [/[\u2717\u2718\u274C]/g, '[X]'],
    [/\u26A0\uFE0F?/g, '[!]'],
    [/[\u0101\u00E0\u00E1\u00E2\u00E3\u00E4\u00E5]/g, 'a'],
    [/[\u0100\u00C0\u00C1\u00C2\u00C3\u00C4\u00C5]/g, 'A'],
    [/[\u012B\u00EC\u00ED\u00EE\u00EF]/g, 'i'],
    [/[\u012A\u00CC\u00CD\u00CE\u00CF]/g, 'I'],
    [/[\u016B\u00F9\u00FA\u00FB\u00FC]/g, 'u'],
    [/[\u016A\u00D9\u00DA\u00DB\u00DC]/g, 'U'],
    [/[\u0113\u00E8\u00E9\u00EA\u00EB]/g, 'e'],
    [/[\u0112\u00C8\u00C9\u00CA\u00CB]/g, 'E'],
    [/[\u014D\u00F2\u00F3\u00F4\u00F5\u00F6]/g, 'o'],
    [/[\u014C\u00D2\u00D3\u00D4\u00D5\u00D6]/g, 'O'],
    [/[\u1E5B\u1E5D]/g, 'r'],
    [/[\u1E5A\u1E5C]/g, 'R'],
    [/[\u1E37\u1E39]/g, 'l'],
    [/[\u015B\u1E63]/g, 's'],
    [/[\u015A\u1E62]/g, 'S'],
    [/[\u1E47\u1E45\u00F1]/g, 'n'],
    [/[\u1E46\u1E44\u00D1]/g, 'N'],
    [/[\u1E6D]/g, 't'],
    [/[\u1E6C]/g, 'T'],
    [/[\u1E0D]/g, 'd'],
    [/[\u1E0C]/g, 'D'],
    [/[\u1E43\u1E41]/g, 'm'],
    [/[\u1E42\u1E40]/g, 'M'],
    [/[\u1E25]/g, 'h'],
    [/[\u1E24]/g, 'H']
  ];

  for (const [pattern, target] of replacements) {
    text = text.replace(pattern, target);
  }

  // Strip zero-width joiners, variation selectors, and unsupported glyphs outside printable ASCII + degree/Latin-1
  text = text.replace(/[\u200B-\u200D\uFE0F]/g, '');
  text = text.replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '');
  return text;
}

function stripInlineMarkdownMarkers(text: string): string {
  return pdfSafe(text)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
}

function extractFocusQuestionFromPrompt(promptSent?: string): string | null {
  if (!promptSent) return null;
  const marker = '[FOCUS QUESTION]\n';
  const idx = promptSent.lastIndexOf(marker);
  if (idx < 0) return null;
  const extracted = promptSent.slice(idx + marker.length).trim();
  return extracted ? pdfSafe(extracted) : null;
}

function formatDuration(ms: number): string {
  const safeMs = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  if (safeMs < 1000) return `${safeMs}ms`;
  const sec = safeMs / 1000;
  if (sec < 60) return `${sec.toFixed(2)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${sec.toFixed(1)}s (${m}m ${s}s)`;
}

function providerDisplayName(providerId: LLMProviderId | string): string {
  if (providerId === 'gemini_pro') return 'Google Gemini Pro';
  if (providerId === 'claude_fable') return 'Claude Fable 5.1 (Phabble)';
  if (providerId === 'claude_sonnet') return 'Claude Sonnet 5.5';
  if (providerId === 'claude_haiku') return 'Claude Haiku 5.5';
  if (providerId === 'local_qwen') return 'Local Qwen 14B (Ollama)';
  return LLM_PROVIDERS[providerId as LLMProviderId]?.name || String(providerId);
}

function toneColors(tone: string): { bg: RGB; text: RGB; border: RGB } {
  const t = tone.toLowerCase();
  if (t.startsWith('high') || t.startsWith('peak') || t.startsWith('strong')) {
    return { bg: COLORS.emerald50, text: COLORS.emerald700, border: COLORS.emerald500 };
  }
  if (t.startsWith('supportive') || t.startsWith('productive') || t.startsWith('good')) {
    return { bg: COLORS.sky50, text: COLORS.sky700, border: COLORS.sky700 };
  }
  if (t.startsWith('mixed') || t.startsWith('moderate')) {
    return { bg: COLORS.amber50, text: COLORS.amber700, border: COLORS.amber500 };
  }
  return { bg: COLORS.rose50, text: COLORS.rose700, border: COLORS.rose700 };
}

class PdfLayoutWriter {
  public readonly doc: jsPDF;
  public readonly pageWidth = 210;
  public readonly pageHeight = 297;
  public readonly margin = 14;
  public readonly contentWidth = 182;
  public readonly bottomLimit = 278;
  public y = 14;

  constructor() {
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
  }

  public ensureSpace(neededHeight: number): boolean {
    if (this.y + neededHeight > this.bottomLimit) {
      this.doc.addPage();
      this.y = 18;
      return true;
    }
    return false;
  }

  public renderSectionHeading(title: string, subtitle?: string): void {
    this.ensureSpace(16);
    this.y += 2;
    this.doc.setFillColor(...COLORS.slate100);
    this.doc.setDrawColor(...COLORS.slate200);
    this.doc.setLineWidth(0.35);
    this.doc.roundedRect(this.margin, this.y, this.contentWidth, 8.5, 1.2, 1.2, 'FD');

    this.doc.setFillColor(...COLORS.amber500);
    this.doc.rect(this.margin, this.y, 2.2, 8.5, 'F');

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(9.5);
    this.doc.setTextColor(...COLORS.slate950);
    this.doc.text(pdfSafe(title), this.margin + 4.5, this.y + 5.6);

    if (subtitle) {
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(7.2);
      this.doc.setTextColor(...COLORS.slate500);
      this.doc.text(pdfSafe(subtitle), this.pageWidth - this.margin - 3, this.y + 5.5, { align: 'right' });
    }

    this.y += 11.5;
  }

  /**
   * Renders wrapped rich inline text supporting **bold** and `code` tokens cleanly across line breaks.
   */
  public renderRichParagraph(
    rawText: string,
    x: number,
    maxWidth: number,
    options?: {
      fontSize?: number;
      lineHeight?: number;
      baseColor?: RGB;
      boldColor?: RGB;
      codeColor?: RGB;
      forceBold?: boolean;
    }
  ): void {
    const fontSize = options?.fontSize ?? 8.4;
    const lineHeight = options?.lineHeight ?? 4.0;
    const baseColor = options?.baseColor ?? COLORS.slate800;
    const boldColor = options?.boldColor ?? COLORS.slate950;
    const codeColor = options?.codeColor ?? COLORS.amber800;
    const forceBold = Boolean(options?.forceBold);

    const safe = pdfSafe(rawText);
    const segments = safe.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);

    interface WordPiece {
      text: string;
      isBold: boolean;
      isCode: boolean;
      isSpace: boolean;
      width: number;
    }

    const pieces: WordPiece[] = [];
    this.doc.setFontSize(fontSize);

    for (const seg of segments) {
      let inner = seg;
      let isBold = forceBold;
      let isCode = false;

      if (seg.startsWith('**') && seg.endsWith('**') && seg.length > 4) {
        inner = seg.slice(2, -2);
        isBold = true;
      } else if (seg.startsWith('`') && seg.endsWith('`') && seg.length > 2) {
        inner = seg.slice(1, -1);
        isCode = true;
      }

      this.doc.setFont(isCode ? 'courier' : 'helvetica', isBold ? 'bold' : 'normal');
      const parts = inner.split(/(\s+)/).filter(p => p.length > 0);
      for (const p of parts) {
        const isSpace = /^\s+$/.test(p);
        const norm = isSpace ? ' ' : p;
        const w = this.doc.getTextWidth(norm);
        if (!isSpace && w > maxWidth) {
          // Break unusually long unbroken token cleanly
          const broken: string[] = this.doc.splitTextToSize(norm, maxWidth);
          broken.forEach((bChunk, bIdx) => {
            pieces.push({
              text: bChunk,
              isBold,
              isCode,
              isSpace: false,
              width: this.doc.getTextWidth(bChunk)
            });
            if (bIdx < broken.length - 1) {
              pieces.push({ text: ' ', isBold, isCode, isSpace: true, width: 0 });
            }
          });
        } else {
          pieces.push({ text: norm, isBold, isCode, isSpace, width: w });
        }
      }
    }

    if (pieces.length === 0) return;

    // Assemble into lines first for clean pagination per line
    const lines: WordPiece[][] = [];
    let currentLine: WordPiece[] = [];
    let currentLineW = 0;

    for (const piece of pieces) {
      if (piece.isSpace && currentLine.length === 0) continue;

      if (!piece.isSpace && currentLine.length > 0 && currentLineW + piece.width > maxWidth) {
        // Trim trailing space
        while (currentLine.length > 0 && currentLine[currentLine.length - 1].isSpace) {
          currentLine.pop();
        }
        lines.push(currentLine);
        currentLine = [piece];
        currentLineW = piece.width;
      } else {
        currentLine.push(piece);
        currentLineW += piece.width;
      }
    }
    while (currentLine.length > 0 && currentLine[currentLine.length - 1].isSpace) {
      currentLine.pop();
    }
    if (currentLine.length > 0) lines.push(currentLine);

    this.doc.setFontSize(fontSize);
    for (const line of lines) {
      this.ensureSpace(lineHeight + 1.5);
      let cursorX = x;
      for (const piece of line) {
        this.doc.setFont(piece.isCode ? 'courier' : 'helvetica', piece.isBold ? 'bold' : 'normal');
        this.doc.setTextColor(...(piece.isCode ? codeColor : piece.isBold ? boldColor : baseColor));
        this.doc.text(piece.text, cursorX, this.y);
        cursorX += piece.width;
      }
      this.y += lineHeight;
    }
  }

  public renderTable(
    headers: string[],
    rows: string[][],
    options?: {
      colWeights?: number[];
      fontSize?: number;
      headerBg?: RGB;
      headerText?: RGB;
      accentHeader?: boolean;
    }
  ): void {
    if (headers.length === 0 && rows.length === 0) return;
    const colCount = Math.max(headers.length, ...rows.map(r => r.length), 1);
    const fontSize = options?.fontSize ?? 7.4;
    const lineH = fontSize <= 7.2 ? 3.3 : 3.6;

    const normHeaders = Array.from({ length: colCount }, (_, i) => stripInlineMarkdownMarkers(headers[i] || `Col ${i + 1}`));
    const normRows = rows.map(r =>
      Array.from({ length: colCount }, (_, i) => stripInlineMarkdownMarkers(r[i] ?? ''))
    );

    // Compute proportional column widths
    let weights = options?.colWeights;
    if (!weights || weights.length !== colCount) {
      weights = Array.from({ length: colCount }, (_, cIdx) => {
        const headerLen = normHeaders[cIdx].length;
        const sampleLens = normRows.slice(0, 12).map(r => r[cIdx].length);
        const maxLen = Math.max(headerLen, ...sampleLens, 6);
        return Math.min(Math.max(maxLen, 8), 48);
      });
    }

    const totalWeight = weights.reduce((a, b) => a + b, 0) || colCount;
    const minColW = Math.min(16, this.contentWidth / colCount);
    let colWidths = weights.map(w => Math.max(minColW, (w / totalWeight) * this.contentWidth));
    const widthSum = colWidths.reduce((a, b) => a + b, 0);
    colWidths = colWidths.map(w => (w / widthSum) * this.contentWidth);

    const drawHeaderRow = () => {
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(fontSize);
      const wrappedHeader = normHeaders.map((h, i) =>
        this.doc.splitTextToSize(h, Math.max(8, colWidths[i] - 3)) as string[]
      );
      const maxH = Math.max(1, ...wrappedHeader.map(l => l.length));
      const rowH = maxH * lineH + 3.4;

      this.ensureSpace(rowH + 6);

      const headerBg = options?.headerBg ?? COLORS.slate800;
      const headerText = options?.headerText ?? COLORS.white;

      let cx = this.margin;
      for (let c = 0; c < colCount; c++) {
        this.doc.setFillColor(...headerBg);
        this.doc.setDrawColor(...COLORS.slate200);
        this.doc.setLineWidth(0.25);
        this.doc.rect(cx, this.y, colWidths[c], rowH, 'FD');

        this.doc.setFont('helvetica', 'bold');
        this.doc.setFontSize(fontSize);
        this.doc.setTextColor(...headerText);
        this.doc.text(wrappedHeader[c], cx + 1.5, this.y + 3.6);
        cx += colWidths[c];
      }
      this.y += rowH;
    };

    drawHeaderRow();

    normRows.forEach((row, rIdx) => {
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(fontSize);
      const wrappedCells = row.map((cell, i) => {
        const txt = cell || '-';
        return this.doc.splitTextToSize(txt, Math.max(8, colWidths[i] - 3)) as string[];
      });
      const maxLines = Math.max(1, ...wrappedCells.map(l => l.length));
      const rowH = maxLines * lineH + 3.0;

      // If single row exceeds bottom margin, break page & repeat header
      if (this.y + rowH > this.bottomLimit) {
        this.doc.addPage();
        this.y = 18;
        drawHeaderRow();
      }

      const rowBg = rIdx % 2 === 1 ? COLORS.slate50 : COLORS.white;
      let cx = this.margin;
      for (let c = 0; c < colCount; c++) {
        this.doc.setFillColor(...rowBg);
        this.doc.setDrawColor(...COLORS.slate200);
        this.doc.setLineWidth(0.22);
        this.doc.rect(cx, this.y, colWidths[c], rowH, 'FD');

        this.doc.setFont('helvetica', c === 0 ? 'bold' : 'normal');
        this.doc.setFontSize(fontSize);
        this.doc.setTextColor(...(c === 0 ? COLORS.slate950 : COLORS.slate800));
        this.doc.text(wrappedCells[c], cx + 1.5, this.y + 3.4);
        cx += colWidths[c];
      }
      this.y += rowH;
    });

    this.y += 3.5;
  }

  /**
   * Renders full Markdown string (headings, tables, bullets, numbered lists, blockquotes, code fences, rules, paragraphs)
   * without dropping or truncating any text.
   */
  public renderMarkdown(md: string, accentColor: RGB = COLORS.amber700): void {
    const lines = pdfSafe(md).replace(/\r\n/g, '\n').split('\n');
    let i = 0;

    while (i < lines.length) {
      const rawLine = lines[i];
      const trimmed = rawLine.trim();

      if (!trimmed) {
        this.y += 1.8;
        i++;
        continue;
      }

      // Code fence block ```
      if (trimmed.startsWith('```')) {
        i++;
        const codeLines: string[] = [];
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        if (i < lines.length && lines[i].trim().startsWith('```')) i++;

        if (codeLines.length > 0) {
          this.doc.setFont('courier', 'normal');
          this.doc.setFontSize(7.2);
          for (const cLine of codeLines) {
            const wrapped: string[] = this.doc.splitTextToSize(cLine || ' ', this.contentWidth - 8);
            for (const wLine of wrapped) {
              this.ensureSpace(4.2);
              this.doc.setFillColor(...COLORS.slate50);
              this.doc.rect(this.margin + 1, this.y - 2.6, this.contentWidth - 2, 3.8, 'F');
              this.doc.setTextColor(...COLORS.slate800);
              this.doc.text(wLine, this.margin + 3.5, this.y);
              this.y += 3.6;
            }
          }
          this.y += 2.2;
        }
        continue;
      }

      // Horizontal rule
      if (/^([-*_])\1{2,}$/.test(trimmed)) {
        this.ensureSpace(4);
        this.doc.setDrawColor(...COLORS.slate200);
        this.doc.setLineWidth(0.3);
        this.doc.line(this.margin, this.y + 1, this.pageWidth - this.margin, this.y + 1);
        this.y += 4;
        i++;
        continue;
      }

      // Markdown Pipe Table
      if (
        trimmed.startsWith('|') &&
        i + 1 < lines.length &&
        lines[i + 1].trim().startsWith('|')
      ) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          tableLines.push(lines[i].trim());
          i++;
        }

        const parsedRows = tableLines
          .filter(r => !/^\|[\s:|-]+\|?$/.test(r))
          .map(r => {
            const inner = r.replace(/^\|/, '').replace(/\|$/, '');
            return inner.split('|').map(c => c.trim());
          });

        if (parsedRows.length > 0) {
          const headers = parsedRows[0];
          const body = parsedRows.slice(1);
          this.y += 1.2;
          this.renderTable(headers, body, {
            fontSize: 7.3,
            headerBg: COLORS.slate100,
            headerText: COLORS.slate950
          });
        }
        continue;
      }

      // Headings (# to ####)
      const hMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
      if (hMatch) {
        const level = hMatch[1].length;
        const headingText = stripInlineMarkdownMarkers(hMatch[2]);
        const fontSize = level === 1 ? 11.2 : level === 2 ? 10.0 : level === 3 ? 9.1 : 8.5;
        const lineH = level <= 2 ? 4.8 : 4.2;

        this.doc.setFont('helvetica', 'bold');
        this.doc.setFontSize(fontSize);
        const wrapped: string[] = this.doc.splitTextToSize(headingText, this.contentWidth - 2);
        this.ensureSpace(wrapped.length * lineH + 9);

        this.y += level <= 2 ? 2.5 : 1.8;
        this.doc.setTextColor(...(level === 3 ? accentColor : COLORS.slate950));
        this.doc.text(wrapped, this.margin, this.y);
        this.y += wrapped.length * lineH;

        if (level <= 3) {
          this.doc.setDrawColor(...COLORS.slate200);
          this.doc.setLineWidth(level <= 2 ? 0.35 : 0.22);
          this.doc.line(this.margin, this.y - 1.2, this.pageWidth - this.margin, this.y - 1.2);
          this.y += 2.2;
        } else {
          this.y += 1.2;
        }
        i++;
        continue;
      }

      // Blockquote (> ...)
      if (trimmed.startsWith('>')) {
        const quoteLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('>')) {
          quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
          i++;
        }
        const quoteText = quoteLines.join(' ').trim();
        if (quoteText) {
          this.ensureSpace(8);
          const startY = this.y;
          this.y += 1.5;
          this.renderRichParagraph(quoteText, this.margin + 5, this.contentWidth - 7, {
            fontSize: 8.1,
            lineHeight: 3.9,
            baseColor: COLORS.slate700
          });
          // Accent quote bar on current page if on same page
          if (this.y > startY) {
            this.doc.setDrawColor(...accentColor);
            this.doc.setLineWidth(0.9);
            this.doc.line(this.margin + 2, startY - 1.5, this.margin + 2, this.y - 2);
          }
          this.y += 1.8;
        }
        continue;
      }

      // Unordered List Item (-, *, +)
      const ulMatch = rawLine.match(/^(\s*)([-*+])\s+(.+)$/);
      if (ulMatch) {
        const indentSpaces = ulMatch[1].length;
        const indentMm = Math.min(12, Math.floor(indentSpaces / 2) * 4);
        const itemText = ulMatch[3].trim();

        this.ensureSpace(6);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setFontSize(8.4);
        this.doc.setTextColor(...accentColor);
        this.doc.text(indentMm > 0 ? 'o' : '-', this.margin + 2 + indentMm, this.y);

        this.renderRichParagraph(
          itemText,
          this.margin + 6 + indentMm,
          this.contentWidth - 7 - indentMm,
          { fontSize: 8.3, lineHeight: 3.9 }
        );
        this.y += 0.8;
        i++;
        continue;
      }

      // Ordered List Item (1. , 2) )
      const olMatch = rawLine.match(/^(\s*)(\d+[.)])\s+(.+)$/);
      if (olMatch) {
        const indentSpaces = olMatch[1].length;
        const indentMm = Math.min(12, Math.floor(indentSpaces / 2) * 4);
        const numLabel = olMatch[2];
        const itemText = olMatch[3].trim();

        this.ensureSpace(6);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setFontSize(8.3);
        this.doc.setTextColor(...accentColor);
        this.doc.text(numLabel, this.margin + 1 + indentMm, this.y);

        const numOffset = Math.max(6, this.doc.getTextWidth(numLabel) + 2);
        this.renderRichParagraph(
          itemText,
          this.margin + 1 + indentMm + numOffset,
          this.contentWidth - 2 - indentMm - numOffset,
          { fontSize: 8.3, lineHeight: 3.9 }
        );
        this.y += 0.8;
        i++;
        continue;
      }

      // Standard paragraph line (combine consecutive plain text lines into a flowing paragraph)
      const paraLines: string[] = [trimmed];
      i++;
      while (i < lines.length) {
        const nextRaw = lines[i];
        const nextTrim = nextRaw.trim();
        if (
          !nextTrim ||
          nextTrim.startsWith('#') ||
          nextTrim.startsWith('|') ||
          nextTrim.startsWith('>') ||
          nextTrim.startsWith('```') ||
          /^([-*_])\1{2,}$/.test(nextTrim) ||
          /^\s*[-*+]\s+/.test(nextRaw) ||
          /^\s*\d+[.)]\s+/.test(nextRaw)
        ) {
          break;
        }
        paraLines.push(nextTrim);
        i++;
      }

      this.renderRichParagraph(paraLines.join(' '), this.margin, this.contentWidth, {
        fontSize: 8.4,
        lineHeight: 4.0
      });
      this.y += 1.6;
    }
  }
}

function renderAiReportAndFollowUps(
  writer: PdfLayoutWriter,
  params: {
    levelLabel: string;
    dateSpan: string;
    providerId: LLMProviderId | string;
    report?: NatalDashaAiSynthesisResult;
    followUps: NatalDashaPdfFollowUpTurn[];
    defaultFocusQuestion?: string;
  }
): void {
  const { levelLabel, dateSpan, providerId, report, followUps, defaultFocusQuestion } = params;
  const isGemini = providerId === 'gemini_pro';
  const isFable = providerId === 'claude_fable';
  const accentColor = isGemini
    ? COLORS.amber700
    : isFable
    ? COLORS.purple700
    : COLORS.sky700;
  const headerBg = isGemini
    ? COLORS.amber50
    : isFable
    ? COLORS.purple50
    : COLORS.sky50;
  const borderCol = isGemini
    ? COLORS.amber500
    : isFable
    ? COLORS.purple500
    : COLORS.sky700;

  const provName = providerDisplayName(providerId);
  const modelUsed = report?.modelUsed || LLM_PROVIDERS[providerId as LLMProviderId]?.model || String(providerId);
  const questionFromPrompt = extractFocusQuestionFromPrompt(report?.promptSent) || defaultFocusQuestion;

  // Report Sub-Banner
  writer.ensureSpace(24);
  const bannerLines = questionFromPrompt
    ? (writer.doc.splitTextToSize(`Question / Scope: ${pdfSafe(questionFromPrompt)}`, writer.contentWidth - 10) as string[])
    : [];
  const bannerH = 14 + (bannerLines.length > 0 ? bannerLines.length * 3.4 + 2.5 : 0);
  writer.ensureSpace(bannerH + 6);

  writer.doc.setFillColor(...headerBg);
  writer.doc.setDrawColor(...borderCol);
  writer.doc.setLineWidth(0.4);
  writer.doc.roundedRect(writer.margin, writer.y, writer.contentWidth, bannerH, 1.5, 1.5, 'FD');
  writer.doc.setFillColor(...borderCol);
  writer.doc.rect(writer.margin, writer.y, 2.5, bannerH, 'F');

  writer.doc.setFont('helvetica', 'bold');
  writer.doc.setFontSize(9.2);
  writer.doc.setTextColor(...accentColor);
  writer.doc.text(
    pdfSafe(`${levelLabel}  |  ${provName}`),
    writer.margin + 5,
    writer.y + 5.2
  );

  writer.doc.setFont('helvetica', 'normal');
  writer.doc.setFontSize(7.4);
  writer.doc.setTextColor(...COLORS.slate700);
  const telemetryParts = [
    `Window: ${pdfSafe(dateSpan)}`,
    `Model: ${pdfSafe(modelUsed)}`
  ];
  if (report) {
    telemetryParts.push(`Time: ${formatDuration(report.executionTimeMs)}`);
    if (report.tokenTelemetry) {
      telemetryParts.push(
        `Tokens: ${report.tokenTelemetry.inputTokens.toLocaleString()} in / ${report.tokenTelemetry.outputTokens.toLocaleString()} out`
      );
    }
  }
  if (followUps.length > 0) {
    telemetryParts.push(`Follow-Ups: ${followUps.length}`);
  }
  writer.doc.text(pdfSafe(telemetryParts.join('  |  ')), writer.margin + 5, writer.y + 10.2);

  if (bannerLines.length > 0) {
    writer.doc.setFont('helvetica', 'italic');
    writer.doc.setFontSize(7.2);
    writer.doc.setTextColor(...COLORS.slate800);
    writer.doc.text(bannerLines, writer.margin + 5, writer.y + 14.5);
  }

  writer.y += bannerH + 4;

  // Report Body
  if (report) {
    if (report.success && report.answerMarkdown.trim()) {
      writer.renderMarkdown(report.answerMarkdown, accentColor);
    } else if (!report.success) {
      writer.ensureSpace(14);
      writer.doc.setFillColor(...COLORS.rose50);
      writer.doc.setDrawColor(...COLORS.rose700);
      writer.doc.setLineWidth(0.3);
      const errLines: string[] = writer.doc.splitTextToSize(
        `Generation Issue: ${pdfSafe(report.error || 'Unknown error')}`,
        writer.contentWidth - 8
      );
      const boxH = errLines.length * 3.8 + 6;
      writer.doc.roundedRect(writer.margin, writer.y, writer.contentWidth, boxH, 1.2, 1.2, 'FD');
      writer.doc.setFont('helvetica', 'normal');
      writer.doc.setFontSize(8);
      writer.doc.setTextColor(...COLORS.rose700);
      writer.doc.text(errLines, writer.margin + 4, writer.y + 5);
      writer.y += boxH + 4;
    }
  }

  // ALL Follow-Up Q&As for this report (1, 2, ... N)
  if (followUps.length > 0) {
    writer.ensureSpace(16);
    writer.doc.setFont('helvetica', 'bold');
    writer.doc.setFontSize(8.8);
    writer.doc.setTextColor(...COLORS.emerald700);
    writer.doc.text(
      pdfSafe(`FOLLOW-UP QUESTIONS & RELATIVE IMPACT ANSWERS (${followUps.length} Total)`),
      writer.margin,
      writer.y + 2
    );
    writer.doc.setDrawColor(...COLORS.emerald500);
    writer.doc.setLineWidth(0.3);
    writer.doc.line(writer.margin, writer.y + 3.8, writer.pageWidth - writer.margin, writer.y + 3.8);
    writer.y += 7;

    followUps.forEach((turn, idx) => {
      const qHeaderText = `Follow-Up Q${idx + 1}: ${pdfSafe(turn.question)}`;
      writer.doc.setFont('helvetica', 'bold');
      writer.doc.setFontSize(8.2);
      const qWrapped: string[] = writer.doc.splitTextToSize(qHeaderText, writer.contentWidth - 28);
      const qBoxH = Math.max(10, qWrapped.length * 3.8 + 5.5);

      writer.ensureSpace(qBoxH + 10);
      writer.doc.setFillColor(...COLORS.emerald50);
      writer.doc.setDrawColor(...COLORS.emerald500);
      writer.doc.setLineWidth(0.3);
      writer.doc.roundedRect(writer.margin, writer.y, writer.contentWidth, qBoxH, 1.2, 1.2, 'FD');

      writer.doc.setFont('helvetica', 'bold');
      writer.doc.setFontSize(8.2);
      writer.doc.setTextColor(...COLORS.emerald700);
      writer.doc.text(qWrapped, writer.margin + 3.5, writer.y + 4.8);

      writer.doc.setFont('helvetica', 'normal');
      writer.doc.setFontSize(6.8);
      writer.doc.setTextColor(...COLORS.slate500);
      writer.doc.text(pdfSafe(turn.createdAt || ''), writer.pageWidth - writer.margin - 3, writer.y + 4.8, {
        align: 'right'
      });

      writer.y += qBoxH + 2.2;

      const metaBits = [
        `Provider: ${provName}`,
        `Model: ${pdfSafe(turn.result.modelUsed)}`,
        `Time: ${formatDuration(turn.result.executionTimeMs)}`
      ];
      if (turn.result.tokenTelemetry) {
        metaBits.push(
          `Tokens: ${turn.result.tokenTelemetry.inputTokens.toLocaleString()} in / ${turn.result.tokenTelemetry.outputTokens.toLocaleString()} out`
        );
      }
      writer.ensureSpace(5);
      writer.doc.setFont('helvetica', 'normal');
      writer.doc.setFontSize(7);
      writer.doc.setTextColor(...COLORS.slate500);
      writer.doc.text(pdfSafe(metaBits.join('  |  ')), writer.margin + 1, writer.y + 1.5);
      writer.y += 4.5;

      if (turn.result.success && turn.result.answerMarkdown.trim()) {
        writer.renderMarkdown(turn.result.answerMarkdown, COLORS.emerald700);
      } else {
        writer.ensureSpace(10);
        writer.doc.setFont('helvetica', 'italic');
        writer.doc.setFontSize(7.8);
        writer.doc.setTextColor(...COLORS.rose700);
        const fErr: string[] = writer.doc.splitTextToSize(
          `Follow-up error: ${pdfSafe(turn.result.error || 'No answer returned')}`,
          writer.contentWidth - 4
        );
        writer.doc.text(fErr, writer.margin + 2, writer.y);
        writer.y += fErr.length * 3.8 + 2;
      }

      writer.y += 3;
    });
  }

  writer.y += 4;
}

function resolveSlotLabelFromKey(
  slotKey: string,
  dashaTree: NatalMdOption[],
  evaluation: NatalDashaPromiseEvaluation
): { label: string; dateSpan: string } {
  const parts = slotKey.split('|');
  const mdPart = parts.find(p => p.startsWith('md-'));
  const adPart = parts.find(p => p.startsWith('ad-'));
  const pdPart = parts.find(p => p.startsWith('pd-'));

  const mdIdx = mdPart ? Number(mdPart.slice(3)) : evaluation.selectedMd.index;
  const mdObj = dashaTree.find(m => m.index === mdIdx);
  const mdLord = mdObj?.cleanMdLord || `MD #${mdIdx}`;

  if (!adPart) {
    return {
      label: `Mahadasha: ${mdLord}`,
      dateSpan: mdObj ? `${mdObj.startDate} to ${mdObj.endDate}` : 'Full MD'
    };
  }

  const adIdx = Number(adPart.slice(3));
  const adObj = mdObj?.antardashas.find(a => a.index === adIdx);
  const adLord = adObj?.cleanAdLord || `AD #${adIdx}`;

  if (!pdPart) {
    return {
      label: `Antardasha: ${mdLord}-${adLord}`,
      dateSpan: adObj ? `${adObj.startDate} to ${adObj.endDate} (${adObj.totalDays}d)` : 'Full AD'
    };
  }

  const pdIdx = Number(pdPart.slice(3));
  const pdObj = adObj?.pds.find(p => p.index === pdIdx);
  const pdLord = pdObj ? pdObj.cleanPdLord || cleanNatalPlanetName(pdObj.pdLord) : `PD #${pdIdx}`;
  return {
    label: `PD #${pdIdx}: ${pdLord} (${mdLord}-${adLord})`,
    dateSpan: pdObj ? `${pdObj.startDate} to ${pdObj.endDate} (${pdObj.totalDays}d)` : 'PD Window'
  };
}

function applyHeadersAndFooters(
  writer: PdfLayoutWriter,
  headerRightText: string,
  footerLeftText: string,
  footerRightText: string
): void {
  const totalPages = (writer.doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    writer.doc.setPage(p);

    if (p > 1) {
      writer.doc.setFont('helvetica', 'bold');
      writer.doc.setFontSize(7.2);
      writer.doc.setTextColor(...COLORS.slate500);
      writer.doc.text('NATAL DASHA-BHUKTI PROMISE DOSSIER', writer.margin, 9.5);

      writer.doc.setFont('helvetica', 'normal');
      writer.doc.text(pdfSafe(headerRightText), writer.pageWidth - writer.margin, 9.5, {
        align: 'right'
      });

      writer.doc.setDrawColor(...COLORS.slate200);
      writer.doc.setLineWidth(0.25);
      writer.doc.line(writer.margin, 11.5, writer.pageWidth - writer.margin, 11.5);
    }

    writer.doc.setDrawColor(...COLORS.slate200);
    writer.doc.setLineWidth(0.25);
    writer.doc.line(writer.margin, writer.pageHeight - 12, writer.pageWidth - writer.margin, writer.pageHeight - 12);

    writer.doc.setFont('helvetica', 'normal');
    writer.doc.setFontSize(7.1);
    writer.doc.setTextColor(...COLORS.slate400);
    writer.doc.text(pdfSafe(footerLeftText), writer.margin, writer.pageHeight - 7);
    writer.doc.text(`Page ${p} of ${totalPages}`, writer.pageWidth / 2, writer.pageHeight - 7, {
      align: 'center'
    });
    writer.doc.text(pdfSafe(footerRightText), writer.pageWidth - writer.margin, writer.pageHeight - 7, {
      align: 'right'
    });
  }
}

function renderDossierBox(
  writer: PdfLayoutWriter,
  x: number,
  y: number,
  w: number,
  title: string,
  badge: string,
  headline: string,
  lines: string[],
  accent: RGB,
  bg: RGB
): number {
  writer.doc.setFont('helvetica', 'normal');
  writer.doc.setFontSize(7.4);
  const wrapped: string[] = [];
  for (const l of lines) {
    const splits = writer.doc.splitTextToSize(pdfSafe(l), w - 6) as string[];
    wrapped.push(...splits);
  }
  const boxH = 14.5 + wrapped.length * 3.5 + 2.5;

  writer.doc.setFillColor(...bg);
  writer.doc.setDrawColor(...COLORS.slate200);
  writer.doc.setLineWidth(0.3);
  writer.doc.roundedRect(x, y, w, boxH, 1.3, 1.3, 'FD');

  writer.doc.setFont('helvetica', 'bold');
  writer.doc.setFontSize(6.8);
  writer.doc.setTextColor(...accent);
  writer.doc.text(pdfSafe(title), x + 3, y + 4.4);

  writer.doc.setFont('helvetica', 'normal');
  writer.doc.setFontSize(6.6);
  writer.doc.setTextColor(...COLORS.slate500);
  writer.doc.text(pdfSafe(badge), x + w - 3, y + 4.4, { align: 'right' });

  writer.doc.setFont('helvetica', 'bold');
  writer.doc.setFontSize(8.2);
  writer.doc.setTextColor(...COLORS.slate950);
  const hl = (writer.doc.splitTextToSize(pdfSafe(headline), w - 6) as string[])[0] || '';
  writer.doc.text(hl, x + 3, y + 9.2);

  writer.doc.setFont('helvetica', 'normal');
  writer.doc.setFontSize(7.4);
  writer.doc.setTextColor(...COLORS.slate700);
  writer.doc.text(wrapped, x + 3, y + 13.6);

  return boxH;
}

/**
 * Builds the complete, multi-section Natal Dasha-Bhukti PDF document covering ALL deterministic
 * baselines/MD/AD/PD1-9 scores, ALL divisional charts, ALL delivered Gemini/Fable/Alternate AI
 * predictions, and ALL follow-up Q&As (1..N) across every level and period in the session.
 */
export function buildNatalDashaCompletePdfDoc(input: NatalDashaPdfExportInput): jsPDF {
  const {
    evaluation,
    profile,
    dashaTree,
    aspectFilter,
    focusQuestion,
    reportsBySlot,
    followUpsBySlot,
    extraProviderResult,
    activeReportLevel = 'ad'
  } = input;

  const writer = new PdfLayoutWriter();
  const mdLord = evaluation.selectedMd.cleanMdLord;
  const adLord = evaluation.selectedAd.cleanAdLord;
  const personName = profile?.person_name ? pdfSafe(profile.person_name) : evaluation.personId;
  const generatedAt = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  // Collect ordered level descriptors for the selected MD & AD
  const currentLevelSlots: Array<{
    levelKey: NatalDashaPdfLevelKey;
    slotKey: string;
    label: string;
    dateSpan: string;
  }> = [
    {
      levelKey: 'md',
      slotKey: `${evaluation.personId}|md-${evaluation.selectedMd.index}`,
      label: `Mahadasha: ${mdLord}`,
      dateSpan: `${evaluation.selectedMd.startDate} to ${evaluation.selectedMd.endDate}`
    },
    {
      levelKey: 'ad',
      slotKey: `${evaluation.personId}|md-${evaluation.selectedMd.index}|ad-${evaluation.selectedAd.index}|ad`,
      label: `Antardasha: ${mdLord}-${adLord}`,
      dateSpan: `${evaluation.selectedAd.startDate} to ${evaluation.selectedAd.endDate} (${evaluation.selectedAd.totalDays} days)`
    },
    ...evaluation.pdWalkthrough.map(item => ({
      levelKey: `pd-${item.pdOption.index}` as NatalDashaPdfLevelKey,
      slotKey: `${evaluation.personId}|md-${evaluation.selectedMd.index}|ad-${evaluation.selectedAd.index}|pd-${item.pdOption.index}`,
      label: `Pratyantardasha PD #${item.pdOption.index}: ${item.pdSummary.planet} (${mdLord}-${adLord})`,
      dateSpan: `${item.pdOption.startDate} to ${item.pdOption.endDate} (${item.pdOption.totalDays} days)`
    }))
  ];

  const currentSlotSet = new Set(currentLevelSlots.map(s => s.slotKey));

  // Detect any additional slots for this person across other MD/AD selections
  const allPersonSlotKeys = Array.from(
    new Set([...Object.keys(reportsBySlot), ...Object.keys(followUpsBySlot)])
  ).filter(k => k.startsWith(`${evaluation.personId}|`));

  const otherSessionSlots = allPersonSlotKeys
    .filter(k => !currentSlotSet.has(k))
    .map(slotKey => ({
      slotKey,
      ...resolveSlotLabelFromKey(slotKey, dashaTree, evaluation)
    }));

  // Count total AI prediction reports & follow-ups across ALL slots
  let totalAiReports = 0;
  let totalFollowUps = 0;
  for (const key of allPersonSlotKeys) {
    const slotR = reportsBySlot[key] || {};
    const slotF = followUpsBySlot[key] || {};
    (['gemini_pro', 'claude_fable'] as NatalDashaDualProviderId[]).forEach(p => {
      if (slotR[p]) totalAiReports++;
      if (slotF[p]?.length) totalFollowUps += slotF[p]!.length;
    });
  }
  if (extraProviderResult) totalAiReports++;

  // =========================================================================
  // PAGE 1 EDITORIAL HEADER BANNER & METADATA GRID
  // =========================================================================
  writer.doc.setFillColor(...COLORS.slate950);
  writer.doc.roundedRect(writer.margin, writer.y, writer.contentWidth, 24, 1.8, 1.8, 'F');
  writer.doc.setFillColor(...COLORS.amber500);
  writer.doc.rect(writer.margin, writer.y, 3, 24, 'F');

  writer.doc.setFont('helvetica', 'bold');
  writer.doc.setFontSize(13.5);
  writer.doc.setTextColor(...COLORS.white);
  writer.doc.text('NATAL DASHA-BHUKTI PROMISE STUDIO REPORT', writer.margin + 6, writer.y + 8.5);

  writer.doc.setFont('helvetica', 'normal');
  writer.doc.setFontSize(8.2);
  writer.doc.setTextColor(253, 230, 138); // Amber 200
  writer.doc.text(
    'Purely Natal Promise (D1, D9, Vargas D2-D30, SAV/BAV, Shadbala, Yogas & Jaimini) | Zero Gochara Transits',
    writer.margin + 6,
    writer.y + 14.5
  );

  writer.doc.setFontSize(7.4);
  writer.doc.setTextColor(203, 213, 225);
  writer.doc.text(
    pdfSafe(`Generated: ${generatedAt}  |  AI Reports: ${totalAiReports}  |  Follow-Up Q&As: ${totalFollowUps}  |  9 PDs Evaluated`),
    writer.margin + 6,
    writer.y + 20.0
  );

  writer.y += 27.5;

  // 3x2 Metadata Grid
  const metaH = 31;
  writer.doc.setFillColor(...COLORS.slate50);
  writer.doc.setDrawColor(...COLORS.slate200);
  writer.doc.setLineWidth(0.35);
  writer.doc.roundedRect(writer.margin, writer.y, writer.contentWidth, metaH, 1.5, 1.5, 'FD');

  const colW = (writer.contentWidth - 6) / 3;
  const c1X = writer.margin + 3;
  const c2X = writer.margin + 3 + colW;
  const c3X = writer.margin + 3 + colW * 2;
  const row2Y = writer.y + 15.5;
  writer.doc.line(writer.margin + 2, row2Y, writer.pageWidth - writer.margin - 2, row2Y);

  const drawMetaCell = (x: number, topY: number, label: string, val: string, sub: string, valColor: RGB = COLORS.slate950) => {
    writer.doc.setFont('helvetica', 'bold');
    writer.doc.setFontSize(6.5);
    writer.doc.setTextColor(...COLORS.slate500);
    writer.doc.text(pdfSafe(label), x, topY + 4.2);

    writer.doc.setFont('helvetica', 'bold');
    writer.doc.setFontSize(8.4);
    writer.doc.setTextColor(...valColor);
    const vLine = (writer.doc.splitTextToSize(pdfSafe(val), colW - 3) as string[])[0] || '';
    writer.doc.text(vLine, x, topY + 8.8);

    writer.doc.setFont('helvetica', 'normal');
    writer.doc.setFontSize(6.8);
    writer.doc.setTextColor(...COLORS.slate600);
    const sLine = (writer.doc.splitTextToSize(pdfSafe(sub), colW - 3) as string[])[0] || '';
    writer.doc.text(sLine, x, topY + 13.0);
  };

  drawMetaCell(
    c1X,
    writer.y,
    'NATIVE PROFILE',
    `${evaluation.personId} - ${personName}`,
    `${profile?.date_of_birth || ''} ${profile?.place_of_birth ? '| ' + profile.place_of_birth : ''}`.trim() || 'Authoritative Natal Chart'
  );
  drawMetaCell(
    c2X,
    writer.y,
    'NATAL COORDINATES',
    `Lagna: ${evaluation.lagnaSign} (L1)`,
    `Rashi: ${evaluation.moonSign} | ${evaluation.janmaStar}`
  );
  drawMetaCell(
    c3X,
    writer.y,
    'SELECTED MAHADASHA (MD)',
    `${mdLord} Mahadasha`,
    `${evaluation.selectedMd.startDate} to ${evaluation.selectedMd.endDate}`,
    COLORS.amber800
  );
  drawMetaCell(
    c1X,
    row2Y,
    'SELECTED ANTARDASHA (AD)',
    `${mdLord} -> ${adLord} AD`,
    `${evaluation.selectedAd.startDate} to ${evaluation.selectedAd.endDate} (${evaluation.selectedAd.totalDays}d)`,
    COLORS.sky700
  );
  drawMetaCell(
    c2X,
    row2Y,
    'MD-AD SAMBANDHA AXIS',
    evaluation.mdAdSambandha.patternLabel,
    `${evaluation.mdAdSambandha.houseDistanceD1}th House | ${evaluation.mdAdSambandha.friendshipLabel}`
  );
  drawMetaCell(
    c3X,
    row2Y,
    'ASPECT FILTER & DOSSIER SCOPE',
    aspectFilter === 'all' ? 'All 6 Life Aspects' : NATAL_ASPECT_SPECS[aspectFilter].label,
    focusQuestion?.trim() ? `Question: ${focusQuestion.trim()}` : 'Complete Baseline + MD/AD/9 PDs + AI Reports'
  );

  writer.y += metaH + 5;

  // =========================================================================
  // SECTION 1: MD, AD & MUTUAL SAMBANDHA DOSSIERS
  // =========================================================================
  writer.renderSectionHeading(
    '1. MAHADASHA (MD), ANTARDASHA (AD) & SAMBANDHA DOSSIER',
    `${mdLord} MD > ${adLord} AD`
  );

  const halfW = (writer.contentWidth - 4) / 2;
  const mdLines = [
    `Owns: ${evaluation.mdSummary.ownedHousesL.length ? `L${evaluation.mdSummary.ownedHousesL.join(' & L')}` : 'Nodal Axis'} | Dignity: ${evaluation.mdSummary.dignity || 'Neutral'}${evaluation.mdSummary.hasNeechaBhanga ? ' (Neecha Bhanga)' : ''}${evaluation.mdSummary.isCombust ? ' (Combust)' : ''}${evaluation.mdSummary.isRetro ? ' [R]' : ''}`,
    `D9 Navamsa: H${evaluation.mdSummary.d9House} ${evaluation.mdSummary.d9Sign}${evaluation.mdSummary.isVargottama ? ' (Vargottama)' : ''}`,
    `SAV Seat: ${evaluation.mdSummary.savAtSeat}${evaluation.mdSummary.shadbalaStatus ? ` | Shadbala: ${evaluation.mdSummary.shadbalaStatus}` : ''}`
  ];
  const adLines = [
    `Owns: ${evaluation.adSummary.ownedHousesL.length ? `L${evaluation.adSummary.ownedHousesL.join(' & L')}` : 'Nodal Axis'} | Dignity: ${evaluation.adSummary.dignity || 'Neutral'}${evaluation.adSummary.hasNeechaBhanga ? ' (Neecha Bhanga)' : ''}${evaluation.adSummary.isCombust ? ' (Combust)' : ''}${evaluation.adSummary.isRetro ? ' [R]' : ''}`,
    `D9 Navamsa: H${evaluation.adSummary.d9House} ${evaluation.adSummary.d9Sign}${evaluation.adSummary.isVargottama ? ' (Vargottama)' : ''}`,
    `SAV Seat: ${evaluation.adSummary.savAtSeat}${evaluation.adSummary.shadbalaStatus ? ` | Shadbala: ${evaluation.adSummary.shadbalaStatus}` : ''}`
  ];

  writer.ensureSpace(42);
  const mdBoxH = renderDossierBox(
    writer,
    writer.margin,
    writer.y,
    halfW,
    'MAHADASHA LORD (MD)',
    evaluation.mdSummary.functionalNature,
    `${evaluation.mdSummary.planet} in ${evaluation.mdSummary.signName} (L${evaluation.mdSummary.hLagna}/M${evaluation.mdSummary.hMoon})`,
    mdLines,
    COLORS.amber700,
    COLORS.amber50
  );
  const adBoxH = renderDossierBox(
    writer,
    writer.margin + halfW + 4,
    writer.y,
    halfW,
    'ANTARDASHA LORD (AD)',
    evaluation.adSummary.functionalNature,
    `${evaluation.adSummary.planet} in ${evaluation.adSummary.signName} (L${evaluation.adSummary.hLagna}/M${evaluation.adSummary.hMoon})`,
    adLines,
    COLORS.sky700,
    COLORS.sky50
  );
  writer.y += Math.max(mdBoxH, adBoxH) + 3.5;

  // MD-AD Executive Bridge
  const bridgeText = `${evaluation.mdAdSambandha.mutualConnection}. ${evaluation.adExecutiveSummary}`;
  writer.doc.setFont('helvetica', 'normal');
  writer.doc.setFontSize(7.8);
  const bridgeLines = writer.doc.splitTextToSize(pdfSafe(bridgeText), writer.contentWidth - 8) as string[];
  const bridgeH = 10 + bridgeLines.length * 3.6;
  writer.ensureSpace(bridgeH + 4);
  writer.doc.setFillColor(...COLORS.purple50);
  writer.doc.setDrawColor(...COLORS.purple500);
  writer.doc.setLineWidth(0.3);
  writer.doc.roundedRect(writer.margin, writer.y, writer.contentWidth, bridgeH, 1.3, 1.3, 'FD');
  writer.doc.setFont('helvetica', 'bold');
  writer.doc.setFontSize(7.4);
  writer.doc.setTextColor(...COLORS.purple700);
  writer.doc.text(
    pdfSafe(`MD-AD MUTUAL SAMBANDHA: ${evaluation.mdSummary.planet} <-> ${evaluation.adSummary.planet} (${evaluation.mdAdSambandha.patternLabel} | ${evaluation.mdAdSambandha.friendshipLabel})`),
    writer.margin + 3.5,
    writer.y + 4.8
  );
  writer.doc.setFont('helvetica', 'normal');
  writer.doc.setFontSize(7.8);
  writer.doc.setTextColor(...COLORS.slate800);
  writer.doc.text(bridgeLines, writer.margin + 3.5, writer.y + 9.2);
  writer.y += bridgeH + 5;

  // =========================================================================
  // SECTION 2: 6-ASPECT NATAL BASELINE, MD PROMISE & AD PROMISE BREAKDOWN
  // =========================================================================
  writer.renderSectionHeading(
    '2. ALL 6 LIFE ASPECTS: FIXED NATAL BASELINE -> MD -> AD PROMISE',
    'Career, Finance, Love, Family, Health, Litigations'
  );

  const aspectRows = NATAL_ASPECT_ORDER.map(id => {
    const base = evaluation.baselineAspects[id];
    const md = evaluation.mdAspects[id];
    const ad = evaluation.adAspects[id];
    return [
      NATAL_ASPECT_SPECS[id].label,
      `${base.score}% (${base.band})\n${base.focusHousesSummary}\nVargas: ${base.vargaSummary}`,
      `${md.score}% (${md.tone})\n${md.verdict}`,
      `${ad.score}% (${ad.tone})\n${ad.verdict}\n${ad.rationale}`
    ];
  });

  writer.renderTable(
    ['Life Aspect', 'Fixed Natal Baseline', `${mdLord} MD Promise`, `${mdLord}-${adLord} AD Promise & Rationale`],
    aspectRows,
    {
      colWeights: [16, 26, 22, 36],
      fontSize: 7.2,
      headerBg: COLORS.slate800,
      headerText: COLORS.white
    }
  );

  // =========================================================================
  // SECTION 3: ALL 9 PRATYANTARDASHAS (PD #1 - #9) MATRIX & DETAILED WALKTHROUGH
  // =========================================================================
  writer.renderSectionHeading(
    `3. ALL ${evaluation.pdWalkthrough.length} PRATYANTARDASHAS (PD) CHRONOLOGICAL WALKTHROUGH`,
    `${mdLord}-${adLord} Sub-Period Arc`
  );

  const pdOverviewRows = evaluation.pdWalkthrough.map(item => [
    `PD #${item.pdOption.index}\n${item.pdSummary.planet}`,
    `${item.pdOption.startDate} to\n${item.pdOption.endDate}\n(${item.pdOption.totalDays}d)`,
    `${item.overallScore}%\n${item.overallTone}`,
    `L${item.pdSummary.hLagna}/M${item.pdSummary.hMoon} (${item.pdSummary.dignity || 'Neutral'})\nD9 H${item.pdSummary.d9House} | AD: ${item.linkToAd.patternLabel}`,
    `${item.aspectEvaluations.career.score}%`,
    `${item.aspectEvaluations.finance.score}%`,
    `${item.aspectEvaluations.love.score}%`,
    `${item.aspectEvaluations.family.score}%`,
    `${item.aspectEvaluations.health.score}%`,
    `${item.aspectEvaluations.litigations.score}%`
  ]);

  writer.renderTable(
    ['PD #', 'Date Span', 'Overall', 'Seat & Link to AD', 'Car', 'Fin', 'Lov', 'Fam', 'Hea', 'Lit'],
    pdOverviewRows,
    {
      colWeights: [13, 18, 15, 24, 5, 5, 5, 5, 5, 5],
      fontSize: 7.0,
      headerBg: COLORS.slate100,
      headerText: COLORS.slate950
    }
  );

  // Detailed PD #1..#9 Blocks (zero rationales truncated)
  evaluation.pdWalkthrough.forEach(item => {
    const p = item.pdSummary;
    const tc = toneColors(item.overallTone);
    const pdHeader = `PD #${item.pdOption.index}: ${p.planet} Pratyantardasha  (${item.pdOption.startDate} -> ${item.pdOption.endDate}, ${item.pdOption.totalDays} days)`;
    const pdMeta = [
      `D1 Seat: L${p.hLagna}/M${p.hMoon} ${p.signName} (${p.dignity || 'Neutral'}${p.hasNeechaBhanga ? '+NB' : ''}${p.isCombust ? ', Combust' : ''}${p.isRetro ? ' [R]' : ''})`,
      `D9 Navamsa: H${p.d9House} ${p.d9Sign}`,
      `Link to AD: ${item.linkToAd.patternLabel}`,
      `Link to MD: ${item.linkToMd.patternLabel}`
    ].join('  |  ');

    writer.ensureSpace(34);
    writer.doc.setFillColor(...tc.bg);
    writer.doc.setDrawColor(...tc.border);
    writer.doc.setLineWidth(0.32);
    writer.doc.roundedRect(writer.margin, writer.y, writer.contentWidth, 12.5, 1.2, 1.2, 'FD');

    writer.doc.setFont('helvetica', 'bold');
    writer.doc.setFontSize(8.4);
    writer.doc.setTextColor(...COLORS.slate950);
    writer.doc.text(pdfSafe(pdHeader), writer.margin + 3, writer.y + 4.8);

    writer.doc.setTextColor(...tc.text);
    writer.doc.text(pdfSafe(`${item.overallScore}% (${item.overallTone})`), writer.pageWidth - writer.margin - 3, writer.y + 4.8, {
      align: 'right'
    });

    writer.doc.setFont('helvetica', 'normal');
    writer.doc.setFontSize(7.0);
    writer.doc.setTextColor(...COLORS.slate700);
    const metaFit = (writer.doc.splitTextToSize(pdfSafe(pdMeta), writer.contentWidth - 6) as string[])[0] || '';
    writer.doc.text(metaFit, writer.margin + 3, writer.y + 9.6);
    writer.y += 14.5;

    writer.renderRichParagraph(`**Headline:** ${item.headlineSummary}`, writer.margin + 1, writer.contentWidth - 2, {
      fontSize: 7.8,
      lineHeight: 3.7
    });

    if (item.vargaHighlights.length > 0) {
      writer.renderRichParagraph(
        `**Varga Highlights:** ${item.vargaHighlights.join(' | ')}`,
        writer.margin + 1,
        writer.contentWidth - 2,
        { fontSize: 7.4, lineHeight: 3.5, baseColor: COLORS.slate600 }
      );
    }

    if (item.pdOption.savedNote) {
      const ratingTxt = item.pdOption.savedRating !== null ? ` (Rating ${item.pdOption.savedRating}/10)` : '';
      writer.renderRichParagraph(
        `**Recorded PD Note${ratingTxt}:** ${item.pdOption.savedNote}`,
        writer.margin + 1,
        writer.contentWidth - 2,
        { fontSize: 7.5, lineHeight: 3.6, baseColor: COLORS.amber800 }
      );
    }

    writer.y += 1.2;

    const pdAspectRows = NATAL_ASPECT_ORDER.map(id => {
      const ev = item.aspectEvaluations[id];
      return [
        NATAL_ASPECT_SPECS[id].shortLabel,
        `${ev.score}% (${ev.tone})`,
        ev.verdict,
        ev.rationale
      ];
    });
    writer.renderTable(['Aspect', 'Score & Tone', 'Verdict', 'Natal & Dasha Rationale'], pdAspectRows, {
      colWeights: [14, 15, 25, 46],
      fontSize: 7.0,
      headerBg: COLORS.slate100,
      headerText: COLORS.slate800
    });
  });

  // =========================================================================
  // SECTION 4: DIVISIONAL VARGAS (D2-D30) & KEY BASELINE FACTORS
  // =========================================================================
  const vargaCodes = ['D2', 'D3', 'D4', 'D6', 'D7', 'D8', 'D10', 'D11', 'D12', 'D16', 'D27', 'D30'].filter(
    code => Boolean(evaluation.vargas[code])
  );
  if (vargaCodes.length > 0) {
    writer.renderSectionHeading(
      `4. DIVISIONAL VARGAS REFERENCE (${vargaCodes.length} CHARTS LOADED)`,
      'Structural Natal Chart Evidence'
    );

    const vargaRows = vargaCodes.map(code => {
      const v = evaluation.vargas[code];
      const occupied = v.houses
        .filter(h => h.planets.length > 0)
        .map(h => `H${h.house} ${h.sign}: ${h.planets.map(p => cleanNatalPlanetName(p)).join(', ')}`)
        .join(' | ');
      return [
        `${v.code}\n${v.name}`,
        `${v.lagnaSign} ${v.lagnaDeg || ''}`.trim(),
        occupied || 'No occupied houses recorded'
      ];
    });

    writer.renderTable(['Varga', 'Varga Lagna', 'Occupied House Placements (H1-H12)'], vargaRows, {
      colWeights: [18, 20, 62],
      fontSize: 7.0,
      headerBg: COLORS.slate100,
      headerText: COLORS.slate950
    });
  }

  // =========================================================================
  // SECTION 5: ALL DELIVERED AI PREDICTION REPORTS & FOLLOW-UP Q&As (1..N)
  // =========================================================================
  writer.renderSectionHeading(
    '5. DELIVERED AI PREDICTION REPORTS & ALL FOLLOW-UP Q&As',
    `${totalAiReports} Report${totalAiReports === 1 ? '' : 's'} | ${totalFollowUps} Follow-Up${totalFollowUps === 1 ? '' : 's'}`
  );

  let renderedCount = 0;

  for (const slot of currentLevelSlots) {
    const slotReports = reportsBySlot[slot.slotKey] || {};
    const slotFollowUps = followUpsBySlot[slot.slotKey] || {};

    for (const providerId of ['gemini_pro', 'claude_fable'] as NatalDashaDualProviderId[]) {
      const report = slotReports[providerId];
      const fUps = slotFollowUps[providerId] || [];
      if (!report && fUps.length === 0) continue;

      renderedCount++;
      renderAiReportAndFollowUps(writer, {
        levelLabel: slot.label,
        dateSpan: slot.dateSpan,
        providerId,
        report,
        followUps: fUps,
        defaultFocusQuestion: focusQuestion
      });
    }
  }

  // Alternate Engine Runner Report (Sonnet / Haiku / Local Qwen) if executed
  if (extraProviderResult) {
    renderedCount++;
    const activeSlot = currentLevelSlots.find(s => s.levelKey === activeReportLevel) || currentLevelSlots[1];
    renderAiReportAndFollowUps(writer, {
      levelLabel: `${activeSlot.label} (Alternate Engine)`,
      dateSpan: activeSlot.dateSpan,
      providerId: extraProviderResult.providerUsed,
      report: extraProviderResult,
      followUps: [],
      defaultFocusQuestion: focusQuestion
    });
  }

  // Any other MD/AD periods generated earlier in the same session for this person
  if (otherSessionSlots.length > 0) {
    const hasOtherContent = otherSessionSlots.some(slot => {
      const r = reportsBySlot[slot.slotKey] || {};
      const f = followUpsBySlot[slot.slotKey] || {};
      return Boolean(r.gemini_pro || r.claude_fable || f.gemini_pro?.length || f.claude_fable?.length);
    });

    if (hasOtherContent) {
      writer.renderSectionHeading(
        '6. ADDITIONAL GENERATED DASHA PERIODS IN THIS SESSION',
        `${evaluation.personId} Cross-Period Reports & Follow-Ups`
      );
      for (const slot of otherSessionSlots) {
        const slotReports = reportsBySlot[slot.slotKey] || {};
        const slotFollowUps = followUpsBySlot[slot.slotKey] || {};
        for (const providerId of ['gemini_pro', 'claude_fable'] as NatalDashaDualProviderId[]) {
          const report = slotReports[providerId];
          const fUps = slotFollowUps[providerId] || [];
          if (!report && fUps.length === 0) continue;
          renderedCount++;
          renderAiReportAndFollowUps(writer, {
            levelLabel: slot.label,
            dateSpan: slot.dateSpan,
            providerId,
            report,
            followUps: fUps
          });
        }
      }
    }
  }

  if (renderedCount === 0) {
    writer.ensureSpace(16);
    writer.doc.setFillColor(...COLORS.slate50);
    writer.doc.setDrawColor(...COLORS.slate200);
    writer.doc.setLineWidth(0.3);
    writer.doc.roundedRect(writer.margin, writer.y, writer.contentWidth, 14, 1.2, 1.2, 'FD');
    writer.doc.setFont('helvetica', 'italic');
    writer.doc.setFontSize(8.2);
    writer.doc.setTextColor(...COLORS.slate600);
    writer.doc.text(
      'No AI prediction reports were generated yet in this session. All deterministic natal MD/AD/PD1-9 scores above are complete.',
      writer.margin + 4,
      writer.y + 8.5
    );
    writer.y += 16;
  }

  applyHeadersAndFooters(
    writer,
    `${evaluation.personId} | ${mdLord} MD > ${adLord} AD`,
    `Purely Natal Synthesis (Zero Gochara Transits) | ${generatedAt}`,
    `${evaluation.personId} | ${mdLord}-${adLord}`
  );

  return writer.doc;
}

export function exportNatalDashaCompletePdf(input: NatalDashaPdfExportInput): string {
  const doc = buildNatalDashaCompletePdfDoc(input);
  const ts = createReportFilenameTimestamp();
  const filename = `${input.evaluation.personId}_${input.evaluation.selectedMd.cleanMdLord}_${input.evaluation.selectedAd.cleanAdLord}_Natal_Dasha_Complete_Report_${ts}.pdf`;
  doc.save(filename);
  return filename;
}

/**
 * Builds a focused PDF for a single Dasha level & Provider tab, including the deterministic
 * level baseline and ALL follow-up Q&As (1..N) for that report.
 */
export function buildSingleNatalDashaReportPdfDoc(input: NatalDashaSinglePdfInput): jsPDF {
  const { evaluation, profile, levelKey, providerId, report, followUps, aspectFilter } = input;
  const writer = new PdfLayoutWriter();
  const mdLord = evaluation.selectedMd.cleanMdLord;
  const adLord = evaluation.selectedAd.cleanAdLord;
  const provName = providerDisplayName(providerId);
  const generatedAt = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  let levelLabel = `${mdLord}-${adLord} Antardasha`;
  let dateSpan = `${evaluation.selectedAd.startDate} to ${evaluation.selectedAd.endDate} (${evaluation.selectedAd.totalDays}d)`;
  let aspectRows: string[][] = [];

  if (levelKey === 'md') {
    levelLabel = `${mdLord} Mahadasha`;
    dateSpan = `${evaluation.selectedMd.startDate} to ${evaluation.selectedMd.endDate}`;
    aspectRows = NATAL_ASPECT_ORDER.map(id => {
      const ev = evaluation.mdAspects[id];
      return [NATAL_ASPECT_SPECS[id].label, `${ev.score}% (${ev.tone})`, ev.verdict, ev.rationale];
    });
  } else if (levelKey === 'ad') {
    aspectRows = NATAL_ASPECT_ORDER.map(id => {
      const ev = evaluation.adAspects[id];
      return [NATAL_ASPECT_SPECS[id].label, `${ev.score}% (${ev.tone})`, ev.verdict, ev.rationale];
    });
  } else if (levelKey.startsWith('pd-')) {
    const pdIdx = Number(levelKey.slice(3)) || 1;
    const pdItem = evaluation.pdWalkthrough.find(p => p.pdOption.index === pdIdx) || evaluation.pdWalkthrough[0];
    if (pdItem) {
      levelLabel = `PD #${pdItem.pdOption.index}: ${pdItem.pdSummary.planet} (${mdLord}-${adLord})`;
      dateSpan = `${pdItem.pdOption.startDate} to ${pdItem.pdOption.endDate} (${pdItem.pdOption.totalDays}d)`;
      aspectRows = NATAL_ASPECT_ORDER.map(id => {
        const ev = pdItem.aspectEvaluations[id];
        return [NATAL_ASPECT_SPECS[id].label, `${ev.score}% (${ev.tone})`, ev.verdict, ev.rationale];
      });
    }
  }

  // Cover Header
  writer.doc.setFillColor(...COLORS.slate950);
  writer.doc.roundedRect(writer.margin, writer.y, writer.contentWidth, 22, 1.8, 1.8, 'F');
  writer.doc.setFillColor(...(providerId === 'gemini_pro' ? COLORS.amber500 : COLORS.purple500));
  writer.doc.rect(writer.margin, writer.y, 3, 22, 'F');

  writer.doc.setFont('helvetica', 'bold');
  writer.doc.setFontSize(12.5);
  writer.doc.setTextColor(...COLORS.white);
  writer.doc.text(pdfSafe(`NATAL DASHA PREDICTION REPORT - ${provName.toUpperCase()}`), writer.margin + 6, writer.y + 8);

  writer.doc.setFont('helvetica', 'normal');
  writer.doc.setFontSize(8.0);
  writer.doc.setTextColor(253, 230, 138);
  writer.doc.text(
    pdfSafe(`${evaluation.personId}${profile?.person_name ? ` (${profile.person_name})` : ''}  |  ${levelLabel}  |  ${dateSpan}`),
    writer.margin + 6,
    writer.y + 13.8
  );

  writer.doc.setFontSize(7.2);
  writer.doc.setTextColor(203, 213, 225);
  writer.doc.text(
    pdfSafe(`Lagna: ${evaluation.lagnaSign} | Rashi: ${evaluation.moonSign} | Purely Natal (Zero Transits) | Follow-Ups: ${followUps.length}`),
    writer.margin + 6,
    writer.y + 18.8
  );
  writer.y += 26;

  writer.renderSectionHeading(
    '1. DETERMINISTIC NATAL LEVEL SCORES',
    aspectFilter === 'all' ? 'All 6 Life Aspects' : NATAL_ASPECT_SPECS[aspectFilter].label
  );
  writer.renderTable(['Life Aspect', 'Score & Tone', 'Verdict', 'Causal Natal & Dasha Rationale'], aspectRows, {
    colWeights: [18, 15, 24, 43],
    fontSize: 7.2,
    headerBg: COLORS.slate800,
    headerText: COLORS.white
  });

  writer.renderSectionHeading(
    `2. ${provName.toUpperCase()} PREDICTION & FOLLOW-UP Q&As`,
    `${followUps.length} Follow-Up${followUps.length === 1 ? '' : 's'} Included`
  );

  renderAiReportAndFollowUps(writer, {
    levelLabel,
    dateSpan,
    providerId,
    report,
    followUps
  });

  applyHeadersAndFooters(
    writer,
    `${evaluation.personId} | ${levelLabel} | ${provName}`,
    `Purely Natal Synthesis (Zero Gochara Transits) | ${generatedAt}`,
    `${evaluation.personId} | ${levelLabel}`
  );

  return writer.doc;
}

export function exportSingleNatalDashaReportPdf(input: NatalDashaSinglePdfInput): string {
  const doc = buildSingleNatalDashaReportPdfDoc(input);
  const ts = createReportFilenameTimestamp();
  const provTag = input.providerId === 'gemini_pro' ? 'Gemini' : 'Claude-Fable';
  const levelTag = input.levelKey.toUpperCase();
  const filename = `${input.evaluation.personId}_${input.evaluation.selectedMd.cleanMdLord}_${input.evaluation.selectedAd.cleanAdLord}_${levelTag}_${provTag}_Natal_Report_${ts}.pdf`;
  doc.save(filename);
  return filename;
}
