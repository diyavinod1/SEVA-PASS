import {
  AuthResponse,
  UserProfile,
  Department,
  PassApplication,
  IssuedPass,
  VerificationResponse,
  AuditLog,
  AdminOverviewStats,
  DepartmentOverviewStats,
  DemoAccount
} from '../types';

const resolveApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    const { hostname } = window.location;
    if (hostname.includes('onrender.com')) {
      return 'https://seva-pass-api.onrender.com';
    }
  }
  return 'http://127.0.0.1:8000';
};

const API_BASE_URL = resolveApiBaseUrl();
const TOKEN_KEY = 'sevapass_auth_token';

export const getAuthToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const setAuthToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const removeAuthToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errorDetail = 'An unexpected error occurred.';
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.detail || errorJson.message || JSON.stringify(errorJson);
    } catch {
      errorDetail = `Request failed with HTTP status ${response.status}: ${response.statusText}`;
    }
    if (response.status === 401) {
      removeAuthToken();
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

export const api = {
  // Authentication
  login: (data: { username_or_email: string; password: string }): Promise<AuthResponse> => {
    return request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  registerPersonnel: (data: any): Promise<{ status: string; message: string; user_id: string }> => {
    return request<{ status: string; message: string; user_id: string }>('/api/auth/register-personnel', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  getMe: (): Promise<{ user: UserProfile }> => {
    return request<{ user: UserProfile }>('/api/auth/me');
  },

  changePassword: (data: { current_password?: string; new_password: string }): Promise<{ status: string; message: string }> => {
    return request<{ status: string; message: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  getDemoAccounts: (): Promise<{ status: string; notice: string; accounts: DemoAccount[] }> => {
    return request<{ status: string; notice: string; accounts: DemoAccount[] }>('/api/auth/demo-accounts');
  },

  getUsers: (params: { department_id?: string; role?: string; search?: string; status_filter?: string } = {}): Promise<{ users: UserProfile[]; total: number }> => {
    const query = new URLSearchParams();
    if (params.department_id) query.append('department_id', params.department_id);
    if (params.role) query.append('role', params.role);
    if (params.search) query.append('search', params.search);
    if (params.status_filter) query.append('status_filter', params.status_filter);
    const qStr = query.toString() ? `?${query.toString()}` : '';
    return request<{ users: UserProfile[]; total: number }>(`/api/auth/users${qStr}`);
  },

  updateUserStatus: (userId: string, data: { status?: string; is_active?: boolean }): Promise<{ status: string; message: string }> => {
    return request<{ status: string; message: string }>(`/api/auth/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  updateUserRole: (userId: string, data: { role: string; assigned_department_id?: string; account_type?: string }): Promise<{ status: string; message: string }> => {
    return request<{ status: string; message: string }>(`/api/auth/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  // Departments
  getPublicDepartments: (): Promise<Array<{ id: string; code: string; name: string; category: string; location?: string; service_name: string }>> => {
    return request<Array<{ id: string; code: string; name: string; category: string; location?: string; service_name: string }>>('/api/departments/public');
  },

  listDepartments: (): Promise<{ departments: Department[] }> => {
    return request<{ departments: Department[] }>('/api/departments/');
  },

  getDepartmentDetails: (id: string): Promise<{ department: Department; recent_activity: any[] }> => {
    return request<{ department: Department; recent_activity: any[] }>(`/api/departments/${id}`);
  },

  createDepartment: (data: any): Promise<{ status: string; message: string; department_id: string; credentials?: any }> => {
    return request<{ status: string; message: string; department_id: string; credentials?: any }>('/api/departments/', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateDepartment: (id: string, data: any): Promise<{ status: string; message: string }> => {
    return request<{ status: string; message: string }>(`/api/departments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  assignDepartmentHead: (id: string, data: any): Promise<{ status: string; message: string; credentials: any }> => {
    return request<{ status: string; message: string; credentials: any }>(`/api/departments/${id}/assign-head`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  resetHeadPassword: (id: string, data: any): Promise<{ status: string; message: string; credentials: any }> => {
    return request<{ status: string; message: string; credentials: any }>(`/api/departments/${id}/reset-head-password`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  getDepartmentPersonnel: (id: string): Promise<{ personnel: any[] }> => {
    return request<{ personnel: any[] }>(`/api/departments/${id}/personnel`);
  },

  // Pass Applications & Issuance
  submitPassApplication: (data: any): Promise<{ status: string; message: string; application_id: string; application_number: string }> => {
    return request<{ status: string; message: string; application_id: string; application_number: string }>('/api/passes/apply', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  getMyApplications: (statusFilter?: string): Promise<{ applications: PassApplication[] }> => {
    const q = statusFilter ? `?status_filter=${encodeURIComponent(statusFilter)}` : '';
    return request<{ applications: PassApplication[] }>(`/api/passes/my-applications${q}`);
  },

  getMyCurrentPasses: (): Promise<{ passes: IssuedPass[] }> => {
    return request<{ passes: IssuedPass[] }>('/api/passes/my-current-passes');
  },

  getMyPassHistory: (): Promise<{ history: IssuedPass[] }> => {
    return request<{ history: IssuedPass[] }>('/api/passes/my-pass-history');
  },

  getDepartmentApplications: (statusFilter?: string): Promise<{ applications: PassApplication[] }> => {
    const q = statusFilter ? `?status_filter=${encodeURIComponent(statusFilter)}` : '';
    return request<{ applications: PassApplication[] }>(`/api/passes/department-applications${q}`);
  },

  reviewPassApplication: (data: { application_id: string; action: string; rejection_reason?: string; admin_notes?: string; approved_start_time?: string; approved_end_time?: string }): Promise<any> => {
    return request<any>('/api/passes/review', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  getAllApplications: (params?: { statusFilter?: string; department_id?: string; start_date?: string; end_date?: string } | string): Promise<{ applications: PassApplication[] }> => {
    const query = new URLSearchParams();
    if (typeof params === 'string') {
      if (params) query.append('status_filter', params);
    } else if (params) {
      if (params.statusFilter) query.append('status_filter', params.statusFilter);
      if (params.department_id) query.append('department_id', params.department_id);
      if (params.start_date) query.append('start_date', params.start_date);
      if (params.end_date) query.append('end_date', params.end_date);
    }
    const q = query.toString() ? `?${query.toString()}` : '';
    return request<{ applications: PassApplication[] }>(`/api/passes/all-applications${q}`);
  },

  getAllIssuedPasses: (params?: { statusFilter?: string; department_id?: string; start_date?: string; end_date?: string } | string): Promise<{ passes: IssuedPass[] }> => {
    const query = new URLSearchParams();
    if (typeof params === 'string') {
      if (params) query.append('status_filter', params);
    } else if (params) {
      if (params.statusFilter) query.append('status_filter', params.statusFilter);
      if (params.department_id) query.append('department_id', params.department_id);
      if (params.start_date) query.append('start_date', params.start_date);
      if (params.end_date) query.append('end_date', params.end_date);
    }
    const q = query.toString() ? `?${query.toString()}` : '';
    return request<{ passes: IssuedPass[] }>(`/api/passes/all-issued-passes${q}`);
  },

  revokePass: (data: { pass_id: string; reason: string; category?: string }): Promise<{ status: string; message: string; pass_id: string }> => {
    return request<{ status: string; message: string; pass_id: string }>('/api/passes/revoke', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  getPassDetails: (passId: string): Promise<{ pass: IssuedPass }> => {
    return request<{ pass: IssuedPass }>(`/api/passes/${passId}`);
  },

  // Verification (Public & Authenticated)
  verifyPassPublic: (data: { pass_code?: string; qr_payload?: string; scanned_vehicle_reg?: string; toll_plaza_name?: string }): Promise<VerificationResponse> => {
    return request<VerificationResponse>('/api/verification/verify-public', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  getVerificationLogs: (limit = 50): Promise<{ logs: any[] }> => {
    return request<{ logs: any[] }>(`/api/verification/logs?limit=${limit}`);
  },

  simulateVerificationScenario: (scenarioType: string, tollPlazaName?: string): Promise<VerificationResponse> => {
    return request<VerificationResponse>('/api/verification/simulate-scenario', {
      method: 'POST',
      body: JSON.stringify({ scenario_type: scenarioType, toll_plaza_name: tollPlazaName })
    });
  },

  getVerificationPublicKey: (): Promise<any> => {
    return request<any>('/api/verification/public-key');
  },

  // Statistics & Analytics
  getAdminOverviewStats: (): Promise<AdminOverviewStats> => {
    return request<AdminOverviewStats>('/api/stats/admin-overview');
  },

  getDepartmentOverviewStats: (): Promise<DepartmentOverviewStats> => {
    return request<DepartmentOverviewStats>('/api/stats/department-overview');
  },

  // Audit Logs
  getAuditLogs: (params: { event_type?: string; department_id?: string; outcome?: string; limit?: number } = {}): Promise<{ audit_logs: AuditLog[] }> => {
    const query = new URLSearchParams();
    if (params.event_type) query.append('event_type', params.event_type);
    if (params.department_id) query.append('department_id', params.department_id);
    if (params.outcome) query.append('outcome', params.outcome);
    if (params.limit) query.append('limit', params.limit.toString());
    const qStr = query.toString() ? `?${query.toString()}` : '';
    return request<{ audit_logs: AuditLog[] }>(`/api/audit/${qStr}`);
  },

  // Environment & Supabase Status
  getConfigStatus: (): Promise<any> => {
    return request<any>('/api/config/status');
  },

  getSupabaseBackendStatus: (): Promise<any> => {
    return request<any>('/api/supabase/status');
  }
};
