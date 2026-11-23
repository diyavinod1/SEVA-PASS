from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

# Authentication
class LoginRequest(BaseModel):
    username_or_email: str
    password: str

class PersonnelRegisterRequest(BaseModel):
    username: str = Field(..., min_length=3)
    email: str
    password: str = Field(..., min_length=8)
    confirm_password: Optional[str] = None
    full_name: str
    service_category: str  # Army, Navy, Air Force, Coast Guard
    service_number: str  # Military Personnel ID
    rank: Optional[str] = "Major"
    phone: Optional[str] = ""
    assigned_department_id: Optional[str] = None
    vehicle_registration_number: Optional[str] = None
    vehicle_type: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    current_password: Optional[str] = None
    new_password: str = Field(..., min_length=8)

class UserProfileDTO(BaseModel):
    id: str
    username: str
    email: str
    full_name: str
    service_category: str
    service_number: str
    rank: str
    phone: Optional[str] = None
    role: str
    account_type: str
    assigned_department_id: Optional[str] = None
    department_name: Optional[str] = None
    department_code: Optional[str] = None
    status: str
    must_change_password: bool = False
    is_active: bool = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    account_type: str
    must_change_password: bool = False
    redirect_path: str
    user: Dict[str, Any]

# Department Management
class DepartmentCreate(BaseModel):
    name: str
    code: str
    service_id: str
    category: Optional[str] = "Command"
    location: Optional[str] = ""
    description: Optional[str] = ""
    status: Optional[str] = "active"
    head_personnel_id: Optional[str] = None  # Existing registered personnel ID
    head_username: Optional[str] = None      # Username for department head account
    head_temporary_password: Optional[str] = None

class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    service_id: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    is_active: Optional[bool] = None

class TransferHeadRequest(BaseModel):
    department_id: str
    new_head_personnel_id: str
    head_username: Optional[str] = None
    head_temporary_password: str = Field(..., min_length=8)

class ResetDeptHeadCredentialsRequest(BaseModel):
    department_id: str
    new_temporary_password: str = Field(..., min_length=8)

# Pass Applications
class PassApplicationCreate(BaseModel):
    department_id: str
    vehicle_registration_number: str
    vehicle_type: str
    journey_origin: str
    journey_destination: str
    journey_purpose: str
    journey_date: str  # YYYY-MM-DD
    requested_start_time: str
    requested_end_time: str
    eligibility_basis: Optional[str] = "Section 3(1)(a) Indian Tolls (Army and Air Force) Act 1901"
    supporting_document_ref: Optional[str] = None

class PassApplicationReview(BaseModel):
    application_id: str
    action: str  # "approve" or "reject"
    approved_start_time: Optional[str] = None
    approved_end_time: Optional[str] = None
    confirmed_vehicle_reg: Optional[str] = None
    admin_notes: Optional[str] = None
    rejection_reason: Optional[str] = None

class PassRevocationRequest(BaseModel):
    pass_id: str
    reason: str
    category: Optional[str] = "Administrative Cancellation"

# Verification
class PublicVerificationRequest(BaseModel):
    pass_code: Optional[str] = None
    qr_payload: Optional[str] = None
    scanned_vehicle_reg: Optional[str] = None
    toll_plaza_name: Optional[str] = "Public Verification Portal"

class VerificationResponse(BaseModel):
    result: str  # VALID, INVALID, EXPIRED, REVOKED, VEHICLE_MISMATCH, MANUAL_REVIEW
    message: str
    pass_data: Optional[Dict[str, Any]] = None
    verification_checks: Dict[str, Any]
    log_id: str
    timestamp: str

class DemoScenarioRunRequest(BaseModel):
    scenario_type: str  # "valid", "expired", "revoked", "tampered", "mismatch"
    toll_plaza_name: Optional[str] = "NH-44 Panipat Toll Plaza"
