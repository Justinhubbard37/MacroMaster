import React, { useState } from 'react';
import { saveApiKey } from '../utils/storageUtils';

interface ApiKeyGateProps {
  onKeyProvided: (key: string) => void;
}

const ApiKeyGate: React.FC<ApiKeyGateProps> = ({ onKeyProvided }) => {
  const [inputKey, setInputKey] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputKey.trim().length > 10) {
      saveApiKey(inputKey.trim());
      onKeyProvided(inputKey.trim());
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-gray-900 p-6">
      <div className="w-full max-w-md bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700 relative overflow-hidden">
        
        {/* Protocol Accent Line */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>

        <div className="text-center mb-8 space-y-2">
           <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
            MacroMaster
          </h1>
          <p className="text-gray-400 text-xs uppercase tracking-widest font-medium">
            Where Tech Meets Technique
          </p>
        </div>

        <p className="text-gray-300 mb-6 text-center text-sm leading-relaxed">
          Protocol requires authentication. Please enter your Google Gemini API Key to initialize the module.
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">API Key Credentials</label>
            <input 
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="AIza..."
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all font-mono text-sm shadow-inner"
            />
          </div>
          <button 
            type="submit"
            disabled={inputKey.length < 10}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-700 disabled:opacity-50 text-white font-bold py-4 rounded-lg transition-all shadow-lg transform hover:scale-[1.02]"
          >
            Initialize Module
          </button>
        </form>
        <p className="mt-6 text-[10px] text-gray-600 text-center uppercase tracking-wider">
          Credentials are encrypted and stored locally.
        </p>
      </div>
    </div>
  );
};

export default ApiKeyGate;