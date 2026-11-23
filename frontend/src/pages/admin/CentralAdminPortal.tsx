import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  QrCode,
  ShieldCheck,
  History,
  Settings,
  PlusCircle,
  KeyRound,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  AlertCircle,
  Eye,
  RefreshCw,
  Search,
  Filter,
  Lock,
  Copy,
  Check
} from 'lucide-react';
import {
  UserProfile,
  Department,
  PassApplication,
  IssuedPass,
  AuditLog,
  AdminOverviewStats
} from '../../types';
import { api } from '../../services/api';
import { DigitalPassCard } from '../../components/DigitalPassCard';

interface CentralAdminPortalProps {
  currentUser: UserProfile;
}

export const CentralAdminPortal: React.FC<CentralAdminPortalProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'departments' | 'heads' | 'applications' | 'passes' | 'verifications' | 'audit' | 'settings'>('overview');
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [applications, setApplications] = useState<PassApplication[]>([]);
  const [issuedPasses, setIssuedPasses] = useState<IssuedPass[]>([]);
  const [verificationLogs, setVerificationLogs] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Department Modal State
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [deptName, setDeptName] = useState('');
  const [deptCode, setDeptCode] = useState('');
  const [deptCategory, setDeptCategory] = useState('Command Headquarters');
  const [deptLocation, setDeptLocation] = useState('');
  const [deptDescription, setDeptDescription] = useState('');
  const [headUsername, setHeadUsername] = useState('');
  const [isCreatingDept, setIsCreatingDept] = useState(false);
  const [deptModalError, setDeptModalError] = useState<string | null>(null);

  // Secure One-Time Credential Display Modal
  const [revealedCredentials, setRevealedCredentials] = useState<any | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Department Details Drawer / Modal
  const [selectedDeptDetails, setSelectedDeptDetails] = useState<Department | null>(null);

  const loadAdminData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, deptRes, appsRes, passesRes, verifRes, auditRes] = await Promise.all([
        api.getAdminOverviewStats(),
        api.listDepartments(),
        api.getAllApplications(),
        api.getAllIssuedPasses(),
        api.getVerificationLogs(50),
        api.getAuditLogs({ limit: 50 })
      ]);

      setStats(statsRes);
      setDepartments(deptRes.departments || []);
      setApplications(appsRes.applications || []);
      setIssuedPasses(passesRes.passes || []);
      setVerificationLogs(verifRes.logs || []);
      setAuditLogs(auditRes.audit_logs || []);
    } catch (err) {
      console.warn('Failed to load Central Admin records:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeptModalError(null);
    setIsCreatingDept(true);

    try {
      const resp = await api.createDepartment({
        name: deptName.trim(),
        code: deptCode.trim().toUpperCase(),
        service_id: 'srv-army-01',
        category: deptCategory,
        location: deptLocation.trim(),
        description: deptDescription.trim(),
        head_username: headUsername ? headUsername.trim().toLowerCase() : undefined
      });

      setIsDeptModalOpen(false);
      setDeptName('');
      setDeptCode('');
      setDeptLocation('');
      setDeptDescription('');
      setHeadUsername('');

      if (resp.credentials) {
        setRevealedCredentials(resp.credentials);
      }

      await loadAdminData();
    } catch (err: any) {
      setDeptModalError(err.message || 'Department creation failed.');
    } finally {
      setIsCreatingDept(false);
    }
  };

  const handleToggleDeptStatus = async (dept: Department) => {
    const newStatus = dept.status === 'active' ? 'inactive' : 'active';
    try {
      await api.updateDepartment(dept.id, {
        status: newStatus,
        is_active: newStatus === 'active'
      });
      await loadAdminData();
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    }
  };

  const handleResetHeadPassword = async (deptId: string) => {
    try {
      const resp = await api.resetHeadPassword(deptId, {});
      setRevealedCredentials(resp.credentials);
    } catch (err: any) {
      alert(`Reset failed: ${err.message}`);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 py-6">
      {/* Sidebar Navigation */}
      <aside className="lg:col-span-3 space-y-4 no-print">
        {/* Authority Badge */}
        <div className="bg-white rounded-2xl border border-[#CBD5E1] p-5 shadow-subtle space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#14243A] text-[#B99A62] flex items-center justify-center font-bold text-base shadow-xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="overflow-hidden">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#B99A62]">
                Platform Governance
              </span>
              <h3 className="font-bold text-sm text-[#14243A] truncate">
                Central Administrator
              </h3>
              <p className="text-xs text-[#64748B]">Platform-wide Authority</p>
            </div>
          </div>
          <div className="pt-2 border-t border-[#F1F5F9] text-xs text-[#64748B] flex items-center justify-between">
            <span>Signing Key</span>
            <span className="font-mono text-[10px] text-[#B99A62] font-semibold">seva-ed25519-v1</span>
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
            <span>Platform Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('departments')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-colors text-left ${
              activeTab === 'departments'
                ? 'bg-[#14243A] text-white font-semibold shadow-xs'
                : 'text-[#64748B] hover:text-[#14243A] hover:bg-[#F7F7F3]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Building2 className="w-4 h-4" />
              <span>Departments & Commands</span>
            </div>
            <span className="text-[11px] font-mono text-[#64748B]">{departments.length}</span>
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
              <span>Pass Applications</span>
            </div>
            <span className="text-[11px] font-mono text-[#64748B]">{applications.length}</span>
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
            <span className="text-[11px] font-mono text-[#64748B]">{issuedPasses.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('verifications')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-colors text-left ${
              activeTab === 'verifications'
                ? 'bg-[#14243A] text-white font-semibold shadow-xs'
                : 'text-[#64748B] hover:text-[#14243A] hover:bg-[#F7F7F3]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4" />
              <span>Toll Scans & Audits</span>
            </div>
            <span className="text-[11px] font-mono text-[#64748B]">{verificationLogs.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-colors text-left ${
              activeTab === 'audit'
                ? 'bg-[#14243A] text-white font-semibold shadow-xs'
                : 'text-[#64748B] hover:text-[#14243A] hover:bg-[#F7F7F3]'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Immutable Audit Logs</span>
          </button>
        </nav>
      </aside>

      {/* Main Content Pane */}
      <main className="lg:col-span-9 space-y-6">
        {/* TAB 1: OVERVIEW WITH REAL DATABASE STATS */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            {/* Header Banner */}
            <div className="bg-[#14243A] text-white rounded-2xl p-6 sm:p-8 border border-[#0C1728] shadow-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-[#B99A62]">
                  Central System Dashboard
                </span>
                <h2 className="text-2xl font-bold tracking-tight mt-1">
                  SEVA PASS Institutional Governance
                </h2>
                <p className="text-xs text-[#94A3B8] mt-1">
                  Active monitoring across all military command formations and toll verification checkpoints.
                </p>
              </div>

              <button
                onClick={() => setIsDeptModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#B99A62] text-[#0C1728] hover:bg-[#CEB482] transition-colors shadow-xs shrink-0"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create Department</span>
              </button>
            </div>

            {/* Actual Database-Derived Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-[#CBD5E1] p-5 shadow-subtle space-y-1">
                <span className="text-[11px] font-semibold text-[#64748B] block">Formations</span>
                <span className="text-2xl font-extrabold text-[#14243A]">
                  {stats.metrics.total_departments}
                </span>
                <p className="text-[10px] text-[#64748B]">Active command structures</p>
              </div>

              <div className="bg-white rounded-2xl border border-[#CBD5E1] p-5 shadow-subtle space-y-1">
                <span className="text-[11px] font-semibold text-[#64748B] block">Personnel</span>
                <span className="text-2xl font-extrabold text-[#14243A]">
                  {stats.metrics.total_personnel}
                </span>
                <p className="text-[10px] text-[#64748B]">Registered service officers</p>
              </div>

              <div className="bg-white rounded-2xl border border-[#CBD5E1] p-5 shadow-subtle space-y-1">
                <span className="text-[11px] font-semibold text-[#64748B] block">Total Applications</span>
                <span className="text-2xl font-extrabold text-[#14243A]">
                  {stats.metrics.total_applications}
                </span>
                <p className="text-[10px] text-[#64748B]">Pass requests logged</p>
              </div>

              <div className="bg-white rounded-2xl border border-[#CBD5E1] p-5 shadow-subtle space-y-1">
                <span className="text-[11px] font-semibold text-[#64748B] block">Active Passes</span>
                <span className="text-2xl font-extrabold text-emerald-700">
                  {stats.metrics.active_passes}
                </span>
                <p className="text-[10px] text-[#64748B]">Currently valid on highway</p>
              </div>

              <div className="bg-white rounded-2xl border border-[#CBD5E1] p-5 shadow-subtle space-y-1">
                <span className="text-[11px] font-semibold text-[#64748B] block">Pending Reviews</span>
                <span className="text-2xl font-extrabold text-[#B99A62]">
                  {stats.metrics.pending_applications}
                </span>
                <p className="text-[10px] text-[#64748B]">Awaiting command decision</p>
              </div>

              <div className="bg-white rounded-2xl border border-[#CBD5E1] p-5 shadow-subtle space-y-1">
                <span className="text-[11px] font-semibold text-[#64748B] block">Approved Passes</span>
                <span className="text-2xl font-extrabold text-emerald-700">
                  {stats.metrics.approved_applications}
                </span>
                <p className="text-[10px] text-[#64748B]">Issued & signed passes</p>
              </div>

              <div className="bg-white rounded-2xl border border-[#CBD5E1] p-5 shadow-subtle space-y-1">
                <span className="text-[11px] font-semibold text-[#64748B] block">Rejected Requests</span>
                <span className="text-2xl font-extrabold text-red-600">
                  {stats.metrics.rejected_applications}
                </span>
                <p className="text-[10px] text-[#64748B]">With recorded reasons</p>
              </div>

              <div className="bg-white rounded-2xl border border-[#CBD5E1] p-5 shadow-subtle space-y-1">
                <span className="text-[11px] font-semibold text-[#64748B] block">Toll Scans</span>
                <span className="text-2xl font-extrabold text-[#14243A]">
                  {stats.metrics.total_verifications}
                </span>
                <p className="text-[10px] text-[#64748B]">Verification events logged</p>
              </div>
            </div>

            {/* Department Breakdown Table */}
            <div className="bg-white rounded-2xl border border-[#CBD5E1] shadow-card overflow-hidden">
              <div className="p-5 border-b border-[#E2E8F0] flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-[#14243A]">Department & Formation Performance</h3>
                  <p className="text-xs text-[#64748B]">Live roll, request velocity and pass counts</p>
                </div>
                <button
                  onClick={() => setActiveTab('departments')}
                  className="text-xs font-semibold text-[#B99A62] hover:underline"
                >
                  Manage All
                </button>
              </div>

              <table className="w-full text-left text-xs">
                <thead className="bg-[#14243A] text-white">
                  <tr>
                    <th className="p-3.5 font-semibold">Formation Name</th>
                    <th className="p-3.5 font-semibold">Code</th>
                    <th className="p-3.5 font-semibold">Personnel</th>
                    <th className="p-3.5 font-semibold">Total Apps</th>
                    <th className="p-3.5 font-semibold">Pending</th>
                    <th className="p-3.5 font-semibold">Approved</th>
                    <th className="p-3.5 font-semibold">Active Passes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {stats.department_stats.map((d: any) => (
                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3.5 font-semibold text-[#14243A]">{d.name}</td>
                      <td className="p-3.5 font-mono font-bold text-slate-700">{d.code}</td>
                      <td className="p-3.5 text-slate-700">{d.personnel_count}</td>
                      <td className="p-3.5 text-slate-700 font-semibold">{d.total_apps}</td>
                      <td className="p-3.5 font-bold text-[#B99A62]">{d.pending_apps}</td>
                      <td className="p-3.5 font-bold text-emerald-700">{d.approved_apps}</td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {d.active_passes}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: DEPARTMENTS MANAGEMENT */}
        {activeTab === 'departments' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-[#14243A]">
                  Command Formations & Departments ({departments.length})
                </h3>
                <p className="text-xs text-[#64748B]">
                  Provision departments, assign department heads, and manage operational status.
                </p>
              </div>

              <button
                onClick={() => setIsDeptModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#14243A] text-white hover:bg-[#0C1728] transition-colors shadow-xs"
              >
                <PlusCircle className="w-4 h-4 text-[#B99A62]" />
                <span>Create Department</span>
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-[#CBD5E1] shadow-card overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#14243A] text-white">
                  <tr>
                    <th className="p-3.5 font-semibold">Formation Name</th>
                    <th className="p-3.5 font-semibold">Code</th>
                    <th className="p-3.5 font-semibold">Location</th>
                    <th className="p-3.5 font-semibold">Assigned Head</th>
                    <th className="p-3.5 font-semibold">Status</th>
                    <th className="p-3.5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {departments.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3.5">
                        <span className="font-bold text-[#14243A] block">{d.name}</span>
                        <span className="text-[10px] text-[#64748B]">{d.category}</span>
                      </td>
                      <td className="p-3.5 font-mono font-bold text-slate-700">{d.code}</td>
                      <td className="p-3.5 text-[#64748B]">{d.location || '—'}</td>
                      <td className="p-3.5">
                        {d.head_username ? (
                          <div>
                            <span className="font-mono text-xs font-bold text-[#14243A] block">
                              {d.head_username}
                            </span>
                            <span className="text-[10px] text-[#64748B]">
                              {d.head_officer_name || 'Assigned Officer'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-amber-700 font-semibold px-2 py-0.5 rounded bg-amber-50 border border-amber-200">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <button
                          onClick={() => handleToggleDeptStatus(d)}
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase transition-colors ${
                            d.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          }`}
                        >
                          {d.status}
                        </button>
                      </td>
                      <td className="p-3.5 text-right space-x-2">
                        {d.head_account_id && (
                          <button
                            onClick={() => handleResetHeadPassword(d.id)}
                            className="text-[11px] font-semibold text-[#B99A62] hover:underline"
                            title="Reset Head Password"
                          >
                            Reset Password
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: ALL PASS APPLICATIONS */}
        {activeTab === 'applications' && (
          <div className="space-y-5">
            <div>
              <h3 className="font-bold text-base text-[#14243A]">
                Platform-Wide Pass Applications ({applications.length})
              </h3>
              <p className="text-xs text-[#64748B]">
                Centralized registry of transit applications across all formations.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-[#CBD5E1] shadow-card overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#14243A] text-white">
                  <tr>
                    <th className="p-3.5 font-semibold">Application Ref</th>
                    <th className="p-3.5 font-semibold">Applicant</th>
                    <th className="p-3.5 font-semibold">Formation</th>
                    <th className="p-3.5 font-semibold">Vehicle</th>
                    <th className="p-3.5 font-semibold">Corridor</th>
                    <th className="p-3.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {applications.map((app) => (
                    <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-[#14243A]">
                        {app.application_number}
                      </td>
                      <td className="p-3.5">
                        <span className="font-semibold text-[#14243A] block">{app.applicant_name}</span>
                        <span className="text-[10px] text-[#64748B] font-mono">
                          {app.applicant_service_number}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-700">{app.department_name}</td>
                      <td className="p-3.5 font-mono font-bold text-slate-800">
                        {app.vehicle_registration_number}
                      </td>
                      <td className="p-3.5">
                        <span className="text-slate-700 block truncate max-w-[150px]">
                          {app.journey_origin} → {app.journey_destination}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            app.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : app.status === 'submitted'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {app.status === 'submitted' ? 'Pending' : app.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: ISSUED PASSES */}
        {activeTab === 'passes' && (
          <div className="space-y-5">
            <div>
              <h3 className="font-bold text-base text-[#14243A]">
                All Issued Passes Registry ({issuedPasses.length})
              </h3>
              <p className="text-xs text-[#64748B]">
                Cryptographically signed Ed25519 passes across all commands.
              </p>
            </div>

            <div className="space-y-6">
              {issuedPasses.map((p) => (
                <DigitalPassCard key={p.id} pass={p} />
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: TOLL VERIFICATIONS */}
        {activeTab === 'verifications' && (
          <div className="space-y-5">
            <div>
              <h3 className="font-bold text-base text-[#14243A]">
                Toll Plaza Verification Activity ({verificationLogs.length})
              </h3>
              <p className="text-xs text-[#64748B]">
                Real-time scanning events from optical lane cameras and web terminals.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-[#CBD5E1] shadow-card overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#14243A] text-white">
                  <tr>
                    <th className="p-3.5 font-semibold">Pass Code</th>
                    <th className="p-3.5 font-semibold">Toll Plaza</th>
                    <th className="p-3.5 font-semibold">Vehicle</th>
                    <th className="p-3.5 font-semibold">Verification Result</th>
                    <th className="p-3.5 font-semibold">Signature</th>
                    <th className="p-3.5 font-semibold">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {verificationLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-[#14243A]">
                        {log.pass_code || '—'}
                      </td>
                      <td className="p-3.5 text-slate-700">{log.toll_plaza_name}</td>
                      <td className="p-3.5 font-mono font-medium">
                        {log.scanned_vehicle_reg || log.authorised_vehicle_reg || '—'}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            log.verification_result === 'VALID'
                              ? 'bg-emerald-100 text-emerald-800'
                              : log.verification_result === 'REVOKED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {log.verification_result}
                        </span>
                      </td>
                      <td className="p-3.5">
                        {log.signature_valid ? (
                          <span className="text-emerald-700 font-semibold text-[11px]">Valid</span>
                        ) : (
                          <span className="text-red-600 font-semibold text-[11px]">Failed</span>
                        )}
                      </td>
                      <td className="p-3.5 text-[11px] text-[#64748B]">
                        {new Date(log.created_at).toLocaleString('en-GB')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 6: IMMUTABLE AUDIT LOGS */}
        {activeTab === 'audit' && (
          <div className="space-y-5">
            <div>
              <h3 className="font-bold text-base text-[#14243A]">
                Immutable Platform Audit Trail ({auditLogs.length})
              </h3>
              <p className="text-xs text-[#64748B]">
                Append-only record of security events, administrative actions, and pass issuances.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-[#CBD5E1] shadow-card overflow-hidden">
              <div className="divide-y divide-[#E2E8F0] text-xs">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#14243A]">
                          {log.event_type}
                        </span>
                        <span className="text-[11px] text-[#64748B]">
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

      {/* CREATE DEPARTMENT MODAL */}
      {isDeptModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-[#CBD5E1] shadow-elevated overflow-hidden animate-in fade-in">
            <div className="bg-[#14243A] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">Provision New Department Formation</h3>
              <button
                onClick={() => setIsDeptModalOpen(false)}
                className="p-1 rounded-md text-white/70 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDepartment} className="p-6 space-y-4">
              {deptModalError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-[#C44747]">
                  {deptModalError}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-[#14243A] block mb-1">
                  Department / Command Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Southern Command (HQ Pune)"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-xs bg-[#F7F7F3]"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#14243A] block mb-1">
                    Department Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SC-ARMY"
                    value={deptCode}
                    onChange={(e) => setDeptCode(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-xs font-mono font-bold uppercase bg-[#F7F7F3]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#14243A] block mb-1">
                    Classification
                  </label>
                  <select
                    value={deptCategory}
                    onChange={(e) => setDeptCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#CBD5E1] text-xs bg-[#F7F7F3]"
                  >
                    <option value="Command Headquarters">Command Headquarters</option>
                    <option value="Area Headquarters">Area Headquarters</option>
                    <option value="Sub-Area Cantonment">Sub-Area Cantonment</option>
                    <option value="Air Command">Air Command</option>
                    <option value="Naval Command">Naval Command</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#14243A] block mb-1">
                  Location / Station
                </label>
                <input
                  type="text"
                  placeholder="e.g. Pune, Maharashtra"
                  value={deptLocation}
                  onChange={(e) => setDeptLocation(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-xs bg-[#F7F7F3]"
                />
              </div>

              <div className="pt-2 border-t border-[#E2E8F0]">
                <label className="text-xs font-semibold text-[#14243A] block mb-1">
                  Department Head Username (Optional Provisioning)
                </label>
                <input
                  type="text"
                  placeholder="e.g. head.southern"
                  value={headUsername}
                  onChange={(e) => setHeadUsername(e.target.value.toLowerCase())}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-xs font-mono bg-[#F7F7F3]"
                />
                <p className="text-[10px] text-[#64748B] mt-1">
                  If set, a secure temporary password will be generated and displayed only once.
                </p>
              </div>

              <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsDeptModalOpen(false)}
                  disabled={isCreatingDept}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#64748B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingDept}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#14243A] text-white hover:bg-[#0C1728] transition-colors disabled:opacity-50"
                >
                  {isCreatingDept ? 'Creating...' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ONE-TIME CREDENTIAL DISPLAY MODAL */}
      {revealedCredentials && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-amber-300 shadow-elevated p-6 space-y-4 animate-in fade-in">
            <div className="flex items-center gap-2.5 text-amber-900">
              <KeyRound className="w-5 h-5 text-amber-600" />
              <h3 className="font-bold text-sm">Initial Management Credentials</h3>
            </div>

            <p className="text-xs text-[#64748B] leading-relaxed">
              These initial credentials have been generated for the Department Head account. This temporary password is displayed <strong>only once</strong> and must be changed on first login.
            </p>

            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Username:</span>
                <span className="font-bold text-[#14243A]">{revealedCredentials.username}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748B]">Temporary Password:</span>
                <span className="font-bold text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-300">
                  {revealedCredentials.temporary_password}
                </span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `SEVA PASS Credentials:\nUsername: ${revealedCredentials.username}\nTemporary Password: ${revealedCredentials.temporary_password}`
                  );
                  setCopiedKey(true);
                  setTimeout(() => setCopiedKey(false), 2000);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#F7F7F3] border border-[#CBD5E1] text-[#14243A] hover:bg-slate-100"
              >
                {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey ? 'Copied' : 'Copy Credentials'}</span>
              </button>

              <button
                type="button"
                onClick={() => setRevealedCredentials(null)}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#14243A] text-white hover:bg-[#0C1728]"
              >
                I have noted these credentials
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
