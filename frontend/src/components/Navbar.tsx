import React, { useState } from 'react';
import {
  ShieldCheck,
  Menu,
  X,
  LogIn,
  UserPlus,
  LogOut,
  LayoutDashboard,
  QrCode,
  ChevronDown
} from 'lucide-react';
import { UserProfile } from '../types';

interface NavbarProps {
  currentUser: UserProfile | null;
  activeView: string;
  onNavigate: (view: string) => void;
  onLogout: () => void;
  onOpenVerify: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  activeView,
  onNavigate,
  onLogout,
  onOpenVerify
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const getPortalView = (user: UserProfile) => {
    const role = user.role?.toUpperCase();
    if (role === 'CENTRAL_ADMIN' || role === 'ADMIN') return 'admin';
    if (role === 'DEPARTMENT_HEAD') return 'department';
    return 'personnel';
  };

  const getRoleLabel = (user: UserProfile) => {
    const role = user.role?.toUpperCase();
    if (role === 'CENTRAL_ADMIN' || role === 'ADMIN') return 'Central Admin';
    if (role === 'DEPARTMENT_HEAD') return 'Department Head';
    return user.rank || 'Personnel';
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] shadow-subtle no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          {/* Logo & Brand Name */}
          <div
            className="flex items-center gap-3.5 cursor-pointer group select-none"
            onClick={() => onNavigate('home')}
          >
            <div className="w-10 h-10 rounded-lg bg-[#14243A] flex items-center justify-center text-[#B99A62] shadow-sm group-hover:bg-[#0C1728] transition-colors">
              <ShieldCheck className="w-6 h-6 text-[#B99A62]" strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-[#14243A]">
                  SEVA PASS
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#14243A]/5 text-[#64748B] border border-[#14243A]/10">
                  Digital Service
                </span>
              </div>
              <p className="text-xs text-[#64748B] hidden sm:block font-normal">
                Military Toll Exemption Authorisation
              </p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8">
            <button
              onClick={() => onNavigate('home')}
              className={`text-sm font-medium transition-colors ${
                activeView === 'home'
                  ? 'text-[#14243A] font-semibold'
                  : 'text-[#64748B] hover:text-[#14243A]'
              }`}
            >
              Home
            </button>
            <a
              href="#how-it-works"
              onClick={(e) => {
                if (activeView !== 'home') {
                  e.preventDefault();
                  onNavigate('home');
                  setTimeout(() => {
                    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                }
              }}
              className="text-sm font-medium text-[#64748B] hover:text-[#14243A] transition-colors"
            >
              How It Works
            </a>
            <a
              href="#benefits"
              onClick={(e) => {
                if (activeView !== 'home') {
                  e.preventDefault();
                  onNavigate('home');
                  setTimeout(() => {
                    document.getElementById('benefits')?.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                }
              }}
              className="text-sm font-medium text-[#64748B] hover:text-[#14243A] transition-colors"
            >
              Benefits
            </a>
            <a
              href="#help"
              onClick={(e) => {
                if (activeView !== 'home') {
                  e.preventDefault();
                  onNavigate('home');
                  setTimeout(() => {
                    document.getElementById('help')?.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                }
              }}
              className="text-sm font-medium text-[#64748B] hover:text-[#14243A] transition-colors"
            >
              Help & Notice
            </a>
          </nav>

          {/* Action CTAs */}
          <div className="hidden md:flex items-center gap-3">
            {/* Primary Action: Verify a Pass */}
            <button
              onClick={onOpenVerify}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#F7F7F3] text-[#14243A] border border-[#CBD5E1] hover:border-[#B99A62] hover:bg-white transition-all shadow-xs"
            >
              <QrCode className="w-4 h-4 text-[#B99A62]" />
              <span>Verify a Pass</span>
            </button>

            {currentUser ? (
              <div className="relative">
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] hover:bg-slate-50 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-[#14243A] text-white flex items-center justify-center text-xs font-bold">
                    {currentUser.full_name?.charAt(0) || 'U'}
                  </div>
                  <div className="text-left text-xs">
                    <p className="font-semibold text-[#14243A] leading-tight">
                      {currentUser.full_name?.split(' ')[0]}
                    </p>
                    <p className="text-[10px] text-[#64748B]">{getRoleLabel(currentUser)}</p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-elevated border border-[#E2E8F0] py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-4 py-2 border-b border-[#F1F5F9]">
                      <p className="text-xs font-semibold text-[#14243A] truncate">
                        {currentUser.full_name}
                      </p>
                      <p className="text-[11px] text-[#64748B] truncate">{currentUser.email}</p>
                      {currentUser.department_name && (
                        <p className="text-[10px] text-[#B99A62] mt-0.5 font-medium truncate">
                          {currentUser.department_name}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        onNavigate(getPortalView(currentUser));
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-xs text-[#14243A] hover:bg-[#F7F7F3] transition-colors text-left"
                    >
                      <LayoutDashboard className="w-4 h-4 text-[#64748B]" />
                      <span>Open My Portal</span>
                    </button>

                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-xs text-[#C44747] hover:bg-red-50 transition-colors text-left"
                    >
                      <LogOut className="w-4 h-4 text-[#C44747]" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onNavigate('login')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-[#14243A] hover:bg-[#F7F7F3] transition-colors"
                >
                  <LogIn className="w-3.5 h-3.5 text-[#64748B]" />
                  <span>Sign In</span>
                </button>
                <button
                  onClick={() => onNavigate('register')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#14243A] text-white hover:bg-[#0C1728] transition-colors shadow-xs"
                >
                  <UserPlus className="w-3.5 h-3.5 text-[#B99A62]" />
                  <span>Create Account</span>
                </button>
              </div>
            )}
          </div>

          {/* Mobile menu trigger */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={onOpenVerify}
              className="p-2 text-[#14243A] rounded-lg border border-[#E2E8F0]"
              title="Verify a Pass"
            >
              <QrCode className="w-5 h-5 text-[#B99A62]" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-[#14243A] hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-[#E2E8F0] space-y-3">
            <div className="flex flex-col space-y-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigate('home');
                }}
                className="text-left px-3 py-2 text-sm font-medium text-[#14243A]"
              >
                Home
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenVerify();
                }}
                className="text-left px-3 py-2 text-sm font-medium text-[#B99A62] font-semibold"
              >
                Verify a Pass
              </button>
              {currentUser ? (
                <>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onNavigate(getPortalView(currentUser));
                    }}
                    className="text-left px-3 py-2 text-sm font-medium text-[#14243A]"
                  >
                    My Portal ({currentUser.full_name})
                  </button>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onLogout();
                    }}
                    className="text-left px-3 py-2 text-sm font-medium text-[#C44747]"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <div className="pt-2 flex flex-col gap-2">
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onNavigate('login');
                    }}
                    className="w-full text-center py-2.5 rounded-lg text-sm font-medium border border-[#E2E8F0] text-[#14243A]"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onNavigate('register');
                    }}
                    className="w-full text-center py-2.5 rounded-lg text-sm font-medium bg-[#14243A] text-white"
                  >
                    Create Account
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
