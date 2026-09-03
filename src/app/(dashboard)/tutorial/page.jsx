import Image from 'next/image';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { getDisplayName } from '@/lib/supabaseUserDisplay';
import banner from '@/assets/images/banner_og.jpeg';
import TutorialExplorer from '@/components/TutorialExplorer';

export default async function TutorialPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null; // proxy already redirects unauthenticated requests to /login
  }

  const firstName = getDisplayName(user)?.split(' ')[0];

  return (
    <main className="page tutorial-page">
      <div className="tutorial-banner">
        <Image src={banner} alt="Vértice" priority />
      </div>

      <h1>Bem-vindo(a){firstName ? `, ${firstName}` : ''}!</h1>
      <p className="lede">
        O Vértice é uma aplicação criada pelo WebTech Network para organizar sua rotina pessoal e acadêmica com
        menos trabalho manual: tarefas, projetos e ambientes seus, mais — quando você conecta o Canvas — um painel
        com o que importa de cada curso, geração de questões com IA já prontas para importar, e uma caixa de
        mensagens mais fácil de acompanhar. Escolha uma funcionalidade abaixo para ver como ela funciona.
      </p>

      <TutorialExplorer />
    </main>
  );
}
