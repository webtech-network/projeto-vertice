import { GraduationCap, Sparkles, Mail, Settings, Landmark, ListChecks, LogIn } from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import WebTechFooter from '@/components/WebTechFooter';

export default async function SobrePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null; // proxy já redireciona requests não autenticados pra /login
  }

  return (
    <main className="page">
      <h1>Sobre o Vértice</h1>
      <p className="lede cover-tagline">
        Um painel único de organização pessoal e acadêmica — tarefas, projetos e ambientes são seus, sempre; cursos,
        mensagens e correções do Canvas entram quando você conecta sua conta — com apoio de IA em cada etapa, usando
        a própria chave de API de cada usuário.
      </p>

      <div className="cover-features-inner">
        <div className="cover-feature-group">
          <h3>
            <ListChecks size={18} strokeWidth={1.8} className="cover-feature-icon" aria-hidden="true" />
            Tarefas, projetos e ambientes
          </h3>
          <ul>
            <li>Quadro Kanban (por status) e matriz de Eisenhower (por importância x urgência) para suas tarefas.</li>
            <li>Projetos pessoais ou vinculados a um curso do Canvas, agrupados opcionalmente em ambientes.</li>
            <li>
              Ambientes reúnem projetos e cursos num mesmo contexto (ex.: uma disciplina, um semestre) — filtre o
              painel inteiro por um ambiente de cada vez.
            </li>
            <li>Tudo salvo na sua conta, disponível em qualquer dispositivo em que você entrar.</li>
          </ul>
        </div>

        <div className="cover-feature-group">
          <h3>
            <LogIn size={18} strokeWidth={1.8} className="cover-feature-icon" aria-hidden="true" />
            Login e integrações
          </h3>
          <ul>
            <li>Entre com Google, GitHub ou Canvas — a conta é sua independente da instituição.</li>
            <li>
              O Canvas é uma integração opcional: conecte em Perfil para habilitar cursos, atividades, mensagens e
              importação de questões; sem ela, o resto do painel funciona normalmente.
            </li>
          </ul>
        </div>

        <div className="cover-feature-group">
          <h3>
            <GraduationCap size={18} strokeWidth={1.8} className="cover-feature-icon" aria-hidden="true" />
            Cursos e atividades (com o Canvas conectado)
          </h3>
          <ul>
            <li>
              Painel de cursos com favoritos, filtros e busca, trazendo status de publicação, pendências de correção
              e mensagens de cada disciplina direto do Canvas.
            </li>
            <li>Lista de atividades por curso, com atalho para corrigir com rubrica ou importar questões nos quizzes clássicos.</li>
            <li>
              Correção por rubrica: uma tabela com todos os alunos, nota por critério e envio em lote — populando o
              recurso de rubrica do próprio Canvas, não só um comentário de texto.
            </li>
          </ul>
        </div>

        <div className="cover-feature-group">
          <h3>
            <Sparkles size={18} strokeWidth={1.8} className="cover-feature-icon" aria-hidden="true" />
            Questões e IA
          </h3>
          <ul>
            <li>
              Geração de questões no padrão ENADE com IA (OpenAI, Google Gemini ou Anthropic Claude), prontas para
              revisar e importar.
            </li>
            <li>Alternativa sem chave de API: baixe a skill de geração de questões para usar pelo Claude Desktop.</li>
            <li>Importação de arquivos .json de questões já prontos, com validação e pré-visualização antes de enviar ao Canvas.</li>
            <li>Prompts de IA personalizáveis por funcionalidade — complemente ou substitua o prompt padrão de cada uma.</li>
          </ul>
        </div>

        <div className="cover-feature-group">
          <h3>
            <Mail size={18} strokeWidth={1.8} className="cover-feature-icon" aria-hidden="true" />
            Mensagens (com o Canvas conectado)
          </h3>
          <ul>
            <li>Caixa de entrada do Canvas agrupada por curso, com listagem de alunos e composição de novas mensagens.</li>
            <li>Sugestão de resposta e melhoria de texto com IA antes de enviar.</li>
          </ul>
        </div>

        <div className="cover-feature-group">
          <h3>
            <Settings size={18} strokeWidth={1.8} className="cover-feature-icon" aria-hidden="true" />
            Configurações e conexões
          </h3>
          <ul>
            <li>Atalhos personalizados exibidos no painel inicial.</li>
            <li>Prompts de IA e anotações por curso, salvos na sua conta.</li>
            <li>Conexão com GitHub e com Google, com mais integrações a caminho (Drive, Calendar).</li>
            <li>Tutorial interativo com um resumo visual de cada tela do Vértice.</li>
          </ul>
        </div>
      </div>

      <section className="about-webtech">
        <h2>
          <Landmark size={20} strokeWidth={1.8} className="cover-feature-icon" aria-hidden="true" />
          Um projeto de extensão da PUC Minas
        </h2>
        <p className="lede">
          O Vértice é desenvolvido pelo{' '}
          <a href="https://webtech.network/" target="_blank" rel="noopener noreferrer">
            WebTech Network
          </a>
          , projeto de extensão da PUC Minas voltado à criação de soluções tecnológicas que apoiam a comunidade
          acadêmica — unindo alunos e professores no desenvolvimento de ferramentas reais para o dia a dia do ensino
          e da aprendizagem.
        </p>
      </section>

      <WebTechFooter />
    </main>
  );
}
