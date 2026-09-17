-- public.student_engagement_snapshots — histórico do índice de risco por
-- aluno (ver a aba "Alunos" do curso, StudentReport.jsx). Um registro por
-- cálculo sob demanda, no máximo um por aluno por dia (constraint unique
-- abaixo + upsert em src/lib/studentEngagement/studentEngagementRepo.js).
-- Não é segredo — mesmo grupo de RLS de workspaces/ui_preferences (dono só
-- enxerga e escreve o próprio dado), sem a indireção de RPC SECURITY
-- DEFINER que ai_integrations usa só por causa do Vault.
--
-- Arquivo manual porque este banco já foi inicializado (init scripts só
-- rodam uma vez, na criação do volume) — a mesma DDL também foi adicionada a
-- volumes/db/init/04_schema.sql e volumes/db/init/05_rls.sql pra instalações
-- novas terem isso de cara, sem precisar deste passo manual.
--
-- Rode depois que os 5 serviços estiverem saudáveis:
--   docker compose exec -T db psql -U postgres -d postgres < volumes/db/manual/12_engagement.sql

create table public.student_engagement_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id bigint not null,
  student_id bigint not null,
  -- Data do cálculo (não o timestamp) é o que a constraint unique usa pra
  -- limitar a 1 snapshot/aluno/dia — rodar "Analisar engajamento" várias
  -- vezes no mesmo dia atualiza a linha do dia em vez de duplicar.
  snapshot_date date not null default current_date,
  computed_at timestamptz not null default now(),
  score numeric not null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high')),
  coverage numeric not null,
  -- {desempenho:{score,available,raw,reasons}, entrega:{...}, acesso:{...}}
  dimensions jsonb not null,
  -- Pesos fixos vigentes em src/lib/studentEngagement/scoring.js no momento
  -- deste cálculo — congelado por linha, não configurável hoje. Existe pra
  -- auditoria/interpretação futura caso os pesos default mudem no código.
  weights_used jsonb not null,
  -- {q1, q3} da distribuição da turma ativa naquele cálculo — é o que
  -- explica por que risk_level saiu como saiu (faixas são relativas à
  -- turma, não um corte absoluto — ver scoring.js's classifyRisk).
  quartiles jsonb not null,
  source text not null default 'canvas',
  unique (user_id, course_id, student_id, snapshot_date)
);

create index student_engagement_snapshots_lookup_idx
  on public.student_engagement_snapshots (user_id, course_id, student_id, snapshot_date desc);

alter table public.student_engagement_snapshots enable row level security;

-- Sem policy de DELETE — é um log apensado, sem exclusão física. UPDATE
-- precisa de policy mesmo sendo só um log: Postgres exige as policies de
-- INSERT *e* UPDATE pra um "insert ... on conflict (...) do update" sob RLS
-- (o branch de conflito é avaliado como um UPDATE de verdade) — é assim que
-- o upsert de "1 snapshot por aluno por dia" em studentEngagementRepo.js
-- consegue atualizar a linha do dia em vez de duplicar.
create policy "select own" on public.student_engagement_snapshots
  for select using (auth.uid() = user_id);
create policy "insert own" on public.student_engagement_snapshots
  for insert with check (auth.uid() = user_id);
create policy "update own" on public.student_engagement_snapshots
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
