/*
 * Modelo de retorno (ROI) da lavanderia — sem DOM, sem React.
 *
 * Port literal da calculadora de referência (go.speedqueen.com/CalculadoraROI):
 * monthly, financePlan, rampUtil, rampPayback e cumulativeSeries seguem a mesma
 * ordem de operações do original, para que as mesmas entradas deem os mesmos
 * valores (inclusive o arredondamento do total de infra e do custo fixo).
 */

export interface RoiEquip {
  /** título curto da linha ("Chassi grande 30") */
  nome: string;
  /** como ela é, em texto menor ("Chassi grande 30, 2 × 13,6 kg (SSG30/SSU30)") */
  modelo?: string;
  /** texto menor completo, no lugar do montado (modelo · bocas · cestos) */
  descricao?: string;
  /** bocas de lavagem por equipamento */
  wl: number;
  /** bocas de secagem por equipamento */
  ws: number;
  /** cestos por boca */
  cb: number;
  preco: number;
  qtd: number;
}

/** "fixo" = valor único; "maq" = valor × nº de equipamentos. */
export interface RoiInfra {
  nome: string;
  tipo: "fixo" | "maq";
  val: number;
}

export interface RoiFixo {
  nome: string;
  val: number;
}

export interface RoiState {
  equip: RoiEquip[];
  infra: RoiInfra[];
  fixo: RoiFixo[];
  op: {
    ciclos: number;
    /** % de utilização da secagem em relação à lavagem */
    utilSec: number;
    preco: number;
    dias: number;
    /** % de ocupação no mês 1 */
    rampIni: number;
    /** meses até atingir 100% */
    rampMeses: number;
  };
  cost: {
    cLav: number;
    cSec: number;
    /** % sobre a receita */
    imposto: number;
    anos: number;
    /** custo fixo mensal: começa como a soma arredondada de `fixo`, mas é editável */
    fixoTotal: number;
  };
  pay: {
    mode: "cash" | "fin";
    /** % de entrada */
    entrada: number;
    prazo: number;
    taxa: number;
    unit: "am" | "aa";
  };
}

export interface RoiMonthly {
  cLav: number;
  cSec: number;
  recMes: number;
  varMes: number;
  imp: number;
  margem: number;
  recPlena: number;
  bocas: number;
  ciclosMaq: number;
  cestosDia: number;
}

export interface RoiPlan {
  mode: "cash" | "fin";
  entrada: number;
  financiado: number;
  parcela: number;
  n: number;
  im: number;
  juros: number;
}

export interface RoiScenario {
  label: string;
  ciclos: number;
  margem: number;
  pb: number | null;
  series: number[];
}

export interface RoiResult {
  units: number;
  equip: number;
  infra: number;
  infraRaw: number;
  inv: number;
  equipRows: number[];
  infraRows: number[];
  plan: RoiPlan;
  full: RoiMonthly;
  scen: RoiScenario[];
  anos: number;
  months: number;
  /** payback com rampa, em meses (fracionário); null = não paga no horizonte */
  pb: number | null;
  /** investimento ÷ margem plena */
  pbSimples: number | null;
  /** margem plena × 12 ÷ investimento, em % */
  roi: number;
  /** caixa acumulado ao fim do horizonte */
  lucro: number;
  /** caixa acumulado mês a mês (índice 0 = hoje, igual a -entrada) */
  pts: number[];
  rev1: number;
  revY1: number;
  revMat: number;
  util1: number;
  custoOp: number;
}

export function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

export function sumFixo(fixo: RoiFixo[]): number {
  return Math.round(fixo.reduce((a, x) => a + x.val, 0));
}

export function defaultRoiState(): RoiState {
  const fixo: RoiFixo[] = [
    { nome: "Aluguel", val: 3500 },
    { nome: "Energia — base/área comum (sem máquinas)", val: 1200 },
    { nome: "Água — base/limpeza (sem máquinas)", val: 400 },
    { nome: "Internet + sistema", val: 300 },
    { nome: "Mão de obra / limpeza", val: 2000 },
    { nome: "Diversos", val: 600 },
  ];
  return {
    equip: [
      { nome: "Chassi pequeno", modelo: "Chassi pequeno, 2 × 10 kg (Speed Queen Stack 10)", wl: 1, ws: 1, cb: 1, preco: 37234, qtd: 3 },
      { nome: "Chassi grande 30", modelo: "Chassi grande 30, 2 × 13,6 kg (SSG30/SSU30)", wl: 1, ws: 1, cb: 2, preco: 71500, qtd: 2 },
      { nome: "Chassi grande 50", modelo: "Chassi grande 50, 2 × 22,7 kg", wl: 1, ws: 1, cb: 3, preco: 88723, qtd: 0 },
      {
        nome: "Lavadora 20kg e Secadora 25kg",
        modelo: "SYC180 + ST055",
        descricao: "SYC180 + ST055 · Lavadora-extratora 20 kg + secadora · 2 máquinas · 1 boca cada · 3 cesto(s) por boca",
        wl: 1,
        ws: 1,
        cb: 3,
        preco: 90014,
        qtd: 0,
      },
      { nome: "LG Giant C", modelo: "LG Giant C, 2 × 10 kg (Stack)", wl: 1, ws: 1, cb: 1, preco: 29900, qtd: 0 },
      { nome: "LG Titan", modelo: "LG Titan, 17 kg + 13,6 kg (Stack)", wl: 1, ws: 1, cb: 2, preco: 49900, qtd: 0 },
      { nome: "Mamute Smart 10", modelo: "Mamute Smart 10, 2 × 10 kg (Stack)", wl: 1, ws: 1, cb: 1, preco: 39900, qtd: 0 },
      { nome: "Mamute Smart 17", modelo: "Mamute Smart 17, 2 × 17 kg (Stack) · com dosadores", wl: 1, ws: 1, cb: 2, preco: 67000, qtd: 0 },
    ],
    infra: [
      { nome: "Projeto da loja", tipo: "fixo", val: 5000 },
      { nome: "Parede + porta de vidro", tipo: "fixo", val: 3000 },
      { nome: "Ar-condicionado (c/ instalação)", tipo: "fixo", val: 3500 },
      { nome: "Drywall", tipo: "fixo", val: 3000 },
      { nome: "M.O. pintura + material", tipo: "fixo", val: 2500 },
      { nome: "Adesivagem interna", tipo: "fixo", val: 1500 },
      { nome: "Diversos (alarme, internet, etc.)", tipo: "fixo", val: 1500 },
      { nome: "Sistema (maquininha)", tipo: "fixo", val: 4000 },
      { nome: "Caixa d’água 600L", tipo: "fixo", val: 900 },
      { nome: "Bomba pressurização (1CV)", tipo: "fixo", val: 1300 },
      { nome: "Acessórios e periféricos", tipo: "fixo", val: 600 },
      { nome: "Mesa de dobra", tipo: "fixo", val: 600 },
      { nome: "Poltronas plástico (3x)", tipo: "fixo", val: 380 },
      { nome: "Luminárias", tipo: "fixo", val: 600 },
      { nome: "Extras", tipo: "fixo", val: 1000 },
      { nome: "M.O. elétrica/hidráulica", tipo: "maq", val: 1350 },
      { nome: "Quadro elétrico + disjuntores", tipo: "maq", val: 300 },
      { nome: "Cabos elétricos", tipo: "maq", val: 420 },
      { nome: "Canaleta metálica + tomadas", tipo: "maq", val: 70 },
      { nome: "Tubulação água 1\" + conexões", tipo: "maq", val: 90 },
      { nome: "Tubulação esgoto PVC", tipo: "maq", val: 70 },
      { nome: "Tubulação exaustão galvanizado", tipo: "maq", val: 220 },
      { nome: "1ª compra de químicos", tipo: "maq", val: 300 },
      { nome: "Bombas dosadoras (2 × R$ 500 por máquina)", tipo: "maq", val: 1000 },
    ],
    fixo,
    op: { ciclos: 6, utilSec: 100, preco: 18, dias: 30, rampIni: 45, rampMeses: 12 },
    cost: { cLav: 4.5, cSec: 2.16, imposto: 10, anos: 5, fixoTotal: sumFixo(fixo) },
    pay: { mode: "cash", entrada: 20, prazo: 24, taxa: 2, unit: "am" },
  };
}

interface Totals {
  equip: number;
  cestosWash: number;
  cestosDry: number;
  pw: number;
  pd: number;
  nm: number;
  infra: number;
}

interface Ops {
  ciclosBocal: number;
  utilSec: number;
  precoCiclo: number;
  dias: number;
  custoFixo: number;
  custoLav: number;
  custoSec: number;
  imposto: number;
  anos: number;
  rampInicial: number;
  rampMeses: number;
}

function rampUtil(op: Ops, m: number): number {
  if (op.rampMeses <= 1) return 1;
  return Math.min(1, op.rampInicial + ((1 - op.rampInicial) * (m - 1)) / (op.rampMeses - 1));
}

function monthly(op: Ops, t: Totals, util: number): RoiMonthly {
  const cLav = Math.ceil(t.cestosWash * op.ciclosBocal);
  const cSec = Math.ceil(t.cestosDry * op.utilSec * op.ciclosBocal);
  const recDia = (cLav + cSec) * op.precoCiclo;
  const recMes = recDia * op.dias * util;
  const varMes = (op.custoLav * cLav + op.custoSec * cSec) * op.dias * util;
  const imp = recMes * op.imposto;
  const margem = recMes - varMes - op.custoFixo - imp;
  const bocas = t.pw + t.pd;
  const ciclosMaq = Math.round(t.pw * op.ciclosBocal + t.pd * op.ciclosBocal * op.utilSec);
  const cestosDia = cLav + cSec;
  return { cLav, cSec, recMes, varMes, imp, margem, recPlena: recDia * op.dias, bocas, ciclosMaq, cestosDia };
}

function financePlan(S: RoiState, inv: number): RoiPlan {
  if (S.pay.mode !== "fin") {
    return { mode: "cash", entrada: inv, financiado: 0, parcela: 0, n: 0, im: 0, juros: 0 };
  }
  const eP = Math.min(100, Math.max(0, num(S.pay.entrada))) / 100;
  const entrada = inv * eP;
  const financiado = inv - entrada;
  const n = Math.max(1, Math.round(num(S.pay.prazo) || 1));
  let im = num(S.pay.taxa) / 100;
  if (S.pay.unit === "aa") im = Math.pow(1 + im, 1 / 12) - 1;
  const parcela = im > 0 ? (financiado * im) / (1 - Math.pow(1 + im, -n)) : financiado / n;
  const juros = parcela * n - financiado;
  return { mode: "fin", entrada, financiado, parcela, n, im, juros };
}

export function computeRoi(S: RoiState): RoiResult {
  let equip = 0;
  let cestosWash = 0;
  let cestosDry = 0;
  let pw = 0;
  let pd = 0;
  let nm = 0;
  const equipRows = S.equip.map((e) => {
    const q = num(e.qtd);
    const p = num(e.preco);
    const wl = num(e.wl);
    const ws = num(e.ws);
    const cb = num(e.cb);
    equip += q * p;
    nm += q;
    pw += q * wl;
    pd += q * ws;
    cestosWash += q * wl * cb;
    cestosDry += q * ws * cb;
    return q * p;
  });

  // itens "por máquina" × nº de equipamentos; o total entra arredondado em reais
  let infraRaw = 0;
  const infraRows = S.infra.map((it) => {
    const c = it.tipo === "maq" ? num(it.val) * nm : num(it.val);
    infraRaw += c;
    return c;
  });
  const t: Totals = { equip, cestosWash, cestosDry, pw, pd, nm, infra: Math.round(infraRaw) };

  const op: Ops = {
    ciclosBocal: num(S.op.ciclos),
    utilSec: num(S.op.utilSec) / 100,
    precoCiclo: num(S.op.preco),
    dias: num(S.op.dias),
    custoFixo: num(S.cost.fixoTotal),
    custoLav: num(S.cost.cLav),
    custoSec: num(S.cost.cSec),
    imposto: num(S.cost.imposto) / 100,
    anos: Math.min(1000, num(S.cost.anos)), // trava de segurança, só pra não travar a aba
    rampInicial: num(S.op.rampIni) / 100,
    rampMeses: Math.max(1, num(S.op.rampMeses)),
  };

  function rampPayback(o: Ops, inv: number): number | null {
    const f = financePlan(S, inv);
    let acc = -f.entrada;
    let prev: number;
    const maxM = Math.max(120, o.anos * 12);
    for (let m = 1; m <= maxM; m++) {
      const util = rampUtil(o, m);
      const parc = m <= f.n ? f.parcela : 0;
      const step = monthly(o, t, util).margem - parc;
      prev = acc;
      acc += step;
      if (prev < 0 && acc >= 0) return m - 1 + (step > 0 ? -prev / step : 0);
    }
    return null;
  }
  function cumulativeSeries(o: Ops, inv: number, months: number): number[] {
    const f = financePlan(S, inv);
    const arr: number[] = [];
    let acc = -f.entrada;
    for (let m = 1; m <= months; m++) {
      const util = rampUtil(o, m);
      const parc = m <= f.n ? f.parcela : 0;
      acc += monthly(o, t, util).margem - parc;
      arr.push(acc);
    }
    return arr;
  }

  const inv = t.equip + t.infra;
  const plan = financePlan(S, inv);
  const full = monthly(op, t, 1);
  const pb = rampPayback(op, inv);
  const pbSimples = full.margem > 0 ? inv / full.margem : null;
  const roi = inv > 0 ? ((full.margem * 12) / inv) * 100 : 0;

  const months = op.anos * 12;
  const series = cumulativeSeries(op, inv, months);
  const pts = [-plan.entrada, ...series];
  const lucro = series.length ? series[series.length - 1] : -plan.entrada;

  const u1 = rampUtil(op, 1);
  const rev1 = monthly(op, t, u1).recMes;
  let revY1 = 0;
  for (let m = 1; m <= 12; m++) revY1 += monthly(op, t, rampUtil(op, m)).recMes;

  const scen: RoiScenario[] = (
    [
      ["Conservador", -1],
      ["Realista", 0],
      ["Otimista", 1],
    ] as const
  ).map(([label, d]) => {
    const o: Ops = { ...op, ciclosBocal: Math.max(1, op.ciclosBocal + d) };
    const mo = monthly(o, t, 1);
    return {
      label,
      ciclos: o.ciclosBocal,
      margem: mo.margem,
      pb: rampPayback(o, inv),
      series: [-plan.entrada, ...cumulativeSeries(o, inv, months)],
    };
  });

  return {
    units: nm,
    equip,
    infra: t.infra,
    infraRaw,
    inv,
    equipRows,
    infraRows,
    plan,
    full,
    scen,
    anos: op.anos,
    months,
    pb,
    pbSimples,
    roi,
    lucro,
    pts,
    rev1,
    revY1,
    revMat: full.recMes * 12,
    util1: u1,
    custoOp: full.varMes + op.custoFixo,
  };
}
