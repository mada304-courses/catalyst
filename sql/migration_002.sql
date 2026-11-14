-- CATALYST Upgrade Migration 002
-- Leaderboard, points, and "lesson watched / module finished" tracking.
-- Run this in the Supabase SQL Editor AFTER migration_001.sql.
--
-- WHAT THIS ADDS
--   1. profiles.points            — cached running total, kept in sync automatically
--   2. points_ledger              — the source-of-truth audit trail for every point change
--   3. user_lesson_progress       — one row per (user, lesson) once a video is watched
--   4. user_module_progress       — one row per (user, module) once every lesson in it is watched
--   5. learning_lessons.points_value / learning_modules.points_value — how much each is worth
--   6. public.leaderboard         — a public, read-only view (name + points + stats, no email)
--   7. RPC functions:
--        - mark_lesson_watched(lesson_id)                 called by any logged-in user
--        - adjust_user_points(user_id, delta, reason)      admin-only, "+ / -" quick buttons
--        - set_user_points(user_id, new_total, reason)     admin-only, direct leaderboard edit
--
-- SECURITY NOTE: points are never writable directly by a user. The only way points change is
-- through points_ledger, and the only way to insert into points_ledger is through the RPC
-- functions below (SECURITY DEFINER, owned by postgres, so they bypass RLS deliberately —
-- exactly like handle_new_user() already does in schema.sql). Each function re-checks
-- authorization itself (auth.uid() / public.get_user_role()) before doing anything.

-- 1. Cached points total on profiles ---------------------------------------------------------
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS points integer DEFAULT 0 NOT NULL;

-- 2. Points value per lesson / module ---------------------------------------------------------
ALTER TABLE public.learning_lessons
    ADD COLUMN IF NOT EXISTS points_value integer DEFAULT 10 NOT NULL;

ALTER TABLE public.learning_modules
    ADD COLUMN IF NOT EXISTS points_value integer DEFAULT 50 NOT NULL;

-- 3. Ledger (audit trail) --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.points_ledger (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    delta integer NOT NULL,
    source text NOT NULL DEFAULT 'admin' CHECK (source IN ('lesson', 'module', 'admin')),
    lesson_id uuid REFERENCES public.learning_lessons(id) ON DELETE SET NULL,
    module_id uuid REFERENCES public.learning_modules(id) ON DELETE SET NULL,
    reason text DEFAULT '',
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_points_ledger_user ON public.points_ledger USING btree (user_id, created_at DESC);

-- 4. Progress tracking ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_lesson_progress (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    lesson_id uuid NOT NULL REFERENCES public.learning_lessons(id) ON DELETE CASCADE,
    watched_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE (user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS public.user_module_progress (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    module_id uuid NOT NULL REFERENCES public.learning_modules(id) ON DELETE CASCADE,
    completed_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE (user_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_user_lesson_progress_user ON public.user_lesson_progress USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_user_lesson_progress_lesson ON public.user_lesson_progress USING btree (lesson_id);
CREATE INDEX IF NOT EXISTS idx_user_module_progress_user ON public.user_module_progress USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_user_module_progress_module ON public.user_module_progress USING btree (module_id);

-- 5. Keep profiles.points in sync whenever a ledger row is inserted --------------------------
CREATE OR REPLACE FUNCTION public.sync_profile_points() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update public.profiles set points = points + new.delta where id = new.user_id;
  return new;
end;
$$;

ALTER FUNCTION public.sync_profile_points() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_points_ledger_sync ON public.points_ledger;
CREATE TRIGGER trg_points_ledger_sync AFTER INSERT ON public.points_ledger
    FOR EACH ROW EXECUTE FUNCTION public.sync_profile_points();

-- 6. RPC: a logged-in user marks a lesson as watched ------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_lesson_watched(p_lesson_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user uuid := auth.uid();
  v_lesson public.learning_lessons%rowtype;
  v_module public.learning_modules%rowtype;
  v_rows integer;
  v_total_lessons integer;
  v_watched_lessons integer;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_lesson from public.learning_lessons where id = p_lesson_id and published = true;
  if not found then
    raise exception 'Lesson not available';
  end if;

  insert into public.user_lesson_progress (user_id, lesson_id)
    values (v_user, p_lesson_id)
    on conflict (user_id, lesson_id) do nothing;
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    -- already watched before; nothing further to do (no double points)
    return;
  end if;

  insert into public.points_ledger (user_id, delta, source, lesson_id, reason)
    values (v_user, v_lesson.points_value, 'lesson', p_lesson_id, 'Watched lesson: ' || v_lesson.title);

  -- Did this complete the whole module?
  select count(*) into v_total_lessons
    from public.learning_lessons
    where module_id = v_lesson.module_id and published = true;

  select count(*) into v_watched_lessons
    from public.user_lesson_progress ulp
    join public.learning_lessons ll on ll.id = ulp.lesson_id
    where ulp.user_id = v_user and ll.module_id = v_lesson.module_id and ll.published = true;

  if v_total_lessons > 0 and v_watched_lessons >= v_total_lessons then
    insert into public.user_module_progress (user_id, module_id)
      values (v_user, v_lesson.module_id)
      on conflict (user_id, module_id) do nothing;
    get diagnostics v_rows = row_count;

    if v_rows > 0 then
      select * into v_module from public.learning_modules where id = v_lesson.module_id;
      insert into public.points_ledger (user_id, delta, source, module_id, reason)
        values (v_user, v_module.points_value, 'module', v_module.id, 'Completed module: ' || v_module.title);
    end if;
  end if;
end;
$$;

ALTER FUNCTION public.mark_lesson_watched(uuid) OWNER TO postgres;

-- 7. RPC: admin adds/subtracts points (quick +/- buttons in the admin panel) ------------------
CREATE OR REPLACE FUNCTION public.adjust_user_points(p_user_id uuid, p_delta integer, p_reason text DEFAULT '') RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if public.get_user_role() <> 'admin' then
    raise exception 'Not authorized';
  end if;

  if p_delta = 0 then
    return;
  end if;

  insert into public.points_ledger (user_id, delta, source, reason, created_by)
    values (p_user_id, p_delta, 'admin', coalesce(p_reason, ''), auth.uid());
end;
$$;

ALTER FUNCTION public.adjust_user_points(uuid, integer, text) OWNER TO postgres;

-- 8. RPC: admin sets a user's total directly (inline "edit" on the leaderboard) ---------------
CREATE OR REPLACE FUNCTION public.set_user_points(p_user_id uuid, p_new_total integer, p_reason text DEFAULT 'Manual leaderboard edit') RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_current integer;
begin
  if public.get_user_role() <> 'admin' then
    raise exception 'Not authorized';
  end if;

  select points into v_current from public.profiles where id = p_user_id;
  if not found then
    raise exception 'User not found';
  end if;

  if p_new_total = v_current then
    return;
  end if;

  insert into public.points_ledger (user_id, delta, source, reason, created_by)
    values (p_user_id, p_new_total - v_current, 'admin', coalesce(p_reason, 'Manual leaderboard edit'), auth.uid());
end;
$$;

ALTER FUNCTION public.set_user_points(uuid, integer, text) OWNER TO postgres;

-- 9. Public leaderboard view (name + points only — never exposes email) -----------------------
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
    p.id,
    p.full_name,
    p.points,
    (SELECT count(*) FROM public.user_lesson_progress ulp WHERE ulp.user_id = p.id) AS lessons_watched,
    (SELECT count(*) FROM public.user_module_progress ump WHERE ump.user_id = p.id) AS modules_completed
FROM public.profiles p
ORDER BY p.points DESC, p.full_name ASC;

-- 10. RLS ---------------------------------------------------------------------------------------
ALTER TABLE public.points_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_module_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY points_ledger_select_own ON public.points_ledger FOR SELECT USING (user_id = auth.uid());
CREATE POLICY points_ledger_select_admin ON public.points_ledger FOR SELECT USING (public.get_user_role() = 'admin');
-- No direct INSERT/UPDATE/DELETE policies: every write goes through the SECURITY DEFINER
-- functions above, which run as the table owner and therefore bypass RLS on purpose.

CREATE POLICY user_lesson_progress_select_own ON public.user_lesson_progress FOR SELECT USING (user_id = auth.uid());
CREATE POLICY user_lesson_progress_select_admin ON public.user_lesson_progress FOR SELECT USING (public.get_user_role() = 'admin');

CREATE POLICY user_module_progress_select_own ON public.user_module_progress FOR SELECT USING (user_id = auth.uid());
CREATE POLICY user_module_progress_select_admin ON public.user_module_progress FOR SELECT USING (public.get_user_role() = 'admin');

-- 11. Grants ------------------------------------------------------------------------------------
GRANT ALL ON TABLE public.points_ledger TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.user_lesson_progress TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.user_module_progress TO anon, authenticated, service_role;
GRANT SELECT ON public.leaderboard TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.mark_lesson_watched(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_lesson_watched(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.adjust_user_points(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adjust_user_points(uuid, integer, text) TO authenticated;

REVOKE ALL ON FUNCTION public.set_user_points(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_points(uuid, integer, text) TO authenticated;

REVOKE ALL ON FUNCTION public.sync_profile_points() FROM PUBLIC;
