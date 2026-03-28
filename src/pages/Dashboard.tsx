import React, { useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit, doc, updateDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../components/FirebaseProvider';
import { Task, StudyPlan, Activity } from '../types';
import { TaskCard } from '../components/TaskCard';
import { StudyPlanGenerator } from '../components/StudyPlanGenerator';
import { format, startOfToday, isBefore, parseISO } from 'date-fns';
import { Flame, Trophy, Calendar, ChevronRight, Sparkles, AlertTriangle, GraduationCap, Brain, Zap, History, Star } from 'lucide-react';
import { motion } from 'motion/react';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { calculateLevel, getXPForNextLevel, getProgressToNextLevel, LEVEL_THRESHOLDS } from '../lib/xp-utils';

export const Dashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [plans, setPlans] = React.useState<StudyPlan[]>([]);
  const [loading, setLoading] = React.useState(true);

  const todayStr = format(startOfToday(), 'yyyy-MM-dd');

  useEffect(() => {
    if (!user) return;

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

    // Check for missed tasks from yesterday and auto-reschedule (Simplified logic)
    const checkMissedTasks = async () => {
      const qMissed = query(
        collection(db, 'tasks'),
        where('uid', '==', user.uid),
        where('status', '==', 'pending')
      );
      const snap = await getDocs(qMissed).catch(err => handleFirestoreError(err, OperationType.GET, 'tasks'));
      if (!snap) return;
      
      const batch = writeBatch(db);
      let count = 0;

      snap.docs.forEach(d => {
        const task = d.data() as Task;
        if (isBefore(parseISO(task.date), startOfToday())) {
          // Mark as missed
          batch.update(d.ref, { status: 'missed' });
          count++;
        }
      });

      if (count > 0) await batch.commit().catch(err => handleFirestoreError(err, OperationType.WRITE, 'tasks/batch'));
    };

    checkMissedTasks();

    return () => {
      unsubPlans();
      unsubTasks();
    };
  }, [user, todayStr]);

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
      {/* Welcome Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-neutral-900">
            Hey, {profile?.displayName?.split(' ')[0] || 'Learner'}! 👋
          </h1>
          <p className="text-neutral-500 mt-2 text-lg">
            {tasks.length > 0 
              ? `You have ${tasks.length - completedCount} tasks left for today.` 
              : "No tasks scheduled for today. Ready to start something new?"}
          </p>
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
            {/* Decorative elements */}
            <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl" />
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Zap className="w-32 h-32 text-indigo-400" />
            </div>
          </section>

          {/* Today's Progress */}
          <section className="bg-indigo-600 rounded-[40px] p-8 text-white relative overflow-hidden shadow-xl shadow-indigo-100">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold">Today's Tasks</h2>
                <span className="text-4xl font-black">{progress}%</span>
              </div>
              <div className="w-full bg-indigo-500/50 h-4 rounded-full overflow-hidden mb-6">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="h-full bg-white rounded-full"
                />
              </div>
              <p className="text-indigo-100 font-medium">
                {progress === 100 
                  ? "Amazing! You've crushed all your tasks today. 🚀" 
                  : progress > 50 
                    ? "More than halfway there! Keep that momentum. 🔥" 
                    : "Every small step counts. Let's get to work! 💪"}
              </p>
            </div>
            {/* Decorative circles */}
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          </section>

          {/* Tasks List */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
                Task List
                <span className="text-sm font-medium text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">
                  {tasks.length}
                </span>
              </h2>
              <button className="text-sm font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                View Calendar <ChevronRight className="w-4 h-4" />
              </button>
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
                  You haven't scheduled anything for today. Use the AI generator to build a plan.
                </p>
              </div>
            )}
          </section>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-10">
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

          {/* Active Plans */}
          <section className="bg-white rounded-[40px] p-8 border border-neutral-200 shadow-sm">
            <h2 className="text-xl font-bold text-neutral-900 mb-6">Active Plans</h2>
            <div className="space-y-4">
              {plans.length > 0 ? (
                plans.map(plan => (
                  <div key={plan.id} className="p-4 rounded-2xl bg-neutral-50 border border-neutral-100 group cursor-pointer hover:border-indigo-200 transition-all">
                    <h4 className="font-bold text-neutral-900 group-hover:text-indigo-600 transition-colors">{plan.title}</h4>
                    <p className="text-xs text-neutral-500 mt-1">Ends {format(parseISO(plan.endDate), 'MMM d, yyyy')}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-neutral-400 italic">No active plans yet.</p>
              )}
            </div>
          </section>

          {/* AI Generator Trigger */}
          <StudyPlanGenerator mode={profile?.learningMode} />

          {/* Quick Stats */}
          <section className="bg-neutral-900 rounded-[40px] p-8 text-white">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-neutral-800 rounded-xl text-indigo-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold">AI Insights</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-neutral-800/50">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-neutral-300 leading-relaxed">
                  You've missed 2 tasks this week. Would you like me to reschedule them for the weekend?
                </p>
              </div>
              <button className="w-full py-3 bg-indigo-600 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all">
                Reschedule Missed Tasks
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
