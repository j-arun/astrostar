/**
 * Types & Interfaces for Astro Engine Multi-LLM Reasoning System (Milestone M4)
 */
import { GEMINI_PRIMARY_MODEL } from './geminiModels';
import type { VedicWindowAnalysis } from '../vedicEventsEngine';

export type LLMProviderId = 'local_qwen' | 'gemini_pro' | 'claude_sonnet' | 'claude_haiku' | 'claude_fable' | 'claude';

export type AstroPromptVersion = 'v1' | 'v2' | 'v3';

export type OriginalSourceDomain = 'master' | 'career' | 'finance' | 'love' | 'family';

export interface PromptVersionDefinition {
  id: AstroPromptVersion;
  name: string;
  shortTitle: string;
  badge: string;
  status: 'active' | 'deprecated';
  isDefault: boolean;
  refinementRemark: string;
  astrologicalStance: string;
  transitReferenceFrame: string;
  keyPrinciples: string[];
}

export interface LLMProviderConfig {
  id: LLMProviderId;
  name: string;
  badgeLabel: string;
  model: string;
  description: string;
  endpoint?: string;
}

export const LLM_PROVIDERS: Record<LLMProviderId, LLMProviderConfig> = {
  local_qwen: {
    id: 'local_qwen',
    name: 'Local Vedic Qwen 2.5 14B (Ollama)',
    badgeLabel: '🖥️ Local 14B (Vedic Qwen 2.5)',
    model: 'hf.co/gnanasreekar/vedic-qwen2.5-14b-GGUF:Q4_K_M',
    description: 'Local on-premise execution via Ollama (port 11434) using Vedic Qwen 2.5 14B Q4_K_M with full unified prompt execution.',
    endpoint: 'http://localhost:11434/api/generate'
  },
  gemini_pro: {
    id: 'gemini_pro',
    name: 'Google Gemini Pro',
    badgeLabel: `♊ Google Gemini (${GEMINI_PRIMARY_MODEL})`,
    model: GEMINI_PRIMARY_MODEL,
    description: 'Google DeepMind flagship multimodal reasoning model with deep Vedic synthesis capabilities.',
    endpoint: '/api/llm/gemini'
  },
  claude_sonnet: {
    id: 'claude_sonnet',
    name: 'Anthropic Claude Sonnet 5.5',
    badgeLabel: '🧠 Claude Sonnet 5.5 (Anthropic)',
    model: 'claude-sonnet-5-5',
    description: 'Anthropic flagship reasoning model for nuanced astrological timing breakdowns and precision analysis.',
    endpoint: '/api/llm/claude'
  },
  claude_haiku: {
    id: 'claude_haiku',
    name: 'Anthropic Claude Haiku 5.5',
    badgeLabel: '📜 Claude Haiku 5.5 (Anthropic)',
    model: 'claude-haiku-5-5',
    description: 'Anthropic high-speed narrative model for lyrical, mythic, and expressive Vedic storytelling.',
    endpoint: '/api/llm/claude'
  },
  claude_fable: {
    id: 'claude_fable',
    name: 'Claude Fable 5.1',
    badgeLabel: '📜 Claude Fable 5.1',
    model: 'claude-fable-5-1',
    description: 'Claude Fable 5.1 cloud reasoning through the private Claude proxy.',
    endpoint: '/api/llm/claude'
  },
  claude: {
    id: 'claude',
    name: 'Anthropic Claude Sonnet 5.5',
    badgeLabel: '🧠 Claude Sonnet 5.5 (Anthropic)',
    model: 'claude-sonnet-5-5',
    description: 'Anthropic state-of-the-art reasoning model for nuanced astrological timing breakdowns.',
    endpoint: '/api/llm/claude'
  }
};

export type GatePerspective = 'lagna' | 'rashi' | 'combined';

export interface SupersetGateGrahaDetail {
  name: string;
  key: string;
  type: 'transit_current' | 'monthly_passage' | 'natal';
  passageWindow?: string;
  isExalted?: boolean;
}

export interface SupersetNakshatraGateSummary {
  gateIndex: number;
  nakshatraName: string;
  rashiIndex: number;
  rashiName: string;
  houseFromLagna: number;
  houseFromRashi: number;
  perspective: GatePerspective;
  anatomicalSeat: string;
  significations: string;
  moonIngressWindow?: string;
  activeGrahasInGate: SupersetGateGrahaDetail[];
}

export interface HouseLordshipToGateLink {
  houseFromLagna: number;
  houseFromMoon: number;
  rashiName: string;
  rashiLord: string;
  portfolioLabel: string;
  natalOccupants: string[];
  transitOccupants: string[];
  isActivatedByAdLordship: boolean;
  isActivatedByDeliveringHandGate: boolean;
  matchingGateNakshatra?: string;
  moonIgnitionDates?: string;
}

export interface CorrelatedManufacturedEvent {
  id: string;
  title: string;
  portfolio: string;
  probabilityScore: number;
  isHighProbability: boolean;
  latencyStatus: 'acute_moon_triggered' | 'dormant_latent';
  hasMoonSupport: boolean;
  moonWindowDates?: string;
  correlatedHousesAndLordships: string;
  nakshatraGateTrigger: string;
  narrative: string;
  source?: 'live_event_engine_llm' | 'deterministic_gate_candidate' | 'superset_major_llm';
}

export interface EventManufacturingSupersetPayload {
  generatedAt: string;
  selectedMd: string;
  selectedAd: string;
  deliveringHandKey: string;
  deliveringHandClean: string;
  adChamberSummary: {
    adCleanName: string;
    adNatalRashiName: string;
    adNatalHouseFromLagna: number;
    adNatalHouseFromRashi: number;
    polarityLabel: string;
    netScore: number;
    peakVentingGate: string;
    atmosphereNarrative: string;
    directOccupants: string[];
    incomingAspects: string[];
    ruledHouses: Array<{
      houseFromLagna: number;
      houseFromRashi: number;
      rashiName: string;
      occupants: string[];
      aspectingGrahas: string[];
    }>;
  };
  gates: SupersetNakshatraGateSummary[];
  houseLordshipToGateLinks: HouseLordshipToGateLink[];
  candidateOrSynthesizedEvents: CorrelatedManufacturedEvent[];
  usedLiveEventEngineEvents: boolean;
  eventEngineModelUsed?: string;
}

export interface VedicHouseContext {
  houseNumber?: number;
  rashiIndex?: number;
  rashiName?: string;
  tamilName?: string;
  isLagna?: boolean;
  activationScore?: number;
  isEventActive?: boolean;
  matchedRules: Array<{
    ruleId: string;
    ruleName: string;
    weight: number;
    reason: string;
  }>;
  natalOccupants: Array<{
    body_name: string;
    degree_sputa?: string;
    nakshatra_name?: string;
  }>;
  transitOccupants: Array<{
    graha_key: string;
    degree_sputa?: string;
    nakshatra_name?: string;
    pada?: number;
    is_retrograde?: boolean;
    is_custom?: boolean;
  }>;
  allTransitPlacements?: Array<{
    graha_key: string;
    graha_name?: string;
    graha_tamil?: string;
    transit_rashi_index: number;
    transit_rashi_name: string;
    house_from_lagna: number;
    house_from_moon: number;
    house_from_moon_title?: string;
    degree_sputa: string;
    degree_in_sign_float?: number;
    nakshatra_name: string;
    nakshatra_lord?: string;
    pada: number;
    is_retrograde: boolean;
    motion_type?: 'Normal' | 'Vakra' | 'Adisara';
    motion_description?: string;
    sav_points?: number;
    bav_points?: number;
    is_custom?: boolean;
    aspects_target_house?: boolean;
    aspect_type?: string;
  }>;
  natalLagnaSignName?: string;
  natalMoonSignName?: string;
  activeDasha: {
    mahadasha: string;
    antardasha: string;
    pratyantardasha: string;
    startDate: string;
    endDate: string;
    mdStartDate?: string;
    mdEndDate?: string;
    adStartDate?: string;
    adEndDate?: string;
  };
  selectedMonth: number; // 0..11
  selectedYear: number;
  userQuery?: string;
  selectedLocalModel?: string;
  selectedLmStudioModel?: string;
  lmStudioEndpoint?: string;
  customPromptOverride?: string;
  promptVersion?: AstroPromptVersion;
  enableTimeout?: boolean; // false = Full Throttle / No Timeout (default), true = enforce timeout limit
  timeoutSeconds?: number; // Configured timeout in seconds when enableTimeout is true (e.g. 180, 300)
  flattenedNatalD1?: Array<{
    body_name: string;
    rashi_name: string;
    degree_sputa?: string;
    nakshatra_name?: string;
    pada?: number;
    house_number?: number;
    is_retrograde?: boolean;
  }>;
  flattenedNatalD9?: Array<{
    body_name: string;
    rashi_name: string;
    degree_sputa?: string;
    house_number?: number;
    is_retrograde?: boolean;
  }>;
  monthlyMoonSpans?: Array<{
    startDay: number;
    endDay: number;
    signIndex: number;
    signName: string;
    signTamil: string;
    houseNumber: number;
    label: string;
  }>;
  monthlyIngressEvents?: Array<string>;
  isComprehensiveMonthly?: boolean;
  activeDomainFilter?: 'all' | 'career' | 'finance' | 'love' | 'health' | 'family';
  dashaDeliveryReport?: {
    overallIndex: number;
    status: string;
    mdScore: number;
    mdDignity: string;
    adScore: number;
    adDignity: string;
    pdScore: number;
    pdDignity: string;
  };
  language?: 'en' | 'ta';
  // Advanced Parashara Deterministic Data Payloads
  natalJanmaStar?: {
    nakshatra_name: string;
    pada: number;
    rashi_name: string;
    rashi_index: number;
  };
  taraBalaTransitPlanets?: Array<{
    graha_key: string;
    transit_star: string;
    pada: number;
    taraNumber: number;
    taraName: string;
    taraTamil: string;
    quality: string;
    isAuspicious: boolean;
    description: string;
  }>;
  chandraBalaDailyTimeline?: Array<{
    dayRange: string;
    moonSignIndex: number;
    moonSignName: string;
    moonStarName: string;
    houseFromNatalMoon: number;
    isChandrashtama: boolean;
    isFavorable: boolean;
    taraBala: {
      taraNumber: number;
      taraName: string;
      isAuspicious: boolean;
    };
    alertFlag?: string;
  }>;
  ashtakavargaPayload?: {
    targetHousePoints: number;
    targetHouseStrength: string;
    savTotalSum?: number;
    bavByPlanet?: Record<string, Record<number, number>>;
    lagnaBav?: Record<number, number>;
    sodhyaPindas?: Array<{
      planet: string;
      rasiPinda: number;
      grahaPinda: number;
      sodhyaPinda: number;
      pct: number;
    }>;
    savPointsDistribution: Array<{
      houseNumber: number;
      signIndex: number;
      signName: string;
      points: number;
      status: string;
    }>;
  };
  personId?: string;
  personProfile?: {
    age?: number;
    dateOfBirth?: string;
  };
  originalSourceDomain?: OriginalSourceDomain;
  focusQuestion?: string;
  shadbalaStrengths?: Array<{
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
  }>;
  yogasAndDoshas?: {
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
  };
  vargaCharts?: Record<string, {
    code: string;
    name: string;
    lagnaSign: string;
    lagnaDeg: string;
    houses: Array<{
      house: number;
      sign: string;
      planets: string[];
    }>;
  }>;
  dashaLordsDossier?: Array<{
    role: string;
    lordName: string;
    ownedHousesTitle: string;
    functionalNature: string;
    natalHouseOccupied: number;
    natalDignity: string;
    connectsToTargetHouse: boolean;
    targetConnectionReason: string;
  }>;
  bhavaKarakaInfo?: {
    primaryKaraka: string;
    secondaryKarakas: string[];
    significations: string;
    outletImpact: string;
  };
  // Prediction Studio Multi-Year Timeline & Ground-Truth Test Fields
  isMultiYearPrediction?: boolean;
  timelineStartDate?: string;
  timelineEndDate?: string;
  multiYearDashas?: Array<{
    mahadasha: string;
    antardasha: string;
    pratyantardasha: string;
    startDate: string;
    endDate: string;
  }>;
  multiYearMoonTransits?: Array<{
    startDate: string;
    endDate: string;
    signIndex: number;
    signName: string;
    signTamil?: string;
    houseFromLagna: number;
    houseFromMoon: number;
    isChandrashtama: boolean;
    nakshatraName?: string;
    pada?: number;
  }>;
  multiYearMajorTransits?: Array<{
    grahaKey: string;
    grahaName: string;
    signName: string;
    startDate: string;
    endDate: string;
    houseFromLagna?: number;
    houseFromMoon?: number;
    isRetrograde?: boolean;
  }>;
  livedExperienceNarrative?: string;
  currentEventsNarrative?: string;
  geminiApiKey?: string;
  geminiModel?: string;
  anthropicApiKey?: string;
  anthropicModel?: string;
  preferredLlmProvider?: LLMProviderId;
  anthropicThinkingMode?: 'disabled' | 'enabled' | 'auto';
  anthropicBudgetTokens?: number;
  abortSignal?: AbortSignal;
  monthlyMotionSpans?: Array<{
    grahaKey: string;
    signName: string;
    startDay: number;
    endDay: number;
    isRetrograde: boolean;
    motionType?: 'Normal' | 'Vakra' | 'Adisara';
  }>;
  priorMonthTailSummary?: string[];
  vedicSpecialEvents?: VedicWindowAnalysis;
  eventManufacturingSuperset?: EventManufacturingSupersetPayload;
}

export interface EmploymentStatusInference {
  status: 'currently_serving' | 'actively_seeking' | 'sabbatical_unemployed';
  label: string;
  indicatorColor: 'green' | 'yellow' | 'amber' | 'red';
  confidence: number;
  inferenceReasoning: string;
}

export interface JobSearchAnalysis {
  momentum: string;
  pastStruggleVsCurrentPhase: string;
  timingAuspiciousness: string;
}

export interface NewJobAcquisition {
  jobTypeAndMood: string;
  workplaceAtmosphere: string;
  comparisonWithCurrentRole: string;
}

export interface ExistingJobPhase {
  currentPhaseNature: string;
  retentionVsExitAdvice: string;
}

export interface CrushStatusInference {
  existingCrushTrajectory: string;
  newCrushProbability: 'High' | 'Moderate' | 'Low' | string;
  newCrushDetails: string;
}

export interface RomanceAtmosphere {
  emotionalWeather: string;
  chemistryRating: number;
}

export interface ManifestationPath {
  outcomeType: 'classical_traditional_marriage' | 'living_together_modern' | 'exploratory_flutter' | 'platonic_delayed';
  outcomeLabel: string;
  manifestationLikelihood: string;
  astrologicalPathReasoning: string;
}

export interface SupplementaryDomainScenario {
  id: 'career_job' | 'love_romance' | 'health_vitality' | 'finance_wealth' | 'family_home';
  title: string;
  verdict: 'Favorable Expansion' | 'Moderate Progress' | 'Frictional Delay' | 'Caution Required' | string;
  confidenceScore: number;
  timingWindow: string;
  astrologicalReasoning: string;
  practicalGuidance: string;

  // Career Specific In-Depth Deep Dives & Native Employment State Trigger
  employmentStatusInference?: EmploymentStatusInference;
  jobSearchAnalysis?: JobSearchAnalysis;
  newJobAcquisition?: NewJobAcquisition;
  existingJobPhase?: ExistingJobPhase;

  // Love, Romance & Crush Deep Dives & Real Love Manifestation Path
  crushStatusInference?: CrushStatusInference;
  romanceAtmosphere?: RomanceAtmosphere;
  manifestationPath?: ManifestationPath;

  // Domain Specific Deep Nuances (Finance, Health, Family)
  financeDetails?: {
    liquidityVsOutflow: string;
    windfallAndSpeculation: string;
    debtAndAssetFinancing: string;
  };
  healthDetails?: {
    vulnerableZones: string[];
    mentalTranquilityAndStress: string;
    holisticRemedies: string;
  };
  familyDetails?: {
    domesticAmbiance: string;
    maternalWellbeing: string;
    propertyAndRelocation: string;
  };

  // Rich multi-paragraph detailed synthesis
  detailedParagraphs?: string[];
}

export interface NatalPromiseVsTransitDelivery {
  natalPromiseScore: number;
  natalPromiseVerdict: string;
  transitDeliveryScore: number;
  transitDeliveryVerdict: string;
  synthesisVerdict: string;
}

export interface PredictedSpecificEvent {
  category: 'visa_immigration' | 'financial_pf' | 'career_job' | 'property_asset' | 'legal_institutional';
  categoryLabel: string;
  eventTitle: string;
  likelihood: 'High' | 'Moderate' | 'Frictional Delay' | 'Caution / Obstacle' | string;
  likelihoodScore: number;
  projectedWindow: string;
  astrologicalTrigger: string;
  concreteImplication: string;
  preventiveRemedy: string;
}

export interface LLMThreePartNarrative {
  part1_probabilityAndScope: string;
  part2_financialAndResources: string;
  part3_microTimingWindow: string;
  summarySentence: string;
  overallConfidence: number;
  peakDateRange: string;
  rawMarkdown: string;
  providerUsed: LLMProviderId;
  promptVersion?: AstroPromptVersion;
  promptVersionTag?: string;
  executionTimeMs: number;

  // Natal Promise vs. Transit Strength Dual Evaluation
  natalPromiseVsTransitDelivery?: NatalPromiseVsTransitDelivery;

  // Supplementary Cross-Domain Karakatwa Scenarios (Career, Love/Crush, Health, Finance, Family)
  supplementaryScenarios?: SupplementaryDomainScenario[];

  // Predicted Specific Real-World Events & Timing (PF Transfer, Visa Papers Delay, Passport, Institutional Approvals)
  predictedSpecificEvents?: PredictedSpecificEvent[];

  // Superset Unified House/Lordship + Nakshatra Gate + Event Manufacturing Correlation
  supersetSynthesisNote?: string;
  correlatedGateEvents?: CorrelatedManufacturedEvent[];

  // Private LLM Verification & Wire Telemetry
  endpointUsed: string;
  connectionStatus: 'connected_live' | 'connection_failed_fallback' | 'simulated' | 'cancelled';
  connectionError?: string;
  isPrivateLocal: boolean;
  timeoutEnforced?: boolean;
  configuredTimeoutSeconds?: number;
  promptSent: string;
  rawRequestBody?: any;
  rawResponseBody?: any;
  httpStatus?: number;
  memoryPurged?: boolean;
  ollamaStats?: {
    model?: string;
    totalDurationMs?: number;
    loadDurationMs?: number;
    promptEvalCount?: number;
    evalCount?: number;
  };
  tokenTelemetry?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    source?: 'api_reported' | 'char_estimated';
  };
  thinkingContent?: string;
  stopReason?: string;
  logId?: string;
  runningNumber?: number;
  sqlInsert?: string;
  persistedIn?: string;
  pgPersisted?: boolean;
}

export interface ILLMAdapter {
  id: LLMProviderId;
  generateReasoning(context: VedicHouseContext): Promise<LLMThreePartNarrative>;
}
