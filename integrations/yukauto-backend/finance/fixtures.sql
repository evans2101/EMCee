-- Temporary tables shadow public tables on this test connection only.
CREATE TEMP TABLE tenants (id uuid, name text);
CREATE TEMP TABLE devices (id uuid, tenant_id uuid, device_name text, device_model text, status text, last_seen_at timestamptz);
CREATE TEMP TABLE bank_accounts (id uuid, tenant_id uuid, bank_type text, account_number text, account_name text, current_balance bigint, last_balance_update timestamptz, device_id uuid, is_active bool);
CREATE TEMP TABLE tenant_wallets (tenant_id uuid, balance bigint);
CREATE TEMP TABLE deposit_transactions (
    id uuid DEFAULT gen_random_uuid(), tenant_id uuid DEFAULT '00000000-0000-4000-8000-000000000001',
    external_ref text, entry_type text DEFAULT 'CR', bank_type text DEFAULT 'BCA', sender_name text DEFAULT 'Sender', recipient_name text,
    amount bigint, status text DEFAULT 'approved', device_id uuid,
    created_at timestamptz DEFAULT '2026-10-01T03:00:00Z', source text DEFAULT 'scraped', linked_deposit_id uuid, linked_withdrawal_id uuid
);
CREATE TEMP TABLE withdraw_transactions (
    id uuid DEFAULT gen_random_uuid(), tenant_id uuid DEFAULT '00000000-0000-4000-8000-000000000001', external_ref text,
    entry_type text, execution_mode text DEFAULT 'device', gateway_provider text, recipient_bank_type text DEFAULT 'BCA', recipient_name text DEFAULT 'Recipient',
    amount bigint, tenant_fee bigint DEFAULT 0, gateway_total_fee bigint, gateway_fee bigint, status text DEFAULT 'completed',
    assigned_device_id uuid, device_id uuid, created_at timestamptz DEFAULT '2026-10-01T04:00:00Z'
);
INSERT INTO tenants VALUES ('00000000-0000-4000-8000-000000000001', 'Alpha'), ('00000000-0000-4000-8000-000000000002', 'Beta');
INSERT INTO devices VALUES ('00000000-0000-4000-8000-000000000031','00000000-0000-4000-8000-000000000001','Phone','Test model','active',NOW());
INSERT INTO bank_accounts VALUES ('00000000-0000-4000-8000-000000000041','00000000-0000-4000-8000-000000000001','BCA','9988771234','Test account',1000,NOW(),'00000000-0000-4000-8000-000000000031',true);
INSERT INTO tenant_wallets VALUES ('00000000-0000-4000-8000-000000000001',20),('00000000-0000-4000-8000-000000000002',30);
INSERT INTO deposit_transactions (id, amount) VALUES ('00000000-0000-4000-8000-000000000011',1000);
INSERT INTO deposit_transactions (amount, source, linked_deposit_id, external_ref) VALUES (1000,'ubm_connector','00000000-0000-4000-8000-000000000011','canonical');
INSERT INTO withdraw_transactions (id,amount,external_ref) VALUES ('00000000-0000-4000-8000-000000000021',100,'manual_debit:fixture'),('00000000-0000-4000-8000-000000000022',200,'normal-payout');
INSERT INTO deposit_transactions (amount,entry_type,source,linked_withdrawal_id) VALUES
    (100,'DB','manual','00000000-0000-4000-8000-000000000021'),
    (200,'DB','scraped','00000000-0000-4000-8000-000000000022');
INSERT INTO deposit_transactions (amount,status) VALUES (900,'failed'),(500,'pending');
INSERT INTO deposit_transactions (amount,tenant_id) VALUES (300,'00000000-0000-4000-8000-000000000002');
INSERT INTO deposit_transactions (amount,created_at) VALUES
    (10000,'2026-09-30T16:59:59Z'),(400,'2026-09-30T17:00:00Z'),(10000,'2026-10-01T17:00:00Z');
INSERT INTO withdraw_transactions (amount,execution_mode,gateway_provider,tenant_fee,gateway_fee,status) VALUES
    (700,'gateway','apkita',50,20,'completed'),(999,'gateway','apkita',50,NULL,'failed'),
    (888,'gateway','apkita',50,NULL,'queued'),(600,'gateway','apkita',50,NULL,'completed');
