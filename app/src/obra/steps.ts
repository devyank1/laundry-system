// Etapas da obra do cliente (planilha "Execução Projeto" + ajustes do dono), em ordem.
// `id` é fixo: o andamento salvo usa ele, então inserir/reordenar etapas não
// bagunça reuniões já salvas. O número mostrado na tela é a posição.
// `image`: GIF 3D da etapa concluída (a gerar por fora; vazio = sem imagem).
// `checklist`: itens a marcar; obrigatórios, exceto com `optionalChecklist`.
// `extras`: a etapa tem a lista livre "+ Adicionar" de materiais extras.
export interface ObraCheck {
  id: string;
  text: string;
}

export interface ObraStep {
  id: string;
  title: string;
  goal?: string;
  deadline?: string;
  image?: string;
  checklist?: ObraCheck[];
  optionalChecklist?: boolean;
  extras?: boolean;
}

const letters = (prefix: string, texts: string[]): ObraCheck[] =>
  texts.map((text, i) => ({ id: `${prefix}-${String.fromCharCode(97 + i)}`, text }));

export const OBRA_STEPS: ObraStep[] = [
  { id: "prazos", title: "Prazos", goal: "Conhecimento de prazos e processos" },
  {
    id: "ponto",
    title: "Escolha do ponto",
    goal: "Utilização de software para verificação do ponto",
    checklist: letters("ponto", [
      "Verificar se é possível adequar o ponto para uma lavanderia de autoatendimento",
      "Dados reais do local: número de passantes, quem consome ali, prédios ao redor com ou sem lavanderia dentro e classe social do consumo",
      "Identificar a concorrência num raio de 1,5 km",
      "Valor do aluguel",
      "Verificar se o ponto é trifásico",
      "Visibilidade do ponto: se é escondido e precisa de adaptações para ser mais visto",
      "Vagas para parada e segurança do local",
      "Se é possível funcionar 24 horas ou não",
    ]),
  },
  {
    id: "internet",
    title: "Verificação da internet no ponto",
    goal: "Ver se chega internet até o ponto e se o plano escolhido atende bem a região (suporte etc.)",
  },
  {
    id: "legal",
    title: "Obrigações legais",
    goal: "O contador alinha tudo isso",
    deadline: "Até 10 dias",
    checklist: letters("legal", [
      "Procurar um contador (se já tiver um, ele facilita os outros processos)",
      "Abrir CNPJ ou MEI",
      "Alvará de abertura na prefeitura da cidade",
      "Liberação de abertura com o Corpo de Bombeiros e compra do extintor adequado ao local, verificada com eles",
    ]),
  },
  { id: "inpi", title: "INPI — registro de marca", goal: "Caso deseje seguir com a marca" },
  { id: "redes", title: "Criação do Instagram e do Google Meu Negócio" },
  { id: "trifasico", title: "Alteração para trifásico", goal: "Caso realmente precise da alteração para trifásico, ela deve ser feita nesta etapa" },
  { id: "planta", title: "Planta arquitetônica simples", goal: "Criar planta do local para posicionamento dos elementos" },
  { id: "planta-eletrica", title: "Planta elétrica e hidráulica" },
  {
    id: "aprovacao-projetos",
    title: "Aprovação dos projetos hidráulico e elétrico pelos engenheiros",
    goal: "Contém o projeto certo para o layout e os materiais necessários que devem ser comprados",
  },
  { id: "mobiliario", title: "Compra do mobiliário", deadline: "Mobiliário chegando em até 12 dias" },
  {
    id: "compras-materiais",
    title: "Início das compras de materiais hidráulicos e elétricos",
    goal: "Adicione materiais extras se precisar de outras adequações (pisos etc.)",
    extras: true,
  },
  { id: "eletrica", title: "Início da elétrica" },
  { id: "hidraulica", title: "Início da hidráulica" },
  { id: "gesso", title: "Estrutura de gesso / drywall", goal: "Só concluir com a elétrica já concluída" },
  { id: "designs", title: "Criação dos designs (adesivos)" },
  { id: "fachada", title: "Início da fachada", deadline: "5 a 10 dias" },
  { id: "maquinas", title: "Solicitação das máquinas", deadline: "15 a 30 dias para chegada do maquinário" },
  { id: "pagamento", title: "Solicitação do sistema de pagamento da Cicclo ou Lavecom", deadline: "12 a 30 dias para entrega" },
  { id: "stone", title: "Solicitação da máquina Stone", deadline: "2 a 15 dias" },
  { id: "pintura", title: "Pintura do local" },
  { id: "adesivagem", title: "Adesivagem" },
  { id: "colocacao", title: "Colocação do maquinário" },
  {
    id: "comunicacao-visual",
    title: "Adesivagem do maquinário, avisos e banners",
    checklist: letters("visual", [
      "Adesivagem do maquinário",
      "Avisos da loja",
      "Pedir banner da loja com a precificação",
      "Pedir banner totem para anúncio em esquinas ou na frente da loja",
    ]),
  },
  { id: "marketing", title: "Início do marketing de inauguração", goal: "2 semanas antes" },
  { id: "instalacao", title: "Instalação técnica do maquinário com sistema de pagamento e automações" },
  { id: "finalizacao", title: "Finalização geral e testes" },
  {
    id: "inauguracao",
    title: "Inauguração",
    goal: "Itens opcionais: marque o que for usar",
    optionalChecklist: true,
    checklist: letters("inaug", [
      "Compra dos itens para a inauguração",
      "Contratar serviços",
      "Comes e bebes: pipoca e refrigerantes",
      "Aromas da lavanderia como cortesia",
      "Som em frente à loja",
      "Arco de bexigas",
      "Café da manhã",
      "Carro de som ou moto de som na cidade",
    ]),
  },
];
