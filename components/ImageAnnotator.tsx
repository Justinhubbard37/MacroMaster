import React, { useRef, useState, useEffect } from 'react';

interface ImageAnnotatorProps {
  imageSrc: string;
  onSave: (annotatedImage: string) => void;
  onCancel: () => void;
}

export const ImageAnnotator: React.FC<ImageAnnotatorProps> = ({ imageSrc, onSave, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#EF4444'); // Default Red (High Visibility)
  const [lineWidth, setLineWidth] = useState(4);
  const [tool, setTool] = useState<'pen' | 'text'>('pen');
  const [textInput, setTextInput] = useState<{ x: number; y: number; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;
    img.onload = () => {
      // Intelligent Scaling: Fit image to viewport while maintaining aspect ratio
      const maxWidth = window.innerWidth * 0.95;
      const maxHeight = window.innerHeight * 0.8;
      
      let width = img.width;
      let height = img.height;

      const ratio = Math.min(maxWidth / width, maxHeight / height);
      if (ratio < 1) {
          width *= ratio;
          height *= ratio;
      }

      canvas.width = width;
      canvas.height = height;
      
      // Draw white background first (Critical for transparent PNGs)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
    };
  }, [imageSrc]);

  // Robust Coordinate Calculation (Touch + Mouse)
  const getCoordinates = (e: React.MouseEvent | React.TouchEvent | any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
       clientX = e.changedTouches[0].clientX;
       clientY = e.changedTouches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (tool !== 'pen') return;
    // Prevent scrolling while drawing on mobile
    if (e.type === 'touchstart') e.preventDefault(); 

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || tool !== 'pen') return;
    if (e.type === 'touchmove') e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
        setIsDrawing(false);
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        ctx?.closePath();
    }
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (tool === 'text') {
       const { x, y } = getCoordinates(e);
       setTextInput({ x, y, text: '' });
    }
  };

  const handleTextSubmit = () => {
    if (!textInput || !canvasRef.current) return;
    if (!textInput.text.trim()) {
        setTextInput(null);
        return;
    }

    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
        ctx.fillStyle = color;
        ctx.font = 'bold 20px sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText(textInput.text, textInput.x, textInput.y);
    }
    setTextInput(null);
  };

  const handleSave = () => {
     if (canvasRef.current && !isSaving) {
         setIsSaving(true);
         const fullDataUrl = canvasRef.current.toDataURL('image/jpeg', 0.85);
         // SANITIZATION: We must strip the header for the Gemini Service
         // but since onSave expects the full string to display previews, 
         // we pass the full string. The Service Layer or Parent must strip it if needed.
         // WAIT - The parent IntentEngine expects base64 for display? 
         // Actually, standardizing on passing FULL DataURL is safer for UI components.
         // The Service layer will strip it.
         onSave(fullDataUrl); 
         setIsSaving(false);
     }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/95 flex flex-col items-center justify-center p-2 backdrop-blur-md animate-in fade-in duration-200">
      
      {/* TOOLBAR */}
      <div className="flex flex-wrap items-center gap-2 mb-4 bg-gray-800 p-2 rounded-xl border border-gray-700 shadow-2xl">
        <button 
           onClick={() => setTool('pen')} 
           className={`p-2 rounded-lg transition-colors ${tool === 'pen' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
           title="Draw"
        >
          ✏️
        </button>
        <button 
           onClick={() => setTool('text')} 
           className={`p-2 rounded-lg transition-colors ${tool === 'text' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
           title="Add Text"
        >
          T
        </button>
        
        <div className="h-6 w-px bg-gray-600 mx-1"></div>
        
        <input 
           type="color" 
           value={color} 
           onChange={(e) => setColor(e.target.value)} 
           className="h-9 w-9 rounded cursor-pointer bg-transparent border-none" 
           title="Color"
        />
        <input 
            type="range" 
            min="1" 
            max="15" 
            value={lineWidth} 
            onChange={(e) => setLineWidth(Number(e.target.value))}
            className="w-24 accent-blue-500"
            title="Line Width"
        />

        <div className="h-6 w-px bg-gray-600 mx-1"></div>

        <button 
          onClick={handleSave} 
          disabled={isSaving}
          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white px-6 py-2 rounded-lg font-bold text-sm shadow-lg disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Done"}
        </button>
        <button 
          onClick={onCancel} 
          disabled={isSaving}
          className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-lg"
        >
          Cancel
        </button>
      </div>

      {/* CANVAS CONTAINER */}
      <div className="relative overflow-hidden rounded-lg border border-gray-700 shadow-2xl bg-black" ref={containerRef}>
        <canvas
          ref={canvasRef}
          className="touch-none cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          onClick={handleCanvasClick}
        />
        
        {/* TEXT INPUT OVERLAY */}
        {textInput && (
          <input
            autoFocus
            type="text"
            value={textInput.text}
            onChange={(e) => setTextInput({ ...textInput, text: e.target.value })}
            onBlur={handleTextSubmit}
            onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
            className="absolute bg-gray-900/80 border border-blue-500 outline-none p-2 rounded shadow-xl backdrop-blur-sm text-white"
            style={{ 
                left: Math.min(textInput.x, (canvasRef.current?.width || 0) - 150), 
                top: textInput.y, 
                color: color, 
                font: 'bold 20px sans-serif',
                minWidth: '150px'
            }}
            placeholder="Type label..."
          />
        )}
      </div>
      <div className="mt-2 text-gray-400 text-xs font-mono">
         {tool === 'pen' ? 'Draw to highlight areas' : 'Tap anywhere to place text'}
      </div>
    </div>
  );
};