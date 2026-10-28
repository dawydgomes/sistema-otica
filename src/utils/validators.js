import { normalizarCNPJ, somenteDigitos } from './format';

export function validarCPF(valor) {
  const c = somenteDigitos(valor);
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const digito = (tamanho) => {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(c[i]) * (tamanho + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(c[9]) && digito(10) === Number(c[10]);
}

// Aceita o CNPJ numérico tradicional e o alfanumérico (letras valem código ASCII - 48).
export function validarCNPJ(valor) {
  const c = normalizarCNPJ(valor);
  if (!/^[0-9A-Z]{12}\d{2}$/.test(c) || /^(.)\1+$/.test(c)) return false;
  const digito = (tamanho) => {
    const pesos = tamanho === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = pesos.reduce((acc, peso, i) => acc + peso * (c.charCodeAt(i) - 48), 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return digito(12) === Number(c[12]) && digito(13) === Number(c[13]);
}

export const emailValido = (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
