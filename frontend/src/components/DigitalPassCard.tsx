import React from 'react';
import {
  ShieldCheck,
  Calendar,
  Clock,
  Car,
  MapPin,
  ArrowRight,
  Printer,
  Download,
  AlertCircle,
  CheckCircle2,
  Lock,
  ExternalLink
} from 'lucide-react';
import { IssuedPass } from '../types';

interface DigitalPassCardProps {
  pass: IssuedPass;
  onRevoke?: (pass: IssuedPass) => void;
  canRevoke?: boolean;
}

export const DigitalPassCard: React.FC<DigitalPassCardProps> = ({
  pass,
  onRevoke,
  canRevoke = false
}) => {
  const isRevoked = pass.status === 'revoked';
  const isExpired = pass.status === 'expired' || new Date(pass.valid_until) < new Date();
  const isActive = pass.status === 'active' && !isExpired;

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return '';
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white rounded-2xl border border-[#CBD5E1] shadow-card overflow-hidden pass-print-card">
      {/* Top Banner with Pass Status */}
      <div className="bg-[#14243A] text-white px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-[#0C1728]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-[#B99A62]">
            <ShieldCheck className="w-5 h-5 text-[#B99A62]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm tracking-wide font-bold text-white">
                {pass.pass_code}
              </span>
              <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded bg-white/10 text-white/80">
                Official Pass
              </span>
            </div>
            <p className="text-xs text-[#94A3B8] font-normal">
              {pass.department_name || pass.department_code || 'Military Formation'}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          {isActive && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#16865A]/20 text-[#4ADE80] border border-[#16865A]/40">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>ACTIVE & VALID</span>
            </span>
          )}
          {isRevoked && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#C44747]/20 text-[#F87171] border border-[#C44747]/40">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>REVOKED</span>
            </span>
          )}
          {isExpired && !isRevoked && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-700/60 text-slate-300 border border-slate-600">
              <Clock className="w-3.5 h-3.5" />
              <span>EXPIRED</span>
            </span>
          )}
        </div>
      </div>

      {/* Main Content Body */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column: Details */}
        <div className="md:col-span-8 space-y-5">
          {/* Vehicle Box */}
          <div className="p-4 rounded-xl bg-[#F7F7F3] border border-[#E2E8F0] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white border border-[#CBD5E1] flex items-center justify-center text-[#14243A]">
                <Car className="w-5 h-5 text-[#14243A]" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
                  Authorised Vehicle
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-base font-bold text-[#14243A] tracking-wider px-2 py-0.5 rounded bg-white border border-[#CBD5E1]">
                    {pass.vehicle_registration_number}
                  </span>
                  <span className="text-xs text-[#64748B] font-medium">
                    {pass.vehicle_type}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Journey Route */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
              Approved Movement Corridor
            </p>
            <div className="p-3.5 rounded-xl border border-[#E2E8F0] bg-white flex items-center gap-3">
              <div className="flex-1">
                <p className="text-[10px] text-[#64748B] uppercase font-semibold">Origin</p>
                <p className="text-xs font-semibold text-[#14243A] truncate">
                  {pass.journey_origin}
                </p>
              </div>
              <div className="w-6 h-6 rounded-full bg-[#F7F7F3] flex items-center justify-center text-[#B99A62] shrink-0">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] text-[#64748B] uppercase font-semibold">Destination</p>
                <p className="text-xs font-semibold text-[#14243A] truncate">
                  {pass.journey_destination}
                </p>
              </div>
            </div>
          </div>

          {/* Validity Timeline */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl border border-[#E2E8F0] bg-[#F7F7F3]">
              <p className="text-[10px] uppercase font-semibold text-[#64748B]">Valid From</p>
              <p className="text-xs font-bold text-[#14243A] mt-0.5">
                {formatDate(pass.valid_from)}
              </p>
              <p className="text-[11px] text-[#64748B]">{formatTime(pass.valid_from)}</p>
            </div>
            <div className="p-3 rounded-xl border border-[#E2E8F0] bg-[#F7F7F3]">
              <p className="text-[10px] uppercase font-semibold text-[#64748B]">Valid Until</p>
              <p className="text-xs font-bold text-[#14243A] mt-0.5">
                {formatDate(pass.valid_until)}
              </p>
              <p className="text-[11px] text-[#64748B]">{formatTime(pass.valid_until)}</p>
            </div>
          </div>

          {/* Statutory Ground */}
          <div className="text-[11px] text-[#64748B] p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <span className="font-semibold text-[#14243A] block mb-0.5">Statutory Basis:</span>
            {pass.eligibility_basis || 'Section 3(1)(a) Indian Tolls (Army and Air Force) Act 1901'}
          </div>

          {/* Revocation notice if revoked */}
          {isRevoked && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-[#C44747]">
              <p className="font-semibold">Pass Officially Revoked</p>
              <p className="mt-0.5 text-[11px] text-red-700">
                Reason: {pass.revocation_reason || 'Administratively cancelled'}
              </p>
              {pass.revoked_at && (
                <p className="text-[10px] text-red-500 mt-1">
                  Revocation recorded on {formatDate(pass.revoked_at)}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right Column: QR Code & Verification Proof */}
        <div className="md:col-span-4 flex flex-col items-center justify-between p-4 rounded-xl bg-[#F7F7F3] border border-[#E2E8F0] text-center">
          <div className="w-full flex flex-col items-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#14243A] mb-2">
              Optical QR Token
            </p>

            {/* QR Code Graphic */}
            <div className="p-3 rounded-xl bg-white border border-[#CBD5E1] shadow-xs mb-3">
              {pass.qr_data_url ? (
                <img
                  src={pass.qr_data_url}
                  alt={`QR Code for ${pass.pass_code}`}
                  className="w-40 h-40 object-contain mx-auto"
                />
              ) : (
                <div className="w-40 h-40 bg-slate-100 flex items-center justify-center text-xs text-[#64748B]">
                  Generating QR...
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[10px] font-mono font-medium text-[#64748B]">
              <Lock className="w-3 h-3 text-[#B99A62]" />
              <span>Ed25519 Asymmetric Signature</span>
            </div>
            <p className="text-[10px] text-[#94A3B8] mt-1">
              Key ID: {pass.key_id || 'seva-ed25519-v1'}
            </p>
          </div>

          {/* Card Actions (Hidden in Print) */}
          <div className="w-full pt-4 border-t border-[#E2E8F0] mt-3 flex items-center justify-center gap-2 no-print">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-[#CBD5E1] text-[#14243A] hover:bg-slate-50 transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-[#64748B]" />
              <span>Print Pass</span>
            </button>

            {canRevoke && isActive && onRevoke && (
              <button
                onClick={() => onRevoke(pass)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 border border-red-200 text-[#C44747] hover:bg-red-100 transition-colors"
              >
                <span>Revoke</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
