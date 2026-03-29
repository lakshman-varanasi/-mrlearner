import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, BarChart2, Settings, LogOut, Menu, X,
  Calendar, GraduationCap, Sparkles, ChevronDown
} from 'lucide-react';
import { auth } from '../firebase';
import { useAuth } from './FirebaseProvider';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LayoutProps {
  children: React.ReactNode;
}

const primaryNav = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Exams', href: '/exams', icon: Calendar },
  { name: 'Mr. Learner', href: '/learner', icon: GraduationCap },
  { name: 'Mr. Tester', href: '/tester', icon: Sparkles },
  { name: 'Analytics', href: '/analytics', icon: BarChart2 },
];

const secondaryNav = [
  { name: 'Exam Prediction', href: '/exam-prediction', icon: BookOpen },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [showMore, setShowMore] = React.useState(false);

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/');
  };

  const allNav = [...primaryNav, ...secondaryNav];

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col md:flex-row">
      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex flex-col w-60 bg-white border-r border-neutral-200 p-5">
        <div className="flex items-center gap-2 mb-8 px-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">L</div>
          <span className="font-bold text-lg tracking-tight">LearnAI</span>
        </div>

        <nav className="flex-1 space-y-0.5">
          <p className="px-3 text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">Main</p>
          {primaryNav.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  isActive ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}

          <p className="px-3 text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-5 mb-2">More</p>
          {secondaryNav.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  isActive ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-5 border-t border-neutral-100">
          <div className="flex items-center gap-3 px-3 py-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-xs">
              {profile?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-neutral-900 truncate">{profile?.displayName || 'User'}</p>
              <p className="text-xs text-neutral-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full text-left rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden bg-white border-b border-neutral-200 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">L</div>
          <span className="font-bold text-base tracking-tight">LearnAI</span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-neutral-500 hover:bg-neutral-100 rounded-lg"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-white z-40 pt-14 overflow-y-auto">
          <nav className="p-5 space-y-1">
            <p className="px-3 text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">Main</p>
            {primaryNav.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-4 px-4 py-3 rounded-2xl text-base font-medium transition-colors',
                    isActive ? 'bg-indigo-50 text-indigo-700' : 'text-neutral-600 hover:bg-neutral-100'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
            <p className="px-3 text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-5 mb-2">More</p>
            {secondaryNav.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-4 px-4 py-3 rounded-2xl text-base font-medium transition-colors',
                    isActive ? 'bg-indigo-50 text-indigo-700' : 'text-neutral-600 hover:bg-neutral-100'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
            <div className="pt-4 border-t border-neutral-100 mt-4">
              <div className="flex items-center gap-3 px-4 py-3 mb-2">
                <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-sm">
                  {profile?.displayName?.[0]?.toUpperCase() || 'U'}
                </div>
                <div>
                  <p className="font-semibold text-neutral-900 text-sm">{profile?.displayName || 'User'}</p>
                  <p className="text-xs text-neutral-400">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-4 px-4 py-3 w-full text-left rounded-2xl text-base font-medium text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </div>
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          {children}
        </div>
      </main>

      {/* Bottom Nav (Mobile) — 5 primary items only */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 px-2 py-2 flex justify-around items-center z-30">
        {primaryNav.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl',
                isActive ? 'text-indigo-600' : 'text-neutral-400'
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[9px] font-semibold">{item.name.split(' ').pop()}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
