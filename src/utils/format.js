const formatoMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const moeda = (valor) => formatoMoeda.format(Number(valor) || 0);
export const arredondar = (v) => Math.round((Number(v) || 0) * 100) / 100;
export const somenteDigitos = (s = '') => String(s).replace(/\D/g, '');

// ---------- Datas (sempre strings 'AAAA-MM-DD' no fuso local) ----------
const paraData = (iso) => {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(a, m - 1, d);
};

export function isoLocal(data) {
  const ajustada = new Date(data.getTime() - data.getTimezoneOffset() * 60000);
  return ajustada.toISOString().slice(0, 10);
}

export const hojeISO = () => isoLocal(new Date());

export function addDias(iso, n) {
  const d = paraData(iso);
  d.setDate(d.getDate() + n);
  return isoLocal(d);
}

export function addMeses(iso, n) {
  const d = paraData(iso);
  const dia = d.getDate();
  d.setMonth(d.getMonth() + n);
  if (d.getDate() !== dia) d.setDate(0); // 31/01 + 1 mês = 28/02
  return isoLocal(d);
}

export function data(iso) {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

export const diasAte = (iso) => Math.round((paraData(iso) - paraData(hojeISO())) / 86400000);

export function nomeMes(chave) {
  const [a, m] = chave.split('-').map(Number);
  const texto = new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
  return texto.replace('.', '');
}

// ---------- Máscaras ----------
export function mascaraCPF(v) {
  return somenteDigitos(v)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

// CNPJ alfanumérico (vigente desde jul/2026): 12 posições letras/números + 2 dígitos verificadores.
export const normalizarCNPJ = (v = '') => String(v).toUpperCase().replace(/[^0-9A-Z]/g, '');

export function mascaraCNPJ(v) {
  const c = normalizarCNPJ(v).slice(0, 14);
  const partes = [c.slice(0, 2), c.slice(2, 5), c.slice(5, 8), c.slice(8, 12), c.slice(12, 14)];
  return ['', '.', '.', '/', '-'].reduce((txt, sep, i) => (partes[i] ? txt + sep + partes[i] : txt), '');
}

export function mascaraTelefone(v) {
  const d = somenteDigitos(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  const corte = d.length === 11 ? 7 : 6;
  return `(${d.slice(0, 2)}) ${d.slice(2, corte)}-${d.slice(corte)}`;
}

export function mascaraCEP(v) {
  const d = somenteDigitos(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}
