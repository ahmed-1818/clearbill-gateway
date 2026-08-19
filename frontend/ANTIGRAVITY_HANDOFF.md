# CLEARBILL: BACKEND ARCHITECTURE HANDOFF (GYM HUB)

## 1. Executive System Overview
ClearBill is a high-frequency financial operating system designed for institutions operating on recurring billing cycles. The frontend state management (`clearbill-store.ts`) maps directly to a relational, multi-tenant Supabase (PostgreSQL) database schema. 

Do not generate simple CRUD APIs; this system requires a strict, double-entry ledger architecture, idempotency controls, and timezone-aware background task queues.

---

## 2. Database Schema Directives (Supabase / PostgreSQL)

Analyze the frontend interfaces in `clearbill-store.ts` and construct a PostgreSQL schema adhering strictly to the following relational models and constraints:

### **Multi-Tenancy & Row-Level Security (RLS)**
* Every core database table (`members`, `packages`, `subscription_ledger`, `node_integrations`, `activity_logs`) MUST contain a `node_id` foreign key.
* Enable Row-Level Security (RLS) on all public tables using Supabase Auth policies:
  `CREATE POLICY "Node Isolation Policy" ON members FOR ALL USING (node_id = auth.jwt() ->> 'node_id');`

### **Table Entities & Structural Constraints**

1. **`packages` Table**
   * `duration_days` (INTEGER)
   * `is_archived` (BOOLEAN, default `false`) — **Soft Deletes:** Preserves historical financial math if a package template is deleted from the UI.

2. **`members` Table**
   * `phone_number` (VARCHAR(15)) — **Cleaned Format:** Guaranteed `923XXXXXXXXX` (no leading zeroes or `+`).
   * `suspension_days_accrued` (INTEGER, default `0`) — Handles frozen/paused memberships without altering `activation_date`.
   * `lifecycle_status` (VARCHAR(20), Enum: `'active'`, `'inactive'`)

3. **`subscription_ledger` Table**
   * `invoiced_amount` (DECIMAL(12,2)) — Full fee billed.
   * `liquidated_amount` (DECIMAL(12,2)) — Total amount settled/paid (supports partial payments / "Udhaar").
   * `status` (VARCHAR(20), Enum: `'staged'`, `'processing'`, `'settled'`, `'rejected'`, `'refunded'`)
   * `payment_method` (VARCHAR(20), Enum: `'safepay'`, `'kuickpay'`, `'raast'`, `'cash'`)
   * `idempotency_key` (VARCHAR(64), UNIQUE)

4. **`node_integrations` Table**
   * Encrypted credentials for Safepay, KuickPay, Raast, and WhatsApp (including `enable_ai_messaging` and `ai_tone`).

---

## 3. Webhook & API Contract (Idempotency & State Machines)

1. **Idempotency Enforcement:**
   * Webhook handlers for Safepay, KuickPay, and Raast must query `subscription_ledger` by `idempotency_key`. If status is already `'settled'`, return HTTP `200 OK` immediately without mutating database records.

2. **Transaction Isolation:**
   * All state transitions and partial payment settlements MUST be wrapped inside atomic SQL transactions (`BEGIN ... COMMIT`).

3. **Phone Number Sanitization Gateway:**
   * All inbound phone parameters must pass through a normalization middleware before DB insertion (Strip leading `0` or `+`, prepend `92`).

---

## 4. Automation Engine & AI Integration (Task Queue / pg_cron)

1. **Timezone Awareness:**
   * All automated daily evaluations MUST execute relative to the specific node's timezone (`Asia/Karachi`), NOT the server's UTC clock.

2. **Daily Expiry & Arrears Worker:**
   * **Dynamic Expiry Formula:** `expiration_date = activation_date + Package.duration_days + suspension_days_accrued`.
   * **Arrears Calculation:** `arrears = invoiced_amount - liquidated_amount`.

3. **Meta WhatsApp Cloud API + Gemini LLM Integration:**
   * If `enable_ai_messaging` is `true`: Call the Gemini Pro API passing the member's name, arrears, days until expiry, and the node's selected `ai_tone`.
   * Inject the Gemini-generated string into dynamic template variable `{{2}}` in the Meta WhatsApp Cloud API outbound JSON payload to maintain 100% compliance with Meta Business Outbound Messaging Policies.

---

# CLEARBILL ARCHITECTURAL BLUEPRINT & MASTER BACKEND HANDOFF

**System Target:** ClearBill Institutional Billing OS (Gym Hub & School Suite)
**Target Backend Execution Engine:** AntiGravity (Gemini 1.5 Pro / Claude 3.5 Sonnet Backend Compiler)
**Security & Reliability Standard:** Bank-Grade / Nuclear-Facility Level (Zero-Tolerance Failure Mode)

## EXECUTIVE SUMMARY & ARCHITECTURAL MANDATE

ClearBill is a high-frequency, B2B multi-tenant financial operating system engineered for multi-node businesses (Schools and Gym Networks in Pakistan). The system automates recurring fee generation, aggregates payments via 1Link/KuickPay and Safepay, and executes weaponized WhatsApp payment reminders ("Payloads") personalized via Gemini AI.

### The Engineering Directive for AntiGravity

You are tasked with generating the complete, production-ready backend infrastructure (REST/tRPC API, PostgreSQL Schemas, Redis Queues, Webhook Listeners, and External Gateway Handlers).

The frontend repository (`clearbill-gateway`) is a fully reactive, state-hardened React/TypeScript application. You MUST NOT infer or hallucinate business logic from loose frontend types. You must strictly execute the database normalization, transaction isolation, idempotency locks, and mathematical state machines detailed in this blueprint.

---

## SECTION 1: GLOBAL SYSTEM ARCHITECTURE & TENANCY ISOLATION

### 1.1 Multi-Tenant Hierarchy

ClearBill operates under a strict two-tier workspace isolation model. Every database query, index, and mutation MUST be scoped to `workspace_id`. Cross-tenant data leaks are prevented at the database query level via Row-Level Security (RLS) or mandatory `WHERE workspace_id = $1` filters.

```text
+-----------------------------------------------------------------------------------+
|                                 TENANT WORKSPACE                                  |
|                         (workspace_type: 'school' | 'gym')                        |
+-----------------------------------------------------------------------------------+
                                         |
               +-------------------------+-------------------------+
               |                                                   |
               v                                                   |
    +--------------------+                                         v
    |   ACADEMIC NODES   |                               +-------------------+
    | (Branches/Campuses)|                               |  GYM SUBSCRIBERS  |
    +--------------------+                               +-------------------+
               |
    +----------+----------+
    |                     |
    v                     v
+--------+           +----------+
| LEVELS | --------> | SECTIONS |
+--------+           +----------+
                          |
                          v
                     +----------+
                     | STUDENTS |
                     +----------+
```

### 1.2 Multi-Tenant Header & Auth State Sync

When a user authenticates, the `/api/auth/me` endpoint returns a JWT payload containing:

* `user_id`: UUID
* `workspace_id`: UUID
* `workspace_type`: `'school' | 'gym'`
* `institution_name`: String (e.g., "City Grammar School")
* `assigned_node_id`: UUID (Branch / Location scope)

The frontend top-left sidebar and profile avatar initials are dynamically bound to this payload. On `POST /api/auth/logout`, the backend returns `200 OK` and instructs the frontend to execute a global data purge (`purgeAllData()`), resetting all client-side state.

---

## SECTION 2: PRODUCTION POSTGRESQL SCHEMAS (DDL SPECIFICATION)

AntiGravity must execute the following PostgreSQL migrations using integer-based monetary units (Rupees/Paisa as absolute integers) to eliminate floating-point arithmetic errors.

```sql
-- Enable UUID extension and cryptographic utilities
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. WORKSPACES (Tenants)
CREATE TYPE workspace_type_enum AS ENUM ('school', 'gym');

CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    workspace_type workspace_type_enum NOT NULL,
    primary_email VARCHAR(255) UNIQUE NOT NULL,
    primary_phone VARCHAR(32) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. USERS
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. BRANCH NODES (Locations/Campuses)
CREATE TABLE branch_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL, -- e.g., "Johar Town Branch"
    code VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_branch_per_workspace UNIQUE (workspace_id, code)
);

-- 4. ACADEMIC TAXONOMY (Levels & Sections)
CREATE TABLE academic_levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_node_id UUID NOT NULL REFERENCES branch_nodes(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- e.g., "Class 8", "O-Levels"
    order_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE academic_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    level_id UUID NOT NULL REFERENCES academic_levels(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- e.g., "Section A", "Blue", "Pre-Med"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. STUDENTS (School Domain)
CREATE TYPE student_status_enum AS ENUM ('active', 'suspended', 'graduated');

CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    branch_node_id UUID NOT NULL REFERENCES branch_nodes(id),
    level_id UUID NOT NULL REFERENCES academic_levels(id),
    section_id UUID NOT NULL REFERENCES academic_sections(id),
    full_name VARCHAR(255) NOT NULL,
    roll_no VARCHAR(100) NOT NULL,
    parent_phone VARCHAR(20) NOT NULL,
    status student_status_enum DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_parent_phone_format CHECK (parent_phone ~ '^\+?923[0-9]{9}$|^03[0-9]{9}$')
);

-- 6. FEE STRUCTURES (Monthly Recurring Policies)
CREATE TABLE fee_structures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    branch_node_id UUID NOT NULL REFERENCES branch_nodes(id),
    level_id UUID NOT NULL REFERENCES academic_levels(id),
    tuition_fee INT NOT NULL DEFAULT 0, -- Stored as Integer (Rupees)
    transport_fee INT NOT NULL DEFAULT 0,
    late_fee_amount INT NOT NULL DEFAULT 0,
    grace_period_days INT NOT NULL DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_fee_per_level UNIQUE (branch_node_id, level_id)
);

-- 7. SCHOOL LEDGER ENTRIES (Monthly Invoices)
CREATE TYPE ledger_status_enum AS ENUM ('staged', 'unpaid', 'settled', 'arrears');

CREATE TABLE school_ledger_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    branch_node_id UUID NOT NULL REFERENCES branch_nodes(id),
    billing_period VARCHAR(7) NOT NULL, -- Format: YYYY-MM
    base_tuition INT NOT NULL,
    transport_fee INT NOT NULL DEFAULT 0,
    sibling_discount INT NOT NULL DEFAULT 0,
    late_fee_penalty INT NOT NULL DEFAULT 0,
    invoiced_amount INT NOT NULL, -- Net total PKR (Integer)
    liquidated_amount INT NOT NULL DEFAULT 0,
    status ledger_status_enum NOT NULL DEFAULT 'staged',
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    kuickpay_consumer_id VARCHAR(100),
    due_date DATE NOT NULL, -- Strict YYYY-MM-DD
    version_lock INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. CUSTOM CHALLANS (Ad-Hoc / Cohort Billing)
CREATE TABLE custom_challans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL, -- e.g., "Museum Field Trip", "Admission Fee"
    amount INT NOT NULL, -- Integer PKR
    liquidated_amount INT NOT NULL DEFAULT 0,
    due_date DATE NOT NULL,
    status ledger_status_enum NOT NULL DEFAULT 'staged',
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    kuickpay_consumer_id VARCHAR(100),
    version_lock INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. GYM MEMBERS & SUBSCRIPTIONS (Gym Domain)
CREATE TYPE gym_status_enum AS ENUM ('active', 'expired', 'frozen', 'cancelled');

CREATE TABLE gym_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    branch_node_id UUID NOT NULL REFERENCES branch_nodes(id),
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    plan_name VARCHAR(100) NOT NULL, -- e.g., "VIP Annual", "Monthly Strength"
    monthly_fee INT NOT NULL,
    status gym_status_enum DEFAULT 'active',
    start_date DATE NOT NULL,
    renewal_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_gym_phone CHECK (phone ~ '^\+?923[0-9]{9}$|^03[0-9]{9}$')
);

CREATE TABLE gym_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES gym_members(id) ON DELETE CASCADE,
    billing_period VARCHAR(7) NOT NULL, -- YYYY-MM
    invoiced_amount INT NOT NULL,
    liquidated_amount INT NOT NULL DEFAULT 0,
    status ledger_status_enum NOT NULL DEFAULT 'unpaid',
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    due_date DATE NOT NULL,
    version_lock INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. INSTITUTION CONFIGURATION & ENCRYPTED KEYS
CREATE TABLE institution_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID UNIQUE NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    encrypted_kuickpay_institution_id BYTEA, -- AES-256 KMS encrypted
    encrypted_kuickpay_secret BYTEA,
    encrypted_safepay_api_key BYTEA,
    encrypted_whatsapp_token BYTEA,
    whatsapp_phone_number_id VARCHAR(100),
    whatsapp_template_id VARCHAR(100),
    ai_communication_tone VARCHAR(50) DEFAULT 'firm_urdu',
    grace_period_days INT DEFAULT 10,
    late_fee_percentage INT DEFAULT 5,
    sibling_discount_percentage INT DEFAULT 25,
    sibling_discount_rule VARCHAR(50) DEFAULT 'second_child_onwards',
    quiet_hours_start TIME DEFAULT '21:00:00',
    quiet_hours_end TIME DEFAULT '08:00:00',
    jummah_pause BOOLEAN DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- HIGH-FREQUENCY INDEXES FOR PERFORMANCE
CREATE INDEX idx_students_parent_phone ON students(parent_phone);
CREATE INDEX idx_students_workspace_branch ON students(workspace_id, branch_node_id);
CREATE INDEX idx_school_ledger_parent_lookup ON school_ledger_entries(workspace_id, billing_period, status);
CREATE INDEX idx_school_ledger_idempotency ON school_ledger_entries(idempotency_key);
CREATE INDEX idx_custom_challans_lookup ON custom_challans(student_id, status);
CREATE INDEX idx_gym_subscriptions_lookup ON gym_subscriptions(member_id, status);
```

---

## SECTION 3: BANK-GRADE BUSINESS LOGIC & ALGORITHMIC SPECIFICATIONS

### 3.1 Mathematical Rule: Absolute Integer Arithmetic

Floating-point math (`float`, `double`) is strictly forbidden in financial calculations. All monetary calculations must use rounded integer math (`Math.round()` / SQL `ROUND()`).

```text
Invoiced Amount = ROUND(Base Tuition + Transport Fee - Sibling Discount + Late Fee Penalty)
```

### 3.2 The Sibling Discount "Price-Descending" Sorting Rule

When a family has multiple children enrolled, discounts MUST NOT apply based on arbitrary database insertion order. Doing so introduces severe revenue leaks (e.g., applying a 50% discount to an A-Levels fee of PKR 25,000 instead of a Pre-Nursery fee of PKR 5,000).

**Algorithm: `calculateSiblingRollup(parent_phone, billing_period)`**

1. Query all active students matching `parent_phone` within the workspace.
2. For each student, compute their base fee: `BaseFee[i] = Tuition[i] + Transport[i]`.
3. SORT the students array **descending** by `BaseFee[i]` such that `BaseFee[0] >= BaseFee[1] >= BaseFee[2] ...`.
4. Iterate over the sorted array:
   * Index 0 (most expensive child): `SiblingDiscount[0] = 0`.
   * Index `i > 0` (cheaper siblings): if `sibling_discount_rule == 'second_child_onwards'`, apply
     `SiblingDiscount[i] = ROUND(BaseFee[i] * sibling_discount_percentage / 100)`.
5. Store the calculated `sibling_discount` on each individual `school_ledger_entries` record.

### 3.3 Two-Tier KuickPay 1Link API Integration

KuickPay (1Link) operates as an asynchronous bill presentment engine across Pakistani mobile banking apps (Meezan, HBL, EasyPaisa, JazzCash).

To prevent unnecessary server cron traffic, AntiGravity MUST NOT run a daily script to update KuickPay APIs when late fees kick in. KuickPay natively supports two-tier pricing payloads at bill generation.

**KuickPay Provisioning Payload Mapping**

```json
{
  "InstitutionID": "ENCRYPTED_DECRYPTED_VAL",
  "ConsumerID": "100293848192",
  "ConsumerName": "Parent: Ali Raza (Roll-up: 2 Students)",
  "BillingMonth": "2026-08",
  "DueDate": "2026-08-10",
  "AmountWithinDueDate": 22500,
  "AmountAfterDueDate": 24000,
  "ExpiryDate": "2026-08-31"
}
```

### 3.4 Sibling Waterfall Settlement (1-to-Many Webhook Transaction)

When a parent pays their rolled-up bill on their banking app, KuickPay fires a single HTTP POST webhook to ClearBill containing `ConsumerID` and `AmountPaid`.

Because one `ConsumerID` maps to multiple sibling ledger entries for that billing cycle, AntiGravity MUST execute a "Waterfall Settlement" inside an isolated SQL transaction (`BEGIN ... COMMIT`).

```sql
-- WATERFALL SETTLEMENT SQL PROCEDURE / TRANSACTION
BEGIN;

-- 1. Lock matching ledger rows for update to prevent concurrent race conditions
SELECT id, invoiced_amount, liquidated_amount
FROM school_ledger_entries
WHERE kuickpay_consumer_id = '100293848192'
  AND status IN ('staged', 'unpaid', 'arrears')
FOR UPDATE;

-- 2. Liquidate all child ledger entries associated with this rolled-up bill
UPDATE school_ledger_entries
SET
    liquidated_amount = invoiced_amount,
    status = 'settled',
    version_lock = version_lock + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE kuickpay_consumer_id = '100293848192'
  AND status IN ('staged', 'unpaid', 'arrears');

-- 3. Log audit event
INSERT INTO billing_audit_logs (workspace_id, event_type, payload)
VALUES ('WORKSPACE_UUID', 'KUICKPAY_WATERFALL_SETTLEMENT_SUCCESS', '{"consumer_id": "100293848192"}');

COMMIT;
```

---

## SECTION 4: API ENDPOINT SPECIFICATIONS & CONTROLLERS

### 4.1 Global Telemetry Endpoint (`GET /api/school/telemetry`)

Provides read-only KPI metrics and collection velocity trends without loading raw ledger arrays into browser memory.

**Request Headers:** `Authorization: Bearer <JWT_TOKEN>`

**Response 200 OK**

```json
{
  "gross_capital_mtd": 1450000,
  "liquidated_mtd": 980000,
  "friction_arrears_mtd": 470000,
  "active_nodes_count": 3,
  "collection_velocity_chart": [
    { "month": "2026-03", "revenue": 1100000 },
    { "month": "2026-04", "revenue": 1250000 },
    { "month": "2026-05", "revenue": 1180000 },
    { "month": "2026-06", "revenue": 1300000 },
    { "month": "2026-07", "revenue": 1400000 },
    { "month": "2026-08", "revenue": 980000 }
  ]
}
```

### 4.2 Cohort Billing Endpoint (`POST /api/school/custom-billing/bulk`)

Issues ad-hoc fee challans (e.g., Field Trip) to an entire class or custom selection of students in a single batch request.

**Request Payload**

```json
{
  "student_ids": [
    "c8a1b2c3-0001-4000-8000-000000000001",
    "c8a1b2c3-0002-4000-8000-000000000002",
    "c8a1b2c3-0003-4000-8000-000000000003"
  ],
  "title": "Museum Field Trip",
  "amount": 1500,
  "due_date": "2026-08-20"
}
```

**Backend Processing Directives**

1. Validate `due_date` format (YYYY-MM-DD).
2. For each `student_id`, construct a deterministic idempotency key:
   `idempotency_key = SHA256(student_id + title + amount + due_date)`.
3. Insert records into `custom_challans` in a single batch `INSERT INTO ... VALUES (...)` query.
4. Dispatch background job to Redis Queue (`whatsapp-payload-queue`) to generate personalized AI messages via Gemini API.

**Response 201 Created**

```json
{
  "success": true,
  "challans_issued": 3,
  "batch_id": "batch_99283411_xyz",
  "message": "Bulk custom challans issued successfully and WhatsApp payloads queued."
}
```

### 4.3 Pre-Flight Freshness Endpoint (`GET /api/school/ledger/:id/freshness`)

Called by the frontend immediately before dispatching a manual WhatsApp reminder or recording cash, to ensure webhooks haven't liquidated the ledger in the last few seconds.

**Response 200 OK**

```json
{
  "ledger_id": "e4f5a6b7-1111-4000-8000-000000000099",
  "status": "settled",
  "liquidated_amount": 12000,
  "is_fresh": false
}
```

If `status` is `settled`, the frontend aborts the action and displays a warning.

---

## SECTION 5: WEAPONIZED WHATSAPP & GEMINI AI ENGINE

### 5.1 AI Prompt Template Architecture

The Gemini AI payload rewriter acts as a behavioral economist, crafting highly persuasive, culturally appropriate messages.

**System Prompt for Gemini 1.5 Pro Generator**

```text
You are an elite behavioral economist writing payment reminders for Pakistani educational institutions and fitness clubs.
Generate a concise, polite yet firm WhatsApp reminder in Roman Urdu or Formal English based on the institution's configured tone.

CONTEXT INPUTS:
- Parent/Member Name: {{parent_name}}
- Student/Member Name: {{student_name}}
- Amount Owed: PKR {{amount_owed}}
- Due Date: {{due_date}}
- Payment Link: {{payment_link}}
- AI Tone Config: {{ai_tone}} ('polite_urdu' | 'firm_urdu' | 'formal_english')

RULES:
1. Do not include markdown headers or unnecessary conversational filler.
2. Directly provide the message body ready for WhatsApp dispatch.
3. Highlight that payment can be made instantly via KuickPay 1Link on any mobile banking app.
```

### 5.2 Jummah Pause & Quiet Hours Enforcement

Before popping a payload off the BullMQ Redis queue and pushing it to the Meta WhatsApp Cloud API:

1. **Check Local Time (PKT - UTC+5):** if current time falls between `quiet_hours_start` (e.g., 21:00) and `quiet_hours_end` (e.g., 08:00), delay job execution to `08:05:00`.
2. **Check Jummah Pause:** if `jummah_pause == true` AND current day is Friday AND current time is between `12:30:00` and `14:30:00` PKT, delay job execution to `14:35:00`.

---

## SECTION 6: SECURITY & CRYPTOGRAPHIC STANDARDS

### 6.1 AES-256 KMS Encryption for API Keys

Plaintext API keys (`safepay_secret`, `kuickpay_secret`, `whatsapp_token`) MUST NEVER be stored in clear text inside PostgreSQL.

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = Buffer.from(process.env.KMS_SECRET_KEY!, 'hex'); // 32 bytes

export function encryptSecret(plaintext: string): { cipherText: Buffer; iv: Buffer; tag: Buffer } {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { cipherText: encrypted, iv, tag };
}
```

---

## SECTION 7: ANTIGRAVITY COMPILER EXECUTION CHECKLIST

AntiGravity must verify the completion of the following 10 milestones before declaring backend generation complete:

- [ ] 1. **Schema Migration:** Executed SQL DDL with strict FK constraints and integer currency types.
- [ ] 2. **Tenancy Isolation:** Verified `workspace_id` scoping on all endpoints and queries.
- [ ] 3. **Sibling Rollup Engine:** Implemented price-descending discount sorting.
- [ ] 4. **Waterfall Settlement:** Built transaction-isolated 1-to-Many KuickPay webhook handler.
- [ ] 5. **Two-Tier Pricing:** Configured KuickPay payloads for `AmountWithinDueDate` vs `AmountAfterDueDate`.
- [ ] 6. **Bulk Cohort Billing:** Built array-mapped ad-hoc challan generation endpoint.
- [ ] 7. **Encryption Layer:** Applied AES-256 KMS wrappers to all third-party gateway credentials.
- [ ] 8. **Optimistic Concurrency:** Enforced `version_lock` checks on all manual settlement mutations.
- [ ] 9. **Pre-Flight Endpoint:** Exposed ledger freshness check route.
- [ ] 10. **Queue Rate-Limiting:** Configured BullMQ Redis worker with Jummah Pause and Quiet Hours logic.

---

## HANDOFF STATUS

* **Frontend Blueprint:** Sealed & State-Hardened
* **Backend Blueprint:** Complete, Normalised & Bank-Grade
* **AntiGravity Status:** CLEARED FOR FULL BACKEND COMPILATION
