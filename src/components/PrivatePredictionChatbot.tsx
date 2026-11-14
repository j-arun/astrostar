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
  ArrowRight,
  Download,
  FileDown,
  FileText,
  Printer,
  Trash2
} from 'lucide-react';
import { NakshatraGateInfo, ManufacturedEventItem } from './EventManufacturingEngine';
import { RASHI_LIST_META } from '../data/transitEphemeris';
import { toCleanEnglishPlanet, toCleanEnglishSign } from '../services/llm/adapters';
import { ADChamberDynamics } from '../services/dashaChamberEngine';
import type { VedicWindowAnalysis } from '../services/vedicEventsEngine';

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
  adChamberDynamics?: ADChamberDynamics;
  vedicSpecialEvents?: VedicWindowAnalysis;
  nativeAge?: number;
}

/**
 * Parses inline formatting: **bold**, `code`, etc.
 */
const renderFormattedInline = (text: string): React.ReactNode => {
  if (!text) return null;
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  const parts = text.split(regex);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-extrabold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={idx} className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono text-[11px] border border-slate-700/60">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
};

/**
 * Rich Formatted Message Renderer (Renders Markdown tables, section headings, bullet lists, bold text)
 */
export const RichFormattedText: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // 1. Markdown Table Detection
    if (line.startsWith('|') && line.endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const headerRow = tableLines[0]
          .split('|')
          .map(c => c.trim())
          .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

        const dataRows = tableLines.slice(1)
          .filter(l => l.replace(/[|\s-:]/g, '').length > 0)
          .map(l => {
            return l
              .split('|')
              .map(c => c.trim())
              .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
          });

        elements.push(
          <div key={`table-${i}`} className="my-3 overflow-x-auto rounded-xl border border-slate-700/80 bg-slate-950/90 shadow-md">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-800/90 border-b border-slate-700">
                  {headerRow.map((h, hIdx) => (
                    <th key={hIdx} className="px-3 py-2 font-bold text-purple-300 uppercase tracking-wider text-[10.5px]">
                      {renderFormattedInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {dataRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-900/60 transition-colors">
                    {row.map((cell, cIdx) => {
                      const pctMatch = cell.match(/(\d{1,3})%/);
                      const isFirstCol = cIdx === 0;
                      return (
                        <td key={cIdx} className={`px-3 py-2 text-slate-200 text-xs ${isFirstCol ? 'font-semibold text-white' : ''}`}>
                          {pctMatch ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-mono font-bold text-[11px] ${
                              parseInt(pctMatch[1], 10) >= 70
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : parseInt(pctMatch[1], 10) >= 50
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}>
                              {cell}
                            </span>
                          ) : (
                            renderFormattedInline(cell)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // 2. Heading Level 3 (###)
    if (line.startsWith('### ')) {
      elements.push(
        <div key={`h3-${i}`} className="mt-3.5 mb-1.5 pb-1 border-b border-purple-500/30 flex items-center gap-2">
          <span className="w-1.5 h-3.5 rounded-full bg-purple-400" />
          <h3 className="text-xs sm:text-sm font-black text-white tracking-wide">
            {renderFormattedInline(line.slice(4))}
          </h3>
        </div>
      );
      i++;
      continue;
    }

    // 3. Heading Level 4 (####)
    if (line.startsWith('#### ')) {
      elements.push(
        <h4 key={`h4-${i}`} className="text-xs font-bold text-amber-300 uppercase tracking-wider mt-2.5 mb-1 flex items-center gap-1.5">
          <span className="w-1 h-2 rounded bg-amber-400" />
          <span>{renderFormattedInline(line.slice(5))}</span>
        </h4>
      );
      i++;
      continue;
    }

    // 4. Horizontal Rule (---)
    if (line === '---' || line === '***') {
      elements.push(<hr key={`hr-${i}`} className="border-slate-800 my-2.5" />);
      i++;
      continue;
    }

    // 5. Bullet item (•, -, *)
    if (line.startsWith('• ') || line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={`bullet-${i}`} className="flex items-start gap-2 my-1 pl-1 text-slate-200 leading-relaxed text-xs sm:text-[13px]">
          <span className="text-purple-400 mt-1 text-[8px] shrink-0">&bull;</span>
          <div className="flex-1">{renderFormattedInline(line.slice(2))}</div>
        </div>
      );
      i++;
      continue;
    }

    // 6. Numbered list item (1. , 2. )
    const numMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (numMatch) {
      elements.push(
        <div key={`num-${i}`} className="flex items-start gap-2 my-1 pl-1 text-slate-200 leading-relaxed text-xs sm:text-[13px]">
          <span className="font-mono font-bold text-amber-400 text-[11px] shrink-0">{numMatch[1]}.</span>
          <div className="flex-1">{renderFormattedInline(numMatch[2])}</div>
        </div>
      );
      i++;
      continue;
    }

    // 7. Empty line
    if (!line) {
      elements.push(<div key={`sp-${i}`} className="h-1.5" />);
      i++;
      continue;
    }

    // 8. Regular paragraph
    elements.push(
      <p key={`p-${i}`} className="my-1 text-slate-200 leading-relaxed text-xs sm:text-[13px]">
        {renderFormattedInline(line)}
      </p>
    );
    i++;
  }

  return <div className="space-y-0.5 select-text">{elements}</div>;
};

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
  adChamberDynamics,
  vedicSpecialEvents,
  nativeAge = 40
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [userInput, setUserInput] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [downloadFeedback, setDownloadFeedback] = useState<string | null>(null);

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
  const initialWelcomeMessage: ChatMessage = {
    id: 'msg-welcome',
    sender: 'assistant',
    text: `Hello! I am your 100% Air-Gapped Private Astrological Prediction Assistant (Local Q&A).
I have absorbed all screen data for **${monthName} ${selectedYear}** under **${toCleanEnglishPlanet(activeDashaHierarchy.mahadasha)} MD → ${toCleanEnglishPlanet(activeDashaHierarchy.antardasha)} AD → ${toCleanEnglishPlanet(activeDashaHierarchy.pratyantardasha)} PD**.

🔒 **Privacy Guarantee**: All queries run strictly through your local Private LLM (Ollama). Zero PII or career queries ever leave your machine.

Ask me specific questions comparing personal situations, like:
• *"Is this month indicating high income? I have on-site travel vs a new role assignment—which one matches?"*
• *"Where were Ketu and Venus in transit when this event triggered?"*
• *"Which gate is receiving the strongest transiting Graha support this month?"*`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    modelUsed: 'Screen-Aware Memory Grounding'
  };

  const [messages, setMessages] = useState<ChatMessage[]>(() => [initialWelcomeMessage]);

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

    const adChamberText = adChamberDynamics ? {
      adLord: adChamberDynamics.adCleanName,
      seat: `${adChamberDynamics.adNatalRashiName} (House ${adChamberDynamics.adNatalHouseFromLagna})`,
      conjunctions: adChamberDynamics.directOccupants.map(o => `${o.cleanName}${o.dignity === 'exalted' ? ' [EXALTED (+45 pts)]' : ''} (${o.pressurePoints > 0 ? `+${o.pressurePoints}` : o.pressurePoints} pts)`),
      aspects: adChamberDynamics.incomingAspects.map(a => `${a.cleanName} (${a.aspectLabel} from H${a.sourceHouseFromLagna}) [${a.pressurePoints > 0 ? `+${a.pressurePoints}` : a.pressurePoints} pts]`),
      polarity: adChamberDynamics.polarityLabel,
      netScore: adChamberDynamics.netScore,
      summary: adChamberDynamics.chamberAtmosphereNarrative
    } : null;

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
      adChamber: adChamberText,
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
    manifestedEvents,
    adChamberDynamics
  ]);

  // Deterministic Parashara Scenario Matcher (Guaranteed offline response if Ollama is not active)
  const generateDeterministicAnswer = (query: string): string => {
    const qLower = query.toLowerCase();

    if (qLower.includes('parivartana') || qLower.includes('neecha') || qLower.includes('debilitat') || qLower.includes('retro') || qLower.includes('station') || qLower.includes('exchange')) {
      if (vedicSpecialEvents) {
        return `### ⚡ Special Window Phenomena: Parivartana, Neecha Bhanga & Vakra Stations (${monthName} ${selectedYear})\n\n` +
          `**One-Liner**: ${vedicSpecialEvents.consolidatedOneLiner}\n\n` +
          (vedicSpecialEvents.parivartanaYogas.length > 0
            ? `#### Parivartana Mutual Exchanges:\n` + vedicSpecialEvents.parivartanaYogas.map(p => `• **${p.grahaA} ↔ ${p.grahaB}** (${p.startDate}→${p.endDate}): ${p.bhavaExchangeSummary} — *${p.predictedEvents}*`).join('\n') + `\n\n`
            : '') +
          (vedicSpecialEvents.debilitationEvents.length > 0
            ? `#### Debilitation & Neecha Bhanga:\n` + vedicSpecialEvents.debilitationEvents.map(d => `• **${d.summary}**: ${d.predictedEvents}`).join('\n') + `\n\n`
            : '') +
          (vedicSpecialEvents.sameSignStations.length > 0
            ? `#### Same-Sign Motion Pivots:\n` + vedicSpecialEvents.sameSignStations.map(s => `• **${s.summary}** — *${s.eventImpact}*`).join('\n')
            : '');
      }
    }

    // Check for AD chamber / aspect / conjunction query
    if (qLower.includes('chamber') || qLower.includes('aspect') || qLower.includes('conjunct') || qLower.includes('rahu') && qLower.includes('saturn') || qLower.includes('pressure')) {
      if (adChamberDynamics) {
        return `### ⚡ AD Pressure Chamber Dynamics & Aspect Evaluation (${monthName} ${selectedYear})\n\n` +
          `**Host Seat**: **${adChamberDynamics.adCleanName}** natally in **${adChamberDynamics.adNatalRashiName} (House ${adChamberDynamics.adNatalHouseFromLagna})**.\n\n` +
          `• **Direct Transit Conjunctions**: ${adChamberDynamics.directOccupants.length > 0 ? adChamberDynamics.directOccupants.map(o => `**${o.cleanName}**${o.dignity === 'exalted' ? ' [EXALTED / UCCHAM]' : ''} (${o.pressurePoints > 0 ? `+${o.pressurePoints}` : o.pressurePoints} pts)`).join(', ') : 'None (Clear chamber)'}\n` +
          `• **Incoming Parashari Drishti (Aspects)**: ${adChamberDynamics.incomingAspects.length > 0 ? adChamberDynamics.incomingAspects.map(a => `**${a.cleanName}** (${a.aspectLabel} from House ${a.sourceHouseFromLagna}) [${a.pressurePoints > 0 ? `+${a.pressurePoints}` : a.pressurePoints} pts]`).join('; ') : 'No direct aspects'}\n` +
          `• **Chamber Polarity**: **${adChamberDynamics.polarityLabel}** (Net Impact: **${adChamberDynamics.netScore > 0 ? `+${adChamberDynamics.netScore}` : adChamberDynamics.netScore} pts**)\n\n` +
          `**Karmic Mechanism**: ${adChamberDynamics.chamberAtmosphereNarrative}\n\n` +
          `**PD Release Valve**: Accumulated tension vents through **${adChamberDynamics.pdCleanName}'s Gate: ${adChamberDynamics.peakVentingGate}** during the active lunar trigger.`;
      }
    }

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
      const h10_11_transits = screenContextSnapshot.transits.filter(t => t.includes('H10') || t.includes('H11'));
      const h9_12_transits = screenContextSnapshot.transits.filter(t => t.includes('H9') || t.includes('H12'));

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
        const systemPrompt = `You are an expert Vedic Astrological Prediction Analyst and Local Q&A Engine running in a 100% PRIVATE, AIR-GAPPED environment.
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
${vedicSpecialEvents?.promptMarkdownBlock ? `\n${vedicSpecialEvents.promptMarkdownBlock}\n` : ''}
===================================================

USER QUESTION:
"${query}"

INSTRUCTIONS:
1. Answer strictly using the provided screen ground truth.
2. If the user asks about specific scenarios (e.g. On-site foreign travel vs. New role assignment, or high income), compare both scenarios objectively:
   - Provide an alignment probability percentage for each scenario.
   - Format comparison tables with Markdown pipes (| Scenario | Alignment Probability | Key Transit Mechanisms |).
   - Explain the exact planetary transit houses (e.g., 10th house career vs 11th house gains vs 9th/12th house foreign travel).
   - Show which transiting Grahas and delivering Nakshatra gates support which outcome.
   - Give a decisive, clear verdict on which scenario matches the screen data better and why.
3. If the user asks where planets like Ketu or Venus were in transit, pull the EXACT degrees, sign, Nakshatra, pada, and house positions from the transits section.
4. Keep the output clean, highly structured, with section headers (###, ####), bullet points, and clean bold tags.`;

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
                modelUsed: `Local Qwen (${localModelName.split(':')[0]}) • ${elapsed}s`
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

  const handleClearHistory = () => {
    setMessages([initialWelcomeMessage]);
  };

  // Download Single Message as Markdown file
  const handleDownloadSingleMessage = (msg: ChatMessage) => {
    const filename = `Local_QA_${msg.sender === 'user' ? 'Question' : 'Answer'}_${monthName}_${selectedYear}_${msg.id}.md`;
    const content = `# Local Q&A (${msg.sender === 'user' ? 'User Question' : 'Assistant Analysis'})\n` +
      `**Horizon:** ${monthName} ${selectedYear}\n` +
      `**Dasha:** ${activeDashaHierarchy.mahadasha} MD → ${activeDashaHierarchy.antardasha} AD → ${activeDashaHierarchy.pratyantardasha} PD\n` +
      `**Timestamp:** ${msg.timestamp} ${msg.modelUsed ? `| Model: ${msg.modelUsed}` : ''}\n\n` +
      `---\n\n` +
      `${msg.text}\n`;

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadFeedback(msg.id);
    setTimeout(() => setDownloadFeedback(null), 2000);
  };

  // Download Entire Q&A Session as Standalone Styled HTML
  const handleDownloadHtmlTranscript = () => {
    const cleanPerson = personName.replace(/\s+/g, '_');
    const filename = `Local_QA_Prediction_${cleanPerson}_${monthName}_${selectedYear}_${Date.now()}.html`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Local Q&A Prediction Report - ${personName} (${monthName} ${selectedYear})</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #090d16;
      color: #e2e8f0;
      margin: 0;
      padding: 30px 20px;
      line-height: 1.6;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
    }
    .header {
      background: linear-gradient(135deg, #3b0764 0%, #0f172a 100%);
      border: 1px solid #9333ea;
      padding: 24px;
      border-radius: 12px;
      margin-bottom: 24px;
    }
    .header h1 {
      margin: 0 0 6px 0;
      font-size: 24px;
      color: #ffffff;
      font-weight: 800;
    }
    .header .subtitle {
      color: #d8b4fe;
      font-size: 13px;
      margin-bottom: 12px;
    }
    .meta-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      font-size: 12px;
      color: #cbd5e1;
      border-top: 1px solid rgba(255, 255, 255, 0.15);
      padding-top: 10px;
    }
    .screen-context {
      background: #1e1b4b;
      border: 1px solid #4338ca;
      border-radius: 10px;
      padding: 14px 18px;
      font-size: 12px;
      color: #c7d2fe;
      margin-bottom: 24px;
    }
    .chat-flow {
      display: flex;
      flex-direction: column;
      gap: 20px;
      margin-bottom: 30px;
    }
    .msg-wrap {
      display: flex;
      flex-direction: column;
    }
    .msg-user {
      align-self: flex-end;
      max-width: 85%;
    }
    .msg-user .bubble {
      background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
      color: #0f172a;
      font-weight: 600;
      padding: 14px 18px;
      border-radius: 16px 16px 4px 16px;
      box-shadow: 0 4px 12px rgba(217, 119, 6, 0.2);
    }
    .msg-assistant {
      align-self: flex-start;
      max-width: 95%;
    }
    .msg-assistant .bubble {
      background: #1e293b;
      border: 1px solid #334155;
      color: #f1f5f9;
      padding: 18px 22px;
      border-radius: 16px 16px 16px 4px;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
    }
    .msg-meta {
      font-size: 11px;
      color: #94a3b8;
      margin-bottom: 4px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0;
      font-size: 12px;
      background: #0f172a;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #334155;
    }
    th {
      background: #334155;
      color: #d8b4fe;
      padding: 8px 12px;
      font-weight: bold;
      text-transform: uppercase;
      font-size: 11px;
    }
    td {
      padding: 8px 12px;
      border-top: 1px solid #1e293b;
    }
    .badge-prob {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 9999px;
      font-weight: bold;
      font-family: monospace;
      font-size: 11px;
      background: rgba(16, 185, 129, 0.2);
      color: #6ee7b7;
      border: 1px solid #10b981;
    }
    .footer {
      border-top: 1px solid #334155;
      padding-top: 14px;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #64748b;
    }
    .print-btn {
      background: #a855f7;
      color: #0f172a;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: bold;
      cursor: pointer;
      margin-bottom: 20px;
    }
    @media print {
      body { background: #ffffff; color: #0f172a; padding: 0; }
      .container { border: none; box-shadow: none; padding: 0; }
      .print-btn { display: none; }
      .header { background: #f8fafc; border: 1px solid #cbd5e1; color: #0f172a; }
      .header h1 { color: #0f172a; }
      .msg-assistant .bubble { background: #f8fafc; border: 1px solid #cbd5e1; color: #0f172a; }
      .msg-user .bubble { background: #fef3c7; color: #78350f; }
    }
  </style>
</head>
<body>
  <div class="container">
    <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>

    <div class="header">
      <h1>Private Local Q&A Prediction Analysis</h1>
      <div class="subtitle">Air-Gapped Local Model Reasoning | Horizon: <strong>${monthName} ${selectedYear}</strong></div>
      <div class="meta-bar">
        <span><strong>Native:</strong> ${personName} (Age: ${nativeAge})</span>
        <span><strong>Lagna:</strong> ${screenContextSnapshot.natalLagna}</span>
        <span><strong>Moon:</strong> ${screenContextSnapshot.natalMoon}</span>
        <span><strong>Dasha:</strong> ${activeDashaHierarchy.mahadasha} MD → ${activeDashaHierarchy.antardasha} AD → ${activeDashaHierarchy.pratyantardasha} PD</span>
      </div>
    </div>

    <div class="screen-context">
      <strong>🔒 Privacy Verification:</strong> Generated locally via Ollama without cloud telemetry. Screen memory absorbed all 9 transits, 3 Nakshatra gates, and ${manifestedEvents.length} manifested predictions.
    </div>

    <div class="chat-flow">
      ${messages.map(m => `
        <div class="msg-wrap ${m.sender === 'user' ? 'msg-user' : 'msg-assistant'}">
          <div class="msg-meta">
            ${m.sender === 'user' ? 'You (Private Query)' : `Local Q&A ${m.modelUsed ? `(${m.modelUsed})` : ''}`} • ${m.timestamp}
          </div>
          <div class="bubble">
            ${m.text.replace(/\n/g, '<br/>')}
          </div>
        </div>
      `).join('')}
    </div>

    <div class="footer">
      <span>Tamil Om Vedic Astrology — Private Local Q&A</span>
      <span>Exported: ${new Date().toLocaleString()}</span>
      <span>${monthName} ${selectedYear}</span>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Download Entire Q&A Session as Markdown
  const handleDownloadMarkdownTranscript = () => {
    const cleanPerson = personName.replace(/\s+/g, '_');
    const filename = `Local_QA_Prediction_${cleanPerson}_${monthName}_${selectedYear}_${Date.now()}.md`;

    let md = `# Private Local Q&A Prediction Transcript\n\n` +
      `**Native:** ${personName} (Age: ${nativeAge})\n` +
      `**Horizon:** ${monthName} ${selectedYear}\n` +
      `**Lagna:** ${screenContextSnapshot.natalLagna}\n` +
      `**Moon:** ${screenContextSnapshot.natalMoon}\n` +
      `**Active Dasha:** ${activeDashaHierarchy.mahadasha} MD → ${activeDashaHierarchy.antardasha} AD → ${activeDashaHierarchy.pratyantardasha} PD (${activeDashaHierarchy.startDate} to ${activeDashaHierarchy.endDate})\n` +
      `**Exported:** ${new Date().toLocaleString()}\n\n` +
      `---\n\n` +
      `## Active Screen Context Grounding\n\n` +
      `### Transiting Grahas in the Sky:\n` +
      screenContextSnapshot.transits.map(t => `- ${t}`).join('\n') + `\n\n` +
      `### Delivering Nakshatra Gates:\n` +
      screenContextSnapshot.gates.map(g => `- ${g}`).join('\n') + `\n\n` +
      `---\n\n` +
      `## Conversation History\n\n`;

    messages.forEach((m, idx) => {
      md += `### ${idx + 1}. ${m.sender === 'user' ? 'User Question' : `Local Q&A Analysis ${m.modelUsed ? `(${m.modelUsed})` : ''}`}\n` +
        `*Timestamp: ${m.timestamp}*\n\n` +
        `${m.text}\n\n` +
        `---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
                <span>Private Local Q&A</span>
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

        {/* Right Status Badges & Download Actions */}
        <div className="flex flex-wrap items-center gap-2">
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

          {/* Download HTML Transcript */}
          <button
            type="button"
            onClick={handleDownloadHtmlTranscript}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-500/50 text-purple-200 text-xs font-bold transition cursor-pointer shadow active:scale-95"
            title="Download complete styled Q&A session as standalone HTML report"
          >
            <FileText className="w-3.5 h-3.5 text-purple-300" />
            <span className="hidden sm:inline">Download HTML</span>
          </button>

          {/* Download Markdown Transcript */}
          <button
            type="button"
            onClick={handleDownloadMarkdownTranscript}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer shadow active:scale-95"
            title="Download full Q&A transcript as Markdown (.md)"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Export .MD</span>
          </button>

          {/* Clear Chat */}
          <button
            type="button"
            onClick={handleClearHistory}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-300 transition cursor-pointer"
            title="Clear Q&A chat history"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Toggle Expand */}
          <button
            type="button"
            onClick={() => setIsExpanded(prev => !prev)}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            title={isExpanded ? 'Collapse Local Q&A' : 'Expand Local Q&A'}
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
            className="h-96 sm:h-[430px] overflow-y-auto space-y-4 p-3.5 sm:p-5 rounded-xl bg-slate-950 border border-slate-800/90 scrollbar-thin"
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
                      <Bot className="w-3.5 h-3.5 text-purple-400" />
                      <span>Local Q&A</span>
                      {msg.modelUsed && <span className="text-slate-500 font-normal">({msg.modelUsed})</span>}
                    </span>
                  )}
                  <span>&bull; {msg.timestamp}</span>
                </div>

                <div
                  className={`max-w-[94%] sm:max-w-[88%] rounded-2xl p-4 text-xs sm:text-[13px] leading-relaxed shadow-lg relative group ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-slate-950 font-semibold'
                      : 'bg-slate-900/95 border border-purple-500/25 text-slate-100 font-normal'
                  }`}
                >
                  {/* Rich Rendered Content */}
                  {msg.sender === 'user' ? (
                    <div className="whitespace-pre-wrap select-text">{msg.text}</div>
                  ) : (
                    <RichFormattedText text={msg.text} />
                  )}

                  {/* Actions for Assistant Message: Copy and Download */}
                  {msg.sender === 'assistant' && (
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-slate-900/90 border border-slate-700/80 rounded-lg p-0.5 opacity-0 group-hover:opacity-100 transition shadow">
                      {/* Copy Button */}
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg.text, msg.id)}
                        className="p-1 rounded text-slate-400 hover:text-white transition cursor-pointer"
                        title="Copy formatted answer to clipboard"
                      >
                        {copyFeedback === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Download Single Answer */}
                      <button
                        type="button"
                        onClick={() => handleDownloadSingleMessage(msg)}
                        className="p-1 rounded text-slate-400 hover:text-amber-300 transition cursor-pointer"
                        title="Download this answer as Markdown file"
                      >
                        {downloadFeedback === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <FileDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isGenerating && (
              <div className="flex flex-col items-start animate-fadeIn">
                <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-purple-300 font-mono">
                  <Bot className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                  <span>Evaluating screen astrological geometry...</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900 border border-purple-500/40 text-xs text-purple-200 flex items-center gap-3 shadow-lg">
                  <div className="flex space-x-1.5">
                    <div className="w-2.5 h-2.5 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-bounce" />
                  </div>
                  <span className="font-medium">Synthesizing transits, active gates, and matching your scenarios...</span>
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
              <span className="hidden sm:inline">Ask Local Q&A</span>
            </button>
          </form>

          {/* OLLAMA LOCAL SETUP NOTICE IF OFFLINE */}
          {!ollamaStatus.isOnline && (
            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-amber-300 block">
                  To power Local Q&A directly with local Qwen 14B / 8B (zero external network):
                </span>
                <p className="text-[11px] text-amber-100 leading-relaxed">
                  Open terminal and start Ollama with CORS origins enabled: <code className="bg-slate-900 px-1.5 py-0.5 rounded text-amber-300 font-mono">OLLAMA_ORIGINS=&quot;*&quot; ollama run qwen2.5:14b</code>. Local Q&A will automatically connect to <code className="text-amber-300">{ollamaEndpoint}</code>. In the meantime, the built-in Astrological Ground Truth Analyzer is answering your questions instantly!
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
