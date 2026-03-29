import React from 'react';
import { ExamPrediction } from '../types';
import { Sparkles, Target, Zap, HelpCircle, ArrowRight, BrainCircuit, Lightbulb, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';

interface AIPredictionCardProps {
  prediction: ExamPrediction;
  onPractice?: () => void;
}

export const AIPredictionCard: React.FC<AIPredictionCardProps> = ({ prediction, onPractice }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-[48px] border border-neutral-100 shadow-2xl shadow-indigo-100/50 overflow-hidden"
    >
      <div className="bg-indigo-600 p-10 text-white relative overflow-hidden">
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center">
              <Sparkles className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-3xl font-black tracking-tight">🔥 Exam Prediction</h3>
              <p className="text-indigo-100 font-medium">{prediction.examName}</p>
            </div>
          </div>
          <button 
            onClick={onPractice}
            className="px-8 py-4 bg-white text-indigo-600 rounded-2xl font-black flex items-center gap-2 hover:bg-indigo-50 transition-all shadow-xl shadow-indigo-900/20"
          >
            Practice Now <ArrowRight className="w-5 h-5" />
          </button>
        </div>
        <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
      </div>

      <div className="p-10 grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="space-y-8">
          <div>
            <h4 className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Target className="w-4 h-4 text-rose-500" /> Most Likely Questions
            </h4>
            <div className="space-y-4">
              {prediction.predictedQuestions.filter(q => q.weight === 'high').map((q, i) => (
                <div key={i} className="p-6 bg-rose-50 rounded-3xl border border-rose-100 group hover:bg-rose-100 transition-all">
                  <div className="flex items-start gap-4">
                    <span className="w-8 h-8 bg-rose-600 text-white rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-bold text-neutral-900 mb-2 leading-relaxed">{q.question}</p>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-rose-600 bg-white px-2 py-1 rounded-lg border border-rose-200">
                          {q.topic}
                        </span>
                        {q.trick && (
                          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg flex items-center gap-1">
                            <Zap className="w-3 h-3 fill-current" /> Shortcut Available
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-indigo-500" /> Important Topics
            </h4>
            <div className="flex flex-wrap gap-3">
              {prediction.importantTopics.map((topic, i) => (
                <span key={i} className="px-5 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-sm border border-indigo-100">
                  {topic}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-amber-50 p-8 rounded-[40px] border border-amber-100">
            <h4 className="text-xs font-black text-amber-600 uppercase tracking-widest mb-6 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Frequently Confused
            </h4>
            <ul className="space-y-3">
              {prediction.frequentlyConfused.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-amber-900 font-medium">
                  <div className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-2 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-neutral-900 p-8 rounded-[40px] text-white">
            <h4 className="text-xs font-black text-neutral-500 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-400" /> Mentor's Shortcut
            </h4>
            {prediction.predictedQuestions.find(q => q.trick)?.trick ? (
              <div className="space-y-4">
                <p className="text-neutral-300 font-medium leading-relaxed italic">
                  "{prediction.predictedQuestions.find(q => q.trick)?.trick}"
                </p>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                  <p className="text-xs text-neutral-400 font-bold uppercase tracking-widest mb-1">Memory Technique</p>
                  <p className="text-sm text-neutral-200">
                    {prediction.predictedQuestions.find(q => q.memoryTechnique)?.memoryTechnique || "Visualize the process as a story."}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-neutral-400 text-sm">Focus on the core concepts for this exam. No specific shortcuts detected.</p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
