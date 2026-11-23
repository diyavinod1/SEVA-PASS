import React, { useState } from 'react';
import {
  ShieldCheck,
  ArrowRight,
  QrCode,
  FileText,
  Building2,
  CheckCircle2,
  Clock,
  Car,
  Lock,
  ChevronRight,
  Eye,
  Shield,
  Search,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { UserProfile } from '../types';

interface HomePageProps {
  currentUser: UserProfile | null;
  onNavigate: (view: string) => void;
  onOpenVerifyModal: () => void;
  onDirectVerifyCode: (code: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  currentUser,
  onNavigate,
  onOpenVerifyModal,
  onDirectVerifyCode
}) => {
  const [inlineCode, setInlineCode] = useState('');

  const handleInlineVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (inlineCode.trim()) {
      onDirectVerifyCode(inlineCode.trim().toUpperCase());
    } else {
      onOpenVerifyModal();
    }
  };

  return (
    <div className="space-y-24 py-6">
      {/* =========================================================================
          HERO SECTION: Pass Authorisation. Simplified.
          ========================================================================= */}
      <section className="relative overflow-hidden rounded-3xl bg-[#14243A] text-white border border-[#0C1728] shadow-premium p-8 sm:p-12 lg:p-16">
        {/* Subtle geometric background accents */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 rounded-full bg-[#B99A62]/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-96 h-96 rounded-full bg-white/5 blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Heading, Supporting text, CTAs */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-white/90 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#B99A62] animate-pulse" />
              <span>Standardised Transit Workflow Prototype</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
              Pass authorisation.{' '}
              <span className="text-[#B99A62] block mt-1">Simplified.</span>
            </h1>

            <p className="text-base sm:text-lg text-[#94A3B8] max-w-xl leading-relaxed font-normal">
              A streamlined digital platform for submitting, approving and verifying authorised military vehicle pass requests.
            </p>

            {/* Primary Actions */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={() => onNavigate(currentUser ? 'personnel' : 'login')}
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl font-semibold text-sm bg-[#B99A62] text-[#0C1728] hover:bg-[#CEB482] transition-all shadow-elevated"
              >
                <span>{currentUser ? 'Go to My Portal' : 'Apply for a Pass'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={onOpenVerifyModal}
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl font-semibold text-sm bg-white/10 text-white border border-white/20 hover:bg-white/15 transition-all shadow-xs"
              >
                <QrCode className="w-4 h-4 text-[#B99A62]" />
                <span>Verify a Pass</span>
              </button>
            </div>

            {/* Trust Signals */}
            <div className="grid grid-cols-3 gap-4 pt-8 border-t border-white/10 text-xs text-[#94A3B8]">
              <div>
                <span className="font-bold text-white text-base block font-mono">100% Digital</span>
                <span>Paperless movement passes</span>
              </div>
              <div>
                <span className="font-bold text-white text-base block font-mono">Instant Check</span>
                <span>Toll lane verification in seconds</span>
              </div>
              <div>
                <span className="font-bold text-white text-base block font-mono">Tamper Proof</span>
                <span>Asymmetric digital signatures</span>
              </div>
            </div>
          </div>

          {/* Right Column: Digital Pass Realistic Product Mockup */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-sm bg-white rounded-2xl p-5 text-[#14243A] shadow-premium border border-slate-200/80 transform hover:-translate-y-1 transition-transform duration-300">
              {/* Mockup Header */}
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#14243A] flex items-center justify-center text-[#B99A62]">
                    <ShieldCheck className="w-4 h-4 text-[#B99A62]" />
                  </div>
                  <div>
                    <span className="font-bold text-xs tracking-tight text-[#14243A] block">
                      SEVA PASS
                    </span>
                    <span className="text-[10px] text-[#64748B]">Digital Movement Authorisation</span>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  ACTIVE
                </span>
              </div>

              {/* Mockup Vehicle Badge */}
              <div className="my-3.5 p-3 rounded-xl bg-[#F7F7F3] border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-[#64748B] uppercase font-semibold">Authorised Vehicle</p>
                  <p className="font-mono text-sm font-bold text-[#14243A] tracking-wider mt-0.5">
                    21D 104523X
                  </p>
                </div>
                <span className="text-[11px] font-medium text-[#64748B]">
                  Staff SUV
                </span>
              </div>

              {/* Mockup Route */}
              <div className="space-y-1 text-xs">
                <p className="text-[10px] text-[#64748B] uppercase font-semibold">Route Corridor</p>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-[11px]">
                  <span className="font-medium text-[#14243A] truncate">Chandi Mandir HQ</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#B99A62] shrink-0 mx-2" />
                  <span className="font-medium text-[#14243A] truncate">Ambala Cantt</span>
                </div>
              </div>

              {/* Mockup QR Code Graphic */}
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="font-mono text-xs font-bold text-[#14243A] block">
                    SEVA-2026-WC-1045
                  </span>
                  <span className="text-[10px] text-[#64748B] block">Valid for 48 hours</span>
                </div>
                <div className="w-16 h-16 rounded-lg bg-[#F7F7F3] border border-slate-200 p-1 flex items-center justify-center">
                  <QrCode className="w-12 h-12 text-[#14243A]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2: HOW SEVA PASS WORKS (Four-Step Visual Explanation)
          ========================================================================= */}
      <section id="how-it-works" className="space-y-10 scroll-mt-24">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#B99A62]">
            End-to-End Workflow
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#14243A]">
            How SEVA PASS works
          </h2>
          <p className="text-sm text-[#64748B]">
            From initial application to highway toll verification in four simple, transparent stages.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Step 1 */}
          <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-subtle space-y-4 hover:border-[#CBD5E1] transition-all">
            <div className="w-10 h-10 rounded-xl bg-[#14243A] text-[#B99A62] flex items-center justify-center font-bold text-sm">
              1
            </div>
            <h3 className="font-bold text-base text-[#14243A]">Submit a request</h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Personnel enter vehicle registration, destination corridor, travel dates, and journey purpose in a guided 4-step form.
            </p>
            <div className="pt-2 text-[11px] font-medium text-[#B99A62] flex items-center gap-1">
              <span>Guided submission</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-subtle space-y-4 hover:border-[#CBD5E1] transition-all">
            <div className="w-10 h-10 rounded-xl bg-[#14243A] text-[#B99A62] flex items-center justify-center font-bold text-sm">
              2
            </div>
            <h3 className="font-bold text-base text-[#14243A]">Department reviews</h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              The designated Department Head reviews the officer details, vehicle type, and journey purpose to approve or reject with notes.
            </p>
            <div className="pt-2 text-[11px] font-medium text-[#B99A62] flex items-center gap-1">
              <span>Official oversight</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-subtle space-y-4 hover:border-[#CBD5E1] transition-all">
            <div className="w-10 h-10 rounded-xl bg-[#14243A] text-[#B99A62] flex items-center justify-center font-bold text-sm">
              3
            </div>
            <h3 className="font-bold text-base text-[#14243A]">Approved pass is generated</h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Upon approval, a digitally signed pass with an optical QR token is instantly created for the officer to view, download, or print.
            </p>
            <div className="pt-2 text-[11px] font-medium text-[#B99A62] flex items-center gap-1">
              <span>Cryptographic signing</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Step 4 */}
          <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-subtle space-y-4 hover:border-[#CBD5E1] transition-all">
            <div className="w-10 h-10 rounded-xl bg-[#14243A] text-[#B99A62] flex items-center justify-center font-bold text-sm">
              4
            </div>
            <h3 className="font-bold text-base text-[#14243A]">Pass is verified at plaza</h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              At the toll plaza, operators or cameras scan the QR code to verify current validity, matching vehicle plate, and corridor permissions.
            </p>
            <div className="pt-2 text-[11px] font-medium text-[#B99A62] flex items-center gap-1">
              <span>Lane verification</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 3: BENEFITS
          ========================================================================= */}
      <section id="benefits" className="space-y-10 scroll-mt-24">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#B99A62]">
            Key Advantages
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#14243A]">
            Built for security and convenience
          </h2>
          <p className="text-sm text-[#64748B]">
            Replacing lost paper slips and manual delays with a modern digital standard.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-7 border border-[#E2E8F0] shadow-subtle space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#14243A] flex items-center justify-center">
              <FileText className="w-5 h-5 text-[#14243A]" />
            </div>
            <h3 className="font-bold text-base text-[#14243A]">Simplified Application</h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Clean step-by-step forms that prefill your verified credentials and save vehicle profiles for quick reuse.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-7 border border-[#E2E8F0] shadow-subtle space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#16865A] flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-[#16865A]" />
            </div>
            <h3 className="font-bold text-base text-[#14243A]">Clear Approval Status</h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Track the exact review state of your request in real time with transparent decision timestamps and officer notes.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-7 border border-[#E2E8F0] shadow-subtle space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-[#B99A62] flex items-center justify-center">
              <Lock className="w-5 h-5 text-[#B99A62]" />
            </div>
            <h3 className="font-bold text-base text-[#14243A]">Secure Digital Passes</h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Each pass is bound to the authorized vehicle registration and protected against falsification or unauthorized duplication.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-7 border border-[#E2E8F0] shadow-subtle space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
              <QrCode className="w-5 h-5 text-purple-700" />
            </div>
            <h3 className="font-bold text-base text-[#14243A]">Quick Verification</h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              High-speed camera scanning reduces transit lane friction, allowing rapid optical confirmation without phone calls.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-7 border border-[#E2E8F0] shadow-subtle space-y-3">
            <div className="w-10 h-10 rounded-xl bg-slate-50 text-[#64748B] flex items-center justify-center">
              <Eye className="w-5 h-5 text-[#64748B]" />
            </div>
            <h3 className="font-bold text-base text-[#14243A]">Transparent Records</h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Comprehensive audit logs track every pass creation, departmental decision, revocation, and plaza scan for total compliance.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-7 border border-[#E2E8F0] shadow-subtle space-y-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-[#C44747] flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#C44747]" />
            </div>
            <h3 className="font-bold text-base text-[#14243A]">Role Separation</h3>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Strict isolation ensures central governance, departmental autonomy, and personnel transit rights operate with complete data privacy.
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4: DIRECT PUBLIC VERIFICATION SECTION
          ========================================================================= */}
      <section className="bg-white rounded-3xl border border-[#CBD5E1] p-8 sm:p-12 shadow-card space-y-8">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#14243A]/5 text-[#14243A] text-xs font-semibold">
            <QrCode className="w-3.5 h-3.5 text-[#B99A62]" />
            <span>Public Access</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#14243A]">
            Verify a Pass Online
          </h2>
          <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">
            Toll plaza personnel and inspecting authorities can verify the authenticity, validity period, and vehicle binding of any pass without needing an account.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center pt-2">
          {/* Quick Code Lookup Form */}
          <div className="md:col-span-7">
            <form onSubmit={handleInlineVerify} className="space-y-4">
              <label className="text-xs font-semibold text-[#14243A] block">
                Enter SEVA PASS Reference Code
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="e.g. SEVA-2026-WC-1045"
                  value={inlineCode}
                  onChange={(e) => setInlineCode(e.target.value.toUpperCase())}
                  className="flex-1 px-4 py-3 rounded-xl border border-[#CBD5E1] text-sm font-mono font-semibold uppercase focus:outline-hidden focus:border-[#14243A] bg-[#F7F7F3]"
                />
                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl text-xs font-semibold bg-[#14243A] text-white hover:bg-[#0C1728] transition-colors shadow-xs"
                >
                  Verify Now
                </button>
              </div>
              <p className="text-[11px] text-[#64748B]">
                Looking to scan via camera? Use the optical scanner button below.
              </p>
            </form>
          </div>

          {/* Optical Scanner Button */}
          <div className="md:col-span-5 flex flex-col items-center justify-center p-6 rounded-2xl bg-[#F7F7F3] border border-[#E2E8F0] text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-white border border-[#CBD5E1] flex items-center justify-center text-[#14243A] shadow-xs">
              <QrCode className="w-6 h-6 text-[#B99A62]" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#14243A]">Live Camera Scanner</p>
              <p className="text-[11px] text-[#64748B] mt-0.5">
                Scan pass QR codes directly using your phone or web camera
              </p>
            </div>
            <button
              onClick={onOpenVerifyModal}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-white border border-[#CBD5E1] text-[#14243A] hover:bg-slate-50 transition-colors shadow-xs"
            >
              Open Camera Scanner
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
