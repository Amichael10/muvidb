-- Migration: Add distributor column to films table
ALTER TABLE public.films ADD COLUMN IF NOT EXISTS distributor TEXT;
