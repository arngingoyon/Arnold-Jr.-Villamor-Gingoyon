import React, { useState, useMemo } from 'react';
import {
  Building2,
  Upload,
  FileCheck2,
  Users,
  Search,
  Sparkles,
  Trash2,
  Archive,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Plus,
  Download,
  TrendingUp
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import {
  COMPANY_DOC_CATEGORIES,
  CompanyDocCategory,
  INTERACTION_CATEGORIES,
  SUPER_ADMIN_EMAIL,
  validateCompanyDocInput,
  generateAuditResultsCsv,
  aggregateInteractionsByDate
} from '../utils/auditValidation';
import {
  StoredAuditInteraction,
  StoredCompanyDoc,
  StoredUserProfile
} from '../utils/seedData';

interface SuperAdminViewProps {
  adminUid: string;
  adminEmail: string;
  companyDocs: StoredCompanyDoc[];
  allUserInteractions: StoredAuditInteraction[];
  allUserProfiles: StoredUserProfile[];
  onCreateCompanyDoc: (docData: {
    title: string;
    category: CompanyDocCategory;
    content: string;
    status: 'published' | 'archived';
  }) => Promise<void>;
  onToggleCompanyDocStatus: (
    docId: string,
    nextStatus: 'published' | 'archived'
  ) => Promise<void>;
  onDeleteCompanyDoc: (docId: string) => Promise<void>;
  onSeedDefaultCompanyDocs: () => Promise<void>;
  pendingRetryAction: {
    message: string;
    onRetry: () => Promise<void>;
  } | null;
  onDismissRetry: () => void;
}

export const SuperAdminView: React.FC<SuperAdminViewProps> = ({
  adminUid,
  adminEmail,
  companyDocs,
  allUserInteractions,
  allUserProfiles,
  onCreateCompanyDoc,
  onToggleCompanyDocStatus,
  onDeleteCompanyDoc,
  onSeedDefaultCompanyDocs,
  pendingRetryAction,
  onDismissRetry
}) => {
  const [activeTab, setActiveTab] = useState<'audit_results' | 'company_basis'>(
    'audit_results'
  );

  // Company Basis Upload Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<CompanyDocCategory>('quality_standard');
  const [content, setContent] = useState('');
  const [docErrors, setDocErrors] = useState<string[]>([]);
  const [isSavingDoc, setIsSavingDoc] = useState(false);
  const [docSuccessMsg, setDocSuccessMsg] = useState<string | null>(null);

  // Cross-User Audit Results Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedSeverityFilter, setSelectedSeverityFilter] = useState<string>('all');

  // Executive Synthesis State
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [csvExportNotice, setCsvExportNotice] = useState<string | null>(null);
  const [executiveSynthesis, setExecutiveSynthesis] = useState<{
    overallHealthAssessment: string;
    topSystemicRisks: string;
    priorityActionPlan: string;
    modelUsed: string;
  } | null>(null);

  const uniqueUsers = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of allUserProfiles) {
      map.set(p.uid, `${p.displayName} (${p.jobRole})`);
    }
    for (const i of allUserInteractions) {
      if (!map.has(i.userId)) {
        map.set(i.userId, `${i.userNameSnapshot} (${i.userRoleSnapshot})`);
      }
    }
    return Array.from(map.entries()).map(([uid, label]) => ({ uid, label }));
  }, [allUserProfiles, allUserInteractions]);

  const filteredAuditResults = useMemo(() => {
    return allUserInteractions.filter((item) => {
      const matchesUser =
        selectedUserFilter === 'all' || item.userId === selectedUserFilter;
      const matchesCategory =
        selectedCategoryFilter === 'all' || item.category === selectedCategoryFilter;
      const matchesSeverity =
        selectedSeverityFilter === 'all' || item.severityLevel === selectedSeverityFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.userNameSnapshot.toLowerCase().includes(q) ||
        item.userRoleSnapshot.toLowerCase().includes(q) ||
        item.userPrompt.toLowerCase().includes(q) ||
        item.executiveSummary.toLowerCase().includes(q) ||
        item.auditAlignment.toLowerCase().includes(q);
      return matchesUser && matchesCategory && matchesSeverity && matchesSearch;
    });
  }, [
    allUserInteractions,
    selectedUserFilter,
    selectedCategoryFilter,
    selectedSeverityFilter,
    searchQuery
  ]);

  const metrics = useMemo(() => {
    const highRiskCount = allUserInteractions.filter(
      (i) => i.severityLevel === 'high'
    ).length;
    const innovationCount = allUserInteractions.filter(
      (i) => i.severityLevel === 'positive_innovation'
    ).length;
    const publishedDocsCount = companyDocs.filter(
      (d) => d.status === 'published'
    ).length;
    return {
      totalInteractions: allUserInteractions.length,
      uniqueContributors: uniqueUsers.length,
      highRiskCount,
      innovationCount,
      publishedDocsCount
    };
  }, [allUserInteractions, uniqueUsers, companyDocs]);

  const dailyActivitySeries = useMemo(
    () => aggregateInteractionsByDate(filteredAuditResults),
    [filteredAuditResults]
  );

  const peakSpikeDay = useMemo(() => {
    if (dailyActivitySeries.length === 0) return null;
    return dailyActivitySeries.reduce((max, cur) =>
      cur.total > max.total ? cur : max
    );
  }, [dailyActivitySeries]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, '').slice(0, 140));
      }
      setContent(text.slice(0, 15000));
    };
    reader.readAsText(file);
  };

  const handleCreateDocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDocSuccessMsg(null);

    const validation = validateCompanyDocInput({
      authorUid: adminUid,
      title,
      category,
      content,
      status: 'published'
    });

    if (!validation.valid || !validation.sanitized) {
      setDocErrors(validation.errors);
      return;
    }

    setDocErrors([]);
    setIsSavingDoc(true);
    try {
      await onCreateCompanyDoc({
        title: validation.sanitized.title,
        category: validation.sanitized.category,
        content: validation.sanitized.content,
        status: 'published'
      });
      setTitle('');
      setContent('');
      setDocSuccessMsg(
        'Company Audit Basis document uploaded and published to Cloud Firestore.'
      );
    } catch (err) {
      setDocErrors([
        err instanceof Error
          ? err.message
          : 'Failed to upload company audit document. Input preserved—use Retry Save.'
      ]);
    } finally {
      setIsSavingDoc(false);
    }
  };

  const handleRunExecutiveSynthesis = async () => {
    if (allUserInteractions.length === 0) return;
    setIsSynthesizing(true);
    try {
      const response = await fetch('/api/audit/executive-synthesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interactions: allUserInteractions,
          companyDocs: companyDocs.filter((d) => d.status === 'published')
        })
      });
      const data = await response.json();
      if (response.ok) {
        setExecutiveSynthesis(data);
      }
    } catch (err) {
      console.error('Executive synthesis error:', err);
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleExportToCsv = () => {
    if (filteredAuditResults.length === 0) return;
    const csvString = generateAuditResultsCsv(filteredAuditResults);
    const blob = new Blob(['\uFEFF' + csvString], {
      type: 'text/csv;charset=utf-8;'
    });
    const url = URL.createObjectURL(blob);
    const dateStamp = new Date().toISOString().slice(0, 10);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `auditpulse-audit-results-${dateStamp}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setCsvExportNotice(
      `Exported ${filteredAuditResults.length} audit interaction(s) to auditpulse-audit-results-${dateStamp}.csv`
    );
  };

  return (
    <div className="space-y-6">
      {/* Retry Banner for Guaranteed Transaction Verification */}
      {pendingRetryAction && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-50 border border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-red-900">
                Super Admin Persistence Alert
              </h3>
              <p className="text-xs text-red-800 mt-0.5">{pendingRetryAction.message}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={pendingRetryAction.onRetry}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-red-700 rounded-lg hover:bg-red-800 flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Save</span>
            </button>
            <button
              type="button"
              onClick={onDismissRetry}
              className="px-3 py-2 text-xs font-medium text-red-800 hover:bg-red-100 rounded-lg cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Super Admin Header & KPI Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-900">
                Super Administrator Governance Console
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-blue-800">{SUPER_ADMIN_EMAIL}</span>
              <span aria-hidden="true">·</span>
              <span>Active Session: {adminEmail}</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              Organizational Quality Audit & Standards Repository
            </h2>
          </div>

          <div
            role="tablist"
            aria-label="Super Admin Console Views"
            className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'audit_results'}
              onClick={() => setActiveTab('audit_results')}
              className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'audit_results'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cross-User Audit Results ({allUserInteractions.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'company_basis'}
              onClick={() => setActiveTab('company_basis')}
              className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'company_basis'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Company Audit Basis ({companyDocs.length})
            </button>
          </div>
        </div>

        {/* 4-Column Tabular KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-5">
          <div>
            <p className="text-xs text-slate-500">Total Employee Audit Turns</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {metrics.totalInteractions}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Across {metrics.uniqueContributors} audited employee role(s)
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-500">High-Risk Process Escalations</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-red-700 mt-1">
              {metrics.highRiskCount}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Requires SLA / SOP remediation
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-500">Positive Process Innovations</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
              {metrics.innovationCount}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Employee automation & workflow proposals
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-500">Published Company Audit Standards</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-blue-700 mt-1">
              {metrics.publishedDocsCount}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Active in Gemini 3.6 Flash context
            </p>
          </div>
        </div>
      </div>

      {/* TAB 1: CROSS-USER QUALITY AUDIT RESULTS */}
      {activeTab === 'audit_results' && (
        <div className="space-y-6">
          {/* Executive Synthesis Card */}
          <section className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-700" />
                  <span>Gemini 3.6 Flash Cross-User Executive Audit Synthesis</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Synthesize systemic quality bottlenecks, complaints, and employee
                  improvement proposals against uploaded company standards.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRunExecutiveSynthesis}
                disabled={isSynthesizing || allUserInteractions.length === 0}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isSynthesizing
                  ? 'Synthesizing Report...'
                  : 'Generate Executive Audit Brief'}
              </button>
            </div>

            {executiveSynthesis && (
              <div className="mt-5 pt-5 border-t border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="font-bold text-slate-900 mb-1.5">
                    01. Organizational Health Assessment
                  </p>
                  <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {executiveSynthesis.overallHealthAssessment}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="font-bold text-red-900 mb-1.5">
                    02. Top Systemic Quality Risks
                  </p>
                  <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {executiveSynthesis.topSystemicRisks}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="font-bold text-emerald-900 mb-1.5">
                    03. Recommended Priority Action Plan
                  </p>
                  <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {executiveSynthesis.priorityActionPlan}
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* Recharts Line Chart: Audit Interaction Frequency by Date & Activity Spikes */}
          <section
            aria-label="Audit Interaction Frequency by Date"
            className="bg-white border border-slate-200 rounded-xl p-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-5 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>Audit Interaction Frequency & Activity Spike Timeline</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Daily volume of employee quality audit submissions and high-risk
                  escalations across users
                </p>
              </div>

              {peakSpikeDay && (
                <div className="text-xs text-slate-600 flex items-center gap-2 shrink-0">
                  <span>Peak Activity Spike:</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {peakSpikeDay.date} ({peakSpikeDay.total} interactions)
                  </span>
                </div>
              )}
            </div>

            {dailyActivitySeries.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                No audit interactions available for the selected filter criteria.
              </div>
            ) : (
              <div className="w-full h-64" data-testid="super-admin-activity-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={dailyActivitySeries}
                    margin={{ top: 10, right: 24, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="displayDate"
                      tick={{ fontSize: 12, fill: '#475569' }}
                      stroke="#cbd5e1"
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 12, fill: '#475569' }}
                      stroke="#cbd5e1"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderColor: '#e2e8f0',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                      labelFormatter={(label, payload) => {
                        const point = payload?.[0]?.payload;
                        if (point) {
                          return `${label} (${point.date})${
                            point.isSpike ? ' · Activity Spike Detected' : ''
                          }`;
                        }
                        return String(label);
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      name="Total Audit Interactions"
                      stroke="#1d4ed8"
                      strokeWidth={2.5}
                      activeDot={{ r: 6 }}
                      dot={{ r: 4, fill: '#1d4ed8' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="highRisk"
                      name="High-Risk Escalations"
                      stroke="#b91c1c"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ r: 3.5, fill: '#b91c1c' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* Filterable Cross-User Results Ledger */}
          <section className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="pb-5 mb-6 border-b border-slate-200 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-700 shrink-0" />
                    <span>Multi-User Quality Audit Findings</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Showing{' '}
                    <span className="font-mono tabular-nums font-semibold text-slate-900">
                      {filteredAuditResults.length}
                    </span>{' '}
                    of{' '}
                    <span className="font-mono tabular-nums font-semibold text-slate-900">
                      {allUserInteractions.length}
                    </span>{' '}
                    entries across employees
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {csvExportNotice && (
                    <span
                      role="status"
                      className="text-xs font-medium text-emerald-700 flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{csvExportNotice}</span>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleExportToCsv}
                    disabled={filteredAuditResults.length === 0}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export to CSV</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    aria-label="Search user audit results"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search employee, role, summary..."
                    className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <select
                  aria-label="Filter by employee"
                  value={selectedUserFilter}
                  onChange={(e) => setSelectedUserFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="all">All Employees ({uniqueUsers.length})</option>
                  {uniqueUsers.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.label}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter by category"
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="all">All Categories</option>
                  {INTERACTION_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter by severity"
                  value={selectedSeverityFilter}
                  onChange={(e) => setSelectedSeverityFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="all">All Impact Levels</option>
                  <option value="high">High Risk</option>
                  <option value="medium">Moderate Friction</option>
                  <option value="low">Low / Standard</option>
                  <option value="positive_innovation">Positive Innovation</option>
                </select>
              </div>
            </div>

            {filteredAuditResults.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-semibold text-slate-800">
                  No User Audit Results Match Current Filters
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Adjust your filters above or switch to the Employee Workspace to submit
                  new audit entries.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {filteredAuditResults.map((item) => (
                  <article key={item.id} className="py-5 first:pt-0 last:pb-0 space-y-3">
                    {/* Unboxed Metadata Line */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900">
                          {item.userNameSnapshot}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="text-slate-700">{item.userRoleSnapshot}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-medium text-blue-800">
                          {INTERACTION_CATEGORIES.find((c) => c.value === item.category)
                            ?.label || item.category}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`font-semibold ${
                            item.severityLevel === 'high'
                              ? 'text-red-700'
                              : item.severityLevel === 'positive_innovation'
                                ? 'text-emerald-700'
                                : 'text-amber-700'
                          }`}
                        >
                          Impact: {item.severityLevel.replace('_', ' ')}
                        </span>
                      </div>
                      <span className="font-mono tabular-nums">
                        {new Date(item.createdAt).toLocaleString()} · UID:{' '}
                        {item.userId.slice(0, 10)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                      <div className="lg:col-span-5 p-4 rounded-lg bg-slate-50 text-xs space-y-1.5">
                        <p className="font-semibold text-slate-900">
                          Employee Reported Input:
                        </p>
                        <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                          {item.userPrompt}
                        </p>
                      </div>

                      <div className="lg:col-span-7 p-4 rounded-lg bg-blue-50/50 text-xs space-y-2">
                        <div>
                          <span className="font-semibold text-slate-900">
                            Executive Audit Summary:{' '}
                          </span>
                          <span className="text-slate-800">{item.executiveSummary}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900">
                            Brainstorming & Process Recommendations:{' '}
                          </span>
                          <p className="text-slate-700 whitespace-pre-wrap mt-0.5">
                            {item.brainstormingIdeas}
                          </p>
                        </div>
                        <div className="pt-1.5 border-t border-blue-200/60 text-slate-600">
                          <span className="font-semibold text-slate-800">
                            Standard Alignment:{' '}
                          </span>
                          {item.auditAlignment}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 2: COMPANY INFORMATION & AUDIT BASIS MANAGER */}
      {activeTab === 'company_basis' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 5 Columns: Upload / Create Company Audit Basis */}
          <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
            <div className="pb-4 mb-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Upload Company Audit Basis
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Publish company information, SOPs, and quality rubrics to{' '}
                  <code className="font-mono">/company_docs</code>
                </p>
              </div>
              <Building2 className="w-5 h-5 text-slate-700 shrink-0" />
            </div>

            {docErrors.length > 0 && (
              <div
                role="alert"
                className="mb-4 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-900 space-y-1"
              >
                <p className="font-bold">Validation Error:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {docErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {docSuccessMsg && (
              <div
                role="status"
                className="mb-4 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{docSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateDocSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="company-doc-file"
                  className="block text-xs font-semibold text-slate-800 mb-1.5"
                >
                  Optional: Import from Document File (.txt, .md, .json, .csv)
                </label>
                <label
                  htmlFor="company-doc-file"
                  className="flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-medium text-slate-700 bg-slate-50 border border-dashed border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-slate-500" />
                  <span>Choose file to populate content...</span>
                  <input
                    id="company-doc-file"
                    type="file"
                    accept=".txt,.md,.json,.csv"
                    onChange={handleFileUpload}
                    className="sr-only"
                  />
                </label>
              </div>

              <div>
                <label
                  htmlFor="company-doc-title"
                  className="block text-xs font-semibold text-slate-800 mb-1.5"
                >
                  Document / Standard Title *
                </label>
                <input
                  id="company-doc-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., ISO 9001:2026 Incident Response SLA Standard"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label
                  htmlFor="company-doc-category"
                  className="block text-xs font-semibold text-slate-800 mb-1.5"
                >
                  Classification Category *
                </label>
                <select
                  id="company-doc-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as CompanyDocCategory)}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {COMPANY_DOC_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="company-doc-content"
                  className="block text-xs font-semibold text-slate-800 mb-1.5"
                >
                  Authoritative Audit Basis Content * (10–15,000 chars)
                </label>
                <textarea
                  id="company-doc-content"
                  rows={6}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter company background, operational SLAs, quality benchmarks, or audit evaluation criteria..."
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>Automatically injected into Gemini 3.6 Flash audit context</span>
                  <span className="font-mono tabular-nums">
                    {content.length} / 15000
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingDoc}
                className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {isSavingDoc
                    ? 'Publishing Standard...'
                    : 'Publish Company Audit Basis'}
                </span>
              </button>
            </form>
          </section>

          {/* Right 7 Columns: Repository of Uploaded Company Standards */}
          <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-slate-700" />
                  <span>Active & Archived Company Audit Standards</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Write access strictly restricted to Super Admin ({SUPER_ADMIN_EMAIL})
                </p>
              </div>

              {companyDocs.length === 0 && (
                <button
                  type="button"
                  onClick={onSeedDefaultCompanyDocs}
                  className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md cursor-pointer"
                >
                  Load Enterprise ISO/SOP Starter Pack
                </button>
              )}
            </div>

            {companyDocs.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-semibold text-slate-800">
                  No Company Audit Basis Documents Uploaded Yet
                </p>
                <p className="text-xs text-slate-500 mt-1 mb-4">
                  Use the form on the left or load the Enterprise ISO/SOP Starter Pack to
                  ground employee quality audits.
                </p>
                <button
                  type="button"
                  onClick={onSeedDefaultCompanyDocs}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  Load Enterprise ISO/SOP Starter Pack
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {companyDocs.map((docItem) => (
                  <div key={docItem.id} className="py-4 first:pt-0 last:pb-0 space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">
                          {docItem.title}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                          <span>
                            {COMPANY_DOC_CATEGORIES.find(
                              (c) => c.value === docItem.category
                            )?.label || docItem.category}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={
                              docItem.status === 'published'
                                ? 'font-semibold text-emerald-700'
                                : 'font-medium text-slate-500'
                            }
                          >
                            Status: {docItem.status}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            Updated {new Date(docItem.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            onToggleCompanyDocStatus(
                              docItem.id,
                              docItem.status === 'published' ? 'archived' : 'published'
                            )
                          }
                          className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded flex items-center gap-1 cursor-pointer"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          <span>
                            {docItem.status === 'published' ? 'Archive' : 'Publish'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteCompanyDoc(docItem.id)}
                          aria-label={`Delete ${docItem.title}`}
                          className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-200">
                      {docItem.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
