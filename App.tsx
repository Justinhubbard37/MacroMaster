import React, { useState, useEffect } from 'react';
import ApiKeyGate from './components/ApiKeyGate';
import IntentEngine from './components/IntentEngine'; 
import ChatInterface from './components/ChatInterface';
import { MacroManifest, SessionState } from './types'; 
import { getApiKey, clearApiKey, loadSession, clearSession } from './utils/storageUtils';

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string | null>(null);
  
  // STATE: The 'activeManifest' holds the entire reality of the user's project 
  const [activeManifest, setActiveManifest] = useState<MacroManifest | null>(null);
  const [sessionData, setSessionData] = useState<Omit<SessionState, 'apiKey'> | null>(null);

  // Load Session on Mount
  useEffect(() => {
    const storedKey = getApiKey();
    if (storedKey) setApiKey(storedKey);

    const savedSession = loadSession();
    // LOGIC GATE: Ensure we are loading a Universal Manifest
    if (savedSession && savedSession.manifest) {
      setActiveManifest(savedSession.manifest);
      setSessionData(savedSession);
    }
  }, []);

  const handleReset = () => {
    clearSession();
    setActiveManifest(null);
    setSessionData(null);
  };

  const handleClearKey = () => {
    clearApiKey();
    setApiKey(null);
  };

  if (!apiKey) {
    return <ApiKeyGate onKeyProvided={setApiKey} />;
  }

  return (
    <div className="h-[100dvh] w-screen bg-gray-900 text-gray-100 overflow-hidden flex flex-col">
      {!activeManifest ? (
        <>
          {/* THE INTENT PHASE */}
          <div className="absolute top-4 right-4 z-50">
             <button onClick={handleClearKey} className="text-xs text-gray-500 hover:text-white underline font-mono">
               Change API Key
             </button>
          </div>
          
          {/* The Universal Intent Engine */}
          <IntentEngine 
            apiKey={apiKey}
            initialContext={null}
            onComplete={(newManifest: MacroManifest) => {
              setActiveManifest(newManifest);
              // Initialize the universal session state
              setSessionData({ 
                manifest: newManifest,
                chatHistory: [], 
                buildHistory: []
              });
            }} 
          />
        </>
      ) : (
        /* THE GUIDANCE PHASE */
        <ChatInterface 
          apiKey={apiKey}
          manifest={activeManifest} // The single source of truth
          history={sessionData?.chatHistory || []}
          visualHistory={sessionData?.buildHistory || []}
          onReset={handleReset}
        />
      )}
    </div>
  );
};

export default App;