import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/FirebaseProvider';
import { Exam } from '../types';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  GraduationCap, 
  Calendar, 
  ArrowRight, 
  MessageSquare, 
  HelpCircle, 
  Loader2, 
  ChevronLeft,
  Sparkles,
  Send,
  User,
  Bot,
  Map,
  GitBranch,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

type Step = 'select-exam' | 'setup' | 'interaction';
type InteractionMode = 'questions' | 'doubts';

export const TutorMode: React.FC = () => {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('select-exam');
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Setup state
  const [unitsCount, setUnitsCount] = useState('1');
  const [interactionMode, setInteractionMode] = useState<InteractionMode | null>(null);
  
  // Chat state
  const [messages, setMessages] = useState<{ role: 'user' | 'bot', text: string }[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const fetchExams = async () => {
      const q = query(collection(db, 'exams'), where('uid', '==', user.uid));
      const snap = await getDocs(q);
      setExams(snap.docs.map(d => ({ id: d.id, ...d.data() } as Exam)));
      setLoading(false);
    };
    fetchExams();
  }, [user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleExamSelect = (exam: Exam) => {
    setSelectedExam(exam);
    setStep('setup');
  };

  const startInteraction = async (mode: InteractionMode) => {
    setInteractionMode(mode);
    setStep('interaction');
    
    if (mode === 'questions') {
      await generateImportantQuestions();
    } else {
      setMessages([{ 
        role: 'bot', 
        text: `Hello! I'm your AI Tutor for **${selectedExam?.name}**. I've analyzed your syllabus. What doubts can I help you clear today? I'll provide clear explanations, examples, and memory tricks!` 
      }]);
    }
  };

  const generateImportantQuestions = async () => {
    if (!selectedExam) return;
    setIsGenerating(true);
    setMessages([{ role: 'bot', text: "Generating important questions based on your syllabus..." }]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Act as an expert tutor for the exam: ${selectedExam.name} (Subject: ${selectedExam.subject}). 
        Syllabus: ${selectedExam.syllabusText || 'General topics for this subject'}.
        User wants to focus on ${unitsCount} units.
        Generate a list of the most important exam questions, frequently asked questions, and a topic-wise breakdown.
        For each question, provide a concise answer, a memory trick or shortcut, and a key point.
        Use Markdown formatting. Include a text-based mind map or flowchart logic where helpful.`,
      });

      setMessages([{ role: 'bot', text: response.text || "Sorry, I couldn't generate the questions." }]);
    } catch (error) {
      console.error("AI Error:", error);
      setMessages([{ role: 'bot', text: "Failed to connect to AI. Please check your syllabus and try again." }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isGenerating || !selectedExam) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsGenerating(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { text: `You are an AI Tutor for ${selectedExam.name}. Syllabus: ${selectedExam.syllabusText}. 
          Always ensure the user fully understands. Use clear explanations, simple language, and step-by-step breakdowns.
          Include:
          - Mind maps (text-based structure)
          - Flowcharts (step-by-step logic)
          - Memory tricks / shortcuts
          Current context: ${interactionMode === 'questions' ? 'Exam Questions' : 'Doubt Solving'}.` },
          ...messages.map(m => ({ text: `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}` })),
          { text: `User: ${userMsg}` }
        ]
      });

      setMessages(prev => [...prev, { role: 'bot', text: response.text || "I'm not sure how to answer that." }]);
    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { role: 'bot', text: "I encountered an error. Please try again." }]);
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Step 1: Select Exam */}
      {step === 'select-exam' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          <div className="text-center">
            <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-600 mx-auto mb-6">
              <GraduationCap className="w-10 h-10" />
            </div>
            <h1 className="text-4xl font-black tracking-tight text-neutral-900">Mr. Tutor</h1>
            <p className="text-neutral-500 mt-2 text-lg">Select an exam to start your preparation.</p>
          </div>

          {exams.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-6">
              {exams.map(exam => (
                <button
                  key={exam.id}
                  onClick={() => handleExamSelect(exam)}
                  className="bg-white p-8 rounded-[40px] border-2 border-transparent hover:border-indigo-600 shadow-xl shadow-neutral-200/50 text-left transition-all group"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 group-hover:scale-110 transition-transform">
                      <Calendar className="w-6 h-6" />
                    </div>
                    <ArrowRight className="w-6 h-6 text-neutral-300 group-hover:text-indigo-600 transition-colors" />
                  </div>
                  <h3 className="text-2xl font-bold text-neutral-900 mb-1">{exam.name}</h3>
                  <p className="text-indigo-600 font-semibold">{exam.subject}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="bg-white border-2 border-dashed border-neutral-200 rounded-[40px] p-16 text-center">
              <p className="text-neutral-500 mb-6">No exams found. Add an exam to get started.</p>
              <button 
                onClick={() => window.location.href = '/exams'}
                className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all"
              >
                Go to Exam Calendar
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* Step 2: Setup */}
      {step === 'setup' && selectedExam && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8">
          <button onClick={() => setStep('select-exam')} className="flex items-center gap-2 text-neutral-500 hover:text-indigo-600 font-bold transition-all">
            <ChevronLeft className="w-5 h-5" /> Back to Exams
          </button>

          <div className="bg-white p-10 rounded-[48px] border border-neutral-200 shadow-xl">
            <h2 className="text-3xl font-black mb-8">Preparing for {selectedExam.name}</h2>
            
            <div className="space-y-8">
              <div>
                <label className="block text-sm font-bold text-neutral-700 mb-4">How many units/chapters do you want to focus on?</label>
                <div className="flex gap-4">
                  {['1', '2', '3', '4', '5+'].map(num => (
                    <button
                      key={num}
                      onClick={() => setUnitsCount(num)}
                      className={`w-14 h-14 rounded-2xl font-bold transition-all ${unitsCount === num ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'}`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <button
                  onClick={() => startInteraction('questions')}
                  className="p-8 rounded-[32px] bg-indigo-50 border-2 border-transparent hover:border-indigo-600 text-left group transition-all"
                >
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 mb-6 group-hover:scale-110 transition-transform">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h4 className="text-xl font-bold text-indigo-900 mb-2">Important Questions</h4>
                  <p className="text-indigo-600/70 text-sm">Generate FAQs, topic breakdowns, and memory tricks.</p>
                </button>

                <button
                  onClick={() => startInteraction('doubts')}
                  className="p-8 rounded-[32px] bg-emerald-50 border-2 border-transparent hover:border-emerald-600 text-left group transition-all"
                >
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-emerald-600 mb-6 group-hover:scale-110 transition-transform">
                    <HelpCircle className="w-6 h-6" />
                  </div>
                  <h4 className="text-xl font-bold text-emerald-900 mb-2">Clear Doubts</h4>
                  <p className="text-emerald-600/70 text-sm">Ask anything and get clear explanations with examples.</p>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Step 3: Interaction */}
      {step === 'interaction' && selectedExam && (
        <div className="flex flex-col h-[80vh] bg-white rounded-[40px] border border-neutral-200 shadow-2xl overflow-hidden">
          {/* Chat Header */}
          <div className="px-8 py-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
            <div className="flex items-center gap-4">
              <button onClick={() => setStep('setup')} className="p-2 hover:bg-white rounded-xl transition-all">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h3 className="font-bold text-neutral-900">{selectedExam.name}</h3>
                <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider">
                  {interactionMode === 'questions' ? 'Exam Prep Mode' : 'Doubt Solving Mode'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">
              <Bot className="w-4 h-4" /> AI Tutor Active
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-8 space-y-8">
            {messages.map((msg, i) => (
              <motion.div
                initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                key={i}
                className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-neutral-100 text-neutral-600'}`}>
                  {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                </div>
                <div className={`max-w-[80%] p-6 rounded-[32px] ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-neutral-50 text-neutral-800 rounded-tl-none border border-neutral-100'}`}>
                  <div className="prose prose-neutral max-w-none prose-sm md:prose-base dark:prose-invert">
                    <ReactMarkdown components={{
                      // Custom components for mind maps/flowcharts if needed
                      p: ({ children }) => <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>,
                      h1: ({ children }) => <h1 className="text-xl font-bold mb-4">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-lg font-bold mb-3">{children}</h2>,
                      ul: ({ children }) => <ul className="list-disc pl-4 mb-4 space-y-2">{children}</ul>,
                      li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                      code: ({ children }) => <code className="bg-neutral-200 px-1.5 py-0.5 rounded text-indigo-700 font-mono text-sm">{children}</code>,
                    }}>
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                </div>
              </motion.div>
            ))}
            {isGenerating && (
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-600">
                  <Bot className="w-5 h-5" />
                </div>
                <div className="bg-neutral-50 p-6 rounded-[32px] rounded-tl-none border border-neutral-100">
                  <div className="flex gap-1">
                    <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1 }} className="w-2 h-2 bg-neutral-400 rounded-full" />
                    <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-2 h-2 bg-neutral-400 rounded-full" />
                    <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-2 h-2 bg-neutral-400 rounded-full" />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="p-8 border-t border-neutral-100 bg-neutral-50/30">
            <form onSubmit={handleSendMessage} className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask your tutor anything..."
                className="w-full pl-6 pr-16 py-5 bg-white border border-neutral-200 rounded-[24px] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all shadow-sm"
              />
              <button
                type="submit"
                disabled={!input.trim() || isGenerating}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-100"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
            <div className="flex gap-4 mt-4 overflow-x-auto pb-2 scrollbar-hide">
              <button onClick={() => setInput("Explain this with a mind map")} className="flex-shrink-0 px-4 py-2 bg-white border border-neutral-200 rounded-xl text-xs font-bold text-neutral-600 hover:border-indigo-500 hover:text-indigo-600 transition-all flex items-center gap-2">
                <Map className="w-3 h-3" /> Mind Map
              </button>
              <button onClick={() => setInput("Show me a flowchart for this")} className="flex-shrink-0 px-4 py-2 bg-white border border-neutral-200 rounded-xl text-xs font-bold text-neutral-600 hover:border-indigo-500 hover:text-indigo-600 transition-all flex items-center gap-2">
                <GitBranch className="w-3 h-3" /> Flowchart
              </button>
              <button onClick={() => setInput("Give me a memory trick")} className="flex-shrink-0 px-4 py-2 bg-white border border-neutral-200 rounded-xl text-xs font-bold text-neutral-600 hover:border-indigo-500 hover:text-indigo-600 transition-all flex items-center gap-2">
                <Zap className="w-3 h-3" /> Memory Trick
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
