import { NextResponse } from 'next/server';
import { requireCanvasIntegration } from '@/lib/canvasIntegration';

// Usado por CanvasConnection.jsx (aba "Plataformas associadas" de /perfil)
// pra saber se o usuário atual já tem o Canvas conectado — nunca lê
// `public.integrations` direto no client, essa tabela não tem policy de
// RLS pra authenticated de propósito (ver 05_rls.sql).
export async function GET() {
  const { user, canvas } = await requireCanvasIntegration();
  if (!user) {
    return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
  }
  if (!canvas) {
    return NextResponse.json({ connected: false });
  }
  return NextResponse.json({
    connected: true,
    baseUrl: canvas.baseUrl,
    displayName: canvas.displayName,
    avatarUrl: canvas.avatarUrl,
  });
}
