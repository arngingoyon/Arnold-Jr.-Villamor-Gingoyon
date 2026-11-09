import React from 'react';
import {
  ShieldCheck,
  Lock,
  FileSpreadsheet,
  MessageSquareText,
  ArrowRight,
  UserCheck,
  Building2,
  AlertCircle
} from 'lucide-react';
import { SUPER_ADMIN_EMAIL } from '../utils/auditValidation';

interface LandingViewProps {
  onGoogleSignIn: () => Promise<void>;
  onStartDemoMode: (role: 'employee' | 'admin') => void;
  onOpenSecurityModal: () => void;
  isSigningIn: boolean;
  authError: string | null;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onGoogleSignIn,
  onStartDemoMode,
  onOpenSecurityModal,
  isSigningIn,
  authError
}) => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="w-full bg-white border-b border-slate-200">
        <div className="max-w-[1360px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Title, one line */}
          <a
            href="#top"
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            AuditPulse AI
          </a>

          {/* Zone 2: 4 single-line text nav links */}
          <nav
            aria-label="Primary Navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
          >
            <a
              href="#workflow"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Audit Workflow
            </a>
            <a
              href="#isolation"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Data Isolation
            </a>
            <a
              href="#governance"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Admin Governance
            </a>
            <button
              type="button"
              onClick={onOpenSecurityModal}
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Security & Test Specs
            </button>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={onGoogleSignIn}
              disabled={isSigningIn}
              className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isSigningIn ? 'Authenticating...' : 'Sign In with Google'}
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1 max-w-[1360px] w-full mx-auto px-6 py-12 md:py-16">
        {/* Hero Split Section */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch pb-14 border-b border-slate-200">
          <div className="lg:col-span-7 flex flex-col justify-between">
            <div>
              <p className="text-xs font-mono text-slate-500 tracking-tight mb-3">
                Enterprise Quality Audit Workspace · Gemini 3.6 Flash · Cloud Firestore
              </p>
              <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-bold tracking-tight text-slate-900 leading-[1.15] text-balance mb-5">
                Role-Grounded Quality Audits with Strict User Data Isolation.
              </h1>
              <p className="text-base text-slate-600 leading-relaxed max-w-[66ch] mb-8">
                Authenticate via Google SSO to document your professional role, daily
                workflows, operational bottlenecks, complaints, and improvement ideas.
                Engage in multi-turn diagnostic exchanges with Gemini 3.6 Flash grounded
                in official company standards while keeping every employee&apos;s entries
                strictly isolated in Cloud Firestore.
              </p>

              {authError && (
                <div
                  role="alert"
                  className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-900 flex items-start gap-3"
                >
                  <AlertCircle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">Google Sign-In Notice</p>
                    <p className="text-red-800 mt-0.5">{authError}</p>
                    <p className="text-xs text-red-700 mt-2">
                      Tip: If browser popup restrictions block OAuth in preview frames, you
                      can immediately launch the interactive workspace below.
                    </p>
                  </div>
                </div>
              )}

              {/* Primary CTA & Interactive Sandbox Controls */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onGoogleSignIn}
                  disabled={isSigningIn}
                  className="px-5 py-3 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Sign In with Google SSO</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onStartDemoMode('employee')}
                  className="px-4 py-3 text-sm font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Explore Employee Workspace
                </button>

                <button
                  type="button"
                  onClick={() => onStartDemoMode('admin')}
                  className="px-4 py-3 text-sm font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Explore Super Admin Console
                </button>
              </div>
            </div>

            <div className="mt-10 pt-6 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs text-slate-600">
              <div>
                <p className="font-semibold text-slate-900 mb-1">Federated Identity</p>
                <p>Firebase Google Sign-In only. Zero passwords stored or handled.</p>
              </div>
              <div>
                <p className="font-semibold text-slate-900 mb-1">Per-User Isolation</p>
                <p>Owner-bound Firestore paths prevent cross-user entry reads.</p>
              </div>
              <div>
                <p className="font-semibold text-slate-900 mb-1">Designated Super Admin</p>
                <p className="font-mono text-slate-800 break-all">{SUPER_ADMIN_EMAIL}</p>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Architecture & Role Preview Card */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-200">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Role-Based Access & Audit Architecture
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Zero-trust Firestore security rules · OWASP LLM01 hardened
                  </p>
                </div>
                <Lock className="w-5 h-5 text-slate-700 shrink-0" />
              </div>

              <div className="divide-y divide-slate-200">
                <div className="pb-4">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                    <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-blue-700" />
                      01. Super Administrator Flow
                    </span>
                    <span className="font-mono">{SUPER_ADMIN_EMAIL}</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Authenticates via verified Google SSO to upload Company Information,
                    ISO/SLA standards, and SOP rubrics as the authoritative audit basis,
                    and inspects aggregated quality audit findings across employees.
                  </p>
                </div>

                <div className="py-4">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                    <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-emerald-700" />
                      02. Authenticated Employee Flow
                    </span>
                    <span className="font-mono">/users/&#123;uid&#125;</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Defines professional role and specific job description, then conducts
                    multi-turn quality audit exchanges covering work processes,
                    difficulties, complaints, and improvement proposals with Gemini.
                  </p>
                </div>

                <div className="pt-4">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                    <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                      <MessageSquareText className="w-4 h-4 text-amber-700" />
                      03. Gemini 3.6 Flash Insight Engine
                    </span>
                    <span className="font-mono">Server-Side Proxy</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Synthesizes executive summaries, root-cause reflections, and
                    brainstorming ideas grounded in company standards while enforcing
                    automatic model fallback and transaction persistence verification.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>Firestore Rules: Deployed & Verified</span>
              <button
                type="button"
                onClick={onOpenSecurityModal}
                className="font-semibold text-blue-700 hover:text-blue-900 underline underline-offset-2 cursor-pointer"
              >
                Inspect Threat Model & Test Cases
              </button>
            </div>
          </div>
        </section>

        {/* Mechanism-to-Outcome Strip */}
        <section id="workflow" className="py-12 border-b border-slate-200">
          <div className="mb-8">
            <h2 className="text-xl font-bold text-slate-900">
              End-to-End Quality Audit Lifecycle
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Every employee interaction links role context, company quality standards,
              and structured AI reflection.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div id="governance" className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                <span className="font-mono font-semibold text-slate-900">STEP 01</span>
                <span>Super Admin Basis</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">
                Company Audit Basis Ingestion
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Super Admin (<span className="font-mono text-xs">{SUPER_ADMIN_EMAIL}</span>)
                publishes organizational SOPs, ISO standards, and evaluation rubrics to{' '}
                <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">/company_docs</code>.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                <span className="font-mono font-semibold text-slate-900">STEP 02</span>
                <span>Role & Multi-Turn Exchange</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">
                Contextualized Process Reflection
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Employees record their job role and specific responsibilities, then engage
                in multi-turn discussions on processes, bottlenecks, complaints, and
                improvements.
              </p>
            </div>

            <div id="isolation" className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                <span className="font-mono font-semibold text-slate-900">STEP 03</span>
                <span>Isolated Persistence</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">
                Owner-Bound Firestore Ledger
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Entries are validated and stored under{' '}
                <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">
                  /users/&#123;userId&#125;/interactions
                </code>
                . Users can only read their own history; Super Admin reviews organization-wide
                audit results.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white border-t border-slate-200 py-6">
        <div className="max-w-[1360px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            AuditPulse AI · Enterprise Quality Audit & Process Intelligence · Powered by
            Gemini 3.6 Flash & Cloud Firestore
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onOpenSecurityModal}
              className="hover:text-slate-900 underline underline-offset-2 cursor-pointer"
            >
              Threat Model & Walkthrough
            </button>
            <span>·</span>
            <span className="font-mono">Super Admin: {SUPER_ADMIN_EMAIL}</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
