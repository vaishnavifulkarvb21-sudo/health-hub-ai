
-- Seed demo users directly into auth.users (bypasses signup validation)
DO $$
DECLARE
  admin_id uuid;
  user_id uuid;
BEGIN
  -- Demo Admin
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@demo.com') THEN
    admin_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated',
      'admin@demo.com', crypt('admin123', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo Admin"}',
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), admin_id, jsonb_build_object('sub', admin_id::text, 'email', 'admin@demo.com'), 'email', admin_id::text, now(), now(), now());
    INSERT INTO public.profiles (id, full_name, email) VALUES (admin_id, 'Demo Admin', 'admin@demo.com')
      ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (admin_id, 'admin')
      ON CONFLICT DO NOTHING;
  ELSE
    SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@demo.com';
    UPDATE auth.users SET encrypted_password = crypt('admin123', gen_salt('bf')), email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE id = admin_id;
    INSERT INTO public.user_roles (user_id, role) VALUES (admin_id, 'admin') ON CONFLICT DO NOTHING;
  END IF;

  -- Demo User
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'user@demo.com') THEN
    user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', user_id, 'authenticated', 'authenticated',
      'user@demo.com', crypt('user123', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Demo User"}',
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), user_id, jsonb_build_object('sub', user_id::text, 'email', 'user@demo.com'), 'email', user_id::text, now(), now(), now());
    INSERT INTO public.profiles (id, full_name, email) VALUES (user_id, 'Demo User', 'user@demo.com')
      ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (user_id, 'user')
      ON CONFLICT DO NOTHING;
  ELSE
    SELECT id INTO user_id FROM auth.users WHERE email = 'user@demo.com';
    UPDATE auth.users SET encrypted_password = crypt('user123', gen_salt('bf')), email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE id = user_id;
  END IF;
END $$;
