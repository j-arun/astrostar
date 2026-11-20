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
  description: string;
  vargaCharts: string[];
  focusHouses: number[];
  primaryKarakas: string[];
  focusGuidance: string;
}

export const DOMAIN_PROMPT_SPECS: Record<OriginalSourceDomain, DomainPromptSpec> = {
  master: {
    id: 'master',
    label: 'Master Prompt (All-Domain Base)',
    shortLabel: 'Master',
    description: 'Complete foundational chart (D1, D9, Shadbala, 7-Planet Ashtakavarga + As + Sodhya Pindas, Yogas & Doshas, Jaimini) + Monthly Ephemeris.',
    vargaCharts: ['D1', 'D9'],
    focusHouses: [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    primaryKarakas: ['Jupiter', 'Venus', 'Saturn', 'Mercury', 'Sun', 'Moon', 'Mars'],
    focusGuidance: 'Full holistic baseline across all life domains using D1 and D9 only (no D2..D144 divisional attachments).'
  },
  career: {
    id: 'career',
    label: 'Career Prompt (Work & Authority)',
    shortLabel: 'Career',
    description: 'Master Prompt + Career Sub-Prompt attaching D10 (Dasamsa), H10/H6/H11/H2 focus, Shadbala Dig/Cheshta, Dharma-Karmadhipati & Vipareetha Raja Yogas.',
    vargaCharts: ['D10'],
    focusHouses: [10, 6, 11, 2, 9, 1],
    primaryKarakas: ['Mercury', 'Sun', 'Saturn', 'Mars', 'Jupiter'],
    focusGuidance: 'Analyze profession, authority, job continuity vs role change, promotion, and daily work friction by combining D1 H10/H6/H11 with D10 (Dasamsa) lordships and placements.'
  },
  finance: {
    id: 'finance',
    label: 'Finance Prompt (Wealth & Assets)',
    shortLabel: 'Finance',
    description: 'Master Prompt + Finance Sub-Prompt attaching D2 (Hora), D11 (Ekadasamsa), D4 (Chaturthamsa), H2/H11/H5/H4/H8 focus, Dhana Yogas & Sodhya Pindas.',
    vargaCharts: ['D2', 'D11', 'D4'],
    focusHouses: [2, 11, 5, 9, 4, 8],
    primaryKarakas: ['Jupiter', 'Venus', 'Mercury', 'Saturn', 'Mars'],
    focusGuidance: 'Analyze liquid cashflow, accumulated savings, windfalls, debt/PF/institutional payouts, and fixed property/asset accumulation across D2 (Hora), D11 (Ekadasamsa), and D4 (Chaturthamsa).'
  },
  love: {
    id: 'love',
    label: 'Love Prompt (Romance & Marriage)',
    shortLabel: 'Love',
    description: 'Master Prompt + Love Sub-Prompt attaching D7 (Saptamsa) & D30 (Trimsamsa) alongside Master D9 (Navamsa), H5/H7/H12/H11, UL/A7/DK & Venus/Jupiter BAV.',
    vargaCharts: ['D7', 'D30'],
    focusHouses: [5, 7, 12, 11, 1],
    primaryKarakas: ['Venus', 'Jupiter', 'Mercury', 'Moon'],
    focusGuidance: 'Analyze romantic attraction, relationship trajectory, marriage/committed bond, intimacy, and emotional stressors using Master D9 (Navamsa) paired with D7 (Saptamsa) and D30 (Trimsamsa).'
  },
  family: {
    id: 'family',
    label: 'Family Prompt (Home, Lineage & Parents)',
    shortLabel: 'Family',
    description: 'Master Prompt + Family Sub-Prompt attaching D4 (Chaturthamsa), D12 (Dwadasamsa), D7 (Saptamsa), D16 (Shodasamsa), Pitru Dosha & maternal/domestic yogas.',
    vargaCharts: ['D4', 'D12', 'D7', 'D16'],
    focusHouses: [4, 2, 5, 9, 3],
    primaryKarakas: ['Moon', 'Jupiter', 'Sun', 'Venus', 'Mars'],
    focusGuidance: 'Analyze domestic peace, mother/father/parents, children, ancestral lineage obligations (Pitru Dosha), home/vehicle comforts, and relocation across D4, D12, D7, and D16.'
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
      condition: 'L9 Sun (Leo) and L10 Mercury (Virgo) conjoined in H2 Capricorn',
      domains: ['career', 'finance']
    },
    {
      name: 'Vipareetha Raja Yoga',
      participants: ['Mars', 'Moon'],
      condition: 'L12 Mars in H6 Taurus; L8 Moon in H12 Scorpio (success after struggle)',
      domains: ['career', 'finance']
    }
  ],
  generalYogas: [
    { name: 'Vosi Yoga', condition: 'Planet(s) in 12th from Sun (Venus in H1 Sagittarius)', domains: ['career', 'finance'] },
    { name: 'Nipuna Yoga', condition: 'Sun+Mercury in H2 Capricorn (attenuated by Mercury natal combustion)', domains: ['career'] },
    { name: 'Sunaphaa Yoga', condition: 'Venus in 2nd from Moon (self-earned wealth/authority)', domains: ['finance', 'career'] },
    { name: 'Hamsa Yoga', condition: 'Jupiter in H4 Pisces Own Kendra (spiritual strength, comforts, speech)', domains: ['career', 'love', 'family'] },
    { name: 'Daama Yoga', condition: '7 planets occupy 6 distinct signs (wealth, children, generosity)', domains: ['finance', 'family'] },
    { name: 'Subha Yoga', condition: 'Venus in Lagna / benefics supporting Lagna', domains: ['love', 'family'] },
    { name: 'Harihara Brahma Yoga', condition: 'Jupiter/Venus/Mercury in mutual Kendras from L1/L9/L10/L11', domains: ['career', 'finance', 'family'] },
    { name: 'Saraswathi Yoga', condition: 'Mercury (H2), Jupiter (H4 Own), Venus (H1) in Kendra/2nd (learning, prosperity)', domains: ['career', 'finance', 'love'] },
    { name: 'Parijatha Yoga', condition: 'Lagna dispositor chain in Kendra/Trikona (mid/late-life honors)', domains: ['career', 'finance'] },
    { name: 'Sareera Soukhya Yoga', condition: 'L1 Jupiter (H4) and Venus (H1) in Kendras (vitality, comfort)', domains: ['love', 'family'] },
    { name: 'Swaveeryaddhana Yoga', condition: 'Self-earned wealth via personal effort without primary ancestral reliance', domains: ['finance'] },
    { name: 'Anthya Vayasi Dhana Yoga', condition: 'L2/L9/L11 dignity & benefic association (late-life wealth accumulation)', domains: ['finance'] },
    { name: 'Matrumooladdhana Yoga', condition: 'Wealth/assets connected to mother/H4 Jupiter influence', domains: ['finance', 'family'] },
    { name: 'Yuddha Praveena Yoga', condition: 'Tactical/strategic capability via 3rd lord Navamsa linkage', domains: ['career'] },
    { name: 'Bandhu Pujya Yoga', condition: 'H4/L4 associated with Jupiter (respect from relatives/family)', domains: ['family'] },
    { name: 'Nishkapata Yoga', condition: 'H4 Pisces occupied by benefic Jupiter in Own sign (pure-hearted domestic base)', domains: ['family', 'love'] },
    { name: 'Maathru Sneha Yoga', condition: 'L1 & L4 both ruled by Jupiter (cordial maternal bond)', domains: ['family'] },
    { name: 'Vaahana Yoga', condition: 'L1 Jupiter in H4 (material comforts & conveyances)', domains: ['family', 'finance'] },
    { name: 'Bhaagya Yoga', condition: 'Strong benefic in H1 aspecting H9 Leo (fortune & enjoyments)', domains: ['finance', 'love', 'career'] }
  ],
  doshas: [
    {
      name: 'Pitru Dosha',
      status: 'Present',
      reasons: [
        'Sun (Pitri Karaka & L9) plus H9 Leo & L9 afflicted by malefics (Saturn/Rahu/Ketu/Mars influences)',
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
  if (!is001) return context;

  return {
    ...context,
    personId: context.personId || '001ME',
    shadbalaStrengths: context.shadbalaStrengths || SHADBALA_STRENGTHS_001ME,
    yogasAndDoshas: context.yogasAndDoshas || D1_YOGAS_AND_DOSHAS_001ME,
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
