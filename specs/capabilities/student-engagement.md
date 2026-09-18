---
title: Engajamento do aluno (Situação + Nível de Risco)
status: implemented
domain: canvas
updated: 2026-09-17
---

# Engajamento do aluno

> Duas peças complementares sobre o Analytics do Canvas: os gauges "Situação do Aluno"
> (sempre disponíveis) e a classificação "Nível de Risco" (relativa à turma, sob demanda),
> mais histórico diário e "Análise com IA".

## Comportamento

- **Situação do Aluno** (`StudentEngagementDashboard.jsx`): aberto pelo botão gauge na coluna
  Ações de `StudentReport.jsx` (um aberto por vez). Gauges semicírculo (tempo de acesso, nota
  atual, atividades entregues, último acesso — espectro verde→vermelho contínuo), donut de
  atrasos e barras page_views/participations vs média da turma.
- **Nível de Risco** (coluna entre Status e Última atividade): só roda quando o professor clica
  "Analisar situação dos alunos". `computeClassRiskResults` → dimensões normalizadas
  (`desempenho`, `entrega`, `acesso` em 0-100) → índice composto (pesos iguais fixos,
  renormalizado só pelas dimensões disponíveis) → quartis → rótulo (`high`/`medium`/`low`).
- **Bandas relativas à turma**, não cortes absolutos: o rótulo pode mudar entre duas análises
  sem o score próprio mexer muito, se a turma mexeu mais — comportamento intencional.
- **Histórico**: `student_engagement_snapshots` (1 por aluno por dia, upsert). `weights_used`
  e `quartiles` congelados por linha.
- **Análise com IA**: `StudentEngagementDashboard.jsx` chama `analyzeStudent` (integração
  default) com payload **anonimizado** (só agregados/counts/níveis — nunca nome/e-mail/id).
- `getStudentSummaries` (curso inteiro) e os writes degradam graciosamente quando o Analytics
  não está habilitado (404/403) — cai para as dimensões disponíveis.

## Arquivos-chave

- [StudentReport.jsx](src/components/StudentReport.jsx) ·
  [StudentEngagementDashboard.jsx](src/components/StudentEngagementDashboard.jsx) ·
  [EngagementHistoryChart.jsx](src/components/EngagementHistoryChart.jsx) ·
  [RiskLevelPill.jsx](src/components/RiskLevelPill.jsx) · `src/lib/studentEngagement/`
  (`canvasSource.js`, `scoring.js`, `computeClassRisk.js`, `studentEngagementRepo.js`,
  `studentAnalysisPayload.js`) · [studentReport.js](src/lib/studentReport.js).

## Contratos

- [canvas-api.md](../contracts/canvas-api.md) — `getStudentSummaries`, `getStudentAssignmentAnalytics`.
- [ai-adapter-contract.md](../contracts/ai-adapter-contract.md) — `analyzeStudent`.

## Dados e persistência

- `student_engagement_snapshots` (RLS select/insert/update own; sem DELETE; `update` existe só
  por causa do upsert). Ver [supabase-schema.md](../contracts/supabase-schema.md).

## Decisões

- Pesos iguais fixos (sem customização por professor/curso) — ver `InfoHint` "Como o Nível de
  Risco é calculado".

## Dependências

- [course-workspace.md](course-workspace.md) · [ai-integrations.md](ai-integrations.md)
