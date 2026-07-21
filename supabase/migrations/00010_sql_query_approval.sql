-- SQL Query Approval System
-- Queries require approval from a different admin before execution.

CREATE TYPE sql_query_status AS ENUM ('pending', 'approved', 'rejected', 'executed', 'failed');

CREATE TABLE sql_queries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  query TEXT NOT NULL,
  status sql_query_status NOT NULL DEFAULT 'pending',
  created_by UUID NOT NULL REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  result JSONB,
  row_count INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ
);

-- RLS: only admins can access
ALTER TABLE sql_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all queries"
  ON sql_queries FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

CREATE POLICY "Admins can insert queries"
  ON sql_queries FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
    AND created_by = auth.uid()
  );

CREATE POLICY "Admins can update queries"
  ON sql_queries FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

CREATE INDEX idx_sql_queries_status ON sql_queries(status);
CREATE INDEX idx_sql_queries_created_by ON sql_queries(created_by);

-- Exec function: runs arbitrary SQL (service-role only, called by edge function)
CREATE OR REPLACE FUNCTION exec_sql(query_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  normalized TEXT;
BEGIN
  -- Normalize: trim and remove trailing semicolons
  normalized := regexp_replace(trim(query_text), ';\s*$', '');

  -- Check if it looks like a SELECT (returns rows)
  IF upper(normalized) LIKE 'SELECT %' OR upper(normalized) LIKE 'WITH %' THEN
    BEGIN
      EXECUTE format('SELECT coalesce(to_jsonb(array_agg(row_to_json(t))), ''[]''::jsonb) FROM (%s) t', normalized) INTO result;
    EXCEPTION WHEN OTHERS THEN
      result := jsonb_build_object('error', SQLERRM);
    END;
  ELSE
    -- DML / DDL: execute and return success
    EXECUTE normalized;
    result := jsonb_build_object('message', 'Query executed successfully');
  END IF;

  RETURN coalesce(result, '[]'::jsonb);
END;
$$;

-- Restrict exec_sql to service-role only
REVOKE EXECUTE ON FUNCTION exec_sql(TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION exec_sql(TEXT) FROM anon;
