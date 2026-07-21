-- Fix exec_sql to properly handle SELECT queries with row_to_json
CREATE OR REPLACE FUNCTION exec_sql(query_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  normalized TEXT;
BEGIN
  normalized := regexp_replace(trim(query_text), ';\s*$', '');

  IF upper(normalized) LIKE 'SELECT %' OR upper(normalized) LIKE 'WITH %' THEN
    BEGIN
      EXECUTE format('SELECT coalesce(to_jsonb(array_agg(row_to_json(t))), ''[]''::jsonb) FROM (%s) t', normalized) INTO result;
    EXCEPTION WHEN OTHERS THEN
      result := jsonb_build_object('error', SQLERRM);
    END;
  ELSE
    EXECUTE normalized;
    result := jsonb_build_object('message', 'Query executed successfully');
  END IF;

  RETURN coalesce(result, '[]'::jsonb);
END;
$$;
