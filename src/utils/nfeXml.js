// Leitura do XML de NF-e (arquivo procNFe enviado pelo fornecedor).
// O download automático das notas na SEFAZ (Distribuição DF-e) exige
// certificado digital e fica para a Fase 2, no backend.
import { mascaraCEP, mascaraCNPJ, mascaraTelefone } from './format';

const elemento = (pai, nome) => pai?.getElementsByTagNameNS('*', nome)[0] ?? null;
const texto = (pai, nome) => elemento(pai, nome)?.textContent?.trim() ?? '';
const numero = (pai, nome) => Number(texto(pai, nome)) || 0;

export function lerXmlNFe(conteudo) {
  const doc = new DOMParser().parseFromString(conteudo, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Arquivo XML inválido.');

  const inf = elemento(doc, 'infNFe');
  if (!inf) throw new Error('O arquivo não é uma NF-e (grupo infNFe não encontrado).');

  const ide = elemento(inf, 'ide');
  const emit = elemento(inf, 'emit');
  const ender = elemento(emit, 'enderEmit');

  const itens = [...inf.getElementsByTagNameNS('*', 'det')].map((det) => {
    const prod = elemento(det, 'prod');
    const ean = texto(prod, 'cEAN');
    return {
      codigo: texto(prod, 'cProd'),
      ean: /^\d+$/.test(ean) ? ean : '', // "SEM GTIN" vira vazio
      descricao: texto(prod, 'xProd'),
      ncm: texto(prod, 'NCM'),
      cfop: texto(prod, 'CFOP'),
      unidade: texto(prod, 'uCom'),
      quantidade: numero(prod, 'qCom'),
      valorUnitario: numero(prod, 'vUnCom'),
    };
  });

  const duplicatas = [...inf.getElementsByTagNameNS('*', 'dup')].map((dup, i) => ({
    numero: i + 1,
    vencimento: texto(dup, 'dVenc'),
    valor: numero(dup, 'vDup'),
  }));

  return {
    chave: (inf.getAttribute('Id') || '').replace(/^NFe/, ''),
    numero: texto(ide, 'nNF'),
    serie: texto(ide, 'serie'),
    dataEmissao: (texto(ide, 'dhEmi') || texto(ide, 'dEmi')).slice(0, 10),
    valorTotal: numero(elemento(inf, 'ICMSTot'), 'vNF'),
    fornecedor: {
      cnpj: mascaraCNPJ(texto(emit, 'CNPJ')),
      razaoSocial: texto(emit, 'xNome'),
      nomeFantasia: texto(emit, 'xFant'),
      ie: texto(emit, 'IE'),
      telefone: mascaraTelefone(texto(ender, 'fone')),
      email: '',
      contato: '',
      endereco: {
        cep: mascaraCEP(texto(ender, 'CEP')),
        logradouro: texto(ender, 'xLgr'),
        numero: texto(ender, 'nro'),
        complemento: texto(ender, 'xCpl'),
        bairro: texto(ender, 'xBairro'),
        cidade: texto(ender, 'xMun'),
        uf: texto(ender, 'UF'),
      },
    },
    itens,
    duplicatas,
  };
}
