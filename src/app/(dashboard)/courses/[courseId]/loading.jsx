// Resposta imediata ao navegar para um curso ou para as páginas aninhadas
// que ainda buscam o Canvas no servidor (correção, pares, importação) —
// ADR-0016. O shell (Sidebar/Topbar) segue montado; só o conteúdo espera.
export default function CourseLoading() {
  return (
    <main className="page" aria-busy="true">
      <p className="lede">Carregando…</p>
    </main>
  );
}
