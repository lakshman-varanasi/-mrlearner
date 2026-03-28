import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { FirebaseProvider, useAuth } from './components/FirebaseProvider';
import { Layout } from './components/Layout';
import { Landing } from './pages/Landing';
import { Dashboard } from './pages/Dashboard';
import { AuthPage } from './pages/Auth';
import { ModeSelection } from './pages/ModeSelection';
import { ExamCalendar } from './pages/ExamCalendar';
import { TutorMode } from './pages/TutorMode';
import { ThinkerMode } from './pages/ThinkerMode';
import { MrTesterMode } from './pages/MrTesterMode';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, loading } = useAuth();

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-neutral-50">
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!user) return <Navigate to="/signin" />;

  // Redirect to mode selection if not set
  if (profile && !profile.learningMode && window.location.pathname !== '/select-mode') {
    return <Navigate to="/select-mode" />;
  }

  return <Layout>{children}</Layout>;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" />;

  return <>{children}</>;
};

// Placeholder Pages
const PlanPage = () => (
  <div className="py-10">
    <h1 className="text-4xl font-black mb-8">Study Plan</h1>
    <div className="bg-white p-12 rounded-[40px] border border-neutral-200 text-center">
      <p className="text-neutral-500">Full calendar view and plan editing coming soon.</p>
    </div>
  </div>
);

const AnalyticsPage = () => (
  <div className="py-10">
    <h1 className="text-4xl font-black mb-8">Analytics</h1>
    <div className="bg-white p-12 rounded-[40px] border border-neutral-200 text-center">
      <p className="text-neutral-500">Detailed progress charts and streak history coming soon.</p>
    </div>
  </div>
);

const SettingsPage = () => (
  <div className="py-10">
    <h1 className="text-4xl font-black mb-8">Settings</h1>
    <div className="bg-white p-12 rounded-[40px] border border-neutral-200 text-center">
      <p className="text-neutral-500">Profile and notification settings coming soon.</p>
    </div>
  </div>
);

export default function App() {
  return (
    <FirebaseProvider>
      <Router>
        <Routes>
          <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
          <Route path="/signin" element={<PublicRoute><AuthPage mode="signin" /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><AuthPage mode="signup" /></PublicRoute>} />
          
          <Route path="/select-mode" element={
            <ProtectedRoute>
              <ModeSelection />
            </ProtectedRoute>
          } />

          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/exams" element={<ProtectedRoute><ExamCalendar /></ProtectedRoute>} />
          <Route path="/tutor" element={<ProtectedRoute><TutorMode /></ProtectedRoute>} />
          <Route path="/thinker" element={<ProtectedRoute><ThinkerMode /></ProtectedRoute>} />
          <Route path="/tester" element={<ProtectedRoute><MrTesterMode /></ProtectedRoute>} />
          <Route path="/plan" element={<ProtectedRoute><PlanPage /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </FirebaseProvider>
  );
}
