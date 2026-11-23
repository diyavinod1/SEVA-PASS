import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  FileText,
  QrCode,
  History,
  User,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Car,
  ArrowRight,
  RefreshCw,
  Printer
} from 'lucide-react';
import { UserProfile, PassApplication, IssuedPass } from '../../types';
import { api } from '../../services/api';
import { DigitalPassCard } from '../../components/DigitalPassCard';
import { PassApplicationWizard } from './PassApplicationWizard';

interface PersonnelPortalProps {
  currentUser: UserProfile;
}

export const PersonnelPortal: React.FC<PersonnelPortalProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'apply' | 'applications' | 'passes' | 'history' | 'profile'>('overview');
  const [applications, setApplications] = useState<PassApplication[]>([]);
  const [currentPasses, setCurrentPasses] = useState<IssuedPass[]>([]);
  const [passHistory, setPassHistory] = useState<IssuedPass[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [appFilter, setAppFilter] = useState<string>('all');
  const [submittedAppNumber, setSubmittedAppNumber] = useState<string | null>(null);

  // Password change state
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [appsRes, passesRes, histRes] = await Promise.all([
        api.getMyApplications(),
        api.getMyCurrentPasses(),
        api.getMyPassHistory()
      ]);
      setApplications(appsRes.applications || []);
      setCurrentPasses(passesRes.passes || []);
      setPassHistory(histRes.history || []);
    } catch (err) {
      console.warn('Failed to fetch personnel records:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwSuccess(null);
    setPwError(null);
    try {
      await api.changePassword({
        current_password: currentPw,
        new_password: newPw
      });
      setPwSuccess('Password updated successfully.');
      setCurrentPw('');
      setNewPw('');
    } catch (err: any) {
      setPwError(err.message || 'Failed to update password.');
    }
  };

  const pendingApps = applications.filter((a) => a.status === 'submitted');
  const filteredApps = appFilter === 'all'
    ? applications
    : applications.filter((a) => a.status === appFilter);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 py-6">
      {/* Sidebar Navigation */}
      <aside className="lg:col-span-3 space-y-4 no-print">
        {/* User Badge */}
        <div className="bg-white rounded-2xl border border-[#CBD5E1] p-5 shadow-subtle space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#14243A] text-white flex items-center justify-center font-bold text-base shadow-xs">
              {currentUser.full_name?.charAt(0) || 'P'}
            </div>
            <div className="overflow-hidden">
              <h3 className="font-bold text-sm text-[#14243A] truncate">
                {currentUser.full_name}
              </h3>
              <p className="text-xs text-[#B99A62] font-semibold">
                {currentUser.rank || 'Officer'}
              </p>
              <p className="text-[10px] font-mono text-[#64748B]">
                {currentUser.service_number}
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-[#F1F5F9] text-[11px] text-[#64748B] flex items-center justify-between">
            <span>Branch</span>
            <span className="font-medium text-[#14243A]">{currentUser.service_category}</span>
          </div>
          {currentUser.department_name && (
            <div className="text-[11px] text-[#64748B] flex items-center justify-between">
              <span>Formation</span>
              <span className="font-medium text-[#14243A] truncate max-w-[130px]">
                {currentUser.department_name}
              </span>
            </div>
          )}
        </div>

        {/* Sidebar Nav Items */}
        <nav className="bg-white rounded-2xl border border-[#CBD5E1] p-2 shadow-subtle space-y-1 text-xs font-medium">
          <button
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-colors text-left ${
              activeTab === 'overview'
                ? 'bg-[#14243A] text-white font-semibold shadow-xs'
                : 'text-[#64748B] hover:text-[#14243A] hover:bg-[#F7F7F3]'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => {
              setSubmittedAppNumber(null);
              setActiveTab('apply');
            }}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-colors text-left ${
              activeTab === 'apply'
                ? 'bg-[#14243A] text-white font-semibold shadow-xs'
                : 'text-[#64748B] hover:text-[#14243A] hover:bg-[#F7F7F3]'
            }`}
          >
            <PlusCircle className="w-4 h-4 text-[#B99A62]" />
            <span>Apply for a Pass</span>
          </button>

          <button
            onClick={() => setActiveTab('applications')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-colors text-left ${
              activeTab === 'applications'
                ? 'bg-[#14243A] text-white font-semibold shadow-xs'
                : 'text-[#64748B] hover:text-[#14243A] hover:bg-[#F7F7F3]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4" />
              <span>My Applications</span>
            </div>
            {pendingApps.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#B99A62] text-[#0C1728]">
                {pendingApps.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('passes')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-colors text-left ${
              activeTab === 'passes'
                ? 'bg-[#14243A] text-white font-semibold shadow-xs'
                : 'text-[#64748B] hover:text-[#14243A] hover:bg-[#F7F7F3]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <QrCode className="w-4 h-4" />
              <span>Current Passes</span>
            </div>
            {currentPasses.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                {currentPasses.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-colors text-left ${
              activeTab === 'history'
                ? 'bg-[#14243A] text-white font-semibold shadow-xs'
                : 'text-[#64748B] hover:text-[#14243A] hover:bg-[#F7F7F3]'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Pass History</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-colors text-left ${
              activeTab === 'profile'
                ? 'bg-[#14243A] text-white font-semibold shadow-xs'
                : 'text-[#64748B] hover:text-[#14243A] hover:bg-[#F7F7F3]'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Profile & Security</span>
          </button>
        </nav>
      </aside>

      {/* Main Content Pane */}
      <main className="lg:col-span-9 space-y-6">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Welcome Banner */}
            <div className="bg-[#14243A] text-white rounded-2xl p-6 sm:p-8 border border-[#0C1728] shadow-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-[#B99A62]">
                  Personnel Service Dashboard
                </span>
                <h2 className="text-2xl font-bold tracking-tight">
                  Welcome, {currentUser.rank} {currentUser.full_name?.split(' ')[1] || currentUser.full_name}
                </h2>
                <p className="text-xs text-[#94A3B8]">
                  Manage and monitor your digital movement passes and transit authorizations.
                </p>
              </div>

              <button
                onClick={() => {
                  setSubmittedAppNumber(null);
                  setActiveTab('apply');
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#B99A62] text-[#0C1728] hover:bg-[#CEB482] transition-colors shadow-xs shrink-0"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Apply for Pass</span>
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-[#CBD5E1] p-5 shadow-subtle space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-[#64748B]">
                  <span>Active Passes</span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <QrCode className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-[#14243A]">
                  {currentPasses.length}
                </div>
                <p className="text-[11px] text-[#64748B]">Ready for plaza optical scanning</p>
              </div>

              <div className="bg-white rounded-2xl border border-[#CBD5E1] p-5 shadow-subtle space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-[#64748B]">
                  <span>Pending Approvals</span>
                  <div className="w-7 h-7 rounded-lg bg-amber-50 text-[#B99A62] flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-[#14243A]">
                  {pendingApps.length}
                </div>
                <p className="text-[11px] text-[#64748B]">Under departmental review</p>
              </div>

              <div className="bg-white rounded-2xl border border-[#CBD5E1] p-5 shadow-subtle space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-[#64748B]">
                  <span>Total Submissions</span>
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-extrabold text-[#14243A]">
                  {applications.length}
                </div>
                <p className="text-[11px] text-[#64748B]">Historical movement requests</p>
              </div>
            </div>

            {/* Current Active Passes Preview */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-[#14243A]">Currently Valid Passes</h3>
                {currentPasses.length > 0 && (
                  <button
                    onClick={() => setActiveTab('passes')}
                    className="text-xs font-semibold text-[#B99A62] hover:underline"
                  >
                    View All ({currentPasses.length})
                  </button>
                )}
              </div>

              {currentPasses.length === 0 ? (
                <div className="bg-white rounded-2xl border border-[#CBD5E1] p-8 text-center space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-[#F7F7F3] text-[#64748B] flex items-center justify-center mx-auto">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-sm text-[#14243A]">No Active Passes</h4>
                  <p className="text-xs text-[#64748B] max-w-sm mx-auto">
                    You currently have no active transit passes. Submit a pass application to receive a digitally signed QR pass.
                  </p>
                  <button
                    onClick={() => setActiveTab('apply')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#14243A] text-white hover:bg-[#0C1728] transition-colors"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-[#B99A62]" />
                    <span>Apply Now</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {currentPasses.slice(0, 1).map((p) => (
                    <DigitalPassCard key={p.id} pass={p} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: APPLY FOR A PASS */}
        {activeTab === 'apply' && (
          <div className="space-y-6">
            {submittedAppNumber ? (
              <div className="bg-white rounded-2xl border border-[#CBD5E1] p-8 text-center space-y-4 shadow-card">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-base text-[#14243A]">
                    Pass Application Submitted
                  </h3>
                  <p className="text-xs text-[#64748B]">
                    Application Reference Number:
                  </p>
                  <p className="font-mono text-lg font-extrabold text-[#14243A]">
                    {submittedAppNumber}
                  </p>
                  <p className="text-xs text-[#64748B] max-w-sm mx-auto pt-2">
                    Your request has been forwarded to the Officer Commanding for review and Ed25519 digital signature.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      setSubmittedAppNumber(null);
                      setActiveTab('applications');
                      loadData();
                    }}
                    className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#14243A] text-white hover:bg-[#0C1728] transition-colors"
                  >
                    View My Applications
                  </button>
                  <button
                    onClick={() => setSubmittedAppNumber(null)}
                    className="px-5 py-2.5 rounded-xl text-xs font-semibold text-[#64748B] hover:text-[#14243A]"
                  >
                    Submit Another Request
                  </button>
                </div>
              </div>
            ) : (
              <PassApplicationWizard
                currentUser={currentUser}
                onSuccess={(appNum) => {
                  setSubmittedAppNumber(appNum);
                  loadData();
                }}
                onCancel={() => setActiveTab('overview')}
              />
            )}
          </div>
        )}

        {/* TAB 3: MY APPLICATIONS */}
        {activeTab === 'applications' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-base text-[#14243A]">My Pass Applications</h3>
                <p className="text-xs text-[#64748B]">
                  Track departmental review decisions and approval states.
                </p>
              </div>

              {/* Status Filters */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-white border border-[#CBD5E1] text-xs">
                {['all', 'submitted', 'approved', 'rejected'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setAppFilter(f)}
                    className={`px-3 py-1.5 rounded-lg capitalize transition-colors ${
                      appFilter === f
                        ? 'bg-[#14243A] text-white font-semibold'
                        : 'text-[#64748B] hover:text-[#14243A]'
                    }`}
                  >
                    {f === 'submitted' ? 'Pending' : f}
                  </button>
                ))}
              </div>
            </div>

            {filteredApps.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#CBD5E1] p-8 text-center text-xs text-[#64748B]">
                No applications matching this filter.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredApps.map((app) => (
                  <div
                    key={app.id}
                    className="bg-white rounded-2xl border border-[#CBD5E1] p-5 shadow-subtle space-y-3 hover:border-slate-400 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#14243A]">
                          {app.application_number}
                        </span>
                        <span className="text-[10px] text-[#64748B]">
                          • {new Date(app.created_at).toLocaleDateString('en-GB')}
                        </span>
                      </div>

                      {/* Status Badges */}
                      {app.status === 'approved' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Approved
                        </span>
                      )}
                      {app.status === 'submitted' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3.5 h-3.5" />
                          Pending Review
                        </span>
                      )}
                      {app.status === 'rejected' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Rejected
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[#64748B] block text-[10px] uppercase font-semibold">
                          Vehicle
                        </span>
                        <span className="font-mono font-bold text-[#14243A]">
                          {app.vehicle_registration_number}
                        </span>
                        <span className="text-[#64748B] block text-[11px]">{app.vehicle_type}</span>
                      </div>

                      <div>
                        <span className="text-[#64748B] block text-[10px] uppercase font-semibold">
                          Route Corridor
                        </span>
                        <div className="flex items-center gap-1.5 font-medium text-[#14243A]">
                          <span>{app.journey_origin}</span>
                          <ArrowRight className="w-3 h-3 text-[#B99A62]" />
                          <span>{app.journey_destination}</span>
                        </div>
                        <span className="text-[#64748B] block text-[11px] truncate">
                          Purpose: {app.journey_purpose}
                        </span>
                      </div>
                    </div>

                    {/* Department Rejection Reason or Pass Code */}
                    {app.status === 'rejected' && app.rejection_reason && (
                      <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
                        <span className="font-semibold">Rejection Reason: </span>
                        {app.rejection_reason}
                      </div>
                    )}
                    {app.status === 'approved' && app.pass_code && (
                      <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
                        <div>
                          <span className="font-semibold">Approved Pass: </span>
                          <span className="font-mono font-bold">{app.pass_code}</span>
                        </div>
                        <button
                          onClick={() => setActiveTab('passes')}
                          className="font-semibold text-emerald-900 underline text-[11px]"
                        >
                          View in Current Passes
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: CURRENT PASSES */}
        {activeTab === 'passes' && (
          <div className="space-y-5">
            <div>
              <h3 className="font-bold text-base text-[#14243A]">Current Digital Passes</h3>
              <p className="text-xs text-[#64748B]">
                Active, cryptographically signed passes authorized for highway toll verification.
              </p>
            </div>

            {currentPasses.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#CBD5E1] p-8 text-center text-xs text-[#64748B]">
                No active passes found.
              </div>
            ) : (
              <div className="space-y-6">
                {currentPasses.map((p) => (
                  <DigitalPassCard key={p.id} pass={p} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: PASS HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-5">
            <div>
              <h3 className="font-bold text-base text-[#14243A]">Pass History & Archive</h3>
              <p className="text-xs text-[#64748B]">
                Archive of past movements, completed journeys, and administratively revoked credentials.
              </p>
            </div>

            {passHistory.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#CBD5E1] p-8 text-center text-xs text-[#64748B]">
                No historical passes on record.
              </div>
            ) : (
              <div className="space-y-4">
                {passHistory.map((p) => (
                  <DigitalPassCard key={p.id} pass={p} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: PROFILE & SECURITY */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-[#CBD5E1] p-6 shadow-card space-y-4">
              <h3 className="font-bold text-sm text-[#14243A]">Officer Profile Record</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[#64748B] block text-[10px] uppercase font-semibold">Full Name</span>
                  <span className="font-bold text-[#14243A]">{currentUser.full_name}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block text-[10px] uppercase font-semibold">Service ID</span>
                  <span className="font-mono font-bold text-[#14243A]">{currentUser.service_number}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block text-[10px] uppercase font-semibold">Branch</span>
                  <span className="font-medium text-[#14243A]">{currentUser.service_category}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block text-[10px] uppercase font-semibold">Designation</span>
                  <span className="font-medium text-[#14243A]">{currentUser.rank}</span>
                </div>
              </div>
            </div>

            {/* Password Change Form */}
            <div className="bg-white rounded-2xl border border-[#CBD5E1] p-6 shadow-card space-y-4">
              <h3 className="font-bold text-sm text-[#14243A]">Update Account Password</h3>

              {pwSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                  {pwSuccess}
                </div>
              )}
              {pwError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
                  {pwError}
                </div>
              )}

              <form onSubmit={handlePasswordChange} className="space-y-3 max-w-sm">
                <div>
                  <label className="text-xs font-semibold text-[#14243A] block mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#CBD5E1] text-xs bg-[#F7F7F3]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#14243A] block mb-1">
                    New Password (min 8 characters)
                  </label>
                  <input
                    type="password"
                    required
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-[#CBD5E1] text-xs bg-[#F7F7F3]"
                  />
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#14243A] text-white hover:bg-[#0C1728] transition-colors"
                >
                  Update Password
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
