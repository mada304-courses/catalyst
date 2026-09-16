-- CATALYST Upgrade Migration 004
-- Learning Hub Completion Fix
-- Adds video_started_at verification

-- 1. Add video_started_at to user_lesson_progress
ALTER TABLE public.user_lesson_progress ADD COLUMN IF NOT EXISTS video_started_at timestamp with time zone;

-- 2. RPC: record_lesson_video_start
CREATE OR REPLACE FUNCTION public.record_lesson_video_start(p_lesson_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user uuid := auth.uid();
  v_lesson public.learning_lessons%rowtype;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_lesson from public.learning_lessons where id = p_lesson_id and published = true;
  if not found then
    raise exception 'Lesson not available';
  end if;

  insert into public.user_lesson_progress (user_id, lesson_id, video_started_at)
    values (v_user, p_lesson_id, now())
    on conflict (user_id, lesson_id) do update
    set video_started_at = coalesce(public.user_lesson_progress.video_started_at, now());
end;
$$;

ALTER FUNCTION public.record_lesson_video_start(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.record_lesson_video_start(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_lesson_video_start(uuid) TO authenticated;


-- 3. Replace complete_lesson to require video_started_at
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
  v_video_started timestamp with time zone;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_lesson from public.learning_lessons where id = p_lesson_id and published = true;
  if not found then
    raise exception 'Lesson not available';
  end if;
  
  -- Check video started
  select video_started_at, (completed_at is not null) into v_video_started, v_already_completed 
  from public.user_lesson_progress 
  where user_id = v_user and lesson_id = p_lesson_id;

  if coalesce(v_already_completed, false) then
    return; -- Idempotent
  end if;

  if v_lesson.youtube_url is not null and v_lesson.youtube_url != '' and v_video_started is null then
    raise exception 'Video must be started to complete this lesson';
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

  insert into public.user_lesson_progress (user_id, lesson_id, completed_at, watched_at)
    values (v_user, p_lesson_id, now(), now())
    on conflict (user_id, lesson_id) do update
    set completed_at = now(), watched_at = coalesce(public.user_lesson_progress.watched_at, now());

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
