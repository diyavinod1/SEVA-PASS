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
  Check,
  Shield,
  Server,
  Database,
  Ban,
  UserCheck,
  UserX
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
  const [activeTab, setActiveTab] = useState<'overview' | 'departments' | 'personnel' | 'applications' | 'passes' | 'verifications' | 'security' | 'audit'>('overview');
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [applications, setApplications] = useState<PassApplication[]>([]);
  const [issuedPasses, setIssuedPasses] = useState<IssuedPass[]>([]);
  const [verificationLogs, setVerificationLogs] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [userSearch, setUserSearch] = useState('');
  const [userDeptFilter, setUserDeptFilter] = useState('all');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [appDeptFilter, setAppDeptFilter] = useState('all');
  const [appStatusFilter, setAppStatusFilter] = useState('all');
  const [passDeptFilter, setPassDeptFilter] = useState('all');
  const [passStatusFilter, setPassStatusFilter] = useState('all');

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

  // Revocation Modal State
  const [revokingPass, setRevokingPass] = useState<IssuedPass | null>(null);
  const [revocationReason, setRevocationReason] = useState('');
  const [revocationCategory, setRevocationCategory] = useState('Administrative Cancellation');
  const [isRevoking, setIsRevoking] = useState(false);
  const [revocationError, setRevocationError] = useState<string | null>(null);

  // User Role Reassignment Modal State
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [newRole, setNewRole] = useState<string>('PERSONNEL');
  const [newDeptId, setNewDeptId] = useState<string>('');
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  const [userUpdateError, setUserUpdateError] = useState<string | null>(null);

  const loadAdminData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, deptRes, usersRes, appsRes, passesRes, verifRes, auditRes] = await Promise.allSettled([
        api.getAdminOverviewStats(),
        api.listDepartments(),
        api.getUsers(),
        api.getAllApplications(),
        api.getAllIssuedPasses(),
        api.getVerificationLogs(50),
        api.getAuditLogs({ limit: 50 })
      ]);

      if (statsRes.status === 'fulfilled') setStats(statsRes.value);
      if (deptRes.status === 'fulfilled') setDepartments(deptRes.value.departments || []);
      if (usersRes.status === 'fulfilled') setUsers(usersRes.value.users || []);
      if (appsRes.status === 'fulfilled') setApplications(appsRes.value.applications || []);
      if (passesRes.status === 'fulfilled') setIssuedPasses(passesRes.value.passes || []);
      if (verifRes.status === 'fulfilled') setVerificationLogs(verifRes.value.logs || []);
      if (auditRes.status === 'fulfilled') setAuditLogs(auditRes.value.audit_logs || []);
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

  const handleToggleUserStatus = async (targetUser: UserProfile) => {
    if (targetUser.id === currentUser.id) {
      alert('You cannot deactivate your own Central Administrator account.');
      return;
    }
    const willBeActive = !(targetUser.is_active ?? true);
    const newStatus = willBeActive ? 'active' : 'suspended';
    try {
      await api.updateUserStatus(targetUser.id, {
        status: newStatus,
        is_active: willBeActive
      });
      await loadAdminData();
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  const handleOpenUserRoleModal = (u: UserProfile) => {
    setEditingUser(u);
    setNewRole(u.role);
    setNewDeptId(u.assigned_department_id || '');
    setUserUpdateError(null);
  };

  const handleSaveUserRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsUpdatingUser(true);
    setUserUpdateError(null);
    try {
      await api.updateUserRole(editingUser.id, {
        role: newRole,
        assigned_department_id: newDeptId || undefined
      });
      setEditingUser(null);
      await loadAdminData();
    } catch (err: any) {
      setUserUpdateError(err.message || 'Failed to update user role.');
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const handleConfirmRevocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokingPass) return;
    if (!revocationReason.trim() || revocationReason.trim().length < 5) {
      setRevocationError('A detailed reason (at least 5 characters) is required for revocation.');
      return;
    }

    setIsRevoking(true);
    setRevocationError(null);
    try {
      await api.revokePass({
        pass_id: revokingPass.id,
        reason: revocationReason.trim(),
        category: revocationCategory
      });
      setRevokingPass(null);
      setRevocationReason('');
      await loadAdminData();
    } catch (err: any) {
      setRevocationError(err.message || 'Revocation failed.');
    } finally {
      setIsRevoking(false);
    }
  };

  // Filtered Lists
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      !userSearch ||
      u.full_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.username?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.service_number?.toLowerCase().includes(userSearch.toLowerCase());
    const matchesDept = userDeptFilter === 'all' || u.assigned_department_id === userDeptFilter;
    const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    return matchesSearch && matchesDept && matchesRole;
  });

  const filteredApplications = applications.filter((app) => {
    const matchesDept = appDeptFilter === 'all' || app.department_id === appDeptFilter;
    const matchesStatus = appStatusFilter === 'all' || app.status?.toLowerCase() === appStatusFilter.toLowerCase();
    return matchesDept && matchesStatus;
  });

  const filteredPasses = issuedPasses.filter((p) => {
    const matchesDept = passDeptFilter === 'all' || p.department_id === passDeptFilter;
    const matchesStatus = passStatusFilter === 'all' || p.status?.toLowerCase() === passStatusFilter.toLowerCase();
    return matchesDept && matchesStatus;
  });

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
            <span className="font-mono text-[10px] text-[#B99A62] font-semibold">
              {stats?.security_info?.key_id || 'seva-ed25519-v1'}
            </span>
          </div>
          <div className="text-xs text-[#64748B] flex items-center justify-between">
            <span>DB Engine</span>
            <span className="font-mono text-[10px] uppercase font-semibold text-emerald-700">
              {stats?.security_info?.db_mode || 'POSTGRESQL'}
            </span>
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
            onClick={() => setActiveTab('personnel')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-colors text-left ${
              activeTab === 'personnel'
                ? 'bg-[#14243A] text-white font-semibold shadow-xs'
                : 'text-[#64748B] hover:text-[#14243A] hover:bg-[#F7F7F3]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Users className="w-4 h-4" />
              <span>Personnel Management</span>
            </div>
            <span className="text-[11px] font-mono text-[#64748B]">{users.length}</span>
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
              <span>Issued Passes Registry</span>
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
            onClick={() => setActiveTab('security')}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-colors text-left ${
              activeTab === 'security'
                ? 'bg-[#14243A] text-white font-semibold shadow-xs'
                : 'text-[#64748B] hover:text-[#14243A] hover:bg-[#F7F7F3]'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Cryptographic Security</span>
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
        {activeTab === 'overview' && (
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

              <div className="flex items-center gap-2">
                <button
                  onClick={loadAdminData}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-white/10 text-white hover:bg-white/20 transition-colors"
                  title="Refresh Dashboard"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Refresh</span>
                </button>
                <button
                  onClick={() => setIsDeptModalOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#B99A62] text-[#0C1728] hover:bg-[#CEB482] transition-colors shadow-xs shrink-0"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Create Department</span>
                </button>
              </div>
            </div>

            {/* Actual Database-Derived Metrics Grid */}
            {stats && (
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
                  <span className="text-[11px] font-semibold text-[#64748B] block">Revoked Passes</span>
                  <span className="text-2xl font-extrabold text-red-600">
                    {stats.metrics.revoked_passes ?? 0}
                  </span>
                  <p className="text-[10px] text-[#64748B]">Administrative cancellations</p>
                </div>

                <div className="bg-white rounded-2xl border border-[#CBD5E1] p-5 shadow-subtle space-y-1">
                  <span className="text-[11px] font-semibold text-[#64748B] block">Toll Scans</span>
                  <span className="text-2xl font-extrabold text-[#14243A]">
                    {stats.metrics.total_verifications}
                  </span>
                  <p className="text-[10px] text-[#64748B]">
                    {stats.metrics.successful_verifications ?? 0} Valid / {stats.metrics.failed_verifications ?? 0} Exceptions
                  </p>
                </div>
              </div>
            )}

            {/* Department Breakdown Table */}
            {stats && stats.department_stats && (
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
                    Manage All Formations
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
            )}
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

        {/* TAB 3: PERSONNEL MANAGEMENT */}
        {activeTab === 'personnel' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-base text-[#14243A]">
                  Personnel Registry & Account Governance ({filteredUsers.length} of {users.length})
                </h3>
                <p className="text-xs text-[#64748B]">
                  Manage service officers, department affiliations, and account activation statuses.
                </p>
              </div>
            </div>

            {/* Filters Row */}
            <div className="bg-white rounded-2xl border border-[#CBD5E1] p-4 shadow-subtle flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-3 text-[#64748B]" />
                <input
                  type="text"
                  placeholder="Search by name, service number, username, or email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#CBD5E1] text-xs bg-[#F7F7F3]"
                />
              </div>

              <select
                value={userDeptFilter}
                onChange={(e) => setUserDeptFilter(e.target.value)}
                className="w-full sm:w-48 px-3 py-2 rounded-xl border border-[#CBD5E1] text-xs bg-[#F7F7F3]"
              >
                <option value="all">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>

              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="w-full sm:w-40 px-3 py-2 rounded-xl border border-[#CBD5E1] text-xs bg-[#F7F7F3]"
              >
                <option value="all">All Roles</option>
                <option value="PERSONNEL">Personnel</option>
                <option value="DEPARTMENT_HEAD">Department Head</option>
                <option value="CENTRAL_ADMIN">Central Admin</option>
              </select>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-2xl border border-[#CBD5E1] shadow-card overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#14243A] text-white">
                  <tr>
                    <th className="p-3.5 font-semibold">Service Member</th>
                    <th className="p-3.5 font-semibold">Account / Email</th>
                    <th className="p-3.5 font-semibold">Department</th>
                    <th className="p-3.5 font-semibold">Role</th>
                    <th className="p-3.5 font-semibold">Status</th>
                    <th className="p-3.5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3.5">
                        <span className="font-bold text-[#14243A] block">
                          {u.full_name} {u.rank ? `(${u.rank})` : ''}
                        </span>
                        <span className="text-[10px] text-[#64748B] font-mono">
                          {u.service_number || 'N/A'} {u.service_category ? `• ${u.service_category}` : ''}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono">
                        <span className="text-slate-800 font-semibold block">{u.username}</span>
                        <span className="text-[10px] text-[#64748B]">{u.email}</span>
                      </td>
                      <td className="p-3.5 text-slate-700">
                        {u.department_name ? (
                          <div>
                            <span className="font-medium text-slate-800 block">{u.department_name}</span>
                            <span className="text-[10px] font-mono text-[#64748B]">{u.department_code}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.role === 'CENTRAL_ADMIN'
                              ? 'bg-purple-100 text-purple-800'
                              : u.role === 'DEPARTMENT_HEAD'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            (u.is_active ?? true)
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {(u.is_active ?? true) ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="p-3.5 text-right space-x-2">
                        <button
                          onClick={() => handleToggleUserStatus(u)}
                          className={`text-[11px] font-semibold hover:underline ${
                            (u.is_active ?? true) ? 'text-red-600' : 'text-emerald-700'
                          }`}
                        >
                          {(u.is_active ?? true) ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleOpenUserRoleModal(u)}
                          className="text-[11px] font-semibold text-[#B99A62] hover:underline"
                        >
                          Edit Role
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-xs text-[#64748B]">
                        No user profiles match the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: ALL PASS APPLICATIONS */}
        {activeTab === 'applications' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-base text-[#14243A]">
                  Platform-Wide Pass Applications ({filteredApplications.length} of {applications.length})
                </h3>
                <p className="text-xs text-[#64748B]">
                  Centralized registry of transit applications across all formations.
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                <select
                  value={appDeptFilter}
                  onChange={(e) => setAppDeptFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-[#CBD5E1] text-xs bg-white"
                >
                  <option value="all">All Formations</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>

                <select
                  value={appStatusFilter}
                  onChange={(e) => setAppStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-[#CBD5E1] text-xs bg-white"
                >
                  <option value="all">All Statuses</option>
                  <option value="submitted">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
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
                  {filteredApplications.map((app) => (
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
                  {filteredApplications.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-xs text-[#64748B]">
                        No pass applications match the selected criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: ISSUED PASSES WITH REVOCATION GOVERNANCE */}
        {activeTab === 'passes' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-base text-[#14243A]">
                  All Issued Passes Registry ({filteredPasses.length} of {issuedPasses.length})
                </h3>
                <p className="text-xs text-[#64748B]">
                  Cryptographically signed Ed25519 passes across all commands with administrative revocation authority.
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                <select
                  value={passDeptFilter}
                  onChange={(e) => setPassDeptFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-[#CBD5E1] text-xs bg-white"
                >
                  <option value="all">All Formations</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>

                <select
                  value={passStatusFilter}
                  onChange={(e) => setPassStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-[#CBD5E1] text-xs bg-white"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="revoked">Revoked</option>
                </select>
              </div>
            </div>

            <div className="space-y-6">
              {filteredPasses.map((p) => (
                <div key={p.id} className="relative">
                  <DigitalPassCard pass={p} />
                  {p.status === 'active' && (
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={() => {
                          setRevokingPass(p);
                          setRevocationReason('');
                          setRevocationError(null);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition-colors"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Revoke Pass</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {filteredPasses.length === 0 && (
                <div className="bg-white rounded-2xl border border-[#CBD5E1] p-12 text-center text-xs text-[#64748B]">
                  No issued passes match the selected filters.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 6: TOLL VERIFICATIONS */}
        {activeTab === 'verifications' && (
          <div className="space-y-5">
            <div>
              <h3 className="font-bold text-base text-[#14243A]">
                Toll Plaza Verification Activity ({verificationLogs.length})
              </h3>
              <p className="text-xs text-[#64748B]">
                Real-time scanning events from QR scanners, camera uploads, and web terminals.
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
                  {verificationLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-xs text-[#64748B]">
                        No verification events recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 7: CRYPTOGRAPHIC SECURITY & SYSTEM AUDIT */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <div>
              <h3 className="font-bold text-base text-[#14243A]">
                Cryptographic Key & System Security Overview
              </h3>
              <p className="text-xs text-[#64748B]">
                Verification authority parameters, algorithm specifications, and infrastructure health.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: Ed25519 Authority */}
              <div className="bg-white rounded-2xl border border-[#CBD5E1] p-6 shadow-subtle space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#14243A] text-[#B99A62] flex items-center justify-center">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#14243A]">Ed25519 Signing Authority</h4>
                    <p className="text-[11px] text-[#64748B]">Digital Signature Engine</p>
                  </div>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Algorithm:</span>
                    <span className="font-semibold text-[#14243A]">Ed25519 (RFC 8032 / FIPS 186-5)</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Active Key ID:</span>
                    <span className="font-mono font-bold text-[#B99A62]">{stats?.security_info?.key_id || 'seva-ed25519-v1'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Public Key Fingerprint:</span>
                    <span className="font-mono text-slate-800">{stats?.security_info?.public_key_fingerprint || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Private Key Storage:</span>
                    <span className="font-semibold text-emerald-700">Encrypted Environment Variable (Never Exported)</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-[#64748B]">Public Verification:</span>
                    <span className="font-semibold text-emerald-700">Enabled (Open RFC 8032 Endpoint)</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Infrastructure Health */}
              <div className="bg-white rounded-2xl border border-[#CBD5E1] p-6 shadow-subtle space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#14243A]">Database & Platform Health</h4>
                    <p className="text-[11px] text-[#64748B]">Persistence and Security Parameters</p>
                  </div>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Database Mode:</span>
                    <span className="font-mono font-bold uppercase text-emerald-700">{stats?.security_info?.db_mode || 'POSTGRESQL'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Supabase Connection:</span>
                    <span className="font-semibold text-emerald-700">
                      {stats?.security_info?.supabase_connected ? 'Connected & Verified' : 'Local Persistence'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Environment:</span>
                    <span className="font-mono uppercase font-semibold text-slate-800">{stats?.security_info?.environment || 'development'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#F1F5F9]">
                    <span className="text-[#64748B]">Audit Logging:</span>
                    <span className="font-semibold text-emerald-700">Active (Append-Only)</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-[#64748B]">Token Authentication:</span>
                    <span className="font-semibold text-slate-800">JWT HS256 with RBAC</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Note banner */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-[#64748B] flex items-start gap-3">
              <Lock className="w-4 h-4 text-[#B99A62] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-[#14243A] block">Zero-Trust Cryptographic Assurance:</span>
                Every transit pass issued by SEVA PASS is signed using the server-side Ed25519 private key. Public toll verification terminals independently compute the digital signature against the published public key without contacting internal databases or accessing private personnel identifiers.
              </div>
            </div>
          </div>
        )}

        {/* TAB 8: IMMUTABLE AUDIT LOGS */}
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
                {auditLogs.length === 0 && (
                  <div className="p-8 text-center text-xs text-[#64748B]">
                    No audit records logged yet.
                  </div>
                )}
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

      {/* PASS REVOCATION MODAL */}
      {revokingPass && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-red-200 shadow-elevated overflow-hidden animate-in fade-in">
            <div className="bg-red-800 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ban className="w-5 h-5" />
                <h3 className="font-bold text-sm">Revoke Issued Pass</h3>
              </div>
              <button
                onClick={() => setRevokingPass(null)}
                className="p-1 rounded-md text-white/70 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmRevocation} className="p-6 space-y-4">
              {revocationError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-[#C44747]">
                  {revocationError}
                </div>
              )}

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Pass Code:</span>
                  <span className="font-mono font-bold text-[#14243A]">{revokingPass.pass_code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Vehicle:</span>
                  <span className="font-mono text-slate-800">{revokingPass.vehicle_registration_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Applicant:</span>
                  <span className="text-slate-800">{revokingPass.applicant_name}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#14243A] block mb-1">
                  Revocation Category *
                </label>
                <select
                  value={revocationCategory}
                  onChange={(e) => setRevocationCategory(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#CBD5E1] text-xs bg-[#F7F7F3]"
                >
                  <option value="Administrative Cancellation">Administrative Cancellation</option>
                  <option value="Disciplinary Suspension">Disciplinary Suspension</option>
                  <option value="Journey Cancelled">Journey Cancelled</option>
                  <option value="Vehicle Unserviceable">Vehicle Unserviceable</option>
                  <option value="Security Violation">Security Violation</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#14243A] block mb-1">
                  Revocation Justification / Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="State the formal reason for revoking this toll pass..."
                  value={revocationReason}
                  onChange={(e) => setRevocationReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-xs bg-[#F7F7F3]"
                />
              </div>

              <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRevokingPass(null)}
                  disabled={isRevoking}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#64748B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRevoking}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-red-700 text-white hover:bg-red-800 transition-colors disabled:opacity-50"
                >
                  {isRevoking ? 'Revoking...' : 'Confirm Revocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* USER ROLE REASSIGNMENT MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-[#CBD5E1] shadow-elevated overflow-hidden animate-in fade-in">
            <div className="bg-[#14243A] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">Update User Role & Assignment</h3>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1 rounded-md text-white/70 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUserRole} className="p-6 space-y-4">
              {userUpdateError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-[#C44747]">
                  {userUpdateError}
                </div>
              )}

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#64748B]">User:</span>
                  <span className="font-bold text-[#14243A]">{editingUser.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Username:</span>
                  <span className="font-mono text-slate-800">{editingUser.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Current Role:</span>
                  <span className="font-mono text-[#B99A62]">{editingUser.role}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#14243A] block mb-1">
                  Assign Platform Role *
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#CBD5E1] text-xs bg-[#F7F7F3]"
                >
                  <option value="PERSONNEL">Personnel</option>
                  <option value="DEPARTMENT_HEAD">Department Head</option>
                  <option value="CENTRAL_ADMIN">Central Administrator</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#14243A] block mb-1">
                  Assigned Department / Formation
                </label>
                <select
                  value={newDeptId}
                  onChange={(e) => setNewDeptId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#CBD5E1] text-xs bg-[#F7F7F3]"
                >
                  <option value="">No Department Assigned</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  disabled={isUpdatingUser}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#64748B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingUser}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#14243A] text-white hover:bg-[#0C1728] transition-colors disabled:opacity-50"
                >
                  {isUpdatingUser ? 'Saving...' : 'Save Role Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
