import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../components/FirebaseProvider';
import { GoogleGenAI } from "@google/genai";
import { 
  Brain, 
  Search, 
  Lightbulb, 
  MessageSquare, 
  Loader2, 
  Sparkles,
  Send,
  User,
  Bot,
  Compass,
  Zap,
  BookOpen,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

export const ThinkerMode: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<{ role: 'user' | 'bot', text: string }[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isInitial, setIsInitial] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleStartTopic = async (topic: string) => {
    setIsInitial(false);
    setInput('');
    setMessages([{ role: 'user', text: `I want to explore: ${topic}` }]);
    await generateResponse(`I want to explore: ${topic}`, []);
  };

  const generateResponse = async (userMsg: string, history: { role: 'user' | 'bot', text: string }[]) => {
    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { text: `You are Mr. Thinker, a deep-learning assistant. Your goal is to help users explore complex topics in depth.
          - Encourage critical thinking.
          - Ask thought-provoking questions.
          - Provide deep-dive explanations with real-world analogies.
          - Use Markdown for structure.
          - If the user is exploring a topic, provide a "Concept Map" (text-based) or a "Deep Dive" path.
          - Always be curious and encouraging.` },
          ...history.map(m => ({ text: `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}` })),
          { text: `User: ${userMsg}` }
        ]
      });

      setMessages(prev => [...prev, { role: 'bot', text: response.text || "That's a fascinating area. Let's dig deeper." }]);
    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { role: 'bot', text: "My thinking process was interrupted. Let's try that again." }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isGenerating) return;

    const userMsg = input;
    setInput('');
    if (isInitial) setIsInitial(false);
    
    const newHistory = [...messages, { role: 'user', text: userMsg } as const];
    setMessages(newHistory);
    await generateResponse(userMsg, messages);
  };

  const suggestions = [
    { title: "Quantum Physics", icon: <Zap className="w-5 h-5" />, color: "bg-amber-50 text-amber-600 border-amber-200" },
    { title: "Philosophy of Mind", icon: <Brain className="w-5 h-5" />, color: "bg-purple-50 text-purple-600 border-purple-200" },
    { title: "Future of AI", icon: <Sparkles className="w-5 h-5" />, color: "bg-indigo-50 text-indigo-600 border-indigo-200" },
    { title: "Evolutionary Biology", icon: <Compass className="w-5 h-5" />, color: "bg-emerald-50 text-emerald-600 border-emerald-200" },
  ];

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-12rem)] flex flex-col">
      <AnimatePresence mode="wait">
        {isInitial ? (
          <motion.div
            key="initial"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col items-center justify-center text-center space-y-12"
          >
            <div className="space-y-4">
              <div className="w-24 h-24 bg-indigo-50 rounded-[40px] flex items-center justify-center text-indigo-600 mx-auto mb-8 shadow-xl shadow-indigo-100">
                <Brain className="w-12 h-12" />
              </div>
              <h1 className="text-5xl font-black tracking-tight text-neutral-900">Mr. Thinker</h1>
              <p className="text-neutral-500 text-xl max-w-lg mx-auto leading-relaxed">
                Your partner for deep-dive learning and intellectual exploration. What's on your mind today?
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full max-w-2xl">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleStartTopic(s.title)}
                  className={`p-6 rounded-[32px] border-2 border-transparent hover:border-current transition-all text-left flex items-center gap-4 group ${s.color}`}
                >
                  <div className="p-3 bg-white rounded-2xl group-hover:scale-110 transition-transform shadow-sm">
                    {s.icon}
                  </div>
                  <span className="font-bold text-lg">{s.title}</span>
                  <ArrowRight className="w-5 h-5 ml-auto opacity-0 group-hover:opacity-100 transition-all" />
                </button>
              ))}
            </div>

            <form onSubmit={handleSendMessage} className="w-full max-w-2xl relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a topic to start a deep dive..."
                className="w-full pl-8 pr-20 py-6 bg-white border-2 border-neutral-100 rounded-[32px] focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none transition-all shadow-2xl shadow-neutral-200/50 text-lg font-medium"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200"
              >
                <Send className="w-6 h-6" />
              </button>
            </form>
          </motion.div>
        ) : (
          <motion.div
            key="chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col bg-white rounded-[48px] border border-neutral-200 shadow-2xl overflow-hidden"
          >
            {/* Chat Header */}
            <div className="px-10 py-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white">
                  <Brain className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-neutral-900 text-lg">Deep Dive Session</h3>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-xs text-neutral-500 font-bold uppercase tracking-widest">Active Exploration</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => { setMessages([]); setIsInitial(true); }}
                className="px-6 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl text-sm font-bold transition-all"
              >
                New Topic
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-10 space-y-10">
              {messages.map((msg, i) => (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={i}
                  className={`flex gap-6 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border border-neutral-100'}`}>
                    {msg.role === 'user' ? <User className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
                  </div>
                  <div className={`max-w-[85%] p-8 rounded-[40px] ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none shadow-xl shadow-indigo-100' : 'bg-neutral-50 text-neutral-800 rounded-tl-none border border-neutral-100'}`}>
                    <div className="prose prose-neutral max-w-none prose-lg dark:prose-invert">
                      <ReactMarkdown components={{
                        p: ({ children }) => <p className="mb-6 last:mb-0 leading-relaxed opacity-90">{children}</p>,
                        h1: ({ children }) => <h1 className="text-2xl font-black mb-6 text-indigo-900">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-xl font-black mb-4 text-indigo-800">{children}</h2>,
                        ul: ({ children }) => <ul className="list-disc pl-6 mb-6 space-y-3">{children}</ul>,
                        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                        code: ({ children }) => <code className="bg-indigo-100/50 px-2 py-1 rounded text-indigo-700 font-mono text-sm font-bold">{children}</code>,
                        blockquote: ({ children }) => <blockquote className="border-l-4 border-indigo-500 pl-6 italic my-6 text-neutral-600">{children}</blockquote>
                      }}>
                        {msg.text}
                      </ReactMarkdown>
                    </div>
                  </div>
                </motion.div>
              ))}
              {isGenerating && (
                <div className="flex gap-6">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-neutral-100 flex items-center justify-center text-indigo-600 shadow-sm">
                    <Bot className="w-6 h-6" />
                  </div>
                  <div className="bg-neutral-50 p-8 rounded-[40px] rounded-tl-none border border-neutral-100">
                    <div className="flex gap-2">
                      <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-3 h-3 bg-indigo-400 rounded-full" />
                      <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.3 }} className="w-3 h-3 bg-indigo-400 rounded-full" />
                      <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.6 }} className="w-3 h-3 bg-indigo-400 rounded-full" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="p-10 border-t border-neutral-100 bg-neutral-50/30">
              <form onSubmit={handleSendMessage} className="relative max-w-3xl mx-auto">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a deep question or explore a concept..."
                  className="w-full pl-8 pr-20 py-6 bg-white border-2 border-neutral-200 rounded-[32px] focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500 outline-none transition-all shadow-xl text-lg"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isGenerating}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-200"
                >
                  <Send className="w-6 h-6" />
                </button>
              </form>
              <div className="flex justify-center gap-6 mt-6">
                <button onClick={() => setInput("Can you explain this with a real-world analogy?")} className="text-sm font-bold text-neutral-500 hover:text-indigo-600 transition-all flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" /> Analogy
                </button>
                <button onClick={() => setInput("What are the counter-arguments to this?")} className="text-sm font-bold text-neutral-500 hover:text-indigo-600 transition-all flex items-center gap-2">
                  <Search className="w-4 h-4" /> Counter-arguments
                </button>
                <button onClick={() => setInput("How does this connect to other fields?")} className="text-sm font-bold text-neutral-500 hover:text-indigo-600 transition-all flex items-center gap-2">
                  <BookOpen className="w-4 h-4" /> Connections
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
