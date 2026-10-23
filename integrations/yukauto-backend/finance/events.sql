WITH events AS (
    SELECT d.id, d.tenant_id, t.name AS tenant_name, d.external_ref,
           CASE WHEN d.entry_type = 'DB' THEN 'outgoing' ELSE 'incoming' END AS direction,
           'device'::text AS channel, NULL::text AS provider,
           d.bank_type AS bank, COALESCE(d.sender_name, d.recipient_name, '—') AS counterparty,
           d.amount, 0::bigint AS fee, NULL::bigint AS provider_fee,
           d.status, d.status IN ('approved', 'synced', 'completed') AS successful,
           d.status IN ('failed', 'cancelled', 'rejected') AS failed,
           d.device_id, d.created_at
    FROM deposit_transactions d
    JOIN tenants t ON t.id = d.tenant_id
    WHERE d.created_at >= $1 AND d.created_at < $2
      AND ($3::uuid IS NULL OR d.tenant_id = $3)
      AND $4 <> 'gateway'
      -- The connector row is canonical when it links to a scraped credit.
      AND NOT EXISTS (SELECT 1 FROM deposit_transactions twin
                      WHERE twin.linked_deposit_id = d.id AND twin.source = 'ubm_connector')
      -- A real payout and its bank debit are one cash movement. Synthetic
      -- manual/sweep payouts are instead represented by their debit below.
      AND NOT (d.entry_type = 'DB' AND EXISTS (
          SELECT 1 FROM withdraw_transactions w WHERE w.id = d.linked_withdrawal_id
          AND COALESCE(w.external_ref, '') NOT LIKE 'balance_sweep:%'
          AND COALESCE(w.external_ref, '') NOT LIKE 'manual_debit:%'
      ))
    UNION ALL
    SELECT w.id, w.tenant_id, t.name, w.external_ref,
           CASE WHEN w.entry_type = 'CR' THEN 'incoming' ELSE 'outgoing' END,
           w.execution_mode, w.gateway_provider, w.recipient_bank_type, w.recipient_name,
           w.amount, w.tenant_fee, COALESCE(w.gateway_total_fee, w.gateway_fee),
           w.status, w.status = 'completed', w.status IN ('failed', 'cancelled', 'rejected'),
           COALESCE(w.assigned_device_id, w.device_id), w.created_at
    FROM withdraw_transactions w
    JOIN tenants t ON t.id = w.tenant_id
    WHERE w.created_at >= $1 AND w.created_at < $2
      AND ($3::uuid IS NULL OR w.tenant_id = $3)
      AND ($4 = 'all' OR w.execution_mode = $4)
      AND COALESCE(w.external_ref, '') NOT LIKE 'balance_sweep:%'
      AND COALESCE(w.external_ref, '') NOT LIKE 'manual_debit:%'
)
