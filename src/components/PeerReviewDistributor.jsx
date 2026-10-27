'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle, RotateCcw, Send, Shuffle, Trash2 } from 'lucide-react';
import { planPeerReviews, diffPeerReviews } from '@/lib/peerReviewDistribution';

function randomSeed() {
  return Math.floor(Math.random() * 2 ** 31);
}

function byName(names) {
  return (a, b) => (names[a] || '').localeCompare(names[b] || '', 'pt-BR');
}

// See specs/capabilities/peer-review-distribution.md. The plan is computed
// client-side (pure, instant on every change of group set / N / seed) and
// only touches Canvas on "Aplicar no Canvas", one request at a time.
export default function PeerReviewDistributor({
  courseId,
  assignmentId,
  defaultCount,
  automaticPeerReviews,
  categories,
  defaultCategoryId,
  initialGroups,
  delivered,
  studentNames,
  peerReviews,
}) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [groupsByCategory, setGroupsByCategory] = useState(() =>
    defaultCategoryId ? { [defaultCategoryId]: initialGroups } : {},
  );
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupsError, setGroupsError] = useState(null);
  const [count, setCount] = useState(defaultCount);
  const [seed, setSeed] = useState(randomSeed);
  const [confirmCompleted, setConfirmCompleted] = useState(false);
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState(null); // { done, total }
  const [failures, setFailures] = useState([]); // [{ op, error }]

  const groups = categoryId ? groupsByCategory[categoryId] : null;

  async function selectCategory(nextId) {
    const id = nextId ? Number(nextId) : null;
    setCategoryId(id);
    setConfirmCompleted(false);
    setGroupsError(null);
    if (!id || groupsByCategory[id]) return;
    setLoadingGroups(true);
    try {
      const response = await fetch(`/api/canvas/courses/${courseId}/group-categories/${id}/groups`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Falha ao carregar os grupos.');
      setGroupsByCategory((prev) => ({ ...prev, [id]: data.groups }));
    } catch (err) {
      setGroupsError(err.message);
    } finally {
      setLoadingGroups(false);
    }
  }

  const groupOfUser = useMemo(() => {
    const map = new Map();
    for (const group of groups || []) {
      for (const memberId of group.memberIds) map.set(memberId, group);
    }
    return map;
  }, [groups]);

  const participants = useMemo(
    () => delivered.map((d) => ({ ...d, groupId: groupOfUser.get(d.userId)?.id ?? null })),
    [delivered, groupOfUser],
  );
  const ungrouped = participants.filter((p) => p.groupId == null);

  const k = Math.max(1, Math.min(Number(count) || 1, Math.max(1, participants.length - 1)));

  const plan = useMemo(
    () => (groups ? planPeerReviews({ participants, k, seed }) : null),
    [groups, participants, k, seed],
  );
  const diff = useMemo(() => (plan ? diffPeerReviews(peerReviews, plan.pairs) : null), [plan, peerReviews]);
  const completedToDelete = diff ? diff.toDelete.filter((d) => d.completed) : [];

  const rows = useMemo(() => {
    if (!plan) return [];
    const reviews = new Map(participants.map((p) => [p.userId, []]));
    const reviewedBy = new Map(participants.map((p) => [p.userId, []]));
    for (const pair of plan.pairs) {
      reviews.get(pair.reviewerId).push(pair.revieweeId);
      reviewedBy.get(pair.revieweeId).push(pair.reviewerId);
    }
    return participants
      .map((p) => ({
        userId: p.userId,
        groupName: groupOfUser.get(p.userId)?.name ?? '— sem grupo —',
        reviews: reviews.get(p.userId).sort(byName(studentNames)),
        reviewedBy: reviewedBy.get(p.userId).sort(byName(studentNames)),
      }))
      .sort((a, b) => a.groupName.localeCompare(b.groupName, 'pt-BR') || byName(studentNames)(a.userId, b.userId));
  }, [plan, participants, groupOfUser, studentNames]);

  function nameOf(userId) {
    return studentNames[userId] || `Aluno ${userId}`;
  }

  async function runOps(ops) {
    setApplying(true);
    setFailures([]);
    setProgress({ done: 0, total: ops.length });
    const failed = [];
    // Sequential, not Promise.all — same concurrent-Canvas-call race this
    // app avoids on every other multi-request flow.
    for (let i = 0; i < ops.length; i += 1) {
      const op = ops[i];
      try {
        const response = await fetch(`/api/canvas/courses/${courseId}/assignments/${assignmentId}/peer-reviews`, {
          method: op.method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ submissionId: op.submissionId, userId: op.reviewerId }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Falha (${response.status}).`);
      } catch (err) {
        failed.push({ op, error: err.message });
      }
      setProgress({ done: i + 1, total: ops.length });
    }
    setFailures(failed);
    setApplying(false);
    setConfirmCompleted(false);
    // Re-reads the Canvas peer reviews server-side; the plan (same seed)
    // stays, so a fully successful run leaves an empty diff.
    router.refresh();
  }

  function apply() {
    if (!diff) return;
    const total = diff.toDelete.length + diff.toCreate.length;
    if (total === 0) return;
    if (
      !window.confirm(
        `Aplicar a distribuição no Canvas? Serão removidas ${diff.toDelete.length} e criadas ${diff.toCreate.length} avaliações por pares.`,
      )
    ) {
      return;
    }
    runOps([
      ...diff.toDelete.map((d) => ({ method: 'DELETE', ...d })),
      ...diff.toCreate.map((c) => ({ method: 'POST', ...c })),
    ]);
  }

  function removeAll() {
    if (peerReviews.length === 0) return;
    const completed = peerReviews.filter((r) => r.workflow_state === 'completed').length;
    const warning = completed > 0 ? ` ${completed} já concluída(s): o trabalho desses alunos será perdido.` : '';
    if (
      !window.confirm(
        `Remover TODA a distribuição no Canvas? Serão removidas ${peerReviews.length} avaliações por pares.${warning}`,
      )
    ) {
      return;
    }
    runOps(
      peerReviews.map((r) => ({
        method: 'DELETE',
        reviewerId: r.assessor_id,
        revieweeId: r.user_id,
        submissionId: r.asset_id,
      })),
    );
  }

  const pendingChanges = diff ? diff.toDelete.length + diff.toCreate.length : 0;
  const canApply =
    !applying && !loadingGroups && pendingChanges > 0 && (completedToDelete.length === 0 || confirmCompleted);

  return (
    <div className="peer-review-distributor">
      {automaticPeerReviews && (
        <p className="alert alert-warning" role="alert">
          A atribuição automática de avaliações por pares está ligada nesta atividade: o Canvas pode atribuir novas
          revisões na data configurada, ignorando os grupos. Desligue-a nas configurações da atividade.
        </p>
      )}

      <div className="browser-controls peer-review-toolbar">
        {categories.length > 1 && (
          <label className="peer-review-field">
            Conjunto de grupos
            <select
              value={categoryId ?? ''}
              onChange={(e) => selectCategory(e.target.value)}
              disabled={applying || loadingGroups}
            >
              {!categoryId && <option value="">Selecione…</option>}
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="peer-review-field">
          Revisões por aluno
          <input
            type="number"
            min={1}
            max={Math.max(1, participants.length - 1)}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            disabled={applying}
          />
        </label>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setSeed(randomSeed())}
          disabled={applying || !groups}
          title="Sortear outra distribuição"
        >
          <Shuffle size={16} strokeWidth={1.8} />
          Redistribuir
        </button>
        <button type="button" className="btn btn-primary" onClick={apply} disabled={!canApply}>
          {applying ? <LoaderCircle size={16} strokeWidth={1.8} className="sync-spin" /> : <Send size={16} strokeWidth={1.8} />}
          {applying ? `Aplicando… ${progress?.done ?? 0}/${progress?.total ?? 0}` : 'Aplicar no Canvas'}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={removeAll}
          disabled={applying || peerReviews.length === 0}
          title="Apagar todas as avaliações por pares desta atividade no Canvas"
        >
          <Trash2 size={16} strokeWidth={1.8} />
          Remover distribuição
        </button>
      </div>

      {groupsError && (
        <p className="alert alert-error" role="alert">
          {groupsError}
        </p>
      )}

      {!categoryId ? (
        <p className="lede">Escolha o conjunto de grupos que define quem não pode avaliar quem.</p>
      ) : loadingGroups || !groups ? (
        <p className="lede">Carregando grupos…</p>
      ) : participants.length < 2 ? (
        <p className="lede">É preciso pelo menos dois alunos com entrega para distribuir a avaliação por pares.</p>
      ) : (
        <>
          <div className="stat-tile-grid peer-review-stats">
            <div className="stat-tile">
              <span className="stat-tile-label">Participantes</span>
              <span className="stat-tile-value">{participants.length}</span>
              <span className="stat-tile-sub">{plan.groupCount} grupos</span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile-label">Manter</span>
              <span className="stat-tile-value">{diff.keep.length}</span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile-label">Criar</span>
              <span className="stat-tile-value">{diff.toCreate.length}</span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile-label">Remover</span>
              <span className="stat-tile-value">{diff.toDelete.length}</span>
              {completedToDelete.length > 0 && (
                <span className="stat-tile-sub">{completedToDelete.length} já concluídas</span>
              )}
            </div>
          </div>

          {ungrouped.length > 0 && (
            <p className="alert alert-info">
              {ungrouped.length} aluno(s) com entrega fora de qualquer grupo deste conjunto — tratados como grupo
              individual: {ungrouped.map((p) => nameOf(p.userId)).join(', ')}.
            </p>
          )}

          {plan.deficits.length > 0 && (
            <div className="alert alert-warning" role="alert">
              Não é possível dar {k} revisões a todos sem que alguém avalie o próprio grupo (algum grupo é grande
              demais para o total de participantes). Alunos abaixo da meta:
              <ul>
                {plan.deficits.map((d) => (
                  <li key={d.userId}>
                    {nameOf(d.userId)} — faz {d.given}, recebe {d.received}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {completedToDelete.length > 0 && (
            <div className="alert alert-error" role="alert">
              {completedToDelete.length} avaliação(ões) já concluída(s) serão removidas — o trabalho desses alunos será
              perdido:
              <ul>
                {completedToDelete.map((d) => (
                  <li key={`${d.reviewerId}:${d.revieweeId}`}>
                    {nameOf(d.reviewerId)} → {nameOf(d.revieweeId)}
                  </li>
                ))}
              </ul>
              <label className="checkbox-filter">
                <input
                  type="checkbox"
                  checked={confirmCompleted}
                  onChange={(e) => setConfirmCompleted(e.target.checked)}
                />
                Entendo e quero remover as avaliações concluídas
              </label>
            </div>
          )}

          {failures.length > 0 && (
            <div className="alert alert-error" role="alert">
              {failures.length} operação(ões) falharam:
              <ul>
                {failures.map(({ op, error }) => (
                  <li key={`${op.method}:${op.reviewerId}:${op.revieweeId}`}>
                    {op.method === 'DELETE' ? 'Remover' : 'Criar'} {nameOf(op.reviewerId)} → {nameOf(op.revieweeId)}:{' '}
                    {error}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => runOps(failures.map((f) => f.op))}
                disabled={applying}
              >
                <RotateCcw size={14} strokeWidth={1.8} />
                Tentar novamente
              </button>
            </div>
          )}

          {pendingChanges === 0 && failures.length === 0 && (
            <p className="alert alert-success">A distribuição no Canvas já corresponde a este plano.</p>
          )}

          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>Grupo</th>
                  <th>Avalia</th>
                  <th>Avaliado por</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.userId}>
                    <td>{nameOf(row.userId)}</td>
                    <td>{row.groupName}</td>
                    <td>{row.reviews.map(nameOf).join('; ') || '—'}</td>
                    <td>{row.reviewedBy.map(nameOf).join('; ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
