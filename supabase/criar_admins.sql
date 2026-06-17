-- Apaga e recria os usuários admin já CONFIRMADOS, direto no banco.
-- Rode no Supabase → SQL Editor.
-- ⚠️ Pré-requisito: o provedor "Email" precisa estar ATIVADO em
--    Authentication → Sign In / Providers → Email, senão o login dá
--    "Email logins are disabled" mesmo com o usuário criado.

create extension if not exists pgcrypto;

do $$
declare
  emails text[] := array[
    'tjfleck@gmail.com',
    'nenahprezzi@gmail.com',
    'nenahprezzi01@gmail.com'
  ];
  senha text := 'Opt351@@';   -- senha de todos os admins (troque se quiser)
  em    text;
  uid   uuid;
begin
  foreach em in array emails loop
    -- Remove o usuário existente (cascateia para auth.identities).
    delete from auth.users where email = em;

    uid := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      raw_app_meta_data, raw_user_meta_data
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      em, crypt(senha, gen_salt('bf')),
      now(), now(), now(),
      '', '', '', '',
      '{"provider":"email","providers":["email"]}', '{}'
    );

    insert into auth.identities (
      provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      uid::text, uid,
      jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true),
      'email', now(), now(), now()
    );
  end loop;
end $$;

-- Conferência:
select email, email_confirmed_at from auth.users
where email in ('tjfleck@gmail.com','nenahprezzi@gmail.com','nenahprezzi01@gmail.com');
