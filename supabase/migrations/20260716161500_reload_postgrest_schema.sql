-- Make the newly added homepage RPC visible to the PostgREST schema cache.
NOTIFY pgrst, 'reload schema';
