import React from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { collection, addDoc, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './FirebaseProvider';
import { StudyPlan, Task } from '../types';
import { format, addDays, startOfToday } from 'date-fns';
import { Loader2, Sparkles } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

interface StudyPlanGeneratorProps {
  mode?: 'tutor' | 'thinker' | 'tester';
}

export const StudyPlanGenerator: React.FC<StudyPlanGeneratorProps> = ({ mode }) => {
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [goal, setGoal] = React.useState('');
  const [subjects, setSubjects] = React.useState('');
  const [duration, setDuration] = React.useState('7'); // days

  const generatePlan = async () => {
    if (!user || !goal) return;
    setLoading(true);

    const modeInstructions = mode === 'tutor' 
      ? "Focus on exam preparation: highlight important topics, include quick revision sessions, and mock tests."
      : mode === 'tester'
        ? "Focus on assessment: include frequent practice tests, mock exams, and performance evaluation tasks."
        : "Focus on deep learning: emphasize core concepts, deep understanding, and real-world applications.";

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Create a study plan for: ${goal}. Subjects: ${subjects}. Duration: ${duration} days. 
        Learning Mode: ${mode || 'standard'}. ${modeInstructions}
        The plan should be broken down into daily tasks.`,
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
                    duration: { type: Type.INTEGER, description: "Duration in minutes" }
                  },
                  required: ["dayOffset", "title", "duration"]
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
        startDate: format(today, 'yyyy-MM-dd'),
        endDate: format(addDays(today, parseInt(duration)), 'yyyy-MM-dd'),
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
          date: format(addDays(today, task.dayOffset), 'yyyy-MM-dd'),
          duration: task.duration,
          status: 'pending',
          rescheduled: false
        });
      });

      await batch.commit().catch(err => handleFirestoreError(err, OperationType.WRITE, 'tasks/batch'));
      alert('Study plan generated successfully!');
      window.location.reload(); // Refresh to show new plan
    } catch (error) {
      console.error('Error generating plan:', error);
      alert('Failed to generate plan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-8 border border-neutral-200 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600">
          <Sparkles className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-900">AI Plan Generator</h2>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">What do you want to learn?</label>
          <input
            type="text"
            placeholder="e.g. Master React and TypeScript"
            className="w-full px-4 py-3 rounded-2xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">Subjects / Topics (comma separated)</label>
          <input
            type="text"
            placeholder="e.g. Hooks, Props, Types, Generics"
            className="w-full px-4 py-3 rounded-2xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
            value={subjects}
            onChange={(e) => setSubjects(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-2">Duration (days)</label>
          <select
            className="w-full px-4 py-3 rounded-2xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all appearance-none"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          >
            <option value="7">7 Days (Intensive)</option>
            <option value="14">14 Days (Balanced)</option>
            <option value="30">30 Days (Comprehensive)</option>
          </select>
        </div>

        <button
          onClick={generatePlan}
          disabled={loading || !goal}
          className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating your plan...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Generate Study Plan
            </>
          )}
        </button>
      </div>
    </div>
  );
};
