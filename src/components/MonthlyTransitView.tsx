import React, { useState, useMemo } from 'react';
import {
  CalendarDays,
  Sparkles,
  Eye,
  Layers,
  Compass,
  Info,
  X,
  Target,
  ArrowRight,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Calendar as CalendarIcon,
  Clock,
  Zap,
  Sliders,
  ChevronDown,
  ChevronUp,
  Check,
  Bot,
  Volume2,
  Mic,
  GripVertical,
  Move,
  Download,
  AlertCircle
} from 'lucide-react';
import { samplePersonMaster, sampleNatalPlacements } from '../data/horoscopeData';
import { ingestedPersonsRegistry, ALL_DASHA_TIMELINE } from '../data/apiService';
import storedPersonsData from '../data/stored_persons.json';
import { getGrahaTransitPosition, RASHI_LIST_META, calculateMonthlyMoonSpans, MonthlyMoonSpan } from '../data/transitEphemeris';
import { getVimshottariDashaForDate, DynamicDashaHierarchy } from '../data/dashaCalculator';
import { AstroRule, DEFAULT_RULES, evaluateHouseActivations, HouseActivationResult, calculateDashaDeliveryFactor, DashaDeliveryReport } from '../data/ruleEngine';
import { AudioVoiceInspector } from './AudioVoiceInspector';
import { LLMProviderId, LLM_PROVIDERS, VedicHouseContext } from '../services/llm/types';

export function getSignIndexFromName(signName: string, fallback = 9): number {
  if (!signName) return fallback;
  const s = signName.toLowerCase();
  const signKeys = [
    'mesham', 'rishab', 'mithun', 'katak', 'simha', 'kanni',
    'thula', 'vrisch', 'dhanu', 'makar', 'kumbh', 'meen'
  ];
  for (let i = 0; i < signKeys.length; i++) {
    if (s.includes(signKeys[i])) return i + 1;
  }
  const engKeys = [
    'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
    'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'
  ];
  for (let i = 0; i < engKeys.length; i++) {
    if (s.includes(engKeys[i])) return i + 1;
  }
  return fallback;
}

/**
 * Maps a Planet / Lord to its traditional sign indices (1 = Aries .. 12 = Pisces)
 */
export function getLordOwnedSigns(lordName: string): number[] {
  const norm = lordName.toLowerCase();
  if (norm.includes('sun') || norm.includes('surya')) return [5]; // Leo
  if (norm.includes('moon') || norm.includes('chandra')) return [4]; // Cancer
  if (norm.includes('mars') || norm.includes('sevvai')) return [1, 8]; // Aries, Scorpio
  if (norm.includes('mercury') || norm.includes('budha')) return [3, 6]; // Gemini, Virgo
  if (norm.includes('jupiter') || norm.includes('guru')) return [9, 12]; // Sagittarius, Pisces
  if (norm.includes('venus') || norm.includes('sukra')) return [2, 7]; // Taurus, Libra
  if (norm.includes('saturn') || norm.includes('sani')) return [10, 11]; // Capricorn, Aquarius
  if (norm.includes('rahu')) return [11]; // Co-rules Aquarius
  if (norm.includes('ketu')) return [8]; // Co-rules Scorpio
  return [];
}

/**
 * 12 Signs Metadata with Fixed South Indian Grid Coordinates & Zodiac Iconography
 */
export interface ZodiacSignMeta {
  index: number; // 1 = Aries .. 12 = Pisces
  eng: string;
  tamil: string;
  lord: string;
  r: number; // Row in 4x4 grid (0..3)
  c: number; // Col in 4x4 grid (0..3)
  icon: string; // Astrological Archetype Emoji/Icon
  symbol: string; // Astronomical Symbol
}

export const SOUTH_INDIAN_SIGNS: ZodiacSignMeta[] = [
  // Row 0 (Top)
  { index: 12, eng: 'Meenam (Pisces)', tamil: 'மீனம்', lord: 'Jupiter (Guru)', r: 0, c: 0, icon: '🐟', symbol: '♓' },
  { index: 1, eng: 'Mesham (Aries)', tamil: 'மேஷம்', lord: 'Mars (Sevvai)', r: 0, c: 1, icon: '🐏', symbol: '♈' },
  { index: 2, eng: 'Rishabam (Taurus)', tamil: 'ரிஷபம்', lord: 'Venus (Sukra)', r: 0, c: 2, icon: '🐂', symbol: '♉' },
  { index: 3, eng: 'Mithunam (Gemini)', tamil: 'மிதுனம்', lord: 'Mercury (Budha)', r: 0, c: 3, icon: '👥', symbol: '♊' },

  // Row 1
  { index: 11, eng: 'Kumbam (Aquarius)', tamil: 'கும்பம்', lord: 'Saturn (Sani)', r: 1, c: 0, icon: '🏺', symbol: '♒' },
  { index: 4, eng: 'Katakam (Cancer)', tamil: 'கடகம்', lord: 'Moon (Chandra)', r: 1, c: 3, icon: '🦀', symbol: '♋' },

  // Row 2
  { index: 10, eng: 'Makaram (Capricorn)', tamil: 'மகரம்', lord: 'Saturn (Sani)', r: 2, c: 0, icon: '🐐', symbol: '♑' },
  { index: 5, eng: 'Simham (Leo)', tamil: 'சிம்மம்', lord: 'Sun (Surya)', r: 2, c: 3, icon: '🦁', symbol: '♌' },

  // Row 3 (Bottom)
  { index: 9, eng: 'Dhanus (Sagittarius)', tamil: 'தனுசு', lord: 'Jupiter (Guru)', r: 3, c: 0, icon: '🏹', symbol: '♐' },
  { index: 8, eng: 'Vrischigam (Scorpio)', tamil: 'விருச்சிகம்', lord: 'Mars (Sevvai)', r: 3, c: 1, icon: '🦂', symbol: '♏' },
  { index: 7, eng: 'Thulaam (Libra)', tamil: 'துலாம்', lord: 'Venus (Sukra)', r: 3, c: 2, icon: '⚖️', symbol: '♎' },
  { index: 6, eng: 'Kanni (Virgo)', tamil: 'கன்னி', lord: 'Mercury (Budha)', r: 3, c: 3, icon: '🌾', symbol: '♍' },
];

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Standard Vedic Planet Symbols & Short Codes
 */
export const PLANET_ICONS: Record<string, { symbol: string; short: string; color: string }> = {
  Sun: { symbol: '☉', short: 'Su', color: 'text-amber-400' },
  Moon: { symbol: '☽', short: 'Mo', color: 'text-sky-300' },
  Mars: { symbol: '♂', short: 'Ma', color: 'text-rose-400' },
  Mercury: { symbol: '☿', short: 'Me', color: 'text-emerald-400' },
  Jupiter: { symbol: '♃', short: 'Ju', color: 'text-yellow-300' },
  Venus: { symbol: '♀', short: 'Ve', color: 'text-pink-300' },
  Saturn: { symbol: '♄', short: 'Sa', color: 'text-indigo-400' },
  Rahu: { symbol: '☊', short: 'Ra', color: 'text-purple-400' },
  Ketu: { symbol: '☋', short: 'Ke', color: 'text-violet-400' },
  Lagna: { symbol: 'Asc', short: 'Lag', color: 'text-cyan-300' },
};

/**
 * Classical Vedic Graha Drishti (Aspect Rules)
 */
export function calculateGrahaDrishti(
  sourceSignIndex: number,
  planetKey: string
): { targetSignIndex: number; aspectType: string; aspectDegree: number }[] {
  const aspects: { targetSignIndex: number; aspectType: string; aspectDegree: number }[] = [];

  const addAspect = (houseOffset: number, label: string) => {
    const targetIdx = ((sourceSignIndex - 1 + (houseOffset - 1)) % 12) + 1;
    aspects.push({
      targetSignIndex: targetIdx,
      aspectType: label,
      aspectDegree: houseOffset === 1 ? 0 : (houseOffset - 1) * 30
    });
  };

  // Base 1st house (self-occupation)
  addAspect(1, 'Occupation (1st)');

  // All Grahas have 7th house full aspect
  addAspect(7, 'Full 7th Drishti');

  const p = planetKey.toLowerCase();
  if (p.includes('saturn') || p.includes('sani') || p.includes('sa')) {
    addAspect(3, 'Special 3rd Drishti');
    addAspect(10, 'Special 10th Drishti');
  } else if (p.includes('mars') || p.includes('sevvai') || p.includes('ma')) {
    addAspect(4, 'Special 4th Drishti');
    addAspect(8, 'Special 8th Drishti');
  } else if (p.includes('jupiter') || p.includes('guru') || p.includes('ju')) {
    addAspect(5, 'Special 5th Drishti');
    addAspect(9, 'Special 9th Drishti');
  } else if (p.includes('rahu') || p.includes('ketu') || p.includes('ra') || p.includes('ke')) {
    addAspect(5, 'Trine 5th Drishti');
    addAspect(9, 'Trine 9th Drishti');
  }

  return aspects;
}

export interface MonthlyTransitViewProps {
  personId?: string;
}

export const MonthlyTransitView: React.FC<MonthlyTransitViewProps> = ({ personId = '001ME' }) => {
  // Current real-world date reference
  const realNow = useMemo(() => new Date(), []);

  // Selected Year & Month state (Defaults to current month)
  const [selectedYear, setSelectedYear] = useState<number>(realNow.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(realNow.getMonth()); // 0-11
  const [selectedDay, setSelectedDay] = useState<number>(15); // Mid-month reference for ephemeris

  // Active selected planet for Raycasting
  const [activeRaycast, setActiveRaycast] = useState<{
    id: string;
    name: string;
    sourceSignIndex: number;
    sourceSignName: string;
    layer: 'natal' | 'transit';
    aspectTargets: { targetSignIndex: number; aspectType: string; aspectDegree: number }[];
  } | null>(null);

  // Dynamically resolve active person profile & placements from registry or authoritative store
  const activeRecord = useMemo(() => {
    return ingestedPersonsRegistry[personId] || (storedPersonsData as any)[personId] || ingestedPersonsRegistry['001ME'] || (storedPersonsData as any)['001ME'];
  }, [personId]);

  const activeProfile = activeRecord.profile;

  // Natal Lagna Sign Index (1..12) dynamically derived from person's birth_lagna
  const natalLagnaIdx = useMemo(() => {
    return getSignIndexFromName(activeProfile.birth_lagna, 9);
  }, [activeProfile.birth_lagna]);

  // Natal Janma Rashi Index (1..12) dynamically derived from person's birth_rashi
  const natalRashiIdx = useMemo(() => {
    return getSignIndexFromName(activeProfile.birth_rashi, 8);
  }, [activeProfile.birth_rashi]);

  // D1 Natal Placements for this native
  const natalD1Placements = useMemo(() => {
    return activeRecord.placements.filter(p => p.chart_type === 'D1');
  }, [activeRecord]);

  // Active Evaluation Date object
  const activeDate = useMemo(() => {
    return new Date(Date.UTC(selectedYear, selectedMonth, selectedDay, 12, 0, 0));
  }, [selectedYear, selectedMonth, selectedDay]);

  const activeDateIsoStr = useMemo(() => {
    return activeDate.toISOString().slice(0, 10);
  }, [activeDate]);

  // User Custom Transit Placements (Overrides default calculated cache)
  const storageKey = useMemo(() => {
    return `vedic_transit_override_${personId}_${selectedYear}_${selectedMonth}`;
  }, [personId, selectedYear, selectedMonth]);

  // Collapsible section toggles for Monthly View (3 Sections)
  const [expandTimelineControls, setExpandTimelineControls] = useState<boolean>(true);
  const [expandTransitChart, setExpandTransitChart] = useState<boolean>(true);
  const [expandRuleEngine, setExpandRuleEngine] = useState<boolean>(true);

  const handleExpandAll = () => {
    setExpandTimelineControls(true);
    setExpandTransitChart(true);
    setExpandRuleEngine(true);
  };

  const handleCollapseAll = () => {
    setExpandTimelineControls(false);
    setExpandTransitChart(false);
    setExpandRuleEngine(false);
  };

  const [savedOverrides, setSavedOverrides] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem(`vedic_transit_override_${personId}_${selectedYear}_${selectedMonth}`);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Track staged changes during drag/move before clicking "Ingest / Inject"
  const [stagedOverrides, setStagedOverrides] = useState<Record<string, number> | null>(null);

  // Drag and drop states
  const [draggedGraha, setDraggedGraha] = useState<string | null>(null);
  const [dropTargetSign, setDropTargetSign] = useState<number | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [activePickerGraha, setActivePickerGraha] = useState<string | null>(null);

  // Sync saved overrides when year/month/native changes
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      setSavedOverrides(stored ? JSON.parse(stored) : {});
      setStagedOverrides(null);
      setSaveSuccessMsg(null);
    } catch {
      setSavedOverrides({});
      setStagedOverrides(null);
    }
  }, [storageKey]);

  // Baseline astronomical ephemeris positions
  const baseTransitPlacements = useMemo(() => {
    const grahaKeys = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
    return grahaKeys.map(k => getGrahaTransitPosition(k, activeDate, natalLagnaIdx, natalRashiIdx));
  }, [activeDate, natalLagnaIdx, natalRashiIdx]);

  // Active Effective Transit Placements: Pick up directly from Chart customizations (overrides cache)
  const activeEffectiveOverrides = stagedOverrides !== null ? stagedOverrides : savedOverrides;
  const isCustomIngested = Object.keys(savedOverrides).length > 0;
  const hasStagedChanges = stagedOverrides !== null && Object.keys(stagedOverrides).length > 0;

  // Compute Active Month Transits (Gochara) using custom chart placements if modified
  const transitPlacements = useMemo(() => {
    return baseTransitPlacements.map(tp => {
      const customSignIdx = activeEffectiveOverrides[tp.graha_key];
      if (customSignIdx && customSignIdx >= 1 && customSignIdx <= 12) {
        const signDef = SOUTH_INDIAN_SIGNS.find(s => s.index === customSignIdx) || SOUTH_INDIAN_SIGNS[0];
        const houseFromLagna = ((customSignIdx - natalLagnaIdx + 12) % 12) + 1;
        const houseFromMoon = ((customSignIdx - natalRashiIdx + 12) % 12) + 1;
        return {
          ...tp,
          transit_rashi_index: customSignIdx,
          transit_rashi_name: signDef.eng,
          transit_rashi_tamil: signDef.tamil,
          rashi_lord: signDef.lord,
          relative_to_natal_lagna: {
            house_number: houseFromLagna,
            house_title: `House ${houseFromLagna} (${signDef.eng.split(' ')[0]})`,
            description: `Transiting House ${houseFromLagna} from Natal Lagna (Custom Chart Ingested)`
          },
          relative_to_natal_rashi: {
            house_number: houseFromMoon,
            house_title: `House ${houseFromMoon} (${signDef.eng.split(' ')[0]})`,
            description: `Transiting House ${houseFromMoon} from Natal Moon (Custom Chart Ingested)`
          },
          is_custom_user_adjusted: true
        };
      }
      return tp;
    });
  }, [baseTransitPlacements, activeEffectiveOverrides, natalLagnaIdx, natalRashiIdx]);

  // Days count for active selected month
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth + 1, 0).getDate();
  }, [selectedYear, selectedMonth]);

  // Ensure selectedDay stays valid when month changes
  React.useEffect(() => {
    if (selectedDay > daysInMonth) {
      setSelectedDay(daysInMonth);
    }
  }, [daysInMonth, selectedDay]);

  // Compute all sign spans for each planet across the whole selected month
  const monthlyGrahaSpans = useMemo(() => {
    const grahaKeys = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
    const results: {
      graha_key: string;
      graha_name: string;
      graha_tamil: string;
      sign_index: number;
      sign_name: string;
      sign_tamil: string;
      start_day: number;
      end_day: number;
      is_exalted: boolean;
      is_own_sign: boolean;
      is_custom: boolean;
    }[] = [];

    for (const gKey of grahaKeys) {
      const userOverride = activeEffectiveOverrides[gKey];
      if (userOverride && userOverride >= 1 && userOverride <= 12) {
        const signDef = SOUTH_INDIAN_SIGNS.find(s => s.index === userOverride) || SOUTH_INDIAN_SIGNS[0];
        results.push({
          graha_key: gKey,
          graha_name: gKey,
          graha_tamil: baseTransitPlacements.find(p => p.graha_key === gKey)?.graha_tamil || gKey,
          sign_index: userOverride,
          sign_name: signDef.eng,
          sign_tamil: signDef.tamil,
          start_day: 1,
          end_day: daysInMonth,
          is_exalted: (gKey === 'Venus' && userOverride === 12) || (gKey === 'Sun' && userOverride === 1) || (gKey === 'Jupiter' && userOverride === 4) || (gKey === 'Saturn' && userOverride === 7) || (gKey === 'Mars' && userOverride === 10),
          is_own_sign: getLordOwnedSigns(gKey).includes(userOverride),
          is_custom: true
        });
        continue;
      }

      let currSign = -1;
      let spanStart = 1;
      let samplePos: any = null;

      for (let d = 1; d <= daysInMonth; d++) {
        const dt = new Date(Date.UTC(selectedYear, selectedMonth, d, 12, 0, 0));
        const pos = getGrahaTransitPosition(gKey, dt, natalLagnaIdx, natalRashiIdx);
        if (currSign === -1) {
          currSign = pos.transit_rashi_index;
          spanStart = d;
          samplePos = pos;
        } else if (pos.transit_rashi_index !== currSign) {
          const signDef = SOUTH_INDIAN_SIGNS.find(s => s.index === currSign) || SOUTH_INDIAN_SIGNS[0];
          results.push({
            graha_key: gKey,
            graha_name: samplePos?.graha_name || gKey,
            graha_tamil: samplePos?.graha_tamil || gKey,
            sign_index: currSign,
            sign_name: signDef.eng,
            sign_tamil: signDef.tamil,
            start_day: spanStart,
            end_day: d - 1,
            is_exalted: (gKey === 'Venus' && currSign === 12) || (gKey === 'Sun' && currSign === 1) || (gKey === 'Jupiter' && currSign === 4) || (gKey === 'Saturn' && currSign === 7) || (gKey === 'Mars' && currSign === 10),
            is_own_sign: getLordOwnedSigns(gKey).includes(currSign),
            is_custom: false
          });
          currSign = pos.transit_rashi_index;
          spanStart = d;
          samplePos = pos;
        }
      }

      if (currSign !== -1 && samplePos) {
        const signDef = SOUTH_INDIAN_SIGNS.find(s => s.index === currSign) || SOUTH_INDIAN_SIGNS[0];
        results.push({
          graha_key: gKey,
          graha_name: samplePos.graha_name,
          graha_tamil: samplePos.graha_tamil,
          sign_index: currSign,
          sign_name: signDef.eng,
          sign_tamil: signDef.tamil,
          start_day: spanStart,
          end_day: daysInMonth,
          is_exalted: (gKey === 'Venus' && currSign === 12) || (gKey === 'Sun' && currSign === 1) || (gKey === 'Jupiter' && currSign === 4) || (gKey === 'Saturn' && currSign === 7) || (gKey === 'Mars' && currSign === 10),
          is_own_sign: getLordOwnedSigns(gKey).includes(currSign),
          is_custom: false
        });
      }
    }

    return results;
  }, [selectedYear, selectedMonth, daysInMonth, activeEffectiveOverrides, baseTransitPlacements, natalLagnaIdx, natalRashiIdx]);

  // Major Ingresses & Exaltations in the selected month for high-visibility pills
  const monthlyKeyIngresses = useMemo(() => {
    return monthlyGrahaSpans.filter(span => {
      // Show planets that entered mid-month (start_day > 1) or that are exalted
      return span.start_day > 1 || span.is_exalted;
    });
  }, [monthlyGrahaSpans]);

  // Move a planet to a new house on the chart
  const handleMoveGraha = (grahaKey: string, targetSignIndex: number) => {
    const current = stagedOverrides !== null ? { ...stagedOverrides } : { ...savedOverrides };
    current[grahaKey] = targetSignIndex;
    setStagedOverrides(current);
    setSaveSuccessMsg(null);
  };

  // Ingest/Inject button action: locks the changes directly from chart and overrides cache
  const handleIngestCustomPlacements = () => {
    const toSave = stagedOverrides !== null ? stagedOverrides : savedOverrides;
    setSavedOverrides(toSave);
    setStagedOverrides(null);
    try {
      localStorage.setItem(storageKey, JSON.stringify(toSave));
    } catch (e) {
      console.warn('LocalStorage error saving custom transits:', e);
    }
    setSaveSuccessMsg('✓ Custom transit placements ingested directly from Chart! Cache overridden and all downstream analysis updated.');
    setTimeout(() => setSaveSuccessMsg(null), 7000);
  };

  // Reset to default astronomical calculation
  const handleResetCustomPlacements = () => {
    setStagedOverrides(null);
    setSavedOverrides({});
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    setSaveSuccessMsg('↺ Restored standard astronomical ephemeris positions.');
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  // Resolve Active Vimshottari Dasha Hierarchy for Selected Date dynamically
  const activeDashaHierarchy = useMemo(() => {
    return getVimshottariDashaForDate(activeDateIsoStr, activeRecord.dashaRecords, activeRecord.profile);
  }, [activeDateIsoStr, activeRecord.dashaRecords, activeRecord.profile]);

  // Houses ruled or occupied by the active PD Lord
  const pdLordOwnedSigns = useMemo(() => {
    return getLordOwnedSigns(activeDashaHierarchy.pratyantardasha);
  }, [activeDashaHierarchy.pratyantardasha]);

  // Signs aspected by the transiting PD Lord in Gochara
  const pdLordTransitAspectTargets = useMemo(() => {
    const pdShort = activeDashaHierarchy.pratyantardasha.split(' ')[0].toLowerCase();
    const pdTransit = transitPlacements.find(tp => tp.graha_key.toLowerCase().includes(pdShort));
    if (!pdTransit) return [];
    return calculateGrahaDrishti(pdTransit.transit_rashi_index, pdTransit.graha_key).map(a => a.targetSignIndex);
  }, [activeDashaHierarchy.pratyantardasha, transitPlacements]);

  // PD Micro-Focus Slider Mode (OFF = Standard All Houses, ON = Focus on PD Lord Domain)
  const [isMicroPdFocus, setIsMicroPdFocus] = useState<boolean>(false);

  // Astrological Rule Engine configuration state
  const [rules, setRules] = useState<AstroRule[]>(DEFAULT_RULES);
  const [showRuleConfig, setShowRuleConfig] = useState<boolean>(true);

  // Compute House Activation Scores across the 12 houses
  const houseActivations = useMemo(() => {
    const transitWithAspects = transitPlacements.map(tp => ({
      graha_key: tp.graha_key,
      transit_rashi_index: tp.transit_rashi_index,
      aspect_targets: calculateGrahaDrishti(tp.transit_rashi_index, tp.graha_key).map(a => a.targetSignIndex)
    }));

    const natalSimple = natalD1Placements.map(np => {
      const signMeta = SOUTH_INDIAN_SIGNS.find(s => {
        const norm = np.rashi_name.toLowerCase();
        return s.eng.toLowerCase().includes(norm) || norm.includes(s.tamil);
      });
      return {
        body_name: np.body_name,
        rashi_index: signMeta ? signMeta.index : 9
      };
    });

    return evaluateHouseActivations(rules, {
      natalLagnaIdx,
      natalRashiIdx,
      activePdLord: activeDashaHierarchy.pratyantardasha,
      activeAdLord: activeDashaHierarchy.antardasha,
      activeMdLord: activeDashaHierarchy.mahadasha,
      pdLordOwnedSigns,
      transitPlanets: transitWithAspects,
      natalPlanets: natalSimple
    });
  }, [rules, transitPlacements, natalD1Placements, activeDashaHierarchy, pdLordOwnedSigns]);

  const handleToggleRule = (ruleId: string) => {
    setRules(prev => prev.map(r => r.id === ruleId ? { ...r, isEnabled: !r.isEnabled } : r));
  };

  const handleWeightChange = (ruleId: string, newWeight: number) => {
    setRules(prev => prev.map(r => r.id === ruleId ? { ...r, weight: newWeight } : r));
  };

  const handleResetRules = () => {
    setRules(DEFAULT_RULES);
  };

  // Milestone M4: Multi-LLM Provider & Audio Voice Inspector States
  const [selectedLlmProvider, setSelectedLlmProvider] = useState<LLMProviderId>('local_qwen');
  const [inspectorHouseContext, setInspectorHouseContext] = useState<VedicHouseContext | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(false);

  // Compute Moon (Chandra) 2.25-day sign progression across the selected month
  const monthlyMoonSpans = useMemo(() => {
    return calculateMonthlyMoonSpans(selectedYear, selectedMonth, natalLagnaIdx);
  }, [selectedYear, selectedMonth, natalLagnaIdx]);

  // Compute Fast-Moving Grahas Ingress Events
  const monthlyIngressEvents = useMemo(() => {
    const events: string[] = [];
    const fastGrahas = ['Sun', 'Mercury', 'Venus', 'Mars'];
    for (const g of fastGrahas) {
      const spans = monthlyGrahaSpans.filter(s => s.graha_key === g);
      if (spans.length > 1) {
        for (let i = 1; i < spans.length; i++) {
          events.push(`${g} enters ${spans[i].sign_name.split(' ')[0]} on Day ${spans[i].start_day}`);
        }
      } else if (spans.length === 1) {
        events.push(`${g} transits continuously in ${spans[0].sign_name.split(' ')[0]} (Days 1–${daysInMonth})`);
      }
    }
    return events;
  }, [monthlyGrahaSpans, daysInMonth]);

  // Compute Rule 5: Dasha Triad Delivery Capacity Report
  const dashaDeliveryReport = useMemo(() => {
    const transitWithAspects = transitPlacements.map(tp => ({
      graha_key: tp.graha_key,
      transit_rashi_index: tp.transit_rashi_index,
      aspect_targets: calculateGrahaDrishti(tp.transit_rashi_index, tp.graha_key).map(a => a.targetSignIndex)
    }));

    const natalSimple = natalD1Placements.map(np => {
      const signMeta = SOUTH_INDIAN_SIGNS.find(s => {
        const norm = np.rashi_name.toLowerCase();
        return s.eng.toLowerCase().includes(norm) || norm.includes(s.tamil);
      });
      return {
        body_name: np.body_name,
        rashi_index: signMeta ? signMeta.index : 9
      };
    });

    return calculateDashaDeliveryFactor({
      natalLagnaIdx,
      natalRashiIdx,
      activePdLord: activeDashaHierarchy.pratyantardasha,
      activeAdLord: activeDashaHierarchy.antardasha,
      activeMdLord: activeDashaHierarchy.mahadasha,
      pdLordOwnedSigns,
      transitPlanets: transitWithAspects,
      natalPlanets: natalSimple
    });
  }, [transitPlacements, natalD1Placements, natalLagnaIdx, natalRashiIdx, activeDashaHierarchy, pdLordOwnedSigns]);

  const handleOpenHouseInspector = (signIndex: number) => {
    const signDef = SOUTH_INDIAN_SIGNS.find(s => s.index === signIndex);
    if (!signDef) return;

    const houseNum = ((signIndex - natalLagnaIdx + 12) % 12) + 1;
    const isLagnaHouse = signIndex === natalLagnaIdx;

    const natalOccupants = natalD1Placements.filter(p => {
      const norm = p.rashi_name.toLowerCase();
      const signNorm = signDef.eng.toLowerCase();
      return signNorm.includes(norm) || norm.includes(signDef.tamil);
    });

    const currentTransitsInSign = transitPlacements.filter(
      tp => tp.transit_rashi_index === signDef.index
    );

    const houseActivation = houseActivations.find(ha => ha.signIndex === signDef.index);

    // Full flattened D1 placements with house numbers and nakshatras
    const flattenedD1 = activeRecord.placements
      .filter(p => p.chart_type === 'D1')
      .map(p => {
        const signMeta = SOUTH_INDIAN_SIGNS.find(s => {
          const norm = p.rashi_name.toLowerCase();
          return s.eng.toLowerCase().includes(norm) || norm.includes(s.tamil);
        });
        const sIdx = signMeta ? signMeta.index : 9;
        const hNum = ((sIdx - natalLagnaIdx + 12) % 12) + 1;
        return {
          body_name: p.body_name,
          rashi_name: p.rashi_name,
          degree_sputa: p.degree_sputa,
          nakshatra_name: p.nakshatra_name,
          pada: p.pada,
          house_number: hNum,
          is_retrograde: p.is_retrograde
        };
      });

    // Full flattened D9 placements
    const flattenedD9 = activeRecord.placements
      .filter(p => p.chart_type === 'D9')
      .map(p => ({
        body_name: p.body_name,
        rashi_name: p.rashi_name,
        degree_sputa: p.degree_sputa
      }));

    const ctx: VedicHouseContext = {
      houseNumber: houseNum,
      rashiIndex: signIndex,
      rashiName: signDef.eng.split(' ')[0],
      tamilName: signDef.tamil,
      isLagna: isLagnaHouse,
      activationScore: houseActivation?.totalScore || 0,
      isEventActive: !!houseActivation?.isEventActive,
      matchedRules: (houseActivation?.matchedRules || []).map(r => ({
        ruleId: r.ruleId,
        ruleName: r.ruleName,
        weight: r.weight,
        reason: r.reason
      })),
      natalOccupants: natalOccupants.map(o => ({
        body_name: o.body_name,
        degree_sputa: o.degree_sputa,
        nakshatra_name: o.nakshatra_name
      })),
      transitOccupants: currentTransitsInSign.map(t => ({
        graha_key: t.graha_key,
        degree_sputa: t.degree_sputa,
        nakshatra_name: t.graha_pada_chara?.nakshatra_name,
        is_retrograde: t.is_retrograde,
        is_custom: !!(t as any).is_custom_user_adjusted
      })),
      activeDasha: activeDashaHierarchy,
      selectedMonth,
      selectedYear,
      flattenedNatalD1: flattenedD1,
      flattenedNatalD9: flattenedD9,
      monthlyMoonSpans,
      monthlyIngressEvents,
      dashaDeliveryReport
    };

    setInspectorHouseContext(ctx);
    setIsInspectorOpen(true);
  };

  const handleOpenTopEventInspector = () => {
    const sorted = [...houseActivations].sort((a, b) => b.totalScore - a.totalScore);
    const top = sorted[0];
    if (top) {
      handleOpenHouseInspector(top.signIndex);
    } else {
      handleOpenHouseInspector(natalLagnaIdx);
    }
  };

  // Timeline Navigation Handlers
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedYear(prev => prev - 1);
      setSelectedMonth(11);
    } else {
      setSelectedMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedYear(prev => prev + 1);
      setSelectedMonth(0);
    } else {
      setSelectedMonth(prev => prev + 1);
    }
  };

  const handlePrevYear = () => setSelectedYear(prev => prev - 1);
  const handleNextYear = () => setSelectedYear(prev => prev + 1);
  const handleResetToCurrent = () => {
    setSelectedYear(realNow.getFullYear());
    setSelectedMonth(realNow.getMonth());
    setSelectedDay(15);
  };

  // Determine Timeline Era badge
  const isCurrentMonth = selectedYear === realNow.getFullYear() && selectedMonth === realNow.getMonth();
  const isPast = selectedYear < realNow.getFullYear() || (selectedYear === realNow.getFullYear() && selectedMonth < realNow.getMonth());

  // Handle clicking a planet to trigger aspect raycasting
  const handlePlanetClick = (
    e: React.MouseEvent,
    planetName: string,
    signIndex: number,
    signName: string,
    layer: 'natal' | 'transit'
  ) => {
    e.stopPropagation();
    const planetId = `${layer}-${planetName}-${signIndex}`;

    if (activeRaycast && activeRaycast.id === planetId) {
      setActiveRaycast(null);
      return;
    }

    const aspects = calculateGrahaDrishti(signIndex, planetName);
    setActiveRaycast({
      id: planetId,
      name: planetName,
      sourceSignIndex: signIndex,
      sourceSignName: signName,
      layer,
      aspectTargets: aspects
    });
  };

  // Find aspect information for a given sign index
  const getAspectInfoForSign = (signIndex: number) => {
    if (!activeRaycast) return null;
    return activeRaycast.aspectTargets.find(a => a.targetSignIndex === signIndex);
  };

  // Generate Year options from 1976 (birth) to 2070
  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = 1976; y <= 2065; y++) {
      years.push(y);
    }
    return years;
  }, []);

  return (
    <div className="space-y-5" onClick={() => setActiveRaycast(null)}>
      {/* Quick Section View Controls for Monthly View (Breathing Space & Focus Mode) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/80 border border-slate-800/80 px-4 py-2.5 rounded-xl text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-slate-400 font-semibold flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span>Monthly View Sections:</span>
          </span>
          <button
            onClick={() => setExpandTimelineControls(!expandTimelineControls)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
              expandTimelineControls
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <span>1. Timeline Controls</span>
            {expandTimelineControls ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <button
            onClick={() => setExpandTransitChart(!expandTransitChart)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
              expandTransitChart
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <span>2. 4x4 Transit Chart</span>
            {expandTransitChart ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <button
            onClick={() => setExpandRuleEngine(!expandRuleEngine)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
              expandRuleEngine
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <span>3. Rule Engine &amp; Scores</span>
            {expandRuleEngine ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExpandAll}
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium transition cursor-pointer"
            title="Expand all 3 sections"
          >
            Expand All
          </button>
          <button
            onClick={handleCollapseAll}
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium transition cursor-pointer"
            title="Collapse all 3 sections"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: TIMELINE CONTROLLER & BI-DIRECTIONAL DATE SCRUBBER */}
      {/* ========================================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl transition-all">
        <div
          onClick={() => setExpandTimelineControls(!expandTimelineControls)}
          className="p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-slate-800/40 border-b border-slate-800/80 select-none"
        >
          {/* Header Title & Era Indicator */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold shadow-inner">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  1. Monthly View &amp; Timeline Controls
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                    isCurrentMonth
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : isPast
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                  }`}
                >
                  {isCurrentMonth ? '● Current Active Month' : isPast ? '⏪ Historical Backtest' : '⏩ Future Projection'}
                </span>
                {!expandTimelineControls && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    {MONTH_NAMES[selectedMonth]} {selectedDay}, {selectedYear}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-1.5">
                <span>Native: <strong className="text-amber-300">{activeProfile.person_name}</strong> ({activeProfile.person_id})</span>
                <span className="text-slate-600">&bull;</span>
                <span>Lagna: <strong className="text-amber-400">{activeProfile.birth_lagna.split(' ')[0]} (H1)</strong></span>
                <span className="text-slate-600">&bull;</span>
                <span>Moon Sign: <strong className="text-sky-300">{activeProfile.birth_rashi.split(' ')[0]}</strong></span>
                <span className="text-slate-600">&bull;</span>
                <span>Star: <strong className="text-emerald-300">{activeProfile.birth_star.split(' ')[0]}</strong></span>
              </p>
            </div>
          </div>

          {/* Menu Controls: Multi-LLM Selector, PD Micro-Focus Slider, Jump to Today & Chevron */}
          <div className="flex flex-wrap items-center gap-3" onClick={(e) => e.stopPropagation()}>
            {/* Multi-LLM Provider Selector (SRS Component 4) */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 shadow-inner">
              <Bot className="w-3.5 h-3.5 text-amber-400" />
              <select
                value={selectedLlmProvider}
                onChange={(e) => setSelectedLlmProvider(e.target.value as LLMProviderId)}
                className="bg-transparent text-[11px] font-semibold text-slate-200 focus:outline-none cursor-pointer pr-1"
                title="Select Multi-LLM Reasoning Engine Provider"
              >
                <option value="local_qwen" className="bg-slate-900 text-white">
                  🖥️ Local (Qwen 2.5 14B via Ollama)
                </option>
                <option value="gemini_pro" className="bg-slate-900 text-white">
                  ♊ Google Gemini Pro (gemini-3.1-pro)
                </option>
                <option value="claude" className="bg-slate-900 text-white">
                  🧠 Anthropic Claude (claude-3-5-sonnet)
                </option>
              </select>
            </div>

            {/* Quick Open Audio Voice Inspector Button */}
            <button
              onClick={handleOpenTopEventInspector}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/30 transition shadow-sm font-bold text-xs cursor-pointer"
              title="Open Multi-LLM Audio Voice Inspector for Top Active House"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Voice Inspector</span>
            </button>

            {/* PD Micro-Focus Mode Slider */}
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 shadow-inner">
              <div className="flex flex-col text-right">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center justify-end gap-1">
                  <Zap className={`w-3 h-3 ${isMicroPdFocus ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
                  PD Focus
                </span>
                <span className={`text-[10px] font-semibold ${isMicroPdFocus ? 'text-amber-300 font-bold' : 'text-slate-500'}`}>
                  {isMicroPdFocus ? 'Active' : 'Standard'}
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isMicroPdFocus}
                onClick={() => setIsMicroPdFocus(!isMicroPdFocus)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isMicroPdFocus ? 'bg-amber-500 shadow-lg shadow-amber-500/30' : 'bg-slate-800'
                }`}
                title="Toggle PD Micro Focus: Spotlights houses governed by the active PD Lord, while keeping other houses subtly aside"
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-slate-950 shadow-md ring-0 transition duration-200 ease-in-out ${
                    isMicroPdFocus ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {!isCurrentMonth && (
              <button
                onClick={handleResetToCurrent}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30 transition shadow-sm cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Today</span>
              </button>
            )}

            <button
              onClick={() => setExpandTimelineControls(!expandTimelineControls)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              title={expandTimelineControls ? "Minimize Section 1" : "Expand Section 1"}
            >
              {expandTimelineControls ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {expandTimelineControls && (
          <div className="p-4 sm:p-5 space-y-4">
            {/* Date Scrubber & Year/Month Selectors */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Month / Year Navigator Buttons */}
          <div className="lg:col-span-7 flex flex-wrap items-center gap-2">
            {/* -1 Year */}
            <button
              onClick={handlePrevYear}
              className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700/80 flex items-center gap-1"
              title="Previous Year (-1 Yr)"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>-1 Yr</span>
            </button>

            {/* -1 Month */}
            <button
              onClick={handlePrevMonth}
              className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700/80 flex items-center gap-1"
              title="Previous Month (-1 Mo)"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Prev</span>
            </button>

            {/* Month Dropdown */}
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {MONTH_NAMES.map((m, idx) => (
                <option key={m} value={idx}>
                  {m}
                </option>
              ))}
            </select>

            {/* Year Dropdown */}
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            {/* +1 Month */}
            <button
              onClick={handleNextMonth}
              className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700/80 flex items-center gap-1"
              title="Next Month (+1 Mo)"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* +1 Year */}
            <button
              onClick={handleNextYear}
              className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700/80 flex items-center gap-1"
              title="Next Year (+1 Yr)"
            >
              <span>+1 Yr</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Intra-Month Day Selector & Range Slider */}
            <div className="flex flex-wrap items-center gap-2 text-[11px] bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">
              <span className="text-slate-400 font-medium">Day:</span>
              <button
                type="button"
                onClick={() => setSelectedDay(prev => Math.max(1, prev - 1))}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                title="Previous Day"
              >
                &larr;
              </button>

              <input
                type="range"
                min={1}
                max={daysInMonth}
                value={selectedDay}
                onChange={e => setSelectedDay(Number(e.target.value))}
                className="w-20 sm:w-28 accent-amber-500 cursor-pointer"
                title={`Selected Day: ${selectedDay} of ${daysInMonth}`}
              />

              <span className="font-mono font-bold text-amber-300 text-xs min-w-[20px] text-center">
                {selectedDay}
              </span>

              <button
                type="button"
                onClick={() => setSelectedDay(prev => Math.min(daysInMonth, prev + 1))}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                title="Next Day"
              >
                &rarr;
              </button>

              <div className="hidden sm:flex items-center gap-1 border-l border-slate-800 pl-2">
                {[1, 10, 16, 20, 25].filter(d => d <= daysInMonth).map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDay(d)}
                    className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold transition ${
                      selectedDay === d
                        ? 'bg-amber-500 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {d}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSelectedDay(daysInMonth)}
                  className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold transition ${
                    selectedDay === daysInMonth
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  End
                </button>
              </div>
            </div>
          </div>

          {/* Real-Time Vimshottari Dasha Hierarchy Card */}
          <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col justify-between shadow-inner">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
              <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-300">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Active Dasha Period
              </span>
              <span className="font-mono text-[10px] text-amber-400/90 font-bold">
                {activeDashaHierarchy.startDate} &rarr; {activeDashaHierarchy.endDate} ({activeDashaHierarchy.totalDays}d)
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              {/* Maha Dasha */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-1.5">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Maha Dasha</span>
                <span className="text-xs font-bold text-amber-300 truncate block">
                  {activeDashaHierarchy.mahadasha.split(' ')[0]}
                </span>
              </div>

              {/* Antar Dasha */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-1.5">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Antar Dasha</span>
                <span className="text-xs font-bold text-sky-300 truncate block">
                  {activeDashaHierarchy.antardasha.split(' ')[0]}
                </span>
              </div>

              {/* Pratyantar Dasha */}
              <div className="bg-slate-900/90 border border-amber-500/50 rounded-lg p-1.5 shadow-sm shadow-amber-500/20 ring-1 ring-amber-500/30">
                <span className="text-[10px] uppercase font-bold text-amber-400 block flex items-center justify-center gap-1">
                  <Zap className="w-2.5 h-2.5 text-amber-400 animate-pulse" />
                  PD Lord
                </span>
                <span className="text-xs font-extrabold text-amber-200 truncate block">
                  {activeDashaHierarchy.pratyantardasha.split(' ')[0]}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Selected Month Key Planetary Transits Strip */}
        <div className="pt-2 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span>Gochara Coordinates ({MONTH_NAMES[selectedMonth]} {selectedDay}, {selectedYear}):</span>
            </span>
            {isCustomIngested && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                <Check className="w-2.5 h-2.5" />
                Custom Ingestion Active
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            {['Venus', 'Saturn', 'Jupiter', 'Mars', 'Rahu'].map(gKey => {
              const tp = transitPlacements.find(p => p.graha_key === gKey);
              if (!tp) return null;
              const isCustom = (tp as any).is_custom_user_adjusted;
              return (
                <span
                  key={gKey}
                  className={`px-2 py-0.5 rounded-md border flex items-center gap-1 font-mono text-[10px] ${
                    isCustom
                      ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200 ring-1 ring-emerald-500/40'
                      : 'bg-slate-950 border-slate-800 text-slate-300'
                  }`}
                >
                  <strong className={gKey === 'Venus' ? 'text-pink-300' : gKey === 'Saturn' ? 'text-indigo-400' : gKey === 'Jupiter' ? 'text-yellow-400' : 'text-rose-400'}>
                    {gKey}:
                  </strong>
                  <span>{tp.transit_rashi_tamil} ({tp.transit_rashi_name.split(' ')[0]})</span>
                  <span className="text-amber-400/90">{tp.degree_sputa ? tp.degree_sputa.split(' ')[0] : ''}</span>
                  {tp.is_retrograde && <span className="text-rose-400 font-bold">(R)</span>}
                  {isCustom && <span className="text-emerald-400 font-bold ml-0.5">[Custom]</span>}
                </span>
              );
            })}
          </div>
        </div>

        {/* Monthly Key Planetary Ingresses & Exaltations Strip */}
        {monthlyKeyIngresses.length > 0 && (
          <div className="pt-2 border-t border-slate-800/60 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5 shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>Transits &amp; Ingresses in {MONTH_NAMES[selectedMonth]} {selectedYear}:</span>
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {monthlyKeyIngresses.map((ing, idx) => {
                const isActiveNow = selectedDay >= ing.start_day && selectedDay <= ing.end_day;
                return (
                  <button
                    key={`${ing.graha_key}-${ing.sign_index}-${idx}`}
                    type="button"
                    onClick={() => setSelectedDay(ing.start_day)}
                    className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold border flex items-center gap-1.5 transition cursor-pointer ${
                      isActiveNow
                        ? 'bg-amber-400 text-slate-950 border-amber-300 ring-2 ring-amber-300 shadow-md font-extrabold'
                        : ing.is_exalted
                        ? 'bg-gradient-to-r from-amber-950/70 to-slate-900 border-amber-500/60 text-amber-300 hover:border-amber-400 hover:bg-amber-900/60 shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                    }`}
                    title={`Click to set chart date to Day ${ing.start_day} (${ing.graha_name} in ${ing.sign_name})`}
                  >
                    <span>{ing.graha_key}:</span>
                    <span>{ing.sign_tamil} ({ing.sign_name.split(' ')[0]})</span>
                    <span className="font-mono text-[9px] opacity-80">
                      {MONTH_NAMES[selectedMonth].slice(0, 3)} {ing.start_day}–{ing.end_day}
                    </span>
                    {ing.is_exalted && (
                      <span className="px-1 py-0.2 rounded bg-amber-500 text-slate-950 text-[9px] font-extrabold">
                        ★ Exalted
                      </span>
                    )}
                    {isActiveNow && <span className="text-[9px] font-extrabold">● Active</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
          </div>
        )}
      </div>

      {/* Active Graha Drishti Raycasting Status Bar */}
      {activeRaycast ? (
        <div className="bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border border-purple-500/40 rounded-xl p-3.5 text-xs flex flex-wrap items-center justify-between gap-3 shadow-lg shadow-purple-500/5 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300">
              <Sparkles className="w-4 h-4 text-purple-300 animate-pulse" />
            </span>
            <div>
              <span className="font-bold text-white text-sm">
                Graha Drishti Active: {activeRaycast.layer === 'natal' ? 'Natal' : 'Transit'} {activeRaycast.name}
              </span>
              <span className="text-slate-300 ml-2">
                in {activeRaycast.sourceSignName} &rarr; illuminating {activeRaycast.aspectTargets.length} target houses
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {activeRaycast.aspectTargets.map(tgt => {
                const sDef = SOUTH_INDIAN_SIGNS.find(s => s.index === tgt.targetSignIndex);
                const hNum = ((tgt.targetSignIndex - natalLagnaIdx + 12) % 12) + 1;
                return (
                  <span
                    key={tgt.targetSignIndex}
                    className="px-2 py-0.5 rounded bg-purple-500/20 border border-purple-400/40 text-purple-200 font-mono text-[11px]"
                  >
                    H{hNum} ({sDef?.tamil} - {tgt.aspectType})
                  </span>
                );
              })}
            </div>
            <button
              onClick={() => setActiveRaycast(null)}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Clear Drishti"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`rounded-xl px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2 border transition ${
            isMicroPdFocus
              ? 'bg-amber-950/40 border-amber-500/50 text-amber-200 shadow-md shadow-amber-500/10'
              : 'bg-slate-900/50 border-slate-800/80 text-slate-400'
          }`}
        >
          <span className="flex items-center gap-2">
            {isMicroPdFocus ? (
              <>
                <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
                <span>
                  <strong>PD Micro Focus Active:</strong> Spotlight on houses governed by{' '}
                  <strong className="text-amber-300 underline underline-offset-2">
                    {activeDashaHierarchy.pratyantardasha}
                  </strong>{' '}
                  (Rulership, Occupation &amp; Drishti). Other houses are kept aside with details intact.
                </span>
              </>
            ) : (
              <>
                <Info className="w-4 h-4 text-slate-500" />
                <span>
                  Select any planet badge (e.g. <strong>Saturn</strong>, <strong>Jupiter</strong>, or <strong>Mars</strong>) to raycast and highlight its aspected houses (Graha Drishti).
                </span>
              </>
            )}
          </span>
          <div className="flex items-center gap-2.5 text-[11px]">
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              Grey = Natal Birth (Fixed / Non-changeable)
            </span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/40 text-amber-300 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Yellow [Tr] = Gochara Transit ({MONTH_NAMES[selectedMonth]} {selectedYear})
            </span>
          </div>
        </div>
      )}

      {/* SUCCESS CONFIRMATION BANNER */}
      {saveSuccessMsg && (
        <div className="bg-emerald-500 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-200">
          <span className="flex items-center gap-2">
            <Check className="w-4 h-4 text-slate-950" />
            {saveSuccessMsg}
          </span>
          <button onClick={() => setSaveSuccessMsg(null)} className="p-1 hover:bg-emerald-600 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* UNLOCKED / STAGED CHANGES BANNER: INGESTION ACTION */}
      {hasStagedChanges && (
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 border-2 border-amber-400 rounded-xl p-3.5 sm:p-4 text-xs shadow-2xl shadow-amber-500/15 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-amber-500/20 text-amber-300">
              <Move className="w-5 h-5 text-amber-400 animate-pulse" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-white text-sm">
                  ✏️ Transit Graha Placements Adjusted ({Object.keys(stagedOverrides || {}).length} modified)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400 text-slate-950">
                  Staged &bull; Needs Ingestion
                </span>
              </div>
              <p className="text-slate-300 mt-1">
                You repositioned planets on the chart for <strong className="text-amber-300">{MONTH_NAMES[selectedMonth]} {selectedYear}</strong>. Click <strong className="text-amber-400">"Ingest / Inject to Chart"</strong> to lock these placements, update all Gocharam aspects, and override the default cache!
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleIngestCustomPlacements}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 shadow-lg shadow-amber-500/30 transition transform active:scale-95 cursor-pointer"
              title="Save & lock these custom placements to chart and override calculation cache"
            >
              <Download className="w-4 h-4" />
              <span>📥 Ingest / Inject to Chart</span>
            </button>
            <button
              onClick={() => setStagedOverrides(null)}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              title="Discard staged adjustments"
            >
              ↺ Discard
            </button>
          </div>
        </div>
      )}

      {/* SAVED CUSTOM INGESTION ACTIVE BANNER */}
      {!hasStagedChanges && isCustomIngested && (
        <div className="bg-emerald-950/40 border border-emerald-500/50 rounded-xl px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-3 text-emerald-200 shadow-md shadow-emerald-500/10">
          <span className="flex items-center gap-2 font-medium">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>✓ Custom Chart Ingestion Active:</strong> Transits for <strong className="text-emerald-300">{MONTH_NAMES[selectedMonth]} {selectedYear}</strong> are currently loaded directly from your chart customizations ({Object.keys(savedOverrides).length} planets overridden). All aspects, activations, and voice inspector use your chart.
            </span>
          </span>
          <button
            onClick={handleResetCustomPlacements}
            className="px-3 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/40 transition shrink-0"
            title="Reset this month's transit back to standard astronomical ephemeris"
          >
            ↺ Reset to Ephemeris
          </button>
        </div>
      )}

      {/* SECTION 2: COMPACT 4x4 SOUTH INDIAN D1 GRID (Single-Glance Viewport Friendly) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl transition-all">
        <div
          onClick={() => setExpandTransitChart(!expandTransitChart)}
          className="p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-slate-800/40 border-b border-slate-800 select-none"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold shadow-inner">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  2. South Indian 4x4 Transit Chart (D1 Gochara &amp; Drishti)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  {MONTH_NAMES[selectedMonth]} {selectedDay}, {selectedYear}
                </span>
                {isCustomIngested && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Custom Ingested
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Dual-layer layout: Natal positions (grey) + Real-time Gochara transits (amber). Drag planets or click for Graha Drishti aspects.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5" onClick={(e) => e.stopPropagation()}>
            {expandTransitChart && (
              <div className="hidden sm:flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  Natal
                </span>
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/40 text-amber-300">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Transit
                </span>
              </div>
            )}
            <button
              onClick={() => setExpandTransitChart(!expandTransitChart)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              title={expandTransitChart ? "Minimize Section 2" : "Expand Section 2"}
            >
              {expandTransitChart ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {expandTransitChart && (
          <div className="p-3 sm:p-4">
            <div className="grid grid-cols-4 grid-rows-4 gap-1.5 sm:gap-2 aspect-square max-w-[620px] mx-auto bg-slate-950 p-1.5 sm:p-2.5 rounded-2xl border border-slate-800 shadow-inner">
          {[0, 1, 2, 3].map(rowIdx =>
            [0, 1, 2, 3].map(colIdx => {
              // Center 2x2 hollow container
              if ((rowIdx === 1 || rowIdx === 2) && (colIdx === 1 || colIdx === 2)) {
                if (rowIdx === 1 && colIdx === 1) {
                  return (
                    <div
                      key={`center-${rowIdx}-${colIdx}`}
                      className="col-span-2 row-span-2 rounded-xl border-2 border-slate-700/70 bg-slate-900/30 p-2 sm:p-2.5 shadow-inner flex items-center justify-center"
                    >
                      <div className="w-full h-full rounded-lg border border-slate-700/50 bg-slate-950/50 shadow-inner" />
                    </div>
                  );
                }
                return null;
              }

              // Perimeter sign cell
              const signDef = SOUTH_INDIAN_SIGNS.find(s => s.r === rowIdx && s.c === colIdx);
              if (!signDef) return null;

              // Calculate relative house from birth Lagna (Dhanus = 9 => House 1)
              const houseNum = ((signDef.index - natalLagnaIdx + 12) % 12) + 1;
              const isLagnaHouse = houseNum === 1;

              // Find Natal Occupants in this sign
              const natalOccupants = natalD1Placements.filter(p => {
                const norm = p.rashi_name.toLowerCase();
                const signNorm = signDef.eng.toLowerCase();
                return signNorm.includes(norm) || norm.includes(signDef.tamil);
              });

              // Find Transit Occupants in this sign for selected day
              const currentTransitsInSign = transitPlacements.filter(
                tp => tp.transit_rashi_index === signDef.index
              );

              // Additional transits visiting this sign during the selected month (e.g. Venus in Pisces Apr 16–30 or May 1–9)
              const monthlyVisitsForSign = monthlyGrahaSpans.filter(
                span => span.sign_index === signDef.index && !currentTransitsInSign.some(t => t.graha_key === span.graha_key)
              );

              // Aspect Info for this cell if raycasting
              const aspectInfo = getAspectInfoForSign(signDef.index);
              const isAspectSource = activeRaycast?.sourceSignIndex === signDef.index;
              const isAspectedTarget = !!aspectInfo && !isAspectSource;

              // PD Lord Activation (Rulership, Natal Occupation, Transit Occupation, or Transit Drishti)
              const isPdLordRulership = pdLordOwnedSigns.includes(signDef.index);
              const pdLordShort = activeDashaHierarchy.pratyantardasha.split(' ')[0].toLowerCase();
              const isPdLordOccupied =
                natalOccupants.some(p => p.body_name.toLowerCase().includes(pdLordShort)) ||
                currentTransitsInSign.some(p => p.graha_key.toLowerCase().includes(pdLordShort));
              const isPdLordAspected = pdLordTransitAspectTargets.includes(signDef.index);
              const isPdLordFocus = isPdLordRulership || isPdLordOccupied || isPdLordAspected;

              // Event Activation Result for this house
              const houseActivation = houseActivations.find(ha => ha.signIndex === signDef.index);
              const isEventEmitting = !!houseActivation?.isEventActive;

              // PD Micro-Focus Slider States
              const isSpotlighted = isMicroPdFocus && isPdLordFocus;
              const isKeptAside = isMicroPdFocus && !isPdLordFocus && !isAspectSource && !isAspectedTarget;
              const isDropTarget = dropTargetSign === signDef.index;

              let cellStyle = 'relative rounded-xl p-1.5 sm:p-2 flex flex-col justify-between transition-all duration-300 border ';
              if (isDropTarget) {
                cellStyle += 'border-emerald-400 bg-emerald-950/70 ring-4 ring-emerald-400/80 shadow-2xl shadow-emerald-500/30 scale-[1.02] z-20';
              } else if (isKeptAside) {
                cellStyle += 'opacity-35 bg-slate-950/40 border-slate-900/60 hover:opacity-100 hover:border-slate-700 hover:bg-slate-900/80';
              } else if (isSpotlighted) {
                cellStyle += 'border-amber-400 bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-950 ring-2 ring-amber-400/90 shadow-xl shadow-amber-500/25 scale-[1.01] z-10';
              } else if (isAspectedTarget) {
                cellStyle += 'border-purple-500/80 bg-purple-950/30 ring-2 ring-purple-500/40 shadow-lg shadow-purple-500/10';
              } else if (isAspectSource) {
                cellStyle += 'border-amber-400 bg-amber-950/20 ring-2 ring-amber-400/40';
              } else if (isEventEmitting) {
                cellStyle += 'border-amber-400 bg-gradient-to-br from-amber-950/40 to-slate-900/90 ring-2 ring-amber-400/80 shadow-xl shadow-amber-500/20 animate-pulse';
              } else if (isPdLordFocus) {
                cellStyle += 'border-amber-500/70 bg-amber-950/20 ring-1 ring-amber-400/40 shadow-md shadow-amber-500/10';
              } else if (isLagnaHouse) {
                cellStyle += 'border-cyan-500/60 bg-cyan-950/25 ring-1 ring-cyan-500/30';
              } else {
                cellStyle += 'border-slate-800/90 bg-slate-900/60 hover:border-slate-700';
              }

              return (
                <div
                  key={`cell-${rowIdx}-${colIdx}`}
                  className={cellStyle}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dropTargetSign !== signDef.index) {
                      setDropTargetSign(signDef.index);
                    }
                  }}
                  onDragLeave={() => {
                    if (dropTargetSign === signDef.index) {
                      setDropTargetSign(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const graha = e.dataTransfer.getData('text/plain') || draggedGraha;
                    if (graha) {
                      handleMoveGraha(graha, signDef.index);
                    }
                    setDropTargetSign(null);
                    setDraggedGraha(null);
                  }}
                >
                  {/* CELL HEADER: Zodiac Symbol, Icon, Tamil Name & Relative House */}
                  <div className="flex items-center justify-between gap-1 leading-none pb-1 border-b border-slate-800/60">
                    <div className="flex items-center gap-1">
                      <span className="text-xs sm:text-sm select-none" title={signDef.eng}>
                        {signDef.icon}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-[10px] sm:text-[11px] font-bold text-slate-200">
                          {signDef.tamil}
                        </span>
                        <span className="text-[8px] text-slate-500 font-mono hidden sm:inline">
                          {signDef.eng.split(' ')[0]}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {isLagnaHouse && (
                        <span className="text-[8.5px] font-bold px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          Lagna
                        </span>
                      )}
                      {isSpotlighted && (
                        <span
                          className="text-[8.5px] font-extrabold px-1 py-0.2 rounded bg-amber-400 text-slate-950 shadow flex items-center gap-0.5 animate-pulse"
                          title={`PD Micro-Focus Activated:\n• ${isPdLordRulership ? 'Rulership House' : isPdLordOccupied ? 'Occupied by PD Lord' : 'Under Direct Drishti of PD Lord'}`}
                        >
                          <Zap className="w-2 h-2 text-slate-950 fill-current" />
                          PD
                        </span>
                      )}
                      {!isSpotlighted && isEventEmitting && (
                        <span
                          className="text-[8.5px] font-extrabold px-1 py-0.2 rounded bg-amber-500 text-slate-950 shadow-sm flex items-center gap-0.5"
                          title={`Life Event Emitting House (Score: ${houseActivation?.totalScore})\n${houseActivation?.matchedRules.map(r => `• ${r.ruleName}: ${r.reason}`).join('\n')}`}
                        >
                          <Sparkles className="w-2 h-2 text-slate-950" />
                          {houseActivation?.totalScore}
                        </span>
                      )}
                      {!isSpotlighted && !isEventEmitting && isPdLordFocus && (
                        <span
                          className="text-[8.5px] font-extrabold px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-0.5"
                          title={`Active PD Lord (${activeDashaHierarchy.pratyantardasha}) ${isPdLordRulership ? 'Rulership House' : 'Occupation'}`}
                        >
                          <Zap className="w-2 h-2 text-amber-400" />
                          PD
                        </span>
                      )}
                      <span
                        className={`text-[9.5px] sm:text-[10px] font-bold px-1 py-0.2 rounded ${
                          isLagnaHouse
                            ? 'bg-cyan-500 text-slate-950 font-extrabold'
                            : isAspectedTarget
                            ? 'bg-purple-500 text-white shadow-sm'
                            : isSpotlighted
                            ? 'bg-amber-400 text-slate-950 font-extrabold ring-1 ring-amber-300'
                            : isEventEmitting
                            ? 'bg-amber-400 text-slate-950 font-extrabold'
                            : isPdLordFocus
                            ? 'bg-amber-500 text-slate-950 font-bold'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                        title={`House ${houseNum} relative to Lagna (Activation Score: ${houseActivation?.totalScore || 0})`}
                      >
                        H{houseNum}
                      </span>

                      {/* Audio Voice Inspector Trigger Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenHouseInspector(signDef.index);
                        }}
                        className="p-0.5 rounded bg-slate-800/80 hover:bg-amber-400 hover:text-slate-950 text-slate-400 transition"
                        title={`Inspect House ${houseNum} (${signDef.eng.split(' ')[0]}) with ${LLM_PROVIDERS[selectedLlmProvider].name} Audio Voice`}
                      >
                        <Volume2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>

                  {/* Aspected Target Notification Badge */}
                  {isAspectedTarget && (
                    <div className="mt-0.5 px-1 py-0.2 rounded bg-purple-500/20 border border-purple-400/30 text-[8.5px] text-purple-200 font-bold flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Target className="w-2 h-2 text-purple-300" />
                        {aspectInfo?.aspectType}
                      </span>
                    </div>
                  )}

                  {/* DUAL LAYER PLANETARY BADGES */}
                  <div className="my-auto py-0.5 space-y-0.5 overflow-y-auto max-h-[85px] sm:max-h-[96px] pr-0.5">
                    {/* BASE LAYER: NATAL BIRTH PLANETS (GREYED OUT AS PERMANENT / UNCHANGEABLE, DRISHTI ENABLED) */}
                    {natalOccupants.map(natalP => {
                      const isSelected =
                        activeRaycast?.layer === 'natal' &&
                        activeRaycast?.name === natalP.body_name &&
                        activeRaycast?.sourceSignIndex === signDef.index;

                      return (
                        <button
                          key={`natal-${natalP.body_name}`}
                          onClick={e =>
                            handlePlanetClick(e, natalP.body_name, signDef.index, signDef.eng, 'natal')
                          }
                          className={`w-full text-left text-[9px] sm:text-[9.5px] font-medium px-1 py-0.2 rounded flex items-center justify-between transition group ${
                            isSelected
                              ? 'bg-slate-200 text-slate-950 font-bold ring-2 ring-slate-100 shadow-md'
                              : natalP.body_name === 'Lagna'
                              ? 'bg-slate-800 text-slate-200 border border-slate-600/90 hover:bg-slate-700 hover:text-white'
                              : 'bg-slate-800/70 text-slate-300 border border-slate-700/70 hover:bg-slate-700/60 hover:text-white hover:border-slate-500'
                          }`}
                          title={`Natal ${natalP.body_name} in ${signDef.eng} (Fixed Birth Placement - Click to raycast Graha Drishti)`}
                        >
                          <span className="flex items-center gap-1 truncate">
                            <span className="text-[10px] text-slate-400 group-hover:text-slate-200">●</span>
                            <span className="truncate">{natalP.body_name}</span>
                          </span>
                          <span className="text-[9px] opacity-75 font-mono ml-1 text-slate-400">
                            {natalP.is_retrograde && (
                              <span className="text-rose-400 mr-1" title="Retrograde">
                                (R)
                              </span>
                            )}
                            {natalP.degree_sputa ? natalP.degree_sputa.split(' ')[0] : ''}
                          </span>
                        </button>
                      );
                    })}

                    {/* OVERLAY LAYER: TRANSITING PLANETS (GOCHARA) - DRAGGABLE & CUSTOMIZABLE */}
                    {currentTransitsInSign.map(transitP => {
                      const isSelected =
                        activeRaycast?.layer === 'transit' &&
                        activeRaycast?.name === transitP.graha_key &&
                        activeRaycast?.sourceSignIndex === signDef.index;
                      const isCustom = (transitP as any).is_custom_user_adjusted;

                      return (
                        <div
                          key={`transit-${transitP.graha_key}`}
                          className="relative group"
                        >
                          <div
                            draggable={true}
                            onDragStart={(e) => {
                              e.stopPropagation();
                              e.dataTransfer.setData('text/plain', transitP.graha_key);
                              e.dataTransfer.effectAllowed = 'move';
                              setDraggedGraha(transitP.graha_key);
                            }}
                            onDragEnd={() => {
                              setDraggedGraha(null);
                              setDropTargetSign(null);
                            }}
                            onClick={e =>
                              handlePlanetClick(e, transitP.graha_key, signDef.index, signDef.eng, 'transit')
                            }
                            className={`w-full text-left text-[9px] sm:text-[9.5px] font-bold px-1 py-0.2 rounded flex items-center justify-between transition cursor-grab active:cursor-grabbing select-none ${
                              isSelected
                                ? 'bg-amber-400 text-slate-950 font-extrabold ring-2 ring-amber-300 shadow-md'
                                : isCustom
                                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/70 hover:bg-emerald-900/60 hover:border-emerald-400 shadow-sm'
                                : 'bg-amber-950/30 text-amber-300 border border-amber-500/40 hover:bg-amber-900/40 hover:border-amber-400'
                            }`}
                            title={`[Tr] Transit ${transitP.graha_name} at ${transitP.degree_sputa}\n✋ Drag & drop into any of the 12 houses to adjust, or click the move icon`}
                          >
                            <span className="flex items-center gap-1 truncate">
                              <span
                                className="cursor-grab opacity-60 group-hover:opacity-100 text-slate-400 mr-0.5"
                                title="Drag & drop to move this planet to another house"
                              >
                                <GripVertical className="w-2.5 h-2.5 inline" />
                              </span>
                              <span className={`text-[8px] px-0.5 rounded font-mono font-bold ${
                                isCustom ? 'bg-emerald-500/30 text-emerald-200' : 'bg-amber-500/25 text-amber-300'
                              }`}>
                                {isCustom ? 'C' : 'Tr'}
                              </span>
                              <span className="truncate">{transitP.graha_key}</span>
                            </span>

                            <div className="flex items-center gap-1">
                              <span className="text-[8.5px] font-mono text-amber-300/90">
                                {transitP.is_retrograde && (
                                  <span className="text-rose-400 mr-0.5" title="Retrograde (வக்ரம்)">
                                    (R)
                                  </span>
                                )}
                                {transitP.degree_sputa ? transitP.degree_sputa.split(' ')[0] : ''}
                              </span>

                              {/* Quick Move Dropdown Trigger */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActivePickerGraha(activePickerGraha === transitP.graha_key ? null : transitP.graha_key);
                                }}
                                className="p-0.5 rounded hover:bg-amber-400/20 text-slate-400 hover:text-amber-300 transition"
                                title={`Move ${transitP.graha_key} to a different sign`}
                              >
                                <Move className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>

                          {/* Quick Sign Picker Popover */}
                          {activePickerGraha === transitP.graha_key && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute left-0 top-full mt-1 z-50 bg-slate-900 border border-slate-700 rounded-lg p-2 shadow-2xl w-48 text-left space-y-1 animate-in fade-in zoom-in-95"
                            >
                              <div className="flex items-center justify-between text-[10px] font-bold text-slate-300 pb-1 border-b border-slate-800">
                                <span>Move {transitP.graha_key} to:</span>
                                <button
                                  onClick={() => setActivePickerGraha(null)}
                                  className="text-slate-500 hover:text-white"
                                >
                                  &times;
                                </button>
                              </div>
                              <div className="grid grid-cols-2 gap-1 max-h-36 overflow-y-auto">
                                {SOUTH_INDIAN_SIGNS.map(s => (
                                  <button
                                    key={s.index}
                                    type="button"
                                    onClick={() => {
                                      handleMoveGraha(transitP.graha_key, s.index);
                                      setActivePickerGraha(null);
                                    }}
                                    className={`px-1.5 py-1 text-[9px] rounded font-semibold text-left truncate transition ${
                                      s.index === signDef.index
                                        ? 'bg-amber-500 text-slate-950 font-bold'
                                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                                    }`}
                                  >
                                    {s.icon} {s.tamil}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* MONTHLY TRANSIT VISITS (E.g. Venus in Pisces Apr 16–30 or May 1–9) */}
                    {monthlyVisitsForSign.map(span => (
                      <button
                        key={`span-${span.graha_key}-${span.start_day}`}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDay(span.start_day);
                        }}
                        className={`w-full text-left text-[8.5px] sm:text-[9px] font-bold px-1 py-0.5 rounded border flex items-center justify-between transition cursor-pointer shadow-sm ${
                          span.is_exalted
                            ? 'bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/70 border-amber-500/70 text-amber-200 hover:border-amber-400 hover:bg-amber-900/60 ring-1 ring-amber-500/30'
                            : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white'
                        }`}
                        title={`Click to jump to Day ${span.start_day} to activate: ${span.graha_name} transits ${signDef.eng} from ${MONTH_NAMES[selectedMonth].slice(0, 3)} ${span.start_day} to ${span.end_day}`}
                      >
                        <span className="flex items-center gap-1 truncate">
                          <span className="text-amber-400 text-[9px]">{span.is_exalted ? '★' : '•'}</span>
                          <span className="font-extrabold text-amber-300">{span.graha_key}</span>
                          <span className="text-[8px] opacity-85 font-mono text-slate-300">
                            ({MONTH_NAMES[selectedMonth].slice(0, 3)} {span.start_day}–{span.end_day})
                          </span>
                        </span>
                        {span.is_exalted && (
                          <span className="px-1 py-0.2 rounded bg-amber-400 text-slate-950 text-[7px] font-extrabold shadow uppercase">
                            Exalted
                          </span>
                        )}
                      </button>
                    ))}

                    {/* Empty cell indicator */}
                    {natalOccupants.length === 0 && currentTransitsInSign.length === 0 && monthlyVisitsForSign.length === 0 && (
                      <div className="text-[9px] text-slate-600 italic text-center py-1">
                        No Grahas
                      </div>
                    )}
                  </div>

                  {/* CELL FOOTER: Rashi Lord */}
                  <div className="pt-0.5 border-t border-slate-800/40 flex items-center justify-between text-[8px] sm:text-[8.5px] text-slate-400">
                    <span className="truncate">Lord: {signDef.lord.split(' ')[0]}</span>
                    <span className="text-slate-500">{signDef.symbol}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 3: PERSISTED ASTROLOGICAL RULE ENGINE CONFIGURATOR (MILESTONE 3) */}
      {/* ========================================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl transition-all">
        <div
          onClick={() => setExpandRuleEngine(!expandRuleEngine)}
          className="p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-slate-800/40 border-b border-slate-800 select-none"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold shadow-inner">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  3. Astrological Rule Engine &amp; Event Emission Weights
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  Milestone 3 Live
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/30">
                  {houseActivations.filter(h => h.isEventActive).length} Active Houses
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Declarative Vedic rules scoring monthly house activation. Houses reaching score &ge; 0.55 pulse with life-event indicators.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={handleResetRules}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
              title="Reset weights and toggles to standard defaults"
            >
              Reset to Defaults
            </button>
            <button
              onClick={() => setExpandRuleEngine(!expandRuleEngine)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              title={expandRuleEngine ? "Minimize Section 3" : "Expand Section 3"}
            >
              {expandRuleEngine ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {expandRuleEngine && (
          <div className="p-4 sm:p-5 space-y-4">
            {/* Live Activated Houses Summary Pill Strip */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            <span className="font-semibold text-slate-200">
              Active Event Houses for {MONTH_NAMES[selectedMonth]} {selectedYear}:
            </span>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-950/60 border border-indigo-700/50 text-[11px] font-mono">
              <span className="text-slate-400">Rule 5 Delivery:</span>
              <span className={`font-bold ${
                dashaDeliveryReport.status === 'High Fruition'
                  ? 'text-emerald-400'
                  : dashaDeliveryReport.status === 'Moderate Manifestation'
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}>
                {(dashaDeliveryReport.overallIndex * 100).toFixed(0)}% ({dashaDeliveryReport.status})
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {houseActivations.filter(h => h.isEventActive).length > 0 ? (
              houseActivations
                .filter(h => h.isEventActive)
                .map(act => {
                  const sDef = SOUTH_INDIAN_SIGNS.find(s => s.index === act.signIndex);
                  return (
                    <span
                      key={act.signIndex}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold flex items-center gap-1.5"
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                      <span>House {act.houseNumber} ({sDef?.tamil} - {sDef?.eng.split(' ')[0]})</span>
                      <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 font-extrabold text-[10px]">
                        {act.totalScore}
                      </span>
                    </span>
                  );
                })
            ) : (
              <span className="text-slate-400 italic text-[11px]">
                No houses currently reach the &ge; 0.55 activation threshold. Increase weights below to test sensitive triggers.
              </span>
            )}
          </div>
        </div>

        {/* Expandable Rules Grid */}
        {showRuleConfig && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {rules.map(rule => (
              <div
                key={rule.id}
                className={`p-3.5 rounded-xl border transition ${
                  rule.isEnabled
                    ? 'bg-slate-950 border-slate-800'
                    : 'bg-slate-950/40 border-slate-900 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-200">{rule.name}</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] uppercase font-bold bg-slate-800 text-slate-400">
                        {rule.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      {rule.description}
                    </p>
                  </div>

                  {/* Toggle */}
                  <button
                    onClick={() => handleToggleRule(rule.id)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      rule.isEnabled ? 'bg-amber-500' : 'bg-slate-800'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-slate-950 shadow-lg ring-0 transition duration-200 ease-in-out ${
                        rule.isEnabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Weight Slider */}
                <div className="flex items-center gap-3 pt-2 border-t border-slate-800/60 text-xs">
                  <span className="text-slate-400 text-[11px]">Influence Weight:</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    disabled={!rule.isEnabled}
                    value={rule.weight}
                    onChange={e => handleWeightChange(rule.id, parseFloat(e.target.value))}
                    className="flex-1 accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <span className="font-mono text-xs font-bold text-amber-400 w-10 text-right">
                    {rule.weight.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
          </div>
        )}
      </div>

      {/* Audio Voice Inspector Modal / Drawer (Milestone M4) */}
      <AudioVoiceInspector
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        context={inspectorHouseContext}
        activeProvider={selectedLlmProvider}
        onChangeProvider={setSelectedLlmProvider}
      />
    </div>
  );
};

