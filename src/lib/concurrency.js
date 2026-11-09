// Mapeia `items` com `fn` mantendo no máximo `limit` chamadas em voo e
// preservando a ordem do resultado. Para leituras do Canvas de tamanho
// variável (ex.: membros de cada grupo) — paralelo o bastante para não somar
// latências, contido o bastante para não estourar o rate limit (ADR-0016).
// Rejeita na primeira falha, como Promise.all.
export async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}
