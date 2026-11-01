// types.ts

// 1. THE DOMAIN COMPASS
export enum MacroDomain {
  HARDWARE = "HARDWARE_ENGINEERING",
  SOFTWARE = "SOFTWARE_DEVELOPMENT",
  CULINARY = "CULINARY_ARTS",
  MECHANICAL = "MECHANICAL_REPAIR",
  CREATIVE = "CREATIVE_WRITING",
  GENERAL = "GENERAL_TASK",
  UNKNOWN = "UNKNOWN"
}

// 2. THE UNIVERSAL ATOM
export interface MacroResource {
  id: string;
  name: string;
  type: string; 
  quantity: string; 
  spec?: string; 
  status: 'ACQUIRED' | 'MISSING' | 'OPTIONAL'; 
}

// 3. THE BLUEPRINT
export interface MacroStep {
  id: string;
  order: number;
  phase: string;
  instruction: string;
  hazards?: string[];
  resourcesRequired: string[];
  isComplete: boolean;
}

// 4. THE MASTER MANIFEST
export interface MacroManifest {
  id: string;
  domain: MacroDomain;
  title: string;
  originalIntent: string;
  resources: MacroResource[];
  blueprint: MacroStep[];
  feasibility: {
    status: 'GO' | 'NO_GO' | 'CAUTION';
    summary: string;
    criticalGaps: string[];
  };
  lastUpdated: number;
}

// 5. CHAT & STATE
export interface BuildImage {
  id: string;
  base64: string;
  timestamp: number;
  label: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: number;
  image?: string; 
  sources?: any[];
  isFavorite?: boolean;
}

export interface SessionState {
  apiKey: string | null;
  manifest: MacroManifest | null; // REPLACES 'profile'
  chatHistory: ChatMessage[];
  buildHistory: BuildImage[]; 
}

export type ServiceResponse<T> = 
  | { ok: true; data: T; type?: undefined; message?: undefined; retryAfterSeconds?: undefined }
  | { ok: false; type: 'RATE_LIMIT'; retryAfterSeconds: number; message: string; data?: undefined }
  | { ok: false; type: 'ERROR'; message: string; retryAfterSeconds?: undefined; data?: undefined };