/**
 * Pure validation, sanitization, and RBAC policy helpers synchronized with
 * firebase-blueprint.json and firestore.rules.
 */

export const SUPER_ADMIN_EMAIL = 'arn.gingoyon@gmail.com';

export const ID_REGEX = /^[a-zA-Z0-9_-]+$/;

export type InteractionCategory =
  | 'work_process'
  | 'difficulty_challenge'
  | 'complaint'
  | 'improvement_suggestion'
  | 'general_reflection';

export type SeverityLevel =
  | 'low'
  | 'medium'
  | 'high'
  | 'positive_innovation';

export type CompanyDocCategory =
  | 'company_overview'
  | 'quality_standard'
  | 'sop_workflow'
  | 'audit_rubric';

export interface UserProfileInput {
  uid: string;
  displayName: string;
  jobRole: string;
  department: string;
  jobDescription: string;
}

export interface CompanyDocInput {
  authorUid: string;
  title: string;
  category: CompanyDocCategory;
  content: string;
  status: 'published' | 'archived';
}

export interface AuditInteractionPayload {
  userId: string;
  sessionId: string;
  category: InteractionCategory;
  userPrompt: string;
  aiResponse: string;
  executiveSummary: string;
  brainstormingIdeas: string;
  auditAlignment: string;
  severityLevel: SeverityLevel;
  userRoleSnapshot: string;
  userNameSnapshot: string;
}

export const INTERACTION_CATEGORIES: {
  value: InteractionCategory;
  label: string;
  description: string;
}[] = [
  {
    value: 'work_process',
    label: 'Work Process',
    description: 'Document end-to-end daily workflows, handoffs, and operational procedures.'
  },
  {
    value: 'difficulty_challenge',
    label: 'Difficulty / Bottleneck',
    description: 'Report technical blockers, resource constraints, or recurring friction.'
  },
  {
    value: 'complaint',
    label: 'Quality / Process Complaint',
    description: 'Escalate systemic quality gaps, SLA breakdowns, or tooling failures.'
  },
  {
    value: 'improvement_suggestion',
    label: 'Improvement Suggestion',
    description: 'Propose automation ideas, SOP revisions, or measurable quality upgrades.'
  },
  {
    value: 'general_reflection',
    label: 'General Reflection',
    description: 'Share follow-up thoughts or multi-turn clarifications during the audit.'
  }
];

export const COMPANY_DOC_CATEGORIES: {
  value: CompanyDocCategory;
  label: string;
}[] = [
  { value: 'company_overview', label: 'Company Overview & Mission' },
  { value: 'quality_standard', label: 'Quality Standard (ISO / SLA)' },
  { value: 'sop_workflow', label: 'Standard Operating Procedure (SOP)' },
  { value: 'audit_rubric', label: 'Audit Evaluation Rubric' }
];

/**
 * Recursively strips all `undefined` properties from an object to guarantee
 * zero-crash payload hygiene before Firestore writes.
 */
export function stripUndefined<T>(input: T): T {
  if (input === null || input === undefined) {
    return input;
  }
  if (Array.isArray(input)) {
    return input
      .filter((item) => item !== undefined)
      .map((item) => stripUndefined(item)) as unknown as T;
  }
  if (typeof input === 'object' && input.constructor === Object) {
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (value !== undefined) {
        clean[key] = stripUndefined(value);
      }
    }
    return clean as T;
  }
  return input;
}

export function isValidId(id: unknown): id is string {
  return (
    typeof id === 'string' &&
    id.length >= 1 &&
    id.length <= 128 &&
    ID_REGEX.test(id)
  );
}

/**
 * Verifies whether an authenticated user is the designated Super Admin.
 * Enforces email_verified === true to prevent email spoofing.
 */
export function isSuperAdminUser(
  email?: string | null,
  emailVerified?: boolean | null
): boolean {
  if (!email || emailVerified !== true) {
    return false;
  }
  return email.trim().toLowerCase() === SUPER_ADMIN_EMAIL;
}

export function validateUserProfileInput(
  raw: Partial<UserProfileInput> & Record<string, unknown>
): { valid: boolean; errors: string[]; sanitized?: UserProfileInput } {
  const errors: string[] = [];
  const allowedKeys = new Set([
    'uid',
    'displayName',
    'jobRole',
    'department',
    'jobDescription',
    'createdAt',
    'updatedAt'
  ]);

  for (const key of Object.keys(raw)) {
    if (!allowedKeys.has(key)) {
      errors.push(`Unauthorized shadow field "${key}" is not allowed.`);
    }
  }

  const uid = typeof raw.uid === 'string' ? raw.uid.trim() : '';
  const displayName = typeof raw.displayName === 'string' ? raw.displayName.trim() : '';
  const jobRole = typeof raw.jobRole === 'string' ? raw.jobRole.trim() : '';
  const department = typeof raw.department === 'string' ? raw.department.trim() : '';
  const jobDescription =
    typeof raw.jobDescription === 'string' ? raw.jobDescription.trim() : '';

  if (!isValidId(uid)) {
    errors.push('User ID must be 1-128 alphanumeric characters, hyphens, or underscores.');
  }
  if (displayName.length < 1 || displayName.length > 120) {
    errors.push('Display Name must be between 1 and 120 characters.');
  }
  if (jobRole.length < 2 || jobRole.length > 120) {
    errors.push('Company Role must be between 2 and 120 characters.');
  }
  if (department.length < 2 || department.length > 100) {
    errors.push('Department must be between 2 and 100 characters.');
  }
  if (jobDescription.length < 10 || jobDescription.length > 3000) {
    errors.push('Specific Function / Job Description must be between 10 and 3,000 characters.');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    sanitized: stripUndefined({
      uid,
      displayName,
      jobRole,
      department,
      jobDescription
    })
  };
}

export function validateCompanyDocInput(
  raw: Partial<CompanyDocInput> & Record<string, unknown>
): { valid: boolean; errors: string[]; sanitized?: CompanyDocInput } {
  const errors: string[] = [];
  const allowedKeys = new Set([
    'authorUid',
    'title',
    'category',
    'content',
    'status',
    'createdAt',
    'updatedAt'
  ]);

  for (const key of Object.keys(raw)) {
    if (!allowedKeys.has(key)) {
      errors.push(`Unauthorized shadow field "${key}" is not allowed.`);
    }
  }

  const authorUid = typeof raw.authorUid === 'string' ? raw.authorUid.trim() : '';
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const category = raw.category as CompanyDocCategory;
  const content = typeof raw.content === 'string' ? raw.content.trim() : '';
  const status = raw.status ?? 'published';

  if (!isValidId(authorUid)) {
    errors.push('Author UID is invalid.');
  }
  if (title.length < 3 || title.length > 150) {
    errors.push('Document Title must be between 3 and 150 characters.');
  }
  if (
    !['company_overview', 'quality_standard', 'sop_workflow', 'audit_rubric'].includes(
      category
    )
  ) {
    errors.push('Invalid document category.');
  }
  if (content.length < 10 || content.length > 15000) {
    errors.push('Document Content must be between 10 and 15,000 characters.');
  }
  if (!['published', 'archived'].includes(status)) {
    errors.push('Invalid status value.');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    sanitized: stripUndefined({
      authorUid,
      title,
      category,
      content,
      status: status as 'published' | 'archived'
    })
  };
}

export function validateAuditInteractionPayload(
  raw: Partial<AuditInteractionPayload> & Record<string, unknown>
): { valid: boolean; errors: string[]; sanitized?: AuditInteractionPayload } {
  const errors: string[] = [];
  const allowedKeys = new Set([
    'userId',
    'sessionId',
    'category',
    'userPrompt',
    'aiResponse',
    'executiveSummary',
    'brainstormingIdeas',
    'auditAlignment',
    'severityLevel',
    'userRoleSnapshot',
    'userNameSnapshot',
    'createdAt'
  ]);

  for (const key of Object.keys(raw)) {
    if (!allowedKeys.has(key)) {
      errors.push(`Unauthorized shadow field "${key}" is not allowed.`);
    }
  }

  const userId = typeof raw.userId === 'string' ? raw.userId.trim() : '';
  const sessionId = typeof raw.sessionId === 'string' ? raw.sessionId.trim() : '';
  const category = raw.category as InteractionCategory;
  const userPrompt = typeof raw.userPrompt === 'string' ? raw.userPrompt.trim() : '';
  const aiResponse = typeof raw.aiResponse === 'string' ? raw.aiResponse.trim() : '';
  const executiveSummary =
    typeof raw.executiveSummary === 'string' ? raw.executiveSummary.trim() : '';
  const brainstormingIdeas =
    typeof raw.brainstormingIdeas === 'string' ? raw.brainstormingIdeas.trim() : '';
  const auditAlignment =
    typeof raw.auditAlignment === 'string' ? raw.auditAlignment.trim() : '';
  const severityLevel = raw.severityLevel as SeverityLevel;
  const userRoleSnapshot =
    typeof raw.userRoleSnapshot === 'string' ? raw.userRoleSnapshot.trim() : '';
  const userNameSnapshot =
    typeof raw.userNameSnapshot === 'string' ? raw.userNameSnapshot.trim() : '';

  if (!isValidId(userId)) {
    errors.push('Invalid userId.');
  }
  if (!isValidId(sessionId)) {
    errors.push('Invalid sessionId.');
  }
  if (
    ![
      'work_process',
      'difficulty_challenge',
      'complaint',
      'improvement_suggestion',
      'general_reflection'
    ].includes(category)
  ) {
    errors.push('Invalid interaction category.');
  }
  if (userPrompt.length < 2 || userPrompt.length > 5000) {
    errors.push('User input must be between 2 and 5,000 characters.');
  }
  if (aiResponse.length < 1 || aiResponse.length > 12000) {
    errors.push('AI response must be between 1 and 12,000 characters.');
  }
  if (executiveSummary.length < 1 || executiveSummary.length > 2000) {
    errors.push('Executive summary must be between 1 and 2,000 characters.');
  }
  if (brainstormingIdeas.length < 1 || brainstormingIdeas.length > 3000) {
    errors.push('Brainstorming ideas must be between 1 and 3,000 characters.');
  }
  if (auditAlignment.length < 1 || auditAlignment.length > 2000) {
    errors.push('Audit alignment must be between 1 and 2,000 characters.');
  }
  if (!['low', 'medium', 'high', 'positive_innovation'].includes(severityLevel)) {
    errors.push('Invalid severityLevel.');
  }
  if (userRoleSnapshot.length < 2 || userRoleSnapshot.length > 250) {
    errors.push('Invalid userRoleSnapshot.');
  }
  if (userNameSnapshot.length < 1 || userNameSnapshot.length > 120) {
    errors.push('Invalid userNameSnapshot.');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    sanitized: stripUndefined({
      userId,
      sessionId,
      category,
      userPrompt: userPrompt.slice(0, 5000),
      aiResponse: aiResponse.slice(0, 12000),
      executiveSummary: executiveSummary.slice(0, 2000),
      brainstormingIdeas: brainstormingIdeas.slice(0, 3000),
      auditAlignment: auditAlignment.slice(0, 2000),
      severityLevel,
      userRoleSnapshot: userRoleSnapshot.slice(0, 250),
      userNameSnapshot: userNameSnapshot.slice(0, 120)
    })
  };
}

/**
 * Mitigates CSV / Spreadsheet Formula Injection (OWASP A03) and RFC 4180 escaping.
 * Prefixes cells starting with '=', '+', '-', '@', '\t', or '\r' with a single quote
 * so spreadsheet applications treat untrusted user prompts or AI text as plain strings.
 */
export function escapeCsvField(rawValue: unknown): string {
  const str = rawValue === null || rawValue === undefined ? '' : String(rawValue);
  const formulaTriggers = ['=', '+', '-', '@', '\t', '\r'];
  const neutralized =
    str.length > 0 && formulaTriggers.includes(str[0]) ? `'${str}` : str;
  const escapedQuotes = neutralized.replace(/"/g, '""');
  return `"${escapedQuotes}"`;
}

export interface CsvExportableInteraction {
  id: string;
  userId: string;
  sessionId: string;
  userNameSnapshot: string;
  userRoleSnapshot: string;
  category: string;
  severityLevel: string;
  userPrompt: string;
  executiveSummary: string;
  brainstormingIdeas: string;
  auditAlignment: string;
  aiResponse: string;
  createdAt: string;
}

/**
 * Generates an RFC 4180 compliant, formula-injection-safe CSV string from audit interactions.
 */
export function generateAuditResultsCsv(
  interactions: CsvExportableInteraction[]
): string {
  const headers = [
    'Interaction ID',
    'Timestamp (ISO)',
    'Employee Name',
    'Employee Role & Department',
    'User UID',
    'Session ID',
    'Category',
    'Severity / Impact Level',
    'Employee Reported Input',
    'Executive Audit Summary',
    'Brainstorming & Process Recommendations',
    'Company Standard Alignment',
    'Full Gemini Audit Reflection'
  ];

  const headerRow = headers.map((h) => escapeCsvField(h)).join(',');
  const rows = interactions.map((item) =>
    [
      item.id,
      item.createdAt,
      item.userNameSnapshot,
      item.userRoleSnapshot,
      item.userId,
      item.sessionId,
      item.category,
      item.severityLevel,
      item.userPrompt,
      item.executiveSummary,
      item.brainstormingIdeas,
      item.auditAlignment,
      item.aiResponse
    ]
      .map((field) => escapeCsvField(field))
      .join(',')
  );

  return [headerRow, ...rows].join('\r\n');
}

export interface DailyAuditActivityPoint {
  date: string;
  displayDate: string;
  total: number;
  highRisk: number;
  innovations: number;
  isSpike: boolean;
}

/**
 * Aggregates audit interactions by UTC calendar date (YYYY-MM-DD) in chronological order
 * and flags activity spikes (dates exceeding the daily mean and >= 2 interactions).
 */
export function aggregateInteractionsByDate(
  interactions: ReadonlyArray<{
    createdAt: unknown;
    severityLevel?: string;
  }>
): DailyAuditActivityPoint[] {
  const bucketMap = new Map<
    string,
    { total: number; highRisk: number; innovations: number }
  >();

  for (const item of interactions) {
    if (!item || typeof item.createdAt !== 'string') continue;
    const parsedDate = new Date(item.createdAt);
    if (Number.isNaN(parsedDate.getTime())) continue;

    const isoDate = parsedDate.toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) continue;

    const current = bucketMap.get(isoDate) || {
      total: 0,
      highRisk: 0,
      innovations: 0
    };
    current.total += 1;
    if (item.severityLevel === 'high') {
      current.highRisk += 1;
    } else if (item.severityLevel === 'positive_innovation') {
      current.innovations += 1;
    }
    bucketMap.set(isoDate, current);
  }

  const sortedDates = Array.from(bucketMap.keys()).sort((a, b) =>
    a.localeCompare(b)
  );

  if (sortedDates.length === 0) {
    return [];
  }

  const totalAcrossDays = sortedDates.reduce(
    (acc, d) => acc + (bucketMap.get(d)?.total || 0),
    0
  );
  const dailyMean = totalAcrossDays / sortedDates.length;
  const maxDailyTotal = Math.max(
    ...sortedDates.map((d) => bucketMap.get(d)?.total || 0)
  );

  return sortedDates.map((dateStr) => {
    const counts = bucketMap.get(dateStr)!;
    const [year, month, day] = dateStr.split('-').map(Number);
    const utcDate = new Date(Date.UTC(year, month - 1, day));
    const displayDate = utcDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    });

    const isSpike =
      counts.total >= 2 &&
      (counts.total > dailyMean ||
        (sortedDates.length === 1 && counts.total === maxDailyTotal));

    return {
      date: dateStr,
      displayDate,
      total: counts.total,
      highRisk: counts.highRisk,
      innovations: counts.innovations,
      isSpike
    };
  });
}


