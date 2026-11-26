# Diário de Obra

## Intenção

Depois que o cliente fecha negócio, o vendedor acompanha a montagem da
lavanderia dele etapa por etapa. O andamento fica salvo na reunião do
cliente, junto com planta, ROI e Conectividade. Mais tarde cada etapa
concluída ganha um GIF 3D (gerado por fora) para o cliente visualizar o
progresso.

## O que entra

- Aba **"Diário de Obra"** ao lado de "Conectividade".
- As 25 etapas de `docs/Execução Projeto (1).xlsx` (0 a 24), em ordem, com
  objetivo e prazo quando a planilha tiver. Grafia corrigida (software,
  INPI, trifásico, fachada, ciclo, entrega).
- Estados: **concluída** (✓ + data), **atual** (destaque + botão
  "Concluir etapa"), **próximas** (apagadas). Concluir passa para a
  seguinte. Barra "N de 25 etapas concluídas".
- "Desfazer" só na última concluída (corrige clique errado).
- Lugar pronto para a imagem de cada etapa (campo opcional na lista de
  etapas); sem imagem, nada aparece.

## Approaches (como salvar)

1. **Dentro da reunião** (escolhida): o andamento entra no estado salvo por
   "Salvar reunião"; sem mudança no banco. Marcação não salva é avisada
   como as demais alterações.
2. Salvar na hora, a cada clique, com tabela própria: descartada — exige
   migração e regra de permissão separada.

## Decisões minhas (revisar)

- Guarda a data de conclusão de cada etapa.
- Fica também no navegador (como ROI e Conectividade), para não sumir ao
  recarregar; limpa ao sair da conta.
- Reunião salva antes desta mudança abre com o diário zerado.
- Qualquer conta que vê a aba marca etapas; salvar segue a regra atual
  (só o vendedor responsável).
- Fora do PDF/PNG por enquanto.

## Não faz

- Fotos/GIFs agora (só o lugar reservado).
- Notificar o cliente final, prazos com calendário, etapas fora de ordem.
