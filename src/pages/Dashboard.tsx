import React, { useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/FirebaseProvider';
import { Task, StudyPlan, Exam, AIInsight, ExamPrediction } from '../types';
import { TaskCard } from '../components/TaskCard';
import { MrPlanner } from '../components/MrPlanner';
import { AIPredictionCard } from '../components/AIPredictionCard';
import { NextStepCard } from '../components/NextStepCard';
import { format, startOfToday, parseISO, differenceInDays } from 'date-fns';
import {
  Flame,
  Trophy,
  Calendar,
  Sparkles,
  AlertCircle,
  Brain,
  Zap,
  Star,
  Bell,
  ArrowRight,
  Target,
  BrainCircuit,
  TrendingUp,
  X,
  BookOpen,
  GraduationCap,
  ChevronRight,
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

    const qPlans = query(collection(db, 'studyPlans'), where('uid', '==', user.uid), orderBy('createdAt', 'desc'), limit(5));
    const unsubPlans = onSnapshot(qPlans, (snap) => {
      setPlans(snap.docs.map(d => ({ id: d.id, ...d.data() } as StudyPlan)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'studyPlans'));

    const qExams = query(collection(db, 'exams'), where('uid', '==', user.uid), orderBy('date', 'asc'));
    const unsubExams = onSnapshot(qExams, (snap) => {
      setExams(snap.docs.map(d => ({ id: d.id, ...d.data() } as Exam)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'exams'));

    const qTasks = query(collection(db, 'tasks'), where('uid', '==', user.uid), where('date', '==', todayStr));
    const unsubTasks = onSnapshot(qTasks, (snap) => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'tasks');
      setLoading(false);
    });

    const qPredictions = query(collection(db, 'examPredictions'), where('uid', '==', user.uid), orderBy('generatedAt', 'desc'), limit(1));
    const unsubPredictions = onSnapshot(qPredictions, (snap) => {
      if (!snap.empty) setPrediction({ id: snap.docs[0].id, ...snap.docs[0].data() } as ExamPrediction);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'examPredictions'));

    const runIntelligence = async () => {
      setIsGeneratingInsights(true);
      const newInsights = await generateProactiveInsights(user.uid, profile);
      setInsights(newInsights);
      setIsGeneratingInsights(false);
    };
    runIntelligence();

    return () => { unsubPlans(); unsubExams(); unsubTasks(); unsubPredictions(); };
  }, [user?.uid, todayStr]);

  const dismissInsight = (id: string) => setInsights(prev => prev.filter(i => i.id !== id));

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
  const xp = profile?.xp || 0;
  const level = profile?.level || calculateLevel(xp);
  const nextLevelXP = getXPForNextLevel(level);
  const xpProgress = getProgressToNextLevel(xp);
  const motivationalMessage = insights.find(i => i.type === 'motivation')?.content;
  const urgentInsights = insights.filter(i => i.type === 'alert' || (i.type === 'prediction' && i.priority === 'high'));

  // Recommendations
  const upcomingExams = exams
    .map(e => ({ ...e, daysLeft: differenceInDays(parseISO(e.date), startOfToday()) }))
    .filter(e => e.daysLeft >= 0 && e.daysLeft <= 30)
    .slice(0, 3);

  const recommendations: { title: string; subtitle: string; href: string; icon: React.ReactNode; tag: string }[] = [];
  if (plans.some(p => (p.progress || 0) < 100)) {
    const plan = plans.find(p => (p.progress || 0) < 100)!;
    recommendations.push({
      title: plan.title,
      subtitle: `${plan.progress || 0}% complete — keep going`,
      href: '/learner',
      icon: <BookOpen className="w-5 h-5" />,
      tag: 'Study Plan',
    });
  }
  if (upcomingExams.length > 0) {
    recommendations.push({
      title: `Practice test — ${upcomingExams[0].name}`,
      subtitle: `${upcomingExams[0].daysLeft} days left to prepare`,
      href: `/tester?examId=${upcomingExams[0].id}&examName=${encodeURIComponent(upcomingExams[0].name)}`,
      icon: <Brain className="w-5 h-5" />,
      tag: 'Recommended',
    });
  }
  if (tasks.filter(t => t.type === 'learn' && t.status === 'pending').length > 0) {
    recommendations.push({
      title: 'Ask Mr. Learner a question',
      subtitle: 'Get explanations on today\'s topics',
      href: '/learner',
      icon: <GraduationCap className="w-5 h-5" />,
      tag: 'AI Tutor',
    });
  }

  return (
    <div className="space-y-8 pb-20">

      {/* Urgent Alerts */}
      <AnimatePresence>
        {urgentInsights.map((insight) => (
          <motion.div
            key={insight.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className={`p-5 rounded-[24px] border-2 flex items-center justify-between gap-4 ${
              insight.priority === 'high'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${insight.priority === 'high' ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white'}`}>
                {insight.type === 'alert' ? <AlertCircle className="w-5 h-5" /> : <BrainCircuit className="w-5 h-5" />}
              </div>
              <div>
                <h4 className="font-bold text-sm">{insight.title}</h4>
                <p className="text-sm opacity-75">{insight.content}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {insight.actionLabel && (
                <button
                  onClick={() => navigate(insight.actionPath || '/plan')}
                  className={`px-4 py-2 rounded-xl font-bold text-xs ${insight.priority === 'high' ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-amber-600 text-white hover:bg-amber-700'}`}
                >
                  {insight.actionLabel}
                </button>
              )}
              <button onClick={() => dismissInsight(insight.id)} className="p-1.5 hover:bg-black/5 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Greeting */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-neutral-900">
            Hey, {profile?.displayName?.split(' ')[0] || 'Learner'} 👋
          </h1>
          <p className="text-indigo-600 font-semibold mt-1 flex items-center gap-2">
            <Sparkles className="w-4 h-4 fill-current" />
            {motivationalMessage || 'Ready to crush your goals today?'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white px-5 py-2.5 rounded-2xl border border-neutral-200 flex items-center gap-2 shadow-sm">
            <Flame className="w-5 h-5 text-orange-500 fill-orange-500" />
            <div>
              <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Streak</p>
              <p className="text-lg font-bold text-neutral-900">{profile?.streak || 0}d</p>
            </div>
          </div>
          <div className="bg-white px-5 py-2.5 rounded-2xl border border-neutral-200 flex items-center gap-2 shadow-sm">
            <Trophy className="w-5 h-5 text-amber-500" />
            <div>
              <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Level</p>
              <p className="text-lg font-bold text-neutral-900">{level}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Next Step — Primary CTA */}
      <NextStepCard tasks={tasks} plans={plans} exams={exams} displayName={profile?.displayName} />

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-8">

          {/* Today's Tasks */}
          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
                Today's Tasks
                <span className="text-xs font-medium text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">
                  {completedCount}/{tasks.length}
                </span>
              </h2>
              {tasks.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="w-20 bg-neutral-100 h-1.5 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className="h-full bg-indigo-600 rounded-full" />
                  </div>
                  <span className="text-sm font-black text-indigo-600">{progress}%</span>
                </div>
              )}
            </div>

            {tasks.length > 0 ? (
              <div className="space-y-3">
                {tasks.map(task => <TaskCard key={task.id} task={task} />)}
              </div>
            ) : (
              <div className="bg-white border-2 border-dashed border-neutral-200 rounded-[32px] p-10 text-center">
                <div className="w-12 h-12 bg-neutral-50 rounded-2xl flex items-center justify-center text-neutral-300 mx-auto mb-4">
                  <Calendar className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-neutral-900 mb-1">No tasks for today</h3>
                <p className="text-sm text-neutral-500 mb-5 max-w-xs mx-auto">
                  Use Mr. Planner below to generate your first study plan.
                </p>
              </div>
            )}
          </section>

          {/* Mr. Planner */}
          <MrPlanner mode={profile?.learningMode} />

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-neutral-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-500" />
                Recommended for you
              </h2>
              <div className="space-y-3">
                {recommendations.map((rec, i) => (
                  <Link
                    key={i}
                    to={rec.href}
                    className="flex items-center gap-4 p-5 bg-white rounded-[24px] border border-neutral-200 hover:border-indigo-200 hover:shadow-md transition-all group"
                  >
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 flex-shrink-0">
                      {rec.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">{rec.tag}</span>
                      </div>
                      <p className="font-bold text-neutral-900 text-sm truncate">{rec.title}</p>
                      <p className="text-xs text-neutral-500">{rec.subtitle}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-neutral-300 group-hover:text-indigo-500 transition-colors flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* AI Exam Prediction (if exists) */}
          {prediction && (
            <section>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-neutral-900">AI Exam Prediction</h2>
                <Link to="/exam-prediction" className="text-indigo-600 font-bold text-sm flex items-center gap-1 hover:gap-2 transition-all">
                  Full Analysis <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <AIPredictionCard
                prediction={prediction}
                onPractice={() => navigate(`/tester?examId=${prediction.examId}`)}
              />
            </section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* XP Progress */}
          <section className="bg-neutral-900 rounded-[32px] p-6 text-white relative overflow-hidden shadow-xl">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center">
                    <Star className="w-6 h-6 fill-white text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Level {level}</h2>
                    <p className="text-neutral-400 text-xs">Master Learner</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-indigo-400">{xp}</p>
                  <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest">XP</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-neutral-400">To Level {level + 1}</span>
                  <span className="text-indigo-400">{Math.round(xpProgress)}%</span>
                </div>
                <div className="w-full bg-neutral-800 h-3 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${xpProgress}%` }} className="h-full bg-indigo-500 rounded-full" />
                </div>
                <p className="text-[10px] text-neutral-500 text-center">
                  {nextLevelXP === Infinity ? 'Max Level!' : `${nextLevelXP - xp} XP needed`}
                </p>
              </div>
            </div>
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-indigo-600/10 rounded-full blur-3xl" />
          </section>

          {/* Exam Reminders */}
          <section className="bg-white rounded-[32px] p-6 border border-neutral-200 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-rose-50 rounded-xl text-rose-600">
                  <Bell className="w-4 h-4" />
                </div>
                <h2 className="font-bold text-neutral-900">Upcoming Exams</h2>
              </div>
              <Link to="/exams" className="text-xs font-bold text-indigo-600 hover:underline">+ Add</Link>
            </div>
            <div className="space-y-3">
              {exams.length > 0 ? (
                exams.slice(0, 3).map(exam => {
                  const daysLeft = differenceInDays(parseISO(exam.date), startOfToday());
                  if (daysLeft < 0) return null;
                  const isUrgent = daysLeft <= 7;
                  return (
                    <Link
                      key={exam.id}
                      to={`/learner?examId=${exam.id}&examName=${encodeURIComponent(exam.name)}`}
                      className={`block p-4 rounded-2xl border transition-colors ${isUrgent ? 'bg-rose-50 border-rose-100 hover:bg-rose-100' : 'bg-neutral-50 border-neutral-100 hover:bg-neutral-100'}`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-bold text-neutral-900 text-sm">{exam.name}</h4>
                          <p className="text-xs text-neutral-500">{format(parseISO(exam.date), 'MMM d, yyyy')}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${isUrgent ? 'bg-rose-600 text-white' : 'bg-neutral-200 text-neutral-600'}`}>
                          {daysLeft}d
                        </span>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-neutral-400 mb-3">No exams added yet</p>
                  <Link to="/exams" className="text-sm font-bold text-indigo-600 hover:underline">Add your first exam →</Link>
                </div>
              )}
            </div>
          </section>

          {/* Subject Progress */}
          <section className="bg-white rounded-[32px] p-6 border border-neutral-200 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <div className="p-1.5 bg-indigo-50 rounded-xl text-indigo-600">
                <Target className="w-4 h-4" />
              </div>
              <h2 className="font-bold text-neutral-900">Subject Progress</h2>
            </div>
            <div className="space-y-4">
              {plans.length > 0 ? (
                plans.slice(0, 4).map(plan => (
                  <div key={plan.id} className="space-y-1.5">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{plan.subject || 'General'}</p>
                        <h4 className="font-semibold text-neutral-900 text-sm truncate max-w-[140px]">{plan.title}</h4>
                      </div>
                      <span className="text-xs font-black text-indigo-600">{plan.progress || 0}%</span>
                    </div>
                    <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${plan.progress || 0}%` }} className="h-full bg-indigo-600 rounded-full" />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-3">
                  <p className="text-sm text-neutral-400 mb-3">No active study plans</p>
                  <p className="text-xs text-neutral-400">Use Mr. Planner to create one</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
