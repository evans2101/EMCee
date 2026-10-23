, summary AS (
    SELECT COUNT(*)::bigint AS total_count,
        COUNT(*) FILTER (WHERE successful)::bigint AS success_count,
        COUNT(*) FILTER (WHERE failed)::bigint AS failed_count,
        COUNT(*) FILTER (WHERE NOT successful AND NOT failed)::bigint AS pending_count,
        COALESCE(SUM(amount) FILTER (WHERE successful AND direction = 'incoming'), 0)::bigint AS incoming,
        COALESCE(SUM(amount) FILTER (WHERE successful AND direction = 'outgoing'), 0)::bigint AS outgoing,
        COALESCE(SUM(fee) FILTER (WHERE successful AND channel = 'gateway'), 0)::bigint AS admin_fee,
        COALESCE(SUM(fee - provider_fee) FILTER (WHERE successful AND channel = 'gateway' AND provider_fee IS NOT NULL), 0)::bigint AS margin,
        COUNT(*) FILTER (WHERE successful AND channel = 'gateway' AND provider_fee IS NULL)::bigint AS unsettled_fee_count
    FROM events
), days AS (
    SELECT generate_series(($1::timestamptz AT TIME ZONE 'Asia/Jakarta')::date,
        (($2::timestamptz - INTERVAL '1 second') AT TIME ZONE 'Asia/Jakarta')::date,
        INTERVAL '1 day')::date AS day
), chart AS (
    SELECT days.day::text AS date,
        COALESCE(SUM(e.amount) FILTER (WHERE e.successful AND e.direction = 'incoming'), 0)::bigint AS incoming,
        COALESCE(SUM(e.amount) FILTER (WHERE e.successful AND e.direction = 'outgoing'), 0)::bigint AS outgoing
    FROM days LEFT JOIN events e ON (e.created_at AT TIME ZONE 'Asia/Jakarta')::date = days.day
    GROUP BY days.day ORDER BY days.day
), channels AS (
    SELECT channel, provider, COUNT(*)::bigint AS total_count,
        COUNT(*) FILTER (WHERE successful)::bigint AS success_count,
        COUNT(*) FILTER (WHERE NOT successful AND NOT failed)::bigint AS pending_count,
        COUNT(*) FILTER (WHERE failed)::bigint AS failed_count,
        COALESCE(SUM(amount) FILTER (WHERE successful AND direction = 'incoming'), 0)::bigint AS incoming,
        COALESCE(SUM(amount) FILTER (WHERE successful AND direction = 'outgoing'), 0)::bigint AS outgoing
    FROM events GROUP BY channel, provider ORDER BY channel, provider
), tenant_totals AS (
    SELECT tenant_id, tenant_name, COUNT(*)::bigint AS total_count,
        COALESCE(SUM(amount) FILTER (WHERE successful AND direction = 'incoming'), 0)::bigint AS incoming,
        COALESCE(SUM(amount) FILTER (WHERE successful AND direction = 'outgoing'), 0)::bigint AS outgoing,
        COUNT(*) FILTER (WHERE NOT successful AND NOT failed)::bigint AS pending_count
    FROM events GROUP BY tenant_id, tenant_name
    ORDER BY COALESCE(SUM(amount) FILTER (WHERE successful), 0) DESC, tenant_name
), banks AS (
    SELECT b.id, b.tenant_id, t.name AS tenant_name, b.bank_type AS bank,
        CASE WHEN b.account_number IS NULL THEN NULL ELSE '•••• ' || RIGHT(b.account_number, 4) END AS account_number_masked,
        b.account_name, b.current_balance AS balance,
        b.last_balance_update, b.device_id, d.device_name,
        (b.last_balance_update IS NULL OR b.last_balance_update < NOW() - INTERVAL '15 minutes') AS stale
    FROM bank_accounts b JOIN tenants t ON t.id = b.tenant_id
    LEFT JOIN devices d ON d.id = b.device_id
    WHERE b.is_active AND ($3::uuid IS NULL OR b.tenant_id = $3) AND $4 <> 'gateway'
    ORDER BY b.current_balance DESC NULLS LAST, b.id
), devices AS (
    SELECT d.id, d.tenant_id, t.name AS tenant_name, d.device_name, d.device_model,
        d.status, d.last_seen_at,
        (d.status = 'active' AND d.last_seen_at > NOW() - INTERVAL '5 minutes') AS online
    FROM devices d JOIN tenants t ON t.id = d.tenant_id
    WHERE ($3::uuid IS NULL OR d.tenant_id = $3) AND $4 <> 'gateway'
    ORDER BY d.last_seen_at DESC NULLS LAST, d.id
), wallets AS (
    SELECT COALESCE(SUM(balance), 0)::bigint AS balance
    FROM tenant_wallets WHERE ($3::uuid IS NULL OR tenant_id = $3) AND $4 <> 'device'
)
SELECT jsonb_build_object(
    'summary', (SELECT to_jsonb(summary) FROM summary),
    'chart', COALESCE((SELECT jsonb_agg(to_jsonb(chart)) FROM chart), '[]'::jsonb),
    'channels', COALESCE((SELECT jsonb_agg(to_jsonb(channels)) FROM channels), '[]'::jsonb),
    'tenants', COALESCE((SELECT jsonb_agg(to_jsonb(tenant_totals)) FROM tenant_totals), '[]'::jsonb),
    'tenant_options', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id, 'name', name) ORDER BY name) FROM tenants), '[]'::jsonb),
    'banks', COALESCE((SELECT jsonb_agg(to_jsonb(banks)) FROM banks), '[]'::jsonb),
    'devices', COALESCE((SELECT jsonb_agg(to_jsonb(devices)) FROM devices), '[]'::jsonb),
    'wallet_balance', (SELECT balance FROM wallets),
    'generated_at', NOW(), 'timezone', 'Asia/Jakarta'
)
