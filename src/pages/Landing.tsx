import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Sparkles, ArrowRight, CheckCircle2, Zap, Target, BarChart3, Brain, GraduationCap } from 'lucide-react';
import { motion } from 'motion/react';

export const Landing: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white text-neutral-900 selection:bg-indigo-100 selection:text-indigo-700">
      {/* Nav */}
      <nav className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">L</div>
          <span className="font-bold text-2xl tracking-tight">LearnAI</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/signin" className="px-6 py-2.5 text-neutral-600 font-semibold hover:text-neutral-900 transition-all">
            Sign In
          </Link>
          <Link to="/signup" className="px-6 py-2.5 bg-neutral-900 text-white rounded-full font-semibold hover:bg-neutral-800 transition-all">
            Create Account
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-32 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-sm font-bold tracking-wide uppercase mb-8 inline-block">
            AI-Powered Learning Platform
          </span>
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] mb-8">
            Build Consistent<br />
            <span className="text-indigo-600">Learning Habits</span> with AI
          </h1>
          <p className="max-w-2xl mx-auto text-xl text-neutral-500 mb-12 leading-relaxed">
            The intelligent learning agent that builds your plan, tracks your progress, and adapts to your goals. Master any subject with consistency.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              to="/signup"
              className="w-full sm:w-auto px-10 py-5 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 hover:scale-105 transition-all flex items-center justify-center gap-2 shadow-xl shadow-indigo-200"
            >
              Get Started
              <ArrowRight className="w-5 h-5" />
            </Link>
            <button className="w-full sm:w-auto px-10 py-5 bg-white text-neutral-900 border-2 border-neutral-100 rounded-2xl font-bold text-lg hover:bg-neutral-50 transition-all">
              See How it Works
            </button>
          </div>
        </motion.div>
      </section>

      {/* About Section */}
      <section className="py-32 bg-neutral-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-20 items-center">
            <div>
              <h2 className="text-4xl font-black tracking-tight mb-8 leading-tight">
                Why consistency is the <span className="text-indigo-600 underline decoration-4 underline-offset-8">secret weapon</span> of learning.
              </h2>
              <div className="space-y-8">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 flex-shrink-0">
                    <Target className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold mb-2">The Problem</h4>
                    <p className="text-neutral-500 leading-relaxed">Students often start with high motivation but fail to stay consistent. Life gets in the way, schedules get missed, and eventually, progress stalls.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 flex-shrink-0">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold mb-2">The AI Solution</h4>
                    <p className="text-neutral-500 leading-relaxed">LearnAI acts as your personal learning agent. It doesn't just give you a plan; it keeps you on it, adjusting dynamically to your life and performance.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-square bg-indigo-600 rounded-[60px] p-12 flex flex-col justify-center text-white shadow-2xl shadow-indigo-200">
                <div className="text-6xl font-black mb-4">85%</div>
                <p className="text-xl font-medium opacity-80 leading-relaxed">of students drop out of online courses within the first 2 weeks due to lack of consistency.</p>
                <div className="mt-12 pt-12 border-t border-white/20">
                  <p className="text-sm font-bold uppercase tracking-widest opacity-60 mb-4">LearnAI Users</p>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    <span className="text-2xl font-bold">3x Higher Completion Rate</span>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white p-6 rounded-[40px] shadow-xl border border-neutral-100 hidden md:block">
                <BarChart3 className="w-full h-full text-indigo-600" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-black tracking-tight mb-4">Everything you need to master anything.</h2>
            <p className="text-xl text-neutral-500">Powerful tools designed to keep you moving forward.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-white p-8 rounded-[40px] border border-neutral-100 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all group">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                <Sparkles className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold mb-3">Personalized Study Plans</h3>
              <p className="text-neutral-500 text-sm leading-relaxed">AI-generated schedules tailored to your specific goals, subjects, and available time.</p>
            </div>
            <div className="bg-white p-8 rounded-[40px] border border-neutral-100 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all group">
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-6 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                <BarChart3 className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold mb-3">Progress Tracking</h3>
              <p className="text-neutral-500 text-sm leading-relaxed">Visualize your learning journey with real-time analytics, streaks, and completion rates.</p>
            </div>
            <div className="bg-white p-8 rounded-[40px] border border-neutral-100 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all group">
              <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 mb-6 group-hover:bg-amber-600 group-hover:text-white transition-all">
                <Zap className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold mb-3">Smart Reminders</h3>
              <p className="text-neutral-500 text-sm leading-relaxed">Intelligent nudges that remind you when you're falling behind, without being annoying.</p>
            </div>
            <div className="bg-white p-8 rounded-[40px] border border-neutral-100 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all group">
              <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 mb-6 group-hover:bg-rose-600 group-hover:text-white transition-all">
                <Brain className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold mb-3">Adaptive Learning Modes</h3>
              <p className="text-neutral-500 text-sm leading-relaxed">Switch between "Mr. Tutor" for exam prep or "Mr. Thinker" for deep conceptual mastery.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-neutral-900 text-white py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-20">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">L</div>
                <span className="font-bold text-2xl tracking-tight">LearnAI</span>
              </div>
              <p className="text-neutral-400 max-w-sm leading-relaxed">Building the future of consistent learning. Join us and master any subject with the power of AI.</p>
            </div>
            <div>
              <h4 className="font-bold mb-6">Platform</h4>
              <ul className="space-y-4 text-neutral-400">
                <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">AI Modes</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-6">Company</h4>
              <ul className="space-y-4 text-neutral-400">
                <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-12 border-t border-white/10 text-center text-neutral-500 text-sm">
            <p>&copy; 2026 LearnAI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
