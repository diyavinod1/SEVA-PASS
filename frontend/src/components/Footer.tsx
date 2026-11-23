import React from 'react';
import { ShieldCheck, Info, FileText, HelpCircle, ExternalLink } from 'lucide-react';

interface FooterProps {
  onNavigate?: (view: string) => void;
  onOpenVerify?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, onOpenVerify }) => {
  return (
    <footer className="bg-[#14243A] text-white pt-14 pb-10 border-t border-[#0C1728] no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-white/10">
          {/* Brand & Purpose */}
          <div className="md:col-span-1 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#0C1728] border border-white/10 flex items-center justify-center text-[#B99A62]">
                <ShieldCheck className="w-5 h-5 text-[#B99A62]" />
              </div>
              <span className="font-bold text-lg tracking-tight text-white">SEVA PASS</span>
            </div>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Secure Electronic Verification and Authorisation for Military Toll Exemptions.
              A unified digital workflow for pass application, departmental review, and plaza verification.
            </p>
          </div>

          {/* Platform Navigation */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#B99A62] mb-4">
              Platform
            </h4>
            <ul className="space-y-2.5 text-xs text-[#94A3B8]">
              <li>
                <a href="#how-it-works" className="hover:text-white transition-colors">
                  How SEVA PASS Works
                </a>
              </li>
              <li>
                <a href="#benefits" className="hover:text-white transition-colors">
                  Platform Benefits
                </a>
              </li>
              <li>
                <button
                  onClick={onOpenVerify}
                  className="hover:text-white transition-colors text-left"
                >
                  Verify a Pass Online
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate && onNavigate('login')}
                  className="hover:text-white transition-colors text-left"
                >
                  Department & Officer Sign In
                </button>
              </li>
            </ul>
          </div>

          {/* Legal Grounds & Standards */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#B99A62] mb-4">
              Statutory Basis
            </h4>
            <p className="text-xs text-[#94A3B8] leading-relaxed mb-3">
              Pass authorisations reference Section 3(1)(a) of the Indian Tolls (Army and Air Force) Act 1901.
            </p>
            <div className="p-3 rounded-lg bg-[#0C1728] border border-white/5 text-[11px] text-[#94A3B8]">
              <span className="text-[#B99A62] font-medium block mb-1">Standard RFC 8032</span>
              Digitally signed credentials ensure tamper detection and non-repudiation.
            </div>
          </div>

          {/* Support & Governance */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#B99A62] mb-4" id="help">
              Support & Ethics
            </h4>
            <ul className="space-y-2.5 text-xs text-[#94A3B8]">
              <li className="flex items-center gap-2">
                <HelpCircle className="w-3.5 h-3.5 text-[#B99A62]" />
                <span>Operational Guidance Desk</span>
              </li>
              <li className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-[#B99A62]" />
                <span>Toll Plaza Verification Protocols</span>
              </li>
              <li className="flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-[#B99A62]" />
                <span>Audit & Compliance Governance</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Prototype & Legal Exemption Disclaimer */}
        <div className="pt-8 space-y-4">
          <div className="p-4 rounded-xl bg-[#0C1728] border border-white/10 text-xs text-[#94A3B8] leading-relaxed">
            <div className="flex items-start gap-2.5">
              <Info className="w-4 h-4 text-[#B99A62] shrink-0 mt-0.5" />
              <div>
                <strong className="text-white font-semibold block mb-1">
                  Prototype Evaluation Disclaimer
                </strong>
                This platform is an evaluation prototype demonstrating a proposed digital authorisation, approval and QR verification workflow. It does not claim official military endorsement, government approval, or active institutional integration. A generated pass does not independently establish a statutory toll exemption; official transit eligibility is strictly governed by statutory law and authorized military command movement orders.
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#64748B] pt-2">
            <p>© 2026 SEVA PASS Architecture. Prototype demonstration.</p>
            <div className="flex items-center gap-4 mt-2 sm:mt-0">
              <span className="hover:text-white cursor-pointer">Privacy Principles</span>
              <span>•</span>
              <span className="hover:text-white cursor-pointer">Terms of Service</span>
              <span>•</span>
              <span className="hover:text-white cursor-pointer">Security Standards</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
