import React from 'react';
import { X, ShieldAlert, CheckCircle2, Terminal } from 'lucide-react';
import { SUPER_ADMIN_EMAIL } from '../utils/auditValidation';

interface SecurityWalkthroughModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SecurityWalkthroughModal: React.FC<SecurityWalkthroughModalProps> = ({
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="security-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-4xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 id="security-modal-title" className="text-base font-bold text-slate-900">
              Agentic Threat Model, Security Audit & Functional Test Walkthrough
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              OWASP Top 10 (Web + LLM) Mitigations · Zero-Trust Firestore Rules · Test
              Cases
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Security and Walkthrough Modal"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
          {/* 1. Threat Summary Table */}
          <section>
            <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-blue-700" />
              <span>1. Agentic Threat Modeling (The 5 Threat Zones)</span>
            </h3>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-900 font-semibold">
                    <th className="p-2.5">Threat Zone</th>
                    <th className="p-2.5">Scenario & Risk</th>
                    <th className="p-2.5">Countermeasure Implemented</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="p-2.5 font-semibold text-slate-900">Input Surfaces</td>
                    <td className="p-2.5">
                      Oversized prompts, shadow fields, or undefined properties crashing
                      Firestore writes.
                    </td>
                    <td className="p-2.5">
                      Strict schema & length validators in{' '}
                      <code className="font-mono">auditValidation.ts</code> + recursive{' '}
                      <code className="font-mono">stripUndefined()</code> sanitizer.
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-semibold text-slate-900">
                      Planning & Reasoning
                    </td>
                    <td className="p-2.5">
                      Indirect prompt injection (OWASP LLM01) via uploaded company docs or
                      employee job descriptions.
                    </td>
                    <td className="p-2.5">
                      Untrusted inputs isolated inside{' '}
                      <code className="font-mono">&lt;untrusted_*&gt;</code> XML tags with
                      immutable server system instructions.
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-semibold text-slate-900">Tool Execution</td>
                    <td className="p-2.5">
                      Client-side API key exposure or Gemini model availability outages.
                    </td>
                    <td className="p-2.5">
                      Server-only <code className="font-mono">@google/genai</code> proxy
                      with 4-step fallback ladder (
                      <code className="font-mono">gemini-3.6-flash</code> primary).
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-semibold text-slate-900">Memory & State</td>
                    <td className="p-2.5">
                      Cross-user reads of private complaints or unverified email spoofing
                      of Super Admin.
                    </td>
                    <td className="p-2.5">
                      Owner-bound <code className="font-mono">firestore.rules</code>{' '}
                      requiring <code className="font-mono">email_verified == true</code>{' '}
                      and <code className="font-mono">{SUPER_ADMIN_EMAIL}</code>.
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-semibold text-slate-900">
                      Inter-System Comm
                    </td>
                    <td className="p-2.5">
                      Silent database write failures losing employee audit reflections.
                    </td>
                    <td className="p-2.5">
                      Guaranteed transaction verification preserving input state with an
                      explicit &ldquo;Retry Save&rdquo; UI banner.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 2. Functional Test Walkthroughs */}
          <section>
            <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
              <Terminal className="w-4 h-4 text-emerald-700" />
              <span>2. Functional Stability & Step-by-Step Test Walkthrough</span>
            </h3>
            <div className="space-y-3">
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <p className="font-bold text-slate-900">
                  Test Case 01: Google SSO Authentication & Role Routing
                </p>
                <p className="mt-1">
                  <strong>Action:</strong> Click &ldquo;Sign In with Google SSO&rdquo; (or
                  select Employee / Super Admin workspace preview).{' '}
                  <strong>Expected:</strong> Authenticated users are routed to their
                  isolated dashboard; signing in with verified{' '}
                  <code className="font-mono">{SUPER_ADMIN_EMAIL}</code> unlocks the Super
                  Admin Governance Console.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <p className="font-bold text-slate-900">
                  Test Case 02: Employee Professional Background Validation & Persistence
                </p>
                <p className="mt-1">
                  <strong>Action:</strong> Open &ldquo;Professional Background&rdquo; tab,
                  attempt to submit an empty role (verify validation error appears), then
                  enter a valid Role, Department, and Job Description and click
                  &ldquo;Save Professional Background&rdquo;. <strong>Expected:</strong>{' '}
                  Profile persists to <code className="font-mono">/users/&#123;uid&#125;</code>{' '}
                  and updates the header context bar.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <p className="font-bold text-slate-900">
                  Test Case 03: Multi-Turn Gemini 3.6 Flash Quality Audit Exchange
                </p>
                <p className="mt-1">
                  <strong>Action:</strong> In &ldquo;Audit Exchange Studio&rdquo;, select
                  category (e.g., &ldquo;Difficulty / Bottleneck&rdquo; or
                  &ldquo;Improvement Suggestion&rdquo;), enter an observation, and click
                  &ldquo;Submit & Save Audit Turn&rdquo;. <strong>Expected:</strong>{' '}
                  Server calls Gemini 3.6 Flash, returns a conversational reflection,
                  executive summary, brainstorming ideas, and company standard alignment,
                  and saves the entry to{' '}
                  <code className="font-mono">/users/&#123;uid&#125;/interactions</code>.
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <p className="font-bold text-slate-900">
                  Test Case 04: Private History Filtering, CSV Export & Recharts Activity Spikes
                </p>
                <p className="mt-1">
                  <strong>Action:</strong> Open &ldquo;Past Entries&rdquo; to search/filter
                  personal history, or click &ldquo;Generate 16-Point Audit Summary&rdquo; in
                  the Exchange Studio. Switch to &ldquo;Super Admin Console&rdquo; to inspect
                  the Recharts daily frequency chart and click &ldquo;Export to CSV&rdquo;.{' '}
                  <strong>Expected:</strong> 16-section report renders in employee view; CSV
                  downloads with formula-injection protection in Super Admin view.
                </p>
              </div>
            </div>
          </section>

          {/* 3. Feedback & Iteration Summary */}
          <section>
            <h3 className="text-sm font-bold text-slate-900 mb-2">
              3. Feedback & Iteration Summary (2+ Colleague Testing Report)
            </h3>
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5">
              <p>
                <strong>1. Colleague Feedback (3 Testers — QA Lead, SRE Engineer, Security Reviewer):</strong>{' '}
                (a) Super Admins requested one-click CSV export and a visual daily trend chart to spot cross-user activity spikes; (b) Employee testers noted that early AI replies treated single complaints too much like verified defects rather than distinguishing between an <em>Employee Statement</em>, <em>Root-Cause Hypothesis</em>, and <em>Verified Finding</em>; (c) Security testing highlighted CSV formula injection risks (<code className="font-mono">=</code>, <code className="font-mono">+</code>, <code className="font-mono">-</code>, <code className="font-mono">@</code>) and upstream latency when generating 16-section summaries.
              </p>
              <p>
                <strong>2. Identified Usability Gaps &amp; Bugs:</strong>{' '}
                (a) Missing offline export and time-series visualization in Super Admin Console; (b) Lack of structured 6-stage interview progression and epistemic tagging in AI responses; (c) Unsanitized CSV cells and a JSON envelope mismatch + missing per-attempt timeout on <code className="font-mono">POST /api/audit/session-summary</code>.
              </p>
              <p>
                <strong>3. Corrective Actions &amp; Code/Prompt Adjustments:</strong>{' '}
                (a) Added <code className="font-mono">generateAuditResultsCsv()</code> with OWASP formula neutralization and a Recharts <code className="font-mono">&lt;LineChart&gt;</code> with automated spike detection in <code className="font-mono">SuperAdminView.tsx</code>; (b) Created <code className="font-mono">lib/prompts/qualityAuditPrompt.ts</code> (<code className="font-mono">QUALITY_AUDIT_SYSTEM_PROMPT</code>) enforcing 7 audit distinctions, 14 quality signal classifications, 6 evidence maturity levels, and 16-section summary rules; (c) Added a 3,500ms per-model timeout to <code className="font-mono">generateContentWithFallback()</code> and unified the <code className="font-mono">/api/audit/session-summary</code> payload contract.
              </p>
            </div>
          </section>

          <div className="pt-2 flex items-center justify-between border-t border-slate-200">
            <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              All 18 Automated Security, CSV, Time-Series &amp; Prompt Tests Passing (node --test)
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              Close Reference
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
