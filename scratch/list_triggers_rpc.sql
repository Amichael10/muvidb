-- Function to list triggers on a table
CREATE OR REPLACE FUNCTION list_table_triggers(tbl_name TEXT)
RETURNS TABLE (trigger_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT tgname::TEXT
    FROM pg_trigger
    JOIN pg_class ON pg_class.oid = tgrelid
    WHERE relname = tbl_name;
END;
$$;
