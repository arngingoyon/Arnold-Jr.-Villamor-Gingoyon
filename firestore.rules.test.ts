import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidId,
  isSuperAdminUser,
  stripUndefined,
  validateUserProfileInput,
  validateCompanyDocInput,
  validateAuditInteractionPayload,
  escapeCsvField,
  generateAuditResultsCsv,
  aggregateInteractionsByDate,
  SUPER_ADMIN_EMAIL
} from './src/utils/auditValidation.ts';

interface SimAuth {
  uid: string;
  email: string;
  email_verified: boolean;
}

interface SimState {
  serverTime: number;
  existingProfiles: Set<string>;
}

/**
 * Deterministic evaluator mirroring firestore.rules to test the Dirty Dozen
 * adversarial payloads in Phase 0 / Phase 5.
 */
function evaluateFirestoreRule(
  operation: 'get' | 'list' | 'create' | 'update',
  path: string,
  auth: SimAuth | null,
  payload: Record<string, unknown> | null,
  existingDoc: Record<string, unknown> | null,
  state: SimState
): 'ALLOWED' | 'PERMISSION_DENIED' {
  if (!auth || !auth.email_verified) {
    return 'PERMISSION_DENIED';
  }
  const isAdmin = isSuperAdminUser(auth.email, auth.email_verified);

  const segments = path.split('/').filter(Boolean);

  // /users/{userId}
  if (segments.length === 2 && segments[0] === 'users') {
    const userId = segments[1];
    if (!isValidId(userId)) return 'PERMISSION_DENIED';

    if (operation === 'get') {
      return auth.uid === userId || isAdmin ? 'ALLOWED' : 'PERMISSION_DENIED';
    }
    if (operation === 'create' && payload) {
      if (auth.uid !== userId || payload.uid !== auth.uid || payload.uid !== userId) {
        return 'PERMISSION_DENIED';
      }
      if (
        payload.createdAt !== state.serverTime ||
        payload.updatedAt !== state.serverTime
      ) {
        return 'PERMISSION_DENIED';
      }
      const check = validateUserProfileInput(payload);
      return check.valid ? 'ALLOWED' : 'PERMISSION_DENIED';
    }
    if (operation === 'update' && payload && existingDoc) {
      if (auth.uid !== userId && !isAdmin) return 'PERMISSION_DENIED';
      if (
        payload.uid !== existingDoc.uid ||
        payload.createdAt !== existingDoc.createdAt ||
        payload.updatedAt !== state.serverTime
      ) {
        return 'PERMISSION_DENIED';
      }
      const check = validateUserProfileInput(payload);
      return check.valid ? 'ALLOWED' : 'PERMISSION_DENIED';
    }
  }

  // /users/{userId}/interactions/{interactionId}
  if (
    segments.length === 4 &&
    segments[0] === 'users' &&
    segments[2] === 'interactions'
  ) {
    const userId = segments[1];
    const interactionId = segments[3];
    if (!isValidId(userId) || !isValidId(interactionId)) {
      return 'PERMISSION_DENIED';
    }

    if (operation === 'get' || operation === 'list') {
      if (isAdmin) return 'ALLOWED';
      if (auth.uid === userId && existingDoc?.userId === auth.uid) {
        return 'ALLOWED';
      }
      return 'PERMISSION_DENIED';
    }

    if (operation === 'create' && payload) {
      if (auth.uid !== userId || payload.userId !== auth.uid) {
        return 'PERMISSION_DENIED';
      }
      if (!state.existingProfiles.has(userId)) {
        return 'PERMISSION_DENIED';
      }
      if (payload.createdAt !== state.serverTime) {
        return 'PERMISSION_DENIED';
      }
      const check = validateAuditInteractionPayload(payload);
      return check.valid ? 'ALLOWED' : 'PERMISSION_DENIED';
    }

    if (operation === 'update') {
      return 'PERMISSION_DENIED';
    }
  }

  // /company_docs/{docId}
  if (segments.length === 2 && segments[0] === 'company_docs') {
    const docId = segments[1];
    if (!isValidId(docId)) return 'PERMISSION_DENIED';

    if (operation === 'get' || operation === 'list') {
      if (isAdmin || existingDoc?.status === 'published') {
        return 'ALLOWED';
      }
      return 'PERMISSION_DENIED';
    }

    if (operation === 'create' && payload) {
      if (!isAdmin) return 'PERMISSION_DENIED';
      if (
        payload.createdAt !== state.serverTime ||
        payload.updatedAt !== state.serverTime
      ) {
        return 'PERMISSION_DENIED';
      }
      const check = validateCompanyDocInput(payload);
      return check.valid ? 'ALLOWED' : 'PERMISSION_DENIED';
    }
  }

  return 'PERMISSION_DENIED';
}

const SERVER_NOW = 1760900000000;
const defaultState: SimState = {
  serverTime: SERVER_NOW,
  existingProfiles: new Set(['user_alice'])
};

const aliceAuth: SimAuth = {
  uid: 'user_alice',
  email: 'alice@company.com',
  email_verified: true
};

const bobAuth: SimAuth = {
  uid: 'user_bob',
  email: 'bob@company.com',
  email_verified: true
};

const spoofedAdminAuth: SimAuth = {
  uid: 'attacker_uid',
  email: SUPER_ADMIN_EMAIL,
  email_verified: false
};

const realAdminAuth: SimAuth = {
  uid: 'admin_uid_01',
  email: SUPER_ADMIN_EMAIL,
  email_verified: true
};

test('Dirty Dozen #1: Shadow field injection on UserProfile returns PERMISSION_DENIED', () => {
  const res = evaluateFirestoreRule(
    'create',
    '/users/user_alice',
    aliceAuth,
    {
      uid: 'user_alice',
      displayName: 'Alice Rivera',
      jobRole: 'Lead QA Engineer',
      department: 'Quality Engineering',
      jobDescription: 'Manages end-to-end automated regression testing.',
      isAdmin: true,
      createdAt: SERVER_NOW,
      updatedAt: SERVER_NOW
    },
    null,
    defaultState
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #2: Cross-user profile read by non-owner returns PERMISSION_DENIED', () => {
  const res = evaluateFirestoreRule(
    'get',
    '/users/user_alice',
    bobAuth,
    null,
    { uid: 'user_alice' },
    defaultState
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #3: Unverified admin email spoof returns PERMISSION_DENIED', () => {
  const res = evaluateFirestoreRule(
    'create',
    '/company_docs/doc_iso_9001',
    spoofedAdminAuth,
    {
      authorUid: 'attacker_uid',
      title: 'Fake Standard',
      category: 'quality_standard',
      content: 'Malicious override instructions for quality audit.',
      status: 'published',
      createdAt: SERVER_NOW,
      updatedAt: SERVER_NOW
    },
    null,
    defaultState
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #4: Orphaned interaction write without parent profile returns PERMISSION_DENIED', () => {
  const res = evaluateFirestoreRule(
    'create',
    '/users/user_bob/interactions/int_01',
    bobAuth,
    {
      userId: 'user_bob',
      sessionId: 'sess_1',
      category: 'work_process',
      userPrompt: 'My daily triage workflow.',
      aiResponse: 'Detailed insight.',
      executiveSummary: 'Triage summary.',
      brainstormingIdeas: 'Automate step 2.',
      auditAlignment: 'Aligned with SOP.',
      severityLevel: 'low',
      userRoleSnapshot: 'QA Analyst',
      userNameSnapshot: 'Bob',
      createdAt: SERVER_NOW
    },
    null,
    defaultState
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #5: Cross-user interaction read/list by another regular user returns PERMISSION_DENIED', () => {
  const res = evaluateFirestoreRule(
    'list',
    '/users/user_alice/interactions/int_01',
    bobAuth,
    null,
    { userId: 'user_alice' },
    defaultState
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #6: Denial-of-Wallet oversized userPrompt returns PERMISSION_DENIED', () => {
  const res = evaluateFirestoreRule(
    'create',
    '/users/user_alice/interactions/int_01',
    aliceAuth,
    {
      userId: 'user_alice',
      sessionId: 'sess_1',
      category: 'complaint',
      userPrompt: 'X'.repeat(6000),
      aiResponse: 'Valid response',
      executiveSummary: 'Summary',
      brainstormingIdeas: 'Ideas',
      auditAlignment: 'Aligned',
      severityLevel: 'high',
      userRoleSnapshot: 'QA Lead',
      userNameSnapshot: 'Alice',
      createdAt: SERVER_NOW
    },
    null,
    defaultState
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #7: Client timestamp forgery / backdating returns PERMISSION_DENIED', () => {
  const res = evaluateFirestoreRule(
    'create',
    '/users/user_alice',
    aliceAuth,
    {
      uid: 'user_alice',
      displayName: 'Alice Rivera',
      jobRole: 'Lead QA Engineer',
      department: 'Quality Engineering',
      jobDescription: 'Manages end-to-end automated regression testing.',
      createdAt: SERVER_NOW - 86400000,
      updatedAt: SERVER_NOW
    },
    null,
    defaultState
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #8: Identity spoofing in interaction payload returns PERMISSION_DENIED', () => {
  const res = evaluateFirestoreRule(
    'create',
    '/users/user_alice/interactions/int_01',
    aliceAuth,
    {
      userId: 'user_bob',
      sessionId: 'sess_1',
      category: 'complaint',
      userPrompt: 'Trying to attribute complaint to Bob.',
      aiResponse: 'Valid response',
      executiveSummary: 'Summary',
      brainstormingIdeas: 'Ideas',
      auditAlignment: 'Aligned',
      severityLevel: 'medium',
      userRoleSnapshot: 'QA Lead',
      userNameSnapshot: 'Alice',
      createdAt: SERVER_NOW
    },
    null,
    defaultState
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #9: Immortal field mutation on UserProfile update returns PERMISSION_DENIED', () => {
  const res = evaluateFirestoreRule(
    'update',
    '/users/user_alice',
    aliceAuth,
    {
      uid: 'user_alice',
      displayName: 'Alice Rivera',
      jobRole: 'Director of QA',
      department: 'Quality Engineering',
      jobDescription: 'Updated job description for audit.',
      createdAt: SERVER_NOW + 500,
      updatedAt: SERVER_NOW
    },
    {
      uid: 'user_alice',
      createdAt: SERVER_NOW - 10000
    },
    defaultState
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #10: Unauthorized company audit basis upload by non-admin returns PERMISSION_DENIED', () => {
  const res = evaluateFirestoreRule(
    'create',
    '/company_docs/sop_101',
    aliceAuth,
    {
      authorUid: 'user_alice',
      title: 'Unauthorized Policy',
      category: 'sop_workflow',
      content: 'Regular employees cannot overwrite company audit standards.',
      status: 'published',
      createdAt: SERVER_NOW,
      updatedAt: SERVER_NOW
    },
    null,
    defaultState
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #11: Invalid enum category or severity poisoning returns PERMISSION_DENIED', () => {
  const res = evaluateFirestoreRule(
    'create',
    '/users/user_alice/interactions/int_01',
    aliceAuth,
    {
      userId: 'user_alice',
      sessionId: 'sess_1',
      category: 'arbitrary_injection' as any,
      userPrompt: 'Valid prompt length here.',
      aiResponse: 'Valid response',
      executiveSummary: 'Summary',
      brainstormingIdeas: 'Ideas',
      auditAlignment: 'Aligned',
      severityLevel: 'critical_override' as any,
      userRoleSnapshot: 'QA Lead',
      userNameSnapshot: 'Alice',
      createdAt: SERVER_NOW
    },
    null,
    defaultState
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Dirty Dozen #12: Regular user reading archived company doc returns PERMISSION_DENIED', () => {
  const res = evaluateFirestoreRule(
    'get',
    '/company_docs/archived_sop',
    aliceAuth,
    null,
    { status: 'archived' },
    defaultState
  );
  assert.equal(res, 'PERMISSION_DENIED');
});

test('Positive Verification: Super Admin can upload company docs and read user interactions', () => {
  const createDocRes = evaluateFirestoreRule(
    'create',
    '/company_docs/iso_standard_1',
    realAdminAuth,
    {
      authorUid: 'admin_uid_01',
      title: 'ISO 9001:2026 Operational Audit Standard',
      category: 'quality_standard',
      content: 'All deployment pipelines require dual peer review and automated rollback verification.',
      status: 'published',
      createdAt: SERVER_NOW,
      updatedAt: SERVER_NOW
    },
    null,
    defaultState
  );
  assert.equal(createDocRes, 'ALLOWED');

  const readUserAuditRes = evaluateFirestoreRule(
    'list',
    '/users/user_alice/interactions/int_01',
    realAdminAuth,
    null,
    { userId: 'user_alice' },
    defaultState
  );
  assert.equal(readUserAuditRes, 'ALLOWED');
});

test('Sanitizer: stripUndefined recursively removes undefined properties without mutating valid values', () => {
  const dirty = {
    uid: 'user_1',
    jobRole: 'Engineer',
    optionalNote: undefined,
    nested: {
      keep: 'yes',
      drop: undefined
    }
  };
  const cleaned = stripUndefined(dirty);
  assert.deepEqual(cleaned, {
    uid: 'user_1',
    jobRole: 'Engineer',
    nested: {
      keep: 'yes'
    }
  });
  assert.equal('optionalNote' in cleaned, false);
});

test('CSV Security: escapeCsvField neutralizes OWASP CSV formula injection payloads and escapes quotes', () => {
  assert.equal(escapeCsvField('=CMD|\' /C calc\'!A0'), '"\'=CMD|\' /C calc\'!A0"');
  assert.equal(escapeCsvField('+SUM(A1:A10)'), '"\'+SUM(A1:A10)"');
  assert.equal(escapeCsvField('-2+3+cmd'), '"\'-2+3+cmd"');
  assert.equal(escapeCsvField('@IMPORTXML(...)'), '"\'@IMPORTXML(...)"');
  assert.equal(escapeCsvField('Normal "quoted" text, with comma'), '"Normal ""quoted"" text, with comma"');
});

test('CSV Export: generateAuditResultsCsv outputs headers and sanitized rows for Super Admin download', () => {
  const csv = generateAuditResultsCsv([
    {
      id: 'int_101',
      userId: 'usr_elena_01',
      sessionId: 'sess_01',
      userNameSnapshot: 'Elena Vance',
      userRoleSnapshot: 'Senior SRE Lead · Platform Operations',
      category: 'difficulty_challenge',
      severityLevel: 'high',
      userPrompt: '=HYPERLINK("http://malicious.example","Click") Manual release bottleneck',
      executiveSummary: 'Release cutover takes 90 minutes.',
      brainstormingIdeas: '1. Automate schema checks.',
      auditAlignment: 'ISO 9001:2026 gap',
      aiResponse: 'Detailed reflection response.',
      createdAt: '2026-10-19T14:20:00.000Z'
    }
  ]);

  const lines = csv.split('\r\n');
  assert.equal(lines.length, 2);
  assert.ok(lines[0].includes('"Interaction ID"'));
  assert.ok(lines[0].includes('"Employee Reported Input"'));
  // Verify formula payload was neutralized with leading single quote
  assert.ok(lines[1].includes('"\'=HYPERLINK(""http://malicious.example"",""Click"") Manual release bottleneck"'));
});

test('Time-Series Aggregation: aggregateInteractionsByDate sorts dates chronologically, ignores malformed timestamps, and detects activity spikes', () => {
  const series = aggregateInteractionsByDate([
    { createdAt: '2026-10-19T16:40:00.000Z', severityLevel: 'high' },
    { createdAt: '2026-10-17T10:00:00.000Z', severityLevel: 'medium' },
    { createdAt: '2026-10-19T14:20:00.000Z', severityLevel: 'high' },
    { createdAt: '2026-10-18T09:00:00.000Z', severityLevel: 'low' },
    { createdAt: '2026-10-19T15:05:00.000Z', severityLevel: 'positive_innovation' },
    { createdAt: 'not-a-valid-date', severityLevel: 'low' }
  ]);

  assert.equal(series.length, 3);
  assert.deepEqual(
    series.map((p) => p.date),
    ['2026-10-17', '2026-10-18', '2026-10-19']
  );
  assert.equal(series[0].total, 1);
  assert.equal(series[0].isSpike, false);
  assert.equal(series[2].total, 3);
  assert.equal(series[2].highRisk, 2);
  assert.equal(series[2].innovations, 1);
  assert.equal(series[2].isSpike, true);
});

test('Quality Audit Prompt: QUALITY_AUDIT_SYSTEM_PROMPT defines all 7 core audit distinctions, 6 interview stages, 14 signal types, and 16 summary sections', async () => {
  const {
    QUALITY_AUDIT_SYSTEM_PROMPT,
    QUALITY_SIGNAL_TYPES,
    EVIDENCE_MATURITY_LEVELS,
    AUDIT_INTERVIEW_STAGES
  } = await import('./lib/prompts/qualityAuditPrompt.ts');

  assert.ok(QUALITY_AUDIT_SYSTEM_PROMPT.includes('You are Quality Audit AI'));
  assert.ok(QUALITY_AUDIT_SYSTEM_PROMPT.includes('CORE AUDIT PRINCIPLES'));
  assert.ok(QUALITY_AUDIT_SYSTEM_PROMPT.includes('Never convert an employee opinion directly into a verified audit finding.'));
  assert.ok(QUALITY_AUDIT_SYSTEM_PROMPT.includes('STAGE 1 — ROLE CONTEXT'));
  assert.ok(QUALITY_AUDIT_SYSTEM_PROMPT.includes('STAGE 6 — IMPROVEMENT IDEAS'));
  assert.ok(QUALITY_AUDIT_SYSTEM_PROMPT.includes('QUALITY SIGNAL CLASSIFICATION'));
  assert.ok(QUALITY_AUDIT_SYSTEM_PROMPT.includes('AUDIT SUMMARY RULES'));
  assert.ok(QUALITY_AUDIT_SYSTEM_PROMPT.includes('16. Priority Actions'));

  assert.equal(QUALITY_SIGNAL_TYPES.length, 14);
  assert.equal(EVIDENCE_MATURITY_LEVELS.length, 6);
  assert.equal(AUDIT_INTERVIEW_STAGES.length, 6);
});


