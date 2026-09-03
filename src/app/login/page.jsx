import { redirect } from 'next/navigation';
import Image from 'next/image';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import WebTechFooter from '@/components/WebTechFooter';
import LoginButtons from '@/components/LoginButtons';
import banner from '@/assets/images/banner_og.jpeg';

const ERROR_MESSAGES = {
  state_invalido: 'Não foi possível validar o retorno do Canvas (state inválido). Tente novamente.',
  oauth_falhou: 'Falha ao concluir a autenticação. Tente novamente.',
};

export default async function LoginPage({ searchParams }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect('/');
  }

  const { error } = (await searchParams) || {};

  return (
    <main className="login-page">
      <div className="login-page-content">
        <Image src={banner} alt="Vértice" className="login-hero-banner" priority />
        <h1>Bem-vindo(a) ao Vértice</h1>
        <p>
          Um ambiente criado pelo WebTech Network para organizar e agilizar o trabalho de professores e alunos
          potencializando o processo de ensino e aprendizagem.
        </p>
        {error && (
          <div className="alert alert-error" style={{ textAlign: 'left' }}>
            {ERROR_MESSAGES[error] || 'Ocorreu um erro ao entrar.'}
          </div>
        )}
        <LoginButtons />
      </div>
      <WebTechFooter variant="bar" />
    </main>
  );
}
