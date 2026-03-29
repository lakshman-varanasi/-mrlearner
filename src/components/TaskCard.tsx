import React from 'react';
import { CheckCircle2, Circle, Clock, AlertCircle, Play, Brain, BookOpen } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Task } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { addXP, XP_VALUES } from '../lib/xp-utils';
import { Link } from 'react-router-dom';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TaskCardProps {
  task: Task;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task }) => {
  const [loading, setLoading] = React.useState(false);

  const toggleStatus = async () => {
    setLoading(true);
    try {
      const newStatus = task.status === 'completed' ? 'pending' : 'completed';
      await updateDoc(doc(db, 'tasks', task.id), {
        status: newStatus,
        completedAt: newStatus === 'completed' ? new Date().toISOString() : null
      }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `tasks/${task.id}`));

      if (newStatus === 'completed') {
        await addXP(task.uid, XP_VALUES.TASK_COMPLETED, {
          title: `Completed task: ${task.title}`,
          type: 'learning'
        });
      }
    } catch (error) {
      console.error('Error updating task:', error);
    } finally {
      setLoading(false);
    }
  };

  const isCompleted = task.status === 'completed';
  const isMissed = task.status === 'missed';

  return (
    <div 
      className={cn(
        "group p-6 rounded-[32px] border transition-all duration-300 flex items-center gap-5",
        isCompleted 
          ? "bg-emerald-50 border-emerald-100" 
          : isMissed 
            ? "bg-rose-50 border-rose-100" 
            : "bg-white border-neutral-200 hover:border-indigo-200 hover:shadow-xl hover:-translate-y-1"
      )}
    >
      <button 
        onClick={toggleStatus}
        disabled={loading}
        className={cn(
          "flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center transition-all shadow-sm",
          isCompleted 
            ? "bg-emerald-500 text-white" 
            : isMissed 
              ? "bg-rose-500 text-white" 
              : "bg-neutral-50 border-2 border-neutral-100 text-neutral-300 hover:border-indigo-500 hover:text-indigo-500"
        )}
      >
        {isCompleted ? <CheckCircle2 className="w-6 h-6" /> : isMissed ? <AlertCircle className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={cn(
            "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
            task.type === 'test' ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"
          )}>
            {task.type || 'task'}
          </span>
          {task.rescheduled && (
            <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-bold rounded-full uppercase tracking-wider">
              Rescheduled
            </span>
          )}
        </div>
        <h3 className={cn(
          "font-bold text-neutral-900 truncate text-lg",
          isCompleted && "text-emerald-900 line-through opacity-60"
        )}>
          {task.title}
        </h3>
        <div className="flex items-center gap-3 mt-1 text-neutral-500">
          <div className="flex items-center gap-1 text-xs font-medium">
            <Clock className="w-3 h-3" />
            {task.duration} min
          </div>
          {task.topics && task.topics.length > 0 && (
            <div className="flex items-center gap-1 text-xs font-medium truncate">
              <BookOpen className="w-3 h-3" />
              {task.topics.join(', ')}
            </div>
          )}
        </div>
      </div>

      {!isCompleted && !isMissed && (
        <div className="flex items-center gap-3">
          {task.type === 'test' ? (
            <Link
              to={`/tester?planId=${task.planId}&taskId=${task.id}&topics=${encodeURIComponent(task.topics?.join(',') || '')}`}
              className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100"
            >
              <Brain className="w-4 h-4" />
              Take Test
            </Link>
          ) : (
            <Link
              to={`/tutor?topics=${encodeURIComponent(task.topics?.join(',') || task.title)}`}
              className="px-6 py-3 bg-white border-2 border-neutral-100 text-neutral-900 rounded-2xl text-xs font-black uppercase tracking-widest hover:border-indigo-600 hover:text-indigo-600 transition-all flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Start
            </Link>
          )}
        </div>
      )}
    </div>
  );
};
