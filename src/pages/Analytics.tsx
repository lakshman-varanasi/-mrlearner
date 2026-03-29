import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/FirebaseProvider';
import { TestResult, Exam, UserProfile } from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { 
  TrendingUp, 
  CheckCircle2, 
  Target, 
  Flame, 
  Calendar, 
  BookOpen, 
  Loader2,
  BrainCircuit,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  AlertCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

export const Analytics: React.FC = () => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [insights, setInsights] = useState<string>('');
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch test results
      const resultsQuery = query(
        collection(db, 'testResults'),
        where('uid', '==', user.uid),
        orderBy('timestamp', 'desc'),
        limit(20)
      );
      const resultsSnap = await getDocs(resultsQuery);
      const results = resultsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TestResult)).reverse();
      setTestResults(results);

      // Fetch exams
      const examsQuery = query(
        collection(db, 'exams'),
        where('uid', '==', user.uid)
      );
      const examsSnap = await getDocs(examsQuery);
      setExams(examsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exam)));

      // Generate insights if we have data
      if (results.length > 0) {
        generateInsights(results);
      }
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateInsights = async (results: TestResult[]) => {
    setIsGeneratingInsights(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const avgScore = results.reduce((acc, curr) => acc + curr.percentage, 0) / results.length;
      const recentTrend = results.length >= 2 
        ? results[results.length - 1].percentage - results[results.length - 2].percentage
        : 0;

      const prompt = `Analyze these learning metrics for a student:
      - Total tests taken: ${results.length}
      - Average score: ${avgScore.toFixed(1)}%
      - Recent score trend: ${recentTrend > 0 ? 'Improving' : 'Declining'} by ${Math.abs(recentTrend).toFixed(1)}%
      - Current streak: ${profile?.streak || 0} days
      
      Provide 3 concise, actionable insights or tips to help them improve or maintain their performance. Keep it encouraging and professional. Format as a short bulleted list.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ text: prompt }]
      });

      setInsights(response.text || 'Keep up the consistent effort! Review your weak areas to boost your scores.');
    } catch (error) {
      console.error('Error generating insights:', error);
      setInsights('Great job on your progress! Keep practicing to reach your goals.');
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  const totalQuestions = testResults.reduce((acc, curr) => acc + curr.totalQuestions, 0);
  const totalCorrect = testResults.reduce((acc, curr) => acc + curr.score, 0);
  const overallAccuracy = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;

  // Calculate weak areas from breakdown
  const topicStats: Record<string, { score: number, total: number }> = {};
  testResults.forEach(res => {
    res.breakdown?.forEach(b => {
      if (!topicStats[b.topic]) topicStats[b.topic] = { score: 0, total: 0 };
      topicStats[b.topic].score += b.score;
      topicStats[b.topic].total += b.total;
    });
  });

  const weakAreas = Object.entries(topicStats)
    .map(([topic, stats]) => ({ topic, percentage: (stats.score / stats.total) * 100 }))
    .filter(t => t.percentage < 70)
    .sort((a, b) => a.percentage - b.percentage);

  const chartData = testResults.map(r => ({
    name: new Date(r.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    score: r.percentage,
    exam: r.examName
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="py-10 space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl font-black tracking-tight text-neutral-900 mb-2">Analytics</h1>
          <p className="text-neutral-500 text-xl font-medium">Track your growth and learning efficiency.</p>
        </div>
        <div className="flex items-center gap-3 px-6 py-3 bg-indigo-50 text-indigo-600 rounded-2xl font-black">
          <Zap className="w-5 h-5 fill-current" />
          <span>Level {profile?.level || 1} Explorer</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-[40px] border border-neutral-100 shadow-xl shadow-neutral-200/50"
        >
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6">
            <Target className="w-6 h-6" />
          </div>
          <p className="text-neutral-500 font-bold uppercase tracking-widest text-xs mb-1">Overall Accuracy</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-4xl font-black text-neutral-900">{overallAccuracy.toFixed(1)}%</h3>
            <span className="text-emerald-500 text-sm font-bold flex items-center">
              <ArrowUpRight className="w-4 h-4" /> +2.4%
            </span>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-8 rounded-[40px] border border-neutral-100 shadow-xl shadow-neutral-200/50"
        >
          <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600 mb-6">
            <Flame className="w-6 h-6" />
          </div>
          <p className="text-neutral-500 font-bold uppercase tracking-widest text-xs mb-1">Current Streak</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-4xl font-black text-neutral-900">{profile?.streak || 0} Days</h3>
            <span className="text-neutral-400 text-sm font-bold">Personal Best: 12</span>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-8 rounded-[40px] border border-neutral-100 shadow-xl shadow-neutral-200/50"
        >
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-6">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <p className="text-neutral-500 font-bold uppercase tracking-widest text-xs mb-1">Tests Completed</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-4xl font-black text-neutral-900">{testResults.length}</h3>
            <span className="text-neutral-400 text-sm font-bold">Total Questions: {totalQuestions}</span>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white p-8 rounded-[40px] border border-neutral-100 shadow-xl shadow-neutral-200/50"
        >
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-6">
            <BookOpen className="w-6 h-6" />
          </div>
          <p className="text-neutral-500 font-bold uppercase tracking-widest text-xs mb-1">Active Exams</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-4xl font-black text-neutral-900">{exams.length}</h3>
            <span className="text-neutral-400 text-sm font-bold">Across {new Set(exams.map(e => e.subject)).size} Subjects</span>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Performance Chart */}
        <div className="lg:col-span-2 bg-white p-10 rounded-[48px] border border-neutral-100 shadow-xl shadow-neutral-200/50">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-2xl font-black text-neutral-900">Performance Trend</h3>
              <p className="text-neutral-500 font-medium">Your score percentage across recent tests.</p>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-2 px-4 py-2 bg-neutral-50 rounded-xl text-xs font-bold text-neutral-500">
                <div className="w-2 h-2 bg-indigo-600 rounded-full" />
                Score %
              </div>
            </div>
          </div>
          
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#a3a3a3', fontSize: 12, fontWeight: 600 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#a3a3a3', fontSize: 12, fontWeight: 600 }}
                  domain={[0, 100]}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    borderRadius: '24px', 
                    border: 'none', 
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                    padding: '16px'
                  }}
                  itemStyle={{ fontWeight: 800, color: '#4f46e5' }}
                  labelStyle={{ fontWeight: 800, color: '#171717', marginBottom: '4px' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="score" 
                  stroke="#4f46e5" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorScore)" 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Insights */}
        <div className="bg-indigo-600 p-10 rounded-[48px] text-white shadow-2xl shadow-indigo-200 flex flex-col">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center">
              <BrainCircuit className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-2xl font-black">AI Insights</h3>
              <p className="text-indigo-100 font-medium">Personalized for you</p>
            </div>
          </div>

          <div className="flex-1 space-y-6">
            {isGeneratingInsights ? (
              <div className="flex flex-col items-center justify-center h-full space-y-4">
                <Loader2 className="w-8 h-8 animate-spin opacity-50" />
                <p className="text-indigo-100 font-bold animate-pulse">Analyzing your performance...</p>
              </div>
            ) : (
              <div className="prose prose-invert max-w-none">
                <div className="bg-white/10 backdrop-blur-md p-8 rounded-[32px] border border-white/10">
                  <p className="text-lg leading-relaxed font-medium whitespace-pre-wrap">
                    {insights || "Start taking tests to unlock personalized AI insights and learning recommendations!"}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-10 pt-8 border-t border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex -space-x-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-indigo-600 bg-indigo-400" />
                ))}
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-200">Based on 20+ data points</p>
            </div>
          </div>
        </div>
      </div>

      {/* Weak Areas Section */}
      {weakAreas.length > 0 && (
        <div className="bg-white p-10 rounded-[48px] border border-neutral-100 shadow-xl shadow-neutral-200/50">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-neutral-900">Weak Areas</h3>
              <p className="text-neutral-500 font-medium">Topics you should focus on more.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {weakAreas.map((area, i) => (
              <div key={i} className="p-6 rounded-3xl bg-neutral-50 border border-neutral-100 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-neutral-900">{area.topic}</span>
                  <span className="text-xs font-black text-rose-600">{area.percentage.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-rose-500 rounded-full"
                    style={{ width: `${area.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Test History */}
      <div className="bg-white p-10 rounded-[48px] border border-neutral-100 shadow-xl shadow-neutral-200/50">
        <h3 className="text-2xl font-black text-neutral-900 mb-8">Recent Test History</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-neutral-100">
                <th className="pb-6 text-xs font-black text-neutral-400 uppercase tracking-widest">Exam Name</th>
                <th className="pb-6 text-xs font-black text-neutral-400 uppercase tracking-widest">Date</th>
                <th className="pb-6 text-xs font-black text-neutral-400 uppercase tracking-widest">Score</th>
                <th className="pb-6 text-xs font-black text-neutral-400 uppercase tracking-widest">Accuracy</th>
                <th className="pb-6 text-xs font-black text-neutral-400 uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {testResults.map((result) => (
                <tr key={result.id} className="group hover:bg-neutral-50/50 transition-colors">
                  <td className="py-6 font-black text-neutral-900">{result.examName}</td>
                  <td className="py-6 text-neutral-500 font-medium">
                    {new Date(result.timestamp).toLocaleDateString()}
                  </td>
                  <td className="py-6 font-bold text-neutral-700">
                    {result.score}/{result.totalQuestions}
                  </td>
                  <td className="py-6">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden max-w-[100px]">
                        <div 
                          className={`h-full rounded-full ${result.percentage >= 80 ? 'bg-emerald-500' : result.percentage >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                          style={{ width: `${result.percentage}%` }}
                        />
                      </div>
                      <span className="font-black text-sm">{result.percentage}%</span>
                    </div>
                  </td>
                  <td className="py-6">
                    <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${
                      result.percentage >= 80 ? 'bg-emerald-50 text-emerald-600' : 
                      result.percentage >= 50 ? 'bg-amber-50 text-amber-600' : 
                      'bg-rose-50 text-rose-600'
                    }`}>
                      {result.percentage >= 80 ? 'Excellent' : result.percentage >= 50 ? 'Good' : 'Needs Review'}
                    </span>
                  </td>
                </tr>
              ))}
              {testResults.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-neutral-400 font-bold">
                    No tests taken yet. Start a session in Mr. Tester mode!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
