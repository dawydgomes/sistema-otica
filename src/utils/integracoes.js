// Integrações que funcionam direto do navegador (sem backend).
import { mascaraCEP, mascaraCNPJ, mascaraTelefone, normalizarCNPJ, somenteDigitos } from './format';

async function obterJSON(url) {
  let resposta;
  try {
    resposta = await fetch(url);
  } catch {
    throw new Error('Sem conexão com o serviço de consulta.');
  }
  if (resposta.status === 404) throw new Error('Não encontrado.');
  if (!resposta.ok) throw new Error('Falha na consulta. Tente novamente.');
  return resposta.json();
}

export async function buscarCEP(cep) {
  const j = await obterJSON(`https://brasilapi.com.br/api/cep/v1/${somenteDigitos(cep)}`);
  return {
    cep: mascaraCEP(j.cep),
    logradouro: j.street || '',
    bairro: j.neighborhood || '',
    cidade: j.city || '',
    uf: j.state || '',
  };
}

// Dados públicos da Receita Federal para CNPJ (CPF não tem consulta pública).
export async function buscarCNPJ(cnpj) {
  const j = await obterJSON(`https://brasilapi.com.br/api/cnpj/v1/${normalizarCNPJ(cnpj)}`);
  return {
    cnpj: mascaraCNPJ(j.cnpj),
    razaoSocial: j.razao_social || '',
    nomeFantasia: j.nome_fantasia || '',
    telefone: mascaraTelefone(j.ddd_telefone_1 || ''),
    email: (j.email || '').toLowerCase(),
    situacao: j.descricao_situacao_cadastral || '',
    endereco: {
      cep: mascaraCEP(String(j.cep || '')),
      logradouro: [j.descricao_tipo_de_logradouro, j.logradouro].filter(Boolean).join(' '),
      numero: j.numero || '',
      complemento: j.complemento || '',
      bairro: j.bairro || '',
      cidade: j.municipio || '',
      uf: j.uf || '',
    },
  };
}

// Fase 1: abre o WhatsApp com a mensagem pronta (envio manual).
// Fase 2: envio automático pela API oficial do WhatsApp Business via backend.
export function linkWhatsApp(telefone, mensagem = '') {
  let numero = somenteDigitos(telefone);
  if (numero.length < 10) return null;
  if (numero.length <= 11) numero = `55${numero}`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}
