import { GoogleGenAI, Type } from "@google/genai";
import { MacroManifest, MacroDomain, ChatMessage, ServiceResponse } from "../types";

// --- CONFIGURATION ---
const MODEL_FAST = 'gemini-2.0-flash-exp'; // Speed for classification
const MODEL_SMART = 'gemini-2.0-pro-exp-02-05'; // Intelligence for blueprinting

const getClient = (apiKey: string) => new GoogleGenAI({ apiKey });

// --- ERROR HANDLING WRAPPER ---
async function safeGeminiCall<T>(operation: () => Promise<T>): Promise<ServiceResponse<T>> {
  try {
    const data = await operation();
    return { ok: true, data };
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    
    // Detect 429 / Resource Exhausted
    const isRateLimit = 
      error.status === 429 || 
      error.message?.includes('429') || 
      error.message?.includes('quota') || 
      error.message?.includes('RESOURCE_EXHAUSTED');

    if (isRateLimit) {
      let retryAfter = 60;
      const headerVal = error.response?.headers?.get?.('retry-after') || error.headers?.['retry-after'];
      if (headerVal) retryAfter = parseInt(headerVal, 10) || 60;
      
      return { 
        ok: false, 
        type: 'RATE_LIMIT', 
        retryAfterSeconds: retryAfter, 
        message: "API Rate Limit Exceeded." 
      };
    }

    return { ok: false, type: 'ERROR', message: error.message || "Unknown error" };
  }
}

// --- PHASE 1: THE SCOUT (INTENT CLASSIFICATION) ---
// Decides if this is a PC build, a recipe, or a coding task.
export const scoutIntent = async (
  userPrompt: string, 
  apiKey: string,
  fileData?: { mimeType: string; data: string }
): Promise<ServiceResponse<{ domain: MacroDomain; refinedGoal: string }>> => {
  return safeGeminiCall(async () => {
    const ai = getClient(apiKey);
    
    const promptText = `
      ANALYZE USER INTENT.
      Input: "${userPrompt}"
      Task: Classify this request into a Domain.
      Domains:
      - HARDWARE_ENGINEERING (PC building, electronics)
      - SOFTWARE_DEVELOPMENT (Coding, debugging, scripts)
      - CULINARY_ARTS (Cooking, recipes)
      - MECHANICAL_REPAIR (Cars, appliances)
      - CREATIVE_WRITING (Essays, stories)
      - GENERAL_TASK (Anything else)
      
      Output JSON only.
    `;

    const contents: any[] = [{ role: 'user', parts: [{ text: promptText }] }];
    if (fileData) {
      contents[0].parts.unshift({ inlineData: { mimeType: fileData.mimeType, data: fileData.data } });
    }

    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            domain: { type: Type.STRING, enum: Object.values(MacroDomain) },
            refinedGoal: { type: Type.STRING, description: "A concise summary of the objective" }
          },
          required: ["domain", "refinedGoal"]
        }
      }
    });

    const result = JSON.parse(response.text() || '{}');
    return { 
      domain: result.domain || MacroDomain.GENERAL, 
      refinedGoal: result.refinedGoal || userPrompt 
    };
  });
};

// --- PHASE 2: THE FORGE (MANIFEST GENERATION) ---
// Creates the "Zero-to-Hero" Blueprint.
export const forgeManifest = async (
  domain: MacroDomain,
  goal: string,
  apiKey: string,
  fileData?: { mimeType: string; data: string }
): Promise<ServiceResponse<MacroManifest>> => {
  return safeGeminiCall(async () => {
    const ai = getClient(apiKey);
    
    // DYNAMIC SYSTEM PROMPT INJECTION
    const domainDirectives: Record<string, string> = {
      [MacroDomain.HARDWARE]: "Focus on compatibility (Socket types, wattage, dimensions). Warn about static electricity.",
      [MacroDomain.SOFTWARE]: "Focus on environment setup, dependencies, and syntax. Warn about data loss.",
      [MacroDomain.CULINARY]: "Focus on mise-en-place, cooking times, and temperatures. Warn about food safety.",
      [MacroDomain.MECHANICAL]: "Focus on tools, torque specs, and safety. Warn about physical injury.",
      [MacroDomain.GENERAL]: "Break down into logical, linear steps."
    };

    const prompt = `
      GOAL: ${goal}
      DOMAIN: ${domain}
      DIRECTIVE: ${domainDirectives[domain] || "Create a logical guide."}
      
      Generate a complete Project Manifest.
      1. List all required resources (Ingredients, Parts, Libraries).
      2. Create a step-by-step Blueprint (Start to Finish).
      3. Assess Feasibility (Are there obvious missing pieces in the prompt?).
    `;

    const contents: any[] = [{ role: 'user', parts: [{ text: prompt }] }];
    if (fileData) { 
       contents[0].parts.unshift({ inlineData: { mimeType: fileData.mimeType, data: fileData.data } });
    }

    const response = await ai.models.generateContent({
      model: MODEL_SMART,
      contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            resources: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  type: { type: Type.STRING },
                  quantity: { type: Type.STRING },
                  spec: { type: Type.STRING },
                  status: { type: Type.STRING, enum: ["ACQUIRED", "MISSING"] }
                }
              }
            },
            blueprint: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  order: { type: Type.INTEGER },
                  phase: { type: Type.STRING },
                  instruction: { type: Type.STRING },
                  hazards: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
              }
            },
            feasibility: {
              type: Type.OBJECT,
              properties: {
                status: { type: Type.STRING, enum: ["GO", "NO_GO", "CAUTION"] },
                summary: { type: Type.STRING },
                criticalGaps: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            }
          }
        }
      }
    });

    const data = JSON.parse(response.text() || '{}');

    // Hydrate the Manifest
    const manifest: MacroManifest = {
      id: Date.now().toString(),
      domain,
      title: data.title || goal,
      originalIntent: goal,
      resources: data.resources?.map((r: any, i: number) => ({ ...r, id: `res-${i}` })) || [],
      blueprint: data.blueprint?.map((b: any, i: number) => ({ ...b, id: `step-${i}`, resourcesRequired: [], isComplete: false })) || [],
      feasibility: data.feasibility || { status: 'CAUTION', summary: 'Analysis incomplete', criticalGaps: [] },
      lastUpdated: Date.now()
    };

    return manifest;
  });
};

// --- PHASE 3: THE GUIDE (CONTEXTUAL CHAT) ---
export const consultGenie = async (
  userMessage: string,
  history: ChatMessage[],
  manifest: MacroManifest,
  apiKey: string
): Promise<ServiceResponse<{ text: string; sources: any[] }>> => {
  return safeGeminiCall(async () => {
    const ai = getClient(apiKey);
    
    // CONTEXT INJECTION
    const context = `
      ACTIVE PROJECT: ${manifest.title} (${manifest.domain})
      CURRENT STATUS: ${manifest.feasibility.status}
      RESOURCES: ${manifest.resources.map(r => r.name).join(', ')}
      BLUEPRINT STEPS: ${manifest.blueprint.length} total steps.
    `;

    const systemInstruction = `
      You are MacroMaster, the Genie in the Module.
      Your Domain: ${manifest.domain}.
      Your Goal: Guide the user to complete "${manifest.title}".
      Style: "Where tech meets technique." Witty, confident, strictly no jargon without explanation.
      
      PROTOCOL:
      1. If the user is stuck, reference the specific Blueprint Step.
      2. If safety is a risk (e.g. ${manifest.domain === 'HARDWARE_ENGINEERING' ? 'Static Shock' : 'Data Loss'}), WARN THEM FIRST.
      3. Use the defined resources list as the ground truth.
    `;

    // Convert history to Gemini format
    const chatHistory = history.map(msg => ({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.text }]
    }));

    // Add current query
    const contents = [
      ...chatHistory,
      { role: 'user', parts: [{ text: context + "\n\nUser Question: " + userMessage }] }
    ];

    const response = await ai.models.generateContent({
      model: MODEL_SMART,
      contents,
      config: { systemInstruction }
    });

    return { text: response.text() || "Thinking...", sources: [] };
  });
};