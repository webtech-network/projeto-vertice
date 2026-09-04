// Loga o payload exato enviado a cada provedor de IA — visível via
// `docker compose logs -f app` (ou o terminal do `next dev`) — pra depurar
// custo/latência inesperados sem precisar instrumentar cada adapter na mão.
// Nunca loga a chave de API: ela vai sempre no header Authorization, nunca
// no corpo da requisição, que é o único argumento logado aqui.
export function logAiRequest(driverId, url, payload) {
  console.log(`[ai:${driverId}] POST ${url}`, JSON.stringify(payload));
}
