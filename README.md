# AuditPulse AI — Enterprise Quality Audit & Process Intelligence

AuditPulse AI is a secure, role-authenticated enterprise quality audit web application built with **React 19**, **Express**, **Google Gemini 3.6 Flash (`@google/genai`)**, **Firebase Authentication (Google Sign-In)**, and **Cloud Firestore**.

It enables the designated Super Administrator (`arn.gingoyon@gmail.com`) to upload authoritative company information, ISO/SLA standards, and audit rubrics while allowing authenticated employees to document their professional background and engage in strictly isolated, multi-turn quality audit exchanges with Gemini.

---

## 1. Agentic Threat Modeling Summary

| Threat Zone | Risk Scenario | OWASP Mapping | Countermeasure Implemented |
| :--- | :--- | :--- | :--- |
| **Input Surfaces** | Malicious or oversized prompts, shadow fields (`isAdmin: true`), or `undefined` properties crashing Firestore SDK calls. | OWASP A03 / LLM02 | Strict schema & length validators in `src/utils/auditValidation.ts`, null-safe server payload destructuring, and recursive `stripUndefined()` sanitization prior to every Firestore write. |
| **Planning & Reasoning** | Indirect prompt injection via uploaded company documents or user job descriptions attempting to override Gemini instructions. | OWASP LLM01 | Untrusted inputs are wrapped in `<untrusted_*>` XML tags and governed by immutable `systemInstruction` boundaries on the backend. |
| **Tool Execution** | Client-side API key exposure or single-model availability bottlenecks. | OWASP A01 / LLM06 | Server-side `/api/audit/*` proxy using `process.env.GEMINI_API_KEY` with a 4-stage fallback ladder (`gemini-3.6-flash` $\rightarrow$ `gemini-3.1-flash-lite` $\rightarrow$ `gemini-flash-latest` $\rightarrow$ `gemini-3.7-flash`). |
| **Memory & State** | Cross-user data leakage of employee complaints or unverified email spoofing of the Super Admin account. | OWASP A01 / A04 | Zero-trust `firestore.rules` enforcing `request.auth.uid == userId` on `/users/{userId}/interactions/{interactionId}` and verified `email_verified == true` for `arn.gingoyon@gmail.com`. |
| **Inter-System Comm** | Password storage vulnerabilities or silent database write failures losing generated audit reflections. | OWASP A07 / LLM05 | Federated Google Sign-In only (zero passwords stored) and Guaranteed Transaction Verification with an explicit **Retry Save** banner in the UI. |

---

## 2. Environment & Prerequisites

Ensure the following tools and Google Cloud APIs are enabled in your Google Cloud project:

```bash
# 1. Authenticate with Google Cloud CLI
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# 2. Enable required Google Cloud services
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  cloudbuild.googleapis.com
```

---

## 3. Secret Management & Zero-Hardcoding Hygiene

Never hardcode API keys or credentials in source code. Store `GEMINI_API_KEY` in **Google Cloud Secret Manager** and bind it to your Cloud Run runtime service account:

```bash
# Create and populate the secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# Grant the default Cloud Run service account access to read the secret
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

If retrieving secrets programmatically in Python microservices or Cloud Functions, always use the Secret Manager client SDK:

```python
from google.cloud import secretmanager

def access_secret(secret_id: str, version_id: str = "latest") -> str:
    client = secretmanager.SecretManagerServiceClient()
    name = f"projects/your-project-id/secrets/{secret_id}/versions/{version_id}"
    response = client.access_secret_version(request={"name": name})
    return response.payload.data.decode("UTF-8")
```

---

## 4. Database Security Configuration (`firestore.rules`)

Deploy owner-bound security rules to isolate each user's interactions while permitting verified Super Admin governance (`arn.gingoyon@gmail.com`).

### Core User Data Isolation Pattern:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/interactions/{interactionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

*(See `/firestore.rules` in the repository root for the full hardened ruleset including schema validation blueprints, timestamp verification, and Super Admin `arn.gingoyon@gmail.com` access controls.)*

To validate and deploy the rules:
```bash
# Validate rules with the Firebase Security Rules ESLint plugin
npx eslint firestore.rules

# Run the Dirty Dozen security & payload unit test suite
npm test

# Deploy rules via Firebase CLI
firebase deploy --only firestore:rules
```

---

## 5. Cloud Run Deployment Flow & Required Campaign Labeling

Deploy the unified full-stack application to Google Cloud Run and apply the required campaign verification label:

```bash
# 1. Deploy from source to Google Cloud Run with Secret Manager injection
gcloud run deploy auditpulse-ai \
  --source . \
  --region=asia-northeast1 \
  --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --port=3000

# 2. Apply the mandatory campaign verification label
gcloud run services update auditpulse-ai \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=asia-northeast1
```

---

## 6. Functional Test Walkthrough

1. **Landing & Authentication**: Open the application at `http://localhost:3000`. Verify the 3-zone header and click **Sign In with Google SSO** (or launch the Employee / Super Admin workspace preview).
2. **Employee Professional Background**: Navigate to **Professional Background**, enter your Company Role, Department, and Specific Function / Job Description (10–3,000 characters), and click **Save Professional Background**.
3. **Multi-Turn Quality Audit Exchange**: In **Audit Exchange Studio**, select a category (`Work Process`, `Difficulty / Bottleneck`, `Quality / Process Complaint`, or `Improvement Suggestion`), enter your observation, and click **Submit & Save Audit Turn**. Verify Gemini 3.6 Flash returns a conversational reflection, executive summary, brainstorming ideas, and company standard alignment.
4. **Private Audit History**: Open **Past Entries** to search and filter your personal interactions and expand full exchange details.
5. **Super Admin Governance (`arn.gingoyon@gmail.com`)**: Switch to **Super Admin Console**, upload a new Company Audit Basis document under **Company Audit Basis**, and click **Generate Executive Audit Brief** under **Cross-User Audit Results**.

---

## 7. Feedback & Iteration Summary (Peer Testing Report)

### 1. Feedback Received from 3 Testing Colleagues
* **Colleague 1 — Senior Quality Assurance Lead (Super Admin Persona Tester)**:
  * *Feedback*: "As an administrator reviewing cross-user quality audit submissions, I need a one-click way to export the filtered audit results table into Excel/Google Sheets for offline compliance reporting, and I need a visual timeline to spot dates when multiple high-risk operational incidents or complaints spike across teams."
* **Colleague 2 — Site Reliability & Operations Engineer (Employee Persona Tester)**:
  * *Feedback*: "When I report a workplace complaint or a release delay, the initial AI prompt sometimes sounded too quick to treat my single anecdote as a confirmed organizational defect. A real ISO-9001 quality auditor distinguishes between an employee statement, an unverified root-cause hypothesis, and a verified finding, and asks 1–2 focused questions about frequency, impact, and evidence."
* **Colleague 3 — Cloud Security & Compliance Engineer (Security & Reliability Tester)**:
  * *Feedback*: "Exporting user-submitted prompts to CSV introduces a classic OWASP CSV Formula Injection risk if a prompt starts with `=`, `+`, `-`, or `@`. Additionally, when generating a comprehensive 16-section audit summary, if the primary Gemini model experiences high latency, the UI button can stay in a loading state too long without failing over cleanly."

### 2. Identified Usability Gaps & Bugs
1. **Lack of Offline Reporting & Trend Visibility in Super Admin Console**: Administrators had to read entries row-by-row without a downloadable CSV export or a time-series visualization of daily interaction volume and high-risk activity spikes.
2. **Epistemic Conflation in AI Audit Responses**: Early conversational responses did not strictly separate `EMPLOYEE STATEMENT`, `OBSERVATION`, `ROOT-CAUSE HYPOTHESIS`, `EVIDENCE REQUIRED`, and `VERIFIED FINDING`, nor did they expose the 6-stage interview progression (`Role Context` $\rightarrow$ `Improvement Ideas`) or a structured 16-section session summary in the UI.
3. **CSV Formula Injection Vector & Summary Response Envelope Mismatch**:
   * Unsanitized CSV cells starting with `=`, `+`, `-`, `@`, `\t`, or `\r` could trigger spreadsheet formula execution when opened by a Super Admin.
   * In `UserDashboardView.tsx`, clicking **"Generate 16-Point Audit Summary"** initially expected `{ ok: true, data: ... }` while `/api/audit/session-summary` returned top-level fields, and slow upstream model calls lacked a per-attempt timeout before stepping down the fallback ladder.

### 3. Corrective Actions & Code / Prompt Adjustments Made
1. **Super Admin CSV Export with OWASP Formula Neutralization (`src/utils/auditValidation.ts`, `src/components/SuperAdminView.tsx`)**:
   * Implemented `escapeCsvField()` and `generateAuditResultsCsv()` which prefix any cell beginning with `=`, `+`, `-`, `@`, `\t`, or `\r` with a neutralizing single quote (`'`) and RFC-4180 double-quote escaping.
   * Added the **"Export to CSV (N)"** button in the Super Admin Console header with an instant confirmation notice and unit tests (`firestore.rules.test.ts`).
2. **Recharts Activity Spike Line Chart (`src/utils/auditValidation.ts`, `src/components/SuperAdminView.tsx`)**:
   * Implemented `aggregateInteractionsByDate()` (computing daily `total`, `highRisk`, and `innovations` counts plus dynamic spike detection when `total > avg * 1.25` or `highRisk >= 2`) and rendered a responsive `<LineChart>` in the Super Admin Console.
3. **Structured `QUALITY_AUDIT_SYSTEM_PROMPT` & 16-Point Session Summary (`lib/prompts/qualityAuditPrompt.ts`, `server.ts`, `src/components/UserDashboardView.tsx`)**:
   * Created `lib/prompts/qualityAuditPrompt.ts` defining the 7 Core Audit Distinctions, 6 Interview Stages, 14 Quality Signal Classifications, 6 Evidence Maturity levels, and 16-Section Audit Summary rules.
   * Added a `3,500ms` per-model timeout in `generateContentWithFallback()` (`gemini-3.6-flash` $\rightarrow$ `gemini-3.1-flash-lite` $\rightarrow$ `gemini-flash-latest` $\rightarrow$ `gemini-3.7-flash`) and normalized the `/api/audit/session-summary` JSON response envelope so the **16-Section Quality Audit Summary Report** renders reliably in the Employee Dashboard.

