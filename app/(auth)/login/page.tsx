'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, User, Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import { API_BASE } from '@/lib/constants';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please provide both username and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Login failed. Invalid credentials.');
      }

      // Save token and user details to localStorage
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      if (data.sessionExpiresAt) {
        localStorage.setItem('sessionExpiresAt', String(data.sessionExpiresAt));
      }

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center bg-cover bg-center p-4"
      style={{
        backgroundImage: "url('/assets/login.jpg')",
      }}
    >
      {/* Dark overlay with subtle backdrop blur */}
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" />

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl transition-all">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl font-black text-primary-content shadow-lg shadow-primary/30">
            EP
          </div>
          <h1 className="mt-4 text-2xl font-black tracking-tight text-white">Next Planning V3</h1>
          <p className="mt-1 text-xs text-slate-400">
            Epylion Textile & Garment Manufacturing Planning Platform
          </p>
        </div>

        {/* Error notification */}
        {error && (
          <div className="alert alert-error mt-6 text-xs font-semibold py-2.5">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="form-control">
            <label className="label py-1 text-xs font-bold text-slate-300">
              Username or ID
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <User className="h-4 w-4" />
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin"
                className="input input-bordered w-full bg-slate-800/80 pl-10 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none"
                required
                autoFocus
              />
            </div>
          </div>

          <div className="form-control">
            <label className="label py-1 text-xs font-bold text-slate-300">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Lock className="h-4 w-4" />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input input-bordered w-full bg-slate-800/80 pl-10 pr-10 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full font-bold shadow-lg shadow-primary/25 mt-2"
          >
            {loading ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              <>
                <LogIn className="h-4 w-4 mr-1" />
                Sign In to Workspace
              </>
            )}
          </button>
        </form>

        {/* Footer info */}
        <div className="mt-8 border-t border-slate-800 pt-4 text-center">
          <p className="text-[11px] text-slate-500">
            Session credentials automatically expire daily at midnight Dhaka Time (UTC+6).
          </p>
        </div>
      </div>
    </div>
  );
}
