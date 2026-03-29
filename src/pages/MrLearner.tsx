import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, writeBatch, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/FirebaseProvider';
import { Exam, Task, StudyPlan, ChatMessage, TestResult } from '../types';
import { GoogleGenAI } from "@google/genai";
import {
  GraduationCap, Calendar, ArrowRight, MessageSquare, Loader2,
  ChevronLeft, Send, User, Bot, BookOpen, CheckCircle2, Circle,
  Zap, Target, Brain, Sparkles, Play, CheckCheck, AlertTriangle,
  Focus, X, ChevronRight, TrendingUp, ClipboardList
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { format, differenceInDays, parseISO, startOfToday } from 'date-fns';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { generateStudyPlan, getAdaptiveWorkload, detectWeakAreas } from '../lib/intelligence-utils';
import { addXP, XP_VALUES } from '../lib/xp-utils';

type Step = 'select-exam' | 'choose-mode' | 'chat' | 'prepare';

interface PlanSuggestion {
  show: boolean;
  dismissed: boolean;
}

function getExamSessionKey(examId: string) {
  return `learner_session_${examId}`;
}

export const MrLearner: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState<Step>('select-exam');
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [focusMode, setFocusMode] = useState(false);

  // Chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Plan
  const [currentPlan, setCurrentPlan] = useState<StudyPlan | null>(null);
  const [todayTasks, setTodayTasks] = useState<Task[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [planSuggestion, setPlanSuggestion] = useState<PlanSuggestion>({ show: false, dismissed: false });
  const [weakAreas, setWeakAreas] = useState<{ topic: string; score: number }[]>([]);
  const [adaptiveDifficulty, setAdaptiveDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [preparingContent, setPreparingContent] = useState<string>('');
  const [isLoadingPrepare, setIsLoadingPrepare] = useState(false);

  useEffect(() => {
    if (user) {
      loadExams();
      loadIntelligence();
    }
  }, [user]);

  // Handle URL params (coming from dashboard)
  useEffect(() => {
    if (exams.length > 0) {
      const examId = searchParams.get('examId');
      if (examId) {
        const exam = exams.find(e => e.id === examId);
        if (exam) handleSelectExam(exam);
      }
    }
  }, [exams, searchParams]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadIntelligence = async () => {
    if (!user) return;
    try {
      const [weak, resultsSnap] = await Promise.all([
        detectWeakAreas(user.uid),
        getDocs(query(collection(db, 'testResults'), where('uid', '==', user.uid), orderBy('timestamp', 'desc'), limit(5)))
      ]);
      setWeakAreas(weak);
      const results = resultsSnap.docs.map(d => d.data() as TestResult);
      const config = getAdaptiveWorkload(results);
      setAdaptiveDifficulty(config.difficulty);
    } catch (e) {
      console.error('Intelligence load error:', e);
    }
  };

  const loadExams = async () => {
    if (!user) return;
    try {
      const snap = await getDocs(query(collection(db, 'exams'), where('uid', '==', user.uid)));
      setExams(snap.docs.map(d => ({ id: d.id, ...d.data() } as Exam)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectExam = async (exam: Exam) => {
    setSelectedExam(exam);

    // Load existing plan
    try {
      const planSnap = await getDocs(query(collection(db, 'studyPlans'), where('uid', '==', user?.uid), where('subject', '==', exam.subject)));
      if (!planSnap.empty) {
        const plan = { id: planSnap.docs[0].id, ...planSnap.docs[0].data() } as StudyPlan;
        setCurrentPlan(plan);
        await loadPlanTasks(plan.id);
      } else {
        setCurrentPlan(null);
        setTodayTasks([]);
        setAllTasks([]);
      }
    } catch (e) {
      console.error(e);
    }

    // Load or create persistent chat session for this exam
    try {
      const sessSnap = await getDocs(query(
        collection(db, 'chatSessions'),
        where('uid', '==', user?.uid),
        where('examId', '==', exam.id)
      ));
      if (!sessSnap.empty) {
        const sid = sessSnap.docs[0].id;
        setSessionId(sid);
        const msgsSnap = await getDocs(query(collection(db, 'chatMessages'), where('sessionId', '==', sid), orderBy('timestamp', 'asc')));
        setMessages(msgsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage)));
      } else {
        setSessionId(null);
        setMessages([]);
      }
    } catch (e) {
      console.error(e);
    }

    setStep('choose-mode');
  };

  const loadPlanTasks = async (planId: string) => {
    if (!user) return;
    const today = format(startOfToday(), 'yyyy-MM-dd');
    const [todaySnap, allSnap] = await Promise.all([
      getDocs(query(collection(db, 'tasks'), where('planId', '==', planId), where('date', '==', today))),
      getDocs(query(collection(db, 'tasks'), where('planId', '==', planId)))
    ]);
    setTodayTasks(todaySnap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
    setAllTasks(allSnap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
  };

  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    if (!user || !currentPlan) return;
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    try {
      await updateDoc(doc(db, 'tasks', taskId), { status: newStatus, completedAt: newStatus === 'completed' ? new Date().toISOString() : null });
      setTodayTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus as any } : t));
      const updatedAll = allTasks.map(t => t.id === taskId ? { ...t, status: newStatus as any } : t);
      setAllTasks(updatedAll);
      const completed = updatedAll.filter(t => t.status === 'completed').length;
      const newProgress = Math.round((completed / updatedAll.length) * 100);
      await updateDoc(doc(db, 'studyPlans', currentPlan.id), { progress: newProgress });
      setCurrentPlan(prev => prev ? { ...prev, progress: newProgress } : null);
      if (newStatus === 'completed') await addXP(user.uid, XP_VALUES.TASK_COMPLETED, { title: `Completed task`, type: 'learn' });
    } catch (e) {
      console.error(e);
    }
  };

  const handleGeneratePlan = async () => {
    if (!user || !selectedExam) return;
    setIsGeneratingPlan(true);
    setPlanSuggestion({ show: false, dismissed: true });
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
      await loadPlanTasks(planRef.id);

      // Notify in chat
      const sid = await ensureSession();
      if (sid) {
        const msg = `✅ Your personalized study plan for **${selectedExam.name}** is ready! I've created daily tasks based on your syllabus and exam date. Check the plan panel on the right to see today's tasks.`;
        await addDoc(collection(db, 'chatMessages'), { sessionId: sid, uid: user.uid, role: 'model', content: msg, timestamp: new Date().toISOString() });
        const msgsSnap = await getDocs(query(collection(db, 'chatMessages'), where('sessionId', '==', sid), orderBy('timestamp', 'asc')));
        setMessages(msgsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage)));
      }
    } catch (e) {
      console.error('Error generating plan:', e);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const ensureSession = async (): Promise<string | null> => {
    if (sessionId) return sessionId;
    if (!user || !selectedExam) return null;
    try {
      const ref = await addDoc(collection(db, 'chatSessions'), {
        uid: user.uid,
        examId: selectedExam.id,
        title: `${selectedExam.name} — Study Session`,
        mode: 'learner',
        createdAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString()
      });
      setSessionId(ref.id);
      return ref.id;
    } catch (e) {
      return null;
    }
  };

  const handleSend = async (e?: React.FormEvent, overrideInput?: string) => {
    e?.preventDefault();
    const msg = (overrideInput ?? input).trim();
    if (!msg || isGenerating || !user || !selectedExam) return;
    setInput('');

    const sid = await ensureSession();
    if (!sid) return;

    // Save user message
    await addDoc(collection(db, 'chatMessages'), { sessionId: sid, uid: user.uid, role: 'user', content: msg, timestamp: new Date().toISOString() });
    const msgsSnap = await getDocs(query(collection(db, 'chatMessages'), where('sessionId', '==', sid), orderBy('timestamp', 'asc')));
    const history = msgsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage));
    setMessages(history);

    // Check if user is asking about study plan
    const preparationKeywords = ['study plan', 'prepare', 'schedule', 'timetable', 'plan for', 'how to study', 'preparation'];
    const isAskingForPlan = preparationKeywords.some(kw => msg.toLowerCase().includes(kw));
    if (isAskingForPlan && !currentPlan && !planSuggestion.dismissed) {
      setPlanSuggestion({ show: true, dismissed: false });
    }

    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const systemPrompt = `You are Mr. Learner, an expert AI tutor and mentor for ${selectedExam.name} (${selectedExam.subject}).

CONTEXT:
- Exam: ${selectedExam.name}
- Subject: ${selectedExam.subject}  
- Syllabus: ${selectedExam.syllabusText || 'General knowledge'}
- Adaptive Difficulty: ${adaptiveDifficulty}
- User's Weak Areas: ${weakAreas.map(w => w.topic).join(', ') || 'Not yet identified'}
- Study Plan Active: ${currentPlan ? `Yes — ${currentPlan.progress || 0}% complete` : 'No'}

INSTRUCTIONS:
- Provide well-structured, exam-focused answers
- Use Markdown formatting
- Include: Key Points → Explanation → Examples
- Tailor difficulty to "${adaptiveDifficulty}" level
- Be encouraging and proactive
- If user asks important questions, give high-yield topics and practice questions
- Keep responses concise but thorough`;

      const contents = [
        { text: systemPrompt },
        ...history.slice(-10).map(m => ({ text: `${m.role === 'user' ? 'User' : 'Mentor'}: ${m.content}` }))
      ];

      const response = await ai.models.generateContent({ model: 'gemini-2.0-flash', contents });
      const botReply = response.text || "I'm here to help! What would you like to learn?";

      await addDoc(collection(db, 'chatMessages'), { sessionId: sid, uid: user.uid, role: 'model', content: botReply, timestamp: new Date().toISOString() });
      await updateDoc(doc(db, 'chatSessions', sid), { lastUpdatedAt: new Date().toISOString() });

      const updatedSnap = await getDocs(query(collection(db, 'chatMessages'), where('sessionId', '==', sid), orderBy('timestamp', 'asc')));
      setMessages(updatedSnap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage)));
    } catch (e) {
      console.error('AI error:', e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLoadPrepareContent = async () => {
    if (!selectedExam) return;
    setIsLoadingPrepare(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const prompt = `You are an expert tutor for ${selectedExam.name} (${selectedExam.subject}).

Syllabus: ${selectedExam.syllabusText || 'General subject knowledge'}

Generate a comprehensive exam preparation guide with:
1. **5 Most Important Topics** — brief explanation of each
2. **10 High-Yield Questions** — questions most likely to appear, with concise answers
3. **Key Concepts to Remember** — bullet points of must-know facts
4. **Common Mistakes to Avoid**
5. **Quick Revision Tips**

Format using Markdown. Be concise, exam-focused, and practical.`;

      const response = await ai.models.generateContent({ model: 'gemini-2.0-flash', contents: prompt });
      setPreparingContent(response.text || '');
    } catch (e) {
      console.error(e);
      setPreparingContent('Failed to load content. Please check your Gemini API key and try again.');
    } finally {
      setIsLoadingPrepare(false);
    }
  };

  const allTasksDone = allTasks.length > 0 && allTasks.every(t => t.status === 'completed');
  const todayPending = todayTasks.filter(t => t.status === 'pending').length;
  const todayDone = todayTasks.filter(t => t.status === 'completed').length;

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
    </div>
  );

  // Focus mode wrapper
  const wrapper = focusMode
    ? 'fixed inset-0 z-50 bg-white flex flex-col'
    : 'flex flex-col h-[calc(100vh-10rem)] -mx-8 -my-8';

  return (
    <div className={wrapper}>

      {/* ── STEP: Select Exam ── */}
      <AnimatePresence mode="wait">
        {step === 'select-exam' && (
          <motion.div key="select" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center p-10 text-center bg-neutral-50">
            <div className="w-20 h-20 bg-indigo-600 rounded-[32px] flex items-center justify-center text-white mx-auto mb-8 shadow-2xl shadow-indigo-200">
              <GraduationCap className="w-10 h-10" />
            </div>
            <h1 className="text-4xl font-black tracking-tight text-neutral-900 mb-3">Mr. Learner</h1>
            <p className="text-neutral-500 text-lg max-w-md mx-auto mb-10">
              Your AI mentor. Choose an exam to start learning.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
              {exams.map(exam => {
                const daysLeft = differenceInDays(parseISO(exam.date), startOfToday());
                return (
                  <button key={exam.id} onClick={() => handleSelectExam(exam)}
                    className="p-7 bg-white border-2 border-neutral-100 rounded-[28px] hover:border-indigo-500 hover:shadow-xl transition-all text-left group">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600 group-hover:scale-110 transition-transform">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      {daysLeft >= 0 && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${daysLeft <= 7 ? 'bg-rose-100 text-rose-600' : 'bg-neutral-100 text-neutral-500'}`}>
                          {daysLeft}d left
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-black text-neutral-900 mb-0.5">{exam.name}</h3>
                    <p className="text-sm text-neutral-500">{exam.subject}</p>
                  </button>
                );
              })}
              {exams.length === 0 && (
                <div className="col-span-full p-12 bg-white rounded-[32px] border-2 border-dashed border-neutral-200 text-center">
                  <p className="text-neutral-500 font-medium mb-4">No exams added yet.</p>
                  <Link to="/exams" className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all inline-block">
                    Add an Exam
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── STEP: Choose Mode ── */}
        {step === 'choose-mode' && selectedExam && (
          <motion.div key="mode" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center p-10 text-center bg-neutral-50">
            <button onClick={() => setStep('select-exam')} className="flex items-center gap-2 text-neutral-500 hover:text-neutral-900 font-semibold mb-10 self-start ml-0">
              <ChevronLeft className="w-5 h-5" /> All Exams
            </button>
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-xl shadow-indigo-200">
              <GraduationCap className="w-7 h-7" />
            </div>
            <h2 className="text-3xl font-black text-neutral-900 mb-1">{selectedExam.name}</h2>
            <p className="text-neutral-500 mb-10">How would you like to study today?</p>

            <div className="grid sm:grid-cols-2 gap-5 w-full max-w-xl">
              <button onClick={() => setStep('chat')}
                className="group p-8 bg-indigo-600 text-white rounded-[28px] hover:bg-indigo-700 transition-all text-left shadow-2xl shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-1">
                <MessageSquare className="w-8 h-8 mb-5 opacity-80" />
                <h3 className="text-xl font-black mb-2">Ask Doubts</h3>
                <p className="text-indigo-200 text-sm leading-relaxed">
                  Chat with your AI mentor. Get clear explanations, examples, and instant answers.
                </p>
                {messages.length > 0 && (
                  <span className="inline-block mt-3 text-[10px] font-black bg-white/20 px-2 py-0.5 rounded-full">
                    {messages.length} messages — continue
                  </span>
                )}
              </button>

              <button onClick={() => { setStep('prepare'); if (!preparingContent) handleLoadPrepareContent(); }}
                className="group p-8 bg-white border-2 border-neutral-200 rounded-[28px] hover:border-indigo-500 hover:shadow-xl transition-all text-left hover:-translate-y-1">
                <Target className="w-8 h-8 mb-5 text-indigo-600" />
                <h3 className="text-xl font-black text-neutral-900 mb-2">Prepare for Exam</h3>
                <p className="text-neutral-500 text-sm leading-relaxed">
                  Important questions, key concepts, and a structured study plan.
                </p>
              </button>
            </div>

            {currentPlan && (
              <div className="mt-8 bg-white border border-neutral-200 rounded-2xl px-6 py-4 flex items-center gap-4 shadow-sm">
                <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                  <ClipboardList className="w-4 h-4" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-bold text-neutral-900">{currentPlan.title}</p>
                  <p className="text-xs text-neutral-500">{currentPlan.progress || 0}% complete · {todayPending} tasks due today</p>
                </div>
                {allTasksDone && (
                  <Link to={`/tester?examId=${selectedExam.id}&examName=${encodeURIComponent(selectedExam.name)}`}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black hover:bg-emerald-700 flex items-center gap-1.5">
                    <Play className="w-3.5 h-3.5" /> Ready for Test
                  </Link>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* ── STEP: Chat ── */}
        {step === 'chat' && selectedExam && (
          <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b border-neutral-100 bg-white flex-shrink-0 ${focusMode ? 'px-8' : ''}`}>
              <div className="flex items-center gap-3">
                {!focusMode && (
                  <button onClick={() => setStep('choose-mode')} className="p-2 hover:bg-neutral-100 rounded-xl text-neutral-500">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-neutral-900">{selectedExam.name} Mentor</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Active</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {currentPlan && (
                  <div className="hidden sm:flex items-center gap-2 bg-neutral-50 px-4 py-2 rounded-xl border border-neutral-200 text-sm">
                    <span className="text-neutral-500 font-medium">Plan:</span>
                    <span className="font-black text-indigo-600">{currentPlan.progress || 0}%</span>
                    <div className="w-16 bg-neutral-200 h-1.5 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-600" style={{ width: `${currentPlan.progress || 0}%` }} />
                    </div>
                  </div>
                )}
                <button onClick={() => setFocusMode(f => !f)}
                  title={focusMode ? 'Exit Focus Mode' : 'Focus Mode'}
                  className="p-2 hover:bg-neutral-100 rounded-xl text-neutral-500 transition-colors">
                  {focusMode ? <X className="w-5 h-5" /> : <Focus className="w-5 h-5" />}
                </button>
                {!currentPlan && (
                  <button onClick={handleGeneratePlan} disabled={isGeneratingPlan}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all">
                    {isGeneratingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Create Plan
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Chat Area */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Plan suggestion banner */}
                <AnimatePresence>
                  {planSuggestion.show && !currentPlan && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                      className="mx-6 mt-4 p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-between gap-4 flex-shrink-0">
                      <div className="flex items-center gap-3">
                        <Sparkles className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                        <div>
                          <p className="font-bold text-indigo-900 text-sm">Create a study plan?</p>
                          <p className="text-xs text-indigo-600">I'll build a day-by-day plan for {selectedExam.name} based on your syllabus and exam date.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={handleGeneratePlan} disabled={isGeneratingPlan}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5">
                          {isGeneratingPlan ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Sparkles className="w-3.5 h-3.5" /> Yes, create it</>}
                        </button>
                        <button onClick={() => setPlanSuggestion({ show: false, dismissed: true })} className="p-2 hover:bg-indigo-100 rounded-lg">
                          <X className="w-4 h-4 text-indigo-400" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-5 opacity-60">
                      <div className="w-16 h-16 bg-neutral-100 rounded-[24px] flex items-center justify-center text-neutral-400">
                        <MessageSquare className="w-8 h-8" />
                      </div>
                      <div>
                        <h4 className="font-bold text-neutral-900 mb-1">Start the conversation</h4>
                        <p className="text-sm text-neutral-500 max-w-xs">Ask about any topic, important questions, or concepts for {selectedExam.name}.</p>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {['What are the important topics?', 'Explain the key concepts', 'Give me practice questions'].map(q => (
                          <button key={q} onClick={() => handleSend(undefined, q)}
                            className="px-4 py-2 bg-white border border-neutral-200 rounded-2xl text-sm font-medium text-neutral-700 hover:border-indigo-300 hover:text-indigo-700 transition-all">
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {messages.map((msg, i) => (
                    <motion.div key={msg.id || i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border border-neutral-200 text-indigo-600'}`}>
                        {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                      </div>
                      <div className={`max-w-[82%] px-5 py-4 rounded-[20px] text-sm leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-neutral-50 text-neutral-800 border border-neutral-100 rounded-tl-sm'}`}>
                        <div className="prose prose-sm max-w-none">
                          <ReactMarkdown components={{
                            p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                            h2: ({ children }) => <h2 className={`text-base font-black mb-2 ${msg.role === 'user' ? 'text-white' : 'text-neutral-900'}`}>{children}</h2>,
                            h3: ({ children }) => <h3 className={`text-sm font-bold mb-2 ${msg.role === 'user' ? 'text-white' : 'text-neutral-900'}`}>{children}</h3>,
                            ul: ({ children }) => <ul className="list-disc pl-4 mb-3 space-y-1">{children}</ul>,
                            li: ({ children }) => <li>{children}</li>,
                            strong: ({ children }) => <strong className={`font-black ${msg.role === 'user' ? 'text-white' : 'text-neutral-900'}`}>{children}</strong>,
                            code: ({ children }) => <code className={`px-1.5 py-0.5 rounded text-xs font-mono ${msg.role === 'user' ? 'bg-white/20' : 'bg-indigo-50 text-indigo-700'}`}>{children}</code>,
                          }}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  {isGenerating && (
                    <div className="flex gap-4">
                      <div className="w-9 h-9 rounded-xl bg-white border border-neutral-200 flex items-center justify-center text-indigo-600">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div className="bg-neutral-50 px-5 py-4 rounded-[20px] rounded-tl-sm border border-neutral-100">
                        <div className="flex gap-1.5 items-center text-sm text-neutral-400">
                          <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-2 h-2 bg-indigo-400 rounded-full" />
                          <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.3 }} className="w-2 h-2 bg-indigo-400 rounded-full" />
                          <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.6 }} className="w-2 h-2 bg-indigo-400 rounded-full" />
                          <span className="ml-1 font-medium">Thinking…</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input */}
                <form onSubmit={handleSend} className="p-4 border-t border-neutral-100 bg-white flex-shrink-0">
                  <div className="flex gap-3 items-end">
                    <input
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      placeholder={`Ask about ${selectedExam.name}…`}
                      className="flex-1 px-5 py-3 rounded-2xl border border-neutral-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-sm transition-all"
                      disabled={isGenerating}
                    />
                    <button type="submit" disabled={!input.trim() || isGenerating}
                      className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 disabled:opacity-40 transition-all flex-shrink-0">
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              </div>

              {/* Right Panel: Tasks */}
              {currentPlan && !focusMode && (
                <div className="w-72 border-l border-neutral-100 flex flex-col bg-neutral-50 flex-shrink-0 overflow-y-auto">
                  <div className="p-5 border-b border-neutral-100 bg-white">
                    <h3 className="font-bold text-neutral-900 text-sm flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-indigo-600" />
                      Today's Tasks
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5">{todayDone}/{todayTasks.length} done · {currentPlan.progress || 0}% overall</p>
                    <div className="mt-2 w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-600 transition-all" style={{ width: `${currentPlan.progress || 0}%` }} />
                    </div>
                  </div>

                  <div className="p-4 space-y-2 flex-1">
                    {todayTasks.length > 0 ? todayTasks.map(task => (
                      <button key={task.id} onClick={() => handleToggleTask(task.id, task.status)}
                        className={`w-full p-3 rounded-2xl border text-left transition-all flex items-start gap-3 ${task.status === 'completed' ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-neutral-200 hover:border-indigo-200'}`}>
                        <div className={`mt-0.5 flex-shrink-0 ${task.status === 'completed' ? 'text-emerald-500' : 'text-neutral-300'}`}>
                          {task.status === 'completed' ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-bold truncate ${task.status === 'completed' ? 'line-through text-neutral-400' : 'text-neutral-900'}`}>{task.title}</p>
                          <p className="text-[10px] text-neutral-400 mt-0.5">{task.duration}min · {task.type}</p>
                        </div>
                      </button>
                    )) : (
                      <p className="text-xs text-neutral-400 text-center py-4">No tasks scheduled for today</p>
                    )}
                  </div>

                  {todayPending > 0 && (
                    <div className="p-4 border-t border-neutral-100">
                      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3">
                        <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {todayPending} task{todayPending > 1 ? 's' : ''} pending today
                        </p>
                      </div>
                    </div>
                  )}

                  {allTasksDone && (
                    <div className="p-4 border-t border-neutral-100">
                      <Link to={`/tester?examId=${selectedExam.id}&examName=${encodeURIComponent(selectedExam.name)}`}
                        className="w-full py-3 bg-emerald-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all">
                        <Play className="w-4 h-4" /> Ready for Test!
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── STEP: Prepare for Exam ── */}
        {step === 'prepare' && selectedExam && (
          <motion.div key="prepare" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 bg-white flex-shrink-0">
              <div className="flex items-center gap-3">
                <button onClick={() => setStep('choose-mode')} className="p-2 hover:bg-neutral-100 rounded-xl text-neutral-500">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-neutral-900">{selectedExam.name} — Exam Prep</h3>
                  <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">Key Topics & Questions</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!currentPlan && (
                  <button onClick={handleGeneratePlan} disabled={isGeneratingPlan}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50">
                    {isGeneratingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4" /> Generate Plan</>}
                  </button>
                )}
                <button onClick={() => setStep('chat')}
                  className="flex items-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-700 rounded-xl text-sm font-bold hover:bg-neutral-200">
                  <MessageSquare className="w-4 h-4" /> Ask Doubts
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {isLoadingPrepare ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                  <p className="text-neutral-500 font-medium">Loading exam preparation content…</p>
                </div>
              ) : preparingContent ? (
                <div className="max-w-3xl mx-auto">
                  <div className="bg-white rounded-[28px] border border-neutral-200 p-8 prose prose-neutral max-w-none shadow-sm">
                    <ReactMarkdown components={{
                      h1: ({ children }) => <h1 className="text-2xl font-black text-neutral-900 mb-4">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-xl font-black text-neutral-900 mt-8 mb-3 pb-2 border-b border-neutral-100">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-base font-bold text-indigo-700 mt-4 mb-2">{children}</h3>,
                      p: ({ children }) => <p className="text-neutral-700 mb-3 leading-relaxed">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc pl-5 mb-4 space-y-1.5">{children}</ul>,
                      li: ({ children }) => <li className="text-neutral-700">{children}</li>,
                      strong: ({ children }) => <strong className="font-black text-neutral-900">{children}</strong>,
                    }}>
                      {preparingContent}
                    </ReactMarkdown>
                  </div>

                  <div className="mt-6 flex gap-4">
                    <button onClick={() => setStep('chat')}
                      className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                      <MessageSquare className="w-4 h-4" /> Ask Follow-up Questions
                    </button>
                    {!currentPlan && (
                      <button onClick={handleGeneratePlan} disabled={isGeneratingPlan}
                        className="flex-1 py-3 bg-white border-2 border-indigo-200 text-indigo-600 rounded-2xl font-bold hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                        {isGeneratingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4" /> Create Study Plan</>}
                      </button>
                    )}
                    {currentPlan && allTasksDone && (
                      <Link to={`/tester?examId=${selectedExam.id}&examName=${encodeURIComponent(selectedExam.name)}`}
                        className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
                        <Play className="w-4 h-4" /> Ready for Test
                      </Link>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <button onClick={handleLoadPrepareContent} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2">
                    <Sparkles className="w-5 h-5" /> Load Exam Prep Content
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
