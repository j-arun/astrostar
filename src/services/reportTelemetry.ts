import { VedicHouseContext, LLMThreePartNarrative } from './llm/types';

export interface ReportHeaderTelemetry {
  promptVersion: 'v1' | 'v2' | 'v3';
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  isEstimatedTokens: boolean;
  totalTokensDisplay: string;
  inputTokensDisplay: string;
  outputTokensDisplay: string;
  sourceLabel: string;
}

export function resolveReportPromptVersion(
  context: VedicHouseContext,
  narrative: LLMThreePartNarrative
): 'v1' | 'v2' | 'v3' {
  const raw = String(
    narrative.promptVersion ||
      narrative.promptVersionTag ||
      context.promptVersion ||
      'v3'
  )
    .trim()
    .toLowerCase();
  if (raw === 'v1') return 'v1';
  if (raw === 'v2') return 'v2';
  return 'v3';
}

export function extractReportTokenTelemetry(
  context: VedicHouseContext,
  narrative: LLMThreePartNarrative
): ReportHeaderTelemetry {
  const promptVersion = resolveReportPromptVersion(context, narrative);
  const tt = narrative.tokenTelemetry;
  const ol = narrative.ollamaStats;
  const um = narrative.rawResponseBody?.usageMetadata;
  const claudeUsage = narrative.rawResponseBody?.usage;

  let inputTokens: number | undefined;
  let outputTokens: number | undefined;
  let totalTokens: number | undefined;
  let isEstimatedTokens = false;

  if (tt && (typeof tt.totalTokens === 'number' || typeof tt.outputTokens === 'number')) {
    inputTokens = tt.inputTokens;
    outputTokens = tt.outputTokens;
    totalTokens = tt.totalTokens;
    isEstimatedTokens = tt.source === 'char_estimated';
  } else if (ol && (typeof ol.promptEvalCount === 'number' || typeof ol.evalCount === 'number')) {
    inputTokens = ol.promptEvalCount;
    outputTokens = ol.evalCount;
    totalTokens = (inputTokens ?? 0) + (outputTokens ?? 0);
    isEstimatedTokens = false;
  } else if (um && (typeof um.totalTokenCount === 'number' || typeof um.candidatesTokenCount === 'number')) {
    inputTokens = typeof um.promptTokenCount === 'number' ? um.promptTokenCount : undefined;
    const cand = typeof um.candidatesTokenCount === 'number' ? um.candidatesTokenCount : 0;
    const thoughts = typeof um.thoughtsTokenCount === 'number' ? um.thoughtsTokenCount : 0;
    outputTokens = cand + thoughts > 0 ? cand + thoughts : undefined;
    totalTokens =
      typeof um.totalTokenCount === 'number'
        ? um.totalTokenCount
        : (inputTokens ?? 0) + (outputTokens ?? 0);
    isEstimatedTokens = false;
  } else if (claudeUsage && (typeof claudeUsage.input_tokens === 'number' || typeof claudeUsage.output_tokens === 'number')) {
    inputTokens =
      Number(claudeUsage.input_tokens ?? 0) +
      Number(claudeUsage.cache_creation_input_tokens ?? 0) +
      Number(claudeUsage.cache_read_input_tokens ?? 0);
    outputTokens = Number(claudeUsage.output_tokens ?? 0);
    totalTokens = inputTokens + outputTokens;
    isEstimatedTokens = false;
  }

  // Fallback char-based estimate if legacy cached narrative or heuristic fallback lacks API usage
  if (typeof inputTokens !== 'number') {
    const promptChars = (narrative.promptSent || '').length;
    inputTokens = promptChars > 0 ? Math.round(promptChars / 4) : 0;
    isEstimatedTokens = true;
  }
  if (typeof outputTokens !== 'number') {
    const rawOut =
      typeof narrative.rawResponseBody?.response === 'string'
        ? narrative.rawResponseBody.response
        : typeof narrative.rawResponseBody?.text === 'string'
        ? narrative.rawResponseBody.text
        : [
            narrative.summarySentence,
            narrative.part1_probabilityAndScope,
            narrative.part2_financialAndResources,
            narrative.part3_microTimingWindow,
            narrative.rawMarkdown
          ]
            .filter(Boolean)
            .join('\n');
    outputTokens = rawOut.length > 0 ? Math.max(1, Math.round(rawOut.length / 4)) : 0;
    isEstimatedTokens = true;
  }
  if (typeof totalTokens !== 'number' || totalTokens < outputTokens) {
    totalTokens = inputTokens + outputTokens;
  }

  const fmt = (n: number) => (isEstimatedTokens ? `~${n.toLocaleString()}` : n.toLocaleString());

  return {
    promptVersion,
    inputTokens,
    outputTokens,
    totalTokens,
    isEstimatedTokens,
    totalTokensDisplay: totalTokens > 0 ? fmt(totalTokens) : 'N/A',
    inputTokensDisplay: inputTokens > 0 ? fmt(inputTokens) : 'N/A',
    outputTokensDisplay: outputTokens > 0 ? fmt(outputTokens) : 'N/A',
    sourceLabel: isEstimatedTokens ? 'Estimated (~4 chars/tok)' : 'API Reported'
  };
}
