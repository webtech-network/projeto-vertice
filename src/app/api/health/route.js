import { NextResponse } from 'next/server';

// Deliberadamente fora do matcher de src/proxy.js — precisa responder sem
// sessão para servir de healthcheck do container Docker (ver docker-compose.yml).
export async function GET() {
  return NextResponse.json({ ok: true });
}
