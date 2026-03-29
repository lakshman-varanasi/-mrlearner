import React, { useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit, doc, updateDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/FirebaseProvider';
import { Task, StudyPlan, Activity, Exam, AIInsight, ExamPrediction } from '../types';
import { TaskCard } from '../components/TaskCard';
import { MrPlanner } from '../components/MrPlanner';
import { AIPredictionCard } from '../components/AIPredictionCard';
import { format, startOfToday, isBefore, parseISO, differenceInDays } from 'date-fns';
import { 
  Flame, 
  Trophy, 
  Calendar, 
  ChevronRight, 
  Sparkles, 
  AlertTriangle, 
  GraduationCap, 
  Brain, 
  Zap, 
  History, 
  Star, 
  Bell, 
  ArrowRight, 
  Target, 
  BrainCircuit, 
  Lightbulb, 
  AlertCircle,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { calculateLevel, getXPForNextLevel, getProgressToNextLevel } from '../lib/xp-utils';
import { generateProactiveInsights } from '../lib/intelligence-utils';
import { Link, useNavigate } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [plans, setPlans] = React.useState<StudyPlan[]>([]);
  const [exams, setExams] = React.useState<Exam[]>([]);
  const [insights, setInsights] = React.useState<AIInsight[]>([]);
  const [prediction, setPrediction] = React.useState<ExamPrediction | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [isGeneratingInsights, setIsGeneratingInsights] = React.useState(false);

  const todayStr = format(startOfToday(), 'yyyy-MM-dd');

  useEffect(() => {
    if (!user || !profile) return;

    // Fetch active plans
    const qPlans = query(
      collection(db, 'studyPlans'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubPlans = onSnapshot(qPlans, (snap) => {
      setPlans(snap.docs.map(d => ({ id: d.id, ...d.data() } as StudyPlan)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'studyPlans');
    });

    // Fetch exams for reminders
    const qExams = query(
      collection(db, 'exams'),
      where('uid', '==', user.uid),
      orderBy('date', 'asc')
    );

    const unsubExams = onSnapshot(qExams, (snap) => {
      setExams(snap.docs.map(d => ({ id: d.id, ...d.data() } as Exam)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'exams');
    });

    // Fetch today's tasks
    const qTasks = query(
      collection(db, 'tasks'),
      where('uid', '==', user.uid),
      where('date', '==', todayStr)
    );

    const unsubTasks = onSnapshot(qTasks, (snap) => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'tasks');
      setLoading(false);
    });

    // Fetch latest prediction
    const qPredictions = query(
      collection(db, 'examPredictions'),
      where('uid', '==', user.uid),
      orderBy('generatedAt', 'desc'),
      limit(1)
    );
    const unsubPredictions = onSnapshot(qPredictions, (snap) => {
      if (!snap.empty) {
        setPrediction({ id: snap.docs[0].id, ...snap.docs[0].data() } as ExamPrediction);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'examPredictions');
    });

    // Generate proactive insights
    const runIntelligence = async () => {
      setIsGeneratingInsights(true);
      const newInsights = await generateProactiveInsights(user.uid, profile);
      setInsights(newInsights);
      setIsGeneratingInsights(false);
    };
    runIntelligence();

    return () => {
      unsubPlans();
      unsubExams();
      unsubTasks();
      unsubPredictions();
    };
  }, [user, profile, todayStr]);

  const dismissInsight = (id: string) => {
    setInsights(prev => prev.filter(i => i.id !== id));
  };

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const xp = profile?.xp || 0;
  const level = profile?.level || calculateLevel(xp);
  const nextLevelXP = getXPForNextLevel(level);
  const xpProgress = getProgressToNextLevel(xp);
  const recentActivities = profile?.recentActivity?.slice(-5).reverse() || [];

  return (
    <div className="space-y-10 pb-20">
      {/* AI Intelligence Layer: Proactive Alerts & Insights */}
      <AnimatePresence>
        {insights.length > 0 && (
          <div className="space-y-4">
            {insights.filter(i => i.type === 'alert' || i.type === 'prediction').map((insight) => (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className={`p-6 rounded-[32px] border-2 flex items-center justify-between gap-6 shadow-xl ${
                  insight.priority === 'high' 
                    ? 'bg-rose-50 border-rose-200 text-rose-900' 
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <div className="flex items-center gap-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                    insight.priority === 'high' ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white'
                  }`}>
                    {insight.type === 'alert' ? <AlertCircle className="w-8 h-8" /> : <BrainCircuit className="w-8 h-8" />}
                  </div>
                  <div>
                    <h4 className="text-xl font-black tracking-tight mb-1">{insight.title}</h4>
                    <p className="font-medium opacity-80">{insight.content}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {insight.actionLabel && (
                    <button 
                      onClick={() => navigate(insight.actionPath || '/plan')}
                      className={`px-6 py-3 rounded-xl font-black text-sm transition-all shadow-lg ${
                        insight.priority === 'high' 
                          ? 'bg-rose-600 text-white hover:bg-rose-700' 
                          : 'bg-amber-600 text-white hover:bg-amber-700'
                      }`}
                    >
                      {insight.actionLabel}
                    </button>
                  )}
                  <button 
                    onClick={() => dismissInsight(insight.id)}
                    className="p-2 hover:bg-black/5 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Welcome Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-5xl font-black tracking-tight text-neutral-900">
            Hey, {profile?.displayName?.split(' ')[0] || 'Learner'}! 👋
          </h1>
          {/* Emotional Engagement: Motivational Message */}
          <div className="flex items-center gap-3 text-indigo-600 font-bold text-xl">
            <Sparkles className="w-6 h-6 fill-current" />
            <p>{insights.find(i => i.type === 'motivation')?.content || "Ready to crush your goals today?"}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-white px-6 py-3 rounded-2xl border border-neutral-200 flex items-center gap-3 shadow-sm">
            <Flame className="w-6 h-6 text-orange-500 fill-orange-500" />
            <div>
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Streak</p>
              <p className="text-xl font-bold text-neutral-900">{profile?.streak || 0} Days</p>
            </div>
          </div>
          <div className="bg-white px-6 py-3 rounded-2xl border border-neutral-200 flex items-center gap-3 shadow-sm">
            <Trophy className="w-6 h-6 text-amber-500" />
            <div>
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Level</p>
              <p className="text-xl font-bold text-neutral-900">{level}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-10">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-10">
          {/* Level System Card */}
          <section className="bg-neutral-900 rounded-[40px] p-8 text-white relative overflow-hidden shadow-2xl">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                    <Star className="w-8 h-8 fill-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Level {level}</h2>
                    <p className="text-neutral-400 text-sm font-medium">Master Learner</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black text-indigo-400">{xp}</p>
                  <p className="text-xs text-neutral-500 uppercase font-bold tracking-widest">Total XP</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-neutral-400">Progress to Level {level + 1}</span>
                  <span className="text-indigo-400">{Math.round(xpProgress)}%</span>
                </div>
                <div className="w-full bg-neutral-800 h-4 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${xpProgress}%` }}
                    className="h-full bg-indigo-500 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.5)]"
                  />
                </div>
                <p className="text-xs text-neutral-500 text-center">
                  {nextLevelXP === Infinity ? "Max Level Reached!" : `${nextLevelXP - xp} XP to next level`}
                </p>
              </div>
            </div>
            <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl" />
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Zap className="w-32 h-32 text-indigo-400" />
            </div>
          </section>

          {/* Today's Tasks */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
                Today's Schedule
                <span className="text-sm font-medium text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">
                  {tasks.length}
                </span>
              </h2>
              <div className="flex items-center gap-2">
                <div className="text-right mr-4">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase">Daily Progress</p>
                  <p className="text-sm font-black text-indigo-600">{progress}%</p>
                </div>
                <div className="w-24 bg-neutral-100 h-2 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className="h-full bg-indigo-600 rounded-full"
                  />
                </div>
              </div>
            </div>

            {tasks.length > 0 ? (
              <div className="space-y-4">
                {tasks.map(task => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            ) : (
              <div className="bg-white border-2 border-dashed border-neutral-200 rounded-[40px] p-12 text-center">
                <div className="w-16 h-16 bg-neutral-50 rounded-2xl flex items-center justify-center text-neutral-300 mx-auto mb-4">
                  <Calendar className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-neutral-900 mb-2">No tasks for today</h3>
                <p className="text-neutral-500 max-w-xs mx-auto mb-6">
                  You haven't scheduled anything for today. Use Mr. Planner to build a path.
                </p>
              </div>
            )}
          </section>

          {/* Mr. Planner Integration */}
          <MrPlanner mode={profile?.learningMode} />

          {/* WOW Feature: AI Exam Prediction */}
          {prediction && (
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-black text-neutral-900">AI Exam Prediction</h2>
                <Link to="/exam-prediction" className="text-indigo-600 font-black flex items-center gap-2 hover:gap-3 transition-all">
                  View Full Analysis <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
              <AIPredictionCard 
                prediction={prediction} 
                onPractice={() => navigate(`/tester?examId=${prediction.examId}`)}
              />
            </section>
          )}
        </div>

        {/* Sidebar Column */}
        <div className="space-y-10">
          {/* Exam Reminders (Feature 6) */}
          <section className="bg-white rounded-[40px] p-8 border border-neutral-200 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-rose-50 rounded-xl text-rose-600">
                <Bell className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-neutral-900">Exam Reminders</h2>
            </div>
            <div className="space-y-4">
              {exams.length > 0 ? (
                exams.map(exam => {
                  const daysLeft = differenceInDays(parseISO(exam.date), startOfToday());
                  const isUrgent = daysLeft <= 7;
                  return (
                    <div key={exam.id} className={`p-5 rounded-3xl border ${isUrgent ? 'bg-rose-50 border-rose-100' : 'bg-neutral-50 border-neutral-100'}`}>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-bold text-neutral-900">{exam.name}</h4>
                          <p className="text-xs text-neutral-500">{format(parseISO(exam.date), 'MMM d, yyyy')}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${isUrgent ? 'bg-rose-600 text-white' : 'bg-neutral-200 text-neutral-600'}`}>
                          {daysLeft} Days Left
                        </span>
                      </div>
                      <Link 
                        to={`/learner?examId=${exam.id}&examName=${encodeURIComponent(exam.name)}`}
                        className={`w-full py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${isUrgent ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-white border border-neutral-200 text-neutral-900 hover:bg-neutral-50'}`}
                      >
                        Prepare Here <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-neutral-400 italic">No upcoming exams.</p>
              )}
            </div>
          </section>

          {/* Subject-Level Analytics (Feature 5) */}
          <section className="bg-white rounded-[40px] p-8 border border-neutral-200 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                <Target className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-neutral-900">Subject Progress</h2>
            </div>
            <div className="space-y-6">
              {plans.length > 0 ? (
                plans.map(plan => (
                  <div key={plan.id} className="space-y-2">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{plan.subject || 'General'}</p>
                        <h4 className="font-bold text-neutral-900 text-sm">{plan.title}</h4>
                      </div>
                      <span className="text-xs font-black text-indigo-600">{plan.progress || 0}%</span>
                    </div>
                    <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${plan.progress || 0}%` }}
                        className="h-full bg-indigo-600 rounded-full"
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-neutral-400 italic">No active study plans.</p>
              )}
            </div>
          </section>

          {/* Recent Activity */}
          <section className="bg-white rounded-[40px] p-8 border border-neutral-200 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-neutral-100 rounded-xl text-neutral-600">
                <History className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-neutral-900">Recent Activity</h2>
            </div>
            <div className="space-y-6">
              {recentActivities.length > 0 ? (
                recentActivities.map((activity) => (
                  <div key={activity.id} className="flex gap-4 group">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-neutral-50 flex items-center justify-center text-neutral-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                      {activity.type === 'test' ? <Brain className="w-5 h-5" /> : 
                       activity.type === 'doubt' ? <Sparkles className="w-5 h-5" /> :
                       <Zap className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-neutral-900 truncate">{activity.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-neutral-400 font-medium">
                          {format(parseISO(activity.timestamp), 'MMM d, h:mm a')}
                        </span>
                        <span className="text-[10px] font-black text-indigo-600">+{activity.xpGained} XP</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-neutral-400 italic">No recent activity yet.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
