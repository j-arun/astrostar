export const GEMINI_PRIMARY_MODEL = 'gemini-3.8-flash';
export const GEMINI_FALLBACK_MODEL = 'gemini-3.1-flash-lite';

const GEMINI_MODEL_STORAGE_KEY = 'astro_gemini_model';
const PREVIOUS_DEFAULT_MODEL = 'gemini-2.5-flash';

export function getPreferredGeminiModel(): string {
  if (typeof window === 'undefined') return GEMINI_PRIMARY_MODEL;

  const storedModel = window.localStorage.getItem(GEMINI_MODEL_STORAGE_KEY);
  if (!storedModel || storedModel === PREVIOUS_DEFAULT_MODEL) {
    window.localStorage.setItem(GEMINI_MODEL_STORAGE_KEY, GEMINI_PRIMARY_MODEL);
    return GEMINI_PRIMARY_MODEL;
  }

  return storedModel;
}
