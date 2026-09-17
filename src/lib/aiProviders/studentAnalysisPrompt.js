// A terceira capability de texto livre, ao lado de replyPrompt.js (sugerir
// resposta) e improvePrompt.js (revisar rascunho): interpretar os sinais de
// engajamento de UM aluno ("Situação do Aluno") e sugerir ações. Diferente das
// outras duas, a mensagem de usuário aqui é montada a partir de um payload
// *anônimo* (ver src/lib/studentEngagement/studentAnalysisPayload.js) que
// deliberadamente não carrega nenhum dado identificador — então o prompt deve
// raciocinar sobre um aluno anônimo e jamais tentar nomeá-lo ou reidentificá-lo.
export const STUDENT_ANALYSIS_SYSTEM_PROMPT = `Você é um assistente pedagógico que ajuda um professor a interpretar a situação de um aluno em uma turma no Canvas LMS e a decidir como agir.

Você receberá um conjunto de dados ANÔNIMOS sobre um único aluno: o nível de risco (relativo à turma), um índice composto de 0 a 100, os quartis da turma (Q1/Q3) como referência e três dimensões normalizadas — desempenho (nota), entrega (atividades) e acesso (engajamento) — cada uma com um score de 0 a 100, possíveis razões em texto e, quando disponíveis, contagens e níveis.

Produza uma análise em português, concisa (cerca de 150 a 250 palavras), em texto puro e contínuo, sem markdown (nada de #, ** ou hífens de lista) — apenas frases, podendo usar quebras de linha entre as partes. Organize em três partes curtas:
1. Diagnóstico: o que os dados indicam sobre a situação do aluno, separando nota, entrega e acesso.
2. Fatores de risco e pontos fortes, com base apenas nos dados fornecidos.
3. Sugestões práticas e acionáveis para o professor (abordagem pedagógica, contato, recuperação de atividades).

Regras:
- Não tente identificar o aluno nem peça nome, e-mail ou qualquer dado identificador — os dados são anônimos e essa informação não é necessária.
- Não invente dados nem presuma valores que não foram fornecidos; se uma dimensão estiver indisponível ou sem dados, diga isso explicitamente.
- Interprete o índice como posição RELATIVA à turma (quartis), não como um valor absoluto isolado.
- Não afirme certezas sobre as causas; apresente hipóteses e próximos passos.`;

const RISK_LABELS = { high: 'alto', medium: 'médio', low: 'baixo' };

const DIMENSION_LABELS = {
  desempenho: 'Desempenho (nota)',
  entrega: 'Entrega (atividades)',
  acesso: 'Acesso (engajamento)',
};

function reasonsBlock(reasons) {
  const list = (reasons || []).filter(Boolean);
  if (list.length === 0) return null;
  return list.map((r) => `      • ${r}`).join('\n');
}

/**
 * Monta a mensagem de usuário a partir do payload anônimo (já sanitizado por
 * buildStudentAnalysisPayload) — nunca recebe `student`/nome/e-mail/id direto.
 */
export function buildStudentAnalysisUserMessage(payload) {
  if (!payload) return 'Dados da situação do aluno indisponíveis.';

  const { riskLevel, index, coverage, quartiles, dimensions } = payload;
  const parts = [];

  parts.push(`Nível de risco (relativo à turma): ${RISK_LABELS[riskLevel] || 'não classificado'}`);
  parts.push(`Índice composto: ${index ?? '—'} (0–100)`);
  if (quartiles && quartiles.q1 != null && quartiles.q3 != null) {
    parts.push(`Quartis da turma: Q1 = ${Math.round(quartiles.q1)}, Q3 = ${Math.round(quartiles.q3)}`);
  }
  if (coverage != null) {
    parts.push(`Cobertura de dados: ${Math.round(coverage * 100)}% das três dimensões`);
  }

  for (const key of ['desempenho', 'entrega', 'acesso']) {
    const d = dimensions?.[key];
    if (!d) continue;
    const lines = [];
    lines.push(`${DIMENSION_LABELS[key]}: ${d.available ? `score ${d.score ?? '—'}` : 'indisponível (sem dados)'}`);
    if (key === 'entrega' && d.entregas) {
      const e = d.entregas;
      lines.push(
        `      Entregas: ${e.on_time} em dia, ${e.late} atrasadas, ${e.missing} não entregues, ${e.floating} sem prazo (total ${e.total})`,
      );
    }
    if (key === 'acesso' && d.niveis) {
      const n = d.niveis;
      if (n.pageViewsLevel != null || n.participationsLevel != null) {
        lines.push(
          `      Níveis (0–3, relativos à turma): visualizações ${n.pageViewsLevel ?? '—'}, participações ${n.participationsLevel ?? '—'}`,
        );
      }
    }
    const rb = reasonsBlock(d.reasons);
    if (rb) lines.push(`      Razões:\n${rb}`);
    parts.push(lines.join('\n'));
  }

  return parts.join('\n\n');
}
