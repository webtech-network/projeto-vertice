import Link from 'next/link';

// Renderizado no lugar de qualquer página dependente do Canvas quando o
// usuário está legitimamente logado (Google/GitHub/Canvas) mas não tem uma
// integração Canvas ativa — ver requireCanvasIntegration() em
// src/lib/canvasIntegration.js. Cursos ficam desabilitados, não escondidos:
// a rota continua existindo, só explica o que falta em vez de quebrar.
export default function CanvasNotConnected() {
  return (
    <main className="page">
      <div className="alert alert-info" role="status">
        <p>
          Esta funcionalidade depende de uma integração com o Canvas, que sua conta ainda não tem.
        </p>
        <p>
          <Link href="/perfil?tab=plataformas" className="btn btn-primary">
            Conectar Canvas em Perfil
          </Link>
        </p>
      </div>
    </main>
  );
}
