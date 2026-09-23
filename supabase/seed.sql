-- Local test stack only (docs/adr/0063). `supabase start` and `supabase db reset`
-- run this after the migrations; nothing here ever reaches the hosted project.
--
-- One owner, signed in with email + password. The id is fixed so the test env
-- can name it as OWNER_USER_ID (test/integration/stack.ts). The empty-string
-- token columns are not decoration: GoTrue scans them into Go strings and
-- fails the sign-in on a NULL.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '0b0e0000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated',
  'owner@dispatch.test',
  extensions.crypt('dispatch-local-owner', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}', '{}',
  now(), now(),
  '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  '0b0e0000-0000-4000-8000-000000000001',
  '0b0e0000-0000-4000-8000-000000000001',
  jsonb_build_object(
    'sub', '0b0e0000-0000-4000-8000-000000000001',
    'email', 'owner@dispatch.test',
    'email_verified', true
  ),
  'email', now(), now(), now()
);
