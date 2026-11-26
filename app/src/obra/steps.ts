// Etapas da obra do cliente (planilha "Execução Projeto"), em ordem.
// `image`: GIF 3D da etapa concluída (a gerar por fora; vazio = sem imagem).
export interface ObraStep {
  n: number;
  title: string;
  goal?: string;
  deadline?: string;
  image?: string;
}

export const OBRA_STEPS: ObraStep[] = [
  { n: 0, title: "Prazos", goal: "Conhecimento de prazos e processos" },
  { n: 1, title: "Escolha do ponto", goal: "Utilização de software para verificação do ponto" },
  { n: 2, title: "Verificação se chega internet até o ponto" },
  { n: 3, title: "Obrigações legais", goal: "Abrir CNPJ", deadline: "Até 10 dias" },
  { n: 4, title: "INPI — registro de marca", goal: "Caso deseje seguir com a marca" },
  { n: 5, title: "Alteração para trifásico na chegada de energia", goal: "A depender da escolha" },
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
