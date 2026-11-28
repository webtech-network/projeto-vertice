function StatTile({ label, value, sub, loading, stale, failed }) {
  return (
    <div className={`stat-tile${stale ? ' is-stale' : ''}`}>
      <span className="stat-tile-label">{label}</span>
      <span className="stat-tile-value" title={failed ? 'Não foi possível carregar' : undefined}>
        {loading ? '…' : value == null ? '—' : value}
      </span>
      {sub && !loading && value != null && <span className="stat-tile-sub">{sub}</span>}
    </div>
  );
}

export default function DashboardStats({ courses, students, messages, grading, todo, loading, stale, viewRole = 'teacher' }) {
  const isTeacher = viewRole !== 'student';
  return (
    <div className="stat-tile-grid">
      <StatTile label="Disciplinas ativas" value={courses?.total} loading={loading} stale={stale} />
      {isTeacher && <StatTile label="Alunos ao todo" value={students?.total} loading={loading} stale={stale} />}
      <StatTile
        label="Mensagens pendentes"
        value={messages?.pendingCount}
        failed={Boolean(messages) && messages.pendingCount == null}
        loading={loading}
        stale={stale}
      />
      {isTeacher && (
        <StatTile
          label="Pendências a corrigir"
          value={grading?.pendingGradingSum}
          sub={grading?.pendingAssignmentsCount ? `${grading.pendingAssignmentsCount} atividade(s)` : null}
          failed={Boolean(grading) && grading.pendingGradingSum == null}
          loading={loading}
          stale={stale}
        />
      )}
      {!isTeacher && (
        <StatTile
          label="Pendências a fazer"
          value={todo?.total}
          failed={Boolean(todo) && todo.total == null}
          loading={loading}
          stale={stale}
        />
      )}
    </div>
  );
}
