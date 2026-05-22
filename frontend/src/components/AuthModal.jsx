import React, { useState } from 'react';
import { X, Mail, Lock, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { login, register } from '../utils/api';

export default function AuthModal({ isOpen, onClose, onSuccess }) {
  if (!isOpen) return null;

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        // Register first, then automatically log in
        await register(email, password);
        const data = await login(email, password);
        onSuccess(data.access_token);
      } else {
        const data = await login(email, password);
        onSuccess(data.access_token);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'An authentication error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-zinc-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-md p-8 glass-panel animate-in fade-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute p-1.5 transition-colors rounded-lg top-4 right-4 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Heading */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 mb-3 bg-violet-500/10 border border-violet-500/30 rounded-xl text-violet-400">
            📈
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white font-sans">
            {isRegister ? 'Create an Account' : 'Welcome Back'}
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            {isRegister 
              ? 'Join to customize watchlists and preferences' 
              : 'Sign in to access your persistent stock deck'}
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="flex items-start gap-3 p-3.5 mb-5 border border-rose-500/20 bg-rose-500/10 rounded-xl text-rose-400 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-zinc-400 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 glass-input font-sans text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-zinc-400 mb-1.5">
              Password
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-11 glass-input font-sans text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full glass-btn-primary py-2.5 flex items-center justify-center font-sans mt-2"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
            ) : (
              isRegister ? 'Sign Up' : 'Sign In'
            )}
          </button>
        </form>

        {/* Footer Toggle */}
        <div className="mt-6 text-center text-sm text-zinc-400">
          <span>{isRegister ? 'Already have an account? ' : "Don't have an account? "}</span>
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
            }}
            className="font-medium text-violet-400 hover:text-violet-300 underline underline-offset-4"
          >
            {isRegister ? 'Sign In' : 'Sign Up'}
          </button>
        </div>

      </div>
    </div>
  );
}
