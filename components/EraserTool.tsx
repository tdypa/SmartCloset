import React, { useRef, useEffect, useState } from 'react';
import { Eraser, Undo, Save, Crop, Check, X, Ban, Scissors } from 'lucide-react';

interface EraserToolProps {
  imageSrc: string;
  onSave: (newImageSrc: string) => void;
  onCancel: () => void;
}

interface HistoryItem {
  data: ImageData;
  width: number;
  height: number;
}

const EraserTool: React.FC<EraserToolProps> = ({ imageSrc, onSave, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<'erase' | 'crop'>('erase');
  const [brushSize, setBrushSize] = useState(20);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  // Eraser State
  const [isErasing, setIsErasing] = useState(false);

  // Crop State
  const [cropRect, setCropRect] = useState<{x: number, y: number, w: number, h: number} | null>(null);
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const [dragStart, setDragStart] = useState<{x: number, y: number} | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      // Fit to screen width/height with padding
      const maxWidth = window.innerWidth - 32;
      const maxHeight = window.innerHeight - 220; 
      
      let scale = Math.min(maxWidth / img.width, maxHeight / img.height);
      // Ensure at least some visibility, but generally scale down to fit or 1:1 if fits
      if (scale > 1) scale = 1; 
      
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      saveState();
    };
  }, [imageSrc]);

  const saveState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    setHistory(prev => {
        const newState = {
            data: ctx.getImageData(0, 0, canvas.width, canvas.height),
            width: canvas.width,
            height: canvas.height
        };
        // Keep last 10 steps
        const newHistory = [...prev, newState];
        if (newHistory.length > 10) return newHistory.slice(newHistory.length - 10);
        return newHistory;
    });
  };

  const handleUndo = () => {
    if (history.length <= 1) return;
    const newHistory = [...history];
    newHistory.pop(); // Remove current
    const prevState = newHistory[newHistory.length - 1];
    setHistory(newHistory);
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx && prevState) {
      canvas.width = prevState.width;
      canvas.height = prevState.height;
      ctx.putImageData(prevState.data, 0, 0);
      setCropRect(null); // Reset crop if active
    }
  };

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  // --- ERASER HANDLERS ---
  const startErasing = (e: React.MouseEvent | React.TouchEvent) => {
    if (mode !== 'erase') return;
    setIsErasing(true);
    erase(e);
  };

  const stopErasing = () => {
    if (isErasing) {
      setIsErasing(false);
      saveState();
    }
  };

  const erase = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isErasing || mode !== 'erase') return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const { x, y } = getPos(e);
    // Draw transparent circle (erase)
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
    // Reset comp op? Usually not needed if we only erase, 
    // but if we were drawing, we'd reset. 
    // For safety in case we add other tools:
    ctx.globalCompositeOperation = 'source-over'; 
  };

  // --- CROP HANDLERS ---
  const startCrop = (e: React.MouseEvent | React.TouchEvent) => {
    if (mode !== 'crop') return;
    const { x, y } = getPos(e);
    setDragStart({ x, y });
    setCropRect({ x, y, w: 0, h: 0 });
    setIsDraggingCrop(true);
  };

  const moveCrop = (e: React.MouseEvent | React.TouchEvent) => {
    if (mode !== 'crop' || !isDraggingCrop || !dragStart) return;
    
    // Prevent scrolling on mobile while dragging
    // e.preventDefault(); // React synthetic events might not support this reliably for touch unless passive: false

    const { x, y } = getPos(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Bounds check
    const currentX = Math.max(0, Math.min(x, canvas.width));
    const currentY = Math.max(0, Math.min(y, canvas.height));
    
    const newX = Math.min(dragStart.x, currentX);
    const newY = Math.min(dragStart.y, currentY);
    const newW = Math.abs(currentX - dragStart.x);
    const newH = Math.abs(currentY - dragStart.y);
    
    setCropRect({ x: newX, y: newY, w: newW, h: newH });
  };

  const endCrop = () => {
    setIsDraggingCrop(false);
  };

  const applyCrop = () => {
    if (!cropRect || cropRect.w < 10 || cropRect.h < 10) {
        alert("Selection too small");
        return;
    }
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    try {
        const croppedData = ctx.getImageData(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
        canvas.width = cropRect.w;
        canvas.height = cropRect.h;
        ctx.putImageData(croppedData, 0, 0);
        saveState();
        setCropRect(null);
        setMode('erase'); // Switch back to erase after crop
    } catch (e) {
        console.error("Crop failed", e);
    }
  };

  const cancelCrop = () => {
      setCropRect(null);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      onSave(canvas.toDataURL('image/png'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4">
      {/* HEADER */}
      <div className="text-white mb-2 text-center w-full relative h-10 flex items-center justify-center">
        <h3 className="font-bold text-lg">
            {mode === 'erase' ? 'Eraser' : 'Crop'}
        </h3>
        {mode === 'crop' && cropRect && cropRect.w > 10 && (
             <div className="absolute right-0 flex gap-2">
                <button onClick={cancelCrop} className="p-1 bg-red-500 rounded text-white">
                    <X size={16}/>
                </button>
                <button onClick={applyCrop} className="p-1 bg-green-500 rounded text-white">
                    <Check size={16}/>
                </button>
             </div>
        )}
      </div>

      <div className="text-gray-400 text-xs mb-2">
         {mode === 'erase' ? 'Drag to erase background' : 'Drag to draw crop area'}
      </div>

      {/* CANVAS CONTAINER */}
      <div 
        ref={containerRef}
        className="relative overflow-hidden border border-gray-700 rounded-lg bg-[url('https://www.transparenttextures.com/patterns/checkerboard.png')]"
        style={{ touchAction: 'none' }} // Critical for preventing scroll while drawing
      >
         <canvas 
            ref={canvasRef}
            // Attach Eraser Events
            onMouseDown={startErasing}
            onMouseMove={erase}
            onMouseUp={stopErasing}
            onMouseLeave={stopErasing}
            onTouchStart={startErasing}
            onTouchMove={erase}
            onTouchEnd={stopErasing}
            className={`cursor-crosshair block ${mode === 'crop' ? 'opacity-75' : ''}`}
         />

         {/* CROP OVERLAY LAYER */}
         {mode === 'crop' && (
            <div 
                className="absolute inset-0 cursor-crosshair z-10"
                onMouseDown={startCrop}
                onMouseMove={moveCrop}
                onMouseUp={endCrop}
                onMouseLeave={endCrop}
                onTouchStart={startCrop}
                onTouchMove={moveCrop}
                onTouchEnd={endCrop}
            >
                {cropRect && (
                    <div 
                        className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] pointer-events-none"
                        style={{
                            left: cropRect.x,
                            top: cropRect.y,
                            width: cropRect.w,
                            height: cropRect.h,
                        }}
                    >
                        {/* Grid lines rule of thirds */}
                        <div className="absolute inset-0 flex flex-col justify-evenly opacity-30">
                            <div className="h-px bg-white w-full"></div>
                            <div className="h-px bg-white w-full"></div>
                        </div>
                        <div className="absolute inset-0 flex justify-evenly opacity-30">
                            <div className="w-px bg-white h-full"></div>
                            <div className="w-px bg-white h-full"></div>
                        </div>
                    </div>
                )}
            </div>
         )}
      </div>

      {/* TOOLBAR */}
      <div className="w-full max-w-md mt-6 flex flex-col gap-4">
        
        {/* Brush Size (Only for Eraser) */}
        {mode === 'erase' && (
            <div className="flex items-center gap-2 px-4 animate-fade-in">
                <span className="text-white text-xs">Size</span>
                <input 
                type="range" 
                min="5" 
                max="80" 
                value={brushSize} 
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-full accent-white"
                />
            </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between items-center gap-2 px-2">
            <button onClick={onCancel} className="flex-1 py-3 text-white bg-gray-800 rounded-xl hover:bg-gray-700 text-sm font-medium">
                Cancel
            </button>
            
            <button 
                onClick={handleUndo} 
                disabled={history.length <= 1} 
                className="p-3 bg-gray-800 rounded-xl text-white disabled:opacity-30"
                title="Undo"
            >
                <Undo size={20} />
            </button>

            {/* Mode Switcher */}
            <div className="bg-gray-800 p-1 rounded-xl flex">
                 <button 
                    onClick={() => { setMode('erase'); setCropRect(null); }}
                    className={`p-2 rounded-lg transition-colors ${mode === 'erase' ? 'bg-white text-black' : 'text-gray-400'}`}
                    title="Eraser Tool"
                 >
                     <Eraser size={20} />
                 </button>
                 <button 
                    onClick={() => setMode('crop')}
                    className={`p-2 rounded-lg transition-colors ${mode === 'crop' ? 'bg-white text-black' : 'text-gray-400'}`}
                    title="Crop Tool"
                 >
                     <Crop size={20} />
                 </button>
            </div>

            <button onClick={handleSave} className="flex-1 py-3 bg-white text-black rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                <Save size={18} />
                Done
            </button>
        </div>
      </div>
    </div>
  );
};

export default EraserTool;
