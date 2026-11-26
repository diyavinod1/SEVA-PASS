import React, { useState, useEffect } from 'react';
import {
  Building2,
  LayoutDashboard,
  Clock,
  CheckCircle2,
  XCircle,
  QrCode,
  Users,
  History,
  FileText,
  AlertCircle,
  Car,
  ArrowRight,
  ShieldCheck,
  Check,
  X,
  RefreshCw,
  Search,
  Filter
} from 'lucide-react';
import { UserProfile, PassApplication, IssuedPass, DepartmentOverviewStats } from '../../types';
import { api } from '../../services/api';
import { DigitalPassCard } from '../../components/DigitalPassCard';

interface DepartmentHeadPortalProps {
  currentUser: UserProfile;
}

export const DepartmentHeadPortal: React.FC<DepartmentHeadPortalProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'pending' | 'approved' | 'rejected' | 'passes' | 'personnel' | 'activity'>('overview');
  const [stats, setStats] = useState<DepartmentOverviewStats | null>(null);
  const [applications, setApplications] = useState<PassApplication[]>([]);
  const [issuedPasses, setIssuedPasses] = useState<IssuedPass[]>([]);
  const [personnelList, setPersonnelList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Review Modal State
  const [selectedApp, setSelectedApp] = useState<PassApplication | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Revocation Modal State
  const [selectedPassToRevoke, setSelectedPassToRevoke] = useState<IssuedPass | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [isRevoking, setIsRevoking] = useState(false);

  const loadDepartmentData = async () => {
    setIsLoading(true);
    try {
      const [overviewRes, appsRes, passesRes] = await Promise.all([
        api.getDepartmentOverviewStats(),
        api.getDepartmentApplications(),
        api.getAllIssuedPasses()
      ]);

      setStats(overviewRes);
      setApplications(appsRes.applications || []);
      setIssuedPasses(passesRes.passes || []);

      if (currentUser.assigned_department_id) {
        const [persRes, auditRes] = await Promise.all([
          api.getDepartmentPersonnel(currentUser.assigned_department_id),
          api.getAuditLogs({ department_id: currentUser.assigned_department_id, limit: 30 })
        ]);
        setPersonnelList(persRes.personnel || []);
        setAuditLogs(auditRes.audit_logs || []);
      }
    } catch (err) {
      console.warn('Failed to load department head data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDepartmentData();
  }, [currentUser]);

  const handleOpenReview = (app: PassApplication, action: 'approve' | 'reject') => {
    setSelectedApp(app);
    setReviewAction(action);
    setRejectionReason('');
    setAdminNotes(action === 'approve' ? 'Authorised for command movement' : '');
    setReviewError(null);
    setIsReviewModalOpen(true);
  };

  const handleExecuteReview = async () => {
    if (!selectedApp || !reviewAction) return;

    if (reviewAction === 'reject' && !rejectionReason.trim()) {
      setReviewError('A specific reason for rejection is strictly mandatory.');
      return;
    }

    setIsReviewing(true);
    setReviewError(null);

    try {
      await api.reviewPassApplication({
        application_id: selectedApp.id,
        action: reviewAction,
        rejection_reason: reviewAction === 'reject' ? rejectionReason.trim() : undefined,
        admin_notes: adminNotes.trim()
      });

      setIsReviewModalOpen(false);
      setSelectedApp(null);
      await loadDepartmentData();
    } catch (err: any) {
      setReviewError(err.message || 'Review action failed.');
    } finally {
      setIsReviewing(false);
    }
  };

  const handleRevokePass = async () => {
    if (!selectedPassToRevoke || !revokeReason.trim()) {
      alert('Revocation reason is required.');
      return;
    }

    setIsRevoking(true);
    try {
      await api.revokePass({
        pass_id: selectedPassToRevoke.id,
        reason: revokeReason.trim()
      });
      setSelectedPassToRevoke(null);
      setRevokeReason('');
      await loadDepartmentData();
    } catch (err: any) {
      alert(`Revocation failed: ${err.message}`);
    } finally {
      setIsRevoking(false);
    }
  };

  const pendingApps = applications.filter((a) => a.status === 'submitted');
  const approvedApps = applications.filter((a) => a.status === 'approved');
  const rejectedApps = applications.filter((a) => a.status === 'rejected');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 py-6">
      {/* Sidebar Navigation */}
      <aside className="lg:col-span-3 space-y-4 no-print">
        {/* Command Badge */}
        <div className="bg-white rounded-2xl border border-[#CBD5E1] p-5 shadow-subtle space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#14243A] text-[#B99A62] flex items-center justify-center font-bold text-base shadow-xs">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="overflow-hidden">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#B99A62]">
                Command Formation
              </span>
              <h3 className="font-bold text-sm text-[#14243A] truncate">
                {currentUser.department_name || 'My Department'}
              </h3>
              <p className="text-xs text-[#64748B] font-mono font-medium">
                {currentUser.department_code || 'DEPT-AUTH'}
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-[#F1F5F9] text-xs text-[#64748B] space-y-1">
            <div className="flex items-center justify-between">
              <span>Reviewing Officer</span>
              <span className="font-semibold text-[#14243A]">{currentUser.full_name?.split(' ')[0]}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Authority Key</span>
              <span className="font-mono text-[10px] text-[#B99A62]">RFC 8032 / Ed25519</span>
            </div>
          </div>
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
            <span>Command Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('pending')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-colors text-left ${
              activeTab === 'pending'
                ? 'bg-[#14243A] text-white font-semibold shadow-xs'
                : 'text-[#64748B] hover:text-[#14243A] hover:bg-[#F7F7F3]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-[#B99A62]" />
              <span>Pending Reviews</span>
            </div>
            {pendingApps.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#B99A62] text-[#0C1728]">
                {pendingApps.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('approved')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-colors text-left ${
              activeTab === 'approved'
                ? 'bg-[#14243A] text-white font-semibold shadow-xs'
                : 'text-[#64748B] hover:text-[#14243A] hover:bg-[#F7F7F3]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Approved Requests</span>
            </div>
            <span className="text-[11px] text-[#64748B] font-mono">{approvedApps.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('rejected')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-colors text-left ${
              activeTab === 'rejected'
                ? 'bg-[#14243A] text-white font-semibold shadow-xs'
                : 'text-[#64748B] hover:text-[#14243A] hover:bg-[#F7F7F3]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <XCircle className="w-4 h-4 text-red-500" />
              <span>Rejected Requests</span>
            </div>
            <span className="text-[11px] text-[#64748B] font-mono">{rejectedApps.length}</span>
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
              <span>Issued Passes</span>
            </div>
            <span className="text-[11px] text-[#64748B] font-mono">{issuedPasses.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('personnel')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-colors text-left ${
              activeTab === 'personnel'
                ? 'bg-[#14243A] text-white font-semibold shadow-xs'
                : 'text-[#64748B] hover:text-[#14243A] hover:bg-[#F7F7F3]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Users className="w-4 h-4" />
              <span>Department Roll</span>
            </div>
            <span className="text-[11px] text-[#64748B] font-mono">{personnelList.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('activity')}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-colors text-left ${
              activeTab === 'activity'
                ? 'bg-[#14243A] text-white font-semibold shadow-xs'
                : 'text-[#64748B] hover:text-[#14243A] hover:bg-[#F7F7F3]'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Activity History</span>
          </button>
        </nav>
      </aside>

      {/* Main Content Pane */}
      <main className="lg:col-span-9 space-y-6">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            {/* Header Banner */}
            <div className="bg-[#14243A] text-white rounded-2xl p-6 sm:p-8 border border-[#0C1728] shadow-card">
              <span className="text-xs font-semibold text-[#B99A62]">
                Command Formation Management
              </span>
              <h2 className="text-2xl font-bold tracking-tight mt-1">
                {stats.department.name}
              </h2>
              <p className="text-xs text-[#94A3B8] mt-1">
                Headquarters: {stats.department.location || 'Operational Theater'} • Code: {stats.department.code}
              </p>
            </div>

            {/* Live Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-[#CBD5E1] p-5 shadow-subtle space-y-1">
                <span className="text-[11px] font-semibold text-[#64748B] block">Pending Approvals</span>
                <span className="text-2xl font-extrabold text-[#B99A62]">
                  {stats.metrics.pending_approvals}
                </span>
                <p className="text-[10px] text-[#64748B]">Requiring digital signature</p>
              </div>

              <div className="bg-white rounded-2xl border border-[#CBD5E1] p-5 shadow-subtle space-y-1">
                <span className="text-[11px] font-semibold text-[#64748B] block">Approved Passes</span>
                <span className="text-2xl font-extrabold text-emerald-700">
                  {stats.metrics.approved_applications}
                </span>
                <p className="text-[10px] text-[#64748B]">Digitally signed passes</p>
              </div>

              <div className="bg-white rounded-2xl border border-[#CBD5E1] p-5 shadow-subtle space-y-1">
                <span className="text-[11px] font-semibold text-[#64748B] block">Active Passes</span>
                <span className="text-2xl font-extrabold text-[#14243A]">
                  {stats.metrics.active_passes}
                </span>
                <p className="text-[10px] text-[#64748B]">Currently valid on highway</p>
              </div>

              <div className="bg-white rounded-2xl border border-[#CBD5E1] p-5 shadow-subtle space-y-1">
                <span className="text-[11px] font-semibold text-[#64748B] block">Rejected Requests</span>
                <span className="text-2xl font-extrabold text-red-600">
                  {stats.metrics.rejected_applications}
                </span>
                <p className="text-[10px] text-[#64748B]">With recorded reasons</p>
              </div>

              <div className="bg-white rounded-2xl border border-[#CBD5E1] p-5 shadow-subtle space-y-1">
                <span className="text-[11px] font-semibold text-[#64748B] block">Registered Personnel</span>
                <span className="text-2xl font-extrabold text-[#14243A]">
                  {stats.metrics.total_personnel}
                </span>
                <p className="text-[10px] text-[#64748B]">Active unit officers</p>
              </div>

              <div className="bg-white rounded-2xl border border-[#CBD5E1] p-5 shadow-subtle space-y-1">
                <span className="text-[11px] font-semibold text-[#64748B] block">Total Applications</span>
                <span className="text-2xl font-extrabold text-[#14243A]">
                  {applications.length}
                </span>
                <p className="text-[10px] text-[#64748B]">Lifetime formation requests</p>
              </div>
            </div>

            {/* Quick Action Pending Applications List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-[#14243A]">
                  Urgent Applications Awaiting Review ({pendingApps.length})
                </h3>
                {pendingApps.length > 0 && (
                  <button
                    onClick={() => setActiveTab('pending')}
                    className="text-xs font-semibold text-[#B99A62] hover:underline"
                  >
                    View All
                  </button>
                )}
              </div>

              {pendingApps.length === 0 ? (
                <div className="bg-white rounded-2xl border border-[#CBD5E1] p-8 text-center text-xs text-[#64748B]">
                  No movement applications currently awaiting review.
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingApps.slice(0, 3).map((app) => (
                    <div
                      key={app.id}
                      className="bg-white rounded-2xl border border-[#CBD5E1] p-5 shadow-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#14243A]">
                            {app.application_number}
                          </span>
                          <span className="font-semibold text-[#64748B]">
                            • {app.applicant_name} ({app.applicant_rank})
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-700">
                          <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100">
                            {app.vehicle_registration_number}
                          </span>
                          <span>•</span>
                          <span>{app.journey_origin}</span>
                          <ArrowRight className="w-3 h-3 text-[#B99A62]" />
                          <span>{app.journey_destination}</span>
                        </div>
                        <p className="text-[11px] text-[#64748B] truncate">
                          Purpose: {app.journey_purpose}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleOpenReview(app, 'reject')}
                          className="px-3.5 py-2 rounded-xl text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleOpenReview(app, 'approve')}
                          className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#14243A] text-white hover:bg-[#0C1728] transition-colors shadow-xs"
                        >
                          Review & Sign
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: PENDING REVIEWS */}
        {activeTab === 'pending' && (
          <div className="space-y-5">
            <div>
              <h3 className="font-bold text-base text-[#14243A]">
                Pending Movement Applications ({pendingApps.length})
              </h3>
              <p className="text-xs text-[#64748B]">
                Review verified applicant and vehicle credentials before issuing an Ed25519 digital pass.
              </p>
            </div>

            {pendingApps.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#CBD5E1] p-8 text-center text-xs text-[#64748B]">
                All applications have been reviewed.
              </div>
            ) : (
              <div className="space-y-4">
                {pendingApps.map((app) => (
                  <div
                    key={app.id}
                    className="bg-white rounded-2xl border border-[#CBD5E1] p-6 shadow-subtle space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-[#E2E8F0] gap-2">
                      <div>
                        <span className="font-mono text-sm font-bold text-[#14243A]">
                          {app.application_number}
                        </span>
                        <span className="text-xs text-[#64748B] block">
                          Submitted on {new Date(app.created_at).toLocaleString('en-GB')}
                        </span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                        Awaiting Decision
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-[#64748B] block">
                          Applicant Officer
                        </span>
                        <span className="font-bold text-[#14243A] block">{app.applicant_name}</span>
                        <span className="text-[#64748B] font-mono text-[11px] block">
                          {app.applicant_service_number} • {app.applicant_rank}
                        </span>
                        {app.applicant_phone && (
                          <span className="text-[#64748B] text-[11px] block">{app.applicant_phone}</span>
                        )}
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-semibold text-[#64748B] block">
                          Vehicle Details
                        </span>
                        <span className="font-mono font-bold text-sm text-[#14243A] block">
                          {app.vehicle_registration_number}
                        </span>
                        <span className="text-[#64748B] text-[11px] block">{app.vehicle_type}</span>
                        {app.supporting_document_ref && (
                          <span className="text-[#B99A62] text-[11px] block font-mono">
                            Ref: {app.supporting_document_ref}
                          </span>
                        )}
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-semibold text-[#64748B] block">
                          Journey Window
                        </span>
                        <span className="font-semibold text-[#14243A] block">{app.journey_date}</span>
                        <span className="text-[#64748B] text-[11px] block">
                          {new Date(app.requested_start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })} — {new Date(app.requested_end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-[#F7F7F3] border border-[#E2E8F0] text-xs">
                      <span className="text-[10px] uppercase font-semibold text-[#64748B] block mb-1">
                        Movement Corridor & Purpose
                      </span>
                      <div className="flex items-center gap-2 font-medium text-[#14243A]">
                        <span>{app.journey_origin}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-[#B99A62]" />
                        <span>{app.journey_destination}</span>
                      </div>
                      <p className="text-[11px] text-[#64748B] mt-1">
                        Purpose: {app.journey_purpose}
                      </p>
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-3">
                      <button
                        onClick={() => handleOpenReview(app, 'reject')}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
                      >
                        Reject Application
                      </button>
                      <button
                        onClick={() => handleOpenReview(app, 'approve')}
                        className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#14243A] text-white hover:bg-[#0C1728] transition-colors shadow-xs"
                      >
                        Approve & Sign Pass
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: APPROVED REQUESTS */}
        {activeTab === 'approved' && (
          <div className="space-y-5">
            <div>
              <h3 className="font-bold text-base text-[#14243A]">
                Approved Applications ({approvedApps.length})
              </h3>
              <p className="text-xs text-[#64748B]">
                Passes officially authorized and issued by command authority.
              </p>
            </div>

            {approvedApps.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#CBD5E1] p-8 text-center text-xs text-[#64748B]">
                No approved requests yet.
              </div>
            ) : (
              <div className="space-y-3">
                {approvedApps.map((app) => (
                  <div
                    key={app.id}
                    className="bg-white rounded-2xl border border-[#CBD5E1] p-5 shadow-subtle text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#14243A]">
                          {app.application_number}
                        </span>
                        <span className="font-semibold text-slate-700">
                          • {app.applicant_name} ({app.applicant_rank})
                        </span>
                      </div>
                      <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        {app.pass_code || 'APPROVED'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-600">
                      <span className="font-mono font-semibold text-[#14243A]">
                        {app.vehicle_registration_number}
                      </span>
                      <span>•</span>
                      <span>{app.journey_origin}</span>
                      <ArrowRight className="w-3 h-3 text-[#B99A62]" />
                      <span>{app.journey_destination}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: REJECTED REQUESTS */}
        {activeTab === 'rejected' && (
          <div className="space-y-5">
            <div>
              <h3 className="font-bold text-base text-[#14243A]">
                Rejected Requests ({rejectedApps.length})
              </h3>
              <p className="text-xs text-[#64748B]">
                Movement applications rejected with recorded institutional justifications.
              </p>
            </div>

            {rejectedApps.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#CBD5E1] p-8 text-center text-xs text-[#64748B]">
                No rejected applications.
              </div>
            ) : (
              <div className="space-y-3">
                {rejectedApps.map((app) => (
                  <div
                    key={app.id}
                    className="bg-white rounded-2xl border border-[#CBD5E1] p-5 shadow-subtle text-xs space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#14243A]">
                          {app.application_number}
                        </span>
                        <span className="font-semibold text-slate-700">
                          • {app.applicant_name}
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                        Rejected
                      </span>
                    </div>

                    <p className="text-[#64748B]">
                      Vehicle: <span className="font-mono font-bold text-[#14243A]">{app.vehicle_registration_number}</span> ({app.vehicle_type})
                    </p>

                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900">
                      <span className="font-semibold block mb-0.5">Recorded Rejection Reason:</span>
                      {app.rejection_reason}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: ISSUED PASSES */}
        {activeTab === 'passes' && (
          <div className="space-y-5">
            <div>
              <h3 className="font-bold text-base text-[#14243A]">
                Digitally Signed Issued Passes ({issuedPasses.length})
              </h3>
              <p className="text-xs text-[#64748B]">
                Full digital passes carrying Ed25519 asymmetric signatures and QR tokens.
              </p>
            </div>

            {issuedPasses.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#CBD5E1] p-8 text-center text-xs text-[#64748B]">
                No passes currently issued.
              </div>
            ) : (
              <div className="space-y-6">
                {issuedPasses.map((p) => (
                  <DigitalPassCard
                    key={p.id}
                    pass={p}
                    canRevoke={true}
                    onRevoke={(passToRev) => setSelectedPassToRevoke(passToRev)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: PERSONNEL ROLL */}
        {activeTab === 'personnel' && (
          <div className="space-y-5">
            <div>
              <h3 className="font-bold text-base text-[#14243A]">
                Department Personnel Roll ({personnelList.length})
              </h3>
              <p className="text-xs text-[#64748B]">
                Officers registered under {currentUser.department_name}.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-[#CBD5E1] shadow-card overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#14243A] text-white">
                  <tr>
                    <th className="p-3.5 font-semibold">Officer Name</th>
                    <th className="p-3.5 font-semibold">Service ID</th>
                    <th className="p-3.5 font-semibold">Rank</th>
                    <th className="p-3.5 font-semibold">Contact</th>
                    <th className="p-3.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {personnelList.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3.5 font-semibold text-[#14243A]">{p.full_name}</td>
                      <td className="p-3.5 font-mono font-bold text-slate-700">{p.service_number}</td>
                      <td className="p-3.5 text-[#64748B]">{p.rank}</td>
                      <td className="p-3.5 text-[#64748B]">{p.phone || p.email}</td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 7: ACTIVITY HISTORY */}
        {activeTab === 'activity' && (
          <div className="space-y-5">
            <div>
              <h3 className="font-bold text-base text-[#14243A]">
                Command Formation Audit Log
              </h3>
              <p className="text-xs text-[#64748B]">
                Immutable append-only record of pass applications, approvals, and revocations.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-[#CBD5E1] shadow-card overflow-hidden">
              <div className="divide-y divide-[#E2E8F0] text-xs">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-[#14243A]">
                          {log.event_type}
                        </span>
                        <span className="text-[10px] text-[#64748B]">
                          by {log.actor_email} ({log.actor_role})
                        </span>
                      </div>
                      <span className="text-[10px] text-[#94A3B8]">
                        {new Date(log.created_at).toLocaleString('en-GB')}
                      </span>
                    </div>
                    {log.details && (
                      <p className="text-[11px] text-[#64748B] font-mono truncate">
                        {log.details}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* REVIEW APPLICATION MODAL */}
      {isReviewModalOpen && selectedApp && reviewAction && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-[#CBD5E1] shadow-elevated overflow-hidden animate-in fade-in">
            <div className="bg-[#14243A] text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">
                  {reviewAction === 'approve' ? 'Confirm Pass Authorisation' : 'Reject Movement Application'}
                </h3>
                <p className="text-[11px] text-[#94A3B8]">
                  Application {selectedApp.application_number}
                </p>
              </div>
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="p-1 rounded-md text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {reviewError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-[#C44747]">
                  {reviewError}
                </div>
              )}

              {/* Applicant Summary */}
              <div className="p-3.5 rounded-xl bg-[#F7F7F3] border border-[#E2E8F0] text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#14243A]">{selectedApp.applicant_name}</span>
                  <span className="font-mono font-bold text-[#14243A]">
                    {selectedApp.vehicle_registration_number}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[#64748B]">
                  <span>{selectedApp.journey_origin}</span>
                  <ArrowRight className="w-3 h-3 text-[#B99A62]" />
                  <span>{selectedApp.journey_destination}</span>
                </div>
              </div>

              {/* Approve Confirmation Notice */}
              {reviewAction === 'approve' && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-2">
                  <p className="font-semibold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    <span>Cryptographic Signing Confirmation</span>
                  </p>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    By approving, you authorize this vehicle movement and sign the digital credential with the formation's Ed25519 private key.
                  </p>
                </div>
              )}

              {/* Rejection Reason Form */}
              {reviewAction === 'reject' && (
                <div>
                  <label className="text-xs font-semibold text-[#14243A] block mb-1">
                    Mandatory Rejection Reason *
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Enter explicit reason for denial (e.g. Incomplete route documentation or weather closure)..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full p-3 rounded-xl border border-[#CBD5E1] text-xs focus:outline-hidden focus:border-[#14243A] bg-[#F7F7F3]"
                    autoFocus
                  />
                </div>
              )}

              {/* Review Notes */}
              <div>
                <label className="text-xs font-semibold text-[#14243A] block mb-1">
                  Officer Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Additional remarks..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] text-xs bg-[#F7F7F3]"
                />
              </div>

              {/* Modal Controls */}
              <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(false)}
                  disabled={isReviewing}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#64748B] hover:text-[#14243A]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteReview}
                  disabled={isReviewing}
                  className={`px-5 py-2.5 rounded-xl text-xs font-semibold text-white transition-colors disabled:opacity-50 ${
                    reviewAction === 'approve'
                      ? 'bg-[#14243A] hover:bg-[#0C1728]'
                      : 'bg-[#C44747] hover:bg-red-800'
                  }`}
                >
                  {isReviewing
                    ? 'Processing...'
                    : reviewAction === 'approve'
                    ? 'Confirm & Sign Pass'
                    : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REVOCATION MODAL */}
      {selectedPassToRevoke && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-[#CBD5E1] shadow-elevated overflow-hidden animate-in fade-in">
            <div className="bg-[#C44747] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">Revoke Issued Pass</h3>
              <button
                onClick={() => setSelectedPassToRevoke(null)}
                className="p-1 rounded-md text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-[#64748B]">
                Revoking pass <strong className="font-mono text-[#14243A]">{selectedPassToRevoke.pass_code}</strong> will immediately invalidate online verification at toll plazas.
              </p>

              <div>
                <label className="text-xs font-semibold text-[#14243A] block mb-1">
                  Revocation Reason *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Specify why this pass is being cancelled..."
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#CBD5E1] text-xs focus:outline-hidden focus:border-[#14243A] bg-[#F7F7F3]"
                  autoFocus
                />
              </div>

              <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-3">
                <button
                  onClick={() => setSelectedPassToRevoke(null)}
                  disabled={isRevoking}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#64748B]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRevokePass}
                  disabled={isRevoking || !revokeReason.trim()}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#C44747] text-white hover:bg-red-800 disabled:opacity-50"
                >
                  {isRevoking ? 'Revoking...' : 'Confirm Official Revocation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
