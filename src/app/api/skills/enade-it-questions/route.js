import path from 'node:path';
import AdmZip from 'adm-zip';
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';

// Backs the "Baixar skill" button on the Questões screen. Zips the tracked
// skills/enade-it-questions/ folder (SKILL.md + references/) on every
// request instead of shipping a pre-built binary, so the downloaded
// .skill file can never drift out of sync with the folder's own content —
// the same folder src/lib/aiProviders/shared.js's SYSTEM_PROMPT is manually
// condensed from and checked against (see CLAUDE.md).
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sessão inválida. Faça login novamente.' }, { status: 401 });
  }

  const skillDir = path.join(process.cwd(), 'skills', 'enade-it-questions');
  const zip = new AdmZip();
  zip.addLocalFolder(skillDir, 'enade-it-questions');
  const buffer = zip.toBuffer();

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="enade-it-questions.skill"',
      'Content-Length': String(buffer.length),
    },
  });
}
