import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Car,
  Building2,
  BadgeCheck,
  Phone,
  AlertCircle,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { api } from '../services/api';

interface RegisterPageProps {
  onNavigateLogin: () => void;
  onNavigateHome: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({
  onNavigateLogin,
  onNavigateHome
}) => {
  const [departments, setDepartments] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(true);

  // Form State
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [serviceCategory, setServiceCategory] = useState('Army');
  const [serviceNumber, setServiceNumber] = useState('');
  const [rank, setRank] = useState('Major');
  const [phone, setPhone] = useState('');
  const [assignedDepartmentId, setAssignedDepartmentId] = useState('');
  const [vehicleReg, setVehicleReg] = useState('');
  const [vehicleType, setVehicleType] = useState('Light Military Utility / Staff SUV');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const list = await api.getPublicDepartments();
        setDepartments(list);
        if (list.length > 0) {
          setAssignedDepartmentId(list[0].id);
        }
      } catch (err) {
        console.warn('Could not load public departments:', err);
      } finally {
        setIsLoadingDepartments(false);
      }
    };
    fetchDepartments();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (!serviceNumber.trim()) {
      setErrorMessage('Military service/personnel identifier is required.');
      return;
    }

    setIsLoading(true);

    try {
      const resp = await api.registerPersonnel({
        full_name: fullName.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        password,
        confirm_password: confirmPassword,
        service_category: serviceCategory,
        service_number: serviceNumber.trim().toUpperCase(),
        rank,
        phone: phone.trim(),
        assigned_department_id: assignedDepartmentId || undefined,
        vehicle_registration_number: vehicleReg ? vehicleReg.trim().toUpperCase() : undefined,
        vehicle_type: vehicleType
      });

      setSuccessMessage('Personnel account registered successfully! You may now sign in.');
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. Please review your details.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-10 px-4 sm:px-6">
      <div className="w-full max-w-2xl space-y-6">
        <div className="bg-white rounded-2xl border border-[#CBD5E1] shadow-card p-8 sm:p-10 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div
              className="w-12 h-12 rounded-xl bg-[#14243A] flex items-center justify-center text-[#B99A62] mx-auto shadow-sm cursor-pointer"
              onClick={onNavigateHome}
            >
              <ShieldCheck className="w-6 h-6 text-[#B99A62]" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-[#14243A]">
              Personnel Account Registration
            </h2>
            <p className="text-xs text-[#64748B]">
              Register your verified military service details to apply for digital transit passes.
            </p>
          </div>

          {/* Feedback Alerts */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-[#C44747] flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage ? (
            <div className="p-6 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-emerald-900">Registration Complete</h3>
                <p className="text-xs text-emerald-700 mt-1">{successMessage}</p>
              </div>
              <button
                onClick={onNavigateLogin}
                className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-[#14243A] text-white hover:bg-[#0C1728] transition-colors"
              >
                Proceed to Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Personal & Account Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-[#14243A] block mb-1">
                    Full Name (with Initials) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Major Priya Sharma"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-xs focus:outline-hidden focus:border-[#14243A] bg-[#F7F7F3]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#14243A] block mb-1">
                    Desired Username *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. priya.sharma"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-xs focus:outline-hidden focus:border-[#14243A] bg-[#F7F7F3]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#14243A] block mb-1">
                    Official Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. priya.sharma@sevapass.internal"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-xs focus:outline-hidden focus:border-[#14243A] bg-[#F7F7F3]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#14243A] block mb-1">
                    Contact Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. +91 98110 22345"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-xs focus:outline-hidden focus:border-[#14243A] bg-[#F7F7F3]"
                  />
                </div>
              </div>

              {/* Service & Military Identifier Section */}
              <div className="pt-2 border-t border-[#E2E8F0]">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-3">
                  Service Credentials & Command
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-[#14243A] block mb-1">
                      Armed Force / Branch *
                    </label>
                    <select
                      value={serviceCategory}
                      onChange={(e) => setServiceCategory(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-[#CBD5E1] text-xs focus:outline-hidden focus:border-[#14243A] bg-[#F7F7F3]"
                    >
                      <option value="Army">Indian Army</option>
                      <option value="Navy">Indian Navy</option>
                      <option value="Air Force">Indian Air Force</option>
                      <option value="Coast Guard">Coast Guard</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[#14243A] block mb-1">
                      Service / Personnel ID *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. IC-72418M"
                      value={serviceNumber}
                      onChange={(e) => setServiceNumber(e.target.value.toUpperCase())}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-xs font-mono font-semibold uppercase focus:outline-hidden focus:border-[#14243A] bg-[#F7F7F3]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[#14243A] block mb-1">
                      Designation / Rank *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Major"
                      value={rank}
                      onChange={(e) => setRank(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-xs focus:outline-hidden focus:border-[#14243A] bg-[#F7F7F3]"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="text-xs font-semibold text-[#14243A] block mb-1">
                    Assigned Formation / Department *
                  </label>
                  <select
                    value={assignedDepartmentId}
                    onChange={(e) => setAssignedDepartmentId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#CBD5E1] text-xs focus:outline-hidden focus:border-[#14243A] bg-[#F7F7F3]"
                    disabled={isLoadingDepartments}
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Password Section */}
              <div className="pt-2 border-t border-[#E2E8F0]">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-3">
                  Account Security
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-[#14243A] block mb-1">
                      Password (min. 8 characters) *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="Create strong password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-[#CBD5E1] text-xs focus:outline-hidden focus:border-[#14243A] bg-[#F7F7F3]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-3 text-[#64748B]"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[#14243A] block mb-1">
                      Confirm Password *
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Repeat password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-xs focus:outline-hidden focus:border-[#14243A] bg-[#F7F7F3]"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl font-semibold text-xs bg-[#14243A] text-white hover:bg-[#0C1728] transition-all shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
              >
                {isLoading ? (
                  <span>Registering Account...</span>
                ) : (
                  <>
                    <BadgeCheck className="w-4 h-4 text-[#B99A62]" />
                    <span>Complete Registration</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Sign In Link */}
          <div className="pt-4 border-t border-[#E2E8F0] text-center text-xs text-[#64748B]">
            <span>Already have an account? </span>
            <button
              onClick={onNavigateLogin}
              className="font-semibold text-[#14243A] hover:text-[#B99A62] transition-colors"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
