import React from 'react';
import { ChatSession } from '../types';
import { MessageSquare, Plus, Trash2, MoreVertical, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ChatSidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, newTitle: string) => void;
  mode: 'learner';
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onRenameSession,
  mode
}) => {
  return (
    <div className="w-80 bg-neutral-50 border-r border-neutral-200 flex flex-col h-full">
      <div className="p-4">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-3 px-4 py-3 bg-white border-2 border-neutral-200 rounded-2xl font-bold text-neutral-700 hover:border-indigo-600 hover:text-indigo-600 transition-all shadow-sm"
        >
          <Plus className="w-5 h-5" />
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        <div className="text-xs font-bold text-neutral-400 uppercase tracking-widest px-2 mb-2">
          Recent Chats
        </div>
        <AnimatePresence initial={false}>
          {sessions.map((session) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className={`group relative flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer transition-all ${
                currentSessionId === session.id
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                  : 'hover:bg-neutral-100 text-neutral-600'
              }`}
              onClick={() => onSelectSession(session.id)}
            >
              <MessageSquare className={`w-5 h-5 flex-shrink-0 ${currentSessionId === session.id ? 'text-white' : 'text-neutral-400'}`} />
              <span className="flex-1 truncate font-medium text-sm">
                {session.title || 'Untitled Chat'}
              </span>
              
              <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${currentSessionId === session.id ? 'text-white' : 'text-neutral-400'}`}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const newTitle = prompt('Rename chat:', session.title);
                    if (newTitle) onRenameSession(session.id, newTitle);
                  }}
                  className="p-1 hover:bg-black/10 rounded-lg transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Are you sure you want to delete this chat?')) {
                      onDeleteSession(session.id);
                    }
                  }}
                  className="p-1 hover:bg-black/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {sessions.length === 0 && (
          <div className="text-center py-8 px-4">
            <p className="text-sm text-neutral-400 italic">No previous chats found.</p>
          </div>
        )}
      </div>
    </div>
  );
};
