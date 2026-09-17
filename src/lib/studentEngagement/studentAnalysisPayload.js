/**
 * A única fronteira entre os dados de engajamento da aplicação e o que vai ao
 * modelo de IA: monta, a partir de `riskResult`/`riskQuartiles`, um objeto
 * ESTRITAMENTE anônimo (whitelist explícita de campos). Nome, e-mail, login,
 * `sortable_name`, id do usuário no Canvas e timestamps absolutos (ex.:
 * `raw.lastActivityAt`) ficam de fora — inclusive porque a UI nem os envia; o
 * spread de `raw` inteiro é evitado de propósito.
 *
 * O contrato resultante carrega apenas as métricas agregadas que o professor
 * já vê na tela "Situação do Aluno(a)": scores 0–100, contagens, níveis 0–3 e
 * as strings `reasons` já anônimas produzidas por canvasSource.js.
 */
export function buildStudentAnalysisPayload({ riskResult, riskQuartiles }) {
  if (!riskResult) return null;

  const dim = riskResult.dimensions || {};
  const desempenho = dim.desempenho || {};
  const entrega = dim.entrega || {};
  const acesso = dim.acesso || {};

  const round = (n) => (typeof n === 'number' ? Math.round(n) : n);

  return {
    riskLevel: riskResult.riskLevel || null,
    index: riskResult.score != null ? Math.round(riskResult.score) : null,
    coverage: riskResult.coverage ?? null,
    quartiles: {
      q1: riskQuartiles?.q1 ?? null,
      q3: riskQuartiles?.q3 ?? null,
    },
    dimensions: {
      desempenho: {
        available: Boolean(desempenho.available),
        score: round(desempenho.score),
        reasons: desempenho.reasons || [],
      },
      entrega: {
        available: Boolean(entrega.available),
        score: round(entrega.score),
        reasons: entrega.reasons || [],
        entregas: {
          missing: entrega.raw?.missing ?? 0,
          late: entrega.raw?.late ?? 0,
          on_time: entrega.raw?.on_time ?? 0,
          floating: entrega.raw?.floating ?? 0,
          total: entrega.raw?.total ?? 0,
        },
      },
      acesso: {
        available: Boolean(acesso.available),
        score: round(acesso.score),
        reasons: acesso.reasons || [],
        niveis: {
          pageViewsLevel: acesso.raw?.pageViewsLevel ?? null,
          participationsLevel: acesso.raw?.participationsLevel ?? null,
        },
      },
    },
  };
}
