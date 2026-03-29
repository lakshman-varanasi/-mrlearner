import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, orderBy, limit, addDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/FirebaseProvider';
import { Exam, Task, StudyPlan, ChatSession, ChatMessage, TestResult } from '../types';
import { GoogleGenAI } from "@google/genai";
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
  Zap,
  BookOpen,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

import { 
  createChatSession, 
  getChatSessions, 
  saveChatMessage, 
  getChatMessages, 
  deleteChatSession, 
  renameChatSession 
} from '../lib/chat-utils';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { ChatSidebar } from '../components/ChatSidebar';
import { 
  getAdaptiveWorkload, 
  generateStudyPlan, 
  detectWeakAreas, 
  getSmartRevisionTopics, 
  getDailyGoalSuggestions, 
  getResumeContext 
} from '../lib/intelligence-utils';

type Step = 'select-exam' | 'interaction';

export const MrLearner: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>('select-exam');
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Chat sessions state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [adaptiveConfig, setAdaptiveConfig] = useState<{ difficulty: string, durationMultiplier: number }>({ difficulty: 'medium', durationMultiplier: 1 });
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Study Plan state
  const [currentPlan, setCurrentPlan] = useState<StudyPlan | null>(null);
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  
  // Advanced Intelligence state
  const [weakAreas, setWeakAreas] = useState<{ topic: string, score: number, count: number }[]>([]);
  const [revisionTopics, setRevisionTopics] = useState<{ topic: string, lastStudied: string, priority: string }[]>([]);
  const [dailyGoals, setDailyGoals] = useState<{ title: string, reason: string }[]>([]);
  const [resumeContext, setResumeContext] = useState<{ topic: string, type: string } | null>(null);

  useEffect(() => {
    if (user) {
      loadExams();
      loadSessions();
      loadAdaptiveConfig();
      loadIntelligence();
    }
  }, [user]);

  const loadIntelligence = async () => {
    if (!user) return;
    try {
      const [weak, revision, goals, resume] = await Promise.all([
        detectWeakAreas(user.uid),
        getSmartRevisionTopics(user.uid),
        getDailyGoalSuggestions(user.uid),
        getResumeContext(user.uid)
      ]);
      setWeakAreas(weak);
      setRevisionTopics(revision);
      setDailyGoals(goals);
      setResumeContext(resume);
    } catch (error) {
      console.error('Error loading intelligence:', error);
    }
  };

  const loadAdaptiveConfig = async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'testResults'),
        where('uid', '==', user.uid),
        orderBy('timestamp', 'desc'),
        limit(5)
      );
      const snap = await getDocs(q);
      const results = snap.docs.map(d => d.data() as TestResult);
      const config = getAdaptiveWorkload(results);
      setAdaptiveConfig(config);
    } catch (error) {
      console.error('Error loading adaptive config:', error);
    }
  };

  useEffect(() => {
    if (currentSessionId) {
      loadMessages(currentSessionId);
      setStep('interaction');
    }
  }, [currentSessionId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadExams = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'exams'), where('uid', '==', user.uid));
      const snap = await getDocs(q);
      setExams(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exam)));
    } catch (error) {
      console.error('Error loading exams:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSessions = async () => {
    if (!user) return;
    const data = await getChatSessions(user.uid, 'learner');
    setSessions(data);
  };

  const loadMessages = async (sessionId: string) => {
    const data = await getChatMessages(sessionId);
    setMessages(data);
  };

  const handleSelectExam = async (exam: Exam) => {
    setSelectedExam(exam);
    // Check if there's an existing plan for this exam
    const q = query(
      collection(db, 'studyPlans'), 
      where('uid', '==', user?.uid),
      where('subject', '==', exam.subject)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const plan = { id: snap.docs[0].id, ...snap.docs[0].data() } as StudyPlan;
      setCurrentPlan(plan);
      loadTodayTasks(plan.id);
    } else {
      setCurrentPlan(null);
      setTodayTasks([]);
    }
    setStep('interaction');
  };

  const loadTodayTasks = async (planId: string) => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const q = query(
      collection(db, 'tasks'),
      where('planId', '==', planId),
      where('date', '==', today)
    );
    const snap = await getDocs(q);
    setTodayTasks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
  };

  const handleGeneratePlan = async () => {
    if (!user || !selectedExam) return;
    setIsGeneratingPlan(true);
    try {
      const { plan, tasks } = await generateStudyPlan(user.uid, selectedExam);
      
      const planRef = await addDoc(collection(db, 'studyPlans'), plan);
      const batch = writeBatch(db);
      
      tasks.forEach(task => {
        const taskRef = doc(collection(db, 'tasks'));
        batch.set(taskRef, { ...task, planId: planRef.id });
      });
      
      await batch.commit();
      
      const newPlan = { id: planRef.id, ...plan } as StudyPlan;
      setCurrentPlan(newPlan);
      loadTodayTasks(planRef.id);
      
      // Add a message to chat about the new plan
      if (currentSessionId) {
        const msg = `I've generated a personalized study plan for your ${selectedExam.name} exam! You can see your daily tasks right here.`;
        await saveChatMessage(currentSessionId, user.uid, 'model', msg);
        await loadMessages(currentSessionId);
      } else {
        // Create a new session if none exists
        const sessionId = await createChatSession(user.uid, `${selectedExam.name} Learning`, 'learner');
        if (sessionId) {
          setCurrentSessionId(sessionId);
          const msg = `I've generated a personalized study plan for your ${selectedExam.name} exam! Let's get started.`;
          await saveChatMessage(sessionId, user.uid, 'model', msg);
          await loadMessages(sessionId);
        }
      }
    } catch (error) {
      console.error('Error generating plan:', error);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    if (!user || !currentPlan) return;
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        status: newStatus,
        completedAt: newStatus === 'completed' ? new Date().toISOString() : null
      });
      
      // Update local state
      setTodayTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus as any } : t));
      
      // Update plan progress
      const qTasks = query(collection(db, 'tasks'), where('planId', '==', currentPlan.id));
      const taskSnap = await getDocs(qTasks);
      const allTasks = taskSnap.docs.map(d => d.data() as Task);
      const completedTasks = allTasks.filter(t => t.status === 'completed').length;
      const newProgress = Math.round((completedTasks / allTasks.length) * 100);
      
      await updateDoc(doc(db, 'studyPlans', currentPlan.id), {
        progress: newProgress
      });
      
      setCurrentPlan(prev => prev ? { ...prev, progress: newProgress } : null);
    } catch (error) {
      console.error('Error toggling task:', error);
    }
  };

  const generateResponse = async (sessionId: string, userMsg: string, history: ChatMessage[]) => {
    if (!user || !selectedExam) return;
    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      // Context-aware prompt
      const contextPrompt = `You are Mr. Learner, an expert academic tutor and mentor. Your goal is to help users master their exam subjects.
          
          CONTEXT:
          - Selected Exam: ${selectedExam.name}
          - Subject: ${selectedExam.subject}
          - Syllabus: ${selectedExam.syllabusText || 'General knowledge'}
          - Adaptive Difficulty: ${adaptiveConfig.difficulty}
          - User's Weak Areas: ${weakAreas.map(w => w.topic).join(', ') || 'None identified yet'}
          - Suggested Revision: ${revisionTopics.map(r => r.topic).join(', ') || 'None'}
          
          INSTRUCTIONS:
          - Provide highly structured answers with:
            1. Key Points (Bullet points)
            2. Detailed Explanation
            3. Practical Examples
          - Ensure accuracy, clarity, and relevance to the ${selectedExam.name} exam.
          - Use Markdown for formatting.
          - Be encouraging and proactive.
          - If the user asks for important questions, provide high-yield exam topics and practice questions.
          - Tailor answers based on the user's progress and weak areas.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { text: contextPrompt },
          ...history.map(m => ({ text: `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}` })),
          { text: `User: ${userMsg}` }
        ]
      });

      const botResponse = response.text || "I'm here to help. What else would you like to know?";
      await saveChatMessage(sessionId, user.uid, 'model', botResponse);
      await loadMessages(sessionId);
    } catch (error) {
      console.error("AI Error:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isGenerating || !user || !selectedExam) return;

    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = await createChatSession(user.uid, `${selectedExam.name} - ${input.slice(0, 30)}...`, 'learner');
      if (sessionId) setCurrentSessionId(sessionId);
    }

    if (!sessionId) return;

    const userMsg = input;
    setInput('');
    
    await saveChatMessage(sessionId, user.uid, 'user', userMsg);
    const updatedMessages = await getChatMessages(sessionId);
    setMessages(updatedMessages);
    
    await generateResponse(sessionId, userMsg, updatedMessages.slice(0, -1));
  };

  const handleDeleteSession = async (sessionId: string) => {
    await deleteChatSession(sessionId);
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
      setMessages([]);
    }
    await loadSessions();
  };

  const handleRenameSession = async (sessionId: string, newTitle: string) => {
    await renameChatSession(sessionId, newTitle);
    await loadSessions();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-12rem)]">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] -mx-10 -my-10">
      <ChatSidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={setCurrentSessionId}
        onNewChat={() => { setCurrentSessionId(null); setMessages([]); }}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
        mode="learner"
      />

      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        <AnimatePresence mode="wait">
          {step === 'select-exam' && (
            <motion.div
              key="select"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col items-center justify-center p-10 text-center"
            >
              <div className="w-24 h-24 bg-indigo-50 rounded-[40px] flex items-center justify-center text-indigo-600 mx-auto mb-8 shadow-xl shadow-indigo-100">
                <GraduationCap className="w-12 h-12" />
              </div>
              <h1 className="text-5xl font-black tracking-tight text-neutral-900 mb-4">Mr. Learner</h1>
              <p className="text-neutral-500 text-xl max-w-lg mx-auto mb-12">
                Select an exam from your calendar to start learning with your AI mentor.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
                {exams.map((exam) => (
                  <button
                    key={exam.id}
                    onClick={() => handleSelectExam(exam)}
                    className="p-8 bg-white border-2 border-neutral-100 rounded-[32px] hover:border-indigo-600 hover:shadow-xl transition-all text-left group"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 group-hover:scale-110 transition-transform">
                        <BookOpen className="w-6 h-6" />
                      </div>
                      <ArrowRight className="w-5 h-5 text-neutral-300 group-hover:text-indigo-600 transition-colors" />
                    </div>
                    <h3 className="text-xl font-black text-neutral-900 mb-1">{exam.name}</h3>
                    <p className="text-neutral-500 font-medium">{exam.subject}</p>
                  </button>
                ))}
                {exams.length === 0 && (
                  <div className="col-span-full p-12 bg-neutral-50 rounded-[40px] border-2 border-dashed border-neutral-200">
                    <p className="text-neutral-500 font-bold mb-4">No exams found in your calendar.</p>
                    <button 
                      onClick={() => navigate('/exams')}
                      className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all"
                    >
                      Go to Exam Calendar
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {step === 'interaction' && selectedExam && (
            <motion.div
              key="interaction"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col h-full"
            >
              {/* Header */}
              <div className="px-10 py-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setStep('select-exam')}
                    className="p-2 hover:bg-neutral-200 rounded-xl transition-all text-neutral-500"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white">
                    <Bot className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-neutral-900 text-lg">
                      {selectedExam.name} Mentor
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                      <span className="text-xs text-neutral-500 font-bold uppercase tracking-widest">Active Session</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {resumeContext && (
                    <button
                      onClick={() => {
                        if (resumeContext.type === 'chat') {
                          // Find session and load it
                          const session = sessions.find(s => s.title === resumeContext.topic);
                          if (session) setCurrentSessionId(session.id);
                        } else {
                          setInput(`Let's continue learning about ${resumeContext.topic}`);
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-600 rounded-xl text-xs font-bold hover:bg-neutral-200 transition-all"
                    >
                      <ArrowRight className="w-4 h-4" />
                      Resume: {resumeContext.topic}
                    </button>
                  )}
                  {!currentPlan ? (
                    <button
                      onClick={handleGeneratePlan}
                      disabled={isGeneratingPlan}
                      className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
                    >
                      {isGeneratingPlan ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                      Generate Study Plan
                    </button>
                  ) : (
                    <div className="flex items-center gap-4 bg-white px-6 py-3 rounded-2xl border border-neutral-200 shadow-sm">
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Plan Progress</span>
                        <span className="text-sm font-black text-indigo-600">{currentPlan.progress}%</span>
                      </div>
                      <div className="w-24 h-2 bg-neutral-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-600 transition-all duration-500" 
                          style={{ width: `${currentPlan.progress}%` }} 
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 flex overflow-hidden">
                {/* Chat Area */}
                <div className="flex-1 flex flex-col overflow-hidden border-r border-neutral-100">
                  <div className="flex-1 overflow-y-auto p-10 space-y-10">
                    {messages.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-full text-center space-y-6 opacity-50">
                        <div className="w-20 h-20 bg-neutral-50 rounded-[32px] flex items-center justify-center text-neutral-400">
                          <MessageSquare className="w-10 h-10" />
                        </div>
                        <div className="max-w-xs">
                          <h4 className="text-xl font-bold text-neutral-900 mb-2">Start a conversation</h4>
                          <p className="text-neutral-500">Ask about important questions, clarify doubts, or request explanations for {selectedExam.name}.</p>
                        </div>
                      </div>
                    )}
                    {messages.map((msg, i) => (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={msg.id || i}
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
                              {msg.content}
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

                  <div className="p-10 border-t border-neutral-100 bg-neutral-50/30">
                    <form onSubmit={handleSendMessage} className="relative max-w-3xl mx-auto">
                      <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask a question, solve a doubt, or request an explanation..."
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
                  </div>
                </div>

                {/* Tasks Sidebar */}
                <div className="w-96 bg-neutral-50/50 overflow-y-auto p-8 border-l border-neutral-100">
                  <div className="mb-8">
                    <h4 className="text-xl font-black text-neutral-900 mb-2">Today's Tasks</h4>
                    <p className="text-sm text-neutral-500 font-medium">Complete these to stay on track.</p>
                  </div>

                  {dailyGoals.length > 0 && (
                    <div className="mb-8 p-6 bg-indigo-50 rounded-[32px] border border-indigo-100">
                      <h5 className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        Daily Goal Suggestions
                      </h5>
                      <div className="space-y-3">
                        {dailyGoals.map((goal, i) => (
                          <div key={i} className="space-y-1">
                            <p className="text-sm font-bold text-neutral-900">{goal.title}</p>
                            <p className="text-[10px] text-neutral-500 font-medium">{goal.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!currentPlan ? (
                    <div className="bg-white p-8 rounded-[32px] border border-neutral-200 text-center space-y-4 shadow-sm">
                      <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mx-auto">
                        <Calendar className="w-8 h-8" />
                      </div>
                      <h5 className="font-bold text-neutral-900">No active plan</h5>
                      <p className="text-sm text-neutral-500">Generate a study plan to see your daily tasks and track progress.</p>
                      <button
                        onClick={handleGeneratePlan}
                        disabled={isGeneratingPlan}
                        className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all text-sm"
                      >
                        Generate Now
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {todayTasks.length > 0 ? (
                        todayTasks.map((task) => (
                          <div 
                            key={task.id}
                            className={`p-6 rounded-[32px] border-2 transition-all ${
                              task.status === 'completed' 
                                ? 'bg-emerald-50 border-emerald-100' 
                                : 'bg-white border-neutral-100 shadow-sm'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-4">
                              <div className={`p-3 rounded-xl ${task.status === 'completed' ? 'bg-emerald-500 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
                                {task.type === 'learn' ? <BookOpen className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                              </div>
                              <button
                                onClick={() => handleToggleTask(task.id, task.status)}
                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                                  task.status === 'completed'
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-white border-2 border-neutral-200 text-neutral-300 hover:border-indigo-600 hover:text-indigo-600'
                                }`}
                              >
                                {task.status === 'completed' ? <CheckCircle2 className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
                              </button>
                            </div>
                            <h5 className={`font-bold mb-1 ${task.status === 'completed' ? 'text-emerald-900 line-through opacity-50' : 'text-neutral-900'}`}>
                              {task.title}
                            </h5>
                            <div className="flex items-center gap-2 text-xs font-bold text-neutral-400 uppercase tracking-widest">
                              <Zap className="w-3 h-3" />
                              {task.duration} mins
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="bg-white p-8 rounded-[32px] border border-neutral-200 text-center space-y-4 shadow-sm">
                          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mx-auto">
                            <CheckCircle2 className="w-8 h-8" />
                          </div>
                          <h5 className="font-bold text-neutral-900">All caught up!</h5>
                          <p className="text-sm text-neutral-500">You've completed all tasks for today or have none scheduled.</p>
                        </div>
                      )}

                      {/* Suggestions if tasks are pending */}
                      {todayTasks.some(t => t.status === 'pending') && (
                        <div className="mt-8 p-6 bg-amber-50 rounded-[32px] border border-amber-100 flex gap-4">
                          <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-amber-900 mb-2">You have pending tasks</p>
                            <p className="text-xs text-amber-700 leading-relaxed">Complete remaining topics before proceeding to ensure full syllabus coverage.</p>
                          </div>
                        </div>
                      )}

                      {/* Weak Areas & Revision */}
                      {(weakAreas.length > 0 || revisionTopics.length > 0) && (
                        <div className="mt-8 space-y-4">
                          <h4 className="text-lg font-black text-neutral-900">Personalized Insights</h4>
                          
                          {weakAreas.length > 0 && (
                            <div className="p-6 bg-rose-50 rounded-[32px] border border-rose-100">
                              <h5 className="text-xs font-black text-rose-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                Weak Areas Detected
                              </h5>
                              <div className="space-y-2">
                                {weakAreas.slice(0, 3).map((w, i) => (
                                  <div key={i} className="flex items-center justify-between">
                                    <span className="text-sm font-bold text-neutral-900">{w.topic}</span>
                                    <span className="text-xs font-black text-rose-600">{w.score}%</span>
                                  </div>
                                ))}
                              </div>
                              <button 
                                onClick={() => navigate('/tester')}
                                className="w-full mt-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-all"
                              >
                                Practice Weak Topics
                              </button>
                            </div>
                          )}

                          {revisionTopics.length > 0 && (
                            <div className="p-6 bg-emerald-50 rounded-[32px] border border-emerald-100">
                              <h5 className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Zap className="w-4 h-4" />
                                Smart Revision
                              </h5>
                              <div className="space-y-2">
                                {revisionTopics.slice(0, 3).map((r, i) => (
                                  <div key={i} className="flex items-center justify-between">
                                    <span className="text-sm font-bold text-neutral-900">{r.topic}</span>
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                                      r.priority === 'high' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                                    }`}>
                                      {r.priority}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
