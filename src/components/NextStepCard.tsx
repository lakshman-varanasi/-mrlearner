import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Play, BookOpen, Zap, Calendar, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { Task, StudyPlan, Exam } from '../types';
import { differenceInDays, parseISO, startOfToday } from 'date-fns';

interface NextStepCardProps {
  tasks: Task[];
  plans: StudyPlan[];
  exams: Exam[];
  displayName?: string;
}

interface NextStep {
  icon: React.ReactNode;
  label: string;
  title: string;
  description: string;
  action: string;
  href: string;
  color: 'indigo' | 'amber' | 'green' | 'rose';
}

function getNextStep(tasks: Task[], plans: StudyPlan[], exams: Exam[]): NextStep {
  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const activePlan = plans.find(p => (p.progress || 0) < 100);
  const upcomingExam = exams
    .map(e => ({ ...e, daysLeft: differenceInDays(parseISO(e.date), startOfToday()) }))
    .filter(e => e.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft)[0];

  if (pendingTasks.length > 0) {
    return {
      icon: <Play className="w-6 h-6" />,
      label: 'Recommended for you',
      title: `Start today's task`,
      description: `"${pendingTasks[0].title}" — ${pendingTasks[0].duration} min · ${pendingTasks[0].topics?.slice(0, 2).join(', ') || 'Pick up where you left off'}`,
      action: 'Begin Now',
      href: '/learner',
      color: 'indigo',
    };
  }

  if (upcomingExam && upcomingExam.daysLeft <= 14) {
    return {
      icon: <Zap className="w-6 h-6" />,
      label: 'Based on your schedule',
      title: `Prepare for ${upcomingExam.name}`,
      description: `${upcomingExam.daysLeft} days left — take a practice test or review weak areas now`,
      action: 'Start Test',
      href: `/tester?examId=${upcomingExam.id}&examName=${encodeURIComponent(upcomingExam.name)}`,
      color: 'rose',
    };
  }

  if (activePlan) {
    return {
      icon: <BookOpen className="w-6 h-6" />,
      label: 'Based on your progress',
      title: `Continue your study plan`,
      description: `${activePlan.title} — ${activePlan.progress || 0}% complete · keep the momentum going`,
      action: 'Continue',
      href: '/learner',
      color: 'green',
    };
  }

  if (exams.length === 0) {
    return {
      icon: <Calendar className="w-6 h-6" />,
      label: 'Get started',
      title: 'Add your first exam',
      description: 'Tell us what you\'re preparing for and we\'ll build a personalized plan around it',
      action: 'Add Exam',
      href: '/exams',
      color: 'amber',
    };
  }

  return {
    icon: <Plus className="w-6 h-6" />,
    label: 'Recommended for you',
    title: 'Create a study plan',
    description: 'Use Mr. Planner to generate a smart, day-by-day study plan for your upcoming exam',
    action: 'Create Plan',
    href: '/dashboard',
    color: 'indigo',
  };
}

const colorMap = {
  indigo: {
    bg: 'bg-indigo-600',
    light: 'bg-indigo-50',
    text: 'text-indigo-600',
    btn: 'bg-white text-indigo-600 hover:bg-indigo-50',
    badge: 'bg-indigo-500/20 text-indigo-100',
  },
  amber: {
    bg: 'bg-amber-500',
    light: 'bg-amber-50',
    text: 'text-amber-600',
    btn: 'bg-white text-amber-600 hover:bg-amber-50',
    badge: 'bg-amber-400/20 text-amber-100',
  },
  green: {
    bg: 'bg-emerald-600',
    light: 'bg-emerald-50',
    text: 'text-emerald-600',
    btn: 'bg-white text-emerald-600 hover:bg-emerald-50',
    badge: 'bg-emerald-500/20 text-emerald-100',
  },
  rose: {
    bg: 'bg-rose-600',
    light: 'bg-rose-50',
    text: 'text-rose-600',
    btn: 'bg-white text-rose-600 hover:bg-rose-50',
    badge: 'bg-rose-500/20 text-rose-100',
  },
};

export const NextStepCard: React.FC<NextStepCardProps> = ({ tasks, plans, exams, displayName }) => {
  const navigate = useNavigate();
  const step = getNextStep(tasks, plans, exams);
  const colors = colorMap[step.color];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${colors.bg} rounded-[32px] p-7 text-white shadow-xl`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="flex items-start gap-5">
          <div className={`w-12 h-12 rounded-2xl ${colors.badge} flex items-center justify-center flex-shrink-0 mt-0.5`}>
            {step.icon}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest opacity-70 mb-1">{step.label}</p>
            <h3 className="text-xl font-black tracking-tight mb-1">{step.title}</h3>
            <p className="text-sm opacity-75 leading-relaxed max-w-lg">{step.description}</p>
          </div>
        </div>
        <button
          onClick={() => navigate(step.href)}
          className={`${colors.btn} px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 flex-shrink-0 transition-colors shadow-sm`}
        >
          {step.action}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};
