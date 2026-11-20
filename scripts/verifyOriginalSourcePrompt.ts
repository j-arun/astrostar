import { createServer } from 'vite';
import type { VedicHouseContext } from '../src/services/llm/types';

interface TestMonthSpec {
  year: number;
  monthIndex: number; // 0-indexed (10 = November)
  label: string;
}

const TEST_MONTHS: TestMonthSpec[] = [
  { year: 2025, monthIndex: 7, label: 'August 2025' },
  { year: 2026, monthIndex: 3, label: 'April 2026' },
  { year: 2026, monthIndex: 9, label: 'October 2026' },
  { year: 2026, monthIndex: 10, label: 'November 2026' },
  { year: 2026, monthIndex: 11, label: 'December 2026' }
];

const RASHI_META = [
  { index: 1, eng: 'Mesham (Aries)' },
  { index: 2, eng: 'Rishabam (Taurus)' },
  { index: 3, eng: 'Mithunam (Gemini)' },
  { index: 4, eng: 'Katakam (Cancer)' },
  { index: 5, eng: 'Simham (Leo)' },
  { index: 6, eng: 'Kanni (Virgo)' },
  { index: 7, eng: 'Thulaam (Libra)' },
  { index: 8, eng: 'Vrischigam (Scorpio)' },
  { index: 9, eng: 'Dhanus (Sagittarius)' },
  { index: 10, eng: 'Makaram (Capricorn)' },
  { index: 11, eng: 'Kumbam (Aquarius)' },
  { index: 12, eng: 'Meenam (Pisces)' }
];

function resolveSignIdx(signName: string, fallback = 9): number {
  const s = (signName || '').toLowerCase();
  const keys = [
    ['mesham', 'aries'],
    ['rishab', 'taurus'],
    ['mithun', 'gemini'],
    ['katak', 'kadag', 'cancer'],
    ['simha', 'leo'],
    ['kanni', 'virgo'],
    ['thula', 'libra'],
    ['vrisch', 'scorpio'],
    ['dhanu', 'sagittarius'],
    ['makar', 'capricorn'],
    ['kumbh', 'aquarius'],
    ['meen', 'pisces']
  ];
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].some(k => s.includes(k))) return i + 1;
  }
  return fallback;
}

async function main() {
  const printMonth = process.argv.includes('--print-nov') ? 10 : -1;

  const server = await createServer({
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    logLevel: 'silent'
  });

  try {
    const horoscopeMod = await server.ssrLoadModule('/src/data/horoscopeData.ts');
    const ephemerisMod = await server.ssrLoadModule('/src/data/transitEphemeris.ts');
    const dashaMod = await server.ssrLoadModule('/src/data/dashaCalculator.ts');
    const parasharaMod = await server.ssrLoadModule('/src/data/parasharaCalculations.ts');
    const eventsMod = await server.ssrLoadModule('/src/services/vedicEventsEngine.ts');
    const builderMod = await server.ssrLoadModule('/src/services/eventManufacturingBuilder.ts');
    const promptMod = await server.ssrLoadModule('/src/services/llm/originalSourcePrompt.ts');
    const contextBuilderMod = await server.ssrLoadModule('/src/services/originalSourceContextBuilder.ts');

    const { samplePersonMaster, sampleNatalPlacements } = horoscopeMod;
    const { getGrahaTransitPosition, calculateMonthlyMoonSpans, RASHI_LIST_META } = ephemerisMod;
    const { getVimshottariDashaForDate } = dashaMod;
    const { computeSarvashtakavarga } = parasharaMod;
    const { analyzeVedicWindowEvents } = eventsMod;
    const { buildEventManufacturingSnapshot } = builderMod;
    const { buildOriginalSourcePrompt, validateOriginalSourcePrompt } = promptMod;
    const { parseMonthYearQuery, generateOriginalSourceApiPayload } = contextBuilderMod;

    const natalLagnaIdx = resolveSignIdx(samplePersonMaster.birth_lagna, 9);
    const natalRashiIdx = resolveSignIdx(samplePersonMaster.birth_rashi, 8);

    const flattenedD1 = sampleNatalPlacements
      .filter((p: any) => p.chart_type === 'D1')
      .map((p: any) => {
        const sIdx = resolveSignIdx(p.rashi_name, 9);
        return {
          body_name: p.body_name,
          rashi_name: p.rashi_name,
          degree_sputa: p.degree_sputa,
          nakshatra_name: p.nakshatra_name,
          pada: p.pada,
          house_number: ((sIdx - natalLagnaIdx + 12) % 12) + 1,
          is_retrograde: p.is_retrograde
        };
      });

    const flattenedD9 = sampleNatalPlacements
      .filter((p: any) => p.chart_type === 'D9')
      .map((p: any) => ({
        body_name: p.body_name,
        rashi_name: p.rashi_name,
        degree_sputa: p.degree_sputa,
        house_number: p.house_number,
        is_retrograde: p.is_retrograde
      }));

    const savResult = computeSarvashtakavarga(natalLagnaIdx, undefined, flattenedD1);

    const staticBlockByVariant: Record<'baseline' | 'compact', string | null> = {
      baseline: null,
      compact: null
    };
    const allFailures: string[] = [];

    for (const spec of TEST_MONTHS) {
      const { year, monthIndex, label } = spec;
      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
      const monthStr = String(monthIndex + 1).padStart(2, '0');
      const startDateStr = `${year}-${monthStr}-01`;
      const endDateStr = `${year}-${monthStr}-${String(daysInMonth).padStart(2, '0')}`;
      const evalDate = new Date(Date.UTC(year, monthIndex, 15, 12, 0, 0));
      const evalDateStr = evalDate.toISOString().slice(0, 10);

      const activeDasha = getVimshottariDashaForDate(evalDateStr);

      const grahaKeys = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
      const transitPlacements = grahaKeys.map(k =>
        getGrahaTransitPosition(k, evalDate, natalLagnaIdx, natalRashiIdx)
      );

      const monthlyMoonSpans = calculateMonthlyMoonSpans(year, monthIndex, natalLagnaIdx);

      // Replicate monthlyGrahaSpans computation from MonthlyTransitView
      const monthlyGrahaSpans: any[] = [];
      for (const gKey of grahaKeys) {
        let currSign = -1;
        let currRetro = false;
        let currMotion: 'Normal' | 'Vakra' | 'Adisara' = 'Normal';
        let spanStart = 1;
        let samplePos: any = null;
        const trackAdisaraSplit = gKey === 'Jupiter' || gKey === 'Saturn';

        for (let d = 1; d <= daysInMonth; d++) {
          const dt = new Date(Date.UTC(year, monthIndex, d, 12, 0, 0));
          const pos = getGrahaTransitPosition(gKey, dt, natalLagnaIdx, natalRashiIdx);
          const posMotion: 'Normal' | 'Vakra' | 'Adisara' =
            pos.motion_type || (pos.is_retrograde ? 'Vakra' : 'Normal');
          const motionChanged = trackAdisaraSplit
            ? posMotion !== currMotion
            : !!pos.is_retrograde !== currRetro;
          if (currSign === -1) {
            currSign = pos.transit_rashi_index;
            currRetro = !!pos.is_retrograde;
            currMotion = posMotion;
            spanStart = 1;
            samplePos = pos;
          } else if (pos.transit_rashi_index !== currSign || motionChanged) {
            const signDef = RASHI_LIST_META.find((s: any) => s.index === currSign) || RASHI_LIST_META[0];
            monthlyGrahaSpans.push({
              graha_key: gKey,
              graha_name: samplePos?.graha_name || gKey,
              graha_tamil: samplePos?.graha_tamil || gKey,
              sign_index: currSign,
              sign_name: signDef.eng,
              sign_tamil: signDef.tamil,
              start_day: spanStart,
              end_day: d - 1,
              is_retrograde: currRetro,
              motion_type: currMotion,
              is_exalted: false,
              is_own_sign: false,
              is_custom: false
            });
            currSign = pos.transit_rashi_index;
            currRetro = !!pos.is_retrograde;
            currMotion = posMotion;
            spanStart = d;
            samplePos = pos;
          }
        }
        if (currSign !== -1) {
          const signDef = RASHI_LIST_META.find((s: any) => s.index === currSign) || RASHI_LIST_META[0];
          monthlyGrahaSpans.push({
            graha_key: gKey,
            graha_name: samplePos?.graha_name || gKey,
            graha_tamil: samplePos?.graha_tamil || gKey,
            sign_index: currSign,
            sign_name: signDef.eng,
            sign_tamil: signDef.tamil,
            start_day: spanStart,
            end_day: daysInMonth,
            is_retrograde: currRetro,
            motion_type: currMotion,
            is_exalted: false,
            is_own_sign: false,
            is_custom: false
          });
        }
      }

      const vedicSpecialEvents = analyzeVedicWindowEvents({
        startDateStr,
        endDateStr,
        natalLagnaIdx,
        natalRashiIdx,
        flattenedNatalD1: flattenedD1.map((np: any) => ({
          body_name: np.body_name,
          rashi_name: np.rashi_name
        })),
        overrides: {},
        priorTailDays: 3
      });

      const eventManufacturingSuperset = buildEventManufacturingSnapshot({
        selectedMonth: monthIndex,
        selectedYear: year,
        natalLagnaIdx,
        natalRashiIdx,
        activeDashaHierarchy: activeDasha,
        flattenedD1,
        transitPlacements,
        monthlyMoonSpans,
        monthlyGrahaSpans,
        vedicSpecialEvents
      });

      const context: VedicHouseContext = {
        isComprehensiveMonthly: true,
        activeDomainFilter: 'all',
        isEventActive: false,
        activationScore: 0,
        matchedRules: [],
        natalOccupants: [],
        transitOccupants: [],
        allTransitPlacements: transitPlacements.map((t: any) => ({
          graha_key: t.graha_key,
          graha_name: t.graha_name,
          graha_tamil: t.graha_tamil,
          transit_rashi_index: t.transit_rashi_index,
          transit_rashi_name: t.transit_rashi_name,
          transit_rashi_tamil: t.transit_rashi_tamil,
          house_from_lagna: ((t.transit_rashi_index - natalLagnaIdx + 12) % 12) + 1,
          house_from_moon: ((t.transit_rashi_index - natalRashiIdx + 12) % 12) + 1,
          degree_sputa: t.degree_sputa,
          degree_in_sign_float: t.degree_in_sign_float,
          nakshatra_name: t.graha_pada_chara?.nakshatra_name || 'N/A',
          nakshatra_lord: t.graha_pada_chara?.nakshatra_lord || '',
          pada: t.graha_pada_chara?.pada || 1,
          is_retrograde: t.is_retrograde,
          motion_type: t.motion_type || (t.is_retrograde ? 'Vakra' : 'Normal'),
          motion_description: t.motion_description,
          sav_points: savResult.savTotalPoints[t.transit_rashi_index] || 28,
          is_custom: false
        })),
        natalLagnaSignName: RASHI_META[natalLagnaIdx - 1].eng,
        natalMoonSignName: RASHI_META[natalRashiIdx - 1].eng,
        activeDasha,
        selectedMonth: monthIndex,
        selectedYear: year,
        flattenedNatalD1: flattenedD1,
        flattenedNatalD9: flattenedD9,
        monthlyMoonSpans,
        vedicSpecialEvents,
        natalJanmaStar: {
          nakshatra_name: samplePersonMaster.birth_star,
          pada: samplePersonMaster.birth_star_pada,
          rashi_name: 'Scorpio',
          rashi_index: natalRashiIdx
        },
        ashtakavargaPayload: {
          targetHousePoints: 0,
          targetHouseStrength: 'All-House Distribution',
          savPointsDistribution: savResult.allHousesOverview,
          savTotalSum: savResult.savTotalSum,
          bavByPlanet: savResult.bavByPlanet
        },
        eventManufacturingSuperset
      };

      const baselineRes = buildOriginalSourcePrompt(context, 'baseline');
      const compactRes = buildOriginalSourcePrompt(context, 'compact');

      if (compactRes.meta.charCount >= baselineRes.meta.charCount) {
        allFailures.push(`[${label}] Compact (${compactRes.meta.charCount} chars) is not smaller than Baseline (${baselineRes.meta.charCount} chars)`);
      }

      for (const variant of ['baseline', 'compact'] as const) {
        const result = variant === 'baseline' ? baselineRes : compactRes;

        if (printMonth === monthIndex) {
          console.log(`===== NOVEMBER 2026 ORIGINAL SOURCE [${variant.toUpperCase()}] (${result.meta.lineCount} lines, ${result.meta.charCount} chars, ~${result.meta.estTokens} tok) =====`);
          console.log(result.fullPrompt);
          console.log('=====================================================');
        }

        // 1. Static block byte-identity check per variant
        if (staticBlockByVariant[variant] === null) {
          staticBlockByVariant[variant] = result.staticBlock;
        } else if (result.staticBlock !== staticBlockByVariant[variant]) {
          allFailures.push(`[${label} / ${variant}] Static block is NOT byte-identical across months!`);
        }

        // 2. Full automated validator check
        const val = validateOriginalSourcePrompt(result, context, variant);
        if (!val.valid) {
          val.errors.forEach((e: string) => allFailures.push(`[${label} / ${variant}] ${e}`));
        }

        // 3. Spot-checks specifically targeting Master enrichments + Nov 2026 facts
        if (year === 2026 && monthIndex === 10) {
          const txt = result.fullPrompt;
          const assertContains = (needle: string | RegExp, desc: string) => {
            const ok = typeof needle === 'string' ? txt.includes(needle) : needle.test(txt);
            if (!ok) allFailures.push(`[November 2026 / ${variant}] Missing/Wrong ${desc}`);
          };
          const assertNotContains = (needle: string | RegExp, desc: string) => {
            const hit = typeof needle === 'string' ? txt.includes(needle) : needle.test(txt);
            if (hit) allFailures.push(`[November 2026 / ${variant}] Unexpected ${desc}`);
          };

          assertNotContains(/\(\s*\)/, 'empty parentheses in [D1] nakshatra names');
          assertNotContains(/^Ketu \|.*Exalted/m, 'Ketu Exalted in [D9]');
          assertNotContains(/^Rahu \|.*Exalted/m, 'Rahu Exalted in [D9]');
          assertNotContains(/Moon\s*\(d\d+\)/, 'redundant Moon line in [FAST PLANETS]');
          assertContains('Rahu | Taurus | H10', '[D9] Rahu in Taurus H10 opposite Ketu Scorpio H4');
          assertContains('Ketu | Scorpio | H4', '[D9] Ketu in Scorpio H4');
          assertContains('Mercury | Capricorn | H2', '[D1] Mercury in Capricorn H2');
          assertContains('Sum:337', 'authentic Parashara SAV sum 337');
          assertContains('H7:22', 'calibrated SAV H7=22');
          assertContains('H8:22', 'calibrated SAV H8=22');
          assertContains('H10:32', 'calibrated SAV H10=32');
          assertContains('H11:35', 'calibrated SAV H11=35');
          assertContains('Combust d1-9', 'Mercury data-computed Combust d1-9');
          assertContains('MD Venus 2013-04-02..2033-04-02', 'MD Venus start..end dates');
          assertContains('AD Saturn 2026-02-02..2029-04-02', 'AD Saturn start..end dates');
          assertContains('PD Mercury 2026-08-03..2027-01-14', 'PD Mercury start..end dates');
          assertContains(/Ardra P1-P4 d26 \d{2}:\d{2}\.\.d27 \d{2}:\d{2}/, 'Lunar Ardra d26-27 continuous scan');
          assertContains(/Ardra .*?\(Mitra T8\)/, 'Lunar Ardra (Mitra T8)');
          assertContains(/Kendra\[[^\]]+\]/, 'NB Kendra frame clarification');
          assertNotContains(/tr-disp Moon\[[^\]]+\],.*tr-disp Moon\[/, 'duplicate tr-disp Moon inside NB line');
          assertContains('As(Lagna)', '[BAV] Lagna As BAV row');
          assertContains('Pitru Dosha', '[DOSHAS] Pitru Dosha');
          assertContains('Raja Yogas (2)', '[YOGAS] 2 Raja Yogas');
          assertContains('General Yogas (19)', '[YOGAS] 19 General Yogas');
          assertContains('Dharma Karmadhipati Raja Yoga', '[YOGAS] Dharma Karmadhipati Raja Yoga');

          if (variant === 'baseline') {
            assertContains(/Mercury \| Capricorn \| H2 \|.*Combust\(/, '[D1] natal Mercury Combust flag');
            assertContains('L7:Mercury@H2(M3)(R,Combust)', '[HOUSE LORDS] L7 Mercury@H2');
            assertContains('AK: Jupiter (', '[JAIMINI] AK Jupiter');
            assertContains('DK: Mercury (', '[JAIMINI] DK Mercury');
            assertContains('Venus BAV (52):', '[BAV] Venus 52 bindus');
            assertContains('Jupiter BAV (56):', '[BAV] Jupiter 56 bindus');
            assertContains('Saturn: Rasi 91 + Graha 15 = Sodhya 106', '[PINDAS] Saturn Sodhya Pinda');
            assertContains('TZ: UTC (IST=+05:30) | Daily Snapshot: 12:00 UTC', '[PERIOD] timezone and snapshot time');
            assertContains('ChandraBala: Fav', 'ChandraBala: Fav on favorable Moon spans');
            assertContains('ChandraBala: -', 'ChandraBala: - on unfavorable Moon spans');
            assertContains(/Swati P3 d1-2 \(Mitra T8\), Swati P4 d3-6 \(Mitra T8\)/, 'Sun d1-6 Swati (Mitra T8)');
            assertContains(/Vishakha P1 d7-9 \(Parama Mitra T9\)/, 'Sun Vishakha (Parama Mitra T9)');
            assertContains(/Anuradha P1 d20-22 \(Janma T1\)/, 'Sun d20-30 Anuradha (Janma T1)');
            assertContains(/Mercury \| Libra .*Vishakha P1 d1-2 \(Parama Mitra T9\)/, 'Mercury d1-2 Vishakha (Parama Mitra T9)');
            assertContains(/Mercury \| Libra .*Vishakha P1 d25-27 \(Parama Mitra T9\)/, 'Mercury d25-27 Vishakha (Parama Mitra T9)');
            assertContains(/Pushya P1-P4 d1 \d{2}:\d{2}\.\.d1 \d{2}:\d{2} UTC \(Janma T1\) -> Ashlesha P1-P4 d1 \d{2}:\d{2}\.\.d2 \d{2}:\d{2} UTC \(Sampat T2\)/, 'Lunar Pushya (Janma T1) -> Ashlesha (Sampat T2)');
            assertContains('ADCHAMBER: natal Saturn @ Cancer (L8/M9)', 'ADCHAMBER natal Saturn @ Cancer');
            assertContains('L2/M3 Capricorn (T: Moon)', 'T: Moon in ADCHAMBER Ruled');
            assertContains('L3/M4 Aquarius (T: Rahu', 'T: Rahu in ADCHAMBER Ruled');
            assertContains('Libra L11/M12 (Swakshetra) d1-5; Virgo L10/M11 (Neecha) d6-22; Libra L11/M12 (Swakshetra) d23-30', 'MD Venus per-segment dignity');
            assertContains(/STATION Mercury Retrograde -> Direct Libra L11\/M12 2026-11-14 @\d{2}°\d{2}'/, 'STATION explicit event with degree');
            assertContains('NEECHABHANGA Venus Virgo L10/M11 2026-11-06..2026-11-13', 'NEECHABHANGA explicit event');
          } else {
            assertContains(/Mercury \| Capricorn \| H2 \|.*Comb\(/, '[D1] natal Mercury Comb flag');
            assertContains('L7:Mercury@H2(R,Comb)', '[HOUSE LORDS] L7 Mercury@H2');
            assertContains('AK: Jupiter (', '[JAIMINI] AK: Jupiter');
            assertContains('DK: Mercury (', '[JAIMINI] DK: Mercury');
            assertContains('Venus(52):', '[BAV] Venus(52)');
            assertContains('Jupiter(56):', '[BAV] Jupiter(56)');
            assertContains('Saturn: R91+G15=106', '[PINDAS] Saturn compact Pinda');
            assertContains('TZ:UTC(IST=+05:30)|Snap:12:00 UTC', '[PERIOD] compact timezone and snapshot');
            assertContains('CB:Fav', 'CB:Fav on favorable Moon spans');
            assertContains('CB:-', 'CB:- on unfavorable Moon spans');
            assertContains(/Swati P3 d1-2\/P4 d3-6\(Mitra T8\)/, 'Sun d1-6 Swati (Mitra T8)');
            assertContains(/Vishakha P1 d7-9\/P2 d10-12\/P3 d13-16\(Parama Mitra T9\)/, 'Sun Vishakha (Parama Mitra T9)');
            assertContains(/Anuradha P1 d20-22\/P2 d23-25\/P3 d26-29\/P4 d30\(Janma T1\)/, 'Sun d20-30 Anuradha (Janma T1)');
            assertContains(/Mercury \| Libra.*Vishakha P1 d1-2\(Parama Mitra T9\)/, 'Mercury d1-2 Vishakha (Parama Mitra T9)');
            assertContains(/Mercury \| Libra.*Vishakha P1 d25-27\/P2 d28-29\/P3 d30\(Parama Mitra T9\)/, 'Mercury d25-30 Vishakha (Parama Mitra T9)');
            assertContains(/Pushya P1-P4 d1 \d{2}:\d{2}\.\.d1 \d{2}:\d{2}\(Janma T1\)->Ashlesha P1-P4 d1 \d{2}:\d{2}\.\.d2 \d{2}:\d{2}\(Sampat T2\)/, 'Lunar Pushya (Janma T1)->Ashlesha (Sampat T2)');
            assertContains(/ADCHAMBER:natal Saturn@Cancer\(L8\/M9\)/, 'ADCHAMBER natal Saturn@Cancer');
            assertContains('L2/M3 Capricorn(T:Moon)', 'T:Moon in ADCHAMBER Ruled');
            assertContains('L3/M4 Aquarius(T:Rahu', 'T:Rahu in ADCHAMBER Ruled');
            assertContains('Libra L11/M12(Swakshetra) d1-5;Virgo L10/M11(Neecha) d6-22;Libra L11/M12(Swakshetra) d23-30', 'MD Venus per-segment dignity');
            assertContains(/STA Mercury R->D Libra L11\/M12 11-14 @\d{2}°\d{2}'/, 'STA compact event with degree');
            assertContains('NB Venus Virgo L10/M11 11-06..11-13', 'NB compact event');
          }
        }
      }

      console.log(
        `PASS check candidate: ${label} | Baseline: ${baselineRes.meta.lineCount}L, ${baselineRes.meta.charCount}c (~${baselineRes.meta.estTokens}t) | Compact: ${compactRes.meta.lineCount}L, ${compactRes.meta.charCount}c (~${compactRes.meta.estTokens}t)`
      );
    }

    // 4. REST API query parser checks across accepted date/month-year formats
    const dateCases: Array<{
      args: [string | null, string | null, string | null];
      expectOk: boolean;
      year?: number;
      monthIndex?: number;
      desc: string;
    }> = [
      { args: ['May 2026', null, null], expectOk: true, year: 2026, monthIndex: 4, desc: 'May 2026' },
      { args: ['may-2026', null, null], expectOk: true, year: 2026, monthIndex: 4, desc: 'may-2026' },
      { args: ['4/2026', null, null], expectOk: true, year: 2026, monthIndex: 3, desc: '4/2026' },
      { args: ['04/2026', null, null], expectOk: true, year: 2026, monthIndex: 3, desc: '04/2026' },
      { args: ['2026-04', null, null], expectOk: true, year: 2026, monthIndex: 3, desc: '2026-04' },
      { args: ['202605', null, null], expectOk: true, year: 2026, monthIndex: 4, desc: '202605' },
      { args: ['2026-05-15', null, null], expectOk: true, year: 2026, monthIndex: 4, desc: '2026-05-15' },
      { args: ['15-05-2026', null, null], expectOk: true, year: 2026, monthIndex: 4, desc: '15-05-2026' },
      { args: ['05/15/2026', null, null], expectOk: true, year: 2026, monthIndex: 4, desc: '05/15/2026' },
      { args: ['Nov 2026', null, null], expectOk: true, year: 2026, monthIndex: 10, desc: 'Nov 2026' },
      { args: ['2026 November', null, null], expectOk: true, year: 2026, monthIndex: 10, desc: '2026 November' },
      { args: [null, '5', '2026'], expectOk: true, year: 2026, monthIndex: 4, desc: 'month=5&year=2026' },
      { args: [null, 'May', '2026'], expectOk: true, year: 2026, monthIndex: 4, desc: 'month=May&year=2026' },
      { args: [null, null, null], expectOk: true, desc: 'empty defaults to current month' },
      { args: ['not-a-date', null, null], expectOk: false, desc: 'invalid date rejected' }
    ];

    for (const tc of dateCases) {
      const parsed = parseMonthYearQuery(...tc.args);
      if (parsed.ok !== tc.expectOk) {
        allFailures.push(`[API date parser] "${tc.desc}" expected ok=${tc.expectOk}, got ${parsed.ok}`);
      } else if (tc.expectOk && parsed.ok && tc.year !== undefined && tc.monthIndex !== undefined) {
        if (parsed.year !== tc.year || parsed.monthIndex !== tc.monthIndex) {
          allFailures.push(`[API date parser] "${tc.desc}" expected ${tc.year}-${tc.monthIndex}, got ${parsed.year}-${parsed.monthIndex}`);
        }
      }
    }

    // 5. REST API payload builder checks (baseline, compact, both, month, static, subprompt + all 5 domains)
    const apiBase = generateOriginalSourceApiPayload({ year: 2026, monthIndex: 10, variant: 'baseline', part: 'full', domain: 'master' });
    const apiCompact = generateOriginalSourceApiPayload({ year: 2026, monthIndex: 10, variant: 'compact', part: 'full', domain: 'master' });
    const apiMonth = generateOriginalSourceApiPayload({ year: 2026, monthIndex: 10, variant: 'compact', part: 'month', domain: 'master' });
    const apiStatic = generateOriginalSourceApiPayload({ year: 2026, monthIndex: 10, variant: 'compact', part: 'static', domain: 'master' });
    const apiBoth = generateOriginalSourceApiPayload({ year: 2026, monthIndex: 10, variant: 'both', part: 'full', domain: 'master' });

    if (!apiBase.validated || apiBase.monthLabel !== 'November 2026') {
      allFailures.push('[API payload] baseline Nov 2026 failed validation or monthLabel check');
    }
    if (!apiCompact.validated || apiCompact.content !== apiCompact.fullPrompt) {
      allFailures.push('[API payload] compact Nov 2026 full part mismatch');
    }
    if (apiMonth.content !== apiCompact.monthSlice || !apiMonth.content.startsWith('[PERIOD]')) {
      allFailures.push('[API payload] compact Nov 2026 month slice mismatch');
    }
    if (apiStatic.content !== apiCompact.staticBlock || !apiStatic.content.startsWith('[RULES]')) {
      allFailures.push('[API payload] compact Nov 2026 static slice mismatch');
    }
    if (!apiBoth.validated || !apiBoth.baseline?.validated || !apiBoth.compact?.validated || apiBoth.tokenSavings <= 0) {
      allFailures.push('[API payload] variant=both Nov 2026 failed validation or tokenSavings check');
    }

    // 6. All 4 Domain Sub-Prompts + Varga exclusivity + Output Structure + Readout Option B + KV-Cache tail checks
    const domainExpectations: Array<{
      domain: 'career' | 'finance' | 'love' | 'family';
      expectedVargas: string[];
      forbiddenVargas: string[];
      expectedMatrixTitle: string;
      expectedDefaultQuestion: string;
    }> = [
      {
        domain: 'career',
        expectedVargas: ['D10'],
        forbiddenVargas: ['D2', 'D4', 'D7', 'D11', 'D12', 'D16', 'D30'],
        expectedMatrixTitle: '## 2. Career Event Timeline & Rating Matrix',
        expectedDefaultQuestion: 'FULL CAREER READING'
      },
      {
        domain: 'finance',
        expectedVargas: ['D2', 'D11', 'D4'],
        forbiddenVargas: ['D7', 'D10', 'D12', 'D16', 'D30'],
        expectedMatrixTitle: '## 2. Financial Event Timeline & Rating Matrix',
        expectedDefaultQuestion: 'FULL FINANCE READING'
      },
      {
        domain: 'love',
        expectedVargas: ['D7', 'D30'],
        forbiddenVargas: ['D2', 'D4', 'D10', 'D11', 'D12', 'D16'],
        expectedMatrixTitle: '## 2. Relationship Event Timeline & Rating Matrix',
        expectedDefaultQuestion: 'FULL RELATIONSHIP READING'
      },
      {
        domain: 'family',
        expectedVargas: ['D4', 'D12', 'D7', 'D16'],
        forbiddenVargas: ['D2', 'D10', 'D11', 'D30'],
        expectedMatrixTitle: '## 2. Family Event Timeline & Rating Matrix',
        expectedDefaultQuestion: 'FULL FAMILY READING'
      }
    ];

    for (const de of domainExpectations) {
      const domRes = generateOriginalSourceApiPayload({
        year: 2026,
        monthIndex: 10,
        variant: 'compact',
        part: 'full',
        domain: de.domain
      });
      if (!domRes.validated) {
        allFailures.push(`[Domain ${de.domain}] failed validation: ${(domRes.validationErrors || []).join('; ')}`);
      }
      for (const v of de.expectedVargas) {
        if (!domRes.fullPrompt.includes(`[VARGA ${v}:`)) {
          allFailures.push(`[Domain ${de.domain}] missing expected [VARGA ${v}:]`);
        }
      }
      for (const fv of de.forbiddenVargas) {
        if (domRes.fullPrompt.includes(`[VARGA ${fv}:`)) {
          allFailures.push(`[Domain ${de.domain}] leaked forbidden [VARGA ${fv}:]`);
        }
      }
      const requiredTailTokens = [
        '[OUTPUT STRUCTURE]',
        de.expectedMatrixTitle,
        'Probability (%) | Rating (1-3) |',
        '## 5. Readout (Plain Real-World Scenarios Only - Zero Astrological Terms)',
        '### 1. Month Summary',
        '### 2. Answer to Focus Question (or Key Practical Takeaways if FULL READING)',
        `[FOCUS QUESTION]\n${de.expectedDefaultQuestion}`
      ];
      for (const tok of requiredTailTokens) {
        if (!domRes.fullPrompt.includes(tok)) {
          allFailures.push(`[Domain ${de.domain}] missing Output Structure / Readout token: "${tok}"`);
        }
      }

      // KV-Cache prefix byte-identity check with custom Run-1 Focus Question
      const customQ = 'What happens between Nov 12 and Nov 20?';
      const customRes = generateOriginalSourceApiPayload({
        year: 2026,
        monthIndex: 10,
        variant: 'compact',
        part: 'full',
        domain: de.domain,
        question: customQ
      });
      if (!customRes.validated || !customRes.fullPrompt.endsWith(`[FOCUS QUESTION]\n${customQ}`)) {
        allFailures.push(`[Domain ${de.domain}] custom Focus Question not appended cleanly at prompt tail`);
      }
      const prefixDefault = domRes.fullPrompt.split('\n[FOCUS QUESTION]\n')[0];
      const prefixCustom = customRes.fullPrompt.split('\n[FOCUS QUESTION]\n')[0];
      if (prefixDefault !== prefixCustom) {
        allFailures.push(`[Domain ${de.domain}] KV-Cache prefix broken when custom ?question= is supplied!`);
      }

      const subOnly = generateOriginalSourceApiPayload({
        year: 2026,
        monthIndex: 10,
        variant: 'compact',
        part: 'subprompt',
        domain: de.domain
      });
      if (!subOnly.content.startsWith(`[SUB-PROMPT: ${de.domain.toUpperCase()}]`)) {
        allFailures.push(`[Domain ${de.domain}] part=subprompt missing [SUB-PROMPT: ${de.domain.toUpperCase()}] header`);
      }
      console.log(
        `PASS Domain [${de.domain.toUpperCase()}]: ${domRes.meta.lineCount}L, ${domRes.meta.charCount}c (~${domRes.meta.estTokens}t) | Vargas: ${de.expectedVargas.join(', ')} | Readout Option B + KV Prefix OK`
      );
    }

    // Master optional ?question= KV-cache tail check
    const masterWithQ = generateOriginalSourceApiPayload({
      year: 2026,
      monthIndex: 10,
      variant: 'compact',
      part: 'full',
      domain: 'master',
      question: 'Key priority windows this month?'
    });
    if (!masterWithQ.validated || masterWithQ.fullPrompt.split('\n[FOCUS QUESTION]\n')[0] !== apiCompact.fullPrompt) {
      allFailures.push('[Master] custom ?question= did not preserve exact byte-identical Master prefix');
    }

    if (allFailures.length > 0) {
      console.error(`\nOriginal Source Prompt Regression FAILED with ${allFailures.length} mismatch(es):`);
      allFailures.forEach((f, idx) => console.error(`  ${idx + 1}. ${f}`));
      process.exit(1);
    }

    console.log(`\nALL ${TEST_MONTHS.length} MONTHS x 2 VARIANTS + MASTER & 4 DOMAIN SUB-PROMPTS + READOUT + KV PREFIX + API CHECKS PASSED (0 mismatches).`);
  } finally {
    await server.close();
  }
}

main().catch(err => {
  console.error('Regression script crashed:', err);
  process.exit(1);
});
