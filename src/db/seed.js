import { listar, salvar, transacao } from './database';
import { addDias, addMeses, hojeISO } from '../utils/format';

export async function garantirUsuarioPadrao() {
  const usuarios = await listar('usuarios');
  if (!usuarios.length) {
    await salvar('usuarios', { login: 'admin', senha: 'admin', nome: 'Administrador', perfil: 'admin' });
  }
}

const receita = (data, medico, od, oe) => ({
  id: `rx-${data}`,
  data,
  medico,
  od: { esferico: od[0], cilindrico: od[1], eixo: od[2], adicao: od[3] ?? '', dnp: '31', altura: '20' },
  oe: { esferico: oe[0], cilindrico: oe[1], eixo: oe[2], adicao: oe[3] ?? '', dnp: '31,5', altura: '20' },
  observacoes: '',
});

const endereco = (logradouro, numero, bairro) => ({
  cep: '01310-100',
  logradouro,
  numero,
  complemento: '',
  bairro,
  cidade: 'São Paulo',
  uf: 'SP',
});

/** Dados fictícios para demonstração do dashboard e dos módulos. */
export async function carregarDadosExemplo() {
  const hoje = hojeISO();
  await transacao(['fornecedores', 'produtos', 'clientes', 'vendas', 'contas'], async (tx) => {
    const forn = tx.put('fornecedores', {
      razaoSocial: 'Distribuidora Visão Exemplo Ltda',
      nomeFantasia: 'Visão Distribuidora',
      cnpj: '11.222.333/0001-81',
      ie: '',
      telefone: '(11) 3333-4444',
      email: 'vendas@visaoexemplo.com.br',
      contato: 'Marcos',
      endereco: endereco('Rua das Lentes', '100', 'Centro'),
      criadoEm: hoje,
    });

    const p = (descricao, categoria, custo, venda, estoque, minimo, marca = '') =>
      tx.put('produtos', {
        codigo: '',
        codigoFornecedor: '',
        fornecedorId: forn.id,
        ean: '',
        descricao,
        categoria,
        marca,
        ncm: categoria === 'servico' ? '' : '90031100',
        unidade: 'UN',
        precoCusto: custo,
        precoVenda: venda,
        estoque,
        estoqueMinimo: minimo,
      });
    const armacao = p('Armação acetato preta 52-18', 'armacao', 120, 349.9, 12, 5, 'Exemplo Eyewear');
    const lente = p('Lente multifocal 1.67 antirreflexo (par)', 'lente', 380, 1290, 6, 4, 'Exemplo Lens');
    p('Armação metal dourada 50-19', 'armacao', 95, 299.9, 2, 4, 'Exemplo Eyewear');
    p('Lente de contato mensal (cx 6)', 'lente_contato', 60, 149.9, 15, 6);
    p('Óculos de sol polarizado', 'solar', 140, 459.9, 3, 3);
    p('Estojo + flanela', 'acessorio', 8, 29.9, 40, 10);
    p('Montagem e ajuste', 'servico', 0, 80, 0, 0);

    const c = (nome, cpf, whatsapp, rx) =>
      tx.put('clientes', {
        nome,
        cpf,
        rg: '',
        dataNascimento: '',
        telefone: whatsapp,
        whatsapp,
        aceitaWhatsApp: true,
        email: '',
        endereco: endereco('Av. Paulista', '1000', 'Bela Vista'),
        receitas: rx ? [rx] : [],
        observacoes: '',
        criadoEm: hoje,
      });
    const ana = c('Ana Souza (exemplo)', '529.982.247-25', '(11) 98888-1111', receita(addMeses(hoje, -11), 'Dr. Paulo Lima', ['-2,00', '-0,50', '180'], ['-1,75', '-0,75', '175']));
    const bruno = c('Bruno Ferreira (exemplo)', '', '(11) 97777-2222', receita(addMeses(hoje, -12), 'Dra. Carla Reis', ['+1,25', '', '', '+2,00'], ['+1,50', '', '', '+2,00']));
    c('Carla Mendes (exemplo)', '', '(11) 96666-3333', null);

    const venda = (numero, dataVenda, cli, itens, forma, vencimentoOculos) => {
      const total = itens.reduce((s, i) => s + i.quantidade * i.valorUnitario, 0);
      return tx.put('vendas', {
        numero,
        data: dataVenda,
        clienteId: cli.id,
        clienteNome: cli.nome,
        itens,
        subtotal: total,
        desconto: 0,
        total,
        formaPagamento: forma,
        parcelas: [],
        receitaId: cli.receitas[0]?.id ?? null,
        vencimentoOculos,
        vendedor: 'Administrador',
        nfe: null,
      });
    };
    const item = (prod) => ({ produtoId: prod.id, descricao: prod.descricao, quantidade: 1, valorUnitario: prod.precoVenda });
    venda(1, addMeses(hoje, -11), ana, [item(armacao), item(lente)], 'credito', addDias(hoje, 20));
    venda(2, addMeses(hoje, -12), bruno, [item(lente)], 'pix', addDias(hoje, -5));

    // Histórico financeiro dos últimos 6 meses (valores fictícios).
    const receitas = [8200, 9100, 7600, 10400, 11800, 6900];
    const despesas = [6100, 7300, 6800, 7200, 8900, 4100];
    for (let i = 0; i < 6; i++) {
      const dia = addDias(addMeses(hoje, i - 5), -Math.min(i, 3));
      const pagoEm = dia > hoje ? hoje : dia;
      const conta = (tipo, descricao, valor, categoria) =>
        tx.put('contas', { tipo, descricao, valor, vencimento: pagoEm, pagoEm, valorPago: valor, categoria, pessoaId: null, pessoaNome: '', origem: { tipo: 'exemplo' } });
      conta('receber', 'Vendas do período (exemplo)', receitas[i], 'Vendas');
      conta('pagar', 'Despesas do período (exemplo)', despesas[i], 'Despesas gerais');
    }
    const aberta = (tipo, descricao, valor, vencimento, pessoaNome, categoria) =>
      tx.put('contas', { tipo, descricao, valor, vencimento, pagoEm: null, valorPago: null, categoria, pessoaId: null, pessoaNome, origem: { tipo: 'exemplo' } });
    aberta('receber', 'Crediário Ana Souza (2/3)', 430, addDias(hoje, 12), ana.nome, 'Crediário');
    aberta('receber', 'Crediário Bruno Ferreira (3/3)', 280, addDias(hoje, -8), bruno.nome, 'Crediário');
    aberta('pagar', 'Aluguel da loja', 3500, addDias(hoje, 5), 'Imobiliária', 'Aluguel');
    aberta('pagar', 'NF 1234 - Visão Distribuidora (1/2)', 1850, addDias(hoje, 18), forn.nomeFantasia, 'Compra de mercadorias');
  });
}
