// Type definitions for Capacitor globals (Native Mobile Support)
declare global {
  interface Window {
    Capacitor?: any;
  }
}

const isCapacitor = () => !!window.Capacitor;

// State tracking for current speech
let currentUtterance: SpeechSynthesisUtterance | null = null;

// --- INTELLIGENT MARKDOWN SANITIZER ---
// Prevents the TTS from reading syntax characters, URLs, or massive code blocks.
const cleanMarkdownForSpeech = (text: string): string => {
  if (!text) return "";
  let clean = text;

  // 1. Remove Code Blocks (The Genie shouldn't read raw Python/C++ code aloud)
  clean = clean.replace(/```[\s\S]*?```/g, "Code snippet provided. Please review the screen.");
  
  // 2. Remove Inline Code (`variable`) -> variable
  clean = clean.replace(/`([^`]+)`/g, "$1");

  // 3. Remove Links [Text](url) -> Text
  clean = clean.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // 4. Remove Images ![Alt](url) -> ""
  clean = clean.replace(/!\[([^\]]*)\]\([^)]+\)/g, "");

  // 5. Remove Bold/Italic (**, *, __, _)
  clean = clean.replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1");

  // 6. Remove Headers (#, ##)
  clean = clean.replace(/^#+\s+/gm, "");

  // 7. Remove Blockquotes (>)
  clean = clean.replace(/^>\s+/gm, "");

  // 8. Remove raw URLs (http://...) if they weren't caught by the link regex
  clean = clean.replace(/https?:\/\/[^\s]+/g, "link");

  // 9. Cleanup extra whitespace
  return clean.replace(/\s+/g, " ").trim();
};

export const speakText = (
  text: string,
  callbacks?: {
    onStart?: () => void;
    onEnd?: () => void;
    onPause?: () => void;
    onResume?: () => void;
    onError?: (e: any) => void;
  }
) => {
  // sanitize the technical output into conversational English
  const spokenText = cleanMarkdownForSpeech(text);

  if (isCapacitor()) {
    try {
      // Capacitor Native TTS Placeholder for future mobile compile
    } catch (e) {
      console.warn("Native TTS failed, falling back to Web", e);
    }
  }

  // Web Fallback
  if (!window.speechSynthesis) return;
  
  // Cancel any existing speech to prevent overlapping "Genie Voices"
  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(spokenText);
  utterance.rate = 1.1; // Slightly faster, confident pace
  utterance.pitch = 1.0; 
  
  // Voice Selection Strategy: Prioritize Natural/Google voices
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(v => 
    (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Premium')) && 
    v.lang.includes('en-US')
  ) || voices[0];
  
  if (preferredVoice) utterance.voice = preferredVoice;

  // Bind Events
  utterance.onstart = () => callbacks?.onStart?.();
  utterance.onend = () => {
    currentUtterance = null;
    callbacks?.onEnd?.();
  };
  utterance.onpause = () => callbacks?.onPause?.();
  utterance.onresume = () => callbacks?.onResume?.();
  utterance.onerror = (e) => {
    console.error("TTS Error", e);
    currentUtterance = null;
    callbacks?.onError?.(e);
    callbacks?.onEnd?.(); // Ensure UI resets on error
  };

  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
};

export const pauseSpeech = () => {
  if (window.speechSynthesis && window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
    window.speechSynthesis.pause();
  }
};

export const resumeSpeech = () => {
  if (window.speechSynthesis && window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
  }
};

export const cancelSpeech = () => {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  }
};

export const startListening = (
  onResult: (text: string) => void, 
  onEnd: () => void
): any => {
  // Capacitor Logic Placeholder
  if (isCapacitor()) {
    try {
       console.log("Capacitor Native ASR would run here.");
    } catch (e) {
        console.warn("Native ASR failed", e);
    }
  }

  // Web Speech API Fallback
  const iWindow = window as any;
  const SpeechRecognition = iWindow.SpeechRecognition || iWindow.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert("Voice input not supported on this device/browser.");
    onEnd();
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false; // Force single sentence
  recognition.interimResults = false; // Ignore partials completely
  recognition.lang = 'en-US';

  // SESSION GUARD: Ensure we only process ONE final result per session
  let hasFinalized = false;

  recognition.onresult = (event: any) => {
    if (hasFinalized) return;

    let finalTranscript = '';

    // Iterate results starting from this event's index
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      }
    }

    // Only fire callback if we actually have text and haven't finished yet
    if (finalTranscript.trim().length > 0) {
      hasFinalized = true;
      onResult(finalTranscript.trim());
      recognition.stop(); // Immediately stop to prevent tail-end artifacts
    }
  };

  recognition.onerror = (event: any) => {
    if (event.error !== 'no-speech') {
       console.error("Speech recognition error", event.error);
    }
    onEnd();
  };

  recognition.onend = () => {
    onEnd();
  };

  try {
    recognition.start();
  } catch (e) {
    console.error("Failed to start recognition", e);
    onEnd();
  }
  
  return recognition;
};