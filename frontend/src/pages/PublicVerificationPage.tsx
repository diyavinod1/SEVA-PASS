import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  QrCode,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Car,
  MapPin,
  ArrowRight,
  Lock,
  RefreshCw,
  Camera,
  FileCheck2,
  Sparkles,
  Info,
  ShieldAlert
} from 'lucide-react';
import { api } from '../services/api';
import { VerificationResponse, VerificationResultData } from '../types';
import { QRScannerModal } from '../components/QRScannerModal';

interface PublicVerificationPageProps {
  initialCode?: string;
}

export const PublicVerificationPage: React.FC<PublicVerificationPageProps> = ({
  initialCode = ''
}) => {
  const [passCodeInput, setPassCodeInput] = useState(initialCode);
  const [scannedPlateInput, setScannedPlateInput] = useState('');
  const [tollPlazaInput, setTollPlazaInput] = useState('NH-44 Panipat Toll Plaza');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResponse | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [scannerModalOpen, setScannerModalOpen] = useState(false);

  useEffect(() => {
    if (initialCode) {
      setPassCodeInput(initialCode);
      executeVerification({ pass_code: initialCode });
    }
  }, [initialCode]);

  const executeVerification = async (params: {
    pass_code?: string;
    qr_payload?: string;
    scanned_vehicle_reg?: string;
  }) => {
    setIsVerifying(true);
    setErrorNotice(null);
    setVerificationResult(null);

    try {
      const resp = await api.verifyPassPublic({
        pass_code: params.pass_code,
        qr_payload: params.qr_payload,
        scanned_vehicle_reg: params.scanned_vehicle_reg || (scannedPlateInput ? scannedPlateInput.trim() : undefined),
        toll_plaza_name: tollPlazaInput.trim()
      });
      setVerificationResult(resp);
    } catch (err: any) {
      setErrorNotice(err.message || 'Verification could not be processed.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passCodeInput.trim()) {
      setErrorNotice('Please enter a SEVA PASS reference code or use the camera scanner.');
      return;
    }
    executeVerification({ pass_code: passCodeInput.trim().toUpperCase() });
  };

  const handleSimulateScenario = async (scenarioType: string) => {
    setIsVerifying(true);
    setErrorNotice(null);
    setVerificationResult(null);

    try {
      const resp = await api.simulateVerificationScenario(scenarioType, tollPlazaInput);
      setVerificationResult(resp);
      if (resp.pass_data?.pass_code) {
        setPassCodeInput(resp.pass_data.pass_code);
      }
    } catch (err: any) {
      setErrorNotice(err.message || 'Simulation test failed.');
    } finally {
      setIsVerifying(false);
    }
  };

  const getStatusBadge = (res: VerificationResponse['result']) => {
    switch (res) {
      case 'VALID':
        return (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm tracking-tight text-emerald-950">
                  PASS VALID & AUTHORISED
                </h3>
                <p className="text-xs text-emerald-700">
                  Ed25519 digital signature verified. Transit authorization active.
                </p>
              </div>
            </div>
            <span className="font-mono text-xs font-bold px-3 py-1 rounded-full bg-emerald-200 text-emerald-900">
              VALID
            </span>
          </div>
        );
      case 'EXPIRED':
        return (
          <div className="p-4 rounded-xl bg-slate-100 border border-slate-300 text-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm tracking-tight text-slate-900">
                  PASS EXPIRED
                </h3>
                <p className="text-xs text-slate-600">
                  The approved movement window has elapsed. Pass is no longer valid.
                </p>
              </div>
            </div>
            <span className="font-mono text-xs font-bold px-3 py-1 rounded-full bg-slate-300 text-slate-800">
              EXPIRED
            </span>
          </div>
        );
      case 'REVOKED':
        return (
          <div className="p-4 rounded-xl bg-red-50 border border-red-300 text-red-900 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm tracking-tight text-red-950">
                  PASS OFFICIALLY REVOKED
                </h3>
                <p className="text-xs text-red-700">
                  Cancelled by command authority. Entry is not exempt.
                </p>
              </div>
            </div>
            <span className="font-mono text-xs font-bold px-3 py-1 rounded-full bg-red-200 text-red-900">
              REVOKED
            </span>
          </div>
        );
      case 'VEHICLE_MISMATCH':
        return (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <Car className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm tracking-tight text-amber-950">
                  VEHICLE REGISTRATION MISMATCH
                </h3>
                <p className="text-xs text-amber-800">
                  Physical vehicle plate does not match the bound pass registration.
                </p>
              </div>
            </div>
            <span className="font-mono text-xs font-bold px-3 py-1 rounded-full bg-amber-200 text-amber-900">
              MISMATCH
            </span>
          </div>
        );
      default:
        return (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm tracking-tight text-red-950">
                  INVALID PASS OR TAMPER DETECTED
                </h3>
                <p className="text-xs text-red-700">
                  {verificationResult?.message || 'Digital signature check failed.'}
                </p>
              </div>
            </div>
            <span className="font-mono text-xs font-bold px-3 py-1 rounded-full bg-red-200 text-red-900">
              INVALID
            </span>
          </div>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 py-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-[#CBD5E1] p-6 sm:p-8 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#14243A]/5 text-[#14243A] text-xs font-semibold">
              <QrCode className="w-3.5 h-3.5 text-[#B99A62]" />
              <span>Public Verification Terminal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#14243A]">
              Toll Plaza Pass Verification
            </h1>
            <p className="text-xs text-[#64748B]">
              Cryptographic Ed25519 authenticity check, expiry validation, and vehicle cross-match.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setScannerModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs bg-[#14243A] text-white hover:bg-[#0C1728] transition-colors shadow-xs shrink-0"
          >
            <Camera className="w-4 h-4 text-[#B99A62]" />
            <span>Open Optical Scanner</span>
          </button>
        </div>

        {/* Input Form */}
        <form onSubmit={handleFormSubmit} className="pt-4 border-t border-[#E2E8F0] space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-6">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] block mb-1">
                SEVA PASS Code
              </label>
              <input
                type="text"
                placeholder="e.g. SEVA-2026-WC-1045"
                value={passCodeInput}
                onChange={(e) => setPassCodeInput(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-xs font-mono font-semibold uppercase focus:outline-hidden focus:border-[#14243A] bg-[#F7F7F3]"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] block mb-1">
                Observed Plate (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. 21D 104523X"
                value={scannedPlateInput}
                onChange={(e) => setScannedPlateInput(e.target.value.toUpperCase())}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] text-xs font-mono font-semibold uppercase focus:outline-hidden focus:border-[#14243A] bg-[#F7F7F3]"
              />
            </div>

            <div className="sm:col-span-3 flex items-end">
              <button
                type="submit"
                disabled={isVerifying}
                className="w-full py-2.5 rounded-xl text-xs font-semibold bg-[#B99A62] text-[#0C1728] hover:bg-[#CEB482] transition-colors shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isVerifying ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5" />
                    <span>Verify Pass</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Quick Demo Scenarios Row */}
        <div className="pt-3 border-t border-[#E2E8F0] flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-[#64748B] flex items-center gap-1 mr-1">
            <Sparkles className="w-3 h-3 text-[#B99A62]" />
            <span>Test Scenarios:</span>
          </span>
          <button
            type="button"
            onClick={() => handleSimulateScenario('valid')}
            className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 transition-colors"
          >
            Valid Pass
          </button>
          <button
            type="button"
            onClick={() => handleSimulateScenario('expired')}
            className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-300 transition-colors"
          >
            Expired Pass
          </button>
          <button
            type="button"
            onClick={() => handleSimulateScenario('revoked')}
            className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-red-50 text-red-800 hover:bg-red-100 border border-red-200 transition-colors"
          >
            Revoked Pass
          </button>
          <button
            type="button"
            onClick={() => handleSimulateScenario('tampered')}
            className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200 transition-colors"
          >
            Tampered Payload
          </button>
          <button
            type="button"
            onClick={() => handleSimulateScenario('mismatch')}
            className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 transition-colors"
          >
            Plate Mismatch
          </button>
        </div>
      </div>

      {/* Error alert */}
      {errorNotice && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-[#C44747] flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block">Verification Error:</span>
            {errorNotice}
          </div>
        </div>
      )}

      {/* VERIFICATION RESULT CARD */}
      {verificationResult && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Status Header */}
          {getStatusBadge(verificationResult.result)}

          {/* Detailed Verification Breakdown */}
          {verificationResult.pass_data && (
            <div className="bg-white rounded-2xl border border-[#CBD5E1] shadow-card p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
                    Verified Record
                  </span>
                  <h3 className="font-mono text-base font-bold text-[#14243A]">
                    {verificationResult.pass_data.pass_code}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-[#64748B] block">Issuing Authority</span>
                  <span className="text-xs font-semibold text-[#14243A]">
                    {verificationResult.pass_data.department_name}
                  </span>
                </div>
              </div>

              {/* Vehicle & Movement Corridor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#F7F7F3] border border-[#E2E8F0] space-y-1">
                  <p className="text-[10px] uppercase font-semibold text-[#64748B]">
                    Authorised Vehicle
                  </p>
                  <p className="font-mono text-sm font-bold text-[#14243A]">
                    {verificationResult.pass_data.vehicle_registration || verificationResult.pass_data.authorized_vehicle}
                  </p>
                  {verificationResult.pass_data.vehicle_type && (
                    <p className="text-[11px] text-[#64748B]">
                      {verificationResult.pass_data.vehicle_type}
                    </p>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-[#F7F7F3] border border-[#E2E8F0] space-y-1">
                  <p className="text-[10px] uppercase font-semibold text-[#64748B]">
                    Movement Corridor
                  </p>
                  <div className="flex items-center gap-2 text-xs font-medium text-[#14243A] pt-0.5">
                    <span className="truncate">{verificationResult.pass_data.journey_origin || 'Origin'}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#B99A62] shrink-0" />
                    <span className="truncate">{verificationResult.pass_data.journey_destination || 'Destination'}</span>
                  </div>
                  {verificationResult.pass_data.journey_purpose && (
                    <p className="text-[11px] text-[#64748B] truncate">
                      {verificationResult.pass_data.journey_purpose}
                    </p>
                  )}
                </div>
              </div>

              {/* Validity Window */}
              {verificationResult.pass_data.valid_from && verificationResult.pass_data.valid_until && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3.5 rounded-xl border border-[#E2E8F0]">
                    <p className="text-[10px] uppercase font-semibold text-[#64748B]">Valid From</p>
                    <p className="text-xs font-bold text-[#14243A] mt-0.5">
                      {new Date(verificationResult.pass_data.valid_from).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl border border-[#E2E8F0]">
                    <p className="text-[10px] uppercase font-semibold text-[#64748B]">Valid Until</p>
                    <p className="text-xs font-bold text-[#14243A] mt-0.5">
                      {new Date(verificationResult.pass_data.valid_until).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              )}

              {/* Statutory Legal Ground */}
              {verificationResult.pass_data.eligibility_basis && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-[#64748B]">
                  <span className="font-semibold text-[#14243A] block mb-0.5">
                    Statutory Exemption Basis:
                  </span>
                  {verificationResult.pass_data.eligibility_basis}
                </div>
              )}

              {/* Privacy Notice */}
              <div className="flex items-center gap-2 text-[11px] text-[#94A3B8] pt-2 border-t border-[#E2E8F0]">
                <Lock className="w-3.5 h-3.5 text-[#B99A62]" />
                <span>
                  Officer service numbers and personal contact information are strictly protected from public disclosure.
                </span>
              </div>
            </div>
          )}

          {/* 6-Point Cryptographic & Policy Audit Checks */}
          <div className="bg-white rounded-2xl border border-[#CBD5E1] shadow-subtle p-6 space-y-4">
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#14243A]">
              7-Point Cryptographic & Verification Audit
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[#F7F7F3]">
                {verificationResult.verification_checks.pass_found ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                )}
                <span>Pass registry existence check</span>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-lg bg-[#F7F7F3]">
                {verificationResult.verification_checks.signature_valid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                )}
                <span>Ed25519 cryptographic signature check</span>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-lg bg-[#F7F7F3]">
                {verificationResult.verification_checks.not_expired ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-slate-500 shrink-0" />
                )}
                <span>Movement window expiry check</span>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-lg bg-[#F7F7F3]">
                {verificationResult.verification_checks.not_revoked ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                )}
                <span>Department revocation check</span>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-lg bg-[#F7F7F3]">
                {verificationResult.verification_checks.vehicle_matched ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                )}
                <span>Observed vehicle plate cross-match</span>
              </div>

              <div className="flex items-center gap-2 p-2 rounded-lg bg-[#F7F7F3]">
                {verificationResult.verification_checks.statutory_basis_established ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                )}
                <span>Statutory exemption ground established</span>
              </div>
            </div>

            <div className="pt-2 text-[10px] text-[#94A3B8] flex items-center justify-between">
              <span>Audit Log Ref: {verificationResult.log_id}</span>
              <span>Verification Timestamp: {verificationResult.timestamp}</span>
            </div>
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      <QRScannerModal
        isOpen={scannerModalOpen}
        onClose={() => setScannerModalOpen(false)}
        onScanResult={(res) => {
          if (res.scanned_vehicle_reg) {
            setScannedPlateInput(res.scanned_vehicle_reg);
          }
          if (res.pass_code) {
            setPassCodeInput(res.pass_code);
          }
          executeVerification(res);
        }}
      />
    </div>
  );
};
