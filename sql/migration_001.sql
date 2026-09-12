-- CATALYST Upgrade Migration
-- Run this in the Supabase SQL Editor

-- 1. Learning Modules
CREATE TABLE IF NOT EXISTS public.learning_modules (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    description text DEFAULT '',
    sort_order integer DEFAULT 0 NOT NULL,
    published boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 2. Learning Lessons
CREATE TABLE IF NOT EXISTS public.learning_lessons (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    module_id uuid NOT NULL REFERENCES public.learning_modules(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text DEFAULT '',
    youtube_url text,
    catalyst_summary text DEFAULT '',
    catalyst_analysis text DEFAULT '',
    sort_order integer DEFAULT 0 NOT NULL,
    published boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 3. Partnerships
CREATE TABLE IF NOT EXISTS public.partnerships (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    logo_url text,
    website_url text,
    sort_order integer DEFAULT 0 NOT NULL,
    published boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 4. Event Media
CREATE TABLE IF NOT EXISTS public.event_media (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    media_type text DEFAULT 'photo' NOT NULL CHECK (media_type IN ('logo', 'photo')),
    media_url text NOT NULL,
    alt_text text DEFAULT '',
    sort_order integer DEFAULT 0 NOT NULL,
    published boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_learning_modules_published_sort ON public.learning_modules USING btree (published, sort_order);
CREATE INDEX IF NOT EXISTS idx_learning_lessons_module ON public.learning_lessons USING btree (module_id);
CREATE INDEX IF NOT EXISTS idx_learning_lessons_published_sort ON public.learning_lessons USING btree (published, sort_order);
CREATE INDEX IF NOT EXISTS idx_partnerships_published_sort ON public.partnerships USING btree (published, sort_order);
CREATE INDEX IF NOT EXISTS idx_event_media_event ON public.event_media USING btree (event_id);
CREATE INDEX IF NOT EXISTS idx_event_media_published_sort ON public.event_media USING btree (published, sort_order);

-- Triggers for updated_at
CREATE OR REPLACE TRIGGER trg_learning_modules_updated_at BEFORE UPDATE ON public.learning_modules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER trg_learning_lessons_updated_at BEFORE UPDATE ON public.learning_lessons FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER trg_partnerships_updated_at BEFORE UPDATE ON public.partnerships FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER trg_event_media_updated_at BEFORE UPDATE ON public.event_media FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.learning_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partnerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_media ENABLE ROW LEVEL SECURITY;

-- learning_modules Policies
CREATE POLICY "learning_modules_select_published" ON public.learning_modules FOR SELECT USING (published = true);
CREATE POLICY "learning_modules_select_admin" ON public.learning_modules FOR SELECT USING (public.get_user_role() = 'admin');
CREATE POLICY "learning_modules_insert_admin" ON public.learning_modules FOR INSERT WITH CHECK (public.get_user_role() = 'admin');
CREATE POLICY "learning_modules_update_admin" ON public.learning_modules FOR UPDATE USING (public.get_user_role() = 'admin') WITH CHECK (public.get_user_role() = 'admin');
CREATE POLICY "learning_modules_delete_admin" ON public.learning_modules FOR DELETE USING (public.get_user_role() = 'admin');

-- learning_lessons Policies
CREATE POLICY "learning_lessons_select_published" ON public.learning_lessons FOR SELECT USING (published = true);
CREATE POLICY "learning_lessons_select_admin" ON public.learning_lessons FOR SELECT USING (public.get_user_role() = 'admin');
CREATE POLICY "learning_lessons_insert_admin" ON public.learning_lessons FOR INSERT WITH CHECK (public.get_user_role() = 'admin');
CREATE POLICY "learning_lessons_update_admin" ON public.learning_lessons FOR UPDATE USING (public.get_user_role() = 'admin') WITH CHECK (public.get_user_role() = 'admin');
CREATE POLICY "learning_lessons_delete_admin" ON public.learning_lessons FOR DELETE USING (public.get_user_role() = 'admin');

-- partnerships Policies
CREATE POLICY "partnerships_select_published" ON public.partnerships FOR SELECT USING (published = true);
CREATE POLICY "partnerships_select_admin" ON public.partnerships FOR SELECT USING (public.get_user_role() = 'admin');
CREATE POLICY "partnerships_insert_admin" ON public.partnerships FOR INSERT WITH CHECK (public.get_user_role() = 'admin');
CREATE POLICY "partnerships_update_admin" ON public.partnerships FOR UPDATE USING (public.get_user_role() = 'admin') WITH CHECK (public.get_user_role() = 'admin');
CREATE POLICY "partnerships_delete_admin" ON public.partnerships FOR DELETE USING (public.get_user_role() = 'admin');

-- event_media Policies
CREATE POLICY "event_media_select_published" ON public.event_media FOR SELECT USING (published = true);
CREATE POLICY "event_media_select_admin" ON public.event_media FOR SELECT USING (public.get_user_role() = 'admin');
CREATE POLICY "event_media_insert_admin" ON public.event_media FOR INSERT WITH CHECK (public.get_user_role() = 'admin');
CREATE POLICY "event_media_update_admin" ON public.event_media FOR UPDATE USING (public.get_user_role() = 'admin') WITH CHECK (public.get_user_role() = 'admin');
CREATE POLICY "event_media_delete_admin" ON public.event_media FOR DELETE USING (public.get_user_role() = 'admin');

-- Grant permissions (if needed, but usually Supabase handles via RLS and roles)
GRANT ALL ON TABLE public.learning_modules TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.learning_lessons TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.partnerships TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.event_media TO anon, authenticated, service_role;
