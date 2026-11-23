import React, { useState, useEffect } from 'react';
import {
  User,
  Car,
  MapPin,
  Calendar,
  Clock,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Building2,
  FileText,
  BadgeCheck
} from 'lucide-react';
import { UserProfile, Department } from '../../types';
import { api } from '../../services/api';

interface PassApplicationWizardProps {
  currentUser: UserProfile;
  onSuccess: (appNumber: string) => void;
  onCancel: () => void;
}

export const PassApplicationWizard: React.FC<PassApplicationWizardProps> = ({
  currentUser,
  onSuccess,
  onCancel
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State preserved across steps
  const [formData, setFormData] = useState({
    // Step 1: Personnel
    full_name: currentUser.full_name || '',
    service_number: currentUser.service_number || '',
    rank: currentUser.rank || '',
    service_category: currentUser.service_category || 'Army',
    phone: currentUser.phone || '',
    department_id: currentUser.assigned_department_id || '',

    // Step 2: Vehicle
    vehicle_registration_number: '',
    vehicle_type: 'Light Military Utility / Staff SUV',
    supporting_document_ref: '',

    // Step 3: Journey
    journey_purpose: '',
    journey_origin: '',
    journey_destination: '',
    journey_date: new Date().toISOString().split('T')[0],
    start_time: '08:00',
    end_time: '20:00',
    eligibility_basis: 'Section 3(1)(a) Indian Tolls (Army and Air Force) Act 1901'
  });

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await api.getPublicDepartments();
        setDepartments(res as any);
        if (!formData.department_id && res.length > 0) {
          setFormData((prev) => ({ ...prev, department_id: res[0].id }));
        }
      } catch (err) {
        console.warn('Failed to load departments:', err);
      }
    };
    fetchDepartments();
  }, []);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateStep = (step: number): boolean => {
    setErrorMessage(null);
    if (step === 1) {
      if (!formData.department_id) {
        setErrorMessage('Please select an approving department / formation.');
        return false;
      }
      return true;
    }
    if (step === 2) {
      if (!formData.vehicle_registration_number.trim()) {
        setErrorMessage('Vehicle registration number is required.');
        return false;
      }
      return true;
    }
    if (step === 3) {
      if (!formData.journey_purpose.trim()) {
        setErrorMessage('Please specify the official purpose of the movement.');
        return false;
      }
      if (!formData.journey_origin.trim() || !formData.journey_destination.trim()) {
        setErrorMessage('Both journey origin and destination are required.');
        return false;
      }
      if (!formData.journey_date) {
        setErrorMessage('Journey date is required.');
        return false;
      }
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    const requested_start = `${formData.journey_date}T${formData.start_time}:00Z`;
    const requested_end = `${formData.journey_date}T${formData.end_time}:00Z`;

    try {
      const resp = await api.submitPassApplication({
        department_id: formData.department_id,
        vehicle_registration_number: formData.vehicle_registration_number.trim().toUpperCase(),
        vehicle_type: formData.vehicle_type,
        journey_origin: formData.journey_origin.trim(),
        journey_destination: formData.journey_destination.trim(),
        journey_purpose: formData.journey_purpose.trim(),
        journey_date: formData.journey_date,
        requested_start_time: requested_start,
        requested_end_time: requested_end,
        eligibility_basis: formData.eligibility_basis,
        supporting_document_ref: formData.supporting_document_ref.trim()
      });

      onSuccess(resp.application_number);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit pass application.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { number: 1, label: 'Personnel', icon: User },
    { number: 2, label: 'Vehicle', icon: Car },
    { number: 3, label: 'Journey Details', icon: MapPin },
    { number: 4, label: 'Review & Submit', icon: BadgeCheck }
  ];

  return (
    <div className="bg-white rounded-2xl border border-[#CBD5E1] shadow-card overflow-hidden">
      {/* Header with Step Progress */}
      <div className="bg-[#14243A] text-white px-6 py-5 border-b border-[#0C1728]">
        <h3 className="font-bold text-base tracking-tight mb-4">
          New Movement Pass Application
        </h3>

        {/* Step Indicators */}
        <div className="grid grid-cols-4 gap-2">
          {steps.map((s) => {
            const Icon = s.icon;
            const isCompleted = currentStep > s.number;
            const isCurrent = currentStep === s.number;
            return (
              <div
                key={s.number}
                className={`flex items-center gap-2 p-2 rounded-xl transition-colors ${
                  isCurrent
                    ? 'bg-white/15 text-white'
                    : isCompleted
                    ? 'text-[#B99A62]'
                    : 'text-white/40'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    isCurrent
                      ? 'bg-[#B99A62] text-[#0C1728]'
                      : isCompleted
                      ? 'bg-[#B99A62]/30 text-[#B99A62]'
                      : 'bg-white/10 text-white/50'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : s.number}
                </div>
                <span className="text-xs font-semibold hidden sm:inline">{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="p-6 sm:p-8 space-y-6">
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-[#C44747] flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STEP 1: PERSONNEL DETAILS */}
        {currentStep === 1 && (
          <div className="space-y-5 animate-in fade-in">
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-[#14243A]">Step 1: Verified Officer Profile</h4>
              <p className="text-xs text-[#64748B]">
                Your personnel credentials will be bound to the movement request.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-[#14243A] block mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  disabled
                  value={formData.full_name}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-xs bg-slate-100 text-slate-700"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#14243A] block mb-1">
                  Service / Personnel ID
                </label>
                <input
                  type="text"
                  disabled
                  value={formData.service_number}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-xs font-mono font-bold bg-slate-100 text-slate-700"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#14243A] block mb-1">
                  Rank / Designation
                </label>
                <input
                  type="text"
                  disabled
                  value={formData.rank}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-xs bg-slate-100 text-slate-700"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#14243A] block mb-1">
                  Contact Phone
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-xs bg-[#F7F7F3]"
                  placeholder="+91..."
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#14243A] block mb-1">
                Approving Department / Command *
              </label>
              <select
                value={formData.department_id}
                onChange={(e) => handleChange('department_id', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-xs bg-[#F7F7F3] font-medium"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-[#64748B] mt-1">
                This request will be routed directly to the Officer Commanding this department.
              </p>
            </div>
          </div>
        )}

        {/* STEP 2: VEHICLE DETAILS */}
        {currentStep === 2 && (
          <div className="space-y-5 animate-in fade-in">
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-[#14243A]">Step 2: Vehicle Information</h4>
              <p className="text-xs text-[#64748B]">
                Specify the vehicle being deployed for this movement order.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-[#14243A] block mb-1">
                  Vehicle Registration Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 21D 104523X"
                  value={formData.vehicle_registration_number}
                  onChange={(e) => handleChange('vehicle_registration_number', e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-xs font-mono font-bold uppercase focus:outline-hidden focus:border-[#14243A] bg-[#F7F7F3]"
                  autoFocus
                />
                <p className="text-[10px] text-[#64748B] mt-1">
                  Must match the physical plate scanned at the toll gate.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#14243A] block mb-1">
                  Vehicle Classification *
                </label>
                <select
                  value={formData.vehicle_type}
                  onChange={(e) => handleChange('vehicle_type', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#CBD5E1] text-xs bg-[#F7F7F3]"
                >
                  <option value="Light Military Utility / Staff SUV">Light Military Utility / Staff SUV</option>
                  <option value="Armoured Troop Carrier (Medium)">Armoured Troop Carrier (Medium)</option>
                  <option value="Heavy Convoy Logistics Truck">Heavy Convoy Logistics Truck</option>
                  <option value="Field Ambulance / Medical">Field Ambulance / Medical</option>
                  <option value="Official Staff Car">Official Staff Car</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-[#14243A] block mb-1">
                  Movement Order / Authority Document Ref (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. HQ-WC/OPS/2026/088"
                  value={formData.supporting_document_ref}
                  onChange={(e) => handleChange('supporting_document_ref', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-xs bg-[#F7F7F3]"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: JOURNEY DETAILS */}
        {currentStep === 3 && (
          <div className="space-y-5 animate-in fade-in">
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-[#14243A]">Step 3: Journey & Corridor Details</h4>
              <p className="text-xs text-[#64748B]">
                Define the authorized route and requested validity period.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#14243A] block mb-1">
                  Official Movement Purpose *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Operational logistics inspection and liaison"
                  value={formData.journey_purpose}
                  onChange={(e) => handleChange('journey_purpose', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-xs focus:outline-hidden focus:border-[#14243A] bg-[#F7F7F3]"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-[#14243A] block mb-1">
                    Origin Corridor / Cantonment *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HQ Western Command, Chandi Mandir"
                    value={formData.journey_origin}
                    onChange={(e) => handleChange('journey_origin', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-xs bg-[#F7F7F3]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#14243A] block mb-1">
                    Destination Station / Base *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sub-Area Ambala Cantt"
                    value={formData.journey_destination}
                    onChange={(e) => handleChange('journey_destination', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-xs bg-[#F7F7F3]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-[#14243A] block mb-1">
                    Journey Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.journey_date}
                    onChange={(e) => handleChange('journey_date', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-xs bg-[#F7F7F3]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#14243A] block mb-1">
                    Departure Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.start_time}
                    onChange={(e) => handleChange('start_time', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-xs bg-[#F7F7F3]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#14243A] block mb-1">
                    Estimated Arrival Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.end_time}
                    onChange={(e) => handleChange('end_time', e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-xs bg-[#F7F7F3]"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: REVIEW & SUBMIT */}
        {currentStep === 4 && (
          <div className="space-y-5 animate-in fade-in">
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-[#14243A]">Step 4: Final Summary & Confirmation</h4>
              <p className="text-xs text-[#64748B]">
                Verify all details before submitting to the Department Head for digital signing.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#F7F7F3] border border-[#E2E8F0] space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 pb-3 border-b border-[#E2E8F0]">
                <div>
                  <span className="text-[#64748B] block text-[10px] uppercase font-semibold">
                    Applicant
                  </span>
                  <span className="font-bold text-[#14243A] text-sm">{formData.full_name}</span>
                  <span className="text-[#64748B] block text-[11px] font-mono">
                    {formData.service_number} • {formData.rank}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B] block text-[10px] uppercase font-semibold">
                    Vehicle
                  </span>
                  <span className="font-bold font-mono text-[#14243A] text-sm">
                    {formData.vehicle_registration_number}
                  </span>
                  <span className="text-[#64748B] block text-[11px]">{formData.vehicle_type}</span>
                </div>
              </div>

              <div className="space-y-1 pb-3 border-b border-[#E2E8F0]">
                <span className="text-[#64748B] block text-[10px] uppercase font-semibold">
                  Movement Corridor
                </span>
                <div className="flex items-center gap-2 font-semibold text-[#14243A]">
                  <span>{formData.journey_origin}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#B99A62]" />
                  <span>{formData.journey_destination}</span>
                </div>
                <p className="text-[11px] text-[#64748B]">Purpose: {formData.journey_purpose}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[#64748B] block text-[10px] uppercase font-semibold">
                    Date & Validity
                  </span>
                  <span className="font-semibold text-[#14243A]">
                    {formData.journey_date} ({formData.start_time} — {formData.end_time})
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B] block text-[10px] uppercase font-semibold">
                    Statutory Ground
                  </span>
                  <span className="font-semibold text-[#14243A]">
                    Section 3(1)(a) Tolls Act 1901
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Wizard Controls */}
        <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-between">
          <div>
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[#14243A] border border-[#CBD5E1] hover:bg-slate-50 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#64748B] hover:text-[#14243A] transition-colors"
              >
                Cancel
              </button>
            )}
          </div>

          <div>
            {currentStep < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#14243A] text-white hover:bg-[#0C1728] transition-colors shadow-xs"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#B99A62]" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-semibold bg-[#B99A62] text-[#0C1728] hover:bg-[#CEB482] transition-colors shadow-xs disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Submitting Application...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Submit for Official Review</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
