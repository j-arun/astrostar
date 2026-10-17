import React, { useState, useEffect, useRef } from 'react';
import { GEMINI_FALLBACK_MODEL, GEMINI_PRIMARY_MODEL, getPreferredGeminiModel } from '../services/llm/geminiModels';
import {
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Sparkles,
  Zap,
  Play,
  Pause,
  RotateCcw,
  Copy,
  Check,
  Download,
  X,
  Clock,
  Coins,
  Compass,
  ChevronRight,
  Bot,
  Terminal,
  ShieldCheck,
  AlertCircle,
  Code,
  Radio,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Cpu,
  FileText,
  Globe,
  FileCode,
  Folder,
  Layers,
  Database,
  Maximize2,
  Minimize2,
  ArrowUp,
  ArrowDown,
  Key
} from 'lucide-react';
import {
  LLMProviderId,
  LLM_PROVIDERS,
  VedicHouseContext,
  LLMThreePartNarrative
} from '../services/llm/types';
import { llmService, checkOllamaHealth, purgeOllamaMemory, buildVedicPrompt, fetchRecentLLMPromptLogs, persistLLMPromptLog } from '../services/llm/adapters';
import {
  generateVedicPdfReport,
  generateVedicHtmlReport,
  generateVedicWordReport,
  exportAllVedicReports
} from '../services/reportExportService';
import { DocsBreadcrumbSidebar } from './DocsBreadcrumbSidebar';
import { saveReportToServerDocs } from '../services/docsStorageService';
import { testGeminiConnection, testClaudeConnection } from '../services/apiHealthService';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface AudioVoiceInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  context: VedicHouseContext | null;
  activeProvider: LLMProviderId;
  onChangeProvider: (provider: LLMProviderId) => void;
  inlineView?: boolean;
  runTriggerTimestamp?: number;
}

const SAMPLE_QUICK_CHIPS = [
  'Will I buy a house or change jobs this month?',
  'What are the financial & resource sources for this house?',
  'Explain the 3–7 day micro-timing window for this event',
  'How does the active PD Lord impact this Bhava?'
];

const DOMAIN_ICONS: Record<string, string> = {
  career_job: '💼',
  love_romance: '❤️',
  health_vitality: '🩺',
  finance_wealth: '💰',
  family_home: '🏡'
};

const formatTimeDisplay = (totalSec: number): string => {
  if (totalSec < 60) {
    return `${totalSec.toFixed(1)}s`;
  }
  const mins = Math.floor(totalSec / 60);
  const secs = Math.floor(totalSec % 60);
  return `${totalSec.toFixed(1)}s (${mins}m ${secs}s)`;
};

const cleanNarrativeText = (text: string | undefined): string => {
  if (!text) return '';
  const trimmed = text.trim();
  // If the raw text contains raw JSON object/schema code, extract the true text
  if (trimmed.startsWith('{') && (trimmed.includes('"summarySentence"') || trimmed.includes('"part1_probabilityAndScope"'))) {
    try {
      const parsed = JSON.parse(trimmed);
      return parsed.part1_probabilityAndScope || parsed.summarySentence || trimmed;
    } catch {
      const match = trimmed.match(/"part1_probabilityAndScope"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (match && match[1]) {
        try {
          return JSON.parse(`"${match[1]}"`);
        } catch {
          return match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
        }
      }
    }
  }
  return trimmed;
};

export const AudioVoiceInspector: React.FC<AudioVoiceInspectorProps> = ({
  isOpen,
  onClose,
  context,
  activeProvider,
  onChangeProvider,
  inlineView = false,
  runTriggerTimestamp
}) => {
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [queryText, setQueryText] = useState<string>('');
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'ta'>('en');
  const [activeDomainTab, setActiveDomainTab] = useState<string>('career_job');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [narrative, setNarrative] = useState<LLMThreePartNarrative | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [speechRate, setSpeechRate] = useState<number>(1.0);
  const [copied, setCopied] = useState<string | null>(null);
  const [showDocsSidebar, setShowDocsSidebar] = useState<boolean>(true);

  // Wire Telemetry State
  const [showWireLog, setShowWireLog] = useState<boolean>(false);
  const [wireLogTab, setWireLogTab] = useState<'prompt' | 'request' | 'response' | 'telemetry' | 'db_logs' | 'guide'>('prompt');
  const [dbLogs, setDbLogs] = useState<any[]>([]);
  const [loadingDbLogs, setLoadingDbLogs] = useState<boolean>(false);
  const [localOllamaModel, setLocalOllamaModel] = useState<string>(() => {
    return localStorage.getItem('astro_ollama_model') || 'qwen2.5:7b-instruct';
  });
  const [availableOllamaModels, setAvailableOllamaModels] = useState<string[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [ollamaPingResult, setOllamaPingResult] = useState<{
    checking?: boolean;
    isOnline?: boolean;
    models?: string[];
    error?: string;
  } | null>(null);
  
  // Timeout Configuration State (Default is false: Full Throttle / No Timeout - runs full time)
  const [enableTimeout, setEnableTimeout] = useState<boolean>(() => {
    return localStorage.getItem('astro_ollama_enable_timeout') === 'true';
  });
  const [timeoutSeconds, setTimeoutSeconds] = useState<number>(() => {
    const saved = localStorage.getItem('astro_ollama_timeout_seconds');
    return saved ? parseInt(saved, 10) : 300;
  });

  const [anthropicApiKey, setAnthropicApiKey] = useState<string>(() => {
    return (typeof window !== 'undefined' ? localStorage.getItem('astro_anthropic_api_key') : '') || '';
  });

  const [anthropicModel, setAnthropicModel] = useState<string>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('astro_anthropic_model') : null;
    if (!saved || saved === 'claude-3-5-sonnet-20241022' || saved === 'claude-3-5-sonnet-latest') {
      return 'claude-sonnet-5-5';
    }
    return saved;
  });

  const [anthropicThinkingMode, setAnthropicThinkingMode] = useState<'disabled' | 'enabled' | 'auto'>(() => {
    return (typeof window !== 'undefined' ? (localStorage.getItem('astro_anthropic_thinking_mode') as any) : null) || 'disabled';
  });
  const [showThinkingBlock, setShowThinkingBlock] = useState<boolean>(false);

  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    return (typeof window !== 'undefined' ? localStorage.getItem('astro_gemini_api_key') : '') || '';
  });
  const [geminiModel, setGeminiModel] = useState<string>(() => {
    return getPreferredGeminiModel();
  });
  const [showKeySettings, setShowKeySettings] = useState<boolean>(false);
  const [isTestingKey, setIsTestingKey] = useState<boolean>(false);
  const [keyHealthStatus, setKeyHealthStatus] = useState<{
    provider: string;
    success: boolean;
    message: string;
  } | null>(null);

  // Recognition ref
  const recognitionRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Interactive Prompt Studio State
  const [editablePrompt, setEditablePrompt] = useState<string>('');
  const [isPromptCustomized, setIsPromptCustomized] = useState<boolean>(false);
  const [showPromptStudio, setShowPromptStudio] = useState<boolean>(true);
  const [promptStudioFold, setPromptStudioFold] = useState<'plain' | 'structured'>('plain');

  const handleApplyPreset = (domain: 'career' | 'love' | 'finance' | 'health') => {
    if (!context) return;
    const basePrompt = buildVedicPrompt({ ...context, language: selectedLanguage, customPromptOverride: undefined }, activeProvider);
    let appendText = '';
    if (domain === 'career') {
      appendText = `\n\n### Domain Focus: Career & Employment Status Inquiry
1. NATIVE EMPLOYMENT STATUS: Deduce based on 10th house, 6th house, active Dasha Triad lord, and current Gochara transits whether native is employed, in transition, or on sabbatical. Provide deduction and astrological rationale.
2. JOB SEARCH & TIMING: Analyze momentum. Is this month the auspicious turning point for landing an offer?
3. NEW ROLE OUTLOOK: Type of prospective role and organizational mood vs current standing.
4. WORKPLACE CLIMATE: Atmosphere, leadership relations, workload, and recognition.`;
    } else if (domain === 'love') {
      appendText = `\n\n### Domain Focus: Love, Romance & Relationships Inquiry
1. ROMANTIC TRAJECTORY: Evolution of affections, reciprocity, or clarity of boundaries.
2. NEW CONNECTION PROBABILITY: Transit triggers for new romantic interest under 5th/7th/Venus transits.
3. EMOTIONAL WEATHER: Chemistry, emotional comfort, and mutual affinity.
4. LONG-TERM VIABILITY: Commitment outlook, formal union vs courtship.`;
    } else if (domain === 'finance') {
      appendText = `\n\n### Domain Focus: Wealth, Cashflow & Capital Inflows
1. Liquid reserves (2nd house) vs long-term fixed assets/property (4th house).
2. Professional income vs 11th house gains and unexpected expenses.
3. Investment timing and debt management.`;
    } else if (domain === 'health') {
      appendText = `\n\n### Domain Focus: Health, Vitality & Well-being
1. Physical stamina and vulnerability zones based on 6th/8th houses and Saturn/Mars aspects.
2. Mental tranquility, sleep rhythm, and stress decompression.
3. Holistic wellness and pacing recommendations.`;
    }

    setEditablePrompt(basePrompt + appendText);
    setIsPromptCustomized(true);
    setShowPromptStudio(true);
  };

  // Synchronize System Prompt when context or provider changes
  useEffect(() => {
    if (context) {
      const generated = buildVedicPrompt({ ...context, customPromptOverride: undefined }, activeProvider);
      setEditablePrompt(generated);
      setIsPromptCustomized(false);
    }
  }, [context?.houseNumber, context?.isComprehensiveMonthly, context?.selectedMonth, context?.selectedYear, context?.activationScore, activeProvider]);

  // Timer for generation
  useEffect(() => {
    let timer: any;
    if (isGenerating) {
      setElapsedSeconds(0);
      timer = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isGenerating]);

  // Auto-scan Ollama models on open when provider is local
  useEffect(() => {
    if (isOpen && activeProvider === 'local_qwen') {
      checkOllamaHealth().then(res => {
        if (res.isOnline && res.models && res.models.length > 0) {
          setAvailableOllamaModels(res.models);
        }
      }).catch(() => {});
    }
  }, [isOpen, activeProvider]);

  // Explicit user trigger from timeline "Send Prompt to LLM" button
  useEffect(() => {
    if (runTriggerTimestamp && isOpen) {
      handleGenerate();
    }
  }, [runTriggerTimestamp]);

  // Clean up speech when unmounting or closing
  useEffect(() => {
    return () => {
      stopSpeech();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  const handleGenerate = async (customQuery?: string, promptOverrideToUse?: string) => {
    if (!context) return;
    stopSpeech();

    // Set up AbortController for cancel support
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsGenerating(true);

    try {
      const q = customQuery !== undefined ? customQuery : queryText;
      const promptToSend = promptOverrideToUse !== undefined
        ? promptOverrideToUse
        : (isPromptCustomized && editablePrompt.trim().length > 0 ? editablePrompt : undefined);

      const result = await llmService.generate(activeProvider, {
        ...context,
        userQuery: q || undefined,
        language: selectedLanguage,
        selectedLocalModel: localOllamaModel,
        customPromptOverride: promptToSend,
        enableTimeout,
        timeoutSeconds,
        geminiApiKey: geminiApiKey.trim() || undefined,
        geminiModel: geminiModel.trim() || undefined,
        anthropicApiKey: anthropicApiKey.trim() || undefined,
        anthropicModel: anthropicModel || undefined,
        anthropicThinkingMode,
        abortSignal: controller.signal
      });
      setNarrative(result);
      if (context && result.connectionStatus !== 'cancelled') {
        saveReportToServerDocs(context, result).catch(() => {});
      }
      loadDbLogs().catch(() => {});
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.error('LLM synthesis error:', e);
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancelPrompt = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setElapsedSeconds(0);
  };

  const loadDbLogs = async () => {
    setLoadingDbLogs(true);
    try {
      const logs = await fetchRecentLLMPromptLogs(30);
      setDbLogs(logs);
    } catch (e) {
      console.error('Failed to load DB logs:', e);
    } finally {
      setLoadingDbLogs(false);
    }
  };

  const [retryingInsert, setRetryingInsert] = useState<boolean>(false);

  const handleRetryDbInsert = async () => {
    if (!narrative) return;
    setRetryingInsert(true);
    try {
      const engineMap: Record<LLMProviderId, string> = {
        local_qwen: 'Ollama',
        gemini_pro: 'Gemini',
        claude_sonnet: 'Claude Sonnet',
        claude_haiku: 'Claude Haiku',
        claude_fable: 'Claude Fable 5.1',
        claude: 'Claude Sonnet'
      };
      const engine = (engineMap as any)[activeProvider] || 'Claude';
      const modelName = narrative.ollamaStats?.model || (
        activeProvider === 'gemini_pro' ? (geminiModel || 'gemini-2.5-flash') :
        activeProvider === 'claude_fable' ? 'claude-fable-5-1' :
        activeProvider === 'claude_haiku' ? (anthropicModel || 'claude-haiku-5-5') :
        (activeProvider === 'claude_sonnet' || activeProvider === 'claude') ? (anthropicModel || 'claude-sonnet-5-5') : localOllamaModel
      );
      const res = await persistLLMPromptLog({
        engine,
        model_name: modelName,
        fired_at: new Date().toISOString(),
        prompt_text: narrative.promptSent || '',
        response_text: narrative.part1_probabilityAndScope || narrative.rawMarkdown || '',
        time_taken_ms: narrative.executionTimeMs || 0,
        status: narrative.connectionStatus === 'connected_live' ? 'SUCCESS' : 'FALLBACK',
        response_json: narrative.rawResponseBody
      });
      if (res?.log_id) {
        setNarrative(prev => prev ? {
          ...prev,
          logId: res.log_id,
          runningNumber: res.running_number,
          sqlInsert: res.sql_insert,
          persistedIn: res.persisted_in,
          pgPersisted: res.pg_persisted
        } : null);
      }
      await loadDbLogs();
    } catch (e) {
      console.error('Error retrying DB log insert:', e);
    } finally {
      setRetryingInsert(false);
    }
  };

  const handleRefireWithCustomPrompt = () => {
    handleGenerate(undefined, editablePrompt);
  };

  const handleResetPromptToDefault = () => {
    if (context) {
      const fresh = buildVedicPrompt({ ...context, language: selectedLanguage, customPromptOverride: undefined }, activeProvider);
      setEditablePrompt(fresh);
      setIsPromptCustomized(false);
    }
  };

  const handleTestOllamaConnection = async () => {
    setOllamaPingResult({ checking: true });
    const res = await checkOllamaHealth();
    setOllamaPingResult({
      checking: false,
      isOnline: res.isOnline,
      models: res.models,
      error: res.error
    });
    if (res.models && res.models.length > 0) {
      setAvailableOllamaModels(res.models);
      if (!res.models.includes(localOllamaModel)) {
        const matchingQwen = res.models.find(m => m.toLowerCase().includes('qwen'));
        if (matchingQwen) {
          setLocalOllamaModel(matchingQwen);
          localStorage.setItem('astro_ollama_model', matchingQwen);
        }
      }
    }
  };

  const handleTestKeyHealth = async () => {
    setIsTestingKey(true);
    setKeyHealthStatus(null);
    try {
      if (activeProvider === 'gemini_pro') {
        const res = await testGeminiConnection(geminiApiKey, geminiModel);
        setKeyHealthStatus({
          provider: 'Google Gemini',
          success: !!res.success,
          message: res.message
        });
      } else if (activeProvider === 'claude_sonnet' || activeProvider === 'claude_haiku' || activeProvider === 'claude_fable' || activeProvider === 'claude') {
        const testModel = activeProvider === 'claude_fable' ? 'claude-fable-5-1' : anthropicModel;
        const res = await testClaudeConnection(anthropicApiKey, testModel);
        setKeyHealthStatus({
          provider: activeProvider === 'claude_fable' ? 'Claude Fable 5.1' : 'Anthropic Claude',
          success: !!res.success,
          message: res.message
        });
      } else if (activeProvider === 'local_qwen') {
        await handleTestOllamaConnection();
      }
    } catch (e: any) {
      setKeyHealthStatus({
        provider: 'API',
        success: false,
        message: e.message || 'Key test failed'
      });
    } finally {
      setIsTestingKey(false);
    }
  };



  const [purgedToast, setPurgedToast] = useState<boolean>(false);
  const [isPurging, setIsPurging] = useState<boolean>(false);

  const handleManualPurge = async () => {
    setIsPurging(true);
    await purgeOllamaMemory(localOllamaModel);
    setIsPurging(false);
    setPurgedToast(true);
    setTimeout(() => setPurgedToast(false), 3000);
  };

  // Web Speech API: Voice Input (Microphone)
  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please type your query.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = selectedLanguage === 'ta' ? 'ta-IN' : 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setQueryText(transcript);
        setIsListening(false);
        handleGenerate(transcript);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Mic error:', err);
      setIsListening(false);
    }
  };

  // Web Speech API: Voice Output (Text-to-Speech)
  const toggleSpeech = () => {
    if (!narrative) return;

    if (isPlayingAudio) {
      stopSpeech();
      return;
    }

    if (!window.speechSynthesis) {
      alert('Text-to-speech is not supported on this browser.');
      return;
    }

    window.speechSynthesis.cancel();

    const fullSpeechText = selectedLanguage === 'ta'
      ? `${context?.tamilName} ராசி 4-ஆம் பாவ பலன்கள். ${narrative.summarySentence}. பகுதி 1: நிகழ்வு சாத்தியக்கூறு. ${narrative.part1_probabilityAndScope}. பகுதி 2: நிதி மற்றும் மூலதன ஆதாரங்கள். ${narrative.part2_financialAndResources}. பகுதி 3: முக்கிய காலகட்டம். ${narrative.part3_microTimingWindow}.`
      : `Astrological Synthesis for House ${context?.houseNumber}. ${narrative.summarySentence}. Part 1: Event Probability and Scope. ${narrative.part1_probabilityAndScope}. Part 2: Financial and Resource Sources. ${narrative.part2_financialAndResources}. Part 3: Micro-Timing Window. ${narrative.part3_microTimingWindow}.`;

    const utterance = new SpeechSynthesisUtterance(fullSpeechText);
    utterance.rate = speechRate;
    utterance.pitch = 1.0;
    if (selectedLanguage === 'ta') {
      utterance.lang = 'ta-IN';
    }

    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    window.speechSynthesis.speak(utterance);
    setIsPlayingAudio(true);
  };

  const stopSpeech = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsPlayingAudio(false);
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  const handleDownloadPdf = () => {
    if (!narrative || !context) return;
    setIsExportingPdf(true);
    try {
      generateVedicPdfReport(context, narrative);
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDownloadHtml = () => {
    if (!narrative || !context) return;
    try {
      generateVedicHtmlReport(context, narrative);
    } catch (err) {
      console.error('HTML export error:', err);
    }
  };

  const handleDownloadWord = () => {
    if (!narrative || !context) return;
    try {
      generateVedicWordReport(context, narrative);
    } catch (err) {
      console.error('Word export error:', err);
    }
  };

  const handleDownloadAll = () => {
    if (!narrative || !context) return;
    try {
      exportAllVedicReports(context, narrative);
    } catch (err) {
      console.error('Batch export error:', err);
    }
  };

  const handleDownloadReport = () => {
    if (!narrative || !context) return;
    const blob = new Blob([JSON.stringify({ context, narrative }, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = context.isComprehensiveMonthly
      ? `Vedic_Report_Monthly_${MONTH_NAMES[context.selectedMonth]}_${context.selectedYear}.json`
      : `Vedic_Report_H${context.houseNumber || 'Bhava'}_${context.rashiName || 'Transit'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const bodyScrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (bodyScrollRef.current) {
      bodyScrollRef.current.scrollTo({ top: bodyScrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  };

  const scrollToTop = () => {
    if (bodyScrollRef.current) {
      bodyScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (!isOpen || !context) return null;

  const inspectorContent = (
    <div className={`relative w-full ${inlineView ? 'min-h-[85vh] rounded-2xl' : isFullScreen ? 'h-full rounded-none' : 'max-w-6xl h-[95vh] rounded-2xl'} flex flex-col bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden`}>
        {/* HEADER BAR */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold shadow-inner">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                  {context.isComprehensiveMonthly ? (
                    <>
                      <span>Monthly Vedic Predictions Report</span>
                      <span className="text-slate-400">&bull;</span>
                      <span className="text-amber-300">{MONTH_NAMES[context.selectedMonth]} {context.selectedYear}</span>
                    </>
                  ) : (
                    <>
                      <span>House {context.houseNumber}</span>
                      <span className="text-slate-400">&bull;</span>
                      <span className="text-amber-300">{context.rashiName}</span>
                      <span className="text-xs text-slate-400 font-normal font-mono">({context.tamilName})</span>
                    </>
                  )}
                </h3>
                {context.isComprehensiveMonthly ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-indigo-400" />
                    Full-Month Scope
                  </span>
                ) : context.isEventActive ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-slate-950 shadow-sm flex items-center gap-1 animate-pulse">
                    <Zap className="w-3 h-3 fill-current" />
                    Event Active ({(context.activationScore ?? 0).toFixed(2)})
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                    Score: {(context.activationScore ?? 0).toFixed(2)}
                  </span>
                )}
                {context.transitOccupants.some(t => t.is_custom) && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 flex items-center gap-1 shadow-sm">
                    <Check className="w-2.5 h-2.5" />
                    Custom Chart Transits Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Vedic Multi-LLM Reasoning Engine &amp; Audio Voice Inspector
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle Docs Archive Sidebar */}
            <button
              onClick={() => setShowDocsSidebar(!showDocsSidebar)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                showDocsSidebar
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-700/80'
              }`}
              title="Toggle Year-Wise Web Server Docs Archive & Breadcrumb Navigation"
            >
              <Folder className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Docs Archive (Year-Wise)</span>
            </button>

            {/* Multi-Format Export Group: PDF, HTML, Word */}
            <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-lg p-0.5 shadow-sm">
              <button
                onClick={handleDownloadPdf}
                disabled={isGenerating || !narrative || isExportingPdf}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition text-xs shadow disabled:opacity-40 cursor-pointer"
                title="Download Astrological Predictions Report as PDF"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{isExportingPdf ? 'Exporting...' : 'PDF'}</span>
              </button>

              <button
                onClick={handleDownloadHtml}
                disabled={isGenerating || !narrative}
                className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white font-bold transition text-xs disabled:opacity-40 cursor-pointer"
                title="Download Standalone Printable HTML Report"
              >
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                <span>HTML</span>
              </button>

              <button
                onClick={handleDownloadWord}
                disabled={isGenerating || !narrative}
                className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white font-bold transition text-xs disabled:opacity-40 cursor-pointer"
                title="Download Editable Word Document (.doc)"
              >
                <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                <span>Word</span>
              </button>
            </div>

            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 transition cursor-pointer"
              title={isFullScreen ? "Exit Fullscreen" : "Maximize to Fullscreen"}
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={handleDownloadReport}
              disabled={isGenerating || !narrative}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 transition"
              title="Export Raw JSON"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 transition"
              title="Close Inspector"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CONTROLS ROW: PROVIDER SELECTOR & LOCAL CONTROLS */}
        <div className="px-5 py-2.5 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* LLM Provider Selector */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-semibold flex items-center gap-1">
              <Bot className="w-3.5 h-3.5 text-amber-400" />
              Reasoning Engine:
            </span>
            <div className="flex items-center rounded-lg bg-slate-900 border border-slate-700/80 p-0.5">
              {(['local_qwen', 'gemini_pro', 'claude_sonnet', 'claude_haiku', 'claude_fable'] as LLMProviderId[]).map(pid => {
                const prov = LLM_PROVIDERS[pid];
                const isActive = activeProvider === pid || (pid === 'claude_sonnet' && activeProvider === 'claude');
                return (
                  <button
                    key={pid}
                    onClick={() => onChangeProvider(pid)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 font-bold shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {prov.name}
                  </button>
                );
              })}
            </div>

            {/* Ollama Model Tag Selector */}
            {activeProvider === 'local_qwen' && (
              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 px-2 py-1 rounded-lg">
                <span className="text-[10px] text-slate-400 font-mono">Model:</span>
                {availableOllamaModels.length > 0 ? (
                  <select
                    value={localOllamaModel}
                    onChange={(e) => {
                      setLocalOllamaModel(e.target.value);
                      localStorage.setItem('astro_ollama_model', e.target.value);
                    }}
                    className="bg-transparent text-amber-300 font-mono text-[11px] font-bold focus:outline-none cursor-pointer"
                  >
                    {availableOllamaModels.map(m => (
                      <option key={m} value={m} className="bg-slate-900 text-white font-mono">
                        {m}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={localOllamaModel}
                    onChange={(e) => {
                      setLocalOllamaModel(e.target.value);
                      localStorage.setItem('astro_ollama_model', e.target.value);
                    }}
                    className="bg-transparent text-amber-300 font-mono text-[11px] font-bold w-36 focus:outline-none"
                    placeholder="qwen2.5:7b-instruct"
                    title="Exact Ollama model tag on your machine"
                  />
                )}
              </div>
            )}

            {/* Local LLM (7B) Timeout & Throttle Configuration */}
            {activeProvider === 'local_qwen' && (
              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 px-2 py-1 rounded-lg">
                <span className="text-[10px] text-slate-400 font-mono">Timeout:</span>
                <button
                  type="button"
                  onClick={() => {
                    const next = !enableTimeout;
                    setEnableTimeout(next);
                    localStorage.setItem('astro_ollama_enable_timeout', String(next));
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition flex items-center gap-1 cursor-pointer ${
                    enableTimeout
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                  }`}
                  title={
                    enableTimeout
                      ? `Enforced timeout limit of ${timeoutSeconds}s is active. Click to switch to Full Throttle (run full time with no limits).`
                      : 'Full throttle active: Runs full time with NO timeout limit until complete. Click to enforce timeout limit.'
                  }
                >
                  {enableTimeout ? `⏱️ Enforced (${timeoutSeconds}s)` : '⚡ Full Throttle'}
                </button>
                {enableTimeout && (
                  <select
                    value={timeoutSeconds}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setTimeoutSeconds(val);
                      localStorage.setItem('astro_ollama_timeout_seconds', String(val));
                    }}
                    className="bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] font-mono focus:outline-none cursor-pointer text-amber-300"
                    title="Select timeout limit in seconds"
                  >
                    <option value="180">180s (3m)</option>
                    <option value="300">300s (5m)</option>
                    <option value="420">420s (7m)</option>
                    <option value="600">600s (10m)</option>
                  </select>
                )}
              </div>
            )}

            {/* Google Gemini Model & Key Configurator with One-Click Test Query */}
            {activeProvider === 'gemini_pro' && (
              <div className="flex flex-wrap items-center gap-2 bg-slate-900 border border-slate-700/80 px-2.5 py-1 rounded-lg">
                <span className="text-[10px] text-cyan-300 font-mono font-bold flex items-center gap-1">
                  <span>♊</span>
                  <span>Google Gemini</span>
                </span>
                <div className="h-3.5 w-px bg-slate-700" />
                <select
                  value={geminiModel}
                  onChange={(e) => {
                    const val = e.target.value;
                    setGeminiModel(val);
                    localStorage.setItem('astro_gemini_model', val);
                  }}
                  className="bg-slate-950 border border-cyan-500/40 rounded px-1.5 py-0.5 text-[10px] font-mono text-cyan-200 focus:outline-none cursor-pointer"
                  title="Select Google Gemini Model"
                >
                  <option value={GEMINI_PRIMARY_MODEL}>Gemini 3.8 Flash (Default &amp; Recommended)</option>
                  <option value={GEMINI_FALLBACK_MODEL}>Gemini 3.1 Flash Lite (Fallback)</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro (Deep Reasoning)</option>
                  <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (Fastest)</option>
                </select>
                <div className="h-3.5 w-px bg-slate-700" />
                <div className="flex items-center gap-1.5">
                  <Key className="w-3 h-3 text-amber-400" />
                  <input
                    type="password"
                    value={geminiApiKey}
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      setGeminiApiKey(val);
                      localStorage.setItem('astro_gemini_api_key', val);
                    }}
                    placeholder="Gemini API Key (AIzaSy...)"
                    className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-[10px] font-mono text-cyan-200 focus:outline-none w-44 placeholder:text-slate-600"
                    title="Enter Gemini API Key (stored in browser localStorage, overrides server default)"
                  />
                  {geminiApiKey ? (
                    <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-0.5" title="API Key provided">
                      <Check className="w-2.5 h-2.5" /> Saved
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500 font-mono" title="If empty, will use GEMINI_API_KEY from .env">
                      (or .env)
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleTestKeyHealth}
                    disabled={isTestingKey}
                    className="px-2 py-0.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[10px] transition cursor-pointer shadow-sm ml-1 flex items-center gap-1 disabled:opacity-50 active:scale-95"
                    title="Fire a test query ping to verify your Gemini API key"
                  >
                    {isTestingKey ? <RotateCcw className="w-2.5 h-2.5 animate-spin" /> : <span>⚡</span>}
                    <span>{isTestingKey ? 'Pinging...' : 'Test Key'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* API Key Health Status Feedback */}
            {keyHealthStatus && (
              <div className={`px-2.5 py-1 rounded-lg text-[10px] font-mono flex items-center gap-1.5 border shadow-sm ${
                keyHealthStatus.success
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                  : 'bg-rose-950/80 text-rose-300 border-rose-500/40'
              }`}>
                {keyHealthStatus.success ? <Check className="w-3 h-3 text-emerald-400 shrink-0" /> : <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />}
                <span className="truncate max-w-xs sm:max-w-md font-semibold">{keyHealthStatus.message}</span>
                <button
                  type="button"
                  onClick={() => setKeyHealthStatus(null)}
                  className="text-slate-400 hover:text-white ml-1 font-bold cursor-pointer"
                  title="Dismiss"
                >
                  &times;
                </button>
              </div>
            )}
            {(activeProvider === 'claude_sonnet' || activeProvider === 'claude_haiku' || activeProvider === 'claude_fable' || activeProvider === 'claude') && (
              <div className="flex flex-wrap items-center gap-2 bg-slate-900 border border-slate-700/80 px-2.5 py-1 rounded-lg">
                <span className="text-[10px] text-purple-300 font-mono font-bold flex items-center gap-1">
                  <span>🧠</span>
                  <span>{activeProvider === 'claude_fable' ? 'Claude Fable 5.1' : activeProvider === 'claude_haiku' ? 'Claude Haiku 5.5' : 'Claude Sonnet 5.5'}</span>
                </span>
                <div className="h-3.5 w-px bg-slate-700" />
                {activeProvider === 'claude_fable' ? (
                  <span className="text-[10px] font-mono text-purple-200">claude-fable-5-1</span>
                ) : (
                  <select
                    value={anthropicModel}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAnthropicModel(val);
                      localStorage.setItem('astro_anthropic_model', val);
                    }}
                    className="bg-slate-950 border border-purple-500/40 rounded px-1.5 py-0.5 text-[10px] font-mono text-purple-200 focus:outline-none cursor-pointer"
                    title="Select Anthropic Claude Model"
                  >
                    <option value="claude-sonnet-5-5">Claude Sonnet 5.5 (Default &amp; Recommended)</option>
                    <option value="claude-haiku-5-5">Claude Haiku 5.5 (Fast &amp; Low Cost)</option>
                    <option value="claude-opus-5-5">Claude Opus 5.5 (Flagship Deep Reasoning)</option>
                    <option value="claude-3-5-sonnet-latest">Claude 3.5 Sonnet (Legacy)</option>
                    <option value="claude-3-7-sonnet-latest">Claude 3.7 Sonnet</option>
                    <option value="claude-3-5-haiku-latest">Claude 3.5 Haiku (Legacy)</option>
                    <option value="claude-3-haiku-20240307">Claude 3 Haiku (Legacy Tier 1)</option>
                  </select>
                )}
                <div className="h-3.5 w-px bg-slate-700" />
                <select
                  value={anthropicThinkingMode}
                  onChange={(e) => {
                    const val = e.target.value as 'disabled' | 'enabled' | 'auto';
                    setAnthropicThinkingMode(val);
                    localStorage.setItem('astro_anthropic_thinking_mode', val);
                  }}
                  className="bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] font-mono text-cyan-300 focus:outline-none cursor-pointer"
                  title="Claude Thinking Mode: Direct Output (Thinking OFF) prevents token depletion, while Extended Thinking generates deep scratchpad reasoning"
                >
                  <option value="disabled">⚡ Direct Output (Thinking OFF)</option>
                  <option value="enabled">🧠 Extended Thinking (ON)</option>
                  <option value="auto">🔄 Auto Adaptive</option>
                </select>
                <div className="h-3.5 w-px bg-slate-700" />
                <div className="flex items-center gap-1.5">
                  <Key className="w-3 h-3 text-amber-400" />
                  <input
                    type="password"
                    value={anthropicApiKey}
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      setAnthropicApiKey(val);
                      localStorage.setItem('astro_anthropic_api_key', val);
                    }}
                    placeholder="Claude API Key (sk-ant-...)"
                    className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-[10px] font-mono text-amber-200 focus:outline-none w-44 placeholder:text-slate-600"
                    title="Enter Anthropic API Key (bypasses CORS via /api/llm/claude proxy, stored securely in local browser storage)"
                  />
                  {anthropicApiKey ? (
                    <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-0.5" title="API Key provided">
                      <Check className="w-2.5 h-2.5" /> Saved
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500 font-mono" title="If empty, will use ANTHROPIC_API_KEY from .env">
                      (or .env)
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleGenerate()}
                    className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] transition cursor-pointer shadow-sm ml-1"
                    title="Test Claude live inference with this key and model"
                  >
                    Test Live
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Audio Playback Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSpeech}
              disabled={isGenerating || !narrative}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition shadow ${
                isPlayingAudio
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              } disabled:opacity-50`}
            >
              {isPlayingAudio ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause Voice</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Play Voice-Over</span>
                </>
              )}
            </button>

            {isPlayingAudio && (
              <div className="flex items-center gap-1 px-2 py-1 bg-slate-900 border border-slate-700 rounded-md">
                <span className="w-1.5 h-3 bg-emerald-400 rounded-full animate-bounce" />
                <span className="w-1.5 h-5 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.15s]" />
                <span className="w-1.5 h-4 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.3s]" />
              </div>
            )}

            {/* Speed Rate */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
              {[0.8, 1.0, 1.2].map(rate => (
                <button
                  key={rate}
                  onClick={() => {
                    setSpeechRate(rate);
                    if (isPlayingAudio) {
                      stopSpeech();
                    }
                  }}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                    speechRate === rate
                      ? 'bg-slate-700 text-amber-300 font-bold'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>

            {/* Language Switcher: EN vs தமிழ் */}
            <div className="flex items-center gap-0.5 bg-slate-900 border border-slate-800 rounded-lg p-0.5" title="Switch inference language (English / தமிழ்)">
              <button
                onClick={() => setSelectedLanguage('en')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer ${
                  selectedLanguage === 'en'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setSelectedLanguage('ta')}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer ${
                  selectedLanguage === 'ta'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                தமிழ்
              </button>
            </div>
          </div>
        </div>

        {/* PRIVATE LLM AUDIT / VERIFICATION STATUS BANNER */}
        <div className="px-5 py-2 bg-slate-950/90 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            {narrative?.providerUsed === 'local_qwen' ? (
              narrative.connectionStatus === 'connected_live' ? (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  VERIFIED PRIVATE LLM (Live on http://localhost:11434)
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  PRIVATE LLM ADAPTER (Local Fallback Active - Ollama offline)
                </span>
              )
            ) : (narrative?.providerUsed === 'claude_sonnet' || narrative?.providerUsed === 'claude_haiku' || narrative?.providerUsed === 'claude_fable' || narrative?.providerUsed === 'claude') ? (
              narrative.connectionStatus === 'connected_live' ? (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[11px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                  LIVE ANTHROPIC CLAUDE ({narrative.providerUsed === 'claude_fable' ? 'Fable 5.1' : narrative.providerUsed === 'claude_haiku' ? 'Haiku' : 'Sonnet'})
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  CLAUDE PARASHARA FALLBACK ({narrative.providerUsed === 'claude_fable' ? 'Fable 5.1' : narrative.providerUsed === 'claude_haiku' ? 'Haiku' : 'Sonnet'})
                </span>
              )
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[11px] font-bold">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                Cloud LLM ({LLM_PROVIDERS[activeProvider]?.name || 'Gemini'})
              </span>
            )}

            <span className="text-slate-400 text-[11px] font-mono hidden md:inline">
              Target: <span className="text-slate-300">{narrative?.endpointUsed || 'http://localhost:11434/api/generate'}</span>
            </span>

            {narrative?.executionTimeMs !== undefined && (
              <span
                className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 text-[11px] font-mono font-bold"
                title={`Total roundtrip execution duration: ${(narrative.executionTimeMs / 1000).toFixed(2)}s`}
              >
                <Clock className="w-3 h-3 text-blue-400" />
                Time Taken: <span className="text-white font-extrabold">{formatTimeDisplay(narrative.executionTimeMs / 1000)}</span>
                {narrative.providerUsed === 'local_qwen' && (
                  <span className="text-[10px] text-blue-400/80 font-normal">
                    ({narrative.timeoutEnforced ? `${narrative.configuredTimeoutSeconds}s cap` : '⚡ Full Throttle'})
                  </span>
                )}
              </span>
            )}

            {narrative?.logId && (
              <span
                className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-mono font-bold"
                title={`Audit Log Table: llm_prompt_logs | Sequence #${narrative.runningNumber}`}
              >
                <Database className="w-3 h-3 text-emerald-400" />
                Log ID: <span className="text-white font-extrabold">{narrative.logId}</span>
                {narrative.runningNumber && (
                  <span className="text-[10px] text-emerald-400/80 font-normal">
                    (#{narrative.runningNumber})
                  </span>
                )}
              </span>
            )}

            {narrative?.memoryPurged && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-semibold" title="VRAM memory purged immediately upon completion to prevent delay on subsequent prompts">
                <Zap className="w-2.5 h-2.5 text-emerald-400" />
                VRAM Purged
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowWireLog(!showWireLog)}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition font-mono text-[11px]"
            >
              <Terminal className="w-3.5 h-3.5 text-amber-400" />
              <span>{showWireLog ? 'Hide Wire Logs' : '🔍 Inspect Prompt & Wire Log'}</span>
              {showWireLog ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>


            {activeProvider === 'local_qwen' && (
              <>
                <button
                  onClick={handleTestOllamaConnection}
                  disabled={ollamaPingResult?.checking}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 transition text-[11px]"
                  title="Pings http://localhost:11434/api/tags to verify if your local Ollama daemon is active"
                >
                  <Radio className={`w-3 h-3 ${ollamaPingResult?.checking ? 'text-amber-400 animate-spin' : 'text-slate-400'}`} />
                  <span>Test Ollama</span>
                </button>

                <button
                  onClick={handleManualPurge}
                  disabled={isPurging}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 transition text-[11px]"
                  title="Immediately unloads model from VRAM/RAM to free memory for subsequent prompts"
                >
                  <Zap className={`w-3 h-3 ${isPurging ? 'text-amber-400 animate-spin' : 'text-emerald-400'}`} />
                  <span>{isPurging ? 'Purging...' : purgedToast ? '✓ VRAM Cleared' : '🧹 Purge VRAM'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* LIVE OLLAMA HEALTH PING RESULT CARD (WHEN TESTED) */}
        {ollamaPingResult && (
          <div className={`px-5 py-2 text-xs border-b border-slate-800 flex items-center justify-between ${
            ollamaPingResult.isOnline ? 'bg-emerald-950/40 text-emerald-200' : 'bg-rose-950/30 text-rose-200'
          }`}>
            <div className="flex items-center gap-2">
              {ollamaPingResult.isOnline ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>
                    <strong>Ollama Online!</strong> Detected models: {ollamaPingResult.models?.join(', ') || 'No models pulled yet (run `ollama run qwen2.5:7b-instruct`)'}
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                  <span>
                    <strong>Ollama Offline / Unreachable:</strong> {ollamaPingResult.error}. Run <code className="bg-slate-900 px-1 py-0.5 rounded text-amber-300">ollama run qwen2.5:7b-instruct</code> in your terminal.
                  </span>
                </>
              )}
            </div>
            <button
              onClick={() => setOllamaPingResult(null)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}



        {/* 404 MODEL NOT FOUND BANNER */}
        {narrative?.providerUsed === 'local_qwen' && narrative?.connectionError?.includes('404') && (
          <div className="px-5 py-2.5 bg-amber-950/70 border-b border-amber-500/50 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-200 animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <p className="font-bold text-amber-300">
                  Ollama is running on port 11434, but model <code className="bg-slate-950 px-1.5 py-0.5 rounded text-white font-mono">{localOllamaModel}</code> is not in your library!
                </p>
                <p className="text-[11px] text-amber-300/80 mt-0.5">
                  Run this terminal command to download it, or select an installed model from the dropdown above:
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-2.5 py-1 rounded bg-slate-950 border border-amber-500/40 font-mono text-[11px] text-emerald-400 select-all flex items-center gap-2 shadow-inner">
                <span>ollama pull {localOllamaModel}</span>
                <button
                  onClick={() => handleCopy(`ollama pull ${localOllamaModel}`, 'pull_cmd')}
                  className="text-amber-400 hover:text-white"
                  title="Copy command"
                >
                  {copied === 'pull_cmd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <button
                onClick={handleTestOllamaConnection}
                className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition text-xs shadow"
              >
                Scan My Models
              </button>
            </div>
          </div>
        )}

        {/* GEMINI FALLBACK & KEY DIAGNOSTIC BANNER */}
        {narrative?.providerUsed === 'gemini_pro' && narrative?.connectionStatus === 'connection_failed_fallback' && (
          <div className="px-5 py-3 bg-gradient-to-r from-purple-950/90 via-slate-900 to-amber-950/90 border-b border-purple-500/50 flex flex-wrap items-center justify-between gap-3 text-xs text-purple-200 animate-fadeIn">
            <div className="flex items-start gap-2.5 flex-1 min-w-[280px]">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-amber-300 text-sm">
                    Gemini Pro: Inference Fell Back to Parashara Heuristic Engine
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    STATUS: FALLBACK
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 font-mono leading-relaxed">
                  {narrative.connectionError}
                </p>
                <p className="text-[10.5px] text-purple-300">
                  💡 <strong>How to resolve:</strong> Enter an active Gemini API key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="underline text-amber-300 hover:text-white">Google AI Studio</a> in the key input above and click <strong>"⚡ Test Key"</strong>.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleTestKeyHealth}
                disabled={isTestingKey}
                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition text-xs shadow flex items-center gap-1 cursor-pointer"
              >
                {isTestingKey ? <RotateCcw className="w-3 h-3 animate-spin" /> : <span>⚡</span>}
                <span>Test Gemini Key</span>
              </button>
              <button
                onClick={() => handleGenerate()}
                disabled={isGenerating}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition text-xs shadow flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Retry Gemini</span>
              </button>
            </div>
          </div>
        )}

        {/* EXPANDABLE PROMPT & WIRE TELEMETRY DRAWER */}
        {showWireLog && (
          <div className="bg-slate-950 border-b border-slate-800 p-4 space-y-3 animate-fadeIn text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <Code className="w-4 h-4 text-amber-400" />
                <span>Prompt &amp; Wire Telemetry Inspector</span>
                <span className="text-[10px] text-slate-500 font-mono">(Audit proof of Private LLM communication)</span>
              </div>

              {/* Sub tabs */}
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-0.5 rounded-lg flex-wrap">
                {[
                  { id: 'prompt', label: '1. Prompt Sent' },
                  { id: 'request', label: '2. Wire Request JSON' },
                  { id: 'response', label: '3. Raw Response Wire' },
                  { id: 'telemetry', label: '4. ⏱️ Performance & Timing' },
                  { id: 'db_logs', label: '5. 🗄️ Audit Table (llm_prompt_logs)' },
                  { id: 'guide', label: '6. Local Setup Guide' }
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setWireLogTab(t.id as any);
                      if (t.id === 'db_logs') loadDbLogs();
                    }}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                      wireLogTab === t.id
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* TAB CONTENT: PROMPT SENT */}
            {wireLogTab === 'prompt' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Exact prompt payload constructed by Astro Engine and dispatched to {narrative?.endpointUsed}:</span>
                  <button
                    onClick={() => handleCopy(narrative?.promptSent || '', 'prompt')}
                    className="flex items-center gap-1 text-amber-400 hover:text-amber-300"
                  >
                    {copied === 'prompt' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copied === 'prompt' ? 'Copied Prompt' : 'Copy Prompt'}</span>
                  </button>
                </div>
                <pre className="bg-slate-900 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-52 whitespace-pre-wrap leading-relaxed">
                  {narrative?.promptSent || 'No prompt dispatched yet.'}
                </pre>
              </div>
            )}

            {/* TAB CONTENT: REQUEST JSON */}
            {wireLogTab === 'request' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>HTTP POST Request Body ({narrative?.endpointUsed}):</span>
                  <button
                    onClick={() => handleCopy(JSON.stringify(narrative?.rawRequestBody, null, 2), 'request')}
                    className="flex items-center gap-1 text-amber-400 hover:text-amber-300"
                  >
                    {copied === 'request' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>Copy JSON</span>
                  </button>
                </div>
                <pre className="bg-slate-900 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-cyan-300 overflow-x-auto max-h-52">
                  {JSON.stringify(narrative?.rawRequestBody, null, 2)}
                </pre>
              </div>
            )}

            {/* TAB CONTENT: RAW RESPONSE JSON */}
            {wireLogTab === 'response' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>
                    HTTP Response Body Received (Status: {narrative?.httpStatus || (narrative?.connectionStatus === 'connected_live' ? 200 : 'Fallback')})
                  </span>
                  <button
                    onClick={() => handleCopy(JSON.stringify(narrative?.rawResponseBody, null, 2), 'response')}
                    className="flex items-center gap-1 text-amber-400 hover:text-amber-300"
                  >
                    {copied === 'response' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>Copy Response</span>
                  </button>
                </div>
                <pre className="bg-slate-900 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-emerald-300 overflow-x-auto max-h-52">
                  {JSON.stringify(narrative?.rawResponseBody, null, 2)}
                </pre>
              </div>
            )}

            {/* TAB CONTENT: PERFORMANCE & TIMING TELEMETRY */}
            {wireLogTab === 'telemetry' && (
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-3 text-slate-300 text-xs font-mono">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase block font-sans">Total Time Taken</span>
                    <span className="text-white font-extrabold text-sm block mt-0.5">
                      {narrative?.executionTimeMs !== undefined ? formatTimeDisplay(narrative.executionTimeMs / 1000) : 'N/A'}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase block font-sans">Throttle / Timeout</span>
                    <span className="text-amber-400 font-bold block mt-0.5">
                      {narrative?.timeoutEnforced ? `Enforced (${narrative.configuredTimeoutSeconds}s cap)` : '⚡ Full Throttle (No Limit)'}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase block font-sans">Provider Status</span>
                    <span className={`font-bold block mt-0.5 ${narrative?.connectionStatus === 'connected_live' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {narrative?.connectionStatus === 'connected_live' ? 'Live Connected' : 'Parashara Heuristic Fallback'}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase block font-sans">Model Executed</span>
                    <span className="text-cyan-300 font-bold block mt-0.5 truncate" title={narrative?.ollamaStats?.model || localOllamaModel}>
                      {narrative?.ollamaStats?.model || localOllamaModel}
                    </span>
                  </div>
                </div>

                {narrative?.ollamaStats && (
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
                    <span className="text-[11px] font-sans font-bold text-white block">Ollama Engine Internal Telemetry:</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-500 block">Prompt Tokens:</span>
                        <span className="text-slate-200 font-bold">{narrative.ollamaStats.promptEvalCount || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Output Tokens:</span>
                        <span className="text-slate-200 font-bold">{narrative.ollamaStats.evalCount || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Load Duration:</span>
                        <span className="text-slate-200 font-bold">{narrative.ollamaStats.loadDurationMs ? `${(narrative.ollamaStats.loadDurationMs / 1000).toFixed(2)}s` : 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Generation Speed:</span>
                        <span className="text-emerald-400 font-bold">
                          {narrative.ollamaStats.evalCount && narrative.ollamaStats.totalDurationMs
                            ? `${(narrative.ollamaStats.evalCount / (narrative.ollamaStats.totalDurationMs / 1000)).toFixed(1)} tokens/sec`
                            : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: DATABASE AUDIT TABLE LOGS */}
            {wireLogTab === 'db_logs' && (
              <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-3 text-slate-300">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-white text-xs">PostgreSQL Table: <code className="text-emerald-400 bg-slate-950 px-1.5 py-0.5 rounded font-mono">llm_prompt_logs</code></span>
                    <span className="text-[11px] text-slate-400 hidden sm:inline">(Auto-persists every inference across Ollama, Gemini &amp; Claude)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={loadDbLogs}
                      disabled={loadingDbLogs}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-mono flex items-center gap-1 border border-slate-700 transition"
                    >
                      <RotateCcw className={`w-3 h-3 ${loadingDbLogs ? 'animate-spin text-amber-400' : 'text-slate-400'}`} />
                      Refresh Logs
                    </button>
                    <button
                      onClick={() => handleCopy(`CREATE SEQUENCE IF NOT EXISTS llm_prompt_log_seq MINVALUE 1 MAXVALUE 100 START WITH 1 INCREMENT BY 1 CYCLE;

CREATE TABLE IF NOT EXISTS llm_prompt_logs (
    id SERIAL PRIMARY KEY,
    log_id VARCHAR(64) UNIQUE NOT NULL,
    running_number INTEGER NOT NULL,
    engine VARCHAR(50) NOT NULL,
    model_name VARCHAR(100),
    fired_at TIMESTAMP WITH TIME ZONE NOT NULL,
    prompt_text TEXT NOT NULL,
    response_text TEXT NOT NULL,
    time_taken_ms INTEGER NOT NULL,
    status VARCHAR(30) DEFAULT 'SUCCESS',
    response_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_llm_prompt_logs_engine ON llm_prompt_logs(engine);
CREATE INDEX IF NOT EXISTS idx_llm_prompt_logs_fired_at ON llm_prompt_logs(fired_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_prompt_logs_running ON llm_prompt_logs(running_number);`, 'sql_script')}
                      className="px-2 py-0.5 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-[11px] font-mono flex items-center gap-1 border border-emerald-500/30 transition"
                    >
                      {copied === 'sql_script' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copied === 'sql_script' ? 'Copied DDL SQL!' : 'Copy SQL Script'}</span>
                    </button>
                  </div>
                </div>

                {/* Current Active Run Card */}
                {narrative?.logId ? (
                  <div className="space-y-2.5">
                    {/* Fallback Diagnostic Callout */}
                    {narrative.connectionStatus === 'connection_failed_fallback' && (
                      <div className="p-3 bg-amber-950/70 border border-amber-500/60 rounded-xl space-y-1.5 text-xs">
                        <div className="flex items-center gap-2 font-bold text-amber-300">
                          <AlertCircle className="w-4 h-4 text-amber-400" />
                          <span>Status: FALLBACK — Heuristic Engine Recorded in Audit Table</span>
                        </div>
                        <p className="text-slate-300 font-mono text-[11px] leading-relaxed">
                          <strong>Reason cloud request did not reach Gemini:</strong> {narrative.connectionError}
                        </p>
                        <p className="text-purple-300 text-[10.5px]">
                          <strong>Action:</strong> Paste your Gemini API key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="underline text-amber-300 hover:text-white">Google AI Studio</a> into the Gemini Key input in the header and click "⚡ Test Key".
                        </p>
                      </div>
                    )}

                    <div className="p-2.5 bg-slate-950 rounded-lg border border-emerald-500/30 grid grid-cols-2 md:grid-cols-5 gap-2 text-[11px] font-mono">
                      <div>
                        <span className="text-slate-500 block">Current Log ID</span>
                        <span className="text-emerald-300 font-bold">{narrative.logId}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Running Seq #</span>
                        <span className="text-white font-bold">#{narrative.runningNumber || '1'} (Cycle 1..100)</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Engine &amp; Model</span>
                        <span className="text-amber-300 font-bold truncate block">{narrative.providerUsed === 'local_qwen' ? 'Ollama' : narrative.providerUsed === 'gemini_pro' ? 'Gemini' : narrative.providerUsed === 'claude_fable' ? 'Claude Fable 5.1' : narrative.providerUsed === 'claude_haiku' ? 'Claude Haiku 5.5' : 'Claude Sonnet 5.5'} ({narrative.ollamaStats?.model || (narrative.providerUsed === 'gemini_pro' ? (geminiModel || 'gemini-2.5-flash') : narrative.providerUsed === 'claude_fable' ? 'claude-fable-5-1' : narrative.providerUsed === 'claude_haiku' ? (anthropicModel || 'claude-haiku-5-5') : (narrative.providerUsed === 'claude_sonnet' || narrative.providerUsed === 'claude') ? (anthropicModel || 'claude-sonnet-5-5') : 'qwen2.5:7b-instruct')})</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Time Taken</span>
                        <span className="text-cyan-300 font-bold">{narrative.executionTimeMs} ms</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Persistence Target</span>
                        <span className={`font-bold truncate block ${narrative.pgPersisted ? 'text-emerald-400' : 'text-slate-300'}`}>
                          {narrative.persistedIn || 'stored_prompt_logs.json'}
                        </span>
                      </div>
                    </div>

                    {/* Exact SQL Insert Statement with 1-Click Copy */}
                    <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                          <Database className="w-3.5 h-3.5" />
                          <span>Exact SQL Insert Statement for <code className="font-mono text-white">llm_prompt_logs</code>:</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleRetryDbInsert}
                            disabled={retryingInsert}
                            className="px-2.5 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 text-[11px] font-mono flex items-center gap-1 border border-indigo-500/40 transition cursor-pointer"
                            title="Trigger database insertion again"
                          >
                            <RotateCcw className={`w-3 h-3 ${retryingInsert ? 'animate-spin text-amber-400' : ''}`} />
                            <span>{retryingInsert ? 'Sending...' : 'Retry DB Insert'}</span>
                          </button>
                          <button
                            onClick={() => handleCopy(
                              narrative.sqlInsert || `INSERT INTO llm_prompt_logs (log_id, running_number, engine, model_name, fired_at, prompt_text, response_text, time_taken_ms, status) VALUES ('${narrative.logId || 'LOG-RUN-001'}', ${narrative.runningNumber || 1}, '${narrative.providerUsed === 'local_qwen' ? 'Ollama' : narrative.providerUsed === 'gemini_pro' ? 'Gemini' : narrative.providerUsed === 'claude_fable' ? 'Claude Fable 5.1' : narrative.providerUsed === 'claude_haiku' ? 'Claude Haiku' : 'Claude Sonnet'}', '${narrative.ollamaStats?.model || (narrative.providerUsed === 'gemini_pro' ? (geminiModel || 'gemini-2.5-flash') : narrative.providerUsed === 'claude_fable' ? 'claude-fable-5-1' : narrative.providerUsed === 'claude_haiku' ? 'claude-3-5-haiku-20241022' : 'claude-3-5-sonnet-20241022')}', NOW(), '${(narrative.promptSent || '').replace(/'/g, "''")}', '${(narrative.part1_probabilityAndScope || '').replace(/'/g, "''")}', ${narrative.executionTimeMs || 0}, 'SUCCESS');`,
                              'manual_sql_insert'
                            )}
                            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-[11px] font-mono flex items-center gap-1 transition cursor-pointer shadow-sm"
                          >
                            {copied === 'manual_sql_insert' ? <Check className="w-3.5 h-3.5 text-slate-950" /> : <Copy className="w-3.5 h-3.5 text-slate-950" />}
                            <span>{copied === 'manual_sql_insert' ? 'Copied Insert SQL!' : 'Copy Exact Insert SQL'}</span>
                          </button>
                        </div>
                      </div>
                      <pre className="p-2 bg-slate-900 rounded border border-slate-800 text-[10px] text-slate-300 font-mono whitespace-pre-wrap max-h-24 overflow-y-auto select-all">
                        {narrative.sqlInsert || `INSERT INTO llm_prompt_logs (log_id, running_number, engine, model_name, fired_at, prompt_text, response_text, time_taken_ms, status) VALUES ('${narrative.logId || 'LOG-RUN-001'}', ${narrative.runningNumber || 1}, '${narrative.providerUsed === 'local_qwen' ? 'Ollama' : narrative.providerUsed === 'gemini_pro' ? 'Gemini' : narrative.providerUsed === 'claude_fable' ? 'Claude Fable 5.1' : narrative.providerUsed === 'claude_haiku' ? 'Claude Haiku' : 'Claude Sonnet'}', '${narrative.ollamaStats?.model || (narrative.providerUsed === 'gemini_pro' ? (geminiModel || 'gemini-2.5-flash') : narrative.providerUsed === 'claude_fable' ? 'claude-fable-5-1' : narrative.providerUsed === 'claude_haiku' ? 'claude-3-5-haiku-20241022' : 'claude-3-5-sonnet-20241022')}', NOW(), '${(narrative.promptSent || '').replace(/'/g, "''").slice(0, 100)}...', ..., ${narrative.executionTimeMs || 0}, 'SUCCESS');`}
                      </pre>
                    </div>

                    {/* Explanation Callout for PostgreSQL Connectivity */}
                    <div className="p-2.5 bg-slate-950/70 rounded-lg border border-slate-800/80 text-[11px] space-y-1">
                      <span className="font-semibold text-slate-300 block">💡 Why PostgreSQL table might need the bridge or manual copy:</span>
                      <p className="text-slate-400 leading-relaxed">
                        • In this sandbox environment, the web frontend runs in the cloud container, while your local PostgreSQL database is on your computer (<code className="text-slate-200">localhost:5432</code>).
                      </p>
                      <p className="text-slate-400 leading-relaxed">
                        • <strong>Option A (Automatic Bridge):</strong> Run <code className="text-amber-300 bg-slate-900 px-1 py-0.2 rounded font-mono">python run_api_server.py</code> on your computer. The UI will automatically forward every inference prompt to port 5000 and insert it into your PostgreSQL database.
                      </p>
                      <p className="text-slate-400 leading-relaxed">
                        • <strong>Option B (Manual 1-Click):</strong> Click <strong className="text-emerald-400">"Copy Exact Insert SQL"</strong> above to paste and execute the insert directly in pgAdmin, DBeaver, or psql!
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-2 bg-slate-950 rounded border border-slate-800 text-[11px] text-slate-400">
                    💡 Click <strong>"Generate Astrological Reasoning"</strong> or select a house to fire an LLM run. It will automatically write into table <code>llm_prompt_logs</code> and display the assigned Log ID.
                  </div>
                )}

                {/* Recent Table Logs */}
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400 font-semibold block">Recent Persisted Logs ({dbLogs.length} rows):</span>
                  {loadingDbLogs ? (
                    <div className="p-4 text-center text-slate-500 font-mono text-[11px]">Loading table logs...</div>
                  ) : dbLogs.length === 0 ? (
                    <div className="p-3 bg-slate-950 rounded border border-slate-800 text-center text-slate-500 font-mono text-[11px]">
                      No previous logs found yet. Run an inference to see rows inserted into table <code>llm_prompt_logs</code>.
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-56 rounded border border-slate-800">
                      <table className="w-full text-left font-mono text-[10px]">
                        <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="p-1.5">Seq</th>
                            <th className="p-1.5">Log ID</th>
                            <th className="p-1.5">Engine &amp; Model</th>
                            <th className="p-1.5">Fired At</th>
                            <th className="p-1.5">Duration</th>
                            <th className="p-1.5">Status &amp; Diagnostic</th>
                            <th className="p-1.5">Prompt Preview</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                          {dbLogs.map((log: any, idx: number) => {
                            const connErr = log.response_json?.connection_error || log.response_json?.fallback_reason;
                            return (
                              <tr key={log.log_id || idx} className="hover:bg-slate-800/40">
                                <td className="p-1.5 text-slate-400">#{log.running_number}</td>
                                <td className="p-1.5 text-emerald-300 font-bold">{log.log_id}</td>
                                <td className="p-1.5 text-amber-300">
                                  <span>{log.engine}</span>
                                  {log.model_name && <span className="text-slate-400 text-[9px] block">({log.model_name})</span>}
                                </td>
                                <td className="p-1.5 text-slate-400">{log.fired_at ? new Date(log.fired_at).toLocaleTimeString() : '-'}</td>
                                <td className="p-1.5 text-cyan-300">{log.time_taken_ms}ms</td>
                                <td className="p-1.5">
                                  <div className="flex flex-col gap-0.5">
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold w-fit ${
                                      log.status === 'SUCCESS' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' :
                                      log.status === 'CANCELLED' ? 'bg-slate-800 text-slate-300 border border-slate-700' :
                                      'bg-amber-950 text-amber-300 border border-amber-500/40'
                                    }`}>
                                      {log.status || 'SUCCESS'}
                                    </span>
                                    {log.status === 'FALLBACK' && (
                                      <span
                                        className="text-[9px] text-rose-300 font-sans max-w-[200px] truncate cursor-help block"
                                        title={connErr || 'Parashara deterministic heuristic engine executed'}
                                      >
                                        ⚠️ {connErr ? (connErr.includes('401') ? '401 Service Account Deleted/Disabled' : connErr.slice(0, 40) + '...') : 'Fallback Engaged'}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-1.5 text-slate-400 max-w-xs truncate" title={log.prompt_text}>
                                  {log.prompt_text?.slice(0, 50)}...
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: LOCAL SETUP GUIDE */}
            {wireLogTab === 'guide' && (
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-2 text-slate-300">
                <p className="font-semibold text-white">How to run Private LLM locally on your machine with Ollama:</p>
                <div className="space-y-1 font-mono text-[11px]">
                  <p className="text-slate-400">1. Install Ollama from <a href="https://ollama.com" target="_blank" rel="noreferrer" className="text-amber-400 underline">ollama.com</a>.</p>
                  <p className="text-slate-400">2. Pull and start Qwen 2.5 7B with CORS origin permitted for the web browser:</p>
                  <div className="p-2 bg-slate-950 rounded border border-slate-800 text-emerald-400">
                    OLLAMA_ORIGINS="*" ollama run qwen2.5:7b-instruct
                  </div>
                  <p className="text-slate-400">3. On Windows (CMD):</p>
                  <div className="p-2 bg-slate-950 rounded border border-slate-800 text-emerald-400">
                    set OLLAMA_ORIGINS=* && ollama serve
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">
                  Once started, the Astro Engine automatically routes all inquiries directly to your local hardware on <code className="text-amber-300">http://localhost:11434</code> without passing through any external cloud server!
                </p>
              </div>
            )}
          </div>
        )}

        {/* MAIN BODY CONTAINER: DUAL SPLIT WITH LEFT-HAND DOCS BREADCRUMB SIDEBAR */}
        <div className="flex-1 flex overflow-hidden min-h-0 relative">
          {showDocsSidebar && (
            <DocsBreadcrumbSidebar
              currentYear={context.selectedYear}
              currentMonthIndex={context.selectedMonth}
              currentContext={context}
              currentNarrative={narrative}
              onLoadReportIntoApp={(newNarrative) => {
                setNarrative(newNarrative);
              }}
            />
          )}

          {/* BODY SCROLL AREA */}
          <div ref={bodyScrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-5 pb-44 relative">
          {/* USER INTERACTIVE QUERY & MIC INPUT */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={queryText}
                  onChange={e => setQueryText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                  placeholder="Ask any question (e.g. Will I buy property, get promoted, or travel this month?)..."
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-3 pr-9 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
                />
                <button
                  onClick={toggleListening}
                  className={`absolute right-2 top-2 p-1 rounded-md transition ${
                    isListening
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'text-slate-400 hover:text-amber-400'
                  }`}
                  title={isListening ? 'Listening... click to stop' : 'Click to speak question'}
                >
                  {isListening ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                </button>
              </div>

              <button
                onClick={() => handleGenerate()}
                disabled={isGenerating}
                className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow flex items-center gap-1.5 disabled:opacity-50"
              >
                {isGenerating ? (
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>Synthesize</span>
              </button>
            </div>

            {/* Quick Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] uppercase font-bold text-slate-500">Quick Prompts:</span>
              {SAMPLE_QUICK_CHIPS.map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setQueryText(chip);
                    handleGenerate(chip);
                  }}
                  className="px-2 py-0.5 rounded text-[11px] bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border border-slate-800 hover:border-slate-700 transition"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* INTERACTIVE PROMPT STUDIO & PAYLOAD EDITOR */}
          <div className="bg-slate-950 border border-amber-500/30 rounded-xl overflow-hidden shadow-sm">
            <div className="flex flex-wrap items-center justify-between px-3.5 py-2.5 bg-slate-900/90 border-b border-slate-800/80 gap-2">
              <button
                onClick={() => setShowPromptStudio(!showPromptStudio)}
                className="flex items-center gap-2 text-xs font-bold text-slate-200 hover:text-amber-300 transition cursor-pointer"
                title="Click to view and edit the raw astrological prompt sent to the LLM"
              >
                <Code className="w-4 h-4 text-amber-400" />
                <span>Vedic Prompt &amp; Reasoning Studio</span>
                {isPromptCustomized ? (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    ✏️ Editable Custom Override Active
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    System Generated (Editable)
                  </span>
                )}
                {showPromptStudio ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
              </button>

              <div className="flex items-center gap-2 text-[11px]">
                <button
                  onClick={handleResetPromptToDefault}
                  disabled={!isPromptCustomized}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition cursor-pointer"
                  title="Reset prompt back to system-generated astronomical ephemeris payload"
                >
                  <RotateCcw className="w-3 h-3 text-slate-400" />
                  <span>Reset Base Prompt</span>
                </button>

                <button
                  onClick={() => handleCopy(editablePrompt, 'studio-prompt')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                >
                  {copied === 'studio-prompt' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                  <span>{copied === 'studio-prompt' ? 'Copied' : 'Copy Prompt'}</span>
                </button>

                <button
                  onClick={handleRefireWithCustomPrompt}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition shadow disabled:opacity-50 cursor-pointer"
                  title="Submit this exact edited prompt payload to the LLM reasoning engine"
                >
                  {isGenerating ? <RotateCcw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 fill-current" />}
                  <span>🚀 Send Prompt to LLM</span>
                </button>
              </div>
            </div>

            {showPromptStudio && (
              <div className="p-3 bg-slate-950/90 space-y-3 border-t border-slate-800">
                {/* TWO-FOLD NAVIGATION TABS */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                    <button
                      onClick={() => setPromptStudioFold('plain')}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        promptStudioFold === 'plain'
                          ? 'bg-amber-500 text-slate-950 shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Code className="w-3.5 h-3.5" />
                      <span>Fold 1: Plain Text Prompt (Editable)</span>
                    </button>
                    <button
                      onClick={() => setPromptStudioFold('structured')}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        promptStudioFold === 'structured'
                          ? 'bg-amber-500 text-slate-950 shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Fold 2: Structured Data Payloads (Clean Cards)</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-950/60 font-mono text-cyan-300">
                        Parashara
                      </span>
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-400 font-mono hidden sm:block">
                    <span className="text-amber-400 font-semibold">{editablePrompt.length}</span> chars &bull; ~{Math.round(editablePrompt.length / 4)} tokens
                  </div>
                </div>

                {promptStudioFold === 'plain' ? (
                  /* FOLD 1: PLAIN TEXT PROMPT (EDITABLE & SUBMITTABLE) */
                  <div className="space-y-2.5">
                    {/* Domain Focus Quick Injection Chips */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400 mr-1 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        Inject Focused Questions:
                      </span>
                      <button
                        onClick={() => handleApplyPreset('career')}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-900 hover:bg-slate-800 text-amber-300 hover:text-amber-200 border border-slate-800 hover:border-amber-500/50 transition cursor-pointer flex items-center gap-1"
                        title="Append specific career questions: employment status inference test, job search momentum, kind of job, and new vs existing job phase"
                      >
                        <span>💼</span>
                        <span>Career &amp; Employment Status Test</span>
                      </button>
                      <button
                        onClick={() => handleApplyPreset('love')}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-900 hover:bg-slate-800 text-rose-300 hover:text-rose-200 border border-slate-800 hover:border-rose-500/50 transition cursor-pointer flex items-center gap-1"
                        title="Append specific love questions: existing crush trajectory, new crush possibility, romance chemistry, and classical marriage vs living-together manifestation"
                      >
                        <span>❤️</span>
                        <span>Love, Crush &amp; Romance Weather</span>
                      </button>
                      <button
                        onClick={() => handleApplyPreset('finance')}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-900 hover:bg-slate-800 text-sky-300 hover:text-sky-200 border border-slate-800 hover:border-sky-500/50 transition cursor-pointer flex items-center gap-1"
                      >
                        <span>💰</span>
                        <span>Finances &amp; Inflows</span>
                      </button>
                      <button
                        onClick={() => handleApplyPreset('health')}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-900 hover:bg-slate-800 text-emerald-300 hover:text-emerald-200 border border-slate-800 hover:border-emerald-500/50 transition cursor-pointer flex items-center gap-1"
                      >
                        <span>🩺</span>
                        <span>Health &amp; Sukha</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>Edit instructions or custom questions directly below before sending to {activeProvider}:</span>
                      <span className="text-amber-400 font-semibold sm:hidden">
                        {editablePrompt.length} chars &bull; ~{Math.round(editablePrompt.length / 4)} tokens
                      </span>
                    </div>

                    <textarea
                      value={editablePrompt}
                      onChange={e => {
                        setEditablePrompt(e.target.value);
                        setIsPromptCustomized(true);
                      }}
                      rows={12}
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-lg p-3 font-mono text-[11px] text-slate-200 focus:outline-none focus:border-amber-500 transition leading-relaxed resize-y selection:bg-amber-500/30"
                      placeholder="System prompt will populate here..."
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                      <div className="flex items-center gap-2">
                        <span>💡 Edit any text, rule, or test inquiry above and click <strong>"🚀 Send Prompt to LLM"</strong>.</span>
                        {isPromptCustomized && (
                          <span className="text-amber-300 font-bold">● Custom prompt active</span>
                        )}
                      </div>
                      <button
                        onClick={handleRefireWithCustomPrompt}
                        disabled={isGenerating}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition shadow disabled:opacity-50 cursor-pointer"
                      >
                        {isGenerating ? <RotateCcw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                        <span>Submit Prompt to Reasoning Engine</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* FOLD 2: STRUCTURED DATA PAYLOADS (CLEAN EYE CARDS) */
                  <div className="space-y-3 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300 text-[11px] leading-relaxed flex items-center justify-between">
                      <span>
                        🔍 <strong>Structured Vedic Ground Truth Payload:</strong> All mathematical counts below (Tara Bala, Chandra Bala, SAV points, and Dasha lord dignities) are pre-calculated by deterministic code and fed into the prompt so the LLM does not hallucinate.
                      </span>
                      <button
                        onClick={() => setPromptStudioFold('plain')}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold cursor-pointer text-[10px] shrink-0 ml-2"
                      >
                        Switch to Raw Text
                      </button>
                    </div>

                    {/* CARD 1: TARA BALA (9-FOLD STELLAR QUALITY FROM JANMA STAR) */}
                    <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-1 border-b border-slate-800 pb-1.5">
                        <span className="font-bold text-amber-400 flex items-center gap-1.5">
                          <span>🌟</span>
                          <span>1. Tara Bala of Transiting Planets (from Janma Star: {context.natalJanmaStar?.nakshatra_name || 'Anuradha'} P{context.natalJanmaStar?.pada || 2})</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          9-Fold Parashara Count
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {context.taraBalaTransitPlanets && context.taraBalaTransitPlanets.length > 0 ? (
                          context.taraBalaTransitPlanets.map((t, idx) => (
                            <div
                              key={idx}
                              className={`p-2 rounded-lg border text-[11px] space-y-1 ${
                                t.isAuspicious
                                  ? 'bg-emerald-950/20 border-emerald-500/30'
                                  : t.taraNumber === 7
                                  ? 'bg-rose-950/30 border-rose-500/40'
                                  : 'bg-slate-950 border-slate-800'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-white">{t.graha_key}</span>
                                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                  t.isAuspicious
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : t.taraNumber === 7
                                    ? 'bg-rose-500/20 text-rose-300'
                                    : 'bg-amber-500/20 text-amber-300'
                                }`}>
                                  {t.taraName.split(' ')[0]} (T{t.taraNumber})
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400">
                                in <strong className="text-slate-300">{t.transit_star}</strong> (Pada {t.pada})
                              </div>
                              <p className="text-[10px] text-slate-300 leading-tight">
                                {t.description}
                              </p>
                            </div>
                          ))
                        ) : (
                          <div className="text-slate-500 italic p-2">Standard Tara Bala mapped in prompt</div>
                        )}
                      </div>
                    </div>

                    {/* CARD 2: CHANDRA BALA & DAILY MOON PROGRESSION TIMELINE */}
                    <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-1 border-b border-slate-800 pb-1.5">
                        <span className="font-bold text-sky-400 flex items-center gap-1.5">
                          <span>🌙</span>
                          <span>2. Chandra Bala &amp; Moon Progression (Janma Rashi: {context.natalJanmaStar?.rashi_name || 'Vrischigam'})</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          2.25-Day Cycle
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {context.chandraBalaDailyTimeline && context.chandraBalaDailyTimeline.length > 0 ? (
                          context.chandraBalaDailyTimeline.map((cb, idx) => (
                            <div
                              key={idx}
                              className={`p-2 rounded-lg border text-[11px] flex flex-wrap items-center justify-between gap-2 ${
                                cb.isChandrashtama
                                  ? 'bg-rose-950/30 border-rose-500/50 text-rose-200'
                                  : cb.isFavorable
                                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                                  : 'bg-slate-950 border-slate-800 text-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-slate-200">{cb.dayRange}:</span>
                                <span>Moon in <strong>{cb.moonSignName}</strong></span>
                                <span className="text-slate-400">({cb.moonStarName})</span>
                                <span className="px-1.5 py-0.2 rounded bg-black/30 font-mono text-[10px]">
                                  House {cb.houseFromNatalMoon} from Moon
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  cb.isChandrashtama
                                    ? 'bg-rose-500/30 text-rose-300 border border-rose-500/50'
                                    : cb.isFavorable
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : 'bg-slate-800 text-slate-300'
                                }`}>
                                  {cb.isChandrashtama ? '🚨 Chandrashtama' : cb.isFavorable ? '✓ Favorable Chandra Bala' : 'Neutral/Obstruction'}
                                </span>
                                {cb.alertFlag && !cb.isChandrashtama && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                                    Target House Transit
                                  </span>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-slate-500 italic p-2">Full Moon 2.25-day cycle provided</div>
                        )}
                      </div>
                    </div>

                    {/* CARD 3: SARVASHTAKAVARGA (SAV) CAPACITY */}
                    {context.ashtakavargaPayload && (
                      <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-1 border-b border-slate-800 pb-1.5">
                          <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                            <span>📊</span>
                            <span>3. Sarvashtakavarga (SAV) Bindus: {context.isComprehensiveMonthly || !context.houseNumber ? '12-House Distribution Overview' : `Target House ${context.houseNumber} = ${context.ashtakavargaPayload.targetHousePoints} Bindus [${context.ashtakavargaPayload.targetHouseStrength}]`}</span>
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Parashara 337 Baseline
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-1.5 text-[10px]">
                          {context.ashtakavargaPayload.savPointsDistribution.map((item, idx) => (
                            <div
                              key={idx}
                              className={`p-1.5 rounded border text-center ${
                                item.houseNumber === context.houseNumber && !context.isComprehensiveMonthly
                                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                                  : 'bg-slate-950 border-slate-800 text-slate-300'
                              }`}
                            >
                              <div className="text-slate-400 text-[9px]">House {item.houseNumber} ({item.signName.split(' ')[0]})</div>
                              <div className="text-xs font-mono font-bold mt-0.5">{item.points} Bindus</div>
                              <div className={`text-[9px] mt-0.5 ${item.points >= 30 ? 'text-emerald-400' : item.points >= 26 ? 'text-slate-400' : 'text-rose-400'}`}>
                                {item.status}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* CARD 4: DASHA LORDS KARMIC DOSSIER & TARGET BHAVA LINKAGE */}
                    {context.dashaLordsDossier && context.dashaLordsDossier.length > 0 && (
                      <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-1 border-b border-slate-800 pb-1.5">
                          <span className="font-bold text-indigo-400 flex items-center gap-1.5">
                            <span>👑</span>
                            <span>4. Dasha Lords Karmic Dossier {context.isComprehensiveMonthly || !context.houseNumber ? '(Vimshottari Triad Delivery)' : `(MD, AD, PD vs House ${context.houseNumber})`}</span>
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Rule 5 Triad Delivery
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          {context.dashaLordsDossier.map((d, idx) => (
                            <div key={idx} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1 text-[11px]">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-white">{d.role}</span>
                                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                  d.functionalNature.includes('Benefic') || d.functionalNature.includes('Yoga')
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : d.functionalNature.includes('Malefic')
                                    ? 'bg-rose-500/20 text-rose-300'
                                    : 'bg-slate-800 text-slate-300'
                                }`}>
                                  {d.functionalNature}
                                </span>
                              </div>
                              <div className="text-amber-300 font-mono font-semibold">{d.lordName}</div>
                              <div className="text-slate-400 text-[10px]">Lordship: <span className="text-slate-200">{d.ownedHousesTitle}</span></div>
                              <div className="text-slate-400 text-[10px]">Natal: <span className="text-slate-200">H{d.natalHouseOccupied} ({d.natalDignity})</span></div>
                              <div className="text-[10px] text-cyan-300/90 pt-1 border-t border-slate-800/80">
                                <strong>Impact: </strong>{d.targetConnectionReason}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* CARD 5: BHAVA STHIRA KARAKAS & REAL-WORLD OUTLET IMPACTS */}
                    {context.bhavaKarakaInfo && (
                      <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                          <span className="font-bold text-rose-400 flex items-center gap-1.5">
                            <span>🎯</span>
                            <span>5. Bhava Sthira Karakas &amp; Real-World Outlet Impacts {context.isComprehensiveMonthly || !context.houseNumber ? '(Core Life Domains)' : `(House ${context.houseNumber})`}</span>
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <span className="text-slate-400 block text-[10px]">Primary &amp; Secondary Karakas:</span>
                            <span className="text-white font-semibold">
                              {context.bhavaKarakaInfo.primaryKaraka} (Secondary: {context.bhavaKarakaInfo.secondaryKarakas.join(', ')})
                            </span>
                            <p className="text-slate-300 text-[10px] mt-1 leading-relaxed">
                              {context.bhavaKarakaInfo.significations}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Concrete Physical Outlet:</span>
                            <p className="text-emerald-300 font-medium text-[11px] leading-relaxed">
                              {context.bhavaKarakaInfo.outletImpact}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* TELEMETRY STRIP */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2">
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">Active PD Lord</span>
              <span className="text-amber-300 font-bold font-mono text-[11px] truncate block">
                {context.activeDasha.pratyantardasha}
              </span>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2">
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">Natal Grahas</span>
              <span className="text-slate-300 font-bold text-[11px] truncate block">
                {context.natalOccupants.length > 0
                  ? context.natalOccupants.map(o => o.body_name.split(' ')[0]).join(', ')
                  : 'Empty'}
              </span>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2">
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">{context.isComprehensiveMonthly || !context.houseNumber ? 'Transit Grahas (Ephemeris)' : `Transit Grahas (House ${context.houseNumber})`}</span>
              <div className="text-[11px] truncate">
                {context.transitOccupants.length > 0 ? (
                  <div className="flex flex-col gap-0.5">
                    {context.transitOccupants.map((t, idx) => (
                      <span key={idx} className="text-cyan-300 font-bold block truncate" title={`${t.graha_key}: ${t.degree_sputa || 'N/A'}, ${t.nakshatra_name || 'N/A'} Pada ${t.pada || '?'}`}>
                        {t.graha_key} {t.degree_sputa ? `(${t.degree_sputa})` : ''} {t.nakshatra_name ? `• ${t.nakshatra_name} P${t.pada || '?'}` : ''}{t.is_retrograde ? ' [R]' : ''}{t.is_custom ? ' [Custom]' : ''}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-400 font-medium">No Direct Ingress (Governed via Drishti)</span>
                )}
              </div>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2">
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">Micro Peak Window</span>
              <span className="text-emerald-400 font-bold text-[11px] truncate block">
                {narrative?.peakDateRange || 'Evaluating...'}
              </span>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2">
              <span className="text-[10px] text-slate-500 uppercase block font-semibold flex items-center justify-between">
                <span>Time Taken</span>
                <Clock className="w-2.5 h-2.5 text-amber-400" />
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-amber-300 font-mono font-bold text-[12px]">
                  {narrative?.executionTimeMs !== undefined
                    ? formatTimeDisplay(narrative.executionTimeMs / 1000)
                    : isGenerating
                    ? formatTimeDisplay(elapsedSeconds)
                    : 'N/A'}
                </span>
                <span className="text-[9px] text-slate-400 font-mono truncate">
                  {narrative?.providerUsed === 'local_qwen' ? (narrative.connectionStatus === 'connected_live' ? '• Live' : '• Fallback') : ''}
                </span>
              </div>
            </div>
          </div>

          {/* 3-PART SYNTHESIZED NARRATIVE DISPLAY */}
          {isGenerating ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RotateCcw className="w-8 h-8 text-amber-400 animate-spin" />
              <div className="text-center space-y-1">
                <p className="text-xs font-mono font-bold text-white">
                  Running {LLM_PROVIDERS[activeProvider].name} {activeProvider === 'local_qwen' ? `(${localOllamaModel})` : ''}...
                </p>
                {activeProvider === 'local_qwen' && (
                  enableTimeout ? (
                    <div className="space-y-1.5 mt-2">
                      <p className="text-[11px] text-amber-300 font-mono">
                        Executing 7B local inference on your hardware:{' '}
                        <span className="font-bold text-white text-xs">{formatTimeDisplay(elapsedSeconds)}</span> / {timeoutSeconds}s limit
                      </p>
                      <div className="w-56 h-1.5 bg-slate-800 rounded-full mx-auto overflow-hidden border border-slate-700/60">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-rose-500 transition-all duration-1000"
                          style={{ width: `${Math.min(100, (elapsedSeconds / timeoutSeconds) * 100)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono flex items-center justify-center gap-1">
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>Enforced timeout active ({timeoutSeconds}s limit): auto-aborts if hardware takes longer</span>
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 mt-2">
                      <p className="text-[11px] text-emerald-300 font-mono">
                        Executing 7B (Ollama) inference at <span className="font-bold text-white">Full Throttle</span>:{' '}
                        <span className="font-extrabold text-white text-sm bg-slate-900 px-2 py-0.5 rounded border border-emerald-500/40">{formatTimeDisplay(elapsedSeconds)} elapsed</span>
                      </p>
                      <div className="w-56 h-1.5 bg-slate-800 rounded-full mx-auto overflow-hidden border border-slate-700/60 relative">
                        <div className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 rounded-full animate-pulse w-full" />
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono flex items-center justify-center gap-1">
                        <Zap className="w-3 h-3 text-emerald-400" />
                        <span>Running full-time on your local hardware until completion.</span>
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : narrative ? (
            <div className="space-y-3.5">
              {/* CONTEXTUAL ERROR & QUOTA BANNERS */}
              {narrative.connectionError && (
                <>
                  {/* 1. GEMINI QUOTA / RATE LIMIT / PAID TIER NOTICE */}
                  {narrative.providerUsed === 'gemini_pro' && (narrative.connectionError.includes('RESOURCE_EXHAUSTED') || narrative.connectionError.includes('quota') || narrative.connectionError.includes('429') || narrative.connectionError.includes('limit')) ? (
                    <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-500/50 text-purple-200 text-xs space-y-2.5 shadow-md animate-fadeIn">
                      <div className="flex items-start gap-2.5">
                        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-bold text-amber-300 text-sm flex items-center gap-1.5">
                              <span>♊ Gemini Quota / Rate Limit Alert</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">429 RESOURCE_EXHAUSTED</span>
                            </span>
                          </div>
                          <p className="text-slate-300 text-xs leading-relaxed">
                            {narrative.connectionError}
                          </p>
                          <div className="p-2.5 rounded-lg bg-slate-900/90 border border-purple-500/30 text-[11px] text-slate-300 space-y-1.5">
                            <p className="font-bold text-purple-300">💡 Why am I hitting quota even though I am on a Paid Tier with a Paid API Key?</p>
                            <ul className="list-disc list-inside space-y-1 text-slate-300/90 pl-1">
                              <li><strong>GCP Project Mismatch:</strong> In <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-amber-400 underline hover:text-white inline-flex items-center gap-0.5">Google AI Studio <ExternalLink className="w-2.5 h-2.5" /></a>, API keys are tied to a specific project. If your key was generated under the default project, it remains on the <em>Free Tier</em> even if billing is activated on another project. Create a new key selecting your billed GCP project.</li>
                              <li><strong>Per-Minute Burst Rate Limits (RPM):</strong> Even Paid Tier 1 enforces strict requests-per-minute (RPM) and token-per-minute limits. Rapid repeated requests trigger temporary 429 throttling.</li>
                              <li><strong>Billing Budget / Safety Cap:</strong> Check Google Cloud Console &gt; Billing &gt; Budgets &amp; alerts to confirm no hard spend limits were reached.</li>
                            </ul>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <span className="text-[11px] text-slate-400 font-semibold">Immediate unlimited local option:</span>
                            <button
                              type="button"
                              onClick={() => onChangeProvider('local_qwen')}
                              className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1 shadow transition cursor-pointer"
                            >
                              <span>🖥️ Switch to Local 7B (Ollama)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onChangeProvider('claude_sonnet')}
                              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1 shadow transition cursor-pointer"
                            >
                              <span>🧠 Switch to Claude Sonnet</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onChangeProvider('claude_haiku')}
                              className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1 shadow transition cursor-pointer"
                            >
                              <span>📜 Switch to Claude Haiku / Fable</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : narrative.providerUsed === 'gemini_pro' && (narrative.connectionError.includes('API Key Invalid') || narrative.connectionError.includes('INVALID_ARGUMENT')) ? (
                    /* 2. GEMINI INVALID KEY */
                    <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2.5 shadow-sm">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="font-bold text-rose-300 block">Invalid Gemini API Key</span>
                        <p className="leading-relaxed text-slate-300 text-[11px]">
                          {narrative.connectionError}
                        </p>
                      </div>
                    </div>
                  ) : narrative.providerUsed === 'local_qwen' && narrative.connectionError.includes('timed out') ? (
                    /* 3. LOCAL LLM TIMEOUT */
                    <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2.5 shadow-sm">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="font-bold text-rose-300 block">
                          Local LLM Timed Out ({narrative.configuredTimeoutSeconds ? `${narrative.configuredTimeoutSeconds}s limit` : 'timeout'} exceeded):
                        </span>
                        <p className="leading-relaxed text-slate-300 text-[11px]">
                          {narrative.connectionError}
                        </p>
                        <p className="text-[11px] text-amber-300 mt-1">
                          💡 <strong>Tip:</strong> Click <button type="button" onClick={() => { setEnableTimeout(false); localStorage.setItem('astro_ollama_enable_timeout', 'false'); }} className="underline font-bold text-white hover:text-amber-200 cursor-pointer">⚡ Full Throttle</button> in the inspector header above to run without any timeout limits.
                        </p>
                      </div>
                    </div>
                  ) : (narrative.providerUsed === 'claude_sonnet' || narrative.providerUsed === 'claude_haiku' || narrative.providerUsed === 'claude_fable' || narrative.providerUsed === 'claude') ? (
                    /* 4. ANTHROPIC CLAUDE MISSING KEY, QUOTA, OR MODEL ISSUE CARD */
                    <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-500/40 text-purple-200 text-xs space-y-2.5 shadow-md animate-fadeIn">
                      <div className="flex items-start gap-2.5">
                        <AlertCircle className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-bold text-amber-300 text-sm flex items-center gap-1.5">
                              <span>🧠 Anthropic Claude ({narrative.providerUsed === 'claude_fable' ? 'Claude Fable 5.1' : narrative.providerUsed === 'claude_haiku' ? 'Claude Haiku 5.5' : 'Claude Sonnet 5.5'})</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                                {narrative.connectionError?.includes('Credit balance') ? 'CREDITS NEEDED' : narrative.connectionError?.includes('Model') || narrative.connectionError?.includes('snapshot') ? 'MODEL AVAILABILITY' : 'KEY REQUIRED'}
                              </span>
                            </span>
                          </div>
                          <p className="text-slate-300 text-xs leading-relaxed">
                            {narrative.connectionError}
                          </p>
                          <div className="p-3 rounded-lg bg-slate-900/90 border border-purple-500/30 text-[11px] text-slate-300 space-y-2">
                            <p className="font-bold text-purple-300">💡 Configure &amp; Test Live Claude 5.5:</p>
                            <ol className="list-decimal list-inside space-y-1 text-slate-300/90 pl-1">
                              <li>Configured with latest <strong className="text-amber-300">Claude Sonnet 5.5</strong> (<code className="text-purple-300 font-mono">claude-sonnet-5-5</code>) and <strong className="text-amber-300">Claude Haiku 5.5</strong> (<code className="text-purple-300 font-mono">claude-haiku-5-5</code>).</li>
                              <li>Ensure you have active balance/credits at <a href="https://console.anthropic.com/settings/plans" target="_blank" rel="noreferrer" className="text-amber-400 underline hover:text-white inline-flex items-center gap-0.5">console.anthropic.com/settings/plans <ExternalLink className="w-2.5 h-2.5" /></a>.</li>
                              <li>Enter your API key below or in your local <code className="text-slate-200">.env</code> as <code className="text-amber-300 bg-slate-950 px-1 py-0.5 rounded font-mono">ANTHROPIC_API_KEY="sk-ant-..."</code>.</li>
                            </ol>
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              {narrative.providerUsed === 'claude_fable' ? (
                                <span className="px-2 py-1 text-xs font-mono text-purple-200">claude-fable-5-1</span>
                              ) : (
                                <select
                                  value={anthropicModel}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setAnthropicModel(val);
                                    localStorage.setItem('astro_anthropic_model', val);
                                  }}
                                  className="bg-slate-950 border border-purple-500/60 rounded px-2 py-1 text-xs font-mono text-purple-200 focus:outline-none cursor-pointer"
                                >
                                  <option value="claude-sonnet-5-5">Claude Sonnet 5.5 (Default &amp; Recommended)</option>
                                  <option value="claude-haiku-5-5">Claude Haiku 5.5 (Fast &amp; Low Cost)</option>
                                  <option value="claude-opus-5-5">Claude Opus 5.5 (Flagship Deep Reasoning)</option>
                                  <option value="claude-3-5-sonnet-latest">Claude 3.5 Sonnet (Legacy)</option>
                                  <option value="claude-3-7-sonnet-latest">Claude 3.7 Sonnet</option>
                                  <option value="claude-3-5-haiku-latest">Claude 3.5 Haiku (Legacy)</option>
                                  <option value="claude-3-haiku-20240307">Claude 3 Haiku (Legacy Tier 1)</option>
                                </select>
                              )}
                              <input
                                type="password"
                                value={anthropicApiKey}
                                onChange={(e) => {
                                  const val = e.target.value.trim();
                                  setAnthropicApiKey(val);
                                  localStorage.setItem('astro_anthropic_api_key', val);
                                }}
                                placeholder="Paste your Claude API Key (sk-ant-...)"
                                className="bg-slate-950 border border-purple-500/50 rounded px-2.5 py-1 text-xs font-mono text-amber-200 focus:outline-none w-64 placeholder:text-slate-600"
                              />
                              <button
                                type="button"
                                onClick={() => handleGenerate()}
                                className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer shadow"
                              >
                                Save &amp; Test Live
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* 5. GENERAL CONNECTION FALLBACK NOTICE */
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-700/80 text-slate-300 text-xs flex items-start gap-2.5 shadow-sm">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <span className="font-bold text-amber-300 block">Notice: Operating on Analytical Parashara Heuristic Engine</span>
                        <p className="text-[11px] text-slate-400">{narrative.connectionError}</p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* CLAUDE EXTENDED THINKING PROCESS ACCORDION */}
              {narrative.thinkingContent && (
                <div className="bg-purple-950/30 border border-purple-500/40 rounded-xl p-3.5 space-y-2 text-xs shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-purple-300 flex items-center gap-1.5">
                      <span>🧠</span>
                      <span>Claude Sonnet 5.5 Chain of Thought / Internal Reasoning</span>
                      {narrative.rawResponseBody?.usage?.output_tokens_details?.thinking_tokens ? (
                        <span className="text-[10px] px-2 py-0.5 bg-purple-900/60 text-purple-200 rounded font-mono border border-purple-500/30">
                          {narrative.rawResponseBody.usage.output_tokens_details.thinking_tokens} thinking tokens
                        </span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowThinkingBlock(!showThinkingBlock)}
                      className="text-[11px] text-purple-300 hover:text-white underline font-mono cursor-pointer transition"
                    >
                      {showThinkingBlock ? 'Hide Thinking ▲' : 'View Reasoning Scratchpad ▼'}
                    </button>
                  </div>
                  {showThinkingBlock && (
                    <div className="p-3 bg-slate-950/90 rounded-lg border border-purple-500/30 font-mono text-[11px] text-purple-200/95 whitespace-pre-wrap max-h-72 overflow-y-auto leading-relaxed">
                      {narrative.thinkingContent}
                    </div>
                  )}
                </div>
              )}

              {/* Summary Bottom Line */}
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-medium leading-relaxed shadow-sm">
                <span className="font-bold text-amber-400 block mb-0.5">Bottom-Line Synthesis:</span>
                {narrative.summarySentence}
              </div>

              {/* DUAL EVALUATION: NATAL PROMISE VS. GOCHARA TRANSIT STRENGTH */}
              {narrative.natalPromiseVsTransitDelivery && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2.5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                      <ShieldCheck className="w-4 h-4 text-amber-400" />
                      <span>Natal Karmic Promise vs. Gochara Transit Delivery Capacity</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      Net Probability: {(narrative.overallConfidence * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-semibold">1. Natal Promise (D1/D9 Birth Grid)</span>
                        <span className="text-amber-400 font-bold font-mono">
                          {((narrative.natalPromiseVsTransitDelivery.natalPromiseScore || 0.88) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-normal">
                        {narrative.natalPromiseVsTransitDelivery.natalPromiseVerdict}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-semibold">2. Transit Delivery (Rule 5 Gochara)</span>
                        <span className="text-cyan-400 font-bold font-mono">
                          {((narrative.natalPromiseVsTransitDelivery.transitDeliveryScore || 0.78) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-normal">
                        {narrative.natalPromiseVsTransitDelivery.transitDeliveryVerdict}
                      </p>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded border border-slate-800/80">
                    <strong className="text-amber-300">Synthesis Verdict:</strong> {narrative.natalPromiseVsTransitDelivery.synthesisVerdict}
                  </div>
                </div>
              )}

              {/* PART 1: EVENT PROBABILITY & SCOPE */}
              <div className="bg-slate-950 border border-slate-800/90 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                    <Compass className="w-4 h-4 text-amber-400" />
                    <span>Part 1: Event Probability &amp; Scope</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 font-semibold">
                    Confidence: {(narrative.overallConfidence * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                  {cleanNarrativeText(narrative.part1_probabilityAndScope)}
                </p>
              </div>

              {/* PART 2: FINANCIAL & RESOURCE SOURCES */}
              <div className="bg-slate-950 border border-slate-800/90 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-sky-400">
                    <Coins className="w-4 h-4 text-sky-400" />
                    <span>Part 2: Financial &amp; Resource Sources</span>
                  </div>
                  <span className="text-[10px] font-mono text-sky-400/80">Capital Origin</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                  {cleanNarrativeText(narrative.part2_financialAndResources)}
                </p>
              </div>

              {/* PART 3: MICRO-TIMING WINDOW */}
              <div className="bg-slate-950 border border-slate-800/90 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <span>Part 3: Micro-Timing Window (Peak 3–7 Days)</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold">
                    {narrative.peakDateRange}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                  {cleanNarrativeText(narrative.part3_microTimingWindow)}
                </p>
              </div>

              {/* SUPPLEMENTARY CROSS-DOMAIN SCENARIOS (CAREER, LOVE/CRUSH, HEALTH, FINANCE, FAMILY) */}
              {narrative.supplementaryScenarios && narrative.supplementaryScenarios.length > 0 && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between border-b border-slate-800/80 pb-2.5 gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-amber-400" />
                        <span>
                          {context.isComprehensiveMonthly
                            ? `Core Life Domains Evaluation (${MONTH_NAMES[context.selectedMonth]} ${context.selectedYear})`
                            : `Cross-Domain Readouts (House ${context.houseNumber} Impact)`}
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {context.isComprehensiveMonthly
                          ? 'Comprehensive monthly synthesis across all 5 core life domains (Career, Wealth, Love, Health, Family)'
                          : "How this month's primary house activation impacts other vital life areas via Bhavat Bhavam & Drishti"}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                      5 Scenarios Evaluated
                    </span>
                  </div>

                  {/* Domain Tabs */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {narrative.supplementaryScenarios.map(sc => (
                      <button
                        key={sc.id}
                        onClick={() => setActiveDomainTab(sc.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
                          activeDomainTab === sc.id
                            ? 'bg-amber-500 text-slate-950 font-bold shadow'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                        }`}
                      >
                        <span>{DOMAIN_ICONS[sc.id] || '✨'}</span>
                        <span>{sc.title.split(' ')[0]}</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-black/20">
                          {(sc.confidenceScore * 100).toFixed(0)}%
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Selected Domain Scenario Content */}
                  {(() => {
                    const selectedSc = narrative.supplementaryScenarios?.find(s => s.id === activeDomainTab) || narrative.supplementaryScenarios?.[0];
                    if (!selectedSc) return null;
                    return (
                      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{DOMAIN_ICONS[selectedSc.id] || '✨'}</span>
                            <span className="font-bold text-white text-xs">{selectedSc.title}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              selectedSc.verdict.toLowerCase().includes('favor')
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : selectedSc.verdict.toLowerCase().includes('caution') || selectedSc.verdict.toLowerCase().includes('friction')
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            }`}>
                              {selectedSc.verdict}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-slate-400 font-mono text-[11px]">Sub-Window:</span>
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold font-mono text-[11px]">
                              {selectedSc.timingWindow}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-bold font-mono text-[11px]">
                              Confidence: {(selectedSc.confidenceScore * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>

                        {/* DOMAIN DEEP DIVE: CAREER & JOB SEARCH + EMPLOYMENT STATUS TEST TRIGGER */}
                        {selectedSc.id === 'career_job' && (
                          <div className="space-y-2.5">
                            {/* Special Native Employment State Status Light */}
                            {selectedSc.employmentStatusInference && (
                              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="relative flex h-3 w-3">
                                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                                        selectedSc.employmentStatusInference.indicatorColor === 'green'
                                          ? 'bg-emerald-400'
                                          : selectedSc.employmentStatusInference.indicatorColor === 'yellow'
                                          ? 'bg-amber-400'
                                          : 'bg-rose-400'
                                      }`} />
                                      <span className={`relative inline-flex rounded-full h-3 w-3 ${
                                        selectedSc.employmentStatusInference.indicatorColor === 'green'
                                          ? 'bg-emerald-500'
                                          : selectedSc.employmentStatusInference.indicatorColor === 'yellow'
                                          ? 'bg-amber-500'
                                          : 'bg-rose-500'
                                      }`} />
                                    </span>
                                    <span className="text-xs font-bold text-slate-200">
                                      Native Employment State Inference:
                                    </span>
                                    <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold border ${
                                      selectedSc.employmentStatusInference.indicatorColor === 'green'
                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                        : selectedSc.employmentStatusInference.indicatorColor === 'yellow'
                                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                        : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                    }`}>
                                      {selectedSc.employmentStatusInference.label}
                                    </span>
                                  </div>
                                  <span className="text-[10px] font-mono text-slate-400">
                                    Deduction Confidence: {(selectedSc.employmentStatusInference.confidence * 100).toFixed(0)}%
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-300 leading-relaxed bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
                                  <strong className="text-amber-300">Astrological Deduction (10th Karma &amp; 6th Service): </strong>
                                  {selectedSc.employmentStatusInference.inferenceReasoning}
                                </div>
                              </div>
                            )}

                            {/* Job Search & Acquisition Details */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                              {selectedSc.jobSearchAnalysis && (
                                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                                    <span className="font-bold text-amber-400 text-[11px]">Job Search &amp; Past Struggle Phase</span>
                                    <span className="text-[10px] text-emerald-400 font-semibold">{selectedSc.jobSearchAnalysis.momentum}</span>
                                  </div>
                                  <p className="text-[11px] text-slate-300 leading-relaxed">
                                    <strong className="text-slate-400">Past Delays vs Now: </strong>
                                    {selectedSc.jobSearchAnalysis.pastStruggleVsCurrentPhase}
                                  </p>
                                  <p className="text-[11px] text-emerald-300/90 leading-relaxed">
                                    <strong className="text-emerald-400">Auspicious Offer Window: </strong>
                                    {selectedSc.jobSearchAnalysis.timingAuspiciousness}
                                  </p>
                                </div>
                              )}

                              {selectedSc.newJobAcquisition && (
                                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                                    <span className="font-bold text-sky-400 text-[11px]">New Job Acquisition &amp; Role Mood</span>
                                  </div>
                                  <p className="text-[11px] text-slate-300 leading-relaxed">
                                    <strong className="text-slate-400">Role &amp; Mood: </strong>
                                    {selectedSc.newJobAcquisition.jobTypeAndMood}
                                  </p>
                                  <p className="text-[11px] text-slate-300 leading-relaxed">
                                    <strong className="text-slate-400">Workplace Atmosphere: </strong>
                                    {selectedSc.newJobAcquisition.workplaceAtmosphere}
                                  </p>
                                  <p className="text-[11px] text-sky-300/90 leading-relaxed">
                                    <strong className="text-sky-400">Comparison with Current Role: </strong>
                                    {selectedSc.newJobAcquisition.comparisonWithCurrentRole}
                                  </p>
                                </div>
                              )}

                              {selectedSc.existingJobPhase && (
                                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5 md:col-span-2">
                                  <span className="font-bold text-indigo-400 text-[11px] block border-b border-slate-800/80 pb-1.5">
                                    Existing Job Phase (For Native Currently Serving)
                                  </span>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                                    <p className="text-slate-300 leading-relaxed">
                                      <strong className="text-slate-400">Workplace Climate &amp; Friction: </strong>
                                      {selectedSc.existingJobPhase.currentPhaseNature}
                                    </p>
                                    <p className="text-indigo-300/90 leading-relaxed">
                                      <strong className="text-indigo-400">Retention vs. Exit Advice: </strong>
                                      {selectedSc.existingJobPhase.retentionVsExitAdvice}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* DOMAIN DEEP DIVE: LOVE, CRUSH & ROMANTIC MANIFESTATION */}
                        {selectedSc.id === 'love_romance' && (
                          <div className="space-y-2.5 text-xs">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                              {selectedSc.crushStatusInference && (
                                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                                    <span className="font-bold text-rose-400 text-[11px]">Crush Outlook &amp; Potential</span>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                      New Crush: {selectedSc.crushStatusInference.newCrushProbability}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-300 leading-relaxed">
                                    <strong className="text-slate-400">Existing Crush Trajectory: </strong>
                                    {selectedSc.crushStatusInference.existingCrushTrajectory}
                                  </p>
                                  <p className="text-[11px] text-rose-300/90 leading-relaxed">
                                    <strong className="text-rose-400">New Attraction Trigger: </strong>
                                    {selectedSc.crushStatusInference.newCrushDetails}
                                  </p>
                                </div>
                              )}

                              {selectedSc.romanceAtmosphere && (
                                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                                    <span className="font-bold text-amber-400 text-[11px]">Romance Chemistry &amp; Fluttering</span>
                                    <span className="text-[10px] font-mono font-bold text-amber-300">
                                      Chemistry: {selectedSc.romanceAtmosphere.chemistryRating}%
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-300 leading-relaxed">
                                    <strong className="text-slate-400">Emotional Weather: </strong>
                                    {selectedSc.romanceAtmosphere.emotionalWeather}
                                  </p>
                                  <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800 mt-2">
                                    <div
                                      className="bg-gradient-to-r from-amber-500 to-rose-500 h-full rounded-full"
                                      style={{ width: `${selectedSc.romanceAtmosphere.chemistryRating}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            {selectedSc.manifestationPath && (
                              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-1.5">
                                  <span className="font-bold text-emerald-400 text-[11px]">Real Love Manifestation Horizon</span>
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                    {selectedSc.manifestationPath.outcomeLabel}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-300 leading-relaxed">
                                  <strong className="text-slate-400">Manifestation Outcome: </strong>
                                  {selectedSc.manifestationPath.manifestationLikelihood}
                                </p>
                                <p className="text-[11px] text-emerald-300/90 leading-relaxed">
                                  <strong className="text-emerald-400">Vedic Astrological Reasoning (5th, 7th &amp; D9): </strong>
                                  {selectedSc.manifestationPath.astrologicalPathReasoning}
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* DOMAIN DEEP DIVE: FINANCE & WEALTH */}
                        {selectedSc.id === 'finance_wealth' && selectedSc.financeDetails && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                              <span className="text-[11px] font-bold text-amber-400 block border-b border-slate-800/80 pb-1">Liquid Cashflow</span>
                              <p className="text-[11px] text-slate-300 leading-relaxed">{selectedSc.financeDetails.liquidityVsOutflow}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                              <span className="text-[11px] font-bold text-sky-400 block border-b border-slate-800/80 pb-1">Windfalls &amp; Gains</span>
                              <p className="text-[11px] text-slate-300 leading-relaxed">{selectedSc.financeDetails.windfallAndSpeculation}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                              <span className="text-[11px] font-bold text-emerald-400 block border-b border-slate-800/80 pb-1">Debt &amp; Asset Funding</span>
                              <p className="text-[11px] text-slate-300 leading-relaxed">{selectedSc.financeDetails.debtAndAssetFinancing}</p>
                            </div>
                          </div>
                        )}

                        {/* DOMAIN DEEP DIVE: HEALTH & VITALITY */}
                        {selectedSc.id === 'health_vitality' && selectedSc.healthDetails && (
                          <div className="space-y-2 text-xs">
                            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                              <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800/80 pb-1.5">
                                <span className="text-[11px] font-bold text-rose-400">Vulnerable Zones:</span>
                                {selectedSc.healthDetails.vulnerableZones.map((vz, vIdx) => (
                                  <span key={vIdx} className="px-2 py-0.5 rounded text-[10px] bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                    {vz}
                                  </span>
                                ))}
                              </div>
                              <p className="text-[11px] text-slate-300 leading-relaxed">
                                <strong className="text-slate-400">Mental Tranquility (Sukha): </strong>
                                {selectedSc.healthDetails.mentalTranquilityAndStress}
                              </p>
                              <p className="text-[11px] text-emerald-300/90 leading-relaxed">
                                <strong className="text-emerald-400">Holistic Remedies: </strong>
                                {selectedSc.healthDetails.holisticRemedies}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* DOMAIN DEEP DIVE: FAMILY & HOME */}
                        {selectedSc.id === 'family_home' && selectedSc.familyDetails && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                              <span className="text-[11px] font-bold text-amber-400 block border-b border-slate-800/80 pb-1">Domestic Ambiance</span>
                              <p className="text-[11px] text-slate-300 leading-relaxed">{selectedSc.familyDetails.domesticAmbiance}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                              <span className="text-[11px] font-bold text-pink-400 block border-b border-slate-800/80 pb-1">Maternal Wellbeing</span>
                              <p className="text-[11px] text-slate-300 leading-relaxed">{selectedSc.familyDetails.maternalWellbeing}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                              <span className="text-[11px] font-bold text-cyan-400 block border-b border-slate-800/80 pb-1">Property &amp; Relocation</span>
                              <p className="text-[11px] text-slate-300 leading-relaxed">{selectedSc.familyDetails.propertyAndRelocation}</p>
                            </div>
                          </div>
                        )}

                        {/* DETAILED MULTI-PARAGRAPH VEDIC SYNTHESIS */}
                        {selectedSc.detailedParagraphs && selectedSc.detailedParagraphs.length > 0 && (
                          <div className="space-y-2 p-3 bg-slate-950 rounded-lg border border-slate-800/80">
                            <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block">
                              In-Depth Astrological Analysis &amp; Vedic Synthesis:
                            </span>
                            {selectedSc.detailedParagraphs.map((para, pIdx) => (
                              <p key={pIdx} className="text-xs text-slate-300 leading-relaxed">
                                {para}
                              </p>
                            ))}
                          </div>
                        )}

                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                            Astrological Causal Reasoning (Drishti &amp; Karakatwa Interconnection):
                          </span>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {selectedSc.astrologicalReasoning}
                          </p>
                        </div>

                        <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
                          <span className="text-[10px] uppercase font-bold text-amber-400 block mb-0.5">
                            Actionable Real-World Guidance:
                          </span>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {selectedSc.practicalGuidance}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* MULTI-FORMAT EXPORT DOSSIER BANNER: PDF, HTML & WORD */}
              <div className="p-3.5 bg-slate-950/80 border border-amber-500/40 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-inner">
                <div className="flex items-center gap-2.5 text-slate-300">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-amber-300 text-xs">Download Full Astrological Predictions Dossier</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Complete report with all 5 life domains, Dasha triad, planetary alignment, dual natal/transit evaluation, and Parashara synthesis. Available in PDF, HTML, and Word formats.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleDownloadPdf}
                    disabled={!narrative || isExportingPdf}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold transition text-xs shadow-md disabled:opacity-40 cursor-pointer"
                    title="Download Clean PDF Dossier"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isExportingPdf ? 'Exporting...' : 'PDF'}</span>
                  </button>

                  <button
                    onClick={handleDownloadHtml}
                    disabled={!narrative}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/40 font-bold transition text-xs shadow cursor-pointer disabled:opacity-40"
                    title="Download Standalone Printable HTML Report"
                  >
                    <Globe className="w-3.5 h-3.5 text-cyan-400" />
                    <span>HTML</span>
                  </button>

                  <button
                    onClick={handleDownloadWord}
                    disabled={!narrative}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-indigo-300 border border-indigo-500/40 font-bold transition text-xs shadow cursor-pointer disabled:opacity-40"
                    title="Download Editable Word Document (.doc)"
                  >
                    <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Word (.doc)</span>
                  </button>

                  <button
                    onClick={handleDownloadAll}
                    disabled={!narrative}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-semibold transition text-xs cursor-pointer disabled:opacity-40"
                    title="Download all 3 formats (PDF + HTML + Word) in one click"
                  >
                    <span>All 3</span>
                  </button>

                  <button
                    onClick={() => setShowDocsSidebar(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 font-bold transition text-xs shadow cursor-pointer"
                    title="Open Web Server Docs Archive & Year-Wise Navigation"
                  >
                    <Folder className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Docs Archive</span>
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* FLOATING QUICK SCROLL SHORTCUTS */}
          <div className="sticky bottom-4 right-4 flex justify-end gap-2 pointer-events-none z-20">
            <div className="pointer-events-auto flex items-center gap-1.5 bg-slate-900/90 hover:bg-slate-900 backdrop-blur border border-amber-500/40 rounded-full px-3 py-1.5 shadow-xl text-xs">
              <button
                type="button"
                onClick={scrollToTop}
                className="flex items-center gap-1 text-slate-300 hover:text-white px-2 py-0.5 rounded-full hover:bg-slate-800 transition cursor-pointer"
                title="Scroll to top of report"
              >
                <ArrowUp className="w-3.5 h-3.5 text-slate-400" />
                <span>Top</span>
              </button>
              <div className="w-px h-3.5 bg-slate-700" />
              <button
                type="button"
                onClick={scrollToBottom}
                className="flex items-center gap-1 text-amber-300 hover:text-amber-200 px-2 py-0.5 rounded-full hover:bg-slate-800 transition font-bold cursor-pointer"
                title="Scroll down to all prediction domains and remedies"
              >
                <ArrowDown className="w-3.5 h-3.5 text-amber-400" />
                <span>Scroll to End</span>
              </button>
            </div>
          </div>
        </div>
      </div>

        {/* FOOTER ACTIONS */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px]">
            <span>Model: {LLM_PROVIDERS[activeProvider].model}</span>
            <span>&bull;</span>
            <span>Endpoint: {narrative?.endpointUsed || 'Localhost'}</span>
            <span>&bull;</span>
            <span>Latency: {narrative?.executionTimeMs || 0}ms</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleDownloadPdf}
              disabled={!narrative || isExportingPdf}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition disabled:opacity-50 shadow cursor-pointer text-xs"
              title="Download Astrological Predictions Report as PDF"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{isExportingPdf ? 'Exporting...' : 'PDF'}</span>
            </button>

            <button
              onClick={handleDownloadHtml}
              disabled={!narrative}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 font-bold transition disabled:opacity-50 shadow cursor-pointer text-xs"
              title="Download Printable HTML Version"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>HTML</span>
            </button>

            <button
              onClick={handleDownloadWord}
              disabled={!narrative}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-indigo-300 border border-indigo-500/30 font-bold transition disabled:opacity-50 shadow cursor-pointer text-xs"
              title="Download Editable Word Document (.doc)"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Word</span>
            </button>

            <button
              onClick={() => handleCopy(narrative?.rawMarkdown || '', 'markdown')}
              disabled={!narrative}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition disabled:opacity-50"
            >
              {copied === 'markdown' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied === 'markdown' ? 'Copied' : 'Copy Report'}</span>
            </button>

            <button
              onClick={handleDownloadReport}
              disabled={!narrative}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
          </div>
        </div>
      </div>
  );

  if (inlineView) {
    return (
      <div className="w-full flex-1 flex flex-col animate-fadeIn">
        {inspectorContent}
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 z-50 flex ${isFullScreen ? 'p-0' : 'items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md'} animate-fadeIn`}>
      {inspectorContent}
    </div>
  );
};
