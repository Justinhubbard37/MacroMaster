import React, { useState, useRef, useEffect } from 'react';
import { MacroManifest, ChatMessage, BuildImage, MacroStep, MacroDomain } from '../types';
import { consultGenie } from '../services/geminiService';
import { speakText, startListening, pauseSpeech, resumeSpeech, cancelSpeech } from '../utils/audioUtils';
import { compressImage } from '../utils/imageUtils';
import { saveSession } from '../utils/storageUtils';
import { ImageAnnotator } from './ImageAnnotator';

interface ChatInterfaceProps {
  apiKey: string;
  manifest: MacroManifest; // The Universal Truth
  history: ChatMessage[];
  visualHistory: BuildImage[];
  onReset: () => void;
}

// --- UNIVERSAL ICONOGRAPHY ---
// Visually anchors the user in their specific domain
const DomainIcon = ({ domain }: { domain: MacroDomain }) => {
  const props = { className: "w-5 h-5" };
  switch (domain) {
    case MacroDomain.HARDWARE:
      return <span title="Hardware Engineering">🔧</span>; // Wrench
    case MacroDomain.SOFTWARE:
      return <span title="Software Development">💻</span>; // Laptop
    case MacroDomain.CULINARY:
      return <span title="Culinary Arts">🍳</span>; // Cooking
    case MacroDomain.MECHANICAL:
      return <span title="Mechanical Repair">⚙️</span>; // Gear
    case MacroDomain.CREATIVE:
      return <span title="Creative Writing">🖋️</span>; // Pen
    default:
      return <span title="General Task">📋</span>; // Clipboard
  }
};

type AudioState = 'idle' | 'playing' | 'paused';

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  apiKey, manifest, history: initialHistory, visualHistory: initialVisualHistory, onReset 
}) => {
  
  // STATE MANAGEMENT
  const [messages, setMessages] = useState<ChatMessage[]>(initialHistory.length > 0 ? initialHistory : [
    {
      id: 'welcome',
      role: 'model',
      text: `Protocol initiated: ${manifest.title}. \nI have analyzed ${manifest.resources.length} resources and ${manifest.blueprint.length} execution steps. \n\nReady when you are.`,
      timestamp: Date.now()
    }
  ]);
  
  const [buildHistory, setBuildHistory] = useState<BuildImage[]>(initialVisualHistory);
  // We hydrate the blueprint status from the manifest props initially
  const [blueprint, setBlueprint] = useState<MacroStep[]>(manifest.blueprint);
  
  // INPUT STATE
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [annotatingImage, setAnnotatingImage] = useState<string | null>(null);
  
  // UI STATE
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'resources' | 'blueprint' | 'favorites'>('blueprint');
  const [audioState, setAudioState] = useState<AudioState>('idle');
  const [cooldown, setCooldown] = useState(0);

  const isSendingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- PERSISTENCE LAYER ---
  // Syncs the living state of the Manifest to storage on every change
  useEffect(() => {
    // We create a "Living Manifest" by merging current blueprint state into the original
    const currentManifest = {
        ...manifest,
        blueprint: blueprint
    };

    saveSession({ 
        manifest: currentManifest, 
        chatHistory: messages, 
        buildHistory 
    });
  }, [messages, buildHistory, blueprint, manifest]);

  // Scroll on new message
  useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Cooldown Tick
  useEffect(() => {
    if (cooldown > 0) {
        const timer = setInterval(() => setCooldown(c => c - 1), 1000);
        return () => clearInterval(timer);
    }
  }, [cooldown]);

  // Cleanup Audio
  useEffect(() => {
    return () => { cancelSpeech(); };
  }, []);

  // --- LOGIC GATES ---

  const toggleStep = (stepId: string) => {
    setBlueprint(prev => prev.map(step => 
      step.id === stepId ? { ...step, isComplete: !step.isComplete } : step
    ));
  };

  const calculateProgress = () => {
    if (blueprint.length === 0) return 0;
    const completed = blueprint.filter(s => s.isComplete).length;
    return Math.round((completed / blueprint.length) * 100);
  };

  const handleSpeak = (text: string) => {
    speakText(text, {
      onStart: () => setAudioState('playing'),
      onEnd: () => setAudioState('idle'),
      onPause: () => setAudioState('paused'),
      onResume: () => setAudioState('playing'),
      onError: () => setAudioState('idle')
    });
  };

  const handleSendMessage = async (text: string, image?: string | null) => {
    if (isSendingRef.current || cooldown > 0) return;
    if ((!text.trim() && !image) || isLoading) return;

    isSendingRef.current = true;
    setIsLoading(true);

    // 1. Optimistic UI Update
    const newUserMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      timestamp: Date.now(),
      // @ts-ignore - Valid in our schema but TS might complain depending on strictness
      image: image || undefined 
    };

    setMessages(prev => [...prev, newUserMsg]);
    setInputText('');
    setAttachedImage(null);

    // Save visual history if image present
    if (image) {
      setBuildHistory(prev => [...prev, {
        id: Date.now().toString(),
        base64: image,
        timestamp: Date.now(),
        label: `Snapshot ${prev.length + 1}`
      }]);
    }

    // 2. The Genie Call
    const livingManifest = { ...manifest, blueprint };
    
    const result = await consultGenie(
      text || "Analyze this image context.",
      messages,
      livingManifest,
      apiKey
    );

    // 3. Handle Response
    if (result.ok) {
        const newModelMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: result.data.text,
          timestamp: Date.now(),
          // @ts-ignore
          sources: result.data.sources
        };
        setMessages(prev => [...prev, newModelMsg]);
        handleSpeak(result.data.text);
    } else {
        // Error / Rate Limit Handling
        if (result.type === 'RATE_LIMIT') setCooldown(result.retryAfterSeconds || 60);
        
        const errorMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'system',
            text: `⚠️ ${result.message}`,
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, errorMsg]);
    }

    setIsLoading(false);
    isSendingRef.current = false;
  };

  // --- FILE & AUDIO HANDLERS ---
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedBase64 = await compressImage(file);
        setAnnotatingImage(compressedBase64);
        if(fileInputRef.current) fileInputRef.current.value = ''; 
      } catch (err) {
        alert("Image processing failed.");
      }
    }
  };

  const toggleListening = () => {
    if (isListening) return;
    setIsListening(true);
    startListening(
      (transcript) => {
        setInputText(prev => {
          const trimmed = prev.trim();
          return trimmed ? `${trimmed} ${transcript}` : transcript;
        });
      },
      () => setIsListening(false)
    );
  };

  // --- RENDER ---
  return (
    <div className="flex h-full w-full bg-gray-900 overflow-hidden relative">
      
      {/* ANNOTATOR */}
      {annotatingImage && (
        <ImageAnnotator 
          imageSrc={annotatingImage}
          onSave={(b64) => { setAttachedImage(b64.split(',')[1]); setAnnotatingImage(null); }}
          onCancel={() => setAnnotatingImage(null)}
        />
      )}

      {/* MAIN CHAT AREA */}
      <div className="flex flex-col h-full flex-1 transition-all relative">
        
        {/* HEADER */}
        <header className="bg-gray-800/80 backdrop-blur-md p-3 border-b border-gray-700 flex justify-between items-center z-20">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowSidebar(!showSidebar)} className="md:hidden p-2 text-gray-400 bg-gray-700/50 rounded-lg">☰</button>
            <div>
                <h1 className="font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 text-lg flex items-center gap-2">
                    MacroMaster <span className="text-gray-500 text-xs font-mono border border-gray-600 px-1 rounded">GENIE</span>
                </h1>
                <p className="text-[10px] text-gray-400 tracking-wider uppercase">
                    Where Tech Meets Technique
                </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Domain Context Moved Here */}
            <div className="hidden md:flex flex-col items-end mr-2">
                <span className="text-[10px] text-gray-500 uppercase font-bold flex items-center gap-1">
                  <DomainIcon domain={manifest.domain} /> {manifest.domain.replace('_', ' ')}
                </span>
                <div className="w-24 h-1.5 bg-gray-700 rounded-full mt-1">
                    <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{width: `${calculateProgress()}%`}}></div>
                </div>
            </div>
            <button onClick={onReset} className="text-xs text-red-400 hover:bg-red-900/20 border border-red-500/30 px-3 py-1.5 rounded transition-colors">
                Abort
            </button>
          </div>
        </header>

        {/* CHAT MESSAGES */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
          {messages.map((msg) => (
             <div id={`msg-${msg.id}`} key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : msg.role === 'system' ? 'justify-center' : 'justify-start'}`}>
              <div className={`relative max-w-[90%] md:max-w-[75%] rounded-2xl p-4 shadow-xl text-sm leading-relaxed ${
                msg.role === 'user' ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white' : 
                msg.role === 'system' ? 'bg-red-900/50 text-red-200 border border-red-500/50' : 
                'bg-gray-800 text-gray-200 border border-gray-700'
              }`}>
                {msg.image && (
                   <img src={`data:image/jpeg;base64,${msg.image}`} className="max-h-64 rounded-lg border border-white/10 mb-3" />
                )}
                <div className="whitespace-pre-wrap markdown-body font-sans">{msg.text}</div>
              </div>
          </div>
          ))}
          {isLoading && <div className="text-gray-500 text-xs animate-pulse p-4 pl-8">Thinking...</div>}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT BAR */}
        <div className="bg-gray-800 p-3 shrink-0 border-t border-gray-700 relative z-30">
           {cooldown > 0 && (
             <div className="absolute bottom-full left-0 right-0 bg-red-900/90 text-white p-2 text-center text-sm font-bold backdrop-blur-md">
               Rate Limit Active: {cooldown}s
             </div>
           )}
           {attachedImage && (
              <div className="text-xs text-green-400 mb-2 flex items-center gap-2 bg-gray-900/50 p-1 rounded w-fit px-2">
               <span>📎 Image Attached</span>
               <button onClick={() => setAttachedImage(null)} className="hover:text-white">×</button>
             </div>
           )}
           <div className="flex gap-2">
             <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-gray-700 rounded-lg text-gray-300 hover:bg-gray-600 transition-colors">
               <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
               📷
             </button>
             <input 
               value={inputText}
               onChange={e => setInputText(e.target.value)}
               className="flex-1 bg-gray-900 rounded-lg px-4 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 border border-gray-700"
               placeholder="Ask the Genie..."
               onKeyDown={e => e.key === 'Enter' && handleSendMessage(inputText, attachedImage)}
             />
             <button onClick={toggleListening} className={`p-3 rounded-lg ${isListening ? 'bg-red-500 animate-pulse text-white' : 'bg-gray-700 text-gray-300'}`}>
               🎤
             </button>
             <button 
               onClick={() => handleSendMessage(inputText, attachedImage)}
               disabled={(!inputText && !attachedImage) || isLoading || cooldown > 0}
               className="p-3 bg-blue-600 rounded-lg text-white font-bold hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
             >
               Send
             </button>
           </div>
        </div>
      </div>

      {/* SIDEBAR (THE GRIMOIRE) */}
      <div className={`absolute inset-y-0 right-0 w-80 bg-gray-900 border-l border-gray-700 transform transition-transform z-40 flex flex-col ${showSidebar ? 'translate-x-0' : 'translate-x-full md:relative md:translate-x-0 md:w-80'}`}>
         
         {/* TABS */}
         <div className="p-2 bg-gray-800 border-b border-gray-700 flex gap-1">
             <button onClick={() => setSidebarTab('blueprint')} className={`flex-1 text-xs py-2 rounded font-bold ${sidebarTab === 'blueprint' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Blueprint</button>
             <button onClick={() => setSidebarTab('resources')} className={`flex-1 text-xs py-2 rounded font-bold ${sidebarTab === 'resources' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>Resources</button>
             <button onClick={() => setShowSidebar(false)} className="md:hidden px-3 text-gray-500">×</button>
         </div>

         <div className="flex-1 overflow-y-auto p-4">
           
           {/* BLUEPRINT TAB */}
           {sidebarTab === 'blueprint' && (
             <div className="space-y-2">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Execution Plan</div>
                {blueprint.map((step) => (
                  <button 
                    key={step.id} 
                    onClick={() => toggleStep(step.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all group ${
                        step.isComplete ? 'bg-gray-800/30 border-gray-800 opacity-50' : 'bg-gray-800 border-gray-700 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                        <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                            step.isComplete ? 'bg-green-500 border-green-500' : 'border-gray-500'
                        }`}>
                            {step.isComplete && <span className="text-white text-[10px]">✓</span>}
                        </div>
                        <div>
                            <div className={`text-sm font-medium ${step.isComplete ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
                                {step.instruction}
                            </div>
                            {step.hazards && step.hazards.length > 0 && !step.isComplete && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                    {step.hazards.map((h, i) => (
                                        <span key={i} className="text-[10px] bg-red-900/30 text-red-300 px-1.5 rounded border border-red-500/20">⚠️ {h}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                  </button>
                ))}
             </div>
           )}

           {/* RESOURCES TAB */}
           {sidebarTab === 'resources' && (
             <div className="space-y-4">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Required Materials</div>
                {manifest.resources.map(res => (
                  <div key={res.id} className="bg-gray-800 p-3 rounded-lg border border-gray-700 flex justify-between items-center">
                      <div>
                          <div className="text-sm font-medium text-gray-200">{res.name}</div>
                          <div className="text-xs text-gray-500">{res.type}</div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded font-mono ${
                          res.status === 'MISSING' ? 'bg-red-900/20 text-red-400' : 'bg-blue-900/20 text-blue-400'
                      }`}>
                          {res.quantity}
                      </span>
                  </div>
                ))}
             </div>
           )}
         </div>
      </div>

    </div>
  );
};

export default ChatInterface;