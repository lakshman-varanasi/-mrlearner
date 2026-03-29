import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GoogleGenAI, Type } from "@google/genai";
import { collection, addDoc, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './FirebaseProvider';
import { StudyPlan, Task } from '../types';
import { format, addDays, startOfToday } from 'date-fns';
import { Loader2, Sparkles, Brain, Target, Clock, BookOpen } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

interface MrPlannerProps {
  mode?: 'learner' | 'tester';
}

export const MrPlanner: React.FC<MrPlannerProps> = ({ mode }) => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = React.useState(false);
  const [goal, setGoal] = React.useState('');
  const [subjects, setSubjects] = React.useState('');
  const [duration, setDuration] = React.useState('7'); // days
  const [difficulty, setDifficulty] = React.useState('medium');

  useEffect(() => {
    const examName = searchParams.get('examName');
    const topics = searchParams.get('topics');
    if (examName) setGoal(`Prepare for ${examName}`);
    if (topics) setSubjects(topics);
  }, [searchParams]);

  const generatePlan = async () => {
    if (!user || !goal) return;
    setLoading(true);

    const modeInstructions = mode === 'learner' 
      ? "Focus on mastery: provide clear explanations, examples, and structured learning paths. Include revision sessions."
      : mode === 'tester'
        ? "Focus on assessment: include frequent practice tests, mock exams, and performance evaluation tasks."
        : "Focus on balanced learning: combine theory with practice.";

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Create a structured study plan for: ${goal}. 
        Topics to cover: ${subjects}. 
        Duration: ${duration} days. 
        Difficulty level: ${difficulty}.
        Learning Mode: ${mode || 'standard'}. ${modeInstructions}
        
        CRITICAL: For EVERY day, you MUST include:
        1. A 'learn' task: Specific topics to study.
        2. A 'test' task: A daily test covering those specific topics.
        
        The plan should be broken down into daily tasks with clear objectives.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              tasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    dayOffset: { type: Type.INTEGER, description: "Days from today (0 for today)" },
                    title: { type: Type.STRING },
                    type: { type: Type.STRING, enum: ["learn", "test"] },
                    duration: { type: Type.INTEGER, description: "Duration in minutes" },
                    topics: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Specific topics for this task" }
                  },
                  required: ["dayOffset", "title", "type", "duration"]
                }
              }
            },
            required: ["title", "tasks"]
          }
        }
      });

      const planData = JSON.parse(response.text);
      const today = startOfToday();

      // Save to Firestore
      const planRef = await addDoc(collection(db, 'studyPlans'), {
        uid: user.uid,
        title: planData.title,
        subject: subjects.split(',')[0].trim() || 'General',
        startDate: format(today, 'yyyy-MM-dd'),
        endDate: format(addDays(today, parseInt(duration)), 'yyyy-MM-dd'),
        streak: 0,
        performance: 0,
        progress: 0,
        createdAt: new Date().toISOString()
      }).catch(err => handleFirestoreError(err, OperationType.CREATE, 'studyPlans'));

      if (!planRef) return;

      const batch = writeBatch(db);
      planData.tasks.forEach((task: any) => {
        const taskRef = doc(collection(db, 'tasks'));
        batch.set(taskRef, {
          uid: user.uid,
          planId: planRef.id,
          title: task.title,
          type: task.type,
          date: format(addDays(today, task.dayOffset), 'yyyy-MM-dd'),
          duration: task.duration,
          topics: task.topics || [],
          status: 'pending',
          rescheduled: false
        });
      });

      await batch.commit().catch(err => handleFirestoreError(err, OperationType.WRITE, 'tasks/batch'));
      alert('Mr. Planner has generated your personalized study plan!');
      window.location.href = '/dashboard';
    } catch (error) {
      console.error('Error generating plan:', error);
      alert('Failed to generate plan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-[40px] p-10 border border-neutral-200 shadow-xl">
      <div className="flex items-center gap-4 mb-10">
        <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
          <Brain className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-3xl font-black text-neutral-900">Mr. Planner</h2>
          <p className="text-neutral-500 font-medium">AI-powered structured learning paths</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-10">
        <div className="space-y-8">
          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-neutral-700 mb-3">
              <Target className="w-4 h-4 text-indigo-600" />
              WHAT IS YOUR GOAL?
            </label>
            <input
              type="text"
              placeholder="e.g. Master Quantum Physics for Finals"
              className="w-full px-6 py-4 rounded-2xl bg-neutral-50 border border-neutral-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-medium"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-neutral-700 mb-3">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              SPECIFIC TOPICS
            </label>
            <textarea
              placeholder="e.g. Wave-particle duality, Schrödinger equation, Quantum tunneling"
              rows={3}
              className="w-full px-6 py-4 rounded-2xl bg-neutral-50 border border-neutral-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-medium resize-none"
              value={subjects}
              onChange={(e) => setSubjects(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-neutral-700 mb-3">
                <Clock className="w-4 h-4 text-indigo-600" />
                DURATION
              </label>
              <select
                className="w-full px-6 py-4 rounded-2xl bg-neutral-50 border border-neutral-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold appearance-none"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              >
                <option value="3">3 Days</option>
                <option value="7">7 Days</option>
                <option value="14">14 Days</option>
                <option value="30">30 Days</option>
              </select>
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-neutral-700 mb-3">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                DIFFICULTY
              </label>
              <select
                className="w-full px-6 py-4 rounded-2xl bg-neutral-50 border border-neutral-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold appearance-none"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option value="easy">Beginner</option>
                <option value="medium">Intermediate</option>
                <option value="hard">Advanced</option>
              </select>
            </div>
          </div>

          <div className="pt-4">
            <button
              onClick={generatePlan}
              disabled={loading || !goal}
              className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-100"
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  MR. PLANNER IS THINKING...
                </>
              ) : (
                <>
                  <Sparkles className="w-6 h-6" />
                  GENERATE STRUCTURED PLAN
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
