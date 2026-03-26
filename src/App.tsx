import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, Search, Image as ImageIcon, FileText, Loader2, X, Plus, Send, Sparkles, Crop as CropIcon, Share } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// --- Types ---
type Memory = {
  id: string;
  type: 'text' | 'image';
  content: string; // URL for image, text for text
  context: string; // AI generated description or raw text
  date: string;
};

// --- Fake Initial Data ---
const INITIAL_MEMORIES: Memory[] = [
  {
    id: '1',
    type: 'image',
    content: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&q=80&w=800',
    context: 'Book cover of "Atomic Habits" by James Clear. Yellow background. Book recommendation from Sarah about building good habits and productivity.',
    date: '2 hours ago'
  },
  {
    id: '2',
    type: 'text',
    content: 'Wifi password for the Airbnb in Rome: ROME2026!',
    context: 'Wifi password for the Airbnb in Rome: ROME2026!',
    date: 'Yesterday'
  },
  {
    id: '3',
    type: 'image',
    content: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&q=80&w=800',
    context: 'Black leather bomber jacket, $250, seen on Instagram. Has silver zippers, a ribbed collar, and looks vintage or distressed.',
    date: '3 days ago'
  },
  {
    id: '4',
    type: 'image',
    content: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&q=80&w=800',
    context: 'A sleek black winter coat, long trench style. Found on a fashion blog. Good alternative to the bomber jacket.',
    date: '4 days ago'
  }
];

// --- Helpers ---
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = (error) => reject(error);
  });
};

const getCroppedImg = async (image: HTMLImageElement, crop: Crop): Promise<{file: File, url: string}> => {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  
  const pixelCrop = {
    x: crop.x * scaleX,
    y: crop.y * scaleY,
    width: crop.width * scaleX,
    height: crop.height * scaleY,
  };

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('No 2d context');

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('Canvas is empty'));
        return;
      }
      const fileUrl = window.URL.createObjectURL(blob);
      resolve({ file: new File([blob], 'cropped.jpeg', { type: 'image/jpeg' }), url: fileUrl });
    }, 'image/jpeg', 0.9);
  });
};

export default function App() {
  const [memories, setMemories] = useState<Memory[]>(INITIAL_MEMORIES);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [displayedMemories, setDisplayedMemories] = useState<Memory[]>(INITIAL_MEMORIES);
  
  // Add Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [pendingImage, setPendingImage] = useState<{ file: File, url: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSimulatingShare, setIsSimulatingShare] = useState(false);
  
  // Cropping State
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop>();
  const imgRef = useRef<HTMLImageElement>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- AI Search Logic ---
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!searchQuery.trim()) {
      setAiAnswer(null);
      setDisplayedMemories(memories);
      return;
    }

    setIsSearching(true);
    setAiAnswer(null);

    try {
      // Prepare memories for the AI context
      const memoriesContext = memories.map(m => ({
        id: m.id,
        type: m.type,
        details: m.context,
        date: m.date
      }));

      const prompt = `You are Synapse, a privacy-first second brain AI. The user is searching their personal memories.
User Query: "${searchQuery}"

Here is the JSON dump of the user's memories:
${JSON.stringify(memoriesContext)}

Task:
1. Answer the user's query conversationally and directly, using ONLY the provided memories. If the answer isn't in the memories, say so.
2. Identify the IDs of the memories that are relevant to the query or your answer. If the user asks a vague question (e.g., "show me jackets"), return all relevant memory IDs.

Respond strictly in JSON format matching the schema.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              answer: { type: Type.STRING, description: "Conversational answer to the user's query." },
              relevantIds: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Array of memory IDs that are relevant." }
            },
            required: ["answer", "relevantIds"]
          }
        }
      });

      const result = JSON.parse(response.text || "{}");
      
      setAiAnswer(result.answer || "I couldn't process that request.");
      
      if (result.relevantIds && Array.isArray(result.relevantIds)) {
        const filtered = memories.filter(m => result.relevantIds.includes(m.id));
        setDisplayedMemories(filtered);
      } else {
        setDisplayedMemories([]);
      }

    } catch (error) {
      console.error("Search error:", error);
      setAiAnswer("Sorry, my brain glitched while searching. Try again.");
    } finally {
      setIsSearching(false);
    }
  };

  // Clear search when input is cleared
  useEffect(() => {
    if (searchQuery === '') {
      setAiAnswer(null);
      setDisplayedMemories(memories);
    }
  }, [searchQuery, memories]);

  // --- Global Paste Listener for Screenshots ---
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Don't intercept paste if the user is typing in the search bar or text area
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            handleFileSelect(file);
            setIsAddOpen(true);
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // --- AI Upload Logic ---
  const handleFileSelect = (file: File) => {
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setRawImage(url);
      setIsCropping(true);
      setCrop(undefined);
      setCompletedCrop(undefined);
      setInputText('');
    }
  };

  const handleConfirmCrop = async () => {
    if (imgRef.current && completedCrop?.width && completedCrop?.height) {
      try {
        const cropped = await getCroppedImg(imgRef.current, completedCrop);
        setPendingImage(cropped);
        setIsCropping(false);
        setRawImage(null);
      } catch (e) {
        console.error("Crop failed", e);
      }
    } else if (rawImage) {
      // If no crop was drawn, use the original image
      try {
        const response = await fetch(rawImage);
        const blob = await response.blob();
        const file = new File([blob], 'original.jpeg', { type: blob.type });
        setPendingImage({ file, url: rawImage });
        setIsCropping(false);
        setRawImage(null);
      } catch (e) {
        console.error("Failed to load original image", e);
      }
    }
  };

  const closeAddModal = () => {
    if (isProcessing) return;
    setIsAddOpen(false);
    setIsCropping(false);
    setRawImage(null);
    setPendingImage(null);
    setInputText('');
  };

  const handleSave = async () => {
    if (!inputText.trim() && !pendingImage) return;

    setIsProcessing(true);

    try {
      let context = inputText;
      let type: 'text' | 'image' = 'text';
      let content = inputText;

      if (pendingImage) {
        type = 'image';
        content = pendingImage.url; // In a real app, upload to local storage/DB
        
        // Ask Gemini to describe the image for future searching
        const base64Data = await fileToBase64(pendingImage.file);
        
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: [
            { inlineData: { data: base64Data, mimeType: pendingImage.file.type } },
            "Describe this image in extreme detail so it can be searched later. Include objects, colors, text, brands, and overall context. Be concise but comprehensive."
          ]
        });
        
        context = response.text || "Image uploaded without description.";
      }

      const newMemory: Memory = {
        id: Date.now().toString(),
        type,
        content,
        context,
        date: 'Just now'
      };

      setMemories(prev => [newMemory, ...prev]);
      closeAddModal();
      
      // Reset search to show new item
      setSearchQuery('');
      setAiAnswer(null);
      
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to process memory. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Simulate OS Share Sheet ---
  const simulateOSShare = async () => {
    setIsSimulatingShare(true);
    
    try {
      // 1. Fetch a dummy "screenshot" (e.g., a recipe or article)
      const response = await fetch('https://images.unsplash.com/photo-1466637574441-749b8f19452f?auto=format&fit=crop&q=80&w=800');
      const blob = await response.blob();
      const file = new File([blob], 'shared_screenshot.jpg', { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      
      // 2. Process it in the background (like a share extension would)
      const base64Data = await fileToBase64(file);
      
      const aiResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [
          { inlineData: { data: base64Data, mimeType: file.type } },
          "Describe this image in extreme detail so it can be searched later. Include objects, colors, text, brands, and overall context. Be concise but comprehensive."
        ]
      });
      
      const newMemory: Memory = {
        id: Date.now().toString(),
        type: 'image',
        content: url,
        context: aiResponse.text || "Shared via OS Share Sheet.",
        date: 'Just now'
      };

      // 3. Add to memories automatically
      setMemories(prev => [newMemory, ...prev]);
      
      // Reset search to show new item
      setSearchQuery('');
      setAiAnswer(null);
      
    } catch (error) {
      console.error("Share simulation failed", error);
      alert("Simulation failed.");
    } finally {
      setIsSimulatingShare(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-zinc-800 flex justify-center">
      {/* Mobile Container */}
      <div className="w-full max-w-md bg-zinc-950 min-h-screen relative shadow-2xl sm:border-x border-zinc-900 flex flex-col">
        
        {/* Header */}
        <header className="pt-12 pb-4 px-6 sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-900">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-zinc-100 text-zinc-950 flex items-center justify-center">
                <Brain className="w-4 h-4" />
              </div>
              <span className="text-lg font-semibold tracking-tight">Synapse</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider">AI Active</span>
            </div>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="relative">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-zinc-500" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ask your brain..."
              className="w-full pl-11 pr-12 py-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-700 transition-all"
            />
            {searchQuery && (
              <button 
                type="submit"
                className="absolute inset-y-0 right-2 flex items-center justify-center w-10 text-zinc-400 hover:text-zinc-100"
              >
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            )}
          </form>
        </header>

        {/* Feed */}
        <main className="flex-1 overflow-y-auto px-4 py-6 space-y-6 pb-32">
          
          {/* AI Answer Card */}
          <AnimatePresence>
            {aiAnswer && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-5 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 opacity-50"></div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 p-1.5 bg-zinc-800 rounded-full text-zinc-300">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <p className="text-sm leading-relaxed text-zinc-200">
                    {aiAnswer}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Memories Grid - Masonry Layout */}
          <div className="columns-2 gap-3 space-y-3">
            <AnimatePresence mode="popLayout">
              {displayedMemories.map((memory) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  key={memory.id}
                  className="relative rounded-2xl bg-zinc-900/40 border border-zinc-800/50 overflow-hidden break-inside-avoid w-full inline-block"
                >
                  {memory.type === 'image' ? (
                    <img 
                      src={memory.content} 
                      alt="Memory"
                      className="w-full h-auto block"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="p-4 text-zinc-300 text-sm leading-relaxed">
                      {memory.content}
                    </div>
                  )}
                  
                  {/* Overlay for context snippet */}
                  {memory.type === 'image' && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 pt-12">
                      <p className="text-[10px] text-zinc-300 line-clamp-2 leading-tight">
                        {memory.context}
                      </p>
                    </div>
                  )}
                  {memory.type === 'text' && (
                    <div className="px-4 pb-3 pt-1 border-t border-zinc-800/50 mt-2">
                      <p className="text-[10px] text-zinc-500">
                        {memory.date}
                      </p>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {!isSearching && displayedMemories.length === 0 && (
            <div className="py-20 text-center text-zinc-600">
              <Brain className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Your brain is empty.</p>
            </div>
          )}
        </main>

        {/* Floating Action Buttons */}
        <div className="absolute bottom-8 right-6 z-40 flex flex-col gap-3 items-end">
          
          {/* Simulate OS Share Button */}
          <div className="group relative flex items-center">
            <span className="absolute right-14 bg-zinc-800 text-zinc-200 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Simulate OS Share
            </span>
            <button
              onClick={simulateOSShare}
              disabled={isSimulatingShare}
              className="w-10 h-10 rounded-full bg-zinc-800 text-zinc-300 flex items-center justify-center shadow-lg hover:bg-zinc-700 transition-all disabled:opacity-50"
            >
              {isSimulatingShare ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share className="w-4 h-4" />}
            </button>
          </div>

          {/* Main Add Button */}
          <button
            onClick={() => setIsAddOpen(true)}
            className="w-14 h-14 rounded-full bg-zinc-100 text-zinc-950 flex items-center justify-center shadow-lg shadow-white/5 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>

        {/* Add Memory Bottom Sheet */}
        <AnimatePresence>
          {isAddOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closeAddModal}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50"
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="absolute bottom-0 inset-x-0 bg-zinc-900 rounded-t-3xl border-t border-zinc-800 z-50 overflow-hidden flex flex-col max-h-[85vh]"
              >
                <div className="p-6 flex-1 overflow-y-auto flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-medium">Add to Brain</h2>
                    <button 
                      onClick={closeAddModal}
                      className="p-2 rounded-full bg-zinc-800 text-zinc-400"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {isCropping && rawImage ? (
                    <div className="flex flex-col flex-1">
                      <div className="relative w-full h-[40vh] bg-zinc-950 rounded-2xl overflow-hidden mb-4 border border-zinc-800">
                        <ReactCrop 
                          crop={crop} 
                          onChange={c => setCrop(c)} 
                          onComplete={c => setCompletedCrop(c)}
                          className="h-full w-full flex items-center justify-center"
                        >
                          <img 
                            ref={imgRef} 
                            src={rawImage} 
                            alt="Crop me" 
                            className="max-h-[40vh] w-auto object-contain" 
                          />
                        </ReactCrop>
                      </div>
                      <div className="flex justify-between items-center mt-auto">
                        <button 
                          onClick={() => { setIsCropping(false); setRawImage(null); }} 
                          className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={handleConfirmCrop} 
                          className="px-5 py-2.5 bg-emerald-500 text-zinc-950 rounded-xl text-sm font-medium flex items-center gap-2 active:scale-95 transition-transform"
                        >
                          <CropIcon className="w-4 h-4" />
                          Confirm Crop
                        </button>
                      </div>
                    </div>
                  ) : pendingImage ? (
                    <div className="relative rounded-2xl overflow-hidden bg-zinc-950 flex items-center justify-center group mb-4 border border-zinc-800">
                      <img src={pendingImage.url} alt="Pending" className="w-full h-auto max-h-[40vh] object-contain" />
                      <button 
                        onClick={() => setPendingImage(null)}
                        className="absolute top-3 right-3 p-2 rounded-full bg-black/50 text-white backdrop-blur-md"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <textarea
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Type a note, paste a link, or brain-dump..."
                      className="w-full min-h-[120px] bg-zinc-950 rounded-2xl p-4 border border-zinc-800 resize-none outline-none text-sm placeholder:text-zinc-600 text-zinc-200 mb-4 focus:border-zinc-700"
                    />
                  )}

                  {!isCropping && (
                    <div className="flex items-center justify-between mt-auto pt-4">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="p-3 rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                        >
                          <ImageIcon className="w-5 h-5" />
                        </button>
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          accept="image/*"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleFileSelect(e.target.files[0]);
                              // Reset input value so the same file can be selected again if canceled
                              e.target.value = '';
                            }
                          }}
                        />
                      </div>
                      
                      <button
                        onClick={handleSave}
                        disabled={(!inputText.trim() && !pendingImage) || isProcessing}
                        className="px-6 py-3 rounded-xl bg-zinc-100 text-zinc-950 font-medium text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>AI Processing...</span>
                          </>
                        ) : (
                          <>
                            <Brain className="w-4 h-4" />
                            <span>Save Memory</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
