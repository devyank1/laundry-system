import type { CatalogMachine } from "../engine/types";

export const CATALOG_SEED: CatalogMachine[] = [
  {
    id: "sq-stack",
    brand: "Speed Queen",
    model: "Stack 10",
    type: "stack",
    widthMm: 683,
    depthMm: 794,
    heightMm: 1986,
    breakerLavadoraA: 16,
    breakerSecadoraA: 32,
    cableMm2: "6mm² (≤4,5m) / 10mm² (>4,5m)",
    exhaustDiameterMm: 102, // 4" (Ebook Stack)
    exhaustHeightMm: 1695, // saída traseira, dimensão B do manual SSU/SSG
    drainLpm: 14,
    capacityKg: 10,
  },
  {
    id: "mamute-smart10",
    brand: "Mamute",
    model: "Smart 10",
    type: "stack",
    widthMm: 680,
    depthMm: 880,
    heightMm: 2040,
    breakerLavadoraA: 16,
    breakerSecadoraA: 40,
    cableMm2: "2x2,5mm² (lavadora) / 2x10mm² (secadora)",
    exhaustDiameterMm: 100,
    drainInch: '2"',
    weightKg: 250,
    capacityKg: 10,
  },
  {
    id: "mamute-smart17",
    brand: "Mamute",
    model: "Smart 17",
    type: "stack",
    widthMm: 835,
    depthMm: 1190,
    heightMm: 2210,
    exhaustDiameterMm: 150,
    drainInch: '3"',
    weightKg: 615,
    capacityKg: 17,
  },
  {
    // Book de Instalação NEXLAV LG Giant C + manual da secadora CDG27MUCES
    id: "lg-giant-c",
    brand: "LG",
    model: "Giant C Stack",
    type: "stack",
    widthMm: 686,
    depthMm: 764,
    heightMm: 1954,
    breakerLavadoraA: 16,
    breakerSecadoraA: 32,
    cableMm2: "6mm² (≤4,5m) / 10mm² (>4,5m)",
    exhaustDiameterMm: 102, // 4"
    drainInch: '2"', // PVC de 4 a 5 cm, boca a ~70 cm (máx. 1 m) do piso
    capacityKg: 10, // secadora 10 kg (gás 10,2); lavadora 10–13 kg
  },
  {
    // Manual da secadora CDT29MUCES + apresentação LG Titan
    id: "lg-titan",
    brand: "LG",
    model: "Titan Stack",
    type: "stack",
    widthMm: 737,
    depthMm: 814, // lavadora 814, secadora 810
    heightMm: 2040,
    breakerLavadoraA: 16,
    breakerSecadoraA: 32,
    cableMm2: "6mm² (≤4,5m) / 10mm² (>4,5m)",
    exhaustDiameterMm: 102, // 4"
    drainInch: '2"',
    capacityKg: 17, // lavadora 17 kg
    dryerCapacityKg: 13.6,
  },
  {
    // Ebook de Instalação Évora SSU/SSG + ficha SSU030 (pasta ssg)
    id: "sq-ssu030",
    brand: "Speed Queen",
    model: "Stack Elétrica (SSU/SSG)",
    type: "stack",
    widthMm: 797,
    depthMm: 1175,
    heightMm: 2023,
    cableMm2: "lavadora 220/60/1 · secadora 220/60/3 (21,4 kW)",
    exhaustDiameterMm: 203, // 8" por máquina (estação A do duto coletor)
    exhaustHeightMm: 1695, // saída traseira, dimensão B
    drainLpm: 40, // vazão máx. de entrada por máquina (2 entradas 3/4")
    concreteBaseMm: 200, // bloco de concreto 30 cm no solo + 20 cm acima do piso
    capacityKg: 14, // lavadora 14 kg / secadora 14 kg
  },
  {
    // Folheto Lavadoras_SYC180-280 (pasta ssg): lavadora-extratora com amortecimento
    id: "sq-syc180",
    brand: "Speed Queen",
    model: "Lavadora SYC180",
    type: "lavadora",
    widthMm: 970,
    depthMm: 960,
    heightMm: 1430,
    // Resumo de Instalação SYC180 com amortecimento (pasta maq): rede 220 V
    // trifásica 63 A tripolar / 10 mm² (380 V: 40 A, 6 mm², 3F+N+T), 18 kW
    breakerLavadoraA: 63,
    cableMm2: "220V 3F+T: 63A tripolar, 10mm² · 380V 3F+N+T: 40A, 6mm² · cabo PP 4 vias",
    powerKw: 18,
    plug: "Steck 3P+T",
    plugAmperage: 63,
    utilityPointHeightMm: 1500, // ponto elétrico e 2 pontos de água 3/4" atrás, a 1,50 m
    waterInletHeightMm: 1260, // entradas no alto da traseira (mangueiras de 1,20 m)
    drainInch: '3"', // válvula de descarga Ø 76 mm
    directDrain: true, // dreno direto com ventilação (sem efeito sifão)
    drainHeightMm: 75,
    drainLpm: 210, // vazão média da drenagem
    topClearanceMm: 1100, // folgas: 20 mm nas laterais, 500 mm atrás, 1100 mm acima
    weightKg: 380,
    concreteBaseMm: 350, // nicho do drywall a 35 cm do piso: topo a 1,78 m, igual à ST055
    baseDrywall: true,
    capacityKg: 20, // 20,1 kg (1:10), tambor 180 L
  },
  {
    // Folheto Secadoras_SUS30_ST035-75 (pasta ssg)
    id: "sq-st055",
    brand: "Speed Queen",
    model: "Secadora ST055",
    type: "secadora",
    widthMm: 870,
    depthMm: 1350,
    heightMm: 1700,
    // Resumo de Instalação ST055 aquecimento elétrico (pasta maq): rede 220 V
    // trifásica 80 A tripolar / 25 mm² (380 V: 63 A, 10 mm², 3F+N+T), 27 kW
    breakerSecadoraA: 80,
    cableMm2: "220V 3F+T: 80A tripolar, 25mm² · 380V 3F+N+T: 63A, 10mm² · cabo PP 4 vias",
    powerKw: 27,
    plug: "Steck 3P+T",
    plugAmperage: 63,
    utilityPointHeightMm: 1500,
    exhaustDiameterMm: 200,
    exhaustHeightMm: 145, // saída traseira embaixo: centro a 145 mm da base, 125 mm da lateral
    exhaustStepUpEveryMm: 3500, // +2" no duto a cada 3,5 m
    weightKg: 200, // elétrica
    concreteBaseMm: 80, // nicho do drywall a 8 cm do piso: topo a 1,78 m, igual à SYC180
    baseDrywall: true,
    capacityKg: 25, // 24 kg (1:22) a 27 kg (1:18), tambor 490 L
  },
];
