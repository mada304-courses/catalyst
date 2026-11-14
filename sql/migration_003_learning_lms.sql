-- CATALYST Upgrade Migration 003
-- Learning Hub LMS Upgrade
-- Run this in the Supabase SQL Editor AFTER migration_002.sql

-- 1. Add cover image to learning modules
ALTER TABLE public.learning_modules ADD COLUMN IF NOT EXISTS cover_image_url text;

-- 2. Add completed_at to user_lesson_progress
ALTER TABLE public.user_lesson_progress ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;

-- 3. Quizzes Tables
CREATE TABLE IF NOT EXISTS public.lesson_quizzes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    lesson_id uuid NOT NULL UNIQUE REFERENCES public.learning_lessons(id) ON DELETE CASCADE,
    title text NOT NULL DEFAULT 'Lesson Quiz',
    instructions text DEFAULT '',
    passing_percentage integer DEFAULT 80 NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    points_value integer DEFAULT 10 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.quiz_questions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    quiz_id uuid NOT NULL REFERENCES public.lesson_quizzes(id) ON DELETE CASCADE,
    question_text text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    points integer DEFAULT 10 NOT NULL,
    published boolean DEFAULT true NOT NULL
);

CREATE TABLE IF NOT EXISTS public.quiz_options (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    question_id uuid NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
    option_text text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_correct boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    quiz_id uuid NOT NULL REFERENCES public.lesson_quizzes(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    score integer NOT NULL,
    points_earned integer NOT NULL,
    passed boolean NOT NULL,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Triggers for updated_at
CREATE OR REPLACE TRIGGER trg_lesson_quizzes_updated_at BEFORE UPDATE ON public.lesson_quizzes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.lesson_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Lesson Quizzes Policies
CREATE POLICY "quizzes_select_published" ON public.lesson_quizzes FOR SELECT USING (enabled = true);
CREATE POLICY "quizzes_select_admin" ON public.lesson_quizzes FOR SELECT USING (public.get_user_role() = 'admin');
CREATE POLICY "quizzes_insert_admin" ON public.lesson_quizzes FOR INSERT WITH CHECK (public.get_user_role() = 'admin');
CREATE POLICY "quizzes_update_admin" ON public.lesson_quizzes FOR UPDATE USING (public.get_user_role() = 'admin') WITH CHECK (public.get_user_role() = 'admin');
CREATE POLICY "quizzes_delete_admin" ON public.lesson_quizzes FOR DELETE USING (public.get_user_role() = 'admin');

-- Quiz Questions Policies
CREATE POLICY "questions_select_published" ON public.quiz_questions FOR SELECT USING (published = true);
CREATE POLICY "questions_select_admin" ON public.quiz_questions FOR SELECT USING (public.get_user_role() = 'admin');
CREATE POLICY "questions_insert_admin" ON public.quiz_questions FOR INSERT WITH CHECK (public.get_user_role() = 'admin');
CREATE POLICY "questions_update_admin" ON public.quiz_questions FOR UPDATE USING (public.get_user_role() = 'admin') WITH CHECK (public.get_user_role() = 'admin');
CREATE POLICY "questions_delete_admin" ON public.quiz_questions FOR DELETE USING (public.get_user_role() = 'admin');

-- Quiz Options Policies
CREATE POLICY "options_all_admin" ON public.quiz_options USING (public.get_user_role() = 'admin') WITH CHECK (public.get_user_role() = 'admin');

-- Quiz Attempts Policies
CREATE POLICY "attempts_select_own" ON public.quiz_attempts FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "attempts_select_admin" ON public.quiz_attempts FOR SELECT USING (public.get_user_role() = 'admin');

-- Grants
GRANT ALL ON TABLE public.lesson_quizzes TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.quiz_questions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.quiz_options TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.quiz_attempts TO anon, authenticated, service_role;

-- 4. View for Public Quiz Options (Without is_correct)
CREATE OR REPLACE VIEW public.public_quiz_options AS
SELECT id, question_id, option_text, sort_order
FROM public.quiz_options;

GRANT SELECT ON public.public_quiz_options TO anon, authenticated, service_role;

-- Add 'quiz' to points_ledger source check constraint safely
ALTER TABLE public.points_ledger DROP CONSTRAINT IF EXISTS points_ledger_source_check;
ALTER TABLE public.points_ledger ADD CONSTRAINT points_ledger_source_check CHECK (source IN ('lesson', 'module', 'admin', 'quiz'));


-- 5. RPC: complete_lesson
CREATE OR REPLACE FUNCTION public.complete_lesson(p_lesson_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user uuid := auth.uid();
  v_lesson public.learning_lessons%rowtype;
  v_module public.learning_modules%rowtype;
  v_quiz public.lesson_quizzes%rowtype;
  v_passed_quiz boolean;
  v_rows integer;
  v_total_lessons integer;
  v_watched_lessons integer;
  v_already_completed boolean;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_lesson from public.learning_lessons where id = p_lesson_id and published = true;
  if not found then
    raise exception 'Lesson not available';
  end if;

  select * into v_quiz from public.lesson_quizzes where lesson_id = p_lesson_id and enabled = true;
  if found then
    select exists (
      select 1 from public.quiz_attempts 
      where quiz_id = v_quiz.id and user_id = v_user and passed = true
    ) into v_passed_quiz;
    if not v_passed_quiz then
      raise exception 'Quiz must be passed to complete this lesson';
    end if;
  end if;

  insert into public.user_lesson_progress (user_id, lesson_id, watched_at)
    values (v_user, p_lesson_id, now())
    on conflict (user_id, lesson_id) do nothing;
  
  select (completed_at is not null) into v_already_completed 
  from public.user_lesson_progress 
  where user_id = v_user and lesson_id = p_lesson_id;

  if coalesce(v_already_completed, false) then
    return;
  end if;

  update public.user_lesson_progress 
  set completed_at = now() 
  where user_id = v_user and lesson_id = p_lesson_id;

  insert into public.points_ledger (user_id, delta, source, lesson_id, reason)
    values (v_user, v_lesson.points_value, 'lesson', p_lesson_id, 'Completed lesson: ' || v_lesson.title);

  select count(*) into v_total_lessons
    from public.learning_lessons
    where module_id = v_lesson.module_id and published = true;

  select count(*) into v_watched_lessons
    from public.user_lesson_progress ulp
    join public.learning_lessons ll on ll.id = ulp.lesson_id
    where ulp.user_id = v_user and ll.module_id = v_lesson.module_id and ll.published = true
    and ulp.completed_at is not null;

  if v_total_lessons > 0 and v_watched_lessons >= v_total_lessons then
    insert into public.user_module_progress (user_id, module_id, completed_at)
      values (v_user, v_lesson.module_id, now())
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

ALTER FUNCTION public.complete_lesson(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.complete_lesson(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_lesson(uuid) TO authenticated;


-- 6. RPC: submit_quiz_attempt
CREATE OR REPLACE FUNCTION public.submit_quiz_attempt(p_quiz_id uuid, p_answers jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user uuid := auth.uid();
  v_quiz public.lesson_quizzes%rowtype;
  v_total_questions integer := 0;
  v_score integer := 0;
  v_max_score integer := 0;
  v_percentage integer := 0;
  v_passed boolean := false;
  v_points_earned integer := 0;
  v_already_passed boolean := false;
  v_q record;
  v_correct_opt uuid;
  v_user_ans uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_quiz from public.lesson_quizzes where id = p_quiz_id and enabled = true;
  if not found then
    raise exception 'Quiz not available';
  end if;

  select exists (
    select 1 from public.quiz_attempts 
    where quiz_id = p_quiz_id and user_id = v_user and passed = true
  ) into v_already_passed;

  for v_q in (select id, points from public.quiz_questions where quiz_id = p_quiz_id and published = true) loop
    v_total_questions := v_total_questions + 1;
    v_max_score := v_max_score + v_q.points;
    
    select id into v_correct_opt from public.quiz_options 
    where question_id = v_q.id and is_correct = true limit 1;

    begin
      v_user_ans := (p_answers->>v_q.id::text)::uuid;
    exception when others then
      v_user_ans := null;
    end;

    if v_user_ans is not null and v_user_ans = v_correct_opt then
      v_score := v_score + v_q.points;
    end if;
  end loop;

  if v_max_score > 0 then
    v_percentage := round((v_score::numeric / v_max_score::numeric) * 100);
  else
    v_percentage := 100;
  end if;

  if v_percentage >= v_quiz.passing_percentage then
    v_passed := true;
  end if;

  if v_passed and not v_already_passed then
    v_points_earned := v_quiz.points_value;
    insert into public.points_ledger (user_id, delta, source, reason)
      values (v_user, v_points_earned, 'quiz', 'Passed quiz: ' || v_quiz.title);
  end if;

  insert into public.quiz_attempts (quiz_id, user_id, score, points_earned, passed)
    values (p_quiz_id, v_user, v_score, v_points_earned, v_passed);

  return jsonb_build_object(
    'score', v_score,
    'max_score', v_max_score,
    'percentage', v_percentage,
    'passed', v_passed,
    'points_earned', v_points_earned
  );
end;
$$;

ALTER FUNCTION public.submit_quiz_attempt(uuid, jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.submit_quiz_attempt(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_quiz_attempt(uuid, jsonb) TO authenticated;
