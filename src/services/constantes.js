export const CATEGORIAS_PRODUTO = {
  armacao: 'Armação',
  lente: 'Lente oftálmica',
  lente_contato: 'Lente de contato',
  solar: 'Óculos de sol',
  acessorio: 'Acessório',
  servico: 'Serviço',
};

// Categorias que compõem um óculos/lente: a venda delas gera "vencimento do óculos".
export const CATEGORIAS_COM_VENCIMENTO = ['armacao', 'lente', 'lente_contato'];

// Sugere a categoria de um produto novo (vindo do XML) pelo NCM.
export function categoriaPorNCM(ncm = '') {
  if (ncm.startsWith('9003')) return 'armacao';
  if (ncm.startsWith('9004')) return 'solar';
  if (ncm.startsWith('900130')) return 'lente_contato';
  if (ncm.startsWith('900140') || ncm.startsWith('900150')) return 'lente';
  return 'acessorio';
}

export const FORMAS_PAGAMENTO = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  debito: 'Cartão de débito',
  credito: 'Cartão de crédito',
  crediario: 'Crediário',
};

export const FORMAS_A_VISTA = ['dinheiro', 'pix', 'debito'];

export const UFS = 'AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' ');
