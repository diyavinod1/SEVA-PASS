import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { PublicVerificationPage } from './pages/PublicVerificationPage';
import { PersonnelPortal } from './pages/personnel/PersonnelPortal';
import { DepartmentHeadPortal } from './pages/dept/DepartmentHeadPortal';
import { CentralAdminPortal } from './pages/admin/CentralAdminPortal';
import { QRScannerModal } from './components/QRScannerModal';
import { DemoCredentialsDrawer } from './components/DemoCredentialsDrawer';
import { UserProfile, AuthResponse } from './types';
import { api, getAuthToken, removeAuthToken, setAuthToken } from './services/api';
import { ShieldCheck, RefreshCw } from 'lucide-react';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeView, setActiveView] = useState<string>('home');
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [directVerifyCode, setDirectVerifyCode] = useState<string>('');

  // Determine correct portal view from user's backend role
  const getPortalViewForUser = (user: UserProfile): string => {
    const role = user.role?.toUpperCase();
    if (role === 'CENTRAL_ADMIN' || role === 'ADMIN') {
      return 'admin';
    }
    if (role === 'DEPARTMENT_HEAD') {
      return 'department';
    }
    return 'personnel';
  };

  const checkCurrentUser = async () => {
    const token = getAuthToken();
    if (!token) {
      setCurrentUser(null);
      setIsLoadingUser(false);
      return;
    }
    try {
      const res = await api.getMe();
      setCurrentUser(res.user);
    } catch (err) {
      console.warn('Session check failed or expired:', err);
      removeAuthToken();
      setCurrentUser(null);
    } finally {
      setIsLoadingUser(false);
    }
  };

  useEffect(() => {
    checkCurrentUser();
  }, []);

  const handleLoginSuccess = (authData: AuthResponse) => {
    setAuthToken(authData.access_token);
    setCurrentUser(authData.user);
    const targetView = getPortalViewForUser(authData.user);
    setActiveView(targetView);
  };

  const handleLogout = () => {
    removeAuthToken();
    setCurrentUser(null);
    setActiveView('home');
  };

  const handleNavigate = (view: string) => {
    // Role protection guards
    if (view === 'admin') {
      if (!currentUser || (currentUser.role !== 'CENTRAL_ADMIN' && (currentUser.role as any) !== 'ADMIN')) {
        setActiveView('login');
        return;
      }
    }
    if (view === 'department') {
      if (!currentUser || (currentUser.role !== 'DEPARTMENT_HEAD' && currentUser.role !== 'CENTRAL_ADMIN')) {
        setActiveView('login');
        return;
      }
    }
    if (view === 'personnel') {
      if (!currentUser) {
        setActiveView('login');
        return;
      }
    }

    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDirectVerify = (code: string) => {
    setDirectVerifyCode(code);
    setActiveView('verify');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleScanResult = (res: { qr_payload?: string; pass_code?: string; scanned_vehicle_reg?: string }) => {
    setIsScannerOpen(false);
    if (res.pass_code) {
      setDirectVerifyCode(res.pass_code);
    }
    setActiveView('verify');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isLoadingUser) {
    return (
      <div className="min-h-screen bg-[#F7F7F3] flex items-center justify-center text-[#14243A]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#14243A] flex items-center justify-center text-[#B99A62] shadow-elevated">
            <RefreshCw className="w-6 h-6 animate-spin text-[#B99A62]" />
          </div>
          <span className="font-semibold text-xs tracking-wider text-[#64748B] uppercase">
            Initialising SEVA PASS Gateway...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F7F3] text-[#14243A] antialiased">
      {/* Universal Navigation Bar */}
      <Navbar
        currentUser={currentUser}
        activeView={activeView}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        onOpenVerify={() => setIsScannerOpen(true)}
      />

      {/* Main View Container */}
      <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        {activeView === 'home' && (
          <HomePage
            currentUser={currentUser}
            onNavigate={handleNavigate}
            onOpenVerifyModal={() => setIsScannerOpen(true)}
            onDirectVerifyCode={handleDirectVerify}
          />
        )}

        {activeView === 'login' && (
          <LoginPage
            onLoginSuccess={handleLoginSuccess}
            onNavigateRegister={() => setActiveTabIfSafe('register')}
            onNavigateHome={() => handleNavigate('home')}
          />
        )}

        {activeView === 'register' && (
          <RegisterPage
            onNavigateLogin={() => handleNavigate('login')}
            onNavigateHome={() => handleNavigate('home')}
          />
        )}

        {activeView === 'verify' && (
          <PublicVerificationPage initialCode={directVerifyCode} />
        )}

        {activeView === 'personnel' && currentUser && (
          <PersonnelPortal currentUser={currentUser} />
        )}

        {activeView === 'department' && currentUser && (
          <DepartmentHeadPortal currentUser={currentUser} />
        )}

        {activeView === 'admin' && currentUser && (
          <CentralAdminPortal currentUser={currentUser} />
        )}
      </div>

      {/* Footer */}
      <Footer
        onNavigate={handleNavigate}
        onOpenVerify={() => setIsScannerOpen(true)}
      />

      {/* Optical QR Scanner Modal (Available from anywhere) */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanResult={handleScanResult}
      />

      {/* Evaluator 1-Click Demo Credentials Drawer (Dev & Evaluation only) */}
      {(import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO === 'true') && (
        <DemoCredentialsDrawer onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  );

  function setActiveTabIfSafe(view: string) {
    setActiveView(view);
  }
};
