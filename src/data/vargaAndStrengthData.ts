/**
 * Authoritative 001ME Vedic Enrichment Data Module:
 * - Calibrated Ashtakavarga (7 Planet BAVs, Lagna As BAV, SAV=337, Sodhya Pindas) from ashtakavarga_prompt_44e46021.txt
 * - Shadbala & Vimsopaka/Vaiseshikamsa Strengths from planet_strengths_d93aa027.json
 * - D1 Raja Yogas (2), General Yogas (19), and Pitru Dosha (1) from d1_yogas_doshas_prompt_5018e565.txt
 * - Divisional Varga Charts (D2..D144) from charts_by_house_842490c9.json (D1 & D9 stay in Master Prompt; D2..D144 routed to Domain Sub-Prompts)
 */
import type { OriginalSourceDomain, VedicHouseContext } from '../services/llm/types';

export interface DomainPromptSpec {
  id: OriginalSourceDomain;
  label: string;
  shortLabel: string;
  topicUpper: string;
  overviewTitle: string;
  matrixTitle: string;
  vargaTagLabel: string;
  eventColumnLabel: string;
  breakdownTitle: string;
  cautionTitle: string;
  defaultQuestion: string;
  description: string;
  vargaCharts: string[];
  focusHouses: number[];
  primaryKarakas: string[];
}

export const DOMAIN_PROMPT_SPECS: Record<OriginalSourceDomain, DomainPromptSpec> = {
  master: {
    id: 'master',
    label: 'Master Prompt (All-Domain Base)',
    shortLabel: 'Master',
    topicUpper: 'ALL DOMAINS',
    overviewTitle: 'Holistic Overview',
    matrixTitle: 'Key Event Timeline & Rating Matrix',
    vargaTagLabel: 'D9',
    eventColumnLabel: 'Key Event',
    breakdownTitle: 'Detailed Event Breakdown',
    cautionTitle: 'Specific Dates to Be Very Careful',
    defaultQuestion: 'FULL MONTHLY READING',
    description: 'Complete foundational chart (D1, D9, Shadbala, 7-Planet Ashtakavarga + As + Sodhya Pindas, Yogas & Doshas, Jaimini) + Monthly Ephemeris.',
    vargaCharts: ['D1', 'D9'],
    focusHouses: [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    primaryKarakas: ['Jupiter', 'Venus', 'Saturn', 'Mercury', 'Sun', 'Moon', 'Mars']
  },
  career: {
    id: 'career',
    label: 'Career Prompt (Work & Authority)',
    shortLabel: 'Career',
    topicUpper: 'CAREER & PROFESSION',
    overviewTitle: 'Career & Profession Overview',
    matrixTitle: 'Career Event Timeline & Rating Matrix',
    vargaTagLabel: 'D10',
    eventColumnLabel: 'Career Event',
    breakdownTitle: 'Detailed Career Event Breakdown',
    cautionTitle: 'Specific Career Dates to Be Very Careful',
    defaultQuestion: 'FULL CAREER READING',
    description: 'Master Prompt + Career Sub-Prompt attaching D10 (Dasamsa), Output Structure + Readout, and optional Focus Question.',
    vargaCharts: ['D10'],
    focusHouses: [10, 6, 11, 2, 9, 1],
    primaryKarakas: ['Mercury', 'Sun', 'Saturn', 'Mars', 'Jupiter']
  },
  finance: {
    id: 'finance',
    label: 'Finance Prompt (Wealth & Assets)',
    shortLabel: 'Finance',
    topicUpper: 'FINANCE & WEALTH',
    overviewTitle: 'Finance & Wealth Overview',
    matrixTitle: 'Financial Event Timeline & Rating Matrix',
    vargaTagLabel: 'D2/D4/D11',
    eventColumnLabel: 'Financial Event',
    breakdownTitle: 'Detailed Financial Event Breakdown',
    cautionTitle: 'Specific Financial Dates to Be Very Careful',
    defaultQuestion: 'FULL FINANCE READING',
    description: 'Master Prompt + Finance Sub-Prompt attaching D2 (Hora), D11 (Ekadasamsa), D4 (Chaturthamsa), Output Structure + Readout, and optional Focus Question.',
    vargaCharts: ['D2', 'D11', 'D4'],
    focusHouses: [2, 11, 5, 9, 4, 8],
    primaryKarakas: ['Jupiter', 'Venus', 'Mercury', 'Saturn', 'Mars']
  },
  love: {
    id: 'love',
    label: 'Love Prompt (Romance & Marriage)',
    shortLabel: 'Love',
    topicUpper: 'LOVE & RELATIONSHIPS',
    overviewTitle: 'Love & Relationship Overview',
    matrixTitle: 'Relationship Event Timeline & Rating Matrix',
    vargaTagLabel: 'D9/D7/D30',
    eventColumnLabel: 'Relationship Event',
    breakdownTitle: 'Detailed Relationship Event Breakdown',
    cautionTitle: 'Specific Relationship Dates to Be Very Careful',
    defaultQuestion: 'FULL RELATIONSHIP READING',
    description: 'Master Prompt (incl. D9 Navamsa) + Love Sub-Prompt attaching D7 (Saptamsa) & D30 (Trimsamsa), Output Structure + Readout, and optional Focus Question.',
    vargaCharts: ['D7', 'D30'],
    focusHouses: [5, 7, 12, 11, 1],
    primaryKarakas: ['Venus', 'Jupiter', 'Mercury', 'Moon']
  },
  family: {
    id: 'family',
    label: 'Family Prompt (Home, Lineage & Parents)',
    shortLabel: 'Family',
    topicUpper: 'FAMILY, HOME & LINEAGE',
    overviewTitle: 'Family & Home Overview',
    matrixTitle: 'Family Event Timeline & Rating Matrix',
    vargaTagLabel: 'D4/D7/D12/D16',
    eventColumnLabel: 'Family Event',
    breakdownTitle: 'Detailed Family Event Breakdown',
    cautionTitle: 'Specific Family Dates to Be Very Careful',
    defaultQuestion: 'FULL FAMILY READING',
    description: 'Master Prompt + Family Sub-Prompt attaching D4, D12, D7, D16, Pitru Dosha alert, Output Structure + Readout, and optional Focus Question.',
    vargaCharts: ['D4', 'D12', 'D7', 'D16'],
    focusHouses: [4, 2, 5, 9, 3],
    primaryKarakas: ['Moon', 'Jupiter', 'Sun', 'Venus', 'Mars']
  },
  health: {
    id: 'health',
    label: 'Health Prompt (Vitality, Illness & Recovery)',
    shortLabel: 'Health',
    topicUpper: 'HEALTH & VITALITY',
    overviewTitle: 'Health & Vitality Overview',
    matrixTitle: 'Health Event Timeline & Rating Matrix',
    vargaTagLabel: 'D6/D8/D27/D30',
    eventColumnLabel: 'Health Event',
    breakdownTitle: 'Detailed Health Event Breakdown',
    cautionTitle: 'Specific Health Dates to Be Very Careful',
    defaultQuestion: 'FULL HEALTH READING',
    description: 'Master Prompt + Health Sub-Prompt attaching D6 (Shashtamsa), D8 (Ashtamsa), D27 (Bhamsa), D30 (Trimsamsa), Output Structure + Readout, and optional Focus Question.',
    vargaCharts: ['D6', 'D8', 'D27', 'D30'],
    focusHouses: [1, 6, 8, 12, 4, 2],
    primaryKarakas: ['Saturn', 'Sun', 'Mars', 'Moon', 'Jupiter']
  }
};

export interface ShadbalaEntry {
  planet: string;
  ratio: number;
  total: number;
  required: number;
  percent: number;
  status: 'Strong' | 'Weak';
  sthana: number;
  dig: number;
  kaala: number;
  cheshta: number;
  naisargika: number;
  drik: number;
  harsha: number;
  ishtaPhala: number;
  kashtaPhala: number;
  shadvargaAmsa: string;
  shadvargaVimsopaka: number;
  dashavargaAmsa: string;
  dashavargaVimsopaka: number;
  shodashavargaAmsa: string;
  shodashavargaVimsopaka: number;
  shodashavargaCharts: string[];
}

export const SHADBALA_STRENGTHS_001ME: ShadbalaEntry[] = [
  {
    planet: 'Mars',
    ratio: 1.31,
    total: 392.38,
    required: 300,
    percent: 130.8,
    status: 'Strong',
    sthana: 123.46,
    dig: 21.69,
    kaala: 194.66,
    cheshta: 46.30,
    naisargika: 17.14,
    drik: -10.87,
    harsha: 10.00,
    ishtaPhala: 32.07,
    kashtaPhala: 22.75,
    shadvargaAmsa: 'Vyanjanaamsa',
    shadvargaVimsopaka: 10.3,
    dashavargaAmsa: 'Gopuraamsa',
    dashavargaVimsopaka: 13.4,
    shodashavargaAmsa: 'Keralaamsa',
    shodashavargaVimsopaka: 12.7,
    shodashavargaCharts: ['D3', 'D4', 'D12', 'D30', 'D45', 'D60']
  },
  {
    planet: 'Venus',
    ratio: 1.20,
    total: 394.55,
    required: 330,
    percent: 119.6,
    status: 'Strong',
    sthana: 188.05,
    dig: 26.62,
    kaala: 119.24,
    cheshta: 22.37,
    naisargika: 42.86,
    drik: -4.59,
    harsha: 10.00,
    ishtaPhala: 22.71,
    kashtaPhala: 37.29,
    shadvargaAmsa: 'No Amsa',
    shadvargaVimsopaka: 15.0,
    dashavargaAmsa: 'Paarijaataamsa',
    dashavargaVimsopaka: 13.5,
    shodashavargaAmsa: 'Bhedakaamsa',
    shodashavargaVimsopaka: 15.0,
    shodashavargaCharts: ['D9', 'D16']
  },
  {
    planet: 'Jupiter',
    ratio: 1.17,
    total: 456.93,
    required: 390,
    percent: 117.2,
    status: 'Strong',
    sthana: 217.82,
    dig: 27.19,
    kaala: 173.38,
    cheshta: 26.41,
    naisargika: 34.29,
    drik: -22.16,
    harsha: 10.00,
    ishtaPhala: 26.49,
    kashtaPhala: 33.51,
    shadvargaAmsa: 'Kimsukaamsa',
    shadvargaVimsopaka: 13.9,
    dashavargaAmsa: 'Uttamaamsa',
    dashavargaVimsopaka: 13.4,
    shodashavargaAmsa: 'Kandukaamsa',
    shodashavargaVimsopaka: 13.0,
    shodashavargaCharts: ['D1', 'D4', 'D10', 'D12', 'D20']
  },
  {
    planet: 'Moon',
    ratio: 1.09,
    total: 391.35,
    required: 360,
    percent: 108.7,
    status: 'Strong',
    sthana: 155.22,
    dig: 17.04,
    kaala: 170.40,
    cheshta: 0.00,
    naisargika: 51.43,
    drik: -2.74,
    harsha: 5.00,
    ishtaPhala: 5.61,
    kashtaPhala: 47.53,
    shadvargaAmsa: 'No Amsa',
    shadvargaVimsopaka: 11.6,
    dashavargaAmsa: 'No Amsa',
    dashavargaVimsopaka: 11.3,
    shodashavargaAmsa: 'Nagapurushaamsa',
    shodashavargaVimsopaka: 11.4,
    shodashavargaCharts: ['D2', 'D27', 'D40', 'D45']
  },
  {
    planet: 'Saturn',
    ratio: 1.03,
    total: 309.57,
    required: 300,
    percent: 103.2,
    status: 'Strong',
    sthana: 122.68,
    dig: 53.59,
    kaala: 79.71,
    cheshta: 57.54,
    naisargika: 8.57,
    drik: -12.52,
    harsha: 10.00,
    ishtaPhala: 38.06,
    kashtaPhala: 9.26,
    shadvargaAmsa: 'No Amsa',
    shadvargaVimsopaka: 6.2,
    dashavargaAmsa: 'No Amsa',
    dashavargaVimsopaka: 9.2,
    shodashavargaAmsa: 'No Amsa',
    shodashavargaVimsopaka: 8.1,
    shodashavargaCharts: ['D7']
  },
  {
    planet: 'Mercury',
    ratio: 0.96,
    total: 402.60,
    required: 420,
    percent: 95.9,
    status: 'Weak',
    sthana: 139.47,
    dig: 53.65,
    kaala: 154.69,
    cheshta: 56.57,
    naisargika: 25.71,
    drik: -27.49,
    harsha: 10.00,
    ishtaPhala: 36.24,
    kashtaPhala: 11.23,
    shadvargaAmsa: 'No Amsa',
    shadvargaVimsopaka: 10.8,
    dashavargaAmsa: 'Paarijaataamsa',
    dashavargaVimsopaka: 12.2,
    shodashavargaAmsa: 'Bhedakaamsa',
    shodashavargaVimsopaka: 12.1,
    shodashavargaCharts: ['D16', 'D30']
  },
  {
    planet: 'Sun',
    ratio: 0.78,
    total: 302.68,
    required: 390,
    percent: 77.6,
    status: 'Weak',
    sthana: 129.92,
    dig: 21.56,
    kaala: 117.86,
    cheshta: 0.00,
    naisargika: 60.00,
    drik: -26.66,
    harsha: 0.00,
    ishtaPhala: 18.91,
    kashtaPhala: 37.72,
    shadvargaAmsa: 'No Amsa',
    shadvargaVimsopaka: 8.8,
    dashavargaAmsa: 'No Amsa',
    dashavargaVimsopaka: 11.8,
    shodashavargaAmsa: 'Kusumaamsa',
    shodashavargaVimsopaka: 10.9,
    shodashavargaCharts: ['D4', 'D9', 'D24']
  }
];

// House H1 (Sagittarius, signIdx 9) through H12 (Scorpio, signIdx 8) exact bindus
const CALIBRATED_SAV_BY_HOUSE_001ME = [26, 30, 27, 31, 24, 31, 22, 22, 27, 32, 35, 30];

const CALIBRATED_BAV_BY_HOUSE_001ME: Record<string, number[]> = {
  Sun:     [2, 5, 4, 4, 3, 5, 3, 3, 5, 4, 4, 6], // sum 48
  Moon:    [2, 3, 3, 5, 4, 4, 4, 4, 4, 6, 6, 4], // sum 49
  Mars:    [3, 3, 4, 4, 2, 6, 3, 2, 2, 2, 4, 4], // sum 39
  Mercury: [6, 6, 5, 5, 3, 5, 4, 3, 5, 4, 5, 3], // sum 54
  Jupiter: [5, 5, 3, 5, 5, 6, 5, 2, 4, 7, 5, 4], // sum 56
  Venus:   [5, 5, 4, 6, 4, 2, 2, 5, 4, 4, 6, 5], // sum 52
  Saturn:  [3, 3, 4, 2, 3, 3, 1, 3, 3, 5, 5, 4], // sum 39
  Lagna:   [4, 4, 4, 4, 6, 3, 3, 4, 4, 4, 6, 3]  // sum 49 (excluded from SAV sum)
};

export interface SodhyaPindaEntry {
  planet: string;
  rasiPinda: number;
  grahaPinda: number;
  sodhyaPinda: number;
  pct: number;
}

export const SODHYA_PINDAS_001ME: SodhyaPindaEntry[] = [
  { planet: 'Mars', rasiPinda: 94, grahaPinda: 79, sodhyaPinda: 173, pct: 100 },
  { planet: 'Mercury', rasiPinda: 91, grahaPinda: 69, sodhyaPinda: 160, pct: 92 },
  { planet: 'Jupiter', rasiPinda: 78, grahaPinda: 55, sodhyaPinda: 133, pct: 77 },
  { planet: 'Sun', rasiPinda: 81, grahaPinda: 43, sodhyaPinda: 124, pct: 72 },
  { planet: 'Venus', rasiPinda: 74, grahaPinda: 47, sodhyaPinda: 121, pct: 70 },
  { planet: 'Saturn', rasiPinda: 91, grahaPinda: 15, sodhyaPinda: 106, pct: 61 },
  { planet: 'Moon', rasiPinda: 76, grahaPinda: 18, sodhyaPinda: 94, pct: 54 }
];

const SIGN_NAMES_TAMIL_ENG = [
  'Mesham (Aries)', 'Rishabam (Taurus)', 'Mithunam (Gemini)', 'Katakam (Cancer)',
  'Simham (Leo)', 'Kanni (Virgo)', 'Thulaam (Libra)', 'Vrischigam (Scorpio)',
  'Dhanus (Sagittarius)', 'Makaram (Capricorn)', 'Kumbam (Aquarius)', 'Meenam (Pisces)'
];

function buildCalibratedAshtakavarga001ME() {
  const lagnaIdx = 9;
  const savTotalPoints: Record<number, number> = {};
  const bavByPlanet: Record<string, Record<number, number>> = {};
  const lagnaBav: Record<number, number> = {};

  for (const [pKey, arr] of Object.entries(CALIBRATED_BAV_BY_HOUSE_001ME)) {
    const map: Record<number, number> = {};
    for (let h = 1; h <= 12; h++) {
      const sIdx = ((lagnaIdx + h - 2) % 12) + 1;
      map[sIdx] = arr[h - 1];
    }
    if (pKey === 'Lagna') {
      Object.assign(lagnaBav, map);
    } else {
      bavByPlanet[pKey] = map;
    }
  }

  const allHousesOverview = CALIBRATED_SAV_BY_HOUSE_001ME.map((pts, i) => {
    const hNum = i + 1;
    const sIdx = ((lagnaIdx + hNum - 2) % 12) + 1;
    savTotalPoints[sIdx] = pts;
    return {
      signIndex: sIdx,
      houseNumber: hNum,
      signName: SIGN_NAMES_TAMIL_ENG[sIdx - 1],
      points: pts,
      status: pts >= 28 ? 'Strong (>=28)' : pts >= 25 ? 'Neutral (25-27)' : 'Friction (<25)'
    };
  });

  return {
    savTotalPoints,
    savTotalSum: 337,
    bavByPlanet,
    lagnaBav,
    sodhyaPindas: SODHYA_PINDAS_001ME,
    allHousesOverview
  };
}

export const CALIBRATED_ASHTAKAVARGA_001ME = buildCalibratedAshtakavarga001ME();

export interface YogaDoshaData {
  rajaYogas: Array<{
    name: string;
    participants: string[];
    condition: string;
    domains: OriginalSourceDomain[];
  }>;
  generalYogas: Array<{
    name: string;
    condition: string;
    domains: OriginalSourceDomain[];
  }>;
  doshas: Array<{
    name: string;
    status: string;
    reasons: string[];
    domains: OriginalSourceDomain[];
  }>;
}

export const D1_YOGAS_AND_DOSHAS_001ME: YogaDoshaData = {
  rajaYogas: [
    {
      name: 'Dharma Karmadhipati Raja Yoga',
      participants: ['Sun', 'Mercury'],
      condition: 'L9 Sun (Leo) and L10 Mercury (Virgo) conjoined in L2 Capricorn (attenuated by Mercury natal combustion)',
      domains: ['career', 'finance']
    },
    {
      name: 'Vipareetha Raja Yoga',
      participants: ['Mars', 'Moon'],
      condition: 'L12 Mars in L6 Taurus; L8 Moon in L12 Scorpio (Debilitated with Natal Neecha Bhanga: success after struggle)',
      domains: ['career', 'finance', 'health']
    },
    {
      name: 'Neecha Bhanga Raja Yoga (Moon)',
      participants: ['Moon', 'Venus', 'Mars'],
      condition: 'Natal Moon debilitated in Scorpio (L12/M1); cancelled by exaltation lord Venus in Kendra (L1 Lagna), dispositor Mars in Kendra (M7 from Moon / L6 Taurus), and L1 Jupiter 9th aspect',
      domains: ['career', 'finance', 'love', 'family', 'health']
    }
  ],
  generalYogas: [
    { name: 'Vosi Yoga', condition: 'Venus in 12th from Sun (L1 Sagittarius)', domains: ['career', 'finance'] },
    { name: 'Nipuna Yoga', condition: 'Sun+Mercury conjoined in L2 Capricorn (attenuated by Mercury natal combustion)', domains: ['career'] },
    { name: 'Sunaphaa Yoga', condition: 'Venus in 2nd from NB-strengthened Moon (M2 / L1 Sagittarius; self-earned authority)', domains: ['finance', 'career'] },
    { name: 'Hamsa Yoga', condition: 'Jupiter in Own Kendra L4 Pisces (spiritual strength, comforts, speech)', domains: ['career', 'love', 'family', 'health'] },
    { name: 'Daama Yoga', condition: '7 planets occupy 6 distinct signs (wealth, children, generosity)', domains: ['finance', 'family'] },
    { name: 'Subha Yoga', condition: 'Natural benefic Venus occupies L1 Sagittarius', domains: ['love', 'family', 'health'] },
    { name: 'Saraswathi Yoga', condition: 'Mercury (L2), Jupiter (L4 Own), Venus (L1) in Kendra/2nd (learning, prosperity)', domains: ['career', 'finance', 'love'] },
    { name: 'Parijatha Yoga', condition: 'L1 dispositor Jupiter in Own Kendra L4 Pisces (mid/late-life honors)', domains: ['career', 'finance'] },
    { name: 'Sareera Soukhya Yoga', condition: 'L1 Jupiter (L4) and Venus (L1) in Kendras (vitality, comfort)', domains: ['love', 'family', 'health'] },
    { name: 'Swaveeryaddhana Yoga', condition: 'L2 Saturn (L8 Cancer) in 5th trine from L1 Jupiter (L4 Pisces)', domains: ['finance'] },
    { name: 'Matrumooladdhana Yoga', condition: 'L4 Jupiter (L4 Pisces) casts 5th aspect onto L2 Saturn (L8 Cancer)', domains: ['finance', 'family'] },
    { name: 'Bandhu Pujya Yoga', condition: 'L4 Pisces occupied by Own-sign Jupiter (respect from relatives/family)', domains: ['family'] },
    { name: 'Nishkapata Yoga', condition: 'L4 Pisces occupied by benefic Jupiter in Own sign (pure-hearted domestic base)', domains: ['family', 'love'] },
    { name: 'Maathru Sneha Yoga', condition: 'L1 Sagittarius & L4 Pisces both ruled by Jupiter (cordial maternal bond)', domains: ['family'] },
    { name: 'Vaahana Yoga', condition: 'L1 Jupiter in L4 Pisces (material comforts & conveyances)', domains: ['family', 'finance'] }
  ],
  doshas: [
    {
      name: 'Pitru Dosha',
      status: 'Present',
      reasons: [
        'Sun (Pitri Karaka & L9 in L2 Capricorn) aspected by Saturn (7th from L8 Cancer); L9 Leo aspected by Mars (4th from L6 Taurus) and Ketu (5th from L5 Aries)',
        'Indicates ancestral lineage obligations & potential friction with father/paternal continuity'
      ],
      domains: ['family', 'career']
    }
  ]
};

export interface VargaChartDef {
  code: string;
  name: string;
  lagnaSign: string;
  lagnaDeg: string;
  houses: Array<{
    house: number;
    sign: string;
    planets: string[];
  }>;
}

export const VARGA_CHARTS_001ME: Record<string, VargaChartDef> = {
  D2: {
    code: 'D2',
    name: 'Hora',
    lagnaSign: 'Virgo',
    lagnaDeg: "2°35'",
    houses: [
      { house: 1, sign: 'Virgo', planets: [] },
      { house: 2, sign: 'Libra', planets: [] },
      { house: 3, sign: 'Scorpio', planets: ["Sun 6°46'", "Mercury 19°17'", "Saturn 18°56'"] },
      { house: 4, sign: 'Sagittarius', planets: [] },
      { house: 5, sign: 'Capricorn', planets: [] },
      { house: 6, sign: 'Aquarius', planets: ["Jupiter 10°33'"] },
      { house: 7, sign: 'Pisces', planets: [] },
      { house: 8, sign: 'Aries', planets: [] },
      { house: 9, sign: 'Taurus', planets: ["Rahu 18°50'", "Ketu 18°50'"] },
      { house: 10, sign: 'Gemini', planets: ["Mars 17°16'"] },
      { house: 11, sign: 'Cancer', planets: ["Moon 15°10'"] },
      { house: 12, sign: 'Leo', planets: ["Venus 12°17'"] }
    ]
  },
  D3: {
    code: 'D3',
    name: 'Drekkana',
    lagnaSign: 'Aries',
    lagnaDeg: "18°52'",
    houses: [
      { house: 1, sign: 'Aries', planets: [] },
      { house: 2, sign: 'Taurus', planets: ["Sun 4°49'"] },
      { house: 3, sign: 'Gemini', planets: ["Rahu 13°15'"] },
      { house: 4, sign: 'Cancer', planets: ["Saturn 16°35'"] },
      { house: 5, sign: 'Leo', planets: [] },
      { house: 6, sign: 'Virgo', planets: [] },
      { house: 7, sign: 'Libra', planets: [] },
      { house: 8, sign: 'Scorpio', planets: ["Moon 22°13'", "Jupiter 14°10'"] },
      { house: 9, sign: 'Sagittarius', planets: ["Venus 18°25'", "Ketu 13°15'"] },
      { house: 10, sign: 'Capricorn', planets: ["Mars 4°05'", "Mercury 16°03'"] },
      { house: 11, sign: 'Aquarius', planets: [] },
      { house: 12, sign: 'Pisces', planets: [] }
    ]
  },
  D4: {
    code: 'D4',
    name: 'Chaturthamsa',
    lagnaSign: 'Gemini',
    lagnaDeg: "5°10'",
    houses: [
      { house: 1, sign: 'Gemini', planets: [] },
      { house: 2, sign: 'Cancer', planets: ["Saturn 22°07'", "Rahu 7°40'"] },
      { house: 3, sign: 'Leo', planets: [] },
      { house: 4, sign: 'Virgo', planets: [] },
      { house: 5, sign: 'Libra', planets: [] },
      { house: 6, sign: 'Scorpio', planets: ["Moon 29°38'", "Mars 25°27'"] },
      { house: 7, sign: 'Sagittarius', planets: ["Jupiter 8°53'", "Venus 24°34'"] },
      { house: 8, sign: 'Capricorn', planets: ["Mercury 21°24'", "Ketu 7°40'"] },
      { house: 9, sign: 'Aquarius', planets: [] },
      { house: 10, sign: 'Pisces', planets: [] },
      { house: 11, sign: 'Aries', planets: ["Sun 16°26'"] },
      { house: 12, sign: 'Taurus', planets: [] }
    ]
  },
  D5: {
    code: 'D5',
    name: 'Panchamsa',
    lagnaSign: 'Sagittarius',
    lagnaDeg: "21°28'",
    houses: [
      { house: 1, sign: 'Sagittarius', planets: [] },
      { house: 2, sign: 'Capricorn', planets: ["Mars 16°49'"] },
      { house: 3, sign: 'Aquarius', planets: ["Venus 0°43'"] },
      { house: 4, sign: 'Pisces', planets: [] },
      { house: 5, sign: 'Aries', planets: [] },
      { house: 6, sign: 'Taurus', planets: ["Mercury 26°45'", "Saturn 27°39'"] },
      { house: 7, sign: 'Gemini', planets: [] },
      { house: 8, sign: 'Cancer', planets: [] },
      { house: 9, sign: 'Leo', planets: [] },
      { house: 10, sign: 'Virgo', planets: ["Sun 28°03'", "Moon 7°02'"] },
      { house: 11, sign: 'Libra', planets: ["Rahu 2°05'", "Ketu 2°05'"] },
      { house: 12, sign: 'Scorpio', planets: ["Jupiter 3°37'"] }
    ]
  },
  D6: {
    code: 'D6',
    name: 'Shashtamsa',
    lagnaSign: 'Cancer',
    lagnaDeg: "7°45'",
    houses: [
      { house: 1, sign: 'Cancer', planets: [] },
      { house: 2, sign: 'Leo', planets: ["Rahu 26°30'", "Ketu 26°30'"] },
      { house: 3, sign: 'Virgo', planets: [] },
      { house: 4, sign: 'Libra', planets: [] },
      { house: 5, sign: 'Scorpio', planets: ["Moon 14°27'", "Mercury 2°06'", "Saturn 3°11'"] },
      { house: 6, sign: 'Sagittarius', planets: ["Sun 9°39'"] },
      { house: 7, sign: 'Capricorn', planets: [] },
      { house: 8, sign: 'Aquarius', planets: ["Mars 8°11'", "Jupiter 28°20'"] },
      { house: 9, sign: 'Pisces', planets: [] },
      { house: 10, sign: 'Aries', planets: [] },
      { house: 11, sign: 'Taurus', planets: ["Venus 6°51'"] },
      { house: 12, sign: 'Gemini', planets: [] }
    ]
  },
  D7: {
    code: 'D7',
    name: 'Saptamsa',
    lagnaSign: 'Pisces',
    lagnaDeg: "24°03'",
    houses: [
      { house: 1, sign: 'Pisces', planets: ["Mars 29°33'", "Rahu 20°55'"] },
      { house: 2, sign: 'Aries', planets: [] },
      { house: 3, sign: 'Taurus', planets: [] },
      { house: 4, sign: 'Gemini', planets: ["Moon 21°52'"] },
      { house: 5, sign: 'Cancer', planets: [] },
      { house: 6, sign: 'Leo', planets: ["Mercury 7°28'"] },
      { house: 7, sign: 'Virgo', planets: ["Sun 21°16'", "Ketu 20°55'"] },
      { house: 8, sign: 'Libra', planets: [] },
      { house: 9, sign: 'Scorpio', planets: [] },
      { house: 10, sign: 'Sagittarius', planets: [] },
      { house: 11, sign: 'Capricorn', planets: ["Venus 13°00'"] },
      { house: 12, sign: 'Aquarius', planets: ["Jupiter 23°03'", "Saturn 8°43'"] }
    ]
  },
  D8: {
    code: 'D8',
    name: 'Ashtamsa',
    lagnaSign: 'Sagittarius',
    lagnaDeg: "10°21'",
    houses: [
      { house: 1, sign: 'Sagittarius', planets: [] },
      { house: 2, sign: 'Capricorn', planets: ["Moon 29°16'"] },
      { house: 3, sign: 'Aquarius', planets: ["Jupiter 17°47'"] },
      { house: 4, sign: 'Pisces', planets: [] },
      { house: 5, sign: 'Aries', planets: [] },
      { house: 6, sign: 'Taurus', planets: ["Mars 20°55'", "Mercury 12°49'", "Saturn 14°15'"] },
      { house: 7, sign: 'Gemini', planets: [] },
      { house: 8, sign: 'Cancer', planets: ["Sun 2°53'"] },
      { house: 9, sign: 'Leo', planets: [] },
      { house: 10, sign: 'Virgo', planets: ["Venus 19°08'"] },
      { house: 11, sign: 'Libra', planets: ["Rahu 15°20'", "Ketu 15°20'"] },
      { house: 12, sign: 'Scorpio', planets: [] }
    ]
  },
  D10: {
    code: 'D10',
    name: 'Dasamsa',
    lagnaSign: 'Taurus',
    lagnaDeg: "12°56'",
    houses: [
      { house: 1, sign: 'Taurus', planets: [] },
      { house: 2, sign: 'Gemini', planets: ["Rahu 4°10'"] },
      { house: 3, sign: 'Cancer', planets: ["Jupiter 7°14'"] },
      { house: 4, sign: 'Leo', planets: ["Mars 3°39'"] },
      { house: 5, sign: 'Virgo', planets: ["Moon 14°05'"] },
      { house: 6, sign: 'Libra', planets: ["Mercury 23°31'"] },
      { house: 7, sign: 'Scorpio', planets: [] },
      { house: 8, sign: 'Sagittarius', planets: ["Sun 26°06'", "Ketu 4°10'"] },
      { house: 9, sign: 'Capricorn', planets: [] },
      { house: 10, sign: 'Aquarius', planets: ["Venus 1°26'"] },
      { house: 11, sign: 'Pisces', planets: [] },
      { house: 12, sign: 'Aries', planets: ["Saturn 25°18'"] }
    ]
  },
  D11: {
    code: 'D11',
    name: 'Ekadasamsa',
    lagnaSign: 'Capricorn',
    lagnaDeg: "29°13'",
    houses: [
      { house: 1, sign: 'Capricorn', planets: [] },
      { house: 2, sign: 'Aquarius', planets: ["Jupiter 1°57'"] },
      { house: 3, sign: 'Pisces', planets: ["Saturn 0°50'"] },
      { house: 4, sign: 'Aries', planets: [] },
      { house: 5, sign: 'Taurus', planets: [] },
      { house: 6, sign: 'Gemini', planets: ["Rahu 28°36'"] },
      { house: 7, sign: 'Cancer', planets: [] },
      { house: 8, sign: 'Leo', planets: ["Mercury 28°52'"] },
      { house: 9, sign: 'Virgo', planets: [] },
      { house: 10, sign: 'Libra', planets: ["Mars 25°01'", "Venus 7°34'"] },
      { house: 11, sign: 'Scorpio', planets: ["Sun 7°43'", "Moon 21°30'"] },
      { house: 12, sign: 'Sagittarius', planets: ["Ketu 28°36'"] }
    ]
  },
  D12: {
    code: 'D12',
    name: 'Dwadasamsa',
    lagnaSign: 'Gemini',
    lagnaDeg: "15°31'",
    houses: [
      { house: 1, sign: 'Gemini', planets: [] },
      { house: 2, sign: 'Cancer', planets: ["Rahu 23°01'"] },
      { house: 3, sign: 'Leo', planets: [] },
      { house: 4, sign: 'Virgo', planets: ["Saturn 6°22'"] },
      { house: 5, sign: 'Libra', planets: [] },
      { house: 6, sign: 'Scorpio', planets: [] },
      { house: 7, sign: 'Sagittarius', planets: ["Jupiter 26°41'"] },
      { house: 8, sign: 'Capricorn', planets: ["Moon 28°55'", "Mars 16°23'", "Ketu 23°01'"] },
      { house: 9, sign: 'Aquarius', planets: ["Venus 13°43'"] },
      { house: 10, sign: 'Pisces', planets: ["Mercury 4°13'"] },
      { house: 11, sign: 'Aries', planets: [] },
      { house: 12, sign: 'Taurus', planets: ["Sun 19°19'"] }
    ]
  },
  D16: {
    code: 'D16',
    name: 'Shodasamsa',
    lagnaSign: 'Leo',
    lagnaDeg: "20°42'",
    houses: [
      { house: 1, sign: 'Leo', planets: [] },
      { house: 2, sign: 'Virgo', planets: [] },
      { house: 3, sign: 'Libra', planets: ["Sun 5°46'"] },
      { house: 4, sign: 'Scorpio', planets: ["Moon 28°33'"] },
      { house: 5, sign: 'Sagittarius', planets: [] },
      { house: 6, sign: 'Capricorn', planets: ["Jupiter 5°34'"] },
      { house: 7, sign: 'Aquarius', planets: [] },
      { house: 8, sign: 'Pisces', planets: ["Venus 8°17'"] },
      { house: 9, sign: 'Aries', planets: [] },
      { house: 10, sign: 'Taurus', planets: ["Rahu 0°41'", "Ketu 0°41'"] },
      { house: 11, sign: 'Gemini', planets: ["Mercury 25°38'", "Saturn 28°30'"] },
      { house: 12, sign: 'Cancer', planets: ["Mars 11°50'"] }
    ]
  },
  D20: {
    code: 'D20',
    name: 'Vimsamsa',
    lagnaSign: 'Gemini',
    lagnaDeg: "25°52'",
    houses: [
      { house: 1, sign: 'Gemini', planets: [] },
      { house: 2, sign: 'Cancer', planets: ["Mercury 17°03'", "Saturn 20°37'"] },
      { house: 3, sign: 'Leo', planets: ["Rahu 8°21'", "Ketu 8°21'"] },
      { house: 4, sign: 'Virgo', planets: [] },
      { house: 5, sign: 'Libra', planets: [] },
      { house: 6, sign: 'Scorpio', planets: ["Sun 22°13'"] },
      { house: 7, sign: 'Sagittarius', planets: ["Jupiter 14°28'", "Venus 2°52'"] },
      { house: 8, sign: 'Capricorn', planets: [] },
      { house: 9, sign: 'Aquarius', planets: ["Mars 7°18'"] },
      { house: 10, sign: 'Pisces', planets: [] },
      { house: 11, sign: 'Aries', planets: ["Moon 28°11'"] },
      { house: 12, sign: 'Taurus', planets: [] }
    ]
  },
  D24: {
    code: 'D24',
    name: 'Siddhamsa',
    lagnaSign: 'Virgo',
    lagnaDeg: "1°03'",
    houses: [
      { house: 1, sign: 'Virgo', planets: [] },
      { house: 2, sign: 'Libra', planets: [] },
      { house: 3, sign: 'Scorpio', planets: ["Mercury 8°27'", "Saturn 12°45'"] },
      { house: 4, sign: 'Sagittarius', planets: ["Moon 27°50'", "Mars 2°46'", "Venus 27°26'"] },
      { house: 5, sign: 'Capricorn', planets: [] },
      { house: 6, sign: 'Aquarius', planets: ["Jupiter 23°22'"] },
      { house: 7, sign: 'Pisces', planets: ["Rahu 16°02'", "Ketu 16°02'"] },
      { house: 8, sign: 'Aries', planets: ["Sun 8°39'"] },
      { house: 9, sign: 'Taurus', planets: [] },
      { house: 10, sign: 'Gemini', planets: [] },
      { house: 11, sign: 'Cancer', planets: [] },
      { house: 12, sign: 'Leo', planets: [] }
    ]
  },
  D27: {
    code: 'D27',
    name: 'Bhamsa',
    lagnaSign: 'Gemini',
    lagnaDeg: "19°56'",
    houses: [
      { house: 1, sign: 'Gemini', planets: [] },
      { house: 2, sign: 'Cancer', planets: ["Moon 20°04'", "Rahu 29°17'"] },
      { house: 3, sign: 'Leo', planets: [] },
      { house: 4, sign: 'Virgo', planets: ["Venus 15°52'"] },
      { house: 5, sign: 'Libra', planets: [] },
      { house: 6, sign: 'Scorpio', planets: ["Mercury 24°31'", "Jupiter 7°32'"] },
      { house: 7, sign: 'Sagittarius', planets: [] },
      { house: 8, sign: 'Capricorn', planets: ["Ketu 29°17'"] },
      { house: 9, sign: 'Aquarius', planets: ["Mars 6°52'"] },
      { house: 10, sign: 'Pisces', planets: [] },
      { house: 11, sign: 'Aries', planets: [] },
      { house: 12, sign: 'Taurus', planets: ["Sun 13°29'", "Saturn 29°21'"] }
    ]
  },
  D30: {
    code: 'D30',
    name: 'Trimsamsa',
    lagnaSign: 'Sagittarius',
    lagnaDeg: "8°49'",
    houses: [
      { house: 1, sign: 'Sagittarius', planets: [] },
      { house: 2, sign: 'Capricorn', planets: ["Mars 10°58'", "Jupiter 21°42'"] },
      { house: 3, sign: 'Aquarius', planets: ["Venus 4°18'"] },
      { house: 4, sign: 'Pisces', planets: [] },
      { house: 5, sign: 'Aries', planets: [] },
      { house: 6, sign: 'Taurus', planets: [] },
      { house: 7, sign: 'Gemini', planets: ["Rahu 12°32'", "Ketu 12°32'"] },
      { house: 8, sign: 'Cancer', planets: [] },
      { house: 9, sign: 'Leo', planets: [] },
      { house: 10, sign: 'Virgo', planets: ["Sun 18°19'", "Moon 12°17'", "Mercury 10°34'", "Saturn 15°56'"] },
      { house: 11, sign: 'Libra', planets: [] },
      { house: 12, sign: 'Scorpio', planets: [] }
    ]
  },
  D40: {
    code: 'D40',
    name: 'Khavedamsa',
    lagnaSign: 'Capricorn',
    lagnaDeg: "21°45'",
    houses: [
      { house: 1, sign: 'Capricorn', planets: ["Sun 14°26'"] },
      { house: 2, sign: 'Aquarius', planets: ["Mars 14°37'"] },
      { house: 3, sign: 'Pisces', planets: [] },
      { house: 4, sign: 'Aries', planets: [] },
      { house: 5, sign: 'Taurus', planets: ["Mercury 4°06'", "Saturn 11°15'"] },
      { house: 6, sign: 'Gemini', planets: ["Jupiter 28°56'"] },
      { house: 7, sign: 'Cancer', planets: ["Moon 26°23'"] },
      { house: 8, sign: 'Leo', planets: [] },
      { house: 9, sign: 'Virgo', planets: [] },
      { house: 10, sign: 'Libra', planets: [] },
      { house: 11, sign: 'Scorpio', planets: [] },
      { house: 12, sign: 'Sagittarius', planets: ["Venus 5°44'", "Rahu 16°43'", "Ketu 16°43'"] }
    ]
  },
  D45: {
    code: 'D45',
    name: 'Akshavedamsa',
    lagnaSign: 'Sagittarius',
    lagnaDeg: "13°13'",
    houses: [
      { house: 1, sign: 'Sagittarius', planets: ["Mercury 0°52'", "Saturn 8°55'"] },
      { house: 2, sign: 'Capricorn', planets: ["Jupiter 2°34'"] },
      { house: 3, sign: 'Aquarius', planets: [] },
      { house: 4, sign: 'Pisces', planets: [] },
      { house: 5, sign: 'Aries', planets: ["Mars 1°27'", "Rahu 18°49'", "Ketu 18°49'"] },
      { house: 6, sign: 'Taurus', planets: [] },
      { house: 7, sign: 'Gemini', planets: [] },
      { house: 8, sign: 'Cancer', planets: ["Moon 3°26'"] },
      { house: 9, sign: 'Leo', planets: [] },
      { house: 10, sign: 'Virgo', planets: ["Sun 12°29'", "Venus 6°28'"] },
      { house: 11, sign: 'Libra', planets: [] },
      { house: 12, sign: 'Scorpio', planets: [] }
    ]
  },
  D60: {
    code: 'D60',
    name: 'Shashtiamsa',
    lagnaSign: 'Leo',
    lagnaDeg: "17°38'",
    houses: [
      { house: 1, sign: 'Leo', planets: [] },
      { house: 2, sign: 'Virgo', planets: [] },
      { house: 3, sign: 'Libra', planets: ["Rahu 25°05'"] },
      { house: 4, sign: 'Scorpio', planets: ["Mars 21°56'", "Mercury 21°09'"] },
      { house: 5, sign: 'Sagittarius', planets: ["Sun 6°39'", "Venus 8°37'"] },
      { house: 6, sign: 'Capricorn', planets: ["Moon 24°35'"] },
      { house: 7, sign: 'Aquarius', planets: [] },
      { house: 8, sign: 'Pisces', planets: [] },
      { house: 9, sign: 'Aries', planets: ["Jupiter 13°25'", "Ketu 25°05'"] },
      { house: 10, sign: 'Taurus', planets: [] },
      { house: 11, sign: 'Gemini', planets: ["Saturn 1°53'"] },
      { house: 12, sign: 'Cancer', planets: [] }
    ]
  },
  D81: {
    code: 'D81',
    name: 'Navamsa-Navamsa',
    lagnaSign: 'Scorpio',
    lagnaDeg: "29°48'",
    houses: [
      { house: 1, sign: 'Scorpio', planets: [] },
      { house: 2, sign: 'Sagittarius', planets: [] },
      { house: 3, sign: 'Capricorn', planets: ["Jupiter 22°37'"] },
      { house: 4, sign: 'Aquarius', planets: [] },
      { house: 5, sign: 'Pisces', planets: ["Moon 0°12'", "Mercury 13°33'", "Rahu 27°52'"] },
      { house: 6, sign: 'Aries', planets: [] },
      { house: 7, sign: 'Taurus', planets: [] },
      { house: 8, sign: 'Gemini', planets: [] },
      { house: 9, sign: 'Cancer', planets: [] },
      { house: 10, sign: 'Leo', planets: ["Sun 10°28'", "Venus 17°38'"] },
      { house: 11, sign: 'Virgo', planets: ["Saturn 28°03'", "Ketu 27°52'"] },
      { house: 12, sign: 'Libra', planets: ["Mars 20°36'"] }
    ]
  },
  D108: {
    code: 'D108',
    name: 'Ashtottaramsa',
    lagnaSign: 'Gemini',
    lagnaDeg: "19°44'",
    houses: [
      { house: 1, sign: 'Gemini', planets: [] },
      { house: 2, sign: 'Cancer', planets: ["Jupiter 0°09'"] },
      { house: 3, sign: 'Leo', planets: ["Rahu 27°10'"] },
      { house: 4, sign: 'Virgo', planets: ["Sun 23°58'", "Mercury 8°04'"] },
      { house: 5, sign: 'Libra', planets: [] },
      { house: 6, sign: 'Scorpio', planets: ["Moon 20°16'", "Mars 27°29'"] },
      { house: 7, sign: 'Sagittarius', planets: [] },
      { house: 8, sign: 'Capricorn', planets: [] },
      { house: 9, sign: 'Aquarius', planets: ["Ketu 27°10'"] },
      { house: 10, sign: 'Pisces', planets: ["Venus 3°31'", "Saturn 27°24'"] },
      { house: 11, sign: 'Aries', planets: [] },
      { house: 12, sign: 'Taurus', planets: [] }
    ]
  },
  D144: {
    code: 'D144',
    name: 'Dwadasamsa-Dwadasamsa',
    lagnaSign: 'Sagittarius',
    lagnaDeg: "6°19'",
    houses: [
      { house: 1, sign: 'Sagittarius', planets: ["Sun 21°57'", "Moon 17°01'"] },
      { house: 2, sign: 'Capricorn', planets: [] },
      { house: 3, sign: 'Aquarius', planets: [] },
      { house: 4, sign: 'Pisces', planets: [] },
      { house: 5, sign: 'Aries', planets: ["Mercury 20°46'", "Rahu 6°14'"] },
      { house: 6, sign: 'Taurus', planets: [] },
      { house: 7, sign: 'Gemini', planets: [] },
      { house: 8, sign: 'Cancer', planets: ["Mars 16°38'", "Venus 14°41'"] },
      { house: 9, sign: 'Leo', planets: [] },
      { house: 10, sign: 'Virgo', planets: [] },
      { house: 11, sign: 'Libra', planets: ["Jupiter 20°12'", "Ketu 6°14'"] },
      { house: 12, sign: 'Scorpio', planets: ["Saturn 16°33'"] }
    ]
  }
};

const SIGN_IDX_EN_LOWER = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'
];

const SIGN_LORD_BY_IDX: Record<number, string> = {
  1: 'Mars', 2: 'Venus', 3: 'Mercury', 4: 'Moon',
  5: 'Sun', 6: 'Mercury', 7: 'Venus', 8: 'Mars',
  9: 'Jupiter', 10: 'Saturn', 11: 'Saturn', 12: 'Jupiter'
};

const EXALT_SIGN_BY_PLANET: Record<string, number> = {
  Sun: 1, Moon: 2, Mars: 10, Mercury: 6, Jupiter: 4, Venus: 12, Saturn: 7
};

const DEBIL_SIGN_BY_PLANET: Record<string, number> = {
  Sun: 7, Moon: 8, Mars: 4, Mercury: 12, Jupiter: 10, Venus: 6, Saturn: 1
};

const OWN_SIGNS_BY_PLANET: Record<string, number[]> = {
  Sun: [5], Moon: [4], Mars: [1, 8], Mercury: [3, 6], Jupiter: [9, 12], Venus: [2, 7], Saturn: [10, 11]
};

function normBodyName(raw?: string): string {
  const s = (raw || '').toLowerCase();
  if (s.includes('lagna')) return 'Lagna';
  if (s.includes('sun') || s.includes('surya')) return 'Sun';
  if (s.includes('moon') || s.includes('chandra')) return 'Moon';
  if (s.includes('mars') || s.includes('sevvai')) return 'Mars';
  if (s.includes('mercury') || s.includes('budha')) return 'Mercury';
  if (s.includes('jupiter') || s.includes('guru')) return 'Jupiter';
  if (s.includes('venus') || s.includes('sukra')) return 'Venus';
  if (s.includes('saturn') || s.includes('sani')) return 'Saturn';
  if (s.includes('rahu')) return 'Rahu';
  if (s.includes('ketu')) return 'Ketu';
  if (s.includes('mandi') || s.includes('gulika')) return 'Mandi';
  return raw || '';
}

function normSignIdx(raw?: string): number {
  const s = (raw || '').toLowerCase();
  for (let i = 0; i < SIGN_IDX_EN_LOWER.length; i++) {
    if (s.includes(SIGN_IDX_EN_LOWER[i])) return i + 1;
  }
  const tamil = ['mesham', 'rishab', 'mithun', 'katak', 'simh', 'kanni', 'thul', 'vrisch', 'dhanu', 'makar', 'kumb', 'meen'];
  for (let i = 0; i < tamil.length; i++) {
    if (s.includes(tamil[i])) return i + 1;
  }
  return 0;
}

function getD1AspectTargets(planet: string, fromSignIdx: number): number[] {
  if (!fromSignIdx) return [];
  const offsets = [7];
  if (planet === 'Jupiter' || planet === 'Rahu' || planet === 'Ketu') offsets.push(5, 9);
  else if (planet === 'Saturn') offsets.push(3, 10);
  else if (planet === 'Mars') offsets.push(4, 8);
  return offsets.map(off => ((fromSignIdx - 1 + (off - 1)) % 12) + 1);
}

function isKendraDist(dist: number): boolean {
  return dist === 1 || dist === 4 || dist === 7 || dist === 10;
}

/**
 * Evaluates classical Parashara Neecha Bhanga factors purely from Natal D1 positions.
 */
export function evaluateNatalNeechaBhanga(
  planet: string,
  flattenedD1: Array<{ body_name: string; rashi_name: string; is_retrograde?: boolean }>,
  natalLagnaIdx: number,
  natalMoonIdx: number
): { isDebilitated: boolean; hasNeechaBhanga: boolean; reasons: string[] } {
  const debSign = DEBIL_SIGN_BY_PLANET[planet];
  if (!debSign) return { isDebilitated: false, hasNeechaBhanga: false, reasons: [] };

  const pMap = new Map<string, { signIdx: number; isRetro: boolean }>();
  for (const row of flattenedD1 || []) {
    const b = normBodyName(row.body_name);
    const s = normSignIdx(row.rashi_name);
    if (b && s) pMap.set(b, { signIdx: s, isRetro: !!row.is_retrograde });
  }
  const pInfo = pMap.get(planet);
  if (!pInfo || pInfo.signIdx !== debSign) {
    return { isDebilitated: false, hasNeechaBhanga: false, reasons: [] };
  }

  const reasons: string[] = [];
  const disp = SIGN_LORD_BY_IDX[debSign];
  const dispInfo = pMap.get(disp);
  if (dispInfo) {
    const dL = ((dispInfo.signIdx - natalLagnaIdx + 12) % 12) + 1;
    const dM = ((dispInfo.signIdx - natalMoonIdx + 12) % 12) + 1;
    if (isKendraDist(dL) && isKendraDist(dM)) {
      reasons.push(`disp ${disp} in L${dL}/M${dM} Kendra[L/M]`);
    } else if (isKendraDist(dL)) {
      reasons.push(`disp ${disp} in L${dL} Kendra[Lagna]`);
    } else if (isKendraDist(dM)) {
      reasons.push(`disp ${disp} in M${dM} Kendra[Moon]`);
    }
    if (dispInfo.signIdx === debSign || getD1AspectTargets(disp, dispInfo.signIdx).includes(debSign)) {
      reasons.push(`${disp} touches/aspects own ${SIGN_IDX_EN_LOWER[debSign - 1]}`);
    }
  }

  const exaltSign = EXALT_SIGN_BY_PLANET[planet];
  const exaltSignLord = exaltSign ? SIGN_LORD_BY_IDX[exaltSign] : '';
  const exInfo = exaltSignLord ? pMap.get(exaltSignLord) : undefined;
  if (exInfo) {
    const eL = ((exInfo.signIdx - natalLagnaIdx + 12) % 12) + 1;
    const eM = ((exInfo.signIdx - natalMoonIdx + 12) % 12) + 1;
    if (isKendraDist(eL) && isKendraDist(eM)) {
      reasons.push(`exalt-sign-lord ${exaltSignLord} in L${eL}/M${eM} Kendra[L/M]`);
    } else if (isKendraDist(eL)) {
      reasons.push(`exalt-sign-lord ${exaltSignLord} in L${eL} Kendra[Lagna]`);
    } else if (isKendraDist(eM)) {
      reasons.push(`exalt-sign-lord ${exaltSignLord} in M${eM} Kendra[Moon]`);
    }
  }

  if (pInfo.isRetro) {
    reasons.push(`${planet} Retrograde (Neecha-Vakra)`);
  }

  return {
    isDebilitated: true,
    hasNeechaBhanga: reasons.length > 0,
    reasons
  };
}

/**
 * Deterministically validates every D1 Yoga and Dosha claim against actual D1 signs,
 * houses, conjunctions, and Parashari aspects before allowing prompt emission.
 */
export function validateD1YogasAndDoshasAgainstD1(
  data: YogaDoshaData,
  flattenedD1: Array<{ body_name: string; rashi_name: string; is_retrograde?: boolean }> | undefined,
  natalLagnaIdx: number,
  natalMoonIdx: number
): YogaDoshaData {
  if (!flattenedD1 || flattenedD1.length < 7) return data;

  const pSign = new Map<string, number>();
  for (const row of flattenedD1) {
    const b = normBodyName(row.body_name);
    const s = normSignIdx(row.rashi_name);
    if (b && s) pSign.set(b, s);
  }

  const houseSign = (h: number) => ((natalLagnaIdx + h - 2) % 12) + 1;
  const houseLord = (h: number) => SIGN_LORD_BY_IDX[houseSign(h)];
  const hFrom = (s: number, base: number) => ((s - base + 12) % 12) + 1;
  const doesAspect = (p: string, targetS: number): boolean => {
    const s = pSign.get(p);
    if (!s) return false;
    return s === targetS || getD1AspectTargets(p, s).includes(targetS);
  };

  const verifyYogaByName = (name: string): boolean => {
    const n = name.toLowerCase();
    const sSun = pSign.get('Sun') || 0;
    const sMoon = pSign.get('Moon') || 0;
    const sMars = pSign.get('Mars') || 0;
    const sMerc = pSign.get('Mercury') || 0;
    const sJup = pSign.get('Jupiter') || 0;
    const sVen = pSign.get('Venus') || 0;
    const sSat = pSign.get('Saturn') || 0;

    if (n.includes('dharma karmadhipati')) {
      const l9 = pSign.get(houseLord(9));
      const l10 = pSign.get(houseLord(10));
      return !!l9 && !!l10 && (l9 === l10 || doesAspect(houseLord(9), l10) || doesAspect(houseLord(10), l9));
    }
    if (n.includes('vipareetha')) {
      const dusthanaLords = [6, 8, 12].map(h => ({ p: houseLord(h), s: pSign.get(houseLord(h)) || 0 }));
      return dusthanaLords.some(dl => [6, 8, 12].includes(hFrom(dl.s, natalLagnaIdx)));
    }
    if (n.includes('neecha bhanga') && n.includes('moon')) {
      return evaluateNatalNeechaBhanga('Moon', flattenedD1, natalLagnaIdx, natalMoonIdx).hasNeechaBhanga;
    }
    if (n.includes('vosi')) {
      return [sMoon, sMars, sMerc, sJup, sVen, sSat].some(s => s && s !== sMoon && hFrom(s, sSun) === 12);
    }
    if (n.includes('nipuna')) {
      return !!sSun && !!sMerc && sSun === sMerc;
    }
    if (n.includes('sunaphaa')) {
      return [sMars, sMerc, sJup, sVen, sSat].some(s => s && hFrom(s, sMoon) === 2);
    }
    if (n.includes('hamsa')) {
      return !!sJup && isKendraDist(hFrom(sJup, natalLagnaIdx)) && ([4, 9, 12].includes(sJup));
    }
    if (n.includes('daama')) {
      const distinct = new Set([sSun, sMoon, sMars, sMerc, sJup, sVen, sSat].filter(Boolean));
      return distinct.size === 6;
    }
    if (n.includes('subha')) {
      const l1Occ = [sJup, sVen, sMerc].some(s => s === houseSign(1));
      const l12Occ = [sJup, sVen, sMerc].some(s => s === houseSign(12));
      const l2Occ = [sJup, sVen, sMerc].some(s => s === houseSign(2));
      return l1Occ || (l12Occ && l2Occ);
    }
    if (n.includes('harihara brahma')) {
      const l1Lord = houseLord(1);
      const l1Sign = pSign.get(l1Lord) || 0;
      const benefics = [sJup, sVen, sMerc].filter(Boolean);
      const v1 = [4, 10, 11].every(h => benefics.some(s => hFrom(s, l1Sign) === h));
      const l9S = pSign.get(houseLord(9)) || 0;
      const l10S = pSign.get(houseLord(10)) || 0;
      const l11S = pSign.get(houseLord(11)) || 0;
      const v2 = !!sJup && !!sVen && !!sMerc &&
        isKendraDist(hFrom(sJup, l9S)) &&
        isKendraDist(hFrom(sVen, l11S)) &&
        (isKendraDist(hFrom(sMerc, l1Sign)) || isKendraDist(hFrom(sMerc, l10S)));
      return v1 || v2;
    }
    if (n.includes('bhaagya')) {
      const h9Sign = houseSign(9);
      const cand = ['Jupiter', 'Venus', 'Mercury', 'Moon'];
      return cand.some(p => {
        const s = pSign.get(p) || 0;
        const h = hFrom(s, natalLagnaIdx);
        return (h === 1 || h === 3 || h === 5) && doesAspect(p, h9Sign);
      });
    }
    if (n.includes('saraswathi')) {
      const allowed = new Set([1, 2, 4, 5, 7, 9, 10]);
      const jupOk = [4, 9, 12, 1, 8, 2, 7].includes(sJup); // own/exalt/friend
      return jupOk &&
        allowed.has(hFrom(sMerc, natalLagnaIdx)) &&
        allowed.has(hFrom(sJup, natalLagnaIdx)) &&
        allowed.has(hFrom(sVen, natalLagnaIdx));
    }
    if (n.includes('parijatha')) {
      const l1L = houseLord(1);
      const l1S = pSign.get(l1L) || 0;
      const disp1 = SIGN_LORD_BY_IDX[l1S];
      const d1S = pSign.get(disp1) || 0;
      const disp2 = SIGN_LORD_BY_IDX[d1S];
      const d2S = pSign.get(disp2) || 0;
      const kt = new Set([1, 4, 5, 7, 9, 10]);
      return kt.has(hFrom(d1S, natalLagnaIdx)) && kt.has(hFrom(d2S, natalLagnaIdx));
    }
    if (n.includes('sareera soukhya')) {
      const l1S = pSign.get(houseLord(1)) || 0;
      return isKendraDist(hFrom(l1S, natalLagnaIdx)) || isKendraDist(hFrom(sJup, natalLagnaIdx)) || isKendraDist(hFrom(sVen, natalLagnaIdx));
    }
    if (n.includes('swaveeryaddhana')) {
      const l1S = pSign.get(houseLord(1)) || 0;
      const l2S = pSign.get(houseLord(2)) || 0;
      const dist = hFrom(l2S, l1S);
      return [1, 4, 5, 7, 9, 10].includes(dist);
    }
    if (n.includes('matrumooladdhana')) {
      const l2Lord = houseLord(2);
      const l4Lord = houseLord(4);
      const l2S = pSign.get(l2Lord) || 0;
      const l4S = pSign.get(l4Lord) || 0;
      return l2S === houseSign(4) || l2S === l4S || doesAspect(l4Lord, l2S) || doesAspect(l2Lord, l4S);
    }
    if (n.includes('bandhu pujya')) {
      const h4S = houseSign(4);
      const l4S = pSign.get(houseLord(4)) || 0;
      return doesAspect('Jupiter', h4S) || doesAspect('Jupiter', l4S);
    }
    if (n.includes('nishkapata')) {
      const h4S = houseSign(4);
      return [sJup, sVen, sMerc].some(s => s === h4S);
    }
    if (n.includes('maathru sneha')) {
      return houseLord(1) === houseLord(4);
    }
    if (n.includes('vaahana')) {
      const l1S = pSign.get(houseLord(1)) || 0;
      return [4, 9, 11].includes(hFrom(l1S, natalLagnaIdx));
    }
    return true;
  };

  // Validate Pitru Dosha dynamically so only true malefic afflictor aspects/conjunctions appear
  const verifiedDoshas = data.doshas
    .map(d => {
      if (!d.name.toLowerCase().includes('pitru')) return d;
      const sSun = pSign.get('Sun') || 0;
      const h9S = houseSign(9);
      const l9L = houseLord(9);
      const l9S = pSign.get(l9L) || 0;
      const malefics = ['Saturn', 'Mars', 'Rahu', 'Ketu'];
      const sunHits: string[] = [];
      const h9Hits: string[] = [];
      for (const m of malefics) {
        const ms = pSign.get(m);
        if (!ms) continue;
        if (ms === sSun || getD1AspectTargets(m, ms).includes(sSun)) sunHits.push(m);
        if (ms === h9S || getD1AspectTargets(m, ms).includes(h9S)) h9Hits.push(m);
      }
      if (sunHits.length === 0 && h9Hits.length === 0) return null;
      const sunPart = sunHits.length > 0 ? `Sun (${l9L === 'Sun' ? 'L9 & ' : ''}Pitri Karaka in L${hFrom(sSun, natalLagnaIdx)}) touched by ${sunHits.join(', ')}` : '';
      const h9Part = h9Hits.length > 0 ? `L9 ${SIGN_IDX_EN_LOWER[h9S - 1].replace(/^./, c => c.toUpperCase())} touched by ${h9Hits.join(', ')}` : '';
      const combined = [sunPart, h9Part].filter(Boolean).join('; ');
      return {
        ...d,
        reasons: [combined, ...(l9S !== sSun ? [] : [])]
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return {
    rajaYogas: data.rajaYogas.filter(y => verifyYogaByName(y.name)),
    generalYogas: data.generalYogas.filter(y => verifyYogaByName(y.name)),
    doshas: verifiedDoshas
  };
}

/**
 * Returns classical Varga dignity tag and key domain-house summary without un-reconciled D1 degrees.
 */
export function buildVargaDomainSummary(
  chart: VargaChartDef,
  focusDomainHouses: number[]
): {
  lagnaSign: string;
  planetRows: string[];
  domainSummaryLine: string;
} {
  const lagnaIdx = normSignIdx(chart.lagnaSign) || 1;
  const planetEntries: Array<{ planet: string; sign: string; signIdx: number; house: number; dignity: string }> = [];

  for (const h of chart.houses) {
    const sIdx = normSignIdx(h.sign) || (((lagnaIdx + h.house - 2) % 12) + 1);
    for (const rawP of h.planets) {
      const pName = normBodyName(rawP);
      if (!pName || pName === 'Mandi') continue;
      let dig = '';
      if (pName !== 'Rahu' && pName !== 'Ketu') {
        if (EXALT_SIGN_BY_PLANET[pName] === sIdx) dig = 'Exalted';
        else if (DEBIL_SIGN_BY_PLANET[pName] === sIdx) dig = 'Debilitated';
        else if ((OWN_SIGNS_BY_PLANET[pName] || []).includes(sIdx)) dig = 'Own';
      }
      planetEntries.push({
        planet: pName,
        sign: h.sign,
        signIdx: sIdx,
        house: h.house,
        dignity: dig
      });
    }
  }

  const keyHighlights: string[] = [];
  for (const hNum of focusDomainHouses.slice(0, 3)) {
    const hDef = chart.houses.find(x => x.house === hNum);
    if (!hDef) continue;
    const hSignIdx = normSignIdx(hDef.sign) || (((lagnaIdx + hNum - 2) % 12) + 1);
    const hLord = SIGN_LORD_BY_IDX[hSignIdx];
    const lordRow = planetEntries.find(p => p.planet === hLord);
    const occNames = hDef.planets.map(normBodyName).filter(Boolean);
    const occStr = occNames.length > 0 ? ` occ:${occNames.join(',')}` : '';
    const lordStr = lordRow
      ? `lord ${hLord}@H${lordRow.house} ${lordRow.sign}${lordRow.dignity ? `(${lordRow.dignity})` : ''}`
      : `lord ${hLord}`;
    keyHighlights.push(`H${hNum} ${hDef.sign}(${lordStr}${occStr})`);
  }

  const planetRows = chart.houses.map(h => {
    const pList = h.planets
      .map(raw => {
        const pn = normBodyName(raw);
        if (!pn) return '';
        const pe = planetEntries.find(x => x.planet === pn && x.house === h.house);
        return pe?.dignity ? `${pn}(${pe.dignity})` : pn;
      })
      .filter(Boolean);
    return `H${h.house} ${h.sign}: ${pList.length > 0 ? pList.join(', ') : '-'}`;
  });

  return {
    lagnaSign: chart.lagnaSign,
    planetRows,
    domainSummaryLine: `Lagna: ${chart.lagnaSign} | Key Houses: ${keyHighlights.join(' | ')}`
  };
}

export function isChartSignature001ME(
  natalLagnaIdx: number,
  natalMoonIdx: number,
  flattenedD1?: Array<{ body_name: string; rashi_name: string }>
): boolean {
  if (natalLagnaIdx !== 9 || natalMoonIdx !== 8) return false;
  if (!flattenedD1 || flattenedD1.length < 7) return true;
  const check = (body: string, expectedSign: string): boolean => {
    const row = flattenedD1.find(r => r.body_name.toLowerCase().includes(body));
    return row ? row.rashi_name.toLowerCase().includes(expectedSign) : false;
  };
  return (
    check('sun', 'capricorn') &&
    check('moon', 'scorpio') &&
    check('mars', 'taurus') &&
    check('mercury', 'capricorn') &&
    check('jupiter', 'pisces') &&
    check('venus', 'sagittarius') &&
    check('saturn', 'cancer')
  );
}

export function apply001MEEnrichments(
  context: VedicHouseContext,
  natalLagnaIdx: number,
  natalMoonIdx: number
): VedicHouseContext {
  const is001 = (context.personId === '001ME' || !context.personId)
    && isChartSignature001ME(natalLagnaIdx, natalMoonIdx, context.flattenedNatalD1);
  if (!is001) {
    return {
      ...context,
      yogasAndDoshas: context.yogasAndDoshas
        ? validateD1YogasAndDoshasAgainstD1(context.yogasAndDoshas, context.flattenedNatalD1, natalLagnaIdx, natalMoonIdx)
        : context.yogasAndDoshas
    };
  }

  const verifiedYogas = validateD1YogasAndDoshasAgainstD1(
    context.yogasAndDoshas || D1_YOGAS_AND_DOSHAS_001ME,
    context.flattenedNatalD1,
    natalLagnaIdx,
    natalMoonIdx
  );

  return {
    ...context,
    personId: context.personId || '001ME',
    shadbalaStrengths: context.shadbalaStrengths || SHADBALA_STRENGTHS_001ME,
    yogasAndDoshas: verifiedYogas,
    vargaCharts: context.vargaCharts || VARGA_CHARTS_001ME,
    ashtakavargaPayload: {
      targetHousePoints: context.ashtakavargaPayload?.targetHousePoints ?? 0,
      targetHouseStrength: context.ashtakavargaPayload?.targetHouseStrength ?? 'All-House Distribution',
      savTotalSum: CALIBRATED_ASHTAKAVARGA_001ME.savTotalSum,
      bavByPlanet: CALIBRATED_ASHTAKAVARGA_001ME.bavByPlanet,
      lagnaBav: CALIBRATED_ASHTAKAVARGA_001ME.lagnaBav,
      sodhyaPindas: CALIBRATED_ASHTAKAVARGA_001ME.sodhyaPindas,
      savPointsDistribution: CALIBRATED_ASHTAKAVARGA_001ME.allHousesOverview
    }
  };
}

