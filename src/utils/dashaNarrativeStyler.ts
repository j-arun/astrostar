/**
 * Planetary Color Palette & PD Attribution Engine for Vimshottari Narratives
 * 
 * Palette requirement:
 * - Moon: White
 * - Ketu / Kedhu: Light brown
 * - Rahu: Grey
 * - Saturn (Sat): Black / deep charcoal
 * - Mars: Red
 * - Mercury: Green
 * - Venus: Silver
 * - Sun: Orange
 * - Jupiter (Jup): Yellow
 */

export type GrahaLord =
  | 'Sun'
  | 'Moon'
  | 'Mars'
  | 'Mercury'
  | 'Jupiter'
  | 'Venus'
  | 'Saturn'
  | 'Rahu'
  | 'Ketu';

export interface GrahaColorConfig {
  name: GrahaLord;
  displayName: string;
  aliases: string[];
  // Hex color codes
  colorHex: string;
  bgHex: string;
  borderHex: string;
  // Tailwind class strings
  pillClass: string;
  highlightClass: string;
  dotClass: string;
  badgeClass: string;
  description: string;
}

export const GRAHA_COLOR_CONFIGS: Record<GrahaLord, GrahaColorConfig> = {
  Moon: {
    name: 'Moon',
    displayName: 'Moon',
    aliases: ['moon', 'chandra', 'chndra', 'soma'],
    colorHex: '#FFFFFF',
    bgHex: 'rgba(255, 255, 255, 0.12)',
    borderHex: '#FFFFFF',
    pillClass: 'bg-white/10 text-white border-white/60 hover:bg-white/20',
    highlightClass: 'bg-white/15 text-white border-b-2 border-white/80 shadow-[0_0_10px_rgba(255,255,255,0.15)]',
    dotClass: 'bg-white ring-1 ring-white/50',
    badgeClass: 'bg-white/15 text-white border border-white/40',
    description: 'White luminous highlight'
  },
  Ketu: {
    name: 'Ketu',
    displayName: 'Ketu / Kedhu',
    aliases: ['ketu', 'kedhu', 'kethu', 'dhwaja'],
    colorHex: '#C4A482',
    bgHex: 'rgba(196, 164, 130, 0.18)',
    borderHex: '#C4A482',
    pillClass: 'bg-[#C4A482]/15 text-[#edd2b8] border-[#C4A482]/50 hover:bg-[#C4A482]/25',
    highlightClass: 'bg-[#C4A482]/20 text-[#f5e3d0] border-b-2 border-[#C4A482] shadow-[0_0_8px_rgba(196,164,130,0.2)]',
    dotClass: 'bg-[#C4A482]',
    badgeClass: 'bg-[#C4A482]/20 text-[#f5e3d0] border border-[#C4A482]/40',
    description: 'Light brown earthy tone'
  },
  Rahu: {
    name: 'Rahu',
    displayName: 'Rahu',
    aliases: ['rahu', 'dragon head', 'north node'],
    colorHex: '#94A3B8',
    bgHex: 'rgba(148, 163, 184, 0.18)',
    borderHex: '#94A3B8',
    pillClass: 'bg-slate-700/40 text-slate-200 border-slate-500/50 hover:bg-slate-700/60',
    highlightClass: 'bg-slate-700/35 text-slate-200 border-b-2 border-slate-400 shadow-[0_0_8px_rgba(148,163,184,0.15)]',
    dotClass: 'bg-slate-400',
    badgeClass: 'bg-slate-800 text-slate-300 border border-slate-600',
    description: 'Smoky grey neutral highlight'
  },
  Saturn: {
    name: 'Saturn',
    displayName: 'Saturn (Sat)',
    aliases: ['saturn', 'sat', 'sani', 'shani'],
    colorHex: '#0F172A',
    bgHex: 'rgba(15, 23, 42, 0.95)',
    borderHex: '#475569',
    pillClass: 'bg-black/90 text-slate-100 border-slate-600 hover:border-slate-400',
    highlightClass: 'bg-black/85 text-slate-100 border-b-2 border-slate-400 border-l border-slate-600 shadow-[0_0_8px_rgba(0,0,0,0.5)]',
    dotClass: 'bg-black border border-slate-500',
    badgeClass: 'bg-black text-slate-100 border border-slate-600',
    description: 'Black / deep obsidian highlight'
  },
  Mars: {
    name: 'Mars',
    displayName: 'Mars',
    aliases: ['mars', 'kuja', 'mangal', 'angarakha', 'sevvai'],
    colorHex: '#EF4444',
    bgHex: 'rgba(239, 68, 68, 0.18)',
    borderHex: '#EF4444',
    pillClass: 'bg-rose-500/15 text-rose-200 border-rose-500/50 hover:bg-rose-500/25',
    highlightClass: 'bg-rose-500/20 text-rose-200 border-b-2 border-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.2)]',
    dotClass: 'bg-rose-500',
    badgeClass: 'bg-rose-500/20 text-rose-200 border border-rose-500/40',
    description: 'Vivid red highlight'
  },
  Mercury: {
    name: 'Mercury',
    displayName: 'Mercury',
    aliases: ['mercury', 'budha', 'budh'],
    colorHex: '#22C55E',
    bgHex: 'rgba(34, 197, 94, 0.18)',
    borderHex: '#22C55E',
    pillClass: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/50 hover:bg-emerald-500/25',
    highlightClass: 'bg-emerald-500/20 text-emerald-200 border-b-2 border-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.2)]',
    dotClass: 'bg-emerald-500',
    badgeClass: 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40',
    description: 'Green verdant highlight'
  },
  Venus: {
    name: 'Venus',
    displayName: 'Venus',
    aliases: ['venus', 'sukra', 'shukra', 'bhrigu'],
    colorHex: '#CBD5E1',
    bgHex: 'rgba(203, 213, 225, 0.16)',
    borderHex: '#E2E8F0',
    pillClass: 'bg-slate-200/15 text-slate-100 border-slate-300/60 hover:bg-slate-200/25',
    highlightClass: 'bg-slate-200/20 text-white border-b-2 border-slate-300 shadow-[0_0_10px_rgba(203,213,225,0.25)]',
    dotClass: 'bg-gradient-to-tr from-slate-300 to-white ring-1 ring-white/60',
    badgeClass: 'bg-slate-200/15 text-slate-100 border border-slate-300/50',
    description: 'Silver metallic highlight'
  },
  Sun: {
    name: 'Sun',
    displayName: 'Sun',
    aliases: ['sun', 'surya', 'ravi', 'aditya'],
    colorHex: '#F97316',
    bgHex: 'rgba(249, 115, 22, 0.18)',
    borderHex: '#F97316',
    pillClass: 'bg-orange-500/15 text-orange-200 border-orange-500/50 hover:bg-orange-500/25',
    highlightClass: 'bg-orange-500/20 text-orange-200 border-b-2 border-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.2)]',
    dotClass: 'bg-orange-500',
    badgeClass: 'bg-orange-500/20 text-orange-200 border border-orange-500/40',
    description: 'Solar orange highlight'
  },
  Jupiter: {
    name: 'Jupiter',
    displayName: 'Jupiter (Jup)',
    aliases: ['jupiter', 'jup', 'guru', 'brihaspati'],
    colorHex: '#EAB308',
    bgHex: 'rgba(234, 179, 8, 0.18)',
    borderHex: '#EAB308',
    pillClass: 'bg-amber-400/15 text-amber-200 border-amber-400/50 hover:bg-amber-400/25',
    highlightClass: 'bg-amber-400/20 text-amber-100 border-b-2 border-amber-400 shadow-[0_0_8px_rgba(234,179,8,0.2)]',
    dotClass: 'bg-amber-400',
    badgeClass: 'bg-amber-400/20 text-amber-100 border border-amber-400/40',
    description: 'Golden yellow highlight'
  }
};

/**
 * Normalizes user-inputted planet names (e.g. "kedhu", "sat", "jup") to canonical GrahaLord
 */
export function normalizeGrahaLord(input?: string | null): GrahaLord | null {
  if (!input) return null;
  const clean = input.trim().toLowerCase().replace(/[^a-z]/g, '');
  for (const [key, config] of Object.entries(GRAHA_COLOR_CONFIGS) as [GrahaLord, GrahaColorConfig][]) {
    if (key.toLowerCase() === clean) return key;
    if (config.aliases.some(alias => alias.replace(/[^a-z]/g, '') === clean)) return key;
  }
  return null;
}

export interface PdFeedItem {
  mahadasha_lord: string;
  antardasha_lord: string;
  pratyantardasha_lord: string;
  start_date: string;
  end_date: string;
  notes: string | null;
  evaluation_rating: 0 | 5 | 10 | null;
  duration_days?: number;
}

export interface HighlightedSegment {
  id: string;
  text: string;
  attributedLord: GrahaLord | null;
  matchedFeed?: PdFeedItem;
  score?: number;
}

/**
 * Attributing sentences/chunks of the narrative to the relevant PD based on:
 * 1. Explicit tags like [PD: Moon], [Moon PD], (Moon), or "Moon PD:"
 * 2. Keyword/substring matches from the PD's notes
 * 3. Temporal order or direct planet mentions
 */
export function parseNarrativeWithPdHighlights(
  narrativeText: string,
  pdFeeds: PdFeedItem[]
): HighlightedSegment[] {
  if (!narrativeText) return [];

  // Break text into sentences / lines
  const rawLines = narrativeText.split(/\n+/);
  const segments: HighlightedSegment[] = [];
  let seq = 0;

  // Prepare PD feeds dictionary and search words
  const feedsWithNotes = pdFeeds.filter(feed => 
    (feed.notes && feed.notes.trim().length > 0) || feed.evaluation_rating !== null
  );

  const pdKeywordMap = feedsWithNotes.map(feed => {
    const lord = normalizeGrahaLord(feed.pratyantardasha_lord);
    const noteWords = (feed.notes || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(w => w.length > 3 && !['with', 'from', 'that', 'this', 'have', 'were', 'been'].includes(w));
    
    return {
      feed,
      lord,
      noteWords,
      fullNote: (feed.notes || '').toLowerCase().trim(),
      startDate: feed.start_date,
      endDate: feed.end_date
    };
  });

  for (const line of rawLines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Split line into sentence units (keeping punctuation)
    const sentenceMatches = trimmedLine.match(/[^.!?]+[.!?]+|\s*[^.!?]+$/g) || [trimmedLine];

    for (const rawSentence of sentenceMatches) {
      const sentence = rawSentence.trim();
      if (!sentence) continue;

      let attributedLord: GrahaLord | null = null;
      let matchedFeed: PdFeedItem | undefined = undefined;
      let bestScore = 0;

      // 1. Check explicit tag e.g. [PD: Moon], [Moon], (Moon PD), or "Moon PD:"
      const tagMatch = sentence.match(/\[(?:PD:?\s*)?([A-Za-z]+)(?:\s*PD)?\]|\((?:PD:?\s*)?([A-Za-z]+)(?:\s*PD)?\)|\b([A-Za-z]+)\s+PD\b/i);
      if (tagMatch) {
        const candidatePlanet = tagMatch[1] || tagMatch[2] || tagMatch[3];
        const norm = normalizeGrahaLord(candidatePlanet);
        if (norm) {
          attributedLord = norm;
          matchedFeed = feedsWithNotes.find(f => normalizeGrahaLord(f.pratyantardasha_lord) === norm);
          bestScore = 100;
        }
      }

      // 2. If no explicit tag, check keyword overlap against PD notes
      if (!attributedLord) {
        const sentenceLower = sentence.toLowerCase();

        for (const pdItem of pdKeywordMap) {
          let score = 0;

          // Check if planet name or alias is mentioned
          if (pdItem.lord) {
            const config = GRAHA_COLOR_CONFIGS[pdItem.lord];
            if (config.aliases.some(alias => sentenceLower.includes(alias))) {
              score += 15;
            }
          }

          // Check direct substring matches from note
          if (pdItem.fullNote && pdItem.fullNote.length > 5 && sentenceLower.includes(pdItem.fullNote)) {
            score += 50;
          }

          // Check word overlap
          for (const word of pdItem.noteWords) {
            if (sentenceLower.includes(word)) {
              score += 10;
            }
          }

          if (score > bestScore && score >= 10) {
            bestScore = score;
            attributedLord = pdItem.lord;
            matchedFeed = pdItem.feed;
          }
        }
      }

      // Clean the sentence text if it has markdown bullet or tag
      let displayText = sentence;
      if (displayText.startsWith('- ')) displayText = displayText.slice(2);
      if (displayText.startsWith('* ')) displayText = displayText.slice(2);

      segments.push({
        id: `seg-${++seq}-${attributedLord || 'none'}`,
        text: displayText,
        attributedLord,
        matchedFeed,
        score: bestScore
      });
    }
  }

  return segments;
}

/**
 * Builds high-density prompt specifically for the MD-AD Level summary
 */
export function buildAdNarrativePrompt(
  mahadashaLord: string,
  antardashaLord: string,
  startDate: string,
  endDate: string,
  observations: PdFeedItem[]
): string {
  const ratedObservations = observations.filter(
    obs => (obs.notes && obs.notes.trim().length > 0) || obs.evaluation_rating !== null
  );

  if (ratedObservations.length === 0) {
    throw new Error('This Antardasha (MD-AD) has no saved PD notes or ratings to summarize yet.');
  }

  const ratingLabels = { 0: 'BAD / DIFFICULT', 5: 'AVERAGE / MIXED', 10: 'GOOD / POSITIVE' };
  const lines: string[] = [];

  for (const obs of ratedObservations) {
    const rating = obs.evaluation_rating;
    const ratingDesc = rating !== null ? ratingLabels[rating] : 'NOT RATED';
    const note = (obs.notes || '').trim() || 'No landmark note recorded.';
    lines.push(
      `- ${obs.start_date} to ${obs.end_date} | PD: ${obs.pratyantardasha_lord} | Rating: ${rating ?? 'none'} (${ratingDesc}) | Note: ${note}`
    );
  }

  return [
    `Task: Synthesize a concise chronological personal-event narrative for the Antardasha period below, using only the supplied PD observations.`,
    `Mahadasha Lord: ${mahadashaLord}`,
    `Antardasha Lord: ${antardashaLord} (MD-AD Window: ${startDate} to ${endDate})`,
    '',
    `Formatting & Attribution Requirement:`,
    `- Prefix each chronological milestone or sentence with the explicit Pratyantardasha Lord tag, e.g. [PD: ${ratedObservations[0]?.pratyantardasha_lord || 'Lord'}] so the reader can attribute each event to its specific PD sub-period.`,
    `- Keep the summary concise: 3 to 7 lines total.`,
    `- Ground solely on the recorded PD observations; do not invent events, feelings, or predictions.`,
    `- Rating interpretation: 0 = Bad/Difficult, 5 = Average/Mixed, 10 = Good/Positive.`,
    '',
    `PD Feeds for this Antardasha:`,
    ...lines
  ].join('\n');
}
