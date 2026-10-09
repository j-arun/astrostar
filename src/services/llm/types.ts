/**
 * Types & Interfaces for Astro Engine Multi-LLM Reasoning System (Milestone M4)
 */

export type LLMProviderId = 'local_qwen' | 'gemini_pro' | 'claude';

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
    name: 'Local Qwen 2.5 7B',
    badgeLabel: '🖥️ Local (Qwen 2.5 7B via Ollama)',
    model: 'qwen2.5:7b-instruct',
    description: 'Local on-premise execution via Ollama (port 11434). Zero cloud dependency, rapid 7B reasoning, complete privacy.',
    endpoint: 'http://localhost:11434/api/generate'
  },
  gemini_pro: {
    id: 'gemini_pro',
    name: 'Google Gemini Pro',
    badgeLabel: '♊ Google Gemini Pro (gemini-3.1-pro)',
    model: 'gemini-3.1-pro-preview',
    description: 'Google DeepMind flagship multimodal reasoning model with deep Vedic synthesis capabilities.'
  },
  claude: {
    id: 'claude',
    name: 'Anthropic Claude',
    badgeLabel: '🧠 Anthropic Claude (claude-3-5-sonnet)',
    model: 'claude-3-5-sonnet-20241022',
    description: 'Anthropic state-of-the-art reasoning model for nuanced astrological timing breakdowns.'
  }
};

export interface VedicHouseContext {
  houseNumber: number;
  rashiIndex: number;
  rashiName: string;
  tamilName: string;
  isLagna: boolean;
  activationScore: number;
  isEventActive: boolean;
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
    transit_rashi_tamil?: string;
    house_from_lagna: number;
    degree_sputa: string;
    degree_in_sign_float?: number;
    nakshatra_name: string;
    nakshatra_lord?: string;
    pada: number;
    is_retrograde: boolean;
    is_custom?: boolean;
    aspects_target_house?: boolean;
    aspect_type?: string;
  }>;
  activeDasha: {
    mahadasha: string;
    antardasha: string;
    pratyantardasha: string;
    startDate: string;
    endDate: string;
  };
  selectedMonth: number; // 0..11
  selectedYear: number;
  userQuery?: string;
  selectedLocalModel?: string;
  customPromptOverride?: string;
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
    savPointsDistribution: Array<{
      houseNumber: number;
      signIndex: number;
      signName: string;
      points: number;
      status: string;
    }>;
  };
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

export interface LLMThreePartNarrative {
  part1_probabilityAndScope: string;
  part2_financialAndResources: string;
  part3_microTimingWindow: string;
  summarySentence: string;
  overallConfidence: number;
  peakDateRange: string;
  rawMarkdown: string;
  providerUsed: LLMProviderId;
  executionTimeMs: number;

  // Natal Promise vs. Transit Strength Dual Evaluation
  natalPromiseVsTransitDelivery?: NatalPromiseVsTransitDelivery;

  // Supplementary Cross-Domain Karakatwa Scenarios (Career, Love/Crush, Health, Finance, Family)
  supplementaryScenarios?: SupplementaryDomainScenario[];

  // Private LLM Verification & Wire Telemetry
  endpointUsed: string;
  connectionStatus: 'connected_live' | 'connection_failed_fallback' | 'simulated';
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
  logId?: string;
  runningNumber?: number;
}

export interface ILLMAdapter {
  id: LLMProviderId;
  generateReasoning(context: VedicHouseContext): Promise<LLMThreePartNarrative>;
}
