import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/FirebaseProvider';
import { Exam, TestResult, Task, StudyPlan } from '../types';
import { GoogleGenAI } from "@google/genai";
import { Brain, ChevronRight, Loader2, CheckCircle2, XCircle, AlertCircle, Trophy, History, ArrowLeft, Play, Sparkles, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { addXP, XP_VALUES } from '../lib/xp-utils';
import { format } from 'date-fns';

interface Question {
  id: string;
  type: 'mcq' | 'short' | 'concept';
  question: string;
  topic: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
}

export const MrTesterMode: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [testState, setTestState] = useState<'selection' | 'taking' | 'results'>('selection');
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const planId = searchParams.get('planId');
  const taskId = searchParams.get('taskId');
  const topicsParam = searchParams.get('topics');
  const modeParam = searchParams.get('mode');

  useEffect(() => {
    if (!user) return;

    const fetchExams = async () => {
      try {
        const q = query(collection(db, 'exams'), where('uid', '==', user.uid));
        const snap = await getDocs(q).catch(err => handleFirestoreError(err, OperationType.GET, 'exams'));
        if (snap) {
          const fetchedExams = snap.docs.map(d => ({ id: d.id, ...d.data() } as Exam));
          setExams(fetchedExams);

          // Auto-start logic
          if (modeParam === 'weak-areas') {
            generateWeakAreaTest();
          } else if (taskId && topicsParam) {
            const topics = topicsParam.split(',');
            generateTaskTest(topics, taskId, planId);
          }
        }
      } catch (error) {
        console.error('Error fetching exams:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchExams();
  }, [user, taskId, topicsParam, planId, modeParam]);

  const generateWeakAreaTest = async () => {
    setGenerating(true);
    try {
      // Fetch weak areas first
      const resultsQ = query(collection(db, 'testResults'), where('uid', '==', user?.uid));
      const resultsSnap = await getDocs(resultsQ);
      const results = resultsSnap.docs.map(d => d.data() as TestResult);
      
      const topicStats: Record<string, { score: number, total: number }> = {};
      results.forEach(res => {
        res.breakdown?.forEach(b => {
          if (!topicStats[b.topic]) topicStats[b.topic] = { score: 0, total: 0 };
          topicStats[b.topic].score += b.score;
          topicStats[b.topic].total += b.total;
        });
      });

      const weakTopics = Object.entries(topicStats)
        .map(([topic, stats]) => ({ topic, percentage: (stats.score / stats.total) * 100 }))
        .filter(t => t.percentage < 70)
        .sort((a, b) => a.percentage - b.percentage)
        .slice(0, 3)
        .map(t => t.topic);

      if (weakTopics.length === 0) {
        alert("No weak areas detected yet. Take more tests!");
        setTestState('selection');
        return;
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const prompt = `Generate a targeted practice test for the following weak topics: ${weakTopics.join(', ')}.
      
      Generate 5 challenging questions.
      Return as a JSON array of objects with this structure:
      {
        "id": "unique_id",
        "type": "mcq" | "short" | "concept",
        "question": "string",
        "topic": "string (must be one of the weak topics)",
        "options": ["string", "string", "string", "string"] (only for mcq),
        "correctAnswer": "string",
        "explanation": "string"
      }`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const generatedQuestions = JSON.parse(response.text) as Question[];
      setQuestions(generatedQuestions);
      setTestState('taking');
    } catch (error) {
      console.error('Error generating weak area test:', error);
    } finally {
      setGenerating(false);
    }
  };

  const generateTaskTest = async (topics: string[], tId: string, pId: string | null) => {
    setGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const prompt = `Generate a daily assessment test for the following topics: ${topics.join(', ')}.
      
      Generate 5 questions in total. 
      Mix of:
      - MCQs (with 4 options)
      - Short answer questions
      - Concept-based questions
      
      Return as a JSON array of objects with this structure:
      {
        "id": "unique_id",
        "type": "mcq" | "short" | "concept",
        "question": "string",
        "topic": "string",
        "options": ["string", "string", "string", "string"] (only for mcq),
        "correctAnswer": "string",
        "explanation": "string"
      }`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const generatedQuestions = JSON.parse(response.text) as Question[];
      setQuestions(generatedQuestions);
      setTestState('taking');
    } catch (error) {
      console.error('Error generating task test:', error);
      alert('Failed to generate test. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const generateTest = async (exam: Exam) => {
    if (!user) return;
    setGenerating(true);
    setSelectedExam(exam);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const prompt = `Generate a test for the exam "${exam.name}" with subject "${exam.subject}".
      Syllabus: ${exam.syllabusText || "General knowledge of the subject"}
      
      Generate 5 questions in total. 
      Mix of:
      - MCQs (with 4 options)
      - Short answer questions (where the answer is a concise string)
      - Concept-based questions
      
      Return as a JSON array of objects with this structure:
      {
        "id": "unique_id",
        "type": "mcq" | "short" | "concept",
        "question": "string",
        "topic": "string",
        "options": ["string", "string", "string", "string"] (only for mcq),
        "correctAnswer": "string",
        "explanation": "string"
      }`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const generatedQuestions = JSON.parse(response.text) as Question[];
      setQuestions(generatedQuestions);
      setTestState('taking');
    } catch (error) {
      console.error('Error generating test:', error);
      alert('Failed to generate test. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleAnswer = (answer: string) => {
    const question = questions[currentQuestionIndex];
    setUserAnswers(prev => ({ ...prev, [question.id]: answer }));
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      finishTest();
    }
  };

  const finishTest = async () => {
    if (!user) return;

    let score = 0;
    questions.forEach(q => {
      if (userAnswers[q.id]?.toLowerCase().trim() === q.correctAnswer.toLowerCase().trim()) {
        score++;
      }
    });

    const percentage = Math.round((score / questions.length) * 100);

    // Calculate breakdown
    const topicStats: Record<string, { score: number, total: number }> = {};
    questions.forEach(q => {
      const isCorrect = userAnswers[q.id]?.toLowerCase().trim() === q.correctAnswer.toLowerCase().trim();
      if (!topicStats[q.topic]) topicStats[q.topic] = { score: 0, total: 0 };
      topicStats[q.topic].total++;
      if (isCorrect) topicStats[q.topic].score++;
    });

    const breakdown = Object.entries(topicStats).map(([topic, stats]) => ({
      topic,
      score: stats.score,
      total: stats.total
    }));

    const resultData: Omit<TestResult, 'id'> = {
      uid: user.uid,
      examId: selectedExam?.id || planId || 'daily-test',
      examName: selectedExam?.name || 'Daily Assessment',
      score,
      totalQuestions: questions.length,
      percentage,
      timestamp: new Date().toISOString(),
      questions: questions.map(q => ({
        question: q.question,
        userAnswer: userAnswers[q.id] || '',
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        topic: q.topic,
        isCorrect: userAnswers[q.id]?.toLowerCase().trim() === q.correctAnswer.toLowerCase().trim()
      })),
      breakdown
    };

    try {
      const docRef = await addDoc(collection(db, 'testResults'), resultData).catch(err => handleFirestoreError(err, OperationType.WRITE, 'testResults'));
      if (docRef) {
        setTestResult({ id: docRef.id, ...resultData });
        
        // Award XP
        const xpGained = XP_VALUES.TEST_COMPLETED + (score * 5);
        await addXP(user.uid, xpGained, {
          title: `Completed test: ${selectedExam?.name || 'Daily Assessment'}`,
          type: 'test'
        });

        // If it was a task-specific test, mark task as completed and update plan progress
        if (taskId) {
          await updateDoc(doc(db, 'tasks', taskId), {
            status: 'completed',
            completedAt: new Date().toISOString()
          }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `tasks/${taskId}`));

          if (planId) {
            // Update plan progress
            const planDoc = await getDoc(doc(db, 'studyPlans', planId));
            if (planDoc.exists()) {
              const plan = planDoc.data() as StudyPlan;
              const qTasks = query(collection(db, 'tasks'), where('planId', '==', planId));
              const taskSnap = await getDocs(qTasks);
              const allTasks = taskSnap.docs.map(d => d.data() as Task);
              const completedTasks = allTasks.filter(t => t.status === 'completed').length;
              const newProgress = Math.round((completedTasks / allTasks.length) * 100);
              
              await updateDoc(doc(db, 'studyPlans', planId), {
                progress: newProgress,
                performance: increment(percentage / allTasks.length) // Simple averaging
              });
            }
          }
        }
        
        setTestState('results');
      }
    } catch (error) {
      console.error('Error saving test result:', error);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <AnimatePresence mode="wait">
        {testState === 'selection' && (
          <motion.div
            key="selection"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-indigo-100 rounded-3xl flex items-center justify-center text-indigo-600 mx-auto">
                <Brain className="w-10 h-10" />
              </div>
              <h1 className="text-4xl font-black text-neutral-900 tracking-tight">Mr. Tester</h1>
              <p className="text-neutral-500 text-lg max-w-md mx-auto">
                Ready to challenge yourself? Select an exam to generate a personalized assessment.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {exams.length > 0 ? (
                exams.map(exam => (
                  <button
                    key={exam.id}
                    onClick={() => generateTest(exam)}
                    disabled={generating}
                    className="p-8 rounded-[40px] bg-white border-2 border-neutral-100 hover:border-indigo-600 hover:shadow-xl transition-all text-left group relative overflow-hidden"
                  >
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-full uppercase tracking-wider">
                          {exam.subject}
                        </span>
                        <ChevronRight className="w-5 h-5 text-neutral-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                      </div>
                      <h3 className="text-xl font-bold text-neutral-900 mb-2">{exam.name}</h3>
                      <p className="text-neutral-500 text-sm">
                        {exam.syllabusText ? 'Syllabus loaded' : 'General assessment'}
                      </p>
                    </div>
                    {generating && selectedExam?.id === exam.id && (
                      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-20">
                        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                      </div>
                    )}
                  </button>
                ))
              ) : (
                <div className="md:col-span-2 bg-neutral-50 border-2 border-dashed border-neutral-200 rounded-[40px] p-12 text-center">
                  <AlertCircle className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-neutral-900 mb-2">No exams found</h3>
                  <p className="text-neutral-500 mb-6">Add an exam to your calendar first to start testing.</p>
                  <button 
                    onClick={() => window.location.href = '/exams'}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all"
                  >
                    Go to Exam Calendar
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {testState === 'taking' && (
          <motion.div
            key="taking"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-8"
          >
            <div className="flex items-center justify-between">
              <button 
                onClick={() => setTestState('selection')}
                className="flex items-center gap-2 text-neutral-500 hover:text-neutral-900 font-bold transition-colors"
              >
                <ArrowLeft className="w-5 h-5" /> Quit Test
              </button>
              <div className="px-4 py-2 bg-indigo-50 rounded-2xl text-indigo-600 font-bold text-sm">
                Question {currentQuestionIndex + 1} of {questions.length}
              </div>
            </div>

            <div className="bg-white rounded-[40px] p-10 border border-neutral-200 shadow-xl">
              <div className="space-y-8">
                <div className="space-y-2">
                  <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">
                    {questions[currentQuestionIndex].type} Question
                  </span>
                  <h2 className="text-2xl font-bold text-neutral-900 leading-tight">
                    {questions[currentQuestionIndex].question}
                  </h2>
                </div>

                <div className="space-y-4">
                  {questions[currentQuestionIndex].type === 'mcq' ? (
                    <div className="grid gap-3">
                      {questions[currentQuestionIndex].options?.map((option, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleAnswer(option)}
                          className={`p-5 rounded-2xl border-2 text-left font-bold transition-all ${
                            userAnswers[questions[currentQuestionIndex].id] === option
                              ? 'border-indigo-600 bg-indigo-50 text-indigo-600'
                              : 'border-neutral-100 hover:border-neutral-200 text-neutral-600'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs ${
                              userAnswers[questions[currentQuestionIndex].id] === option
                                ? 'bg-indigo-600 text-white'
                                : 'bg-neutral-100 text-neutral-500'
                            }`}>
                              {String.fromCharCode(65 + idx)}
                            </span>
                            {option}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <textarea
                      value={userAnswers[questions[currentQuestionIndex].id] || ''}
                      onChange={(e) => handleAnswer(e.target.value)}
                      placeholder="Type your answer here..."
                      className="w-full p-6 rounded-3xl border-2 border-neutral-100 focus:border-indigo-600 focus:ring-0 text-lg font-medium min-h-[150px] transition-all"
                    />
                  )}
                </div>

                <button
                  onClick={nextQuestion}
                  disabled={!userAnswers[questions[currentQuestionIndex].id]}
                  className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-bold text-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {currentQuestionIndex === questions.length - 1 ? 'Finish Test' : 'Next Question'}
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {testState === 'results' && testResult && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="bg-white rounded-[40px] p-12 border border-neutral-200 shadow-2xl text-center space-y-8">
              <div className="relative inline-block">
                <div className="w-32 h-32 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mx-auto">
                  <Trophy className="w-16 h-16" />
                </div>
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5, type: 'spring' }}
                  className="absolute -top-2 -right-2 bg-indigo-600 text-white p-3 rounded-2xl shadow-lg"
                >
                  <Sparkles className="w-6 h-6" />
                </motion.div>
              </div>

              <div className="space-y-2">
                <h2 className="text-4xl font-black text-neutral-900">Test Complete!</h2>
                <p className="text-neutral-500 text-lg">
                  {testResult.score === testResult.totalQuestions ? 'Perfect score! 🌟' : 'Keep practicing to improve! 💪'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-6 max-w-sm mx-auto">
                <div className="p-6 rounded-3xl bg-neutral-50 border border-neutral-100">
                  <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1">Score</p>
                  <p className="text-3xl font-black text-neutral-900">{testResult.score}/{testResult.totalQuestions}</p>
                </div>
                <div className="p-6 rounded-3xl bg-indigo-50 border border-indigo-100">
                  <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1">Accuracy</p>
                  <p className="text-3xl font-black text-indigo-600">
                    {Math.round((testResult.score / testResult.totalQuestions) * 100)}%
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-6">
                <button
                  onClick={() => setTestState('selection')}
                  className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-bold text-lg hover:bg-indigo-700 transition-all"
                >
                  Back to Selection
                </button>
                <button
                  onClick={() => window.location.href = '/dashboard'}
                  className="w-full py-5 bg-white border-2 border-neutral-100 text-neutral-600 rounded-3xl font-bold text-lg hover:border-neutral-200 transition-all"
                >
                  Go to Dashboard
                </button>
              </div>
            </div>

            {/* Detailed Review */}
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-neutral-900 px-4">Review Answers</h3>
              <div className="space-y-4">
                {questions.map((q, idx) => {
                  const isCorrect = userAnswers[q.id]?.toLowerCase().trim() === q.correctAnswer.toLowerCase().trim();
                  return (
                    <div key={q.id} className="bg-white p-8 rounded-[32px] border border-neutral-200 shadow-sm space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Question {idx + 1}</span>
                          <h4 className="text-lg font-bold text-neutral-900">{q.question}</h4>
                        </div>
                        {isCorrect ? (
                          <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-6 h-6 text-rose-500 flex-shrink-0" />
                        )}
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className={`p-4 rounded-2xl ${isCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                          <p className="text-[10px] font-bold uppercase tracking-wider mb-1">Your Answer</p>
                          <p className="font-bold">{userAnswers[q.id] || 'No answer'}</p>
                        </div>
                        {!isCorrect && (
                          <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-700">
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-1">Correct Answer</p>
                            <p className="font-bold">{q.correctAnswer}</p>
                          </div>
                        )}
                      </div>

                      <div className="p-6 rounded-2xl bg-neutral-50 border border-neutral-100">
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">Explanation</p>
                        <p className="text-sm text-neutral-600 leading-relaxed">{q.explanation}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
