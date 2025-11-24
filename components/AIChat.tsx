import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { MessageSquare, Send, X, Loader2 } from 'lucide-react';
import { ChatMessage } from '../types';

interface AIChatProps {
  isOpen: boolean;
  onClose: () => void;
  blackHoleMass: number;
}

const AIChat: React.FC<AIChatProps> = ({ isOpen, onClose, blackHoleMass }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: "Greetings! I am your cosmic assistant. Ask me anything about black holes, gravity, or this simulation.", timestamp: Date.now() }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || !process.env.API_KEY) return;

    const userMsg: ChatMessage = { role: 'user', text: input, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const systemInstruction = `You are an expert astrophysicist assistant embedded in a web-based Black Hole simulation. 
      The current simulation has a Black Hole with a relative Mass of ${blackHoleMass}.
      Explain concepts like Event Horizon, Schwarzschild Radius, Spaghettification, and Gravitational Lensing simply and concisely.
      Keep answers under 100 words unless asked for detail.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: input,
        config: { systemInstruction }
      });

      const text = response.text || "I couldn't decode that signal from the void.";
      setMessages(prev => [...prev, { role: 'model', text, timestamp: Date.now() }]);
    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { role: 'model', text: "Communication interference detected. Please try again.", timestamp: Date.now() }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute bottom-4 right-4 w-80 md:w-96 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl flex flex-col overflow-hidden z-50 h-[500px]">
      {/* Header */}
      <div className="bg-gray-800 p-4 flex justify-between items-center border-b border-gray-700">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-cyan-400" />
          <h3 className="font-bold text-gray-100">Cosmic AI</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition">
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/50">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
              className={`max-w-[85%] rounded-lg p-3 text-sm leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-cyan-700 text-white rounded-br-none' 
                  : 'bg-gray-800 text-gray-200 rounded-bl-none border border-gray-700'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 p-3 rounded-lg rounded-bl-none flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-cyan-400" />
              <span className="text-xs text-gray-400">Analyzing spacetime...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 bg-gray-800 border-t border-gray-700 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask about the black hole..."
          className="flex-1 bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition"
        />
        <button 
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white p-2 rounded-md transition"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};

export default AIChat;
