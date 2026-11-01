import React, { useState, useRef, useEffect } from 'react';
import { MacroManifest, MacroDomain, MacroResource } from '../types';
import { scoutIntent, forgeManifest } from '../services/geminiService';
import { compressImage } from '../utils/imageUtils';
import { ImageAnnotator } from './ImageAnnotator';

interface IntentEngineProps {
  apiKey: string;
  initialContext: any; 
  onComplete: (manifest: MacroManifest) => void;
}

const IntentEngine: React.FC<IntentEngineProps> = ({ apiKey, onComplete }) => {
  // INPUT STATE
  const [inputText, setInputText] = useState('');
  const [attachedFile, setAttachedFile] = useState<{ mimeType: string; data: string; name: string } | null>(null);
  
  // PROCESS STATE
  const [status, setStatus] = useState<'IDLE' | 'SCOUTING' | 'FORGING' | 'READY'>('IDLE');
  const [scoutResult, setScoutResult] = useState<{ domain: MacroDomain; refinedGoal: string } | null>(null);
  const [manifest, setManifest] = useState<MacroManifest | null>(null);
  
  // UI STATE
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [annotatingImage, setAnnotatingImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Rate Limit Timer
  useEffect(() => {
    if (cooldown > 0) {
        const timer = setInterval(() => setCooldown(c => c - 1), 1000);
        return () => clearInterval(timer);
    }
  }, [cooldown]);

  // --- PHASE 1: THE SCOUT (Classify & Refine) ---
  const handleScout = async () => {
    if (cooldown > 0 || !inputText.trim()) return;
    
    setStatus('SCOUTING');
    setErrorMsg(null);

    const result = await scoutIntent(inputText, apiKey, attachedFile ? { mimeType: attachedFile.mimeType, data: attachedFile.data } : undefined);

    if (!result.ok) {
      setStatus('IDLE');
      if (result.type === 'RATE_LIMIT') {
         setCooldown(result.retryAfterSeconds || 60);
         setErrorMsg(`Rate Limit Hit. Retry in ${result.retryAfterSeconds}s.`);
      } else {
         setErrorMsg(result.message || "Scouting failed.");
      }
      return;
    }

    setScoutResult(result.data);
    
    // Auto-trigger Phase 2
    handleForge(result.data.domain, result.data.refinedGoal);
  };

  // --- PHASE 2: THE FORGE (Generate Blueprint) ---
  const handleForge = async (domain: MacroDomain, goal: string) => {
    setStatus('FORGING');
    
    const result = await forgeManifest(domain, goal, apiKey, attachedFile ? { mimeType: attachedFile.mimeType, data: attachedFile.data } : undefined);

    if (!result.ok) {
      setStatus('IDLE'); // Revert to let user try again
      if (result.type === 'RATE_LIMIT') {
        setCooldown(result.retryAfterSeconds || 60);
        setErrorMsg(`Rate Limit Hit. Retry in ${result.retryAfterSeconds}s.`);
      } else {
        setErrorMsg(result.message || "Forging failed.");
      }
      return;
    }

    setManifest(result.data);
    setStatus('READY');
  };

  // --- FILE HANDLING ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Text Files: Read and append to prompt
    const textExtensions = ['.txt', '.md', '.csv', '.json', '.html', '.xml', '.py', '.js', '.ts', '.c'];
    const isTextFile = textExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

    if (isTextFile) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result as string;
            setInputText(prev => `${prev}\n\n[File Content: ${file.name}]\n${text}`);
        };
        reader.readAsText(file);
        return;
    }

    // Binary Files: Convert to Base64 for Gemini
    try {
        if (file.type.startsWith('image/')) {
            const compressed = await compressImage(file);
            setAnnotatingImage(compressed); // Open Annotator
            if(fileInputRef.current) fileInputRef.current.value = ''; 
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        await new Promise((resolve) => { reader.onload = resolve; });
        const result = reader.result as string;
        const base64Data = result.split(',')[1];
        
        setAttachedFile({
            mimeType: file.type,
            data: base64Data,
            name: file.name
        });
        
    } catch (err) {
        console.error(err);
        setErrorMsg("Failed to process file.");
    }
  };

  const handleAnnotationSave = async (annotatedBase64: string) => {
      setAnnotatingImage(null);
      const base64Data = annotatedBase64.split(',')[1];
      setAttachedFile({
          mimeType: 'image/jpeg',
          data: base64Data,
          name: "annotated_image.jpg"
      });
  };

  // --- RENDER HELPERS ---
  const getDomainColor = (domain: MacroDomain) => {
    switch(domain) {
      case MacroDomain.HARDWARE: return 'text-blue-400 border-blue-500/50 bg-blue-900/20';
      case MacroDomain.SOFTWARE: return 'text-green-400 border-green-500/50 bg-green-900/20';
      case MacroDomain.CULINARY: return 'text-orange-400 border-orange-500/50 bg-orange-900/20';
      case MacroDomain.MECHANICAL: return 'text-red-400 border-red-500/50 bg-red-900/20';
      default: return 'text-purple-400 border-purple-500/50 bg-purple-900/20';
    }
  };

  return (
    <div className="h-full w-full bg-gray-900 overflow-y-auto p-4 flex flex-col items-center">
      {/* ANNOTATOR MODAL */}
      {annotatingImage && (
        <ImageAnnotator 
          imageSrc={annotatingImage}
          onSave={handleAnnotationSave}
          onCancel={() => setAnnotatingImage(null)}
        />
      )}

      <div className="w-full max-w-4xl space-y-6 pb-20">
        
        {/* HEADER */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
            MacroMaster
          </h1>
          <p className="text-gray-400 text-sm uppercase tracking-widest">Where Tech Meets Technique</p>
        </div>

        {/* INPUT PHASE */}
        {status === 'IDLE' || status === 'SCOUTING' || status === 'FORGING' ? (
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl space-y-4 relative z-0 transition-all duration-300">
            
            {/* TEXT AREA */}
            <div className="relative">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Describe your goal... (e.g., 'Build a local LLM server', 'Debug this Python script', 'Fix my dryer')"
                disabled={status !== 'IDLE'}
                className="w-full h-48 bg-gray-900 border border-gray-600 rounded-lg p-4 text-sm font-mono text-gray-200 focus:border-blue-500 focus:outline-none resize-none disabled:opacity-50"
              />
              {attachedFile && (
                <div className="absolute bottom-4 right-4 bg-gray-800 border border-blue-500/50 text-blue-300 text-xs px-2 py-1 rounded flex items-center gap-2">
                    <span>📎 {attachedFile.name}</span>
                    <button onClick={() => setAttachedFile(null)} className="hover:text-white">×</button>
                </div>
              )}
            </div>

            {/* ERROR DISPLAY */}
            {errorMsg && (
                <div className="p-3 bg-red-900/50 border border-red-500/50 rounded text-red-200 text-sm font-bold text-center">
                    {errorMsg}
                </div>
            )}

            {/* LOADING STATE */}
            {(status === 'SCOUTING' || status === 'FORGING') && (
                <div className="text-center py-4 space-y-2 animate-pulse">
                   <div className="text-blue-400 font-bold text-lg">
                      {status === 'SCOUTING' ? "Scouting Domain..." : "Forging Blueprint..."}
                   </div>
                   <div className="text-gray-500 text-xs font-mono">
                      {status === 'FORGING' && scoutResult ? `Domain Identified: ${scoutResult.domain}` : "Analyzing Intent..."}
                   </div>
                </div>
            )}

            {/* CONTROLS */}
            {status === 'IDLE' && (
                <div className="flex gap-4">
                <button 
                    onClick={handleScout}
                    disabled={!inputText.trim() || cooldown > 0}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-700 disabled:opacity-50 text-white font-bold py-4 rounded-lg transition-all relative z-10 shadow-lg"
                >
                    {cooldown > 0 ? `Wait ${cooldown}s` : "Manifest Blueprint"}
                </button>
                
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".txt,.md,.csv,.json,.html,.xml,.pdf,.png,.jpeg,.jpg,.webp,.heic,.heif,.mp4,.mpeg,.mov,.avi,.flv,.mpg,.webm,.wmv,.3gpp,.wav,.mp3,.aiff,.aac,.ogg,.flac,.py,.js,.ts,.rs,.go,.cpp,.c" 
                    onChange={handleFileUpload} 
                />
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold py-3 rounded-lg disabled:opacity-50 flex items-center gap-2 relative z-10 border border-gray-600"
                >
                    <span>Upload Context</span>
                </button>
                </div>
            )}
          </div>
        ) : null}

        {/* READY PHASE (MANIFEST REVIEW) */}
        {status === 'READY' && manifest && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* SUMMARY CARD */}
            <div className={`p-6 rounded-xl border ${getDomainColor(manifest.domain)} relative overflow-hidden`}>
                <div className="absolute top-0 right-0 p-4 opacity-10 font-black text-6xl select-none">
                    {manifest.domain.split('_')[0]}
                </div>
                
                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-1">{manifest.title}</h2>
                            <span className="text-xs font-mono bg-black/30 px-2 py-1 rounded text-white/70">
                                {manifest.domain}
                            </span>
                        </div>
                        <div className={`px-3 py-1 rounded text-sm font-bold ${
                            manifest.feasibility.status === 'GO' ? 'bg-green-500 text-black' : 
                            manifest.feasibility.status === 'NO_GO' ? 'bg-red-500 text-white' : 'bg-yellow-500 text-black'
                        }`}>
                            {manifest.feasibility.status}
                        </div>
                    </div>

                    <div className="bg-black/20 p-4 rounded-lg backdrop-blur-sm mb-4">
                        <p className="text-gray-200 text-sm whitespace-pre-wrap font-mono">
                            {manifest.feasibility.summary}
                        </p>
                    </div>

                    {manifest.feasibility.criticalGaps.length > 0 && (
                        <div className="space-y-2">
                             <h4 className="text-red-400 text-xs font-bold uppercase">Critical Gaps Detected</h4>
                             {manifest.feasibility.criticalGaps.map((gap, i) => (
                                 <div key={i} className="text-sm text-red-200 flex items-center gap-2">
                                     <span>⚠️</span> {gap}
                                 </div>
                             ))}
                        </div>
                    )}
                </div>
            </div>

            {/* RESOURCES CARD */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
               <div className="p-4 bg-gray-700/50 border-b border-gray-700 flex justify-between items-center">
                <h3 className="font-bold text-gray-200">Required Resources</h3>
                <span className="text-xs text-gray-500">{manifest.resources.length} items</span>
              </div>
              <div className="divide-y divide-gray-700 max-h-64 overflow-y-auto">
                {manifest.resources.map((res) => (
                  <div key={res.id} className="p-3 flex justify-between items-center hover:bg-gray-700/30">
                     <div>
                        <div className="text-sm text-gray-200 font-medium">{res.name}</div>
                        <div className="text-xs text-gray-500">{res.type} • {res.spec || 'Standard'}</div>
                     </div>
                     <div className={`text-xs px-2 py-1 rounded ${
                         res.status === 'MISSING' ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'
                     }`}>
                         {res.quantity}
                     </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ACTIONS */}
            <div className="flex gap-4">
                <button 
                    onClick={() => {
                        setManifest(null);
                        setStatus('IDLE');
                    }}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold py-4 rounded-xl transition-colors"
                >
                    Refine Intent
                </button>
                <button 
                    onClick={() => onComplete(manifest)}
                    disabled={manifest.feasibility.status === 'NO_GO'}
                    className="flex-[2] bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-gray-700 disabled:to-gray-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg transition-all transform hover:scale-[1.02]"
                >
                    {manifest.feasibility.status === 'NO_GO' ? "Cannot Proceed" : "Ignite Module"}
                </button>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default IntentEngine;