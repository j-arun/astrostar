import React, { useState, useMemo } from 'react';
import {
  User,
  HeartPulse,
  Flame,
  Utensils,
  Moon,
  Sun,
  Brain,
  ShieldAlert,
  Sparkles,
  Scale,
  Stethoscope,
  Code,
  GraduationCap,
  Award,
  Clock,
  Coffee,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  RefreshCw,
  Compass,
  FileText,
  Zap,
  Info
} from 'lucide-react';
import { PersonMaster, NatalPlacement } from '../data/horoscopeData';

interface NatalAvatarStudioProps {
  activeRecord?: {
    profile?: PersonMaster;
    master?: PersonMaster;
    placements?: NatalPlacement[];
    [key: string]: any;
  };
  onSelectPerson?: (id: string) => void;
  availablePersonIds?: string[];
}

// Preset Archetypes for fast testing of how the Avatar & Karakatvas shift
interface ArchetypePreset {
  id: string;
  name: string;
  subtitle: string;
  lagna: string;
  bodyFrame: 'Vata' | 'Pitta' | 'Kapha' | 'Pitta-Vata' | 'Kapha-Pitta';
  vocation: 'Doctor' | 'Lawyer' | 'TechEngineer' | 'Commander' | 'Scholar' | 'Merchant' | 'Artist';
  auraColor: string;
  foodHabit: {
    profile: string;
    timing: string;
    craving: string;
    taste: string;
    lateNightRisk: number; // 0 to 100
    description: string;
  };
  sleepHabit: {
    chronotype: string;
    wakeTime: string;
    sleepQuality: string;
    dreaming: string;
    score: number;
    description: string;
  };
  thinkingHabit: {
    style: string;
    speed: string;
    focusScore: number;
    temperament: string;
    description: string;
  };
  healthBlueprint: {
    bloodPressureRisk: number; // 0-100
    sugarMetabolicRisk: number; // 0-100
    digestiveAgni: 'High & Fiery' | 'Balanced & Strong' | 'Sluggish' | 'Variable & Sensitive';
    jointNerveRisk: number; // 0-100
    primaryTattva: 'Agni (Fire)' | 'Vayu (Air)' | 'Jala (Water)' | 'Prithvi (Earth)';
  };
  ayurSpan: {
    classification: 'Dirghayu (75 - 90+ yrs)' | 'Madhyayu (60 - 75 yrs)' | 'Purna Dirghayu (85+ yrs)';
    vitalityScore: number;
    flameColor: string;
  };
  aiConsensus: {
    gemini: string;
    claude: string;
    openai: string;
    localQwen: string;
    convergenceRate: number;
  };
}

const ARCHETYPE_PRESETS: ArchetypePreset[] = [
  {
    id: 'CURRENT_NATIVE',
    name: 'Current Native (001ME)',
    subtitle: 'Dhanus Lagna • Anuradha Nakshatra • Saturn Dasha Pioneer',
    lagna: 'Dhanus (Sagittarius)',
    bodyFrame: 'Kapha-Pitta',
    vocation: 'Scholar',
    auraColor: 'from-amber-500 to-yellow-600',
    foodHabit: {
      profile: 'Sattvic with Occasional Late Pungent Cravings',
      timing: 'Delayed Dinner Pattern (Saturn aspect on 2nd house / Moon)',
      craving: 'Warm, savory dishes and rich aromatic curries',
      taste: 'Katu (Spicy) & Madhura (Sweet Balance)',
      lateNightRisk: 68,
      description: 'Tendency to push meal times back during deep mental concentration. Prefers piping hot food when served; suffers sluggish digestion if eating lukewarm or stale reheated items.'
    },
    sleepHabit: {
      chronotype: 'Deep Midnight Contemplator (Night Owl Hybrid)',
      wakeTime: '6:30 AM - 7:00 AM',
      sleepQuality: 'Vivid Subconscious Processing (Watery 12th influence)',
      dreaming: 'Symbolic & Abstract / Solution-Oriented',
      score: 76,
      description: 'Mind remains active right before sleep. Benefits greatly from digital disconnect 45 minutes prior to sleep.'
    },
    thinkingHabit: {
      style: 'Strategic, Long-Range & Philosophical Systemizer',
      speed: 'Deliberate & Comprehensive (Does not rush rash decisions)',
      focusScore: 89,
      temperament: 'Calm under external chaos; deep introspective resolve',
      description: 'Excels at building large-scale structures, multi-dimensional correlations, and seeing the unseen root causes.'
    },
    healthBlueprint: {
      bloodPressureRisk: 42,
      sugarMetabolicRisk: 52,
      digestiveAgni: 'Variable & Sensitive',
      jointNerveRisk: 48,
      primaryTattva: 'Agni (Fire)'
    },
    ayurSpan: {
      classification: 'Dirghayu (75 - 90+ yrs)',
      vitalityScore: 84,
      flameColor: '#10b981'
    },
    aiConsensus: {
      gemini: 'Strong natal promise for architectural synthesis, leadership in intellectual systems, and resilience in Jupiter-Saturn periods.',
      claude: 'High analytical endurance with profound philosophical depth; primary constitutional guidance advises strict solar-aligned meal timing.',
      openai: 'Executive aptitude in knowledge domains; resilient longevity blueprint with potential metabolic sensitivities in mature decades.',
      localQwen: 'Traditional wisdom synthesizer, unwavering focus on holistic systems, gifted with deep structural thinking.',
      convergenceRate: 94
    }
  }
];

export function NatalAvatarStudio({
  activeRecord,
  onSelectPerson,
  availablePersonIds
}: NatalAvatarStudioProps) {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('CURRENT_NATIVE');
  const [activeViewSection, setActiveViewSection] = useState<'avatar' | 'food' | 'sleep' | 'mind' | 'health' | 'ai'>('avatar');

  // Active archetype derived from selected preset
  const currentArchetype = useMemo(() => {
    const found = ARCHETYPE_PRESETS.find(p => p.id === selectedPresetId);
    return found || ARCHETYPE_PRESETS[0];
  }, [selectedPresetId]);

  // Vocation icon helper
  const renderVocationIcon = (vocation: string) => {
    switch (vocation) {
      case 'Doctor':
        return <Stethoscope className="w-5 h-5 text-emerald-400" />;
      case 'Lawyer':
        return <Scale className="w-5 h-5 text-purple-400" />;
      case 'TechEngineer':
        return <Code className="w-5 h-5 text-cyan-400" />;
      case 'Commander':
        return <ShieldAlert className="w-5 h-5 text-red-400" />;
      case 'Scholar':
      default:
        return <GraduationCap className="w-5 h-5 text-amber-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Archetype Switcher */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950/80 border border-slate-800 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
        {/* Subtle Background Glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/30">
                PROTOTYPE SHOWCASE
              </span>
              <span className="text-xs text-slate-400 font-medium">
                Vedic Natal Avatar & Karakatva Visualizer
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
              <span>{currentArchetype.name}</span>
              <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-800/80 text-amber-400 border border-amber-500/20 font-mono">
                {currentArchetype.vocation} Archetype
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              {currentArchetype.subtitle} • Visual representation of life promises, dietary tendencies, chronotype, and constitutional energetic blueprint directly from natal data.
            </p>
          </div>

          {/* Active Native Badge (Only Current Native archetype) */}
          <div className="flex items-center gap-2.5 bg-slate-950/90 px-4 py-2.5 rounded-xl border border-amber-500/40 shadow-inner">
            <GraduationCap className="w-5 h-5 text-amber-400" />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Active Native Archetype</span>
              <span className="text-xs font-bold text-amber-300">Current Native (001ME) • Dhanus Lagna</span>
            </div>
          </div>
        </div>

        {/* Essential Astrological Disclaimer (Prominently styled to give clarity and peace of mind) */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-start gap-3 bg-amber-500/5 -mx-5 -mb-5 px-5 py-3 border-b-0">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-200/90 leading-relaxed">
            <strong className="text-amber-300 font-semibold uppercase tracking-wide">
              Astrological Blueprint & Energetic Tendencies Notice:
            </strong>{' '}
            These indications reflect classical Jyotish planetary affinities (*Doshas* & *Karakatvas*). They are{' '}
            <strong>philosophical and astrological projections, not laboratory or clinical diagnoses</strong>.
            Astrological tendencies indicate subtle energetic potentials that <em>may or may not physically manifest</em> depending upon individual diet, lifestyle choices, medical guidance, and proactive free will (*Kriyaman Karma*).
          </p>
        </div>
      </div>

      {/* Main Grid: Avatar Canvas on Left + Deep Karakatva Cards on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: The Visual Native Avatar (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden flex flex-col items-center">
            {/* Visual Header */}
            <div className="w-full flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  The Natal Avatar (Digital Twin)
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Frame: {currentArchetype.bodyFrame}
              </span>
            </div>

            {/* Stylized SVG Avatar Representation */}
            <div className="relative w-64 h-72 sm:w-72 sm:h-80 flex items-center justify-center my-2">
              {/* Animated Aura Glow */}
              <div
                className={`absolute inset-4 rounded-full bg-gradient-to-tr ${currentArchetype.auraColor} opacity-20 blur-2xl animate-pulse`}
              ></div>

              {/* Cosmic Constellation Backdrop Rings */}
              <svg
                viewBox="0 0 300 340"
                className="w-full h-full relative z-10 drop-shadow-2xl"
              >
                <defs>
                  {/* Aura Linear Gradient */}
                  <linearGradient id="auraGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.3" />
                  </linearGradient>
                  {/* Body Gradient */}
                  <linearGradient id="bodySkinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#fde047" />
                    <stop offset="50%" stopColor="#eab308" />
                    <stop offset="100%" stopColor="#ca8a04" />
                  </linearGradient>
                  {/* Robe/Vocation Gradient */}
                  <linearGradient id="robeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#1e293b" />
                    <stop offset="100%" stopColor="#0f172a" />
                  </linearGradient>
                </defs>

                {/* Celestial Zodiac Ring */}
                <circle
                  cx="150"
                  cy="170"
                  r="135"
                  fill="none"
                  stroke="#334155"
                  strokeWidth="1.5"
                  strokeDasharray="4 6"
                />
                <circle
                  cx="150"
                  cy="170"
                  r="115"
                  fill="#090d16"
                  stroke="#1e293b"
                  strokeWidth="2"
                />

                {/* Subtle Geometric Sacred Yantra Lines */}
                <polygon
                  points="150,60 235,210 65,210"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeOpacity="0.08"
                  strokeWidth="1.5"
                />
                <polygon
                  points="150,260 235,110 65,110"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeOpacity="0.08"
                  strokeWidth="1.5"
                />

                {/* --- AVATAR FIGURE --- */}
                {/* 1. Aura Radiance Halo */}
                <circle
                  cx="150"
                  cy="125"
                  r="52"
                  fill="url(#auraGrad)"
                  opacity="0.25"
                />

                {/* 2. Torso / Shoulders based on Body Frame */}
                {currentArchetype.bodyFrame.includes('Kapha') ? (
                  // Broad, Sturdy Shoulders (Kapha)
                  <path
                    d="M90 270 C90 200 115 175 150 175 C185 175 210 200 210 270 Z"
                    fill="url(#robeGrad)"
                    stroke="#475569"
                    strokeWidth="2"
                  />
                ) : currentArchetype.bodyFrame === 'Vata' ? (
                  // Slender, Lean Frame (Vata)
                  <path
                    d="M108 270 C108 210 125 185 150 185 C175 185 192 210 192 270 Z"
                    fill="url(#robeGrad)"
                    stroke="#475569"
                    strokeWidth="2"
                  />
                ) : (
                  // Medium / Athletic Shoulders (Pitta)
                  <path
                    d="M98 270 C98 205 120 180 150 180 C180 180 202 205 202 270 Z"
                    fill="url(#robeGrad)"
                    stroke="#475569"
                    strokeWidth="2"
                  />
                )}

                {/* 3. Neck & Face */}
                <rect x="141" y="152" width="18" height="26" rx="4" fill="#d97706" />
                {/* Head Oval */}
                <ellipse cx="150" cy="125" rx="32" ry="40" fill="#f59e0b" />

                {/* Third Eye (Ajna Chakra / Tilak) */}
                <line x1="150" y1="98" x2="150" y2="114" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="150" cy="116" r="2.5" fill="#facc15" />

                {/* Peaceful Contemplative Eyes */}
                <path d="M136 126 Q142 130 146 126" stroke="#451a03" strokeWidth="2" fill="none" strokeLinecap="round" />
                <path d="M154 126 Q158 130 164 126" stroke="#451a03" strokeWidth="2" fill="none" strokeLinecap="round" />

                {/* Serene Smile */}
                <path d="M144 145 Q150 149 156 145" stroke="#78350f" strokeWidth="2" fill="none" strokeLinecap="round" />

                {/* 4. Vocation Accoutrements & Symbols */}
                {currentArchetype.vocation === 'Doctor' && (
                  <g transform="translate(132, 195) scale(0.9)">
                    {/* Stethoscope around neck */}
                    <path
                      d="M2 5 C2 28 38 28 38 5"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                    <circle cx="20" cy="29" r="6" fill="#047857" stroke="#34d399" strokeWidth="2" />
                  </g>
                )}

                {currentArchetype.vocation === 'Lawyer' && (
                  <g transform="translate(135, 190) scale(0.9)">
                    {/* White Barrister Bands Collar */}
                    <rect x="7" y="2" width="7" height="20" fill="#f8fafc" rx="1" />
                    <rect x="18" y="2" width="7" height="20" fill="#f8fafc" rx="1" />
                    {/* Scales of Justice Icon */}
                    <line x1="16" y1="26" x2="16" y2="38" stroke="#a855f7" strokeWidth="2" />
                    <line x1="8" y1="28" x2="24" y2="28" stroke="#a855f7" strokeWidth="2" />
                  </g>
                )}

                {currentArchetype.vocation === 'TechEngineer' && (
                  <g transform="translate(130, 205) scale(0.9)">
                    {/* Cyber Digital Hologram Badge */}
                    <rect x="0" y="0" width="44" height="24" rx="4" fill="#083344" stroke="#06b6d4" strokeWidth="1.5" />
                    <text x="7" y="16" fill="#22d3ee" fontSize="11" fontFamily="monospace" fontWeight="bold">
                      &lt;/&gt; IO
                    </text>
                  </g>
                )}

                {currentArchetype.vocation === 'Commander' && (
                  <g transform="translate(132, 195) scale(0.9)">
                    {/* Defense Officer Gorget / Star Medallion */}
                    <path d="M20 2 L26 14 L39 16 L29 25 L32 38 L20 31 L8 38 L11 25 L1 16 L14 14 Z" fill="#dc2626" stroke="#fef08a" strokeWidth="1.5" />
                  </g>
                )}

                {currentArchetype.vocation === 'Scholar' && (
                  <g transform="translate(134, 195) scale(0.9)">
                    {/* Vedic Sacred Rudraksha Beads / Wisdom Scroll */}
                    <circle cx="10" cy="8" r="3.5" fill="#d97706" />
                    <circle cx="18" cy="14" r="3.5" fill="#d97706" />
                    <circle cx="26" cy="8" r="3.5" fill="#d97706" />
                    <rect x="7" y="24" width="22" height="12" rx="2" fill="#fde68a" stroke="#b45309" strokeWidth="1.5" />
                    <line x1="10" y1="28" x2="26" y2="28" stroke="#78350f" strokeWidth="1" />
                    <line x1="10" y1="32" x2="22" y2="32" stroke="#78350f" strokeWidth="1" />
                  </g>
                )}
              </svg>
            </div>

            {/* Avatar Vital Metrics Badges */}
            <div className="w-full grid grid-cols-3 gap-2 mt-2 pt-3 border-t border-slate-800 text-center">
              <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-semibold">Tattva</span>
                <span className="text-xs font-bold text-amber-300">
                  {currentArchetype.healthBlueprint.primaryTattva.split(' ')[0]}
                </span>
              </div>
              <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-semibold">Presence</span>
                <span className="text-xs font-bold text-emerald-400">
                  {currentArchetype.thinkingHabit.focusScore}% Sharp
                </span>
              </div>
              <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-semibold">Vocation</span>
                <span className="text-xs font-bold text-cyan-300">
                  {currentArchetype.vocation}
                </span>
              </div>
            </div>

            {/* Ayur Rekha (Longevity & Vitality Flame) */}
            <div className="w-full mt-4 bg-gradient-to-r from-slate-950 to-slate-900 border border-emerald-500/30 p-3 rounded-xl shadow-inner">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold text-white">
                    Ayur Rekha (Life Vitality Promise)
                  </span>
                </div>
                <span className="text-[11px] font-mono font-bold text-emerald-300">
                  {currentArchetype.ayurSpan.classification}
                </span>
              </div>

              {/* Glowing Vitality Bar */}
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-700">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-green-300 shadow-lg shadow-emerald-500/50 transition-all duration-700"
                  style={{ width: `${currentArchetype.ayurSpan.vitalityScore}%` }}
                ></div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                <span>Alpayu (0-32)</span>
                <span>Madhyayu (33-65)</span>
                <span className="text-emerald-400 font-semibold">Dirghayu (66-90+)</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Karakatva Modules (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Karakatva Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {[
              { id: 'avatar', label: 'Overview', icon: User },
              { id: 'food', label: 'Food & Eating (2nd H)', icon: Utensils },
              { id: 'sleep', label: 'Sleep & Night (12th H)', icon: Moon },
              { id: 'mind', label: 'Thinking & Mind (5th H)', icon: Brain },
              { id: 'health', label: 'Health Sensitivities', icon: HeartPulse },
              { id: 'ai', label: 'Multi-AI Natal Consensus', icon: Sparkles },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeViewSection === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveViewSection(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                      : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* VIEW: OVERVIEW */}
          {activeViewSection === 'avatar' && (
            <div className="space-y-4">
              {/* Core Visual Summary Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>Natal Promise Blueprint at a Glance</span>
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Astrological karakatvas extract the underlying archetype directly from planetary geometry:
                  the 1st house governs constitutional presence and bodily frame; the 2nd house reveals food eating habits,
                  speech, and oral cravings; the 5th house dictates mental agility and focus capacity; the 10th house points
                  to the vocational regalia; and the 12th house governs the subconscious sleep cycle.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                  <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                    <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5 mb-1">
                      <Utensils className="w-3.5 h-3.5" /> Food Temperament
                    </span>
                    <p className="text-xs text-slate-200 font-medium">
                      {currentArchetype.foodHabit.profile}
                    </p>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      Taste: {currentArchetype.foodHabit.taste}
                    </span>
                  </div>

                  <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                    <span className="text-[11px] font-bold text-cyan-400 flex items-center gap-1.5 mb-1">
                      <Brain className="w-3.5 h-3.5" /> Cognitive Flow
                    </span>
                    <p className="text-xs text-slate-200 font-medium">
                      {currentArchetype.thinkingHabit.style}
                    </p>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      Processing: {currentArchetype.thinkingHabit.speed}
                    </span>
                  </div>

                  <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                    <span className="text-[11px] font-bold text-indigo-400 flex items-center gap-1.5 mb-1">
                      <Moon className="w-3.5 h-3.5" /> Sleep Architecture
                    </span>
                    <p className="text-xs text-slate-200 font-medium">
                      {currentArchetype.sleepHabit.chronotype}
                    </p>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      Wake Time: {currentArchetype.sleepHabit.wakeTime}
                    </span>
                  </div>

                  <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                    <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5 mb-1">
                      <HeartPulse className="w-3.5 h-3.5" /> Energetic Balance
                    </span>
                    <p className="text-xs text-slate-200 font-medium">
                      {currentArchetype.healthBlueprint.digestiveAgni} Agni
                    </p>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      Dominant: {currentArchetype.healthBlueprint.primaryTattva}
                    </span>
                  </div>
                </div>
              </div>

              {/* Multi-AI Quick Verdict Banner */}
              <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-300 font-semibold block">
                    Multi-AI Consensus Engine
                  </span>
                  <p className="text-xs text-white font-medium mt-0.5">
                    Gemini, Claude, OpenAI & Qwen agree with <strong>{currentArchetype.aiConsensus.convergenceRate}% convergence</strong> on this natal destiny.
                  </p>
                </div>
                <button
                  onClick={() => setActiveViewSection('ai')}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition shrink-0 cursor-pointer shadow"
                >
                  Inspect Consensus
                </button>
              </div>
            </div>
          )}

          {/* VIEW: FOOD & EATING HABITS (2ND HOUSE KARAKATVA) */}
          {activeViewSection === 'food' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Utensils className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Food & Eating Habits (2nd House & Moon Karakatwa)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Classical Jyotish patterns of appetite, meal timing, and taste preferences.
                    </p>
                  </div>
                </div>
              </div>

              {/* Late-Night Eating Tendency Gauge */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-400" />
                    Late-Night Dinner Predisposition
                  </span>
                  <span
                    className={`text-xs font-mono font-bold ${
                      currentArchetype.foodHabit.lateNightRisk > 60
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {currentArchetype.foodHabit.lateNightRisk > 60
                      ? 'High (Night Eater)'
                      : 'Low (Solar Aligned)'}
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      currentArchetype.foodHabit.lateNightRisk > 60
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${currentArchetype.foodHabit.lateNightRisk}%` }}
                  ></div>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  {currentArchetype.foodHabit.timing}
                </p>
              </div>

              {/* Detailed Food Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    Cuisine Preference
                  </span>
                  <p className="text-xs font-bold text-amber-300 mt-0.5">
                    {currentArchetype.foodHabit.profile}
                  </p>
                </div>
                <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    Taste Spectrum (Rasa)
                  </span>
                  <p className="text-xs font-bold text-emerald-300 mt-0.5">
                    {currentArchetype.foodHabit.taste}
                  </p>
                </div>
              </div>

              <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                <span className="text-xs font-bold text-white block mb-1">
                  Astrological Insight on Digestion & Food Habits:
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {currentArchetype.foodHabit.description}
                </p>
              </div>
            </div>
          )}

          {/* VIEW: SLEEPING & CHRONOTYPE (12TH HOUSE KARAKATVA) */}
          {activeViewSection === 'sleep' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <Moon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Sleep Architecture & Subconscious (12th House Karakatwa)
                    </h3>
                    <p className="text-xs text-slate-400">
                      *Sayana Sukha* (comfort of the bed), dreams, and nocturnal recovery.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block font-semibold">Chronotype</span>
                  <span className="text-xs font-bold text-indigo-300 mt-1 block">
                    {currentArchetype.sleepHabit.chronotype.split('(')[0]}
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block font-semibold">Wake Schedule</span>
                  <span className="text-xs font-bold text-amber-300 mt-1 block">
                    {currentArchetype.sleepHabit.wakeTime}
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block font-semibold">Recharge Score</span>
                  <span className="text-xs font-bold text-emerald-400 mt-1 block">
                    {currentArchetype.sleepHabit.score}/100 Restorative
                  </span>
                </div>
              </div>

              <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-white block">
                  Dream Space & Subconscious Realm:
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {currentArchetype.sleepHabit.description}
                </p>
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Dream Quality:</span>
                  <span className="font-semibold text-indigo-300">
                    {currentArchetype.sleepHabit.dreaming}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: THINKING CAPACITY & MIND (5TH HOUSE KARAKATVA) */}
          {activeViewSection === 'mind' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    <Brain className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Thinking Capacity & Cognitive Presence (5th & 1st House)
                    </h3>
                    <p className="text-xs text-slate-400">
                      *Buddhi* (intellect), analytical depth, and reaction velocity.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-cyan-400" /> Cognitive Focus Index
                  </span>
                  <span className="text-xs font-mono font-bold text-cyan-300">
                    {currentArchetype.thinkingHabit.focusScore}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                    style={{ width: `${currentArchetype.thinkingHabit.focusScore}%` }}
                  ></div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    Reasoning Methodology
                  </span>
                  <p className="text-xs font-bold text-white mt-0.5">
                    {currentArchetype.thinkingHabit.style}
                  </p>
                </div>
                <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    Processing Speed
                  </span>
                  <p className="text-xs font-bold text-cyan-300 mt-0.5">
                    {currentArchetype.thinkingHabit.speed}
                  </p>
                </div>
              </div>

              <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                <span className="text-xs font-bold text-white block mb-1">
                  Temperament & Problem-Solving Approach:
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {currentArchetype.thinkingHabit.description}
                </p>
              </div>
            </div>
          )}

          {/* VIEW: HEALTH SENSITIVITIES & CONSTITUTION (6TH/8TH HOUSE KARAKATVA) */}
          {activeViewSection === 'health' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
                    <HeartPulse className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Constitutional Health & Energetic Tendencies
                    </h3>
                    <p className="text-xs text-slate-400">
                      Subtle Jyotish dosha tendencies (Agni, Vata, Pitta, Kapha balance).
                    </p>
                  </div>
                </div>
              </div>

              {/* Dedicated Medical Astrology Disclaimer */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-[11px] text-amber-200 leading-relaxed">
                  <strong className="text-amber-300 font-semibold">Important Astrological Context:</strong>{' '}
                  These constitutional sensitivity scores represent <em>energetic propensities</em> derived from planetary rulerships.
                  They are <strong>not clinical laboratory diagnoses</strong>. They may or may not manifest in real life.
                  Lifestyle, clean diet, stress management, and modern preventive care actively shape your daily vitality.
                </div>
              </div>

              {/* Specific Tendencies Gauges */}
              <div className="space-y-3">
                {/* 1. Blood Pressure / Cardio Agni */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-200">
                      Cardio & Blood Pressure Tendency (Sun/Mars/Agni)
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-300">
                      {currentArchetype.healthBlueprint.bloodPressureRisk}% Tendency
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        currentArchetype.healthBlueprint.bloodPressureRisk > 55
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${currentArchetype.healthBlueprint.bloodPressureRisk}%` }}
                    ></div>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    {currentArchetype.healthBlueprint.bloodPressureRisk > 55
                      ? 'Mindfulness advised during high-pressure cycles; prioritize cardiovascular relaxation.'
                      : 'Robust cardiovascular baseline with steady rhythmic resilience.'}
                  </span>
                </div>

                {/* 2. Sugar / Metabolic Balance */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-200">
                      Glucose & Metabolic Sensitivity (Jupiter/Venus/Kapha)
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-300">
                      {currentArchetype.healthBlueprint.sugarMetabolicRisk}% Tendency
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        currentArchetype.healthBlueprint.sugarMetabolicRisk > 50
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${currentArchetype.healthBlueprint.sugarMetabolicRisk}%` }}
                    ></div>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    {currentArchetype.healthBlueprint.sugarMetabolicRisk > 50
                      ? 'Tendency to retain refined sugars; benefit from low-glycemic satvic grains and bitter herbs.'
                      : 'Efficient metabolic conversion; low natural affinity for sluggish sugar accumulation.'}
                  </span>
                </div>

                {/* 3. Digestive Fire (Jatharagni) */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">
                      Digestive Fire (*Jatharagni*)
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Rate of digestive conversion and food assimilation.
                    </span>
                  </div>
                  <span className="px-3 py-1 rounded-lg bg-slate-900 border border-amber-500/30 text-amber-300 font-bold text-xs">
                    {currentArchetype.healthBlueprint.digestiveAgni}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: MULTI-AI NATAL CONSENSUS ENGINE */}
          {activeViewSection === 'ai' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Multi-AI Reasoning Engine Consensus
                    </h3>
                    <p className="text-xs text-slate-400">
                      Cross-model evaluation of the native's destiny from Gemini, Claude, OpenAI & Local Qwen.
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-mono font-bold">
                  {currentArchetype.aiConsensus.convergenceRate}% Convergence
                </span>
              </div>

              {/* Model Cards */}
              <div className="space-y-3">
                {/* Google Gemini */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                      Google Gemini 2.5 Flash
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">Synthesizer</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {currentArchetype.aiConsensus.gemini}
                  </p>
                </div>

                {/* Anthropic Claude */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                      Anthropic Claude 3.5 Sonnet
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">Structural Reasoner</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {currentArchetype.aiConsensus.claude}
                  </p>
                </div>

                {/* OpenAI GPT-4o */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      OpenAI GPT-4o
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">Pragmatic Strategist</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {currentArchetype.aiConsensus.openai}
                  </p>
                </div>

                {/* Local Qwen */}
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                      Local Qwen 7B (Ollama / Local LLM)
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">Classical Jyotish Rulebook</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {currentArchetype.aiConsensus.localQwen}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
