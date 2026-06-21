-- 016_revoke_public_exec.sql — Defense-in-depth for the client-portal RPCs.
-- In PostgreSQL, CREATE FUNCTION grants EXECUTE to PUBLIC by default, so the earlier
-- `grant execute ... to authenticated` ADDED a role without removing the implicit
-- PUBLIC (anon) grant. These functions all key off the signed-in user's JWT, so the
-- anon role already gets nothing back — this just makes sure anon can't even invoke
-- them. (submit_message in 010 is intentionally callable by anon — left untouched.)

revoke execute on function public.ensure_client(text)            from public;
revoke execute on function public.get_my_appointments(text)      from public;
revoke execute on function public.cancel_my_appointment(uuid)    from public;
revoke execute on function public.get_my_messages(text)          from public;
revoke execute on function public.send_my_message(text, text)    from public;
revoke execute on function public.get_my_courses(text)           from public;
revoke execute on function public.get_my_course(text, uuid)      from public;
revoke execute on function public.get_my_memberships(text)       from public;

-- Re-affirm the intended grant (idempotent).
grant execute on function public.ensure_client(text)            to authenticated;
grant execute on function public.get_my_appointments(text)      to authenticated;
grant execute on function public.cancel_my_appointment(uuid)    to authenticated;
grant execute on function public.get_my_messages(text)          to authenticated;
grant execute on function public.send_my_message(text, text)    to authenticated;
grant execute on function public.get_my_courses(text)           to authenticated;
grant execute on function public.get_my_course(text, uuid)      to authenticated;
grant execute on function public.get_my_memberships(text)       to authenticated;
