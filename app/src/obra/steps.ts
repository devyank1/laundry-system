// Etapas da obra do cliente (planilha "Execução Projeto"), em ordem.
// `image`: GIF 3D da etapa concluída (a gerar por fora; vazio = sem imagem).
// `checklist`: itens que precisam estar marcados para concluir a etapa.
export interface ObraCheck {
  id: string;
  text: string;
}

export interface ObraStep {
  n: number;
  title: string;
  goal?: string;
  deadline?: string;
  image?: string;
  checklist?: ObraCheck[];
}

export const OBRA_STEPS: ObraStep[] = [
  { n: 0, title: "Prazos", goal: "Conhecimento de prazos e processos" },
  {
    n: 1,
    title: "Escolha do ponto",
    goal: "Utilização de software para verificação do ponto",
    checklist: [
      { id: "1a", text: "Verificar se é possível adequar o ponto para uma lavanderia de autoatendimento" },
      { id: "1b", text: "Dados reais do local: número de passantes, quem consome ali, prédios ao redor com ou sem lavanderia dentro e classe social do consumo" },
      { id: "1c", text: "Identificar a concorrência num raio de 1,5 km" },
      { id: "1d", text: "Valor do aluguel" },
      { id: "1e", text: "Verificar se o ponto é trifásico" },
      { id: "1f", text: "Visibilidade do ponto: se é escondido e precisa de adaptações para ser mais visto" },
      { id: "1g", text: "Vagas para parada e segurança do local" },
      { id: "1h", text: "Se é possível funcionar 24 horas ou não" },
    ],
  },
  {
    n: 2,
    title: "Verificação da internet no ponto",
    goal: "Ver se chega internet até o ponto e se o plano escolhido atende bem a região (suporte etc.)",
  },
  {
    n: 3,
    title: "Obrigações legais",
    goal: "O contador alinha tudo isso",
    deadline: "Até 10 dias",
    checklist: [
      { id: "3a", text: "Procurar um contador (se já tiver um, ele facilita os outros processos)" },
      { id: "3b", text: "Abrir CNPJ ou MEI" },
      { id: "3c", text: "Alvará de abertura na prefeitura da cidade" },
      { id: "3d", text: "Liberação de abertura com o Corpo de Bombeiros e compra do extintor adequado ao local, verificada com eles" },
    ],
  },
  { n: 4, title: "INPI — registro de marca", goal: "Caso deseje seguir com a marca" },
  { n: 5, title: "Alteração para trifásico", goal: "Caso realmente precise da alteração para trifásico, ela deve ser feita nesta etapa" },
  { n: 6, title: "Planta arquitetônica simples", goal: "Criar planta do local para posicionamento dos elementos" },
  { n: 7, title: "Planta elétrica e hidráulica" },
  { n: 8, title: "Compra do mobiliário", deadline: "Mobiliário chegando em até 12 dias" },
  { n: 9, title: "Início da elétrica" },
  { n: 10, title: "Início da hidráulica" },
  { n: 11, title: "Estruturas de gesso" },
  { n: 12, title: "Criação dos designs (adesivos)" },
  { n: 13, title: "Início da fachada", deadline: "5 a 10 dias" },
  { n: 14, title: "Solicitação das máquinas", deadline: "15 a 30 dias para chegada do maquinário" },
  { n: 15, title: "Solicitação do ciclo", deadline: "12 a 30 dias para entrega" },
  { n: 16, title: "Solicitação da máquina Stone", deadline: "2 a 15 dias" },
  { n: 17, title: "Pintura do local" },
  { n: 18, title: "Adesivagem" },
  { n: 19, title: "Colocação do maquinário" },
  { n: 20, title: "Adesivagem do maquinário" },
  { n: 21, title: "Início do marketing de inauguração", goal: "2 semanas antes" },
  { n: 22, title: "Instalação técnica do maquinário" },
  { n: 23, title: "Finalização geral e testes" },
  { n: 24, title: "Inauguração" },
];
