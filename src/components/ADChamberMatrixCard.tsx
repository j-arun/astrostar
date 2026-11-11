import React, { useState } from 'react';
import {
  Zap,
  Flame,
  ShieldCheck,
  AlertTriangle,
  Compass,
  Layers,
  ChevronDown,
  ChevronUp,
  Moon,
  TrendingUp,
  Sparkles,
  Info,
  ArrowRight,
  Crosshair
} from 'lucide-react';
import { ADChamberDynamics } from '../services/dashaChamberEngine';

interface ADChamberMatrixCardProps {
  dynamics: ADChamberDynamics;
  isCompact?: boolean;
}

export const ADChamberMatrixCard: React.FC<ADChamberMatrixCardProps> = ({
  dynamics,
  isCompact = false
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [showLordshipDetails, setShowLordshipDetails] = useState<boolean>(false);

  const getPolarityBadge = (category: string) => {
    switch (category) {
      case 'exalted_breakthrough':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold tracking-wide">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            Exalted Breakthrough [+]
          </span>
        );
      case 'mixed_volatile':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs font-bold tracking-wide">
            <Zap className="w-3.5 h-3.5 text-purple-400" />
            Mixed High-Voltage Breakthrough (Crisis ➔ Victory)
          </span>
        );
      case 'high_pressure_crisis':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold tracking-wide">
            <Flame className="w-3.5 h-3.5 text-rose-400" />
            High Karmic Friction [-]
          </span>
        );
      case 'harmonious_ease':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-bold tracking-wide">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            Harmonious Growth [+]
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-700/40 text-slate-300 border border-slate-600/50 text-xs font-semibold">
            <Compass className="w-3.5 h-3.5 text-slate-400" />
            Controlled Baseline Transit
          </span>
        );
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-indigo-950/40 border border-indigo-500/30 rounded-2xl p-4 sm:p-5 shadow-xl backdrop-blur-sm transition-all mb-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-500/20">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center shrink-0 mt-0.5">
            <Crosshair className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm sm:text-base font-extrabold text-white tracking-wide flex items-center gap-2">
                AD Pressure Chamber &amp; PD Delivery Matrix
              </h3>
              {getPolarityBadge(dynamics.polarityCategory)}
            </div>
            <p className="text-xs text-indigo-200/80 mt-0.5">
              Natal Seat: <strong className="text-amber-300">{dynamics.adCleanName}</strong> in <strong>{dynamics.adNatalRashiName} (House {dynamics.adNatalHouseFromLagna})</strong> &bull; Delivering Hand: <strong className="text-purple-300">{dynamics.pdCleanName}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <div className="text-right hidden sm:block">
            <div className="text-[11px] font-mono font-bold text-slate-300">
              Net Impact: <span className={dynamics.netScore >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{dynamics.netScore > 0 ? `+${dynamics.netScore}` : dynamics.netScore} pts</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              Conj: {dynamics.totalConjunctionScore > 0 ? `+${dynamics.totalConjunctionScore}` : dynamics.totalConjunctionScore} | Asp: {dynamics.totalAspectScore > 0 ? `+${dynamics.totalAspectScore}` : dynamics.totalAspectScore}
            </div>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors"
            title={isExpanded ? 'Collapse Matrix' : 'Expand Matrix'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Main 2-Column Grid: AD Chamber on Left, PD Release Valves on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            {/* LEFT: AD Chamber Seat (House Dynamics) - 7 cols */}
            <div className="lg:col-span-7 bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 sm:p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                      1. AD Natal Chamber ({dynamics.adNatalRashiName} &bull; House {dynamics.adNatalHouseFromLagna})
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Host: <strong className="text-slate-200">{dynamics.adCleanName}</strong> {dynamics.adNatalRetrograde ? '(Vakra / Retro)' : ''}
                  </span>
                </div>

                {/* Atmospheric Narrative Banner */}
                <div className="p-2.5 rounded-lg bg-indigo-950/30 border border-indigo-500/20 text-xs text-slate-200 leading-relaxed mb-3">
                  <span className="text-indigo-300 font-semibold">Chamber Status: </span>
                  {dynamics.chamberAtmosphereNarrative}
                </div>

                {/* Sub-grid: Direct Conjunctions vs Incoming Aspects */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Conjunctions (Standing Inside the Chamber) */}
                  <div className="bg-slate-900/80 rounded-lg p-2.5 border border-slate-800">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-sky-400" />
                        Conjunctions (In Chamber)
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {dynamics.directOccupants.length} Active
                      </span>
                    </div>

                    {dynamics.directOccupants.length > 0 ? (
                      <div className="space-y-1.5">
                        {dynamics.directOccupants.map((occ, idx) => (
                          <div key={idx} className="p-2 rounded bg-slate-950/80 border border-slate-800/80 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white flex items-center gap-1">
                                {occ.cleanName}
                                {occ.dignity === 'exalted' && (
                                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-black uppercase">
                                    Exalted / Uccham
                                  </span>
                                )}
                                {occ.dignity === 'debilitated' && (
                                  <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9px] font-black uppercase">
                                    Debilitated
                                  </span>
                                )}
                              </span>
                              <span className={`font-mono text-[11px] font-bold ${occ.pressurePoints > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {occ.pressurePoints > 0 ? `+${occ.pressurePoints}` : occ.pressurePoints} pts
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-300 mt-1 leading-snug">
                              {occ.somaticInfluence}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-xs text-slate-500 italic">
                        No transiting Grahas physically standing in {dynamics.adNatalRashiName}.
                      </div>
                    )}
                  </div>

                  {/* Incoming Aspects (Graha Drishti from Afar) */}
                  <div className="bg-slate-900/80 rounded-lg p-2.5 border border-slate-800">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Crosshair className="w-3.5 h-3.5 text-purple-400" />
                        Aspects (Graha Drishti)
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {dynamics.incomingAspects.length} Rays
                      </span>
                    </div>

                    {dynamics.incomingAspects.length > 0 ? (
                      <div className="space-y-1.5">
                        {dynamics.incomingAspects.map((asp, idx) => (
                          <div key={idx} className="p-2 rounded bg-slate-950/80 border border-slate-800/80 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white flex items-center gap-1">
                                {asp.cleanName}
                                <span className="text-[10px] font-mono text-indigo-300">
                                  from H{asp.sourceHouseFromLagna}
                                </span>
                              </span>
                              <span className={`font-mono text-[11px] font-bold ${asp.pressurePoints > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {asp.pressurePoints > 0 ? `+${asp.pressurePoints}` : asp.pressurePoints} pts
                              </span>
                            </div>
                            <div className="text-[10px] text-indigo-200/90 font-medium mt-0.5">
                              {asp.aspectLabel}
                            </div>
                            <div className="text-[11px] text-slate-300 mt-1 leading-snug">
                              {asp.karmicMechanism}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-xs text-slate-500 italic">
                        No direct Parashari aspects targeting {dynamics.adNatalRashiName}.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Lordship (Owned Houses) Toggle */}
              <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <button
                  onClick={() => setShowLordshipDetails(!showLordshipDetails)}
                  className="flex items-center gap-1.5 text-indigo-300 hover:text-indigo-200 transition-colors font-medium"
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>{showLordshipDetails ? 'Hide Lordship (Owned Houses)' : `Inspect ${dynamics.adCleanName}'s Owned Houses (${dynamics.ruledHouses.length})`}</span>
                </button>
                <span className="font-mono text-[11px] text-slate-400">
                  Total Pressure: {dynamics.netScore > 0 ? `+${dynamics.netScore}` : dynamics.netScore}
                </span>
              </div>

              {/* Collapsible Lordship Houses Details */}
              {showLordshipDetails && (
                <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  {dynamics.ruledHouses.map((rh, idx) => (
                    <div key={idx} className="p-2 rounded bg-slate-950/80 border border-slate-800 text-[11px]">
                      <div className="flex items-center justify-between font-bold text-slate-200 mb-0.5">
                        <span>House {rh.houseFromLagna} ({rh.rashiName})</span>
                        {rh.isAfflicted && <span className="text-rose-400 text-[9px] font-bold">Malefic Active</span>}
                        {rh.isProtected && <span className="text-emerald-400 text-[9px] font-bold">Protected</span>}
                      </div>
                      <div className="text-slate-400 text-[10px] line-clamp-1">{rh.significations}</div>
                      <div className="mt-1 text-[10px] text-slate-300">
                        <strong>Transits:</strong> {rh.occupants.join(', ') || 'None'} &bull; <strong>Aspects:</strong> {rh.aspectingGrahas.join(', ') || 'None'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT: PD Delivering Hand & 3 Release Valves - 5 cols */}
            <div className="lg:col-span-5 bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 sm:p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400" />
                    <span className="text-xs font-extrabold uppercase tracking-wider text-purple-300">
                      2. PD Delivering Valves ({dynamics.pdCleanName})
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-purple-400">
                    3 Nadi Gates
                  </span>
                </div>

                <p className="text-xs text-slate-400 mb-3">
                  Pressure from House {dynamics.adNatalHouseFromLagna} vents through these 3 physical delivery doors:
                </p>

                {/* The 3 Gates */}
                <div className="space-y-2.5">
                  {dynamics.coupledGates.map((gate, idx) => {
                    const isPeak = gate.gateIndex === 2 || idx === 1 || gate.ventingEfficiency === 'high_conductance';
                    return (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-xl border transition-all ${
                          isPeak
                            ? 'bg-purple-950/30 border-purple-500/40 shadow-sm'
                            : 'bg-slate-900/60 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 font-mono text-xs font-bold flex items-center justify-center">
                              {gate.gateIndex}
                            </span>
                            <span className="text-xs font-bold text-white">
                              {gate.nakshatraName}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              ({gate.rashiName} &bull; House {gate.houseFromLagna})
                            </span>
                          </div>
                          {isPeak && (
                            <span className="px-1.5 py-0.2 rounded bg-purple-500/30 text-purple-300 border border-purple-400/40 text-[9px] font-black uppercase">
                              Primary Valve
                            </span>
                          )}
                        </div>

                        <div className="text-xs font-medium text-amber-200/90 pl-6">
                          {gate.portfolioDomain}
                        </div>

                        <div className="mt-1.5 pl-6 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/60 pt-1">
                          <span className="flex items-center gap-1 text-slate-300">
                            <Moon className="w-3 h-3 text-cyan-400" />
                            <span>Trigger: {gate.moonWindowText || 'Active this month'}</span>
                          </span>
                          <span className="text-[10px] text-purple-300/80 font-mono">
                            {gate.ventingEfficiency === 'high_conductance' ? '⚡ High Flow' : 'Steady Flow'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Synthesized Event Vector Footer */}
              <div className="mt-3.5 p-2.5 rounded-lg bg-slate-900 border border-indigo-500/20 text-xs">
                <div className="text-[10px] font-extrabold uppercase text-indigo-300 tracking-wider mb-1 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-indigo-400" />
                  Synthesized Event Discharge
                </div>
                <p className="text-slate-300 leading-relaxed text-[11.5px]">
                  {dynamics.synthesizedEventSignature}
                </p>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
