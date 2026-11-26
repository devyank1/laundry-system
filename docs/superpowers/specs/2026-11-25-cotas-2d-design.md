# Medidas extras na planta 2D

## Intenção

Na reunião e na obra, o vendedor e o cliente precisam ler na planta os
espaços que importam: quanto ocupa a parte das máquinas, o tamanho dos
móveis e quanto sobra de passagem até a porta. Hoje a planta só mostra a
largura e o comprimento totais e a corrente das máquinas.

## O que entra (pedido do dono do negócio)

Um botão **"Mostrar medidas"** ao lado de "Baixar PNG" (aba 2D). Ligado,
a planta ganha estas cotas:

1. **Fundo da loja**: da parede das máquinas até o drywall (área técnica
   + máquinas), com a largura e o comprimento dessa faixa.
2. **Mesa central**: largura × profundidade.
3. **Balcão**: largura × profundidade.
4. **Máquinas até a parede da porta (fachada)**: o espaço que sobra.
5. **Porta até a parede da esquerda** e **porta até a parede da direita**,
   ao longo da fachada.
6. **Balcão até a fachada** e **cadeiras até a fachada** (a fileira de
   cadeiras mais próxima).

## Approaches

1. Tudo sempre na aba Layout: descartada, o salão fica poluído.
2. Aba nova "Medidas" (página própria no PDF): sugerida, mas não escolhida.
3. **Botão "Mostrar medidas" ao lado de "Baixar PNG"**: escolhida pelo
   dono do negócio.

## Decisões minhas (revisar)

- O PNG e o PDF saem como está na tela: com o botão ligado, as medidas vão
  junto; desligado, não.
- Começa desligado e não é salvo (nem na reunião do cliente).
- Vale para as 4 abas da planta (Layout, Água e esgoto, Iluminação,
  Tomadas), com as mesmas medidas.
- Item que não existe no projeto (porta, mesa, balcão, cadeiras
  desligados) simplesmente não ganha medida.
- Loja com máquinas na lateral: o "fundo" é a faixa da parede lateral das
  máquinas até o drywall (comprimento = profundidade da loja); o item 4
  vira o espaço da última máquina até a fachada.
- Mesmo estilo de cota que a planta já usa (`Dimension`), em metros com
  duas casas.

## Não faz

- Medidas editáveis ou arrastáveis.
- Medidas no 3D.
- Medir outros móveis (totem, AC, pufes).

## Para o construtor

Posição exata de cada cota (dentro do salão ou por fora da parede) para
não encavalar texto; testes no `FloorPlan.test.tsx` contando as cotas e
os textos esperados.
