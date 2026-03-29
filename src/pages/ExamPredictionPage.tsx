import React, { useState, useEffect } from 'react';
import { useAuth } from '../components/FirebaseProvider';
import { collection, query, where, getDocs, addDoc, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Exam, ExamPrediction, TestResult } from '../types';
import { AIPredictionCard } from '../components/AIPredictionCard';
import { predictExamQuestions } from '../lib/intelligence-utils';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Brain, Loader2, History, Target, AlertCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export const ExamPredictionPage: React.FC = () => {
  const { user } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [prediction, setPrediction] = useState<ExamPrediction | null>(null);
  const [history, setHistory] = useState<ExamPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        // Fetch exams
        const examsSnap = await getDocs(query(collection(db, 'exams'), where('uid', '==', user.uid)));
        const examsList = examsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Exam));
        setExams(examsList);

        // Fetch history
        const historySnap = await getDocs(query(
          collection(db, 'examPredictions'), 
          where('uid', '==', user.uid),
          orderBy('generatedAt', 'desc'),
          limit(10)
        ));
        const historyList = historySnap.docs.map(d => ({ id: d.id, ...d.data() } as ExamPrediction));
        setHistory(historyList);
        
        if (historyList.length > 0) {
          setPrediction(historyList[0]);
        }
      } catch (error) {
        console.error('Error fetching prediction data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleGenerate = async () => {
    if (!user || !selectedExamId) return;

    setIsGenerating(true);
    try {
      const exam = exams.find(e => e.id === selectedExamId);
      if (!exam) return;

      // Fetch recent results for context
      const resultsSnap = await getDocs(query(
        collection(db, 'testResults'),
        where('uid', '==', user.uid),
        orderBy('timestamp', 'desc'),
        limit(5)
      ));
      const results = resultsSnap.docs.map(d => d.data() as TestResult);

      const newPrediction = await predictExamQuestions(exam, results);
      
      // Save to Firestore
      const docRef = await addDoc(collection(db, 'examPredictions'), newPrediction);
      const savedPrediction = { ...newPrediction, id: docRef.id };
      
      setPrediction(savedPrediction);
      setHistory(prev => [savedPrediction, ...prev]);
    } catch (error) {
      console.error('Error generating prediction:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-20">
      <header className="space-y-4">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-neutral-500 font-bold hover:text-neutral-900 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-5xl font-black tracking-tight text-neutral-900 flex items-center gap-4">
              AI Exam Prediction <Sparkles className="w-10 h-10 text-indigo-600" />
            </h1>
            <p className="text-xl text-neutral-500 font-medium">
              Our AI analyzes your syllabus and performance to predict high-weight questions.
            </p>
          </div>
        </div>
      </header>

      <section className="bg-white p-10 rounded-[48px] border border-neutral-100 shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 items-end">
          <div className="md:col-span-2 space-y-4">
            <label className="text-xs font-black text-neutral-400 uppercase tracking-widest flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-500" /> Select Exam to Predict
            </label>
            <select 
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="w-full p-6 bg-neutral-50 border-2 border-neutral-100 rounded-3xl font-bold text-lg focus:border-indigo-500 focus:ring-0 transition-all outline-none"
            >
              <option value="">Choose an upcoming exam...</option>
              {exams.map(exam => (
                <option key={exam.id} value={exam.id}>{exam.name} ({exam.subject})</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleGenerate}
            disabled={!selectedExamId || isGenerating}
            className="w-full p-6 bg-neutral-900 text-white rounded-3xl font-black text-lg flex items-center justify-center gap-3 hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-neutral-200"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" /> Analyzing Syllabus...
              </>
            ) : (
              <>
                <Brain className="w-6 h-6" /> Generate Prediction
              </>
            )}
          </button>
        </div>
      </section>

      <AnimatePresence mode="wait">
        {prediction ? (
          <motion.div
            key={prediction.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <AIPredictionCard prediction={prediction} />
          </motion.div>
        ) : (
          <div className="text-center py-20 space-y-6">
            <div className="w-24 h-24 bg-neutral-100 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-12 h-12 text-neutral-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-neutral-900">No Prediction Generated</h3>
              <p className="text-neutral-500 font-medium">Select an exam above to see what's likely to appear.</p>
            </div>
          </div>
        )}
      </AnimatePresence>

      {history.length > 1 && (
        <section className="space-y-6">
          <h3 className="text-2xl font-black text-neutral-900 flex items-center gap-2">
            <History className="w-6 h-6 text-neutral-400" /> Previous Predictions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {history.slice(1).map((p) => (
              <button
                key={p.id}
                onClick={() => setPrediction(p)}
                className="p-6 bg-white border border-neutral-100 rounded-[32px] text-left hover:border-indigo-200 hover:shadow-lg transition-all group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                    {new Date(p.generatedAt).toLocaleDateString()}
                  </span>
                </div>
                <h4 className="font-black text-neutral-900 mb-1">{p.examName}</h4>
                <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest">
                  {p.predictedQuestions.length} Questions Predicted
                </p>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
