/**
 * API Health & Connection Testing Service
 * Allows users to test their Gemini, Claude, or Ollama connections directly
 * with lightweight pings before running full Vedic synthesis reports.
 */

export interface KeyTestResult {
  isChecking: boolean;
  success: boolean | null;
  message: string;
  statusCode?: number;
  model?: string;
  error?: string;
}

export async function testGeminiConnection(apiKey?: string, model?: string): Promise<KeyTestResult> {
  const keyToUse = (apiKey || localStorage.getItem('astro_gemini_api_key') || '').trim();
  const modelToUse = (model || localStorage.getItem('astro_gemini_model') || 'gemini-2.5-flash').trim();
  try {
    const res = await fetch('/api/llm/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(keyToUse ? { 'x-goog-api-key': keyToUse, 'x-api-key': keyToUse } : {})
      },
      body: JSON.stringify({
        isTestPing: true,
        prompt: 'hi',
        model: modelToUse,
        apiKey: keyToUse || undefined
      })
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      return {
        isChecking: false,
        success: true,
        statusCode: 200,
        model: data.model || modelToUse,
        message: `✓ Google Gemini Key Verified & Active (${data.model || modelToUse})`
      };
    } else {
      return {
        isChecking: false,
        success: false,
        statusCode: res.status,
        error: data.error || `HTTP ${res.status} Error`,
        message: data.error || 'Gemini Connection Failed'
      };
    }
  } catch (err: any) {
    return {
      isChecking: false,
      success: false,
      error: err.message,
      message: `Network Error: ${err.message}`
    };
  }
}

export async function testClaudeConnection(apiKey?: string, model?: string): Promise<KeyTestResult> {
  const keyToUse = (apiKey || localStorage.getItem('astro_anthropic_api_key') || '').trim();
  try {
    const res = await fetch('/api/llm/claude', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(keyToUse ? { 'x-api-key': keyToUse } : {})
      },
      body: JSON.stringify({
        isTestPing: true,
        prompt: 'hi',
        model: model || 'claude-sonnet-5-5',
        apiKey: keyToUse || undefined,
        thinkingMode: 'disabled'
      })
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      return {
        isChecking: false,
        success: true,
        statusCode: 200,
        model: data.model || model || 'claude-sonnet-5-5',
        message: `✓ Anthropic Claude Key Verified & Active (${data.model || 'Claude 5.5'})`
      };
    } else {
      return {
        isChecking: false,
        success: false,
        statusCode: res.status,
        error: data.error || `HTTP ${res.status} Error`,
        message: data.error || 'Claude Connection Failed'
      };
    }
  } catch (err: any) {
    return {
      isChecking: false,
      success: false,
      error: err.message,
      message: `Network Error: ${err.message}`
    };
  }
}
