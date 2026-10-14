
## 22:31 | main
Feat `orientation="side"` em layout (espaço virtual transposto) nos arquivos types/layout/constraints/projectStore/ControlPanel/FloorPlan; build limpo e 96/96 testes passando com `orientation="back"`, mas os testes de `side` em `layout.test.ts` ainda não foram rodados.
## 22:36 | main
Commitado `d415cb0`: select "Orientação" no ControlPanel (fileira na parede lateral) com planta 2D girando, testes 109/109 e build limpo; 3D ainda não acompanha (parede/porta fixas), e a checagem visual manual na planta 2D está pendente com o user.