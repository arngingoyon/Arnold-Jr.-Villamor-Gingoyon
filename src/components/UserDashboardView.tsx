import React, { useState, useMemo } from 'react';
import {
  Send,
  History,
  UserCircle,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Trash2,
  Sparkles,
  FileText,
  Search,
  ChevronDown,
  ChevronUp,
  PlusCircle
} from 'lucide-react';
import {
  INTERACTION_CATEGORIES,
  InteractionCategory,
  SeverityLevel,
  validateUserProfileInput
} from '../utils/auditValidation';
import {
  StoredAuditInteraction,
  StoredCompanyDoc,
  StoredUserProfile
} from '../utils/seedData';
import { AUDIT_INTERVIEW_STAGES } from '../../lib/prompts/qualityAuditPrompt';

interface UserDashboardViewProps {
  currentUserUid: string;
  currentUserEmail: string;
  currentUserName: string;
  profile: StoredUserProfile | null;
  interactions: StoredAuditInteraction[];
  companyDocs: StoredCompanyDoc[];
  onSaveProfile: (profileData: {
    displayName: string;
    jobRole: string;
    department: string;
    jobDescription: string;
  }) => Promise<void>;
  onSubmitInteraction: (params: {
    sessionId: string;
    category: InteractionCategory;
    userPrompt: string;
  }) => Promise<void>;
  onDeleteInteraction: (interactionId: string) => Promise<void>;
  pendingRetryAction: {
    message: string;
    onRetry: () => Promise<void>;
  } | null;
  onDismissRetry: () => void;
  onSimulateWriteError?: () => void;
}

const PROMPT_TEMPLATES: {
  category: InteractionCategory;
  label: string;
  prompt: string;
}[] = [
  {
    category: 'work_process',
    label: 'Document Release Process',
    prompt:
      'Every Tuesday we run our multi-region production deployment checklist. Currently I coordinate QA sign-off across 4 microservice leads and verify canary telemetry for 45 minutes before routing 100% traffic.'
  },
  {
    category: 'difficulty_challenge',
    label: 'Report Handoff Bottleneck',
    prompt:
      'Our biggest difficulty is environment drift between staging and production configuration secrets. Last week two release candidates failed smoke tests because environment variables were updated manually without audit logs.'
  },
  {
    category: 'complaint',
    label: 'Escalate SLA / Tooling Gap',
    prompt:
      'Incident escalation tickets from tier-2 support frequently arrive without customer request correlation IDs, forcing engineering on-call to spend 2+ hours reconstructing failure timelines.'
  },
  {
    category: 'improvement_suggestion',
    label: 'Propose Automation Upgrade',
    prompt:
      'We can introduce an automated pre-release config validator in CI that compares staging and production secret schemas and blocks deployment if any required key is missing.'
  }
];

export const UserDashboardView: React.FC<UserDashboardViewProps> = ({
  currentUserUid,
  currentUserEmail,
  currentUserName,
  profile,
  interactions,
  companyDocs,
  onSaveProfile,
  onSubmitInteraction,
  onDeleteInteraction,
  pendingRetryAction,
  onDismissRetry
}) => {
  // Active Sub-View ('exchange' | 'history' | 'profile')
  const [activeSection, setActiveSection] = useState<'exchange' | 'history' | 'profile'>(
    'exchange'
  );

  // Profile Form State
  const [displayName, setDisplayName] = useState(
    profile?.displayName || currentUserName || 'Authenticated Employee'
  );
  const [jobRole, setJobRole] = useState(profile?.jobRole || '');
  const [department, setDepartment] = useState(profile?.department || '');
  const [jobDescription, setJobDescription] = useState(profile?.jobDescription || '');
  const [profileErrors, setProfileErrors] = useState<string[]>([]);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSavedNotice, setProfileSavedNotice] = useState<string | null>(null);

  // Sync when profile prop changes
  React.useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setJobRole(profile.jobRole);
      setDepartment(profile.department);
      setJobDescription(profile.jobDescription);
    }
  }, [profile]);

  // Multi-turn Exchange State
  const [sessionId, setSessionId] = useState<string>(
    () => `sess_${Date.now().toString(36)}`
  );
  const [selectedCategory, setSelectedCategory] =
    useState<InteractionCategory>('work_process');
  const [userPrompt, setUserPrompt] = useState('');
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // 16-Point Structured Audit Summary State (from QUALITY_AUDIT_SYSTEM_PROMPT)
  const [auditSummaryReport, setAuditSummaryReport] = useState<{
    summaryReport: string;
    modelUsed: string;
  } | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // History Filter State
  const [historySearch, setHistorySearch] = useState('');
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState<string>('all');
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(
    interactions[0]?.id || null
  );

  const publishedCompanyDocs = useMemo(
    () => companyDocs.filter((d) => d.status === 'published'),
    [companyDocs]
  );

  const currentSessionInteractions = useMemo(
    () =>
      interactions
        .filter((item) => item.sessionId === sessionId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [interactions, sessionId]
  );

  const filteredHistory = useMemo(() => {
    return interactions.filter((entry) => {
      const matchesCat =
        historyCategoryFilter === 'all' || entry.category === historyCategoryFilter;
      const q = historySearch.trim().toLowerCase();
      const matchesSearch =
        !q ||
        entry.userPrompt.toLowerCase().includes(q) ||
        entry.executiveSummary.toLowerCase().includes(q) ||
        entry.aiResponse.toLowerCase().includes(q) ||
        entry.brainstormingIdeas.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [interactions, historyCategoryFilter, historySearch]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSavedNotice(null);

    const validation = validateUserProfileInput({
      uid: currentUserUid,
      displayName,
      jobRole,
      department,
      jobDescription
    });

    if (!validation.valid || !validation.sanitized) {
      setProfileErrors(validation.errors);
      return;
    }

    setProfileErrors([]);
    setIsSavingProfile(true);
    try {
      await onSaveProfile({
        displayName: validation.sanitized.displayName,
        jobRole: validation.sanitized.jobRole,
        department: validation.sanitized.department,
        jobDescription: validation.sanitized.jobDescription
      });
      setProfileSavedNotice(
        'Professional background saved and synchronized with Cloud Firestore.'
      );
    } catch (err) {
      setProfileErrors([
        err instanceof Error
          ? err.message
          : 'Failed to save profile. Your input has been preserved—use Retry Save.'
      ]);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleExchangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setExchangeError(null);

    if (!profile || !profile.jobRole || !profile.jobDescription) {
      setExchangeError(
        'Please complete and save your Professional Background (Role & Specific Function) first so Gemini can contextualize your quality audit.'
      );
      setActiveSection('profile');
      return;
    }

    const trimmed = userPrompt.trim();
    if (trimmed.length < 2) {
      setExchangeError(
        'Please enter at least 2 characters describing your work process, challenge, complaint, or improvement suggestion.'
      );
      return;
    }
    if (trimmed.length > 5000) {
      setExchangeError('Input exceeds maximum length of 5,000 characters.');
      return;
    }

    setIsAnalyzing(true);
    try {
      await onSubmitInteraction({
        sessionId,
        category: selectedCategory,
        userPrompt: trimmed
      });
      // Only clear user input buffer after confirmed persistence
      setUserPrompt('');
    } catch (err) {
      setExchangeError(
        err instanceof Error
          ? err.message
          : 'Audit exchange or Firestore persistence failed. Your message was not cleared.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStartNewThread = () => {
    setSessionId(`sess_${Date.now().toString(36)}`);
    setExchangeError(null);
  };

  const handleGenerateSessionSummary = async () => {
    setSummaryError(null);
    setIsGeneratingSummary(true);
    try {
      const response = await fetch('/api/audit/session-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userRole: profile?.jobRole || 'Authenticated Employee',
          department: profile?.department || 'Operations',
          jobDescription: profile?.jobDescription || '',
          interactions: interactions.slice(0, 15).map((item) => ({
            category: item.category,
            userPrompt: item.userPrompt,
            aiResponse: item.aiResponse,
            executiveSummary: item.executiveSummary,
            severityLevel: item.severityLevel
          })),
          companyAuditDocs: publishedCompanyDocs.map((doc) => ({
            title: doc.title,
            category: doc.category,
            content: doc.content
          }))
        })
      });
      const json = await response.json();
      const reportData = json.data || json;
      if (!response.ok || !reportData?.summaryReport) {
        throw new Error(json.error || 'Failed to generate 16-Point Audit Summary.');
      }
      setAuditSummaryReport({
        summaryReport: reportData.summaryReport,
        modelUsed: reportData.modelUsed || 'gemini-3.6-flash'
      });
    } catch (err) {
      setSummaryError(
        err instanceof Error
          ? err.message
          : 'Failed to generate 16-Point Audit Summary.'
      );
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const formatSeverityLabel = (sev: SeverityLevel) => {
    switch (sev) {
      case 'high':
        return { text: 'High Operational Risk', color: 'text-red-700' };
      case 'medium':
        return { text: 'Moderate Process Friction', color: 'text-amber-700' };
      case 'positive_innovation':
        return { text: 'Positive Process Innovation', color: 'text-emerald-700' };
      default:
        return { text: 'Standard Observation', color: 'text-slate-600' };
    }
  };

  const formatCategoryLabel = (cat: InteractionCategory) => {
    return INTERACTION_CATEGORIES.find((c) => c.value === cat)?.label || cat;
  };

  return (
    <div className="space-y-6">
      {/* Guaranteed Transaction Verification Retry Banner */}
      {pendingRetryAction && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-50 border border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-red-900">
                Database Persistence Verification Alert
              </h3>
              <p className="text-xs text-red-800 mt-0.5">{pendingRetryAction.message}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={pendingRetryAction.onRetry}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-red-700 rounded-lg hover:bg-red-800 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Save</span>
            </button>
            <button
              type="button"
              onClick={onDismissRetry}
              className="px-3 py-2 text-xs font-medium text-red-800 hover:bg-red-100 rounded-lg whitespace-nowrap cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Employee Context Summary Bar & Section Switcher */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-900">{displayName}</span>
            <span aria-hidden="true">·</span>
            <span>{profile?.jobRole || 'Role Not Configured'}</span>
            <span aria-hidden="true">·</span>
            <span>{profile?.department || 'Department Unassigned'}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">
              Isolated Path: /users/{currentUserUid.slice(0, 12)}/interactions
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1 line-clamp-1">
            {profile?.jobDescription ||
              'Complete your professional background below to tailor Gemini 3.6 Flash audit insights to your exact job function.'}
          </p>
        </div>

        {/* Interactive Segmented Control (Functional Buttons) */}
        <div
          role="tablist"
          aria-label="Employee Workspace Views"
          className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeSection === 'exchange'}
            onClick={() => setActiveSection('exchange')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'exchange'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Audit Exchange Studio
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSection === 'profile'}
            onClick={() => setActiveSection('profile')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'profile'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Professional Background
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSection === 'history'}
            onClick={() => setActiveSection('history')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'history'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Past Entries ({interactions.length})
          </button>
        </div>
      </div>

      {/* SECTION 1: PROFESSIONAL BACKGROUND FORM */}
      {activeSection === 'profile' && (
        <section
          aria-label="Professional Background Configuration"
          className="bg-white border border-slate-200 rounded-xl p-6"
        >
          <div className="pb-4 mb-6 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Professional Background & Role Definition
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Stored in Cloud Firestore at{' '}
                <code className="font-mono">/users/{currentUserUid}</code> · Isolated to
                your account ({currentUserEmail})
              </p>
            </div>
            <UserCircle className="w-5 h-5 text-slate-600 shrink-0" />
          </div>

          {profileErrors.length > 0 && (
            <div
              role="alert"
              className="mb-5 p-4 rounded-lg bg-red-50 border border-red-200 text-xs text-red-900 space-y-1"
            >
              <p className="font-bold">Please fix the following validation issues:</p>
              <ul className="list-disc pl-5 space-y-0.5">
                {profileErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {profileSavedNotice && (
            <div
              role="status"
              className="mb-5 p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{profileSavedNotice}</span>
            </div>
          )}

          <form onSubmit={handleProfileSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label
                  htmlFor="profile-display-name"
                  className="block text-xs font-semibold text-slate-800 mb-1.5"
                >
                  Employee Name
                </label>
                <input
                  id="profile-display-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g., Elena Vance"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label
                  htmlFor="profile-job-role"
                  className="block text-xs font-semibold text-slate-800 mb-1.5"
                >
                  Role in the Company *
                </label>
                <input
                  id="profile-job-role"
                  type="text"
                  value={jobRole}
                  onChange={(e) => setJobRole(e.target.value)}
                  placeholder="e.g., Senior Site Reliability Lead"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label
                  htmlFor="profile-department"
                  className="block text-xs font-semibold text-slate-800 mb-1.5"
                >
                  Department / Business Unit *
                </label>
                <input
                  id="profile-department"
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g., Platform Operations"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="profile-job-description"
                className="block text-xs font-semibold text-slate-800 mb-1.5"
              >
                Specific Function & Job Description * (10–3,000 chars)
              </label>
              <textarea
                id="profile-job-description"
                rows={4}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Describe your daily responsibilities, key workflows, systems you own, and quality metrics you are accountable for..."
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>
                  Used by Gemini 3.6 Flash to tailor quality audit reflections and
                  brainstorming to your role.
                </span>
                <span className="font-mono tabular-nums">
                  {jobDescription.length} / 3000
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={isSavingProfile}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {isSavingProfile
                  ? 'Saving to Firestore...'
                  : 'Save Professional Background'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* SECTION 2: MULTI-TURN AUDIT EXCHANGE STUDIO */}
      {activeSection === 'exchange' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 7 Columns: Multi-Turn Input & Active Conversation */}
          <div className="lg:col-span-7 space-y-6">
            <section className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-5 border-b border-slate-200">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Multi-Turn Quality Audit Exchange with Gemini
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Share work processes, difficulties, complaints, or improvement
                    suggestions · Session{' '}
                    <span className="font-mono">{sessionId}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleStartNewThread}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>New Session Thread</span>
                </button>
              </div>

              {/* Category Selector (Functional Segmented Buttons) */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-800 mb-2">
                  Select Exchange Focus
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {INTERACTION_CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setSelectedCategory(cat.value)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        selectedCategory === cat.value
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  {
                    INTERACTION_CATEGORIES.find((c) => c.value === selectedCategory)
                      ?.description
                  }
                </p>
              </div>

              {/* Quick Prompt Starters */}
              <div className="mb-4">
                <span className="block text-xs font-medium text-slate-500 mb-1.5">
                  Quick Audit Scenarios (Click to populate):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PROMPT_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.label}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(tpl.category);
                        setUserPrompt(tpl.prompt);
                        setExchangeError(null);
                      }}
                      className="px-2.5 py-1 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors whitespace-nowrap cursor-pointer"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              {exchangeError && (
                <div
                  role="alert"
                  className="mb-4 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-900"
                >
                  {exchangeError}
                </div>
              )}

              <form onSubmit={handleExchangeSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="audit-prompt-input"
                    className="block text-xs font-semibold text-slate-800 mb-1.5"
                  >
                    Your Audit Observation, Challenge, Complaint, or Suggestion
                  </label>
                  <textarea
                    id="audit-prompt-input"
                    rows={4}
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    placeholder="Describe your workflow step, bottleneck, complaint, or process improvement idea in detail..."
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
                    <span>
                      Context: {profile?.jobRole || 'Unconfigured Role'} ·{' '}
                      {currentSessionInteractions.length} prior turn(s) in thread
                    </span>
                    <span className="font-mono tabular-nums">
                      {userPrompt.length} / 5000
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setActiveSection('profile')}
                    className="text-xs font-medium text-slate-600 hover:text-slate-900 underline underline-offset-2 cursor-pointer"
                  >
                    Edit Role & Job Description
                  </button>

                  <button
                    type="submit"
                    disabled={isAnalyzing}
                    className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-60 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>
                      {isAnalyzing
                        ? 'Analyzing with Gemini 3.6 Flash...'
                        : 'Submit & Save Audit Turn'}
                    </span>
                  </button>
                </div>
              </form>
            </section>

            {/* Active Session Multi-Turn Thread */}
            <section className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-900">
                  Recent Audit Exchanges & Gemini Insights
                </h3>
                <span className="text-xs font-mono text-slate-500 tabular-nums">
                  {interactions.length} total saved entries
                </span>
              </div>

              {interactions.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm font-semibold text-slate-800">
                    No Quality Audit Entries Logged Yet
                  </p>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Use the prompt studio above or click one of the Quick Audit Scenarios
                    to start a multi-turn quality audit exchange with Gemini 3.6 Flash.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {interactions.slice(0, 4).map((turn) => {
                    const sev = formatSeverityLabel(turn.severityLevel);
                    return (
                      <article
                        key={turn.id}
                        className="pb-6 border-b border-slate-200 last:border-b-0 last:pb-0 space-y-3"
                      >
                        {/* Unboxed Metadata Line (Zero-Pill Discipline) */}
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-900">
                              {formatCategoryLabel(turn.category)}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className={`font-medium ${sev.color}`}>{sev.text}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              {new Date(turn.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <span className="font-mono text-slate-400">
                            Thread: {turn.sessionId}
                          </span>
                        </div>

                        {/* User Prompt */}
                        <div className="p-3.5 rounded-lg bg-slate-50">
                          <p className="text-xs font-semibold text-slate-700 mb-1">
                            Your Input ({turn.userRoleSnapshot}):
                          </p>
                          <p className="text-sm text-slate-900 whitespace-pre-wrap">
                            {turn.userPrompt}
                          </p>
                        </div>

                        {/* Gemini Response & Structured Insights */}
                        <div className="p-4 rounded-lg bg-blue-50/60 space-y-3">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-blue-950">
                            <Sparkles className="w-4 h-4 text-blue-700" />
                            <span>Gemini 3.6 Flash Reflection & Follow-Up</span>
                          </div>
                          <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                            {turn.aiResponse}
                          </p>

                          <div className="pt-3 border-t border-blue-200/60 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div>
                              <p className="font-semibold text-slate-900 mb-1">
                                Executive Audit Summary
                              </p>
                              <p className="text-slate-700 leading-relaxed">
                                {turn.executiveSummary}
                              </p>
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900 mb-1">
                                Brainstorming & Actionable Ideas
                              </p>
                              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                                {turn.brainstormingIdeas}
                              </p>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-blue-200/60 text-xs text-slate-600">
                            <span className="font-semibold text-slate-800">
                              Company Audit Basis Alignment:{' '}
                            </span>
                            {turn.auditAlignment}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Right 5 Columns: Active Company Audit Basis, 16-Point Audit Summary & Role Context */}
          <div className="lg:col-span-5 space-y-6">
            {/* 6-Stage Interview Sequence & 16-Point Audit Summary Generator */}
            <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-200">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Quality Audit Interview Sequence
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    6-stage structured methodology · ISO 9001 / PDCA / Root-Cause
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateSessionSummary}
                  disabled={isGeneratingSummary || interactions.length === 0}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {isGeneratingSummary
                      ? 'Generating Summary...'
                      : 'Generate 16-Point Audit Summary'}
                  </span>
                </button>
              </div>

              {/* 6-Stage List (Unboxed clean rows, zero pills) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                {AUDIT_INTERVIEW_STAGES.map((stage) => (
                  <div
                    key={stage.stage}
                    className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80"
                  >
                    <p className="font-semibold text-slate-900">
                      {stage.shortLabel}
                    </p>
                    <p className="text-slate-600 mt-0.5 leading-snug font-mono text-[11px]">
                      {stage.code}
                    </p>
                  </div>
                ))}
              </div>

              {summaryError && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-900"
                >
                  {summaryError}
                </div>
              )}

              {auditSummaryReport && (
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-200">
                    <span className="font-bold text-slate-900">
                      16-Section Quality Audit Summary Report
                    </span>
                    <span className="font-mono">{auditSummaryReport.modelUsed}</span>
                  </div>
                  <div className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto pr-1">
                    {auditSummaryReport.summaryReport}
                  </div>
                </div>
              )}
            </section>

            <section className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Active Company Audit Basis
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Uploaded by Super Admin · Grounding Gemini evaluations
                  </p>
                </div>
                <FileText className="w-4 h-4 text-slate-600 shrink-0" />
              </div>

              {publishedCompanyDocs.length === 0 ? (
                <p className="text-xs text-slate-500 py-4">
                  No published company standards found. Using baseline ISO-9001 quality
                  criteria.
                </p>
              ) : (
                <div className="divide-y divide-slate-200">
                  {publishedCompanyDocs.map((docItem) => (
                    <div
                      key={docItem.id}
                      className="py-3.5 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                        <span className="font-semibold text-slate-900">
                          {docItem.title}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mb-1.5">
                        Category: {docItem.category.replace('_', ' ')} · Updated{' '}
                        <span className="font-mono tabular-nums">
                          {new Date(docItem.updatedAt).toLocaleDateString()}
                        </span>
                      </p>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {docItem.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white border border-slate-200 rounded-xl p-6">
              <h3 className="text-sm font-bold text-slate-900 mb-2">
                Strict User Privacy & Isolation Guarantee
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-3">
                All prompts, complaints, and Gemini reflections in your workspace are
                stored under{' '}
                <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">
                  /users/{currentUserUid}/interactions
                </code>
                .
              </p>
              <div className="text-xs text-slate-500 space-y-1.5 pt-3 border-t border-slate-200">
                <p>
                  · Other regular employees are blocked at the Firestore rule layer from
                  reading or listing your entries.
                </p>
                <p>
                  · Only your verified account and the designated Super Administrator can
                  review your audit submissions.
                </p>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* SECTION 3: PAST ENTRIES & HISTORY LOG */}
      {activeSection === 'history' && (
        <section
          aria-label="User Interaction History"
          className="bg-white border border-slate-200 rounded-xl p-6"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 mb-6 border-b border-slate-200">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <History className="w-5 h-5 text-slate-700" />
                <span>Your Private Audit History</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Showing <span className="font-mono tabular-nums">{filteredHistory.length}</span>{' '}
                of <span className="font-mono tabular-nums">{interactions.length}</span>{' '}
                persisted entries isolated to your account
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  aria-label="Search past entries"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search prompts, summaries, ideas..."
                  className="pl-9 pr-3.5 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 w-64"
                />
              </div>

              <select
                aria-label="Filter history by category"
                value={historyCategoryFilter}
                onChange={(e) => setHistoryCategoryFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="all">All Categories</option>
                {INTERACTION_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-semibold text-slate-800">
                No Matching Audit Entries Found
              </p>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                Try clearing your search filter or log a new audit entry in the Exchange
                Studio.
              </p>
              <button
                type="button"
                onClick={() => setActiveSection('exchange')}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                Log New Audit Entry
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filteredHistory.map((entry) => {
                const isExpanded = expandedEntryId === entry.id;
                const sev = formatSeverityLabel(entry.severityLevel);
                return (
                  <div key={entry.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="font-semibold text-slate-900">
                            {formatCategoryLabel(entry.category)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className={`font-medium ${sev.color}`}>{sev.text}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {new Date(entry.createdAt).toLocaleString()}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">Session: {entry.sessionId}</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">
                          {entry.executiveSummary}
                        </p>
                        <p className="text-xs text-slate-600 line-clamp-2">
                          Prompt: &ldquo;{entry.userPrompt}&rdquo;
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedEntryId(isExpanded ? null : entry.id)
                          }
                          aria-expanded={isExpanded}
                          className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md flex items-center gap-1 cursor-pointer"
                        >
                          <span>{isExpanded ? 'Hide Details' : 'View Full Exchange'}</span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => onDeleteInteraction(entry.id)}
                          aria-label={`Delete entry from ${new Date(entry.createdAt).toLocaleDateString()}`}
                          className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3 text-xs">
                        <div>
                          <p className="font-semibold text-slate-900 mb-1">
                            Your Recorded Observation:
                          </p>
                          <p className="text-slate-700 whitespace-pre-wrap">
                            {entry.userPrompt}
                          </p>
                        </div>
                        <div className="pt-3 border-t border-slate-200">
                          <p className="font-semibold text-slate-900 mb-1">
                            Gemini 3.6 Flash Reflection:
                          </p>
                          <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                            {entry.aiResponse}
                          </p>
                        </div>
                        <div className="pt-3 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="font-semibold text-slate-900 mb-1">
                              Brainstorming & Improvement Ideas:
                            </p>
                            <p className="text-slate-700 whitespace-pre-wrap">
                              {entry.brainstormingIdeas}
                            </p>
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 mb-1">
                              Company Audit Basis Alignment:
                            </p>
                            <p className="text-slate-700">{entry.auditAlignment}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
