export type UserRole = 'CENTRAL_ADMIN' | 'DEPARTMENT_HEAD' | 'PERSONNEL' | 'TOLL_OPERATOR';

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  full_name: string;
  service_category: string;
  service_number: string;
  rank: string;
  phone?: string;
  role: UserRole;
  account_type: string;
  assigned_department_id?: string | null;
  department_name?: string | null;
  department_code?: string | null;
  status: string;
  must_change_password?: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  role: UserRole;
  account_type: string;
  must_change_password: boolean;
  redirect_path: string;
  user: UserProfile;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  category: string;
  location?: string;
  description?: string;
  status: string;
  is_active: number | boolean;
  service_name?: string;
  service_code?: string;
  head_officer_name?: string | null;
  head_officer_rank?: string | null;
  head_username?: string | null;
  head_email?: string | null;
  head_account_id?: string | null;
  personnel_count?: number;
  total_applications?: number;
  pending_applications?: number;
  approved_applications?: number;
  rejected_applications?: number;
  active_passes?: number;
  created_at?: string;
}

export interface PassApplication {
  id: string;
  application_number: string;
  applicant_id: string;
  applicant_name?: string;
  applicant_rank?: string;
  applicant_service_number?: string;
  applicant_service_category?: string;
  applicant_phone?: string;
  applicant_email?: string;
  department_id: string;
  department_name?: string;
  department_code?: string;
  vehicle_registration_number: string;
  vehicle_type: string;
  journey_origin: string;
  journey_destination: string;
  journey_purpose: string;
  journey_date: string;
  requested_start_time: string;
  requested_end_time: string;
  approved_start_time?: string | null;
  approved_end_time?: string | null;
  eligibility_basis: string;
  supporting_document_ref?: string | null;
  status: 'submitted' | 'approved' | 'rejected';
  rejection_reason?: string | null;
  admin_notes?: string | null;
  pass_code?: string | null;
  created_at: string;
}

export interface IssuedPass {
  id: string;
  pass_code: string;
  application_id: string;
  applicant_id: string;
  applicant_name?: string;
  applicant_rank?: string;
  applicant_service_number?: string;
  applicant_service_category?: string;
  department_id: string;
  department_name?: string;
  department_code?: string;
  department_location?: string;
  vehicle_registration_number: string;
  vehicle_type: string;
  journey_origin: string;
  journey_destination: string;
  journey_purpose: string;
  valid_from: string;
  valid_until: string;
  eligibility_basis: string;
  status: 'active' | 'expired' | 'revoked';
  signature_algorithm: string;
  key_id: string;
  signature_hex: string;
  canonical_payload_json?: string;
  qr_payload_encoded?: string;
  qr_data_url?: string;
  issued_by_name?: string;
  issued_at: string;
  created_at: string;
  revocation_reason?: string | null;
  revoked_at?: string | null;
}

export interface VerificationChecks {
  pass_found: boolean;
  signature_valid: boolean;
  not_expired: boolean;
  not_revoked: boolean;
  vehicle_matched: boolean;
  statutory_basis_established: boolean;
}

export interface VerificationResultData {
  pass_code: string;
  vehicle_registration?: string;
  authorized_vehicle?: string;
  scanned_vehicle?: string;
  vehicle_type?: string;
  department_name: string;
  department_code?: string;
  journey_origin?: string;
  journey_destination?: string;
  journey_purpose?: string;
  valid_from?: string;
  valid_until?: string;
  eligibility_basis?: string;
  signature_algorithm?: string;
  key_id?: string;
  issued_at?: string;
  revoked_at?: string;
  revocation_reason?: string;
}

export interface VerificationResponse {
  result: 'VALID' | 'INVALID' | 'EXPIRED' | 'REVOKED' | 'VEHICLE_MISMATCH' | 'MANUAL_REVIEW';
  message: string;
  pass_data?: VerificationResultData | null;
  verification_checks: VerificationChecks;
  log_id: string;
  timestamp: string;
}

export interface AuditLog {
  id: string;
  event_type: string;
  actor_id?: string | null;
  actor_email?: string | null;
  actor_role?: string | null;
  department_id?: string | null;
  department_name?: string | null;
  department_code?: string | null;
  entity_type: string;
  entity_id?: string | null;
  outcome: 'SUCCESS' | 'DENIED' | 'WARNING';
  details?: string | null;
  ip_address?: string | null;
  created_at: string;
}

export interface AdminOverviewStats {
  metrics: {
    total_departments: number;
    total_personnel: number;
    total_applications: number;
    pending_applications: number;
    approved_applications: number;
    rejected_applications: number;
    active_passes: number;
    inactive_or_expired_passes: number;
    total_verifications: number;
  };
  department_stats: Department[];
  recent_applications: any[];
  recent_passes: any[];
}

export interface DepartmentOverviewStats {
  department: {
    id: string;
    name: string;
    code: string;
    category: string;
    location: string;
  };
  metrics: {
    total_personnel: number;
    new_requests: number;
    pending_approvals: number;
    approved_applications: number;
    rejected_applications: number;
    active_passes: number;
  };
  pending_applications: PassApplication[];
}

export interface DemoAccount {
  role_label: string;
  role: string;
  username: string;
  email: string;
  password: string;
  description: string;
}
