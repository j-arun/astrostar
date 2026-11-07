export const GEMINI_PRIMARY_MODEL = 'gemini-flash-latest';
export const GEMINI_FALLBACK_MODEL = 'gemini-4-argon';

const GEMINI_MODEL_STORAGE_KEY = 'astro_gemini_model';
const PREVIOUS_MODELS = ['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'];

export function getPreferredGeminiModel(): string {
  if (typeof window === 'undefined') return GEMINI_PRIMARY_MODEL;

  const storedModel = window.localStorage.getItem(GEMINI_MODEL_STORAGE_KEY);
  if (!storedModel || PREVIOUS_MODELS.includes(storedModel)) {
    window.localStorage.setItem(GEMINI_MODEL_STORAGE_KEY, GEMINI_PRIMARY_MODEL);
    return GEMINI_PRIMARY_MODEL;
  }

  return storedModel;
}
