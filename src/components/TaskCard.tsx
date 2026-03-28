import React from 'react';
import { CheckCircle2, Circle, Clock, AlertCircle } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Task } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { addXP, XP_VALUES } from '../lib/xp-utils';

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
        "group p-5 rounded-3xl border transition-all duration-300 flex items-center gap-4",
        isCompleted 
          ? "bg-emerald-50 border-emerald-100" 
          : isMissed 
            ? "bg-rose-50 border-rose-100" 
            : "bg-white border-neutral-200 hover:border-indigo-200 hover:shadow-md"
      )}
    >
      <button 
        onClick={toggleStatus}
        disabled={loading}
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all",
          isCompleted 
            ? "bg-emerald-500 text-white" 
            : isMissed 
              ? "bg-rose-500 text-white" 
              : "border-2 border-neutral-200 text-neutral-300 hover:border-indigo-500 hover:text-indigo-500"
        )}
      >
        {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : isMissed ? <AlertCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
      </button>

      <div className="flex-1 min-w-0">
        <h3 className={cn(
          "font-semibold text-neutral-900 truncate",
          isCompleted && "text-emerald-900 line-through opacity-60"
        )}>
          {task.title}
        </h3>
        <div className="flex items-center gap-3 mt-1">
          <div className="flex items-center gap-1 text-xs text-neutral-500">
            <Clock className="w-3 h-3" />
            {task.duration} min
          </div>
          {task.rescheduled && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full uppercase tracking-wider">
              Rescheduled
            </span>
          )}
        </div>
      </div>

      {!isCompleted && !isMissed && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={toggleStatus}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
};
