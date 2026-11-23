import React, { useState } from 'react';
import {
  Sparkles,
  ChevronUp,
  ChevronDown,
  Shield,
  Building2,
  User,
  LogIn,
  KeyRound,
  Info
} from 'lucide-react';
import { DemoAccount, AuthResponse } from '../types';
import { api, setAuthToken } from '../services/api';

interface DemoCredentialsDrawerProps {
  onLoginSuccess: (authData: AuthResponse) => void;
}

export const DemoCredentialsDrawer: React.FC<DemoCredentialsDrawerProps> = ({
  onLoginSuccess
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loadingUser, setLoadingUser] = useState<string | null>(null);

  const demoAccounts: DemoAccount[] = [
    {
      role_label: 'Central Administrator',
      role: 'CENTRAL_ADMIN',
      username: 'admin',
      email: 'admin@sevapass.internal',
      password: '',
      description: 'Platform governance. Administrator access requires manual password entry via the login form.'
    },
    {
      role_label: 'Department Head (Western Command)',
      role: 'DEPARTMENT_HEAD',
      username: 'head.western',
      email: 'head.western@sevapass.internal',
      password: 'WestH3ad#2026$Transit',
      description: 'Reviews journey applications for Western Command, issues Ed25519 digital passes.'
    },
    {
      role_label: 'Department Head (Northern Command)',
      role: 'DEPARTMENT_HEAD',
      username: 'head.northern',
      email: 'head.northern@sevapass.internal',
      password: 'NorthH3ad#2026$Transit',
      description: 'Reviews Northern Command applications and monitors unit movements.'
    },
    {
      role_label: 'Personnel — Major Priya Sharma',
      role: 'PERSONNEL',
      username: 'priya.sharma',
      email: 'priya.sharma@sevapass.internal',
      password: 'PriyaPass#2026$Duty',
      description: 'Holds valid active digital QR pass for Staff SUV 21D 104523X; submits pass requests.'
    },
    {
      role_label: 'Personnel — Lt. Col. Arvind Deshmukh',
      role: 'PERSONNEL',
      username: 'arvind.deshmukh',
      email: 'arvind.deshmukh@sevapass.internal',
      password: 'ArvindPass#2026$Duty',
      description: 'Has pending journey application under Northern Command.'
    }
  ];

  const handleQuickLogin = async (account: DemoAccount) => {
    if (account.role === 'CENTRAL_ADMIN') {
      alert('Security Notice: Central Administrator access requires manual password entry using the password configured in SEVA_ADMIN_PASS.');
      return;
    }
    setLoadingUser(account.username);
    try {
      const resp = await api.login({
        username_or_email: account.username,
        password: account.password
      });
      setAuthToken(resp.access_token);
      onLoginSuccess(resp);
      setIsOpen(false);
    } catch (err: any) {
      alert(`Login failed: ${err.message}`);
    } finally {
      setLoadingUser(null);
    }
  };

  const getRoleIcon = (role: string) => {
    if (role === 'CENTRAL_ADMIN') return <Shield className="w-4 h-4 text-[#B99A62]" />;
    if (role === 'DEPARTMENT_HEAD') return <Building2 className="w-4 h-4 text-[#16865A]" />;
    return <User className="w-4 h-4 text-[#64748B]" />;
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 no-print">
      {/* Floating Pill Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#14243A] text-white shadow-elevated border border-[#B99A62]/40 hover:bg-[#0C1728] transition-all text-xs font-semibold"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#B99A62]" />
          <span>Demo Accounts (1-Click Login)</span>
          <ChevronUp className="w-3.5 h-3.5 text-[#B99A62]" />
        </button>
      )}

      {/* Expanded Modal / Drawer */}
      {isOpen && (
        <div className="w-96 max-w-[calc(100vw-2rem)] bg-white rounded-2xl border border-[#CBD5E1] shadow-premium overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="bg-[#14243A] text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#B99A62]" />
              <h4 className="text-xs font-bold tracking-tight">Evaluator Demo Directory</h4>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md text-white/70 hover:text-white hover:bg-white/10"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 bg-amber-50/70 border-b border-amber-200/60 text-[11px] text-amber-900 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
            <span>
              All identities are synthetic test accounts for demonstration of the authorisation workflow.
            </span>
          </div>

          <div className="p-3 max-h-96 overflow-y-auto space-y-2.5">
            {demoAccounts.map((acc) => (
              <div
                key={acc.username}
                className="p-3 rounded-xl border border-[#E2E8F0] bg-[#F7F7F3] hover:bg-white hover:border-[#CBD5E1] transition-all text-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getRoleIcon(acc.role)}
                    <span className="font-semibold text-[#14243A]">{acc.role_label}</span>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                    {acc.username}
                  </span>
                </div>

                <p className="text-[11px] text-[#64748B] leading-relaxed">
                  {acc.description}
                </p>

                <div className="flex items-center justify-between pt-1 border-t border-[#E2E8F0]">
                  {acc.role === 'CENTRAL_ADMIN' ? (
                    <span className="text-[10px] text-amber-800 font-medium font-mono">
                      pwd: <span className="underline">[Manual entry via SEVA_ADMIN_PASS]</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-[#64748B]">
                      pwd: <span className="text-[#14243A] font-semibold">{acc.password}</span>
                    </span>
                  )}

                  <button
                    onClick={() => handleQuickLogin(acc)}
                    disabled={loadingUser === acc.username}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#14243A] text-white hover:bg-[#0C1728] transition-colors disabled:opacity-50"
                  >
                    <LogIn className="w-3 h-3 text-[#B99A62]" />
                    <span>{acc.role === 'CENTRAL_ADMIN' ? 'Protected' : (loadingUser === acc.username ? 'Signing In...' : 'Log In')}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
