-- Add reasons column to matches table
ALTER TABLE public.matches ADD COLUMN reasons text[] DEFAULT '{}';
