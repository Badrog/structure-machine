-- Evalis : schéma Supabase (à exécuter une fois dans SQL Editor)
-- Les données sont stockées en JSONB pour rester alignées avec les types du front-end.

create table if not exists quizzes (
  id          text primary key,
  pin         text not null unique,           -- PIN normalisé (majuscules, sans '#')
  status      text not null default 'draft',  -- draft | active | completed
  data        jsonb not null,
  created_at  timestamptz not null default now()
);

create table if not exists students (
  id          text primary key,
  data        jsonb not null,
  created_at  timestamptz not null default now()
);

create table if not exists submissions (
  id          text primary key,               -- "<quizId>:<nom-normalisé>"
  quiz_id     text not null references quizzes(id) on delete cascade,
  status      text not null default 'active', -- active | completed
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);
create index if not exists submissions_quiz_idx on submissions(quiz_id);

-- Variantes d'une interrogation (ex. 30 variantes par groupe) : une ligne par variante,
-- pour que le suivi en direct ne recharge jamais tout le contenu.
create table if not exists quiz_variants (
  quiz_id     text not null references quizzes(id) on delete cascade,
  variant_id  text not null,
  data        jsonb not null,
  primary key (quiz_id, variant_id)
);

-- Sécurité : seules les fonctions serverless (clé service_role) accèdent aux tables.
-- RLS activé SANS policy => la clé publique (anon) ne peut rien lire ni écrire.
alter table quizzes     enable row level security;
alter table students    enable row level security;
alter table submissions enable row level security;
alter table quiz_variants enable row level security;
