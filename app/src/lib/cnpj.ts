// CNPJ: só dígitos verificadores (sem consulta à Receita).
export function normalizeCnpj(v: string): string {
  return v.replace(/\D/g, "");
}

function checkDigit(digits: string, weights: number[]): number {
  const sum = weights.reduce((acc, w, i) => acc + Number(digits[i]) * w, 0);
  const r = sum % 11;
  return r < 2 ? 0 : 11 - r;
}

export function isValidCnpj(v: string): boolean {
  const d = normalizeCnpj(v);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, ...w1];
  return checkDigit(d, w1) === Number(d[12]) && checkDigit(d, w2) === Number(d[13]);
}

export function formatCnpj(v: string): string {
  const d = normalizeCnpj(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}
