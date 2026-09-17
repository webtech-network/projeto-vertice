import { computeCanvasDimensions } from './canvasSource';
import { computeIndex, computeQuartiles, classifyRisk, DEFAULT_WEIGHTS } from './scoring';

/**
 * Calcula o índice composto e o nível de risco (relativo aos quartis da
 * turma) de todos os alunos ativos de uma turma, a partir das linhas do
 * relatório e dos resumos de Analytics. É o mesmo cálculo de
 * StudentReport.jsx's "Analisar situação dos alunos" — extraído para cá
 * para ser reusado pelo StudentEngagementDashboard, que precisa do risco
 * (para a análise por IA) assim que o painel abre, sem depender de o
 * professor ter clicado no botão de análise em nível de turma.
 *
 * `rows` são as linhas de buildStudentRows; `summaries` é a resposta de
 * getStudentSummaries (pode ser null/[]). Devolve `{ results, quartiles }`,
 * em que `results` é um Map(studentId -> { score, coverage, riskLevel,
 * dimensions }) — sem `previousScore`, que é responsabilidade do chamador
 * (vem dos snapshots e só interessa à seta de tendência).
 */
export function computeClassRiskResults(rows, summaries) {
  const summaryById = new Map((summaries || []).map((s) => [s.id, s]));
  const activeRows = rows.filter((r) => r.enrollmentState !== 'inactive');

  const computed = activeRows.map((row) => {
    const dimensions = computeCanvasDimensions({ row, summary: summaryById.get(row.id) });
    const { score, coverage } = computeIndex(dimensions, DEFAULT_WEIGHTS);
    return { studentId: row.id, dimensions, score, coverage };
  });

  const eligibleScores = computed.filter((c) => c.coverage > 0).map((c) => c.score);
  const quartiles = computeQuartiles(eligibleScores);

  const results = new Map();
  for (const c of computed) {
    results.set(c.studentId, {
      score: c.score,
      coverage: c.coverage,
      riskLevel: c.coverage > 0 ? classifyRisk(c.score, quartiles) : null,
      dimensions: c.dimensions,
    });
  }

  return { results, quartiles };
}
