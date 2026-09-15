UPDATE audits
SET context_envelope = jsonb_set(
  jsonb_set(
    context_envelope,
    '{fields,intent}',
    '{"value": null, "source": "unknown", "confidence": 0}'::jsonb
  ),
  '{fields,priorities}',
  '{"value": null, "source": "unknown", "confidence": 0}'::jsonb
)
WHERE context_envelope IS NOT NULL
  AND (context_envelope #> '{fields,intent}') IS NULL;
