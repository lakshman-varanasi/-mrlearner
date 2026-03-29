import React, { useState } from 'react';
import { useAuth } from '../components/FirebaseProvider';
import { auth, db } from '../firebase';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { User, Lock, Loader2, CheckCircle2, AlertCircle, LogOut, Edit2, Calendar } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export const Settings: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newUsername, setNewUsername] = useState(profile?.username || '');
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [usernameSuccess, setUsernameSuccess] = useState('');

  const handleUsernameUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    if (newUsername === profile.username) return;

    setUsernameLoading(true);
    setUsernameError('');
    setUsernameSuccess('');

    try {
      // Check 14-day restriction
      if (profile.lastUsernameUpdate) {
        const lastUpdate = parseISO(profile.lastUsernameUpdate);
        const daysSinceUpdate = differenceInDays(new Date(), lastUpdate);
        if (daysSinceUpdate < 14) {
          throw new Error(`You can update your username after ${14 - daysSinceUpdate} more days.`);
        }
      }

      // Check uniqueness
      const q = query(collection(db, 'users'), where('username', '==', newUsername));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        throw new Error('Username is already taken.');
      }

      // Update username
      await updateDoc(doc(db, 'users', user.uid), {
        username: newUsername,
        lastUsernameUpdate: new Date().toISOString()
      });

      setUsernameSuccess('Username updated successfully!');
    } catch (err: any) {
      setUsernameError(err.message || 'Failed to update username.');
    } finally {
      setUsernameLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/signin');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.email) return;
    
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Re-authenticate user first
      const credential = EmailAuthProvider.credential(user.email, oldPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Update password
      await updatePassword(user, newPassword);
      setSuccess('Password updated successfully!');
      setOldPassword('');
      setNewPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to update password. Check your old password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-6">
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-4xl font-black text-neutral-900">Settings</h1>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-6 py-3 bg-rose-50 text-rose-600 rounded-2xl font-black hover:bg-rose-100 transition-all border border-rose-100"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>

      <div className="space-y-8">
        {/* Profile Section */}
        <section className="bg-white p-10 rounded-[40px] border border-neutral-200 shadow-sm">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
              <User className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-neutral-900">Profile Information</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <form onSubmit={handleUsernameUpdate} className="space-y-4">
              <label className="block text-sm font-bold text-neutral-400 uppercase tracking-widest mb-2">Username</label>
              <div className="relative">
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full p-4 pl-12 rounded-2xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-neutral-900"
                  placeholder="new_username"
                />
                <Edit2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
              </div>
              
              {usernameError && (
                <div className="p-3 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {usernameError}
                </div>
              )}
              {usernameSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  {usernameSuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={usernameLoading || newUsername === profile?.username}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-sm"
              >
                {usernameLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Username'}
              </button>

              {profile?.lastUsernameUpdate && (
                <p className="text-[10px] text-neutral-400 font-bold flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Last updated: {new Date(profile.lastUsernameUpdate).toLocaleDateString()}
                </p>
              )}
            </form>
            <div>
              <label className="block text-sm font-bold text-neutral-400 uppercase tracking-widest mb-2">Email Address</label>
              <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 font-bold text-neutral-900">
                {user?.email}
              </div>
            </div>
          </div>
        </section>

        {/* Security Section */}
        <section className="bg-white p-10 rounded-[40px] border border-neutral-200 shadow-sm">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center text-rose-600">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-neutral-900">Security</h2>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-6 max-w-md">
            {error && (
              <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 flex items-center gap-3">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm font-medium">{error}</span>
              </div>
            )}
            {success && (
              <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm font-medium">{success}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-neutral-400 uppercase tracking-widest mb-2">Old Password</label>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full p-4 rounded-2xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-neutral-400 uppercase tracking-widest mb-2">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full p-4 rounded-2xl border border-neutral-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Update Password'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};
