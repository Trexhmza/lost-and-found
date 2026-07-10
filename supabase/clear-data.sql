-- =============================================
-- CLEAR ALL DATA (keeps tables, columns, indexes, RLS policies intact)
-- Run this in: Supabase Dashboard → SQL Editor
-- =============================================

-- Disable triggers temporarily to avoid cascade issues during bulk delete
SET session_replication_role = 'replica';

-- Delete in correct FK order (leaf tables first)
DELETE FROM public.messages;
DELETE FROM public.conversations;
DELETE FROM public.matches;
DELETE FROM public.comments;
DELETE FROM public.likes;
DELETE FROM public.posts;

-- Profiles are tied to auth.users via FK; deleting profile rows is safe
-- (does NOT delete auth.users entries — those stay in Supabase Auth)
DELETE FROM public.profiles;

-- Re-enable triggers
SET session_replication_role = 'origin';

-- Reset sequences (not needed for UUID tables, but safe to include)
-- SELECT setval(pg_get_serial_sequence('public.profiles', 'id'), 1, false);
