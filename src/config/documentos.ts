/**
 * Documentos brasileiros: normalização, validação dos dígitos verificadores,
 * formatação e máscara (dados-pessoais.md: CPF aparece mascarado). Puro: usado
 * no servidor e no navegador.
 */

export const soDigitos = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

function digitosRepetidos(d: string) {
  return /^(\d)\1+$/.test(d);
}

export function cpfValido(valor: string): boolean {
  const d = soDigitos(valor);
  if (d.length !== 11 || digitosRepetidos(d)) return false;
  const dv = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

export function cnpjValido(valor: string): boolean {
  const d = soDigitos(valor);
  if (d.length !== 14 || digitosRepetidos(d)) return false;
  const dv = (n: number) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = pesos.reduce((s, p, i) => s + Number(d[i]) * p, 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === Number(d[12]) && dv(13) === Number(d[13]);
}

/**
 * CNPJ completo a partir do que a Receita informa sobre um sócio pessoa
 * jurídica: o próprio CNPJ (14 dígitos) ou só a raiz (8 dígitos), da qual se
 * monta o da matriz (filial 0001 + dígitos verificadores). Inválido: null.
 */
export function cnpjDoSocio(informado: string): string | null {
  const d = soDigitos(informado);
  if (d.length === 14) return cnpjValido(d) ? d : null;
  if (d.length !== 8) return null;
  const base = `${d}0001`;
  const dv = (num: string) => {
    const pesos =
      num.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const r = pesos.reduce((soma, p, i) => soma + Number(num[i]) * p, 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const com1 = `${base}${dv(base)}`;
  const cnpj = `${com1}${dv(com1)}`;
  return cnpjValido(cnpj) ? cnpj : null;
}

export const cepValido = (valor: string) => soDigitos(valor).length === 8;

export const formatarCnpj = (v: string) =>
  soDigitos(v).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

export const formatarCpf = (v: string) =>
  soDigitos(v).replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");

/**
 * Enquanto a pessoa digita: guarda no máximo os dígitos do documento (CNPJ 14,
 * CPF 11) e vai pondo a pontuação conforme digita.
 */
export function digitandoCnpj(v: string): string {
  const d = soDigitos(v).slice(0, 14);
  return [
    d.slice(0, 2),
    d.slice(2, 5) && `.${d.slice(2, 5)}`,
    d.slice(5, 8) && `.${d.slice(5, 8)}`,
    d.slice(8, 12) && `/${d.slice(8, 12)}`,
    d.slice(12) && `-${d.slice(12)}`,
  ].join("");
}
export function digitandoCpf(v: string): string {
  const d = soDigitos(v).slice(0, 11);
  return [
    d.slice(0, 3),
    d.slice(3, 6) && `.${d.slice(3, 6)}`,
    d.slice(6, 9) && `.${d.slice(6, 9)}`,
    d.slice(9) && `-${d.slice(9)}`,
  ].join("");
}

export const formatarCep = (v: string) => soDigitos(v).replace(/^(\d{5})(\d{3})$/, "$1-$2");

/** CPF mascarado: só os dígitos do meio aparecem (ex.: ***.456.789-**). */
export function mascararCpf(v: string): string {
  const d = soDigitos(v);
  return d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : "***";
}

/** Outros documentos (RG, passaporte): só os 2 últimos caracteres aparecem. */
export function mascararDocumento(v: string): string {
  const t = v.trim();
  return t.length <= 2 ? "***" : `${"*".repeat(Math.min(6, t.length - 2))}${t.slice(-2)}`;
}
