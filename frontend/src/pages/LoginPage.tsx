import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Sparkles,
  LogIn
} from 'lucide-react';
import { api, setAuthToken } from '../services/api';
import { AuthResponse } from '../types';

interface LoginPageProps {
  onLoginSuccess: (authData: AuthResponse) => void;
  onNavigateRegister: () => void;
  onNavigateHome: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onNavigateRegister,
  onNavigateHome
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage('Please enter both your username and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await api.login({
        username_or_email: username.trim(),
        password
      });

      setAuthToken(response.access_token);
      onLoginSuccess(response);
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center py-10 px-4 sm:px-6">
      <div className="w-full max-w-md space-y-6">
        {/* Card */}
        <div className="bg-white rounded-2xl border border-[#CBD5E1] shadow-card p-8 sm:p-10 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div
              className="w-12 h-12 rounded-xl bg-[#14243A] flex items-center justify-center text-[#B99A62] mx-auto shadow-sm cursor-pointer"
              onClick={onNavigateHome}
            >
              <ShieldCheck className="w-6 h-6 text-[#B99A62]" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-[#14243A]">
              Sign in to SEVA PASS
            </h2>
            <p className="text-xs text-[#64748B]">
              Enter your credentials to access your authorised portal.
            </p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-[#C44747] flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form: Exactly 2 fields */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Field 1: Username or Email */}
            <div>
              <label className="text-xs font-semibold text-[#14243A] block mb-1.5">
                Username or Registered Email
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="e.g. priya.sharma"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-xs focus:outline-hidden focus:border-[#14243A] bg-[#F7F7F3]"
                  autoFocus
                />
                <User className="w-4 h-4 text-[#64748B] absolute left-3.5 top-3" />
              </div>
            </div>

            {/* Field 2: Password with Show/Hide toggle */}
            <div>
              <label className="text-xs font-semibold text-[#14243A] block mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[#CBD5E1] text-xs focus:outline-hidden focus:border-[#14243A] bg-[#F7F7F3]"
                />
                <Lock className="w-4 h-4 text-[#64748B] absolute left-3.5 top-3" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-[#64748B] hover:text-[#14243A]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-[#64748B]">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-[#CBD5E1] text-[#14243A] focus:ring-0"
                />
                <span>Remember me</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl font-semibold text-xs bg-[#14243A] text-white hover:bg-[#0C1728] transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              {isLoading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <LogIn className="w-4 h-4 text-[#B99A62]" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* Registration link */}
          <div className="pt-4 border-t border-[#E2E8F0] text-center text-xs text-[#64748B]">
            <span>Are you a military personnel without an account? </span>
            <button
              onClick={onNavigateRegister}
              className="font-semibold text-[#14243A] hover:text-[#B99A62] transition-colors"
            >
              Create Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
