import {
  CompanyDocCategory,
  InteractionCategory,
  SeverityLevel
} from './auditValidation';

export interface StoredUserProfile {
  uid: string;
  displayName: string;
  jobRole: string;
  department: string;
  jobDescription: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredCompanyDoc {
  id: string;
  authorUid: string;
  title: string;
  category: CompanyDocCategory;
  content: string;
  status: 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface StoredAuditInteraction {
  id: string;
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
  createdAt: string;
}

export const INITIAL_COMPANY_AUDIT_DOCS: StoredCompanyDoc[] = [
  {
    id: 'doc_iso_9001_ops',
    authorUid: 'super_admin_arn',
    title: 'ISO 9001:2026 Release & Production Change Control Standard',
    category: 'quality_standard',
    content:
      'All production deployments and customer-facing workflow modifications must maintain 100% traceability from ticket intake to post-release verification. Mandatory controls: (1) Automated regression pass rate >= 99.2%, (2) Documented rollback procedure verified prior to release window, (3) Maximum 4-hour SLA for triaging high-severity production incidents.',
    status: 'published',
    createdAt: '2026-10-15T09:00:00.000Z',
    updatedAt: '2026-10-15T09:00:00.000Z'
  },
  {
    id: 'doc_sop_handoff',
    authorUid: 'super_admin_arn',
    title: 'SOP-204: Cross-Functional Incident Escalation & Handoff Protocol',
    category: 'sop_workflow',
    content:
      'When frontline operations or customer reliability engineers identify a recurring defect affecting >3 enterprise accounts, an Escalation Dossier must be logged within 2 hours. Engineering leads must provide root-cause reflection and preventive action commitments within 48 hours.',
    status: 'published',
    createdAt: '2026-10-16T14:30:00.000Z',
    updatedAt: '2026-10-16T14:30:00.000Z'
  },
  {
    id: 'doc_audit_rubric_q4',
    authorUid: 'super_admin_arn',
    title: 'Q4 Enterprise Quality Audit Evaluation Rubric',
    category: 'audit_rubric',
    content:
      'Audit evaluations classify employee observations into four operational impact levels: High Risk (immediate SLA or compliance exposure), Medium Risk (manual toil or recurring handoff friction), Low Risk (minor documentation gap), and Positive Innovation (scalable automation or process improvement proposal).',
    status: 'published',
    createdAt: '2026-10-18T11:15:00.000Z',
    updatedAt: '2026-10-18T11:15:00.000Z'
  }
];

export const INITIAL_DEMO_PROFILE: StoredUserProfile = {
  uid: 'usr_elena_vance_01',
  displayName: 'Elena Vance',
  jobRole: 'Senior Site Reliability & Release Lead',
  department: 'Platform Operations',
  jobDescription:
    'Oversees weekly enterprise production releases, coordinates cross-team QA sign-offs, manages incident response runbooks, and tracks deployment cycle-time metrics across 14 microservices.',
  createdAt: '2026-10-17T08:00:00.000Z',
  updatedAt: '2026-10-19T10:30:00.000Z'
};

export const INITIAL_DEMO_INTERACTIONS: StoredAuditInteraction[] = [
  {
    id: 'int_elena_101',
    userId: 'usr_elena_vance_01',
    sessionId: 'sess_release_audit_01',
    category: 'difficulty_challenge',
    userPrompt:
      'During our Thursday release cutover, manual database migration verification takes nearly 90 minutes because three separate teams have to approve schema diffs over Slack instead of an automated gate.',
    aiResponse:
      'Thank you for highlighting this bottleneck in the Thursday release cutover, Elena. Relying on ad-hoc Slack approvals across three teams introduces both latency (90 minutes of manual coordination) and compliance drift against our ISO 9001:2026 Release Standard. If we replace manual Slack sign-offs with an automated CI schema-linter check, which of the three teams currently requires bespoke manual inspection, and what edge cases are they checking for?',
    executiveSummary:
      'Senior SRE Lead reported a 90-minute manual bottleneck during Thursday release cutovers caused by fragmented 3-team Slack approvals for database schema migrations.',
    brainstormingIdeas:
      '1. Integrate automated SQL migration dry-run and backward-compatibility linting into the CI pipeline.\n2. Replace multi-channel Slack approvals with a single version-controlled CODEOWNERS gate.\n3. Pre-verify schema diffs 24 hours prior to Thursday cutover windows.',
    auditAlignment:
      'Identifies a gap in ISO 9001:2026 Release & Production Change Control Standard regarding automated pre-release verification and cycle-time predictability.',
    severityLevel: 'high',
    userRoleSnapshot: 'Senior Site Reliability & Release Lead · Platform Operations',
    userNameSnapshot: 'Elena Vance',
    createdAt: '2026-10-19T14:20:00.000Z'
  },
  {
    id: 'int_elena_102',
    userId: 'usr_elena_vance_01',
    sessionId: 'sess_release_audit_01',
    category: 'improvement_suggestion',
    userPrompt:
      'We built a prototype rollback verifier script that automatically tests staging snapshots in 4 minutes. If we standardize this across all 14 microservices, we can cut rollback verification toil by 80%.',
    aiResponse:
      'That prototype rollback verifier directly addresses Mandatory Control #2 of the ISO 9001:2026 standard ("Documented rollback procedure verified prior to release window"). Reducing verification time to 4 minutes while cutting manual toil by 80% is a high-leverage operational improvement. What dependencies or permissions would be required to package this script as a shared GitHub Action for all 14 microservice repositories?',
    executiveSummary:
      'Proposed standardizing a 4-minute automated staging rollback verifier script across 14 microservices to reduce manual verification toil by 80%.',
    brainstormingIdeas:
      '1. Publish the rollback verifier as a reusable CI/CD workflow template across all 14 services.\n2. Log automated rollback test artifacts directly to the release audit ledger.\n3. Pair the script with automatic PagerDuty suppression during staging dry runs.',
    auditAlignment:
      'Strongly reinforces ISO 9001:2026 Mandatory Control #2 (verified rollback readiness) and qualifies as a Positive Innovation under the Q4 Audit Rubric.',
    severityLevel: 'positive_innovation',
    userRoleSnapshot: 'Senior Site Reliability & Release Lead · Platform Operations',
    userNameSnapshot: 'Elena Vance',
    createdAt: '2026-10-19T15:05:00.000Z'
  },
  {
    id: 'int_marcus_201',
    userId: 'usr_marcus_chen_02',
    sessionId: 'sess_support_escalation_02',
    category: 'complaint',
    userPrompt:
      'Enterprise tier-3 incident handoffs from Customer Reliability to Core Billing frequently omit reproduction payload logs, forcing engineers to spend 3+ hours requesting customer correlation IDs.',
    aiResponse:
      'This represents a direct compliance breach of SOP-204 (Cross-Functional Incident Escalation & Handoff Protocol), which mandates a complete Escalation Dossier within 2 hours. Spending 3+ hours chasing correlation IDs puts the 4-hour high-severity triage SLA at immediate risk. Would enforcing required correlation-ID fields in the escalation intake form resolve this gap?',
    executiveSummary:
      'Escalated recurring SOP-204 compliance breakdown where Tier-3 billing handoffs lack reproduction logs and correlation IDs, delaying triage by 3+ hours.',
    brainstormingIdeas:
      '1. Enforce mandatory correlation-ID and payload validation fields on the Tier-3 escalation intake form.\n2. Auto-attach sanitized telemetry bundles when an enterprise ticket is promoted to Engineering.\n3. Add SOP-204 completeness checks to weekly quality reviews.',
    auditAlignment:
      'Direct violation of SOP-204 (2-hour Escalation Dossier requirement) and threatens the 4-hour SLA in ISO 9001:2026.',
    severityLevel: 'high',
    userRoleSnapshot: 'Staff Billing Systems Engineer · Core FinTech',
    userNameSnapshot: 'Marcus Chen',
    createdAt: '2026-10-19T16:40:00.000Z'
  },
  {
    id: 'int_priya_301',
    userId: 'usr_priya_nair_03',
    sessionId: 'sess_compliance_review_03',
    category: 'work_process',
    userPrompt:
      'Every Wednesday morning our compliance engineering team audits 40+ IAM role bindings across staging and production clusters using our automated policy checker.',
    aiResponse:
      'Documenting this weekly IAM role-binding audit establishes strong baseline evidence for ISO 9001:2026 access traceability. How are exceptions or temporary elevated privileges tracked when an engineer requires emergency break-glass access?',
    executiveSummary:
      'Documented weekly automated IAM role-binding verification across 40+ staging and production clusters.',
    brainstormingIdeas:
      '1. Auto-expire break-glass IAM role bindings after 4 hours.\n2. Archive weekly IAM audit diffs directly into the compliance bucket.\n3. Alert security leads on any unapproved privilege drift.',
    auditAlignment:
      'Supports ISO 9001:2026 change control and access traceability requirements.',
    severityLevel: 'low',
    userRoleSnapshot: 'Lead Security Compliance Engineer · Trust & Security',
    userNameSnapshot: 'Priya Nair',
    createdAt: '2026-10-16T11:15:00.000Z'
  },
  {
    id: 'int_marcus_200',
    userId: 'usr_marcus_chen_02',
    sessionId: 'sess_support_escalation_01',
    category: 'difficulty_challenge',
    userPrompt:
      'Webhook retry queues in the regional payment gateway occasionally stall during peak batch settlement windows when downstream rate limits trigger.',
    aiResponse:
      'Rate-limit stalls during batch settlement windows can cascade into SLA delays if backoff jitter is not tuned. Have you evaluated adaptive concurrency limits or dead-letter queue alerting prior to the 2-hour SOP-204 threshold?',
    executiveSummary:
      'Identified webhook retry queue stalls during peak settlement windows due to downstream rate limiting.',
    brainstormingIdeas:
      '1. Implement exponential backoff with decorrelated jitter on payment webhook retries.\n2. Configure proactive queue-depth alerts at 60% capacity.\n3. Separate batch settlement traffic from real-time checkout webhooks.',
    auditAlignment:
      'Monitors operational resilience under ISO 9001:2026 and prevents SOP-204 incident escalations.',
    severityLevel: 'medium',
    userRoleSnapshot: 'Staff Billing Systems Engineer · Core FinTech',
    userNameSnapshot: 'Marcus Chen',
    createdAt: '2026-10-17T15:30:00.000Z'
  },
  {
    id: 'int_elena_100',
    userId: 'usr_elena_vance_01',
    sessionId: 'sess_release_audit_00',
    category: 'work_process',
    userPrompt:
      'Pre-release canary telemetry checks now run for 30 minutes across our primary Asia-Northeast and US-East regions before promoting builds to full production.',
    aiResponse:
      'Running 30-minute dual-region canary checks provides strong early detection against regression anomalies. Combining this with your automated rollback verifier will establish an end-to-end safety net.',
    executiveSummary:
      'Standardized 30-minute dual-region canary telemetry verification prior to full production promotion.',
    brainstormingIdeas:
      '1. Link canary error-budget burn rates to automatic promotion gates.\n2. Export canary latency percentiles to the release audit dossier.',
    auditAlignment:
      'Directly satisfies ISO 9001:2026 Mandatory Control #1 and post-release verification standards.',
    severityLevel: 'low',
    userRoleSnapshot: 'Senior Site Reliability & Release Lead · Platform Operations',
    userNameSnapshot: 'Elena Vance',
    createdAt: '2026-10-18T10:10:00.000Z'
  }
];

