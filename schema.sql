-- ==============================================================================
-- ClearBill (Vasoolee Ledger) — Complete Supabase Schema
-- Includes original Phase 1/2 schema + Phase 3 fixes and additions
-- ==============================================================================

-- Enable UUID extension and cryptographic utilities
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. AUTH BRIDGE & MULTI-TENANCY (Workspaces & Profiles)
-- ==============================================================================
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

-- Public bridge to auth.users for RLS
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin', -- 'owner', 'admin'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 2. BRANCH NODES (Locations / Campuses)
-- ==============================================================================
CREATE TABLE branch_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_branch_per_workspace UNIQUE (workspace_id, code)
);

-- Add assigned_node_id to profiles if staff is scoped to a specific node
ALTER TABLE profiles ADD COLUMN assigned_node_id UUID REFERENCES branch_nodes(id) ON DELETE SET NULL;

-- ==============================================================================
-- 3. ACADEMIC TAXONOMY (Levels -> Sections)
-- ==============================================================================
CREATE TABLE academic_levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_node_id UUID NOT NULL REFERENCES branch_nodes(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    order_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE academic_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    level_id UUID NOT NULL REFERENCES academic_levels(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 4. STUDENTS (School Domain)
-- ==============================================================================
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

-- ==============================================================================
-- 5. FEE STRUCTURES (School Policies)
-- ==============================================================================
CREATE TABLE fee_structures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    branch_node_id UUID NOT NULL REFERENCES branch_nodes(id),
    level_id UUID NOT NULL REFERENCES academic_levels(id),
    tuition_fee INT NOT NULL DEFAULT 0, -- Stored as Integer (lowest currency unit)
    transport_fee INT NOT NULL DEFAULT 0,
    late_fee_amount INT NOT NULL DEFAULT 0,
    grace_period_days INT NOT NULL DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_fee_per_level UNIQUE (branch_node_id, level_id)
);

-- ==============================================================================
-- 6. DOUBLE-ENTRY LEDGERS (School & Ad-Hoc)
-- ==============================================================================
CREATE TYPE ledger_status_enum AS ENUM ('staged', 'unpaid', 'processing', 'settled', 'arrears', 'rejected', 'refunded', 'failed');
CREATE TYPE payment_method_enum AS ENUM ('safepay', 'kuickpay', 'raast', 'cash');

CREATE TABLE school_ledger_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    branch_node_id UUID NOT NULL REFERENCES branch_nodes(id),
    billing_period VARCHAR(7) NOT NULL, -- YYYY-MM
    base_tuition INT NOT NULL,
    transport_fee INT NOT NULL DEFAULT 0,
    sibling_discount INT NOT NULL DEFAULT 0,
    late_fee_penalty INT NOT NULL DEFAULT 0,
    invoiced_amount INT NOT NULL,
    liquidated_amount INT NOT NULL DEFAULT 0, -- Partial Payments / Udhaar
    status ledger_status_enum NOT NULL DEFAULT 'staged',
    payment_method payment_method_enum,
    idempotency_key VARCHAR(255) UNIQUE NOT NULL, -- Strict Webhook Armor
    kuickpay_consumer_id VARCHAR(100),
    due_date DATE NOT NULL,
    version_lock INT NOT NULL DEFAULT 1, -- Optimistic Concurrency Control
    last_reminder_sent_at TIMESTAMP WITH TIME ZONE, -- Phase 3: reminders idempotency
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE custom_challans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    amount INT NOT NULL,
    liquidated_amount INT NOT NULL DEFAULT 0,
    due_date DATE NOT NULL,
    status ledger_status_enum NOT NULL DEFAULT 'staged',
    payment_method payment_method_enum,
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    kuickpay_consumer_id VARCHAR(100),
    version_lock INT NOT NULL DEFAULT 1,
    last_reminder_sent_at TIMESTAMP WITH TIME ZONE, -- Phase 3: reminders idempotency
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 7. GYM DOMAIN (Packages & Members)
-- ==============================================================================
CREATE TABLE packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES branch_nodes(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    price INT NOT NULL,
    duration_days INT NOT NULL,
    is_archived BOOLEAN DEFAULT false, -- Soft delete preserves ledger math
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE lifecycle_status_enum AS ENUM ('active', 'inactive');

CREATE TABLE members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES branch_nodes(id),
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    package_id UUID NOT NULL REFERENCES packages(id),
    activation_date DATE NOT NULL,
    suspension_days_accrued INT DEFAULT 0,
    lifecycle_status lifecycle_status_enum DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_member_phone CHECK (phone_number ~ '^\+?923[0-9]{9}$|^03[0-9]{9}$')
);

CREATE TABLE subscription_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    package_id UUID NOT NULL REFERENCES packages(id),
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    invoiced_amount INT NOT NULL,
    liquidated_amount INT NOT NULL DEFAULT 0,
    status ledger_status_enum NOT NULL DEFAULT 'staged',
    payment_method payment_method_enum,
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    version_lock INT NOT NULL DEFAULT 1,
    last_reminder_sent_at TIMESTAMP WITH TIME ZONE, -- Phase 3: reminders idempotency
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- 8. INTEGRATIONS & CRYPTOGRAPHIC STORAGE
-- ==============================================================================
CREATE TABLE node_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES branch_nodes(id) ON DELETE CASCADE,
    -- Symmetric-encrypted storage for keys (see Section 8a for encrypt/decrypt helpers)
    encrypted_kuickpay_institution_id BYTEA,
    encrypted_kuickpay_secret BYTEA,
    encrypted_safepay_api_key BYTEA,
    encrypted_safepay_secret BYTEA,
    encrypted_whatsapp_token BYTEA,
    -- Plaintext config
    whatsapp_phone_number_id VARCHAR(100),
    whatsapp_template_id VARCHAR(100),
    enable_ai_messaging BOOLEAN DEFAULT false,
    ai_tone VARCHAR(50) DEFAULT 'firm_urdu',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_integrations_per_node UNIQUE (workspace_id, node_id)
);

-- ==============================================================================
-- 8a. SECRET ENCRYPTION HELPERS (Phase 3 addition)
-- ==============================================================================
-- The encryption key itself must live in Supabase Vault (Project Settings -> Vault),
-- NOT in this schema and NOT in any Edge Function's source code.
-- Store it once via SQL editor or CLI, e.g.:
--   select vault.create_secret('replace-with-a-strong-random-key', 'node_integrations_key');
--
-- These SECURITY DEFINER functions are the ONLY way secrets are read or written.
-- Grant EXECUTE only to the service_role — never to anon or authenticated.

CREATE OR REPLACE FUNCTION encrypt_node_secret(plaintext TEXT)
RETURNS BYTEA
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    key_value TEXT;
BEGIN
    SELECT decrypted_secret INTO key_value
    FROM vault.decrypted_secrets
    WHERE name = 'node_integrations_key';

    RETURN pgp_sym_encrypt(plaintext, key_value);
END;
$$;

CREATE OR REPLACE FUNCTION decrypt_node_secret(ciphertext BYTEA)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    key_value TEXT;
BEGIN
    SELECT decrypted_secret INTO key_value
    FROM vault.decrypted_secrets
    WHERE name = 'node_integrations_key';

    RETURN pgp_sym_decrypt(ciphertext, key_value);
END;
$$;

REVOKE ALL ON FUNCTION encrypt_node_secret(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION decrypt_node_secret(BYTEA) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION encrypt_node_secret(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION decrypt_node_secret(BYTEA) TO service_role;

-- Usage from an Edge Function (service role client):
--   await supabase.rpc('encrypt_node_secret', { plaintext: apiKey })
--   await supabase.rpc('decrypt_node_secret', { ciphertext: row.encrypted_safepay_secret })

-- ==============================================================================
-- 8b. WEBHOOK AUDIT LOG (Phase 3 addition)
-- ==============================================================================
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gateway payment_method_enum NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL,
    raw_payload JSONB NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT false,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Only service_role (Edge Functions) ever writes here; no end user needs access.
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies created = no access under anon/authenticated roles.
-- service_role bypasses RLS entirely, which is what the webhook function uses.

CREATE INDEX idx_webhook_events_idempotency ON webhook_events(gateway, idempotency_key);

-- ==============================================================================
-- 9. ROW-LEVEL SECURITY (RLS) & STRICT TENANT ISOLATION
-- ==============================================================================
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_challans ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_integrations ENABLE ROW LEVEL SECURITY;

-- 9.1 Profiles Policy: Users can only read/write their own profile
CREATE POLICY "Profiles - Users access own profile" ON profiles
    FOR ALL USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- 9.2 Workspaces Policies
-- Existing members read/update/delete only their own workspace:
CREATE POLICY "Workspaces - Cross-reference Profiles" ON workspaces
    FOR SELECT USING (id = (SELECT workspace_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Workspaces - Members update own workspace" ON workspaces
    FOR UPDATE USING (id = (SELECT workspace_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Workspaces - Members delete own workspace" ON workspaces
    FOR DELETE USING (id = (SELECT workspace_id FROM profiles WHERE id = auth.uid()));

-- Phase 3 FIX: any newly authenticated user (no profile yet) must be able to
-- create the very first workspace row before a profile can reference it.
CREATE POLICY "Workspaces - Allow initial creation" ON workspaces
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- 9.3 Branch Nodes Policy
CREATE POLICY "Branch Nodes - Cross-reference Profiles" ON branch_nodes
    FOR ALL USING (workspace_id = (SELECT workspace_id FROM profiles WHERE id = auth.uid()));

-- 9.4 Academic Levels Policy
CREATE POLICY "Academic Levels - Cross-reference Profiles" ON academic_levels
    FOR ALL USING (branch_node_id IN (
        SELECT id FROM branch_nodes WHERE workspace_id = (SELECT workspace_id FROM profiles WHERE id = auth.uid())
    ));

-- 9.5 Academic Sections Policy
CREATE POLICY "Academic Sections - Cross-reference Profiles" ON academic_sections
    FOR ALL USING (level_id IN (
        SELECT id FROM academic_levels WHERE branch_node_id IN (
            SELECT id FROM branch_nodes WHERE workspace_id = (SELECT workspace_id FROM profiles WHERE id = auth.uid())
        )
    ));

-- 9.6 Core Entities Policies (Scoped to workspace_id directly)
CREATE POLICY "Students - Tenant Isolation" ON students
    FOR ALL USING (workspace_id = (SELECT workspace_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Fee Structures - Tenant Isolation" ON fee_structures
    FOR ALL USING (workspace_id = (SELECT workspace_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "School Ledger - Tenant Isolation" ON school_ledger_entries
    FOR ALL USING (workspace_id = (SELECT workspace_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Custom Challans - Tenant Isolation" ON custom_challans
    FOR ALL USING (workspace_id = (SELECT workspace_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Packages - Tenant Isolation" ON packages
    FOR ALL USING (workspace_id = (SELECT workspace_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Members - Tenant Isolation" ON members
    FOR ALL USING (workspace_id = (SELECT workspace_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Subscription Ledger - Tenant Isolation" ON subscription_ledger
    FOR ALL USING (workspace_id = (SELECT workspace_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Node Integrations - Tenant Isolation" ON node_integrations
    FOR ALL USING (workspace_id = (SELECT workspace_id FROM profiles WHERE id = auth.uid()));

-- ==============================================================================
-- 10. HIGH-FREQUENCY INDEXES FOR PERFORMANCE
-- ==============================================================================
CREATE INDEX idx_profiles_auth_id ON profiles(id);
CREATE INDEX idx_students_parent_phone ON students(parent_phone);
CREATE INDEX idx_students_workspace_branch ON students(workspace_id, branch_node_id);
CREATE INDEX idx_school_ledger_parent_lookup ON school_ledger_entries(workspace_id, billing_period, status);
CREATE INDEX idx_school_ledger_idempotency ON school_ledger_entries(idempotency_key);
CREATE INDEX idx_custom_challans_lookup ON custom_challans(student_id, status);
CREATE INDEX idx_subscription_ledger_lookup ON subscription_ledger(member_id, status);
CREATE INDEX idx_subscription_ledger_idempotency ON subscription_ledger(idempotency_key);

-- Phase 3: fast lookup for the reminders cron (find unreminded overdue entries)
CREATE INDEX idx_school_ledger_reminder_lookup ON school_ledger_entries(status, due_date, last_reminder_sent_at);
CREATE INDEX idx_custom_challans_reminder_lookup ON custom_challans(status, due_date, last_reminder_sent_at);
CREATE INDEX idx_subscription_ledger_reminder_lookup ON subscription_ledger(status, billing_period_end, last_reminder_sent_at);