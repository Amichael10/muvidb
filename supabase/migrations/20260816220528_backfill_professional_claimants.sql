-- Existing fan accounts with a profile claim should return to the persistent
-- professional claim tracker after their next login.
update public.users u
set role = case when u.role = 'fan' then 'professional'::public.user_role else u.role end,
    account_intent = 'professional',
    professional_roles = case
      when 'actor' = any(u.professional_roles) then u.professional_roles
      else array_append(u.professional_roles, 'actor')
    end,
    professional_onboarding_status = case
      when exists (
        select 1 from public.profile_claims c
        where c.user_id = u.id and c.status = 'approved'
      ) then 'verified'
      when exists (
        select 1 from public.profile_claims c
        where c.user_id = u.id and c.status = 'pending'
      ) then 'claim_pending'
      else u.professional_onboarding_status
    end,
    updated_at = now()
where exists (
  select 1 from public.profile_claims c where c.user_id = u.id
);
