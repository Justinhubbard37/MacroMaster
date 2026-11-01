import { SessionState } from '../types';

// REBRAND: Bumped version to segregate legacy PC Builder data from Universal Genie data
const STORAGE_KEY = 'macromaster_session_v1'; 
const API_KEY_STORAGE = 'macromaster_api_key';

export const saveApiKey = (key: string) => {
  localStorage.setItem(API_KEY_STORAGE, key);
};

export const getApiKey = (): string | null => {
  return localStorage.getItem(API_KEY_STORAGE);
};

export const clearApiKey = () => {
  localStorage.removeItem(API_KEY_STORAGE);
};

export const saveSession = (state: Omit<SessionState, 'apiKey'>) => {
  try {
    const serialized = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch (e) {
    console.warn("MacroMaster: Failed to save session (Quota Exceeded?)", e);
  }
};

export const loadSession = (): Omit<SessionState, 'apiKey'> | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error("MacroMaster: Session Load Failed", e);
    return null;
  }
};

export const clearSession = () => {
  localStorage.removeItem(STORAGE_KEY);
};