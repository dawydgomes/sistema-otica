// Regras de negócio que mexem em mais de uma coleção ao mesmo tempo.
// Cada operação roda numa transação: se algo falhar, nada é gravado.
import { novoId, transacao } from '../db/database';
import { addDias, addMeses, arredondar, hojeISO, normalizarCNPJ } from '../utils/format';
import { FORMAS_A_VISTA, FORMAS_PAGAMENTO } from './constantes';

export function dividirParcelas(total, quantidade, primeiroVencimento) {
  const n = Math.max(1, Number(quantidade) || 1);
  const base = Math.floor((total / n) * 100) / 100;
  return Array.from({ length: n }, (_, i) => ({
    numero: i + 1,
    vencimento: addMeses(primeiroVencimento, i),
    valor: i === n - 1 ? arredondar(total - base * (n - 1)) : base, // centavos na última
  }));
}

const sufixoParcela = (p, total) => (total > 1 ? ` (${p.numero}/${total})` : '');

/**
 * Entrada de mercadorias: cadastra/atualiza fornecedor e produtos,
 * soma o estoque e gera as contas a pagar (uma por parcela/duplicata).
 */
export async function registrarEntrada({ fornecedor, nota, itens, parcelas }) {
  if (!itens.length) throw new Error('Inclua ao menos um item.');
  if (itens.some((i) => !(i.quantidade > 0))) throw new Error('Todas as quantidades devem ser maiores que zero.');
  const totalItens = arredondar(itens.reduce((s, i) => s + i.quantidade * i.valorUnitario, 0));
  const valorTotal = arredondar(nota.valorTotal || totalItens);
  const somaParcelas = arredondar(parcelas.reduce((s, p) => s + Number(p.valor), 0));
  if (Math.abs(somaParcelas - valorTotal) > 0.01) {
    throw new Error(`A soma das parcelas (${somaParcelas.toFixed(2)}) difere do total da nota (${valorTotal.toFixed(2)}).`);
  }

  return transacao(['fornecedores', 'produtos', 'movimentacoes', 'entradas', 'contas'], async (tx) => {
    if (nota.chave) {
      const entradas = await tx.getAll('entradas');
      if (entradas.some((e) => e.chave === nota.chave)) throw new Error('Esta nota já foi lançada.');
    }

    let forn = fornecedor.id ? await tx.get('fornecedores', fornecedor.id) : null;
    if (!forn) {
      const cnpj = normalizarCNPJ(fornecedor.cnpj);
      const todos = await tx.getAll('fornecedores');
      forn = (cnpj && todos.find((f) => normalizarCNPJ(f.cnpj) === cnpj)) || tx.put('fornecedores', { ...fornecedor, criadoEm: hojeISO() });
    }
    const nomeFornecedor = forn.nomeFantasia || forn.razaoSocial;

    const entradaId = novoId();
    const dataMov = nota.dataEmissao || hojeISO();
    const produtos = await tx.getAll('produtos');
    const itensGravados = [];

    for (const item of itens) {
      const idx = produtos.findIndex((p) =>
        item.produtoId
          ? p.id === item.produtoId
          : (item.ean && p.ean === item.ean) ||
            (item.codigo && p.fornecedorId === forn.id && p.codigoFornecedor === item.codigo),
      );
      const base =
        idx >= 0
          ? produtos[idx]
          : {
              codigo: item.codigo || '',
              codigoFornecedor: item.codigo || '',
              fornecedorId: forn.id,
              ean: item.ean || '',
              descricao: item.descricao,
              categoria: item.categoria || 'acessorio',
              marca: '',
              ncm: item.ncm || '',
              unidade: item.unidade || 'UN',
              precoVenda: item.precoVenda || arredondar(item.valorUnitario * 2),
              estoque: 0,
              estoqueMinimo: 0,
            };
      const gravado = tx.put('produtos', {
        ...base,
        estoque: (Number(base.estoque) || 0) + item.quantidade,
        precoCusto: item.valorUnitario,
      });
      if (idx >= 0) produtos[idx] = gravado;
      else produtos.push(gravado);

      tx.put('movimentacoes', {
        produtoId: gravado.id,
        tipo: 'entrada',
        quantidade: item.quantidade,
        data: dataMov,
        origem: { tipo: 'entrada', id: entradaId },
      });
      itensGravados.push({ produtoId: gravado.id, descricao: gravado.descricao, quantidade: item.quantidade, valorUnitario: item.valorUnitario });
    }

    const entrada = tx.put('entradas', {
      id: entradaId,
      fornecedorId: forn.id,
      fornecedorNome: nomeFornecedor,
      numero: nota.numero || '',
      serie: nota.serie || '',
      chave: nota.chave || '',
      dataEmissao: dataMov,
      dataEntrada: hojeISO(),
      valorTotal,
      itens: itensGravados,
      parcelas,
    });

    for (const p of parcelas) {
      tx.put('contas', {
        tipo: 'pagar',
        descricao: `NF ${nota.numero || 's/n'} - ${nomeFornecedor}${sufixoParcela(p, parcelas.length)}`,
        valor: arredondar(p.valor),
        vencimento: p.vencimento,
        pagoEm: null,
        valorPago: null,
        categoria: 'Compra de mercadorias',
        pessoaId: forn.id,
        pessoaNome: nomeFornecedor,
        origem: { tipo: 'entrada', id: entradaId },
      });
    }
    return entrada;
  });
}

/**
 * Venda no PDV: baixa estoque e gera contas a receber.
 * À vista → já entra como recebida. Cartão de crédito/crediário → parcelas em aberto.
 */
export async function registrarVenda({
  cliente,
  itens,
  desconto = 0,
  formaPagamento,
  parcelas = 1,
  primeiroVencimento,
  receitaId = null,
  vencimentoOculos = null,
  usuario,
}) {
  if (!itens.length) throw new Error('O carrinho está vazio.');
  if (formaPagamento === 'crediario' && !cliente) throw new Error('Crediário exige um cliente selecionado.');
  const subtotal = arredondar(itens.reduce((s, i) => s + i.quantidade * i.valorUnitario, 0));
  const total = arredondar(subtotal - (Number(desconto) || 0));
  if (total <= 0) throw new Error('O total da venda deve ser maior que zero.');

  return transacao(['produtos', 'movimentacoes', 'vendas', 'contas'], async (tx) => {
    const vendaId = novoId();
    const hoje = hojeISO();

    for (const item of itens) {
      const p = await tx.get('produtos', item.produtoId);
      if (!p) throw new Error(`Produto não encontrado: ${item.descricao}`);
      if (p.categoria === 'servico') continue;
      if ((p.estoque || 0) < item.quantidade) {
        throw new Error(`Estoque insuficiente para "${p.descricao}" (disponível: ${p.estoque || 0}).`);
      }
      tx.put('produtos', { ...p, estoque: p.estoque - item.quantidade });
      tx.put('movimentacoes', {
        produtoId: p.id,
        tipo: 'saida',
        quantidade: item.quantidade,
        data: hoje,
        origem: { tipo: 'venda', id: vendaId },
      });
    }

    const vendas = await tx.getAll('vendas');
    const numero = vendas.reduce((max, v) => Math.max(max, v.numero || 0), 0) + 1;
    const clienteNome = cliente?.nome ?? 'Consumidor final';

    const aVista = FORMAS_A_VISTA.includes(formaPagamento);
    const listaParcelas = aVista
      ? [{ numero: 1, vencimento: hoje, valor: total }]
      : dividirParcelas(total, parcelas, primeiroVencimento || addDias(hoje, 30));

    const venda = tx.put('vendas', {
      id: vendaId,
      numero,
      data: hoje,
      clienteId: cliente?.id ?? null,
      clienteNome,
      itens,
      subtotal,
      desconto: arredondar(desconto),
      total,
      formaPagamento,
      parcelas: listaParcelas,
      receitaId,
      vencimentoOculos,
      vendedor: usuario?.nome ?? '',
      nfe: null, // Fase 2: dados da NF-e/NFC-e emitida
    });

    for (const p of listaParcelas) {
      tx.put('contas', {
        tipo: 'receber',
        descricao: `Venda #${numero} - ${clienteNome}${sufixoParcela(p, listaParcelas.length)}`,
        valor: p.valor,
        vencimento: p.vencimento,
        pagoEm: aVista ? hoje : null,
        valorPago: aVista ? p.valor : null,
        categoria: FORMAS_PAGAMENTO[formaPagamento],
        pessoaId: cliente?.id ?? null,
        pessoaNome: clienteNome,
        origem: { tipo: 'venda', id: vendaId },
      });
    }
    return venda;
  });
}

export async function baixarConta(id, dataPagamento = hojeISO()) {
  return transacao(['contas'], async (tx) => {
    const conta = await tx.get('contas', id);
    return tx.put('contas', { ...conta, pagoEm: dataPagamento, valorPago: conta.valor });
  });
}

export async function estornarConta(id) {
  return transacao(['contas'], async (tx) => {
    const conta = await tx.get('contas', id);
    return tx.put('contas', { ...conta, pagoEm: null, valorPago: null });
  });
}

export async function lancarContas({ tipo, descricao, valor, vencimento, parcelas, categoria, pessoaNome }) {
  const lista = dividirParcelas(arredondar(valor), parcelas, vencimento);
  return transacao(['contas'], async (tx) =>
    lista.map((p) =>
      tx.put('contas', {
        tipo,
        descricao: descricao + sufixoParcela(p, lista.length),
        valor: p.valor,
        vencimento: p.vencimento,
        pagoEm: null,
        valorPago: null,
        categoria,
        pessoaId: null,
        pessoaNome,
        origem: { tipo: 'manual' },
      }),
    ),
  );
}

export async function ajustarEstoque(produtoId, novaQuantidade, motivo) {
  return transacao(['produtos', 'movimentacoes'], async (tx) => {
    const p = await tx.get('produtos', produtoId);
    const diferenca = novaQuantidade - (p.estoque || 0);
    if (diferenca === 0) return p;
    tx.put('movimentacoes', {
      produtoId,
      tipo: 'ajuste',
      quantidade: diferenca,
      data: hojeISO(),
      motivo,
      origem: { tipo: 'ajuste' },
    });
    return tx.put('produtos', { ...p, estoque: novaQuantidade });
  });
}
