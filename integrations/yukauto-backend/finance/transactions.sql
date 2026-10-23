, filtered AS (
    SELECT * FROM events
    WHERE ($5::text IS NULL OR external_ref ILIKE '%' || $5 || '%'
        OR tenant_name ILIKE '%' || $5 || '%' OR counterparty ILIKE '%' || $5 || '%'
        OR id::text ILIKE '%' || $5 || '%')
      AND ($6 = 'all' OR ($6 = 'success' AND successful)
        OR ($6 = 'failed' AND failed) OR ($6 = 'pending' AND NOT successful AND NOT failed))
      AND ($7 = 'all' OR direction = $7)
), page AS (
    SELECT * FROM filtered ORDER BY created_at DESC, id DESC LIMIT $8 OFFSET $9
)
SELECT jsonb_build_object('rows', COALESCE((SELECT jsonb_agg(to_jsonb(page)) FROM page), '[]'::jsonb),
    'total', (SELECT COUNT(*) FROM filtered), 'limit', $8::bigint, 'offset', $9::bigint)
