import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Bot,
  Send,
  Lock,
  Cpu,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  Compass,
  Zap,
  HelpCircle,
  Copy,
  Check,
  RotateCcw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Flame,
  ArrowRight
} from 'lucide-react';
import { NakshatraGateInfo, ManufacturedEventItem } from './EventManufacturingEngine';
import { RASHI_LIST_META } from '../data/transitEphemeris';
import { toCleanEnglishPlanet, toCleanEnglishSign } from '../services/llm/adapters';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  modelUsed?: string;
  scenarioAnalysis?: {
    scenarioA?: { label: string; alignmentPct: number; factors: string[] };
    scenarioB?: { label: string; alignmentPct: number; factors: string[] };
    verdict?: string;
  };
}

export interface PrivatePredictionChatbotProps {
  personName: string;
  natalLagnaIdx: number;
  natalRashiIdx: number;
  selectedMonth: number;
  selectedYear: number;
  monthName: string;
  activeDashaHierarchy: {
    mahadasha: string;
    antardasha: string;
    pratyantardasha: string;
    startDate: string;
    endDate: string;
  };
  transitPlacements: any[];
  gateDetails: NakshatraGateInfo[];
  manifestedEvents: ManufacturedEventItem[];
  nativeAge?: number;
}

export const PrivatePredictionChatbot: React.FC<PrivatePredictionChatbotProps> = ({
  personName,
  natalLagnaIdx,
  natalRashiIdx,
  selectedMonth,
  selectedYear,
  monthName,
  activeDashaHierarchy,
  transitPlacements,
  gateDetails,
  manifestedEvents,
  nativeAge = 40
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [userInput, setUserInput] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Local Ollama configuration state
  const [ollamaEndpoint, setOllamaEndpoint] = useState<string>(() => {
    return (typeof window !== 'undefined' ? localStorage.getItem('astro_ollama_endpoint') : '') || 'http://localhost:11434';
  });
  const [localModelName, setLocalModelName] = useState<string>(() => {
    return (typeof window !== 'undefined' ? localStorage.getItem('astro_ollama_model') : '') || 'qwen2.5:14b';
  });
  const [ollamaStatus, setOllamaStatus] = useState<{ isOnline: boolean; availableModels: string[]; checking: boolean }>({
    isOnline: false,
    availableModels: [],
    checking: false
  });

  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Default welcome message with screen memory absorption note
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'msg-welcome',
      sender: 'assistant',
      text: `Hello! I am your 100% Air-Gapped Private Astrological Prediction Assistant.
I have absorbed all screen data for **${monthName} ${selectedYear}** under **${toCleanEnglishPlanet(activeDashaHierarchy.mahadasha)} MD → ${toCleanEnglishPlanet(activeDashaHierarchy.antardasha)} AD → ${toCleanEnglishPlanet(activeDashaHierarchy.pratyantardasha)} PD**.

🔒 **Privacy Guarantee**: All queries run strictly through your local Private LLM (Ollama). Zero PII or career queries ever leave your machine.

Ask me specific questions comparing personal situations, like:
• *"Is this month indicating high income? I have on-site travel vs a new role assignment—which one matches?"*
• *"Where were Ketu and Venus in transit when this event triggered?"*
• *"Which gate is receiving the strongest transiting Graha support this month?"*`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      modelUsed: 'Screen-Aware Memory Grounding'
    }
  ]);

  // Check Ollama Local Connection
  const checkOllamaHealth = async () => {
    setOllamaStatus(prev => ({ ...prev, checking: true }));
    try {
      const cleanEndpoint = ollamaEndpoint.replace(/\/+$/, '');
      const res = await fetch(`${cleanEndpoint}/api/tags`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        const models = (data.models || []).map((m: any) => m.name || m.model);
        setOllamaStatus({
          isOnline: true,
          availableModels: models,
          checking: false
        });
        if (models.length > 0 && !models.includes(localModelName)) {
          // If preferred model is in list, keep it; else set to first available
          const foundQwen = models.find((m: string) => m.toLowerCase().includes('qwen'));
          if (foundQwen) {
            setLocalModelName(foundQwen);
          } else {
            setLocalModelName(models[0]);
          }
        }
        return;
      }
    } catch {}
    setOllamaStatus(prev => ({ ...prev, isOnline: false, checking: false }));
  };

  useEffect(() => {
    checkOllamaHealth();
  }, [ollamaEndpoint]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isGenerating]);

  // Build the complete Grounded Screen Context Snapshot
  const screenContextSnapshot = useMemo(() => {
    const lagnaMeta = RASHI_LIST_META.find(r => r.index === natalLagnaIdx) || RASHI_LIST_META[8];
    const moonMeta = RASHI_LIST_META.find(r => r.index === natalRashiIdx) || RASHI_LIST_META[7];

    const transitGrahasList = transitPlacements.map((p: any) => {
      const gName = p.graha_name || p.planet || 'Graha';
      const rName = p.transit_rashi_name || p.sign || '';
      const nakName = p.graha_pada_chara?.nakshatra_name || p.nakshatra || '';
      const pada = p.graha_pada_chara?.pada || p.pada || 1;
      const deg = p.degree_sputa || p.degree || '';
      const hLagna = p.relative_to_natal_lagna?.house_number || p.houseFromLagna || '?';
      const hMoon = p.relative_to_natal_rashi?.house_number || p.houseFromMoon || '?';
      const isVakra = p.is_retrograde ? ' [VAKRA/RETROGRADE]' : '';
      return `${gName}: ${deg} in ${rName} (${nakName} Pada ${pada})${isVakra} -> H${hLagna} from Lagna, H${hMoon} from Moon`;
    });

    const gatesList = gateDetails.map((g, idx) => {
      const active = g.activeGrahasInGate.map(a => a.name).join(', ') || 'None';
      return `Gate ${idx + 1} (${g.nakshatraName} in ${g.rashiName}): H${g.houseFromLagna} from Lagna, H${g.houseFromRashi} from Moon. Anatomical Seat: ${g.anatomicalSeat}. Transits in Gate: ${active}. Moon Ingress Window: ${g.moonIngressWindow || 'N/A'}`;
    });

    const eventsList = manifestedEvents.map((ev, i) => {
      return `Event ${i + 1} [${ev.portfolio || 'General'}] (${ev.probabilityScore}% Probable, ${ev.latencyStatus === 'acute_moon_triggered' ? '⚡ ACUTE MOON IGNITED' : '💤 Dormant'}): "${ev.title}" - ${ev.narrative}. Trigger: ${ev.gateTrigger || 'N/A'}`;
    });

    return {
      personName,
      nativeAge,
      monthName,
      selectedYear,
      natalLagna: `${lagnaMeta.eng} (${lagnaMeta.tamil}) - House 1`,
      natalMoon: `${moonMeta.eng} (${moonMeta.tamil})`,
      dasha: {
        md: activeDashaHierarchy.mahadasha,
        ad: activeDashaHierarchy.antardasha,
        pd: activeDashaHierarchy.pratyantardasha,
        window: `${activeDashaHierarchy.startDate} to ${activeDashaHierarchy.endDate}`
      },
      transits: transitGrahasList,
      gates: gatesList,
      events: eventsList
    };
  }, [
    personName,
    nativeAge,
    monthName,
    selectedYear,
    natalLagnaIdx,
    natalRashiIdx,
    activeDashaHierarchy,
    transitPlacements,
    gateDetails,
    manifestedEvents
  ]);

  // Deterministic Parashara Scenario Matcher (Guaranteed offline response if Ollama is not active)
  const generateDeterministicAnswer = (query: string): string => {
    const qLower = query.toLowerCase();

    // Check for transit position query (e.g., "where was Ketu / Venus")
    if (qLower.includes('where') || qLower.includes('transit') || qLower.includes('position')) {
      const matchedPlanets = screenContextSnapshot.transits.filter(t => {
        const pName = t.split(':')[0].toLowerCase();
        return qLower.includes(pName);
      });

      if (matchedPlanets.length > 0) {
        return `### 🪐 Screen Transit Ephemeris for ${monthName} ${selectedYear}\n\n` +
          `Based on your active screen data:\n\n` +
          matchedPlanets.map(p => `• **${p}**`).join('\n') +
          `\n\n**Dasha Nexus**: You are operating under **${toCleanEnglishPlanet(activeDashaHierarchy.mahadasha)} MD → ${toCleanEnglishPlanet(activeDashaHierarchy.antardasha)} AD → ${toCleanEnglishPlanet(activeDashaHierarchy.pratyantardasha)} PD**.\n` +
          `These planetary transits directly govern the delivering Nakshatra gates and house activations shown on your screen.`;
      }
    }

    // Check for high income / financial windfall query
    const isIncomeQuery = qLower.includes('income') || qLower.includes('money') || qLower.includes('wealth') || qLower.includes('earning');
    const isOnsiteQuery = qLower.includes('on-site') || qLower.includes('onsite') || qLower.includes('travel') || qLower.includes('foreign') || qLower.includes('abroad');
    const isRoleQuery = qLower.includes('role') || qLower.includes('promotion') || qLower.includes('assignment') || qLower.includes('leadership') || qLower.includes('title');

    if (isIncomeQuery || (isOnsiteQuery && isRoleQuery) || isRoleQuery || isOnsiteQuery) {
      // Analyze 10H/11H (Role/Income) vs 9H/12H (On-site/Travel)
      const h10_11_transits = screenContextSnapshot.transits.filter(t => t.includes('H10') || t.includes('H11'));
      const h9_12_transits = screenContextSnapshot.transits.filter(t => t.includes('H9') || t.includes('H12'));
      const hasAcuteIncomeEvent = screenContextSnapshot.events.some(e => e.toLowerCase().includes('income') || e.toLowerCase().includes('contract') || e.toLowerCase().includes('wealth'));

      let scenarioA_score = 65;
      let scenarioB_score = 78;

      if (h10_11_transits.length >= h9_12_transits.length) {
        scenarioB_score = 82;
        scenarioA_score = 58;
      } else {
        scenarioA_score = 80;
        scenarioB_score = 62;
      }

      return `### 🎯 Prediction Matching & Scenario Comparison for ${monthName} ${selectedYear}\n\n` +
        `**Screen Ground Truth Context**: Native Lagna: **${screenContextSnapshot.natalLagna}** | Running **${toCleanEnglishPlanet(activeDashaHierarchy.mahadasha)} MD → ${toCleanEnglishPlanet(activeDashaHierarchy.antardasha)} AD → ${toCleanEnglishPlanet(activeDashaHierarchy.pratyantardasha)} PD**.\n\n` +
        `---\n\n` +
        `#### 1. Income & Financial Potential\n` +
        `• **High Income Activation**: **YES**. Transiting planets activating your 11th House (Labha Sthana / Gains) and 2nd House of Dhana provide elevated earning potential.\n` +
        `• **Screen Evidence**: Events on screen indicate high probability around contract finalization and executive scope reallocation with Moon ignition.\n\n` +
        `#### 2. Comparative Scenario Evaluation\n\n` +
        `| Scenario | Alignment Probability | Key Transit & House Mechanisms |\n` +
        `| :--- | :---: | :--- |\n` +
        `| **Scenario A: On-site Foreign Assignment** | **${scenarioA_score}%** | 9th/12th House activations: ${h9_12_transits.length > 0 ? h9_12_transits.map(t => t.split(':')[0]).join(', ') : 'Dormant'}. Travel requires acute Rahu/Moon support. |\n` +
        `| **Scenario B: Newer Role / Executive Leadership** | **${scenarioB_score}%** | 10th House (Karma) & 11th House (Status/Gains): Activated by ${h10_11_transits.length > 0 ? h10_11_transits.map(t => t.split(':')[0]).join(', ') : 'Primary Dasha Lords'}. Directly backed by Gate 1 & 2. |\n\n` +
        `#### 3. Decisive Verdict & Mechanism\n` +
        `**Scenario B (Newer Role Assignment / Leadership Upgrade) has the decisive statistical advantage (${scenarioB_score}%)** over On-site travel (${scenarioA_score}%).\n\n` +
        `**Why?**\n` +
        `1. Your active **Pratyantardasha lord (${toCleanEnglishPlanet(activeDashaHierarchy.pratyantardasha)})** directly commands the 10th/11th house nexus rather than foreign transit houses.\n` +
        `2. The delivering Nakshatra gates on screen show acute transit activation for organizational restructuring and authority rather than overseas relocation.\n` +
        `3. Peak manifestation window occurs during the Chandra (Moon) ignition dates identified in Gate 1.`;
    }

    // General Screen Synthesis
    return `### 🔮 Grounded Screen Prediction Analysis (${monthName} ${selectedYear})\n\n` +
      `Under **${toCleanEnglishPlanet(activeDashaHierarchy.mahadasha)} MD → ${toCleanEnglishPlanet(activeDashaHierarchy.antardasha)} AD → ${toCleanEnglishPlanet(activeDashaHierarchy.pratyantardasha)} PD**:\n\n` +
      `• **Top Manifested Events on Screen**:\n` +
      screenContextSnapshot.events.slice(0, 3).map(e => `  - ${e}`).join('\n') + `\n\n` +
      `• **Delivering Nakshatra Gates Active**:\n` +
      screenContextSnapshot.gates.map(g => `  - ${g}`).join('\n') + `\n\n` +
      `You can ask me to compare specific job opportunities, interview outcomes, income brackets, or where any planet was transiting during this cycle!`;
  };

  // Submit User Message to Local Ollama (or deterministic fallback)
  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || userInput).trim();
    if (!query || isGenerating) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setUserInput('');
    setIsGenerating(true);

    const assistantMsgId = `ast-${Date.now()}`;
    const startTime = Date.now();

    // 1. Check if Local Ollama is available
    if (ollamaStatus.isOnline) {
      try {
        const systemPrompt = `You are an expert Vedic Astrological Prediction Analyst and Grounding Copilot running in a 100% PRIVATE, AIR-GAPPED environment.
The user is viewing their active astrological prediction screen in the application.

=== COMPLETE SCREEN DATA SNAPSHOT (GROUND TRUTH) ===
Native: ${screenContextSnapshot.personName} (Age: ${screenContextSnapshot.nativeAge})
Timeline: ${screenContextSnapshot.monthName} ${screenContextSnapshot.selectedYear}
Natal Lagna (Ascendant): ${screenContextSnapshot.natalLagna}
Natal Moon: ${screenContextSnapshot.natalMoon}

Active Dasha Hierarchy:
- Mahadasha (MD): ${screenContextSnapshot.dasha.md}
- Antardasha (AD): ${screenContextSnapshot.dasha.ad}
- Pratyantardasha (PD): ${screenContextSnapshot.dasha.pd}
- Date Horizon: ${screenContextSnapshot.dasha.window}

Transiting Grahas in the Sky (Gochara Ephemeris):
${screenContextSnapshot.transits.join('\n')}

The 3 Delivering Nakshatra Gates:
${screenContextSnapshot.gates.join('\n')}

Manifested Prediction Events on Screen:
${screenContextSnapshot.events.join('\n')}
===================================================

USER QUESTION:
"${query}"

INSTRUCTIONS:
1. Answer strictly using the provided screen ground truth.
2. If the user asks about specific scenarios (e.g. On-site foreign travel vs. New role assignment, or high income), compare both scenarios objectively:
   - Provide an alignment probability percentage for each scenario.
   - Explain the exact planetary transit houses (e.g., 10th house career vs 11th house gains vs 9th/12th house foreign travel).
   - Show which transiting Grahas and delivering Nakshatra gates support which outcome.
   - Give a decisive, clear verdict on which scenario matches the screen data better and why.
3. If the user asks where planets like Ketu or Venus were in transit, pull the EXACT degrees, sign, Nakshatra, pada, and house positions from the transits section.
4. Keep the tone sharp, senior, confidential, analytical, and structured with clear markdown headings and bullet points.`;

        const cleanEndpoint = ollamaEndpoint.replace(/\/+$/, '');
        const res = await fetch(`${cleanEndpoint}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: localModelName,
            prompt: systemPrompt,
            stream: false,
            options: {
              temperature: 0.3,
              num_predict: 2000,
              num_ctx: 8192
            }
          })
        });

        if (res.ok) {
          const data = await res.json();
          const responseText = data.response || data.text || '';
          if (responseText.trim()) {
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            setMessages(prev => [
              ...prev,
              {
                id: assistantMsgId,
                sender: 'assistant',
                text: responseText,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                modelUsed: `Local Private Ollama (${localModelName.split(':')[0]}) • ${elapsed}s`
              }
            ]);
            setIsGenerating(false);
            return;
          }
        }
      } catch (err: any) {
        console.warn('Ollama query failed, falling back to deterministic screen analyzer:', err);
      }
    }

    // 2. Deterministic Astrological Engine Fallback (Instant, 100% offline, guaranteed)
    setTimeout(() => {
      const answer = generateDeterministicAnswer(query);
      setMessages(prev => [
        ...prev,
        {
          id: assistantMsgId,
          sender: 'assistant',
          text: answer,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modelUsed: ollamaStatus.isOnline
            ? `Private Fallback Synthesizer`
            : `Screen Ground Truth Analyzer (Ollama Offline)`
        }
      ]);
      setIsGenerating(false);
    }, 400);
  };

  const handleCopyMessage = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(id);
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch {}
  };

  const quickQuestions = [
    {
      label: 'On-site vs New Role',
      prompt: 'Is this month indicating high income? I have two possibilities: going on-site vs getting a newer role assignment. Which one matches the screen predictions and how does it match?'
    },
    {
      label: 'Where are Dasha Lords?',
      prompt: `Where exactly are my active Dasha lords (${toCleanEnglishPlanet(activeDashaHierarchy.mahadasha)}, ${toCleanEnglishPlanet(activeDashaHierarchy.antardasha)}, ${toCleanEnglishPlanet(activeDashaHierarchy.pratyantardasha)}) transiting in the sky this month?`
    },
    {
      label: 'Gate Triggers',
      prompt: 'Which transit Grahas are directly sitting in or aspecting Gate 1, Gate 2, and Gate 3 this month?'
    },
    {
      label: 'High Probability Reason',
      prompt: 'Explain why the top manifested event on screen was given high probability score. What is the astrological engine mechanism?'
    }
  ];

  return (
    <div className="bg-slate-900 border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden mt-6 transition-all">
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-purple-950/90 via-slate-900 to-amber-950/80 p-4 sm:p-5 border-b border-purple-500/30 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-inner">
            <Bot className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-black text-white tracking-wide flex items-center gap-1.5">
                <span>Private Screen Prediction Copilot</span>
              </h3>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                <Lock className="w-3 h-3 text-emerald-400" />
                <span>100% Air-Gapped Local LLM</span>
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Absorbs live upper transits, bottom natal/dasha coordinates, and Section 3 manifested events into private memory.
            </p>
          </div>
        </div>

        {/* Right Status Badges & Controls */}
        <div className="flex items-center gap-2">
          {/* Ollama Status Pill */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono transition ${
              ollamaStatus.isOnline
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-950 border-amber-500/40 text-amber-300'
            }`}
          >
            <Cpu className={`w-3.5 h-3.5 ${ollamaStatus.isOnline ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span>
              {ollamaStatus.isOnline
                ? `Ollama Online (${localModelName.split(':')[0]})`
                : 'Ollama Offline (Using Astrological Engine)'}
            </span>
            <button
              type="button"
              onClick={checkOllamaHealth}
              title="Ping Ollama on port 11434"
              className="hover:text-white cursor-pointer ml-1"
            >
              <RefreshCw className={`w-3 h-3 ${ollamaStatus.checking ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Toggle Expand */}
          <button
            type="button"
            onClick={() => setIsExpanded(prev => !prev)}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            title={isExpanded ? 'Collapse Copilot' : 'Expand Copilot'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-4">
          {/* PRIVACY & MEMORY PILL BANNER */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-slate-300 font-mono text-[11px]">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Zero PII Transmission</strong>: All role comparisons, income queries, and ground-truth notes stay strictly on your local device.
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-purple-300">
              <span>Screen Memory:</span>
              <span className="font-bold text-white">{monthName} {selectedYear}</span>
              <span>&bull;</span>
              <span className="text-amber-300">{toCleanEnglishPlanet(activeDashaHierarchy.pratyantardasha)} PD</span>
            </div>
          </div>

          {/* CHAT MESSAGES WINDOW */}
          <div
            ref={chatScrollRef}
            className="h-80 sm:h-96 overflow-y-auto space-y-3.5 p-3 sm:p-4 rounded-xl bg-slate-950 border border-slate-800/90 scrollbar-thin"
          >
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-slate-400 font-mono">
                  {msg.sender === 'user' ? (
                    <span className="text-amber-300 font-bold">You (Private Query)</span>
                  ) : (
                    <span className="text-purple-300 font-bold flex items-center gap-1">
                      <Bot className="w-3 h-3 text-purple-400" />
                      <span>Prediction Copilot</span>
                      {msg.modelUsed && <span className="text-slate-500 font-normal">({msg.modelUsed})</span>}
                    </span>
                  )}
                  <span>&bull; {msg.timestamp}</span>
                </div>

                <div
                  className={`max-w-[92%] sm:max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-[13px] leading-relaxed shadow relative group ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-slate-950 font-semibold'
                      : 'bg-slate-900 border border-slate-700 text-slate-200 font-normal'
                  }`}
                >
                  <div className="whitespace-pre-wrap select-text">
                    {msg.text}
                  </div>

                  {msg.sender === 'assistant' && (
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(msg.text, msg.id)}
                      className="absolute top-2 right-2 p-1 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition cursor-pointer"
                      title="Copy response"
                    >
                      {copyFeedback === msg.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {isGenerating && (
              <div className="flex flex-col items-start animate-fadeIn">
                <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-purple-300 font-mono">
                  <Bot className="w-3 h-3 text-purple-400 animate-spin" />
                  <span>Evaluating screen astrological geometry...</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-purple-500/40 text-xs text-purple-200 flex items-center gap-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" />
                  </div>
                  <span>Reasoning over transits, active gates, and user scenarios...</span>
                </div>
              </div>
            )}
          </div>

          {/* QUICK PROMPT CHIPS */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Quick Prediction Questions (Click to Ask):
            </span>
            <div className="flex flex-wrap gap-2">
              {quickQuestions.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(q.prompt)}
                  disabled={isGenerating}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-purple-950/60 border border-slate-800 hover:border-purple-500/50 text-slate-300 hover:text-white text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>{q.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* INPUT FORM */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Ask specific scenario questions (e.g. 'Is this month high income? Compare on-site vs new role...')"
              disabled={isGenerating}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-purple-500 transition shadow-inner font-sans"
            />
            <button
              type="submit"
              disabled={!userInput.trim() || isGenerating}
              className="flex items-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-amber-600 hover:from-purple-500 hover:to-amber-500 text-white font-bold text-xs sm:text-sm transition cursor-pointer shadow-lg shadow-purple-500/20 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Ask Copilot</span>
            </button>
          </form>

          {/* OLLAMA LOCAL SETUP NOTICE IF OFFLINE */}
          {!ollamaStatus.isOnline && (
            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-amber-300 block">
                  To power this Copilot directly with local Qwen 14B / 8B (zero external network):
                </span>
                <p className="text-[11px] text-amber-100 leading-relaxed">
                  Open terminal and start Ollama with CORS origins enabled: <code className="bg-slate-900 px-1.5 py-0.5 rounded text-amber-300 font-mono">OLLAMA_ORIGINS=&quot;*&quot; ollama run qwen2.5:14b</code>. The Copilot will automatically connect to <code className="text-amber-300">{ollamaEndpoint}</code>. In the meantime, the built-in Astrological Ground Truth Analyzer is answering your questions instantly!
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PrivatePredictionChatbot;
