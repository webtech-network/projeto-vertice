'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  LayoutDashboard,
  Layers,
  GraduationCap,
  Users,
  ListChecks,
  Mail,
  ClipboardList,
  Upload,
  Sparkles,
  MessageSquareText,
  KanbanSquare,
  Grid2x2,
  Table2,
  FolderKanban,
  UserRound,
  Link2,
  KeyRound,
  Wand2,
  Bookmark,
  SlidersHorizontal,
  Info,
  Flag,
  Zap,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Check,
  Plus,
  Settings2,
  Star,
  Megaphone,
  ClipboardCheck,
  CircleCheckBig,
  CircleDashed,
  ListPlus,
  Award,
  Send,
  CircleAlert,
  Clock,
  Hourglass,
  FileCheck,
  ChevronsDown,
  ChevronsUp,
  RefreshCw,
  Paperclip,
  Archive,
  Copy,
  X,
  Inbox,
  Ban,
  Circle,
  CircleDot,
  Filter,
  Rows3,
  FileJson,
  ChevronsUpDown,
  CircleCheck,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Sun,
  Moon,
  MonitorSmartphone,
} from 'lucide-react';
import imgDashboard from '@/assets/images/tutorial/tela_dashboard.png';
import imgDashboard2 from '@/assets/images/tutorial/tela_dashboard_2.png';
import imgWorkspaceSwitcher from '@/assets/images/tutorial/tela_workspace_switcher.png';
import imgCursos from '@/assets/images/tutorial/tela_painel_cursos.png';
import imgCursoAlunos from '@/assets/images/tutorial/tela_curso_alunos.png';
import imgCursoAtividades from '@/assets/images/tutorial/tela_curso_atividades.png';
import imgCursoMensagens from '@/assets/images/tutorial/tela_curso_mensagens.png';
import imgCorrecaoAtividade from '@/assets/images/tutorial/tela_correcao_atividade.png';
import imgImportarArquivo from '@/assets/images/tutorial/tela_importar_arquivo.png';
import imgImportarIa from '@/assets/images/tutorial/tela_importar_ia.png';
import imgMensagens from '@/assets/images/tutorial/tela_painel_mensagens.png';
import imgMensagemAberta from '@/assets/images/tutorial/tela_mensagem_aberta.png';
import imgQuestoes from '@/assets/images/tutorial/tela_questoes.png';
import imgTarefasKanban from '@/assets/images/tutorial/tela_tarefas_kanban.png';
import imgTarefasEisenhower from '@/assets/images/tutorial/tela_tarefas_eisenhower.png';
import imgTarefasTabela from '@/assets/images/tutorial/tela_tarefas_tabela.png';
import imgTarefasProjetos from '@/assets/images/tutorial/tela_tarefas_projetos.png';
import imgPerfilGeral from '@/assets/images/tutorial/tela_perfil_geral.png';
import imgPerfilPlataformas from '@/assets/images/tutorial/tela_perfil_plataformas.png';
import imgMotoresIa from '@/assets/images/tutorial/tela_perfil_motores_ia.png';
import imgPerfilPrompts from '@/assets/images/tutorial/tela_perfil_prompts.png';
import imgAtalhos from '@/assets/images/tutorial/tela_perfil_atalhos.png';
import imgPerfilPreferencias from '@/assets/images/tutorial/tela_perfil_preferencias.png';
import imgSobre from '@/assets/images/tutorial/tela_sobre.png';

// Agrupa a lista lateral pela mesma divisão de seções que o resto do app usa
// (itens da barra lateral + Perfil/Configurações) — sem isso, 23 telas soltas
// numa lista só ficam difíceis de escanear.
const GROUPS = [
  { key: 'geral', label: 'Geral' },
  { key: 'cursos', label: 'Cursos' },
  { key: 'mensagens', label: 'Mensagens' },
  { key: 'questoes', label: 'Questões' },
  { key: 'tarefas', label: 'Tarefas' },
  { key: 'perfil', label: 'Perfil (Configurações)' },
  { key: 'outros', label: 'Outros' },
];

// Cada entrada representa uma tela (ou aba/sub-estado) do Vértice.
// `screenshots` é uma lista (quase sempre com 1 item, o Painel inicial tem 2
// porque a tela é mais alta que a área visível) de { image, file }. Quando
// `image` é null (print ainda não tirado), a tela mostra um placeholder com
// o nome do arquivo esperado em vez de quebrar o build — basta importar o
// arquivo e apontar `image` para ele quando o print chegar.
const FEATURES = [
  {
    id: 'dashboard',
    label: 'Painel inicial',
    group: 'geral',
    Icon: LayoutDashboard,
    screenshots: [
      { image: imgDashboard, file: 'tela_dashboard.png' },
      { image: imgDashboard2, file: 'tela_dashboard_2.png' },
    ],
    howTo:
      'É a primeira tela que você vê depois de entrar. Para voltar a ela a qualquer momento, clique em "Dashboard" na barra lateral ou na logo do Vértice, no canto superior esquerdo da barra superior.',
    about:
      'Reúne um resumo dos seus cursos favoritos (disciplinas ativas, alunos, mensagens e correções pendentes), um bloco de tarefas em andamento e seus atalhos pessoais lado a lado, um calendário de prazos de entrega com a lista das atividades recentes, e uma lista de correções pendentes por atividade — clicar numa linha corrige direto no Vértice, sem precisar do SpeedGrader do Canvas. Os dados ficam em cache no navegador para abrir rápido e são atualizados em segundo plano.',
    elements: [
      { Icon: Flag, label: 'Bandeira de importância', text: 'nos cards de tarefas em andamento, mostra a importância definida para aquela tarefa.' },
      { Icon: Zap, label: 'Raio de urgência', text: 'mostra a urgência definida para a tarefa, ao lado da importância.' },
      { Icon: ArrowRight, label: 'Painel', text: 'leva da lista resumida de tarefas para o módulo Tarefas completo.' },
      { Icon: ExternalLink, label: 'Abrir no Canvas', text: 'nas atividades recentes/correções pendentes, abre a entrega direto no Canvas.' },
    ],
  },
  {
    id: 'workspace-switcher',
    label: 'Seletor de Workspace',
    group: 'geral',
    Icon: Layers,
    screenshots: [{ image: imgWorkspaceSwitcher, file: 'tela_workspace_switcher.png' }],
    howTo:
      'Fica sempre visível na barra superior, entre a logo e o seu avatar, em qualquer tela do Vértice. Clique nele para abrir a lista de workspaces.',
    about:
      'Um workspace agrupa projetos pessoais e cursos do Canvas num mesmo contexto — por exemplo, uma disciplina ou um semestre. O workspace ativo (aqui, "Pessoal"; o padrão de fábrica é "Base") filtra o que aparece em Tarefas, e a tela de Atividades de um curso avisa quando aquele curso não pertence ao workspace selecionado no momento.',
    elements: [
      { Icon: ChevronDown, label: 'Abrir a lista', text: 'expande o popover com todos os seus workspaces.' },
      { Icon: Check, label: 'Workspace ativo', text: 'marca, na lista, qual workspace está selecionado agora.' },
      { Icon: Plus, label: 'Novo workspace', text: 'cria um workspace novo.' },
      { Icon: Settings2, label: 'Gerenciar workspaces', text: 'abre a tela de editar/renomear/excluir workspaces existentes.' },
    ],
  },
  {
    id: 'cursos',
    label: 'Lista de cursos',
    group: 'cursos',
    Icon: GraduationCap,
    screenshots: [{ image: imgCursos, file: 'tela_painel_cursos.png' }],
    howTo: 'Clique em "Cursos" na barra lateral.',
    about:
      'Lista os cursos em que você é professor no Canvas, com busca por nome/código, filtro por favorito ou todos, filtro por status de publicação, e ordenação por qualquer coluna. Clicar no nome de um curso abre um editor de anotações pessoais inline, sem sair da lista.',
    elements: [
      { Icon: Star, label: 'Favoritar', text: 'marca ou desmarca o curso como favorito — só favoritos aparecem em Mensagens e no Painel inicial.' },
      { Icon: Megaphone, label: 'Status de publicação', text: 'indica se o curso está publicado, não publicado ou encerrado.' },
      { Icon: ClipboardCheck, label: 'Correções pendentes', text: 'total de correções pendentes do curso, calculado pelo próprio Canvas.' },
      { Icon: Mail, label: 'Mensagens', text: 'contador de mensagens daquele curso.' },
      { Icon: ExternalLink, label: 'Abrir no Canvas', text: 'abre a página do curso no Canvas, em nova aba.' },
      { Icon: ListChecks, label: 'Ver atividades', text: 'abre a lista de atividades do curso.' },
      { Icon: Users, label: 'Ver alunos', text: 'abre a lista de alunos do curso.' },
      { Icon: Layers, label: 'Workspaces deste curso', text: 'vincula o curso a um ou mais workspaces.' },
    ],
  },
  {
    id: 'curso-alunos',
    label: 'Alunos',
    group: 'cursos',
    Icon: Users,
    screenshots: [{ image: imgCursoAlunos, file: 'tela_curso_alunos.png' }],
    howTo: 'Botão de pessoas ("Ver alunos") na linha de um curso, em /courses.',
    about:
      'Tabela com os alunos ativos do curso — matrícula, última atividade, tempo de atividade e nota, quando disponível pela API do Canvas —, com busca por nome ou e-mail, opção de ocultar alunos inativos e exportação da lista em CSV. Quando a conta Canvas não expõe notas pela API, a tela avisa isso em vez de mostrar dados incompletos.',
    elements: [
      { Icon: ExternalLink, label: 'Abrir no Canvas', text: 'no aviso de contexto do topo, abre a lista de pessoas do curso dentro do Canvas.' },
    ],
  },
  {
    id: 'curso-atividades',
    label: 'Atividades',
    group: 'cursos',
    Icon: ListChecks,
    screenshots: [{ image: imgCursoAtividades, file: 'tela_curso_atividades.png' }],
    howTo: 'Botão de lista ("Ver atividades") na linha de um curso, em /courses.',
    about:
      'Lista as atividades do curso com status de publicação, pontuação, prazo e um número indicando correções pendentes. Clicar no nome de uma atividade expande o enunciado sem sair da página. Um banner no topo avisa quando o curso não pertence ao workspace ativo, e um botão de destaque leva direto para a geração de questões com IA.',
    elements: [
      { Icon: CircleCheckBig, label: 'Publicado', text: 'atividade já visível para os alunos.' },
      { Icon: CircleDashed, label: 'Não publicado', text: 'atividade ainda invisível para os alunos.' },
      { Icon: ExternalLink, label: 'Abrir no Canvas', text: 'abre a atividade na página do Canvas.' },
      { Icon: ClipboardList, label: 'Correção de Atividade', text: 'leva à tela de correção por rubrica do Vértice.' },
      { Icon: ListPlus, label: 'Importar questões', text: 'só aparece em quizzes clássicos vinculados — abre o painel de importação de questões daquele quiz.' },
    ],
  },
  {
    id: 'curso-mensagens',
    label: 'Mensagens do curso',
    group: 'cursos',
    Icon: Mail,
    screenshots: [{ image: imgCursoMensagens, file: 'tela_curso_mensagens.png' }],
    howTo: 'Botão de envelope ("Ver mensagens") na linha de um curso, em /courses.',
    about:
      'Mostra as conversas do Canvas filtradas para aquele curso específico, com um botão "Nova mensagem" que abre um formulário de composição — incluindo sugestão e melhoria de texto por IA, quando há um provedor configurado — e a lista de conversas daquele curso logo abaixo, igual à tela global de Mensagens.',
    elements: [
      { Icon: Send, label: 'Nova mensagem', text: 'abre o formulário para compor uma mensagem para o curso.' },
      { Icon: Sparkles, label: 'Melhorar/gerar com IA', text: 'no formulário de nova mensagem, usa a chave de IA cadastrada em Perfil para sugerir ou revisar o texto.' },
    ],
  },
  {
    id: 'correcao-atividade',
    label: 'Correção de Atividade',
    group: 'cursos',
    Icon: ClipboardList,
    screenshots: [{ image: imgCorrecaoAtividade, file: 'tela_correcao_atividade.png' }],
    howTo: 'Botão "Correção de Atividade" (ícone de prancheta) em qualquer linha de /courses/[curso]/atividades.',
    about:
      'Uma linha por aluno ou grupo, com o status da entrega e um campo de nota por critério de rubrica (aqui, "Matriz CSD" e "Mapa de Stakeholders" — ou uma nota única, quando a atividade não tem rubrica associada), mais um campo de comentário e botão de nota máxima por linha. Clicar no nome do aluno/grupo mostra a entrega enviada sem sair da página. Nada é enviado ao Canvas até você clicar em "Enviar" — até lá é só rascunho local.',
    elements: [
      { Icon: CircleAlert, label: 'Faltando', text: 'o aluno ou grupo não entregou nada.' },
      { Icon: CircleDashed, label: 'Não entregue', text: 'sem entrega registrada.' },
      { Icon: Clock, label: 'Atrasada', text: 'entregue depois do prazo.' },
      { Icon: Hourglass, label: 'Aguardando revisão', text: 'entregue, ainda não avaliada.' },
      { Icon: FileCheck, label: 'Entregue', text: 'entrega recebida.' },
      { Icon: CircleCheckBig, label: 'Avaliada', text: 'nota já enviada ao Canvas.' },
      { Icon: Award, label: 'Nota máxima', text: 'preenche automaticamente a pontuação máxima daquela linha.' },
      { Icon: Send, label: 'Enviar todas as notas', text: 'grava as notas e a avaliação de rubrica de todas as linhas no Canvas de uma vez.' },
    ],
  },
  {
    id: 'importar-arquivo',
    label: 'Importar questões — Arquivo',
    group: 'cursos',
    Icon: Upload,
    screenshots: [{ image: imgImportarArquivo, file: 'tela_importar_arquivo.png' }],
    howTo:
      'Aba "Enviar arquivo" dentro de Importar questões (que se chega pelo botão "Importar questões" numa atividade do tipo quiz clássico).',
    about:
      'Envie um arquivo .json de questões já pronto. O Vértice valida a estrutura mínima obrigatória e, de forma não bloqueante, confere também contra o schema oficial, mostrando avisos sem impedir a importação de arquivos "quase certos". Depois da validação, você revisa e escolhe quais questões importar antes de enviar ao Canvas.',
    elements: [{ Icon: Upload, label: 'Selecionar arquivo .json', text: 'abre o seletor de arquivos do sistema operacional.' }],
  },
  {
    id: 'importar-ia',
    label: 'Importar questões — Gerar com IA',
    group: 'cursos',
    Icon: Sparkles,
    screenshots: [{ image: imgImportarIa, file: 'tela_importar_ia.png' }],
    howTo: 'Aba "Gerar com IA" dentro de Importar questões.',
    about:
      'A mesma tela de geração de questões por IA (ver "Questões" abaixo), mas já vinculada a este curso e a este quiz — ao terminar a revisão, o botão de confirmação envia as questões direto para o Canvas, em vez de apenas salvar um arquivo. Também mostra o atalho para gerar via skill no Claude Desktop, sem precisar de chave de API.',
    elements: [{ Icon: Sparkles, label: 'Motor de IA', text: 'escolhe qual provedor configurado (OpenAI, Gemini, Claude) vai gerar as questões.' }],
  },
  {
    id: 'mensagens',
    label: 'Caixa de entrada',
    group: 'mensagens',
    Icon: Mail,
    screenshots: [{ image: imgMensagens, file: 'tela_painel_mensagens.png' }],
    howTo: 'Clique em "Mensagens" na barra lateral.',
    about:
      'Caixa de entrada do Canvas dos seus cursos favoritos, agrupada por curso (mais um grupo para mensagens diretas). Um seletor de contexto no topo filtra por um curso específico, e botões dedicados expandem ou recolhem todos os grupos de uma vez.',
    elements: [
      { Icon: ChevronsDown, label: 'Expandir tudo', text: 'abre todos os grupos de curso de uma vez.' },
      { Icon: ChevronsUp, label: 'Recolher tudo', text: 'fecha todos os grupos de curso de uma vez.' },
      { Icon: RefreshCw, label: 'Recarregar', text: 'busca as mensagens mais recentes no Canvas.' },
      { Icon: ExternalLink, label: 'Abrir no Canvas', text: 'leva para a caixa de mensagens daquele curso, dentro do Canvas.' },
    ],
  },
  {
    id: 'mensagem-aberta',
    label: 'Abrir uma mensagem',
    group: 'mensagens',
    Icon: MessageSquareText,
    screenshots: [{ image: imgMensagemAberta, file: 'tela_mensagem_aberta.png' }],
    howTo: 'Clique no assunto (ou na seta no início da linha) de qualquer mensagem, em Mensagens ou nas Mensagens de um curso.',
    about:
      'Expande a conversa completa, com anexos, e ações para abrir a conversa no Canvas ou arquivá-la. Se houver uma chave de IA cadastrada em Perfil, também aparece um botão para pedir uma sugestão de resposta gerada automaticamente, copiável com um clique.',
    elements: [
      { Icon: ChevronRight, label: 'Expandir/recolher', text: 'abre ou fecha a conversa inline.' },
      { Icon: Paperclip, label: 'Anexo', text: 'indica que a mensagem tem um arquivo anexado.' },
      { Icon: Archive, label: 'Arquivar', text: 'remove a conversa da caixa de entrada no Canvas.' },
      { Icon: ExternalLink, label: 'Abrir no Canvas', text: 'abre esta conversa na interface do Canvas.' },
      { Icon: Sparkles, label: 'Sugerir resposta com IA', text: 'gera uma sugestão de resposta usando a chave de IA configurada.' },
      { Icon: Wand2, label: 'Melhorar com IA', text: 'revisa o texto que você já digitou antes de enviar.' },
      { Icon: Send, label: 'Enviar', text: 'envia a resposta para o Canvas.' },
      { Icon: Copy, label: 'Copiar', text: 'copia a sugestão de resposta gerada pela IA.' },
    ],
  },
  {
    id: 'questoes',
    label: 'Gerador de questões',
    group: 'questoes',
    Icon: Sparkles,
    screenshots: [{ image: imgQuestoes, file: 'tela_questoes.png' }],
    howTo:
      'Item "Questões" na barra lateral (ou pelo botão "Gerar questões com IA" na tela de Atividades de um curso, ou pela aba "Gerar com IA" dentro de Importar questões).',
    about:
      'Gera questões no padrão ENADE — RU (Resposta Única), CM (Complementação Múltipla) ou AR (Asserção-Razão) — a partir de blocos de especificação (tema, complexidade e quantidade), usando o provedor de IA configurado em Perfil. Depois de gerar, você revisa o resultado e pode salvá-lo como arquivo .json para importar depois. A tela também mostra um atalho para baixar a skill de geração de questões e usá-la direto no Claude Desktop, sem precisar cadastrar uma chave de API aqui.',
    elements: [
      { Icon: Plus, label: 'Adicionar questão', text: 'acrescenta mais um bloco de especificação (tema, complexidade, tipo, quantidade).' },
      { Icon: X, label: 'Remover bloco', text: 'apaga um bloco de especificação da lista.' },
    ],
  },
  {
    id: 'tarefas-kanban',
    label: 'Kanban',
    group: 'tarefas',
    Icon: KanbanSquare,
    screenshots: [{ image: imgTarefasKanban, file: 'tela_tarefas_kanban.png' }],
    howTo: 'Item "Tarefas" na barra lateral — esta é a visualização inicial (Kanban).',
    about:
      'Organiza suas tarefas pessoais em colunas por status: Backlog, Block, Todo, Doing e Done. Arraste um card entre colunas para mudar o status, ou clique nele para abrir os detalhes. Tarefas podem ser agrupadas por projeto, e o workspace ativo (barra superior) filtra quais projetos e tarefas aparecem aqui.',
    elements: [
      { Icon: Inbox, label: 'Backlog', text: 'tarefas ainda não priorizadas.' },
      { Icon: Ban, label: 'Block', text: 'tarefas travadas por alguma dependência.' },
      { Icon: Circle, label: 'Todo', text: 'tarefas prontas para começar.' },
      { Icon: CircleDot, label: 'Doing', text: 'tarefas em andamento.' },
      { Icon: CircleCheckBig, label: 'Done', text: 'tarefas finalizadas.' },
      { Icon: Flag, label: 'Importante', text: 'marca de importância definida no detalhe da tarefa.' },
      { Icon: Zap, label: 'Urgente', text: 'marca de urgência definida no detalhe da tarefa.' },
      { Icon: Filter, label: 'Filtrar', text: 'abre o modal de filtros (projeto, prioridade, prazo etc.).' },
      { Icon: Rows3, label: 'Densidade dos cards', text: 'alterna entre cards abertos e condensados.' },
      { Icon: Grid2x2, label: 'Agrupar por projeto', text: 'organiza as colunas em faixas, uma por projeto.' },
      { Icon: FolderKanban, label: 'Projetos', text: 'abre o gerenciador de projetos.' },
      { Icon: FileJson, label: 'Exportar/importar', text: 'salva ou carrega suas tarefas em um arquivo .json.' },
      { Icon: Settings2, label: 'Preferências de Tarefas', text: 'atalho para a aba Preferências, em Perfil.' },
    ],
  },
  {
    id: 'tarefas-eisenhower',
    label: 'Matriz de Eisenhower',
    group: 'tarefas',
    Icon: Grid2x2,
    screenshots: [{ image: imgTarefasEisenhower, file: 'tela_tarefas_eisenhower.png' }],
    howTo: 'Em Tarefas, botão de visualizações na barra de ferramentas → ícone de matriz.',
    about:
      'A mesma lista de tarefas organizada em 4 quadrantes por importância x urgência (a Matriz de Eisenhower), para ajudar a decidir o que fazer primeiro, o que agendar, o que delegar e o que descartar — útil quando o volume de tarefas não cabe bem numa visão só por status.',
    elements: [
      { Icon: Flag, label: 'Importância', text: 'eixo vertical da matriz.' },
      { Icon: Zap, label: 'Urgência', text: 'eixo horizontal da matriz.' },
    ],
  },
  {
    id: 'tarefas-tabela',
    label: 'Tabela',
    group: 'tarefas',
    Icon: Table2,
    screenshots: [{ image: imgTarefasTabela, file: 'tela_tarefas_tabela.png' }],
    howTo: 'Em Tarefas, botão de visualizações na barra de ferramentas → ícone de tabela.',
    about:
      'Lista todas as tarefas em formato de tabela, com colunas ordenáveis (prioridade, prazo, projeto, status) — útil para revisar ou reordenar um volume grande de tarefas de uma vez, algo mais difícil de fazer olhando cards.',
    elements: [{ Icon: ChevronsUpDown, label: 'Ordenar coluna', text: 'clique no cabeçalho de qualquer coluna para ordenar por ela.' }],
  },
  {
    id: 'tarefas-projetos',
    label: 'Projetos',
    group: 'tarefas',
    Icon: FolderKanban,
    screenshots: [{ image: imgTarefasProjetos, file: 'tela_tarefas_projetos.png' }],
    howTo: 'Em Tarefas, botão "Projetos" na barra de ferramentas.',
    about:
      'Gerencia os projetos usados para agrupar tarefas, separados em dois grupos: vinculados a um curso do Canvas e pessoais. Permite criar, editar (nome, cor) e excluir projetos — cada um mostra quantas tarefas tem.',
    elements: [
      { Icon: Pencil, label: 'Editar', text: 'altera o nome ou a cor do projeto.' },
      { Icon: Trash2, label: 'Excluir', text: 'remove o projeto (as tarefas voltam a ficar sem projeto).' },
    ],
  },
  {
    id: 'perfil-geral',
    label: 'Geral',
    group: 'perfil',
    Icon: UserRound,
    screenshots: [{ image: imgPerfilGeral, file: 'tela_perfil_geral.png' }],
    howTo: 'Clique no seu avatar, no canto superior direito, e depois em "Configurações" — esta é a aba "Geral", a primeira ao entrar.',
    about:
      'Mostra seus dados de conta (nome e, quando aplicável, instituição do Canvas) e a seção "Aparência", onde você escolhe o tema do Vértice.',
    elements: [
      { Icon: Sun, label: 'Claro', text: 'tema claro fixo.' },
      { Icon: Moon, label: 'Escuro', text: 'tema escuro fixo.' },
      { Icon: MonitorSmartphone, label: 'Sistema', text: 'segue o tema do seu sistema operacional.' },
    ],
  },
  {
    id: 'perfil-plataformas',
    label: 'Plataformas associadas',
    group: 'perfil',
    Icon: Link2,
    screenshots: [{ image: imgPerfilPlataformas, file: 'tela_perfil_plataformas.png' }],
    howTo: 'Em Perfil (Configurações), aba "Plataformas associadas".',
    about:
      'Conecta ou desconecta contas externas ao seu perfil: Canvas (necessário para tudo que depende de curso — atividades, mensagens, importação de questões), GitHub e Google Drive. A conexão com o Canvas fica salva no servidor, cifrada; GitHub e Google Drive ficam salvos neste navegador.',
    elements: [{ Icon: CircleCheck, label: 'Conectado', text: 'indica que aquela plataforma já está vinculada ao seu perfil.' }],
  },
  {
    id: 'perfil-ia',
    label: 'Plataformas de IA',
    group: 'perfil',
    Icon: KeyRound,
    screenshots: [{ image: imgMotoresIa, file: 'tela_perfil_motores_ia.png' }],
    howTo: 'Em Perfil (Configurações), aba "Plataformas de IA".',
    about:
      'Cadastre sua própria chave de API para cada provedor de IA (OpenAI, Google Gemini ou Anthropic Claude) — cada uma é validada e salva separadamente, pode ter um modelo específico escolhido, e pode ser trocada ou removida quando quiser. É essa chave que alimenta a geração de questões e as sugestões de resposta e melhoria de mensagens.',
    elements: [
      { Icon: CircleCheck, label: 'Chave válida', text: 'a chave foi testada e está ativa.' },
      { Icon: ChevronDown, label: 'Trocar modelo', text: 'expande a lista de modelos disponíveis para aquele provedor.' },
      { Icon: Pencil, label: 'Editar', text: 'permite digitar uma nova chave para substituir a atual.' },
      { Icon: Trash2, label: 'Remover', text: 'apaga a chave cadastrada daquele provedor.' },
    ],
  },
  {
    id: 'perfil-prompts',
    label: 'Prompts de IA',
    group: 'perfil',
    Icon: Wand2,
    screenshots: [{ image: imgPerfilPrompts, file: 'tela_perfil_prompts.png' }],
    howTo: 'Em Perfil (Configurações), aba "Prompts de IA".',
    about:
      'Personalize, por funcionalidade (geração de questões, sugestão de resposta, melhoria de mensagem), o texto de instrução enviado à IA — complementando o prompt padrão do Vértice ou substituindo-o inteiramente. Substituir por completo é mais arriscado: regras estruturais, como o formato exigido de cada questão, deixam de ser garantidas.',
    elements: [
      { Icon: ChevronRight, label: 'Ver prompt padrão / prompt final', text: 'expande o texto do prompt padrão ou uma prévia do prompt que será realmente enviado.' },
    ],
  },
  {
    id: 'perfil-atalhos',
    label: 'Atalhos do Dashboard',
    group: 'perfil',
    Icon: Bookmark,
    screenshots: [{ image: imgAtalhos, file: 'tela_perfil_atalhos.png' }],
    howTo: 'Em Perfil (Configurações), aba "Atalhos do Dashboard".',
    about:
      'Cadastre links de acesso rápido que aparecem no Painel inicial. Ficam salvos só neste navegador — para levá-los a outro navegador ou computador, use os botões de exportar e importar.',
    elements: [
      { Icon: Plus, label: 'Adicionar', text: 'abre o formulário para criar um novo atalho.' },
      { Icon: Pencil, label: 'Editar', text: 'altera o nome, ícone ou link de um atalho existente.' },
      { Icon: Trash2, label: 'Excluir', text: 'remove um atalho da lista.' },
      { Icon: ArrowUp, label: 'Mover para cima', text: 'reordena o atalho uma posição acima.' },
      { Icon: ArrowDown, label: 'Mover para baixo', text: 'reordena o atalho uma posição abaixo.' },
    ],
  },
  {
    id: 'perfil-preferencias',
    label: 'Preferências',
    group: 'perfil',
    Icon: SlidersHorizontal,
    screenshots: [{ image: imgPerfilPreferencias, file: 'tela_perfil_preferencias.png' }],
    howTo: 'Em Perfil (Configurações), aba "Preferências".',
    about:
      'Define os valores padrão do módulo Tarefas para quando você abre o Vértice pela primeira vez numa sessão do navegador: densidade dos cards, visualização padrão (Kanban, Matriz de Eisenhower ou Tabela), se agrupa por projeto por padrão, e se mostra Backlog/Block por padrão. Alterações feitas diretamente na tela de Tarefas valem só durante aquela sessão e não mudam esses padrões. Não afeta nada do Canvas.',
    elements: [],
  },
  {
    id: 'sobre',
    label: 'Sobre o Vértice',
    group: 'outros',
    Icon: Info,
    screenshots: [{ image: imgSobre, file: 'tela_sobre.png' }],
    howTo: 'Menu "Mais" (rodapé da barra lateral) → "Sobre o Vértice".',
    about:
      'Página institucional que resume, em blocos temáticos, tudo que o Vértice faz hoje: tarefas/projetos/workspaces, login e integrações, cursos e atividades (com o Canvas conectado), questões e IA, mensagens, e configurações/conexões — mais uma seção sobre o projeto de extensão da PUC Minas/WebTech Network por trás da ferramenta.',
    elements: [],
  },
];

export default function TutorialExplorer() {
  const [activeId, setActiveId] = useState(FEATURES[0].id);
  const active = FEATURES.find((f) => f.id === activeId);
  const activeGroup = GROUPS.find((g) => g.key === active.group);

  return (
    <div className="tutorial-layout">
      <nav className="tutorial-list" aria-label="Funcionalidades">
        {GROUPS.map((group) => {
          const items = FEATURES.filter((f) => f.group === group.key);
          if (items.length === 0) return null;
          return (
            <div className="tutorial-group" key={group.key}>
              <div className="tutorial-group-label">{group.label}</div>
              <ul role="tablist" aria-label={group.label}>
                {items.map(({ id, label, Icon }) => (
                  <li key={id}>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={id === activeId}
                      className={`tutorial-list-btn${id === activeId ? ' active' : ''}`}
                      onClick={() => setActiveId(id)}
                    >
                      <Icon size={18} strokeWidth={1.8} />
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="tutorial-detail" role="tabpanel">
        <div className="tutorial-detail-eyebrow">{activeGroup.label}</div>
        <h2>{active.label}</h2>

        {active.screenshots.map(({ image, file }, index) => (
          <div className="tutorial-screenshot" key={file}>
            {image ? (
              <Image
                src={image}
                alt={
                  active.screenshots.length > 1
                    ? `Tela de ${active.label} (${index + 1}/${active.screenshots.length})`
                    : `Tela de ${active.label}`
                }
              />
            ) : (
              <div className="tutorial-screenshot-placeholder">
                Print ainda não disponível.
                <br />
                Arquivo esperado: <code>src/assets/images/tutorial/{file}</code>
              </div>
            )}
          </div>
        ))}

        <div className="tutorial-detail-section">
          <h3>Como chegar</h3>
          <p>{active.howTo}</p>
        </div>
        <div className="tutorial-detail-section">
          <h3>Como funciona</h3>
          <p>{active.about}</p>
        </div>
        {active.elements.length > 0 && (
          <div className="tutorial-detail-section">
            <h3>Ícones e elementos desta tela</h3>
            <ul className="tutorial-icon-list">
              {active.elements.map(({ Icon, label, text }) => (
                <li key={label}>
                  <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                  <div>
                    <strong>{label}</strong>
                    <span>{text}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
