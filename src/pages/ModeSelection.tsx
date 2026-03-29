import React from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/FirebaseProvider';
import { GraduationCap, Brain, ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

export const ModeSelection: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const selectMode = async (mode: 'learner' | 'tester') => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        learningMode: mode
      });
      navigate('/dashboard');
    } catch (error) {
      console.error('Error selecting mode:', error);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-sm font-bold uppercase tracking-wider"
          >
            <Sparkles className="w-4 h-4" />
            Personalize Your Experience
          </motion.div>
          <h1 className="text-5xl font-black tracking-tight text-neutral-900 mb-4">
            Choose Your Learning Mode
          </h1>
          <p className="text-xl text-neutral-500 max-w-2xl mx-auto">
            Our AI adapts to your goals. Select the mode that best fits your current needs.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {/* Mr. Learner */}
          <motion.button
            whileHover={{ y: -8 }}
            onClick={() => selectMode('learner')}
            className="group bg-white p-10 rounded-[48px] border-2 border-transparent hover:border-indigo-600 shadow-xl shadow-neutral-200/50 text-left transition-all"
          >
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-8 group-hover:scale-110 transition-transform">
              <GraduationCap className="w-8 h-8" />
            </div>
            <h2 className="text-3xl font-black text-neutral-900 mb-4">Mr. Learner</h2>
            <p className="text-lg text-neutral-500 mb-8 leading-relaxed">
              Your unified AI mentor. Ask questions, solve doubts, and follow a personalized study plan for any exam.
            </p>
            <div className="flex items-center justify-between">
              <span className="px-4 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-widest">Unified Learning</span>
              <div className="w-12 h-12 bg-neutral-900 text-white rounded-full flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                <ArrowRight className="w-6 h-6" />
              </div>
            </div>
          </motion.button>

          {/* Mr. Tester */}
          <motion.button
            whileHover={{ y: -8 }}
            onClick={() => selectMode('tester')}
            className="group bg-white p-10 rounded-[48px] border-2 border-transparent hover:border-amber-600 shadow-xl shadow-neutral-200/50 text-left transition-all"
          >
            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 mb-8 group-hover:scale-110 transition-transform">
              <Sparkles className="w-8 h-8" />
            </div>
            <h2 className="text-3xl font-black text-neutral-900 mb-4">Mr. Tester</h2>
            <p className="text-lg text-neutral-500 mb-8 leading-relaxed">
              Assessment mode. Generate personalized tests, evaluate your performance, and get feedback.
            </p>
            <div className="flex items-center justify-between">
              <span className="px-4 py-1.5 bg-amber-50 text-amber-700 rounded-full text-xs font-bold uppercase tracking-widest">Assessment</span>
              <div className="w-12 h-12 bg-neutral-900 text-white rounded-full flex items-center justify-center group-hover:bg-amber-600 transition-colors">
                <ArrowRight className="w-6 h-6" />
              </div>
            </div>
          </motion.button>
        </div>

        <p className="text-center mt-12 text-neutral-400 font-medium">
          You can change your mode anytime in settings.
        </p>
      </div>
    </div>
  );
};
