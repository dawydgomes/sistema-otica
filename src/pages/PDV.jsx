import { useMemo, useState } from 'react';
import { FileText, MessageCircle, Minus, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useColecao } from '../hooks/useColecao';
import { Aviso, Busca, Cabecalho, Campo, Modal, normalizar, Vazio } from '../components/ui';
import { CATEGORIAS_COM_VENCIMENTO, CATEGORIAS_PRODUTO, FORMAS_A_VISTA, FORMAS_PAGAMENTO } from '../services/constantes';
import { registrarVenda } from '../services/negocio';
import { addDias, addMeses, arredondar, data, hojeISO, moeda } from '../utils/format';
import { linkWhatsApp } from '../utils/integracoes';

export default function PDV() {
  const { usuario } = useAuth();
  const { dados: produtos } = useColecao('produtos');
  const { dados: clientes } = useColecao('clientes');
  const { dados: vendas } = useColecao('vendas');

  const [busca, setBusca] = useState('');
  const [carrinho, setCarrinho] = useState([]);
  const [clienteId, setClienteId] = useState('');
  const [receitaId, setReceitaId] = useState('');
  const [desconto, setDesconto] = useState(0);
  const [forma, setForma] = useState('pix');
  const [parcelas, setParcelas] = useState(1);
  const [primeiroVencimento, setPrimeiroVencimento] = useState(addDias(hojeISO(), 30));
  const [vencimentoEditado, setVencimentoEditado] = useState(null);
  const [erro, setErro] = useState('');
  const [finalizando, setFinalizando] = useState(false);
  const [vendaConcluida, setVendaConcluida] = useState(null);

  const cliente = clientes.find((c) => c.id === clienteId) ?? null;
  const receitas = [...(cliente?.receitas ?? [])].sort((a, b) => b.data.localeCompare(a.data));

  const resultados = useMemo(() => {
    const termo = normalizar(busca.trim());
    if (!termo) return [];
    return produtos.filter((p) => normalizar(`${p.descricao} ${p.codigo} ${p.ean} ${p.marca}`).includes(termo)).slice(0, 30);
  }, [produtos, busca]);

  const subtotal = arredondar(carrinho.reduce((s, i) => s + i.quantidade * i.valorUnitario, 0));
  const total = arredondar(subtotal - (Number(desconto) || 0));
  const temOculos = carrinho.some((i) => CATEGORIAS_COM_VENCIMENTO.includes(i.categoria));
  const vencimentoOculos = vencimentoEditado ?? (temOculos ? addMeses(hojeISO(), 12) : '');
  const parcelado = !FORMAS_A_VISTA.includes(forma);

  function adicionar(p) {
    setErro('');
    setCarrinho((c) => {
      const existente = c.find((i) => i.produtoId === p.id);
      if (existente) return c.map((i) => (i.produtoId === p.id ? { ...i, quantidade: i.quantidade + 1 } : i));
      return [...c, { produtoId: p.id, descricao: p.descricao, categoria: p.categoria, quantidade: 1, valorUnitario: p.precoVenda }];
    });
    setBusca('');
  }

  // Leitor de código de barras digita o EAN e pressiona Enter.
  function aoTeclarBusca(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const exato = produtos.find((p) => p.ean && p.ean === busca.trim());
    if (exato) adicionar(exato);
    else if (resultados.length === 1) adicionar(resultados[0]);
  }

  const alterarItem = (produtoId, campo, valor) =>
    setCarrinho((c) => c.map((i) => (i.produtoId === produtoId ? { ...i, [campo]: valor } : i)).filter((i) => i.quantidade > 0));

  function limpar() {
    setCarrinho([]);
    setClienteId('');
    setReceitaId('');
    setDesconto(0);
    setForma('pix');
    setParcelas(1);
    setVencimentoEditado(null);
    setErro('');
  }

  async function finalizar() {
    setErro('');
    setFinalizando(true);
    try {
      const venda = await registrarVenda({
        cliente,
        itens: carrinho.map(({ produtoId, descricao, quantidade, valorUnitario }) => ({ produtoId, descricao, quantidade: Number(quantidade), valorUnitario: Number(valorUnitario) })),
        desconto: Number(desconto) || 0,
        formaPagamento: forma,
        parcelas: Number(parcelas) || 1,
        primeiroVencimento,
        receitaId: receitaId || null,
        vencimentoOculos: vencimentoOculos || null,
        usuario,
      });
      setVendaConcluida({ venda, cliente });
      limpar();
    } catch (err) {
      setErro(err.message);
    } finally {
      setFinalizando(false);
    }
  }

  const ultimas = [...vendas].sort((a, b) => b.numero - a.numero).slice(0, 8);

  const mensagemVenda = ({ venda, cliente: c }) =>
    `Olá, ${c.nome.split(' ')[0]}! Obrigado pela compra na Ótica.\n` +
    `Venda #${venda.numero} — ${moeda(venda.total)} (${FORMAS_PAGAMENTO[venda.formaPagamento]}).\n` +
    venda.itens.map((i) => `• ${i.quantidade}x ${i.descricao}`).join('\n') +
    (venda.vencimentoOculos ? `\nGarantia/revisão do óculos até ${data(venda.vencimentoOculos)}.` : '');

  const linkRecibo = vendaConcluida?.cliente?.aceitaWhatsApp ? linkWhatsApp(vendaConcluida.cliente.whatsapp || vendaConcluida.cliente.telefone, mensagemVenda(vendaConcluida)) : null;

  return (
    <>
      <Cabecalho titulo="PDV — Ponto de venda" subtitulo={`Operador: ${usuario?.nome}`} />

      <div className="pdv">
        <div>
          <section className="cartao">
            <h2>Produtos</h2>
            <div onKeyDown={aoTeclarBusca}>
              <Busca valor={busca} onMudar={setBusca} placeholder="Buscar produto ou ler código de barras" />
            </div>
            {busca.trim() && (
              <div className="resultados">
                {resultados.length ? (
                  resultados.map((p) => (
                    <button key={p.id} type="button" onClick={() => adicionar(p)}>
                      <span>
                        {p.descricao}
                        <span className="sub">
                          {CATEGORIAS_PRODUTO[p.categoria]}
                          {p.categoria !== 'servico' && ` · estoque ${p.estoque}`}
                        </span>
                      </span>
                      <strong>{moeda(p.precoVenda)}</strong>
                    </button>
                  ))
                ) : (
                  <p className="muted" style={{ padding: 12, margin: 0 }}>
                    Nenhum produto encontrado.
                  </p>
                )}
              </div>
            )}
          </section>

          <section className="cartao">
            <div className="cartao-titulo">
              <h2>Carrinho</h2>
              {carrinho.length > 0 && (
                <button className="btn btn-pequeno" onClick={limpar}>
                  Limpar
                </button>
              )}
            </div>
            {carrinho.length ? (
              <div className="tabela-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Qtd.</th>
                      <th style={{ width: 130 }}>Preço unit.</th>
                      <th className="num">Total</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {carrinho.map((i) => (
                      <tr key={i.produtoId}>
                        <td>
                          {i.descricao}
                          <span className="sub">{CATEGORIAS_PRODUTO[i.categoria]}</span>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="btn-icone" onClick={() => alterarItem(i.produtoId, 'quantidade', i.quantidade - 1)} aria-label="Diminuir">
                            <Minus size={14} />
                          </button>
                          <strong style={{ display: 'inline-block', minWidth: 24, textAlign: 'center' }}>{i.quantidade}</strong>
                          <button className="btn-icone" onClick={() => alterarItem(i.produtoId, 'quantidade', i.quantidade + 1)} aria-label="Aumentar">
                            <Plus size={14} />
                          </button>
                        </td>
                        <td>
                          <input type="number" step="0.01" min="0" value={i.valorUnitario} onChange={(e) => alterarItem(i.produtoId, 'valorUnitario', Number(e.target.value))} />
                        </td>
                        <td className="num">{moeda(i.quantidade * i.valorUnitario)}</td>
                        <td className="td-acoes">
                          <button className="btn-icone perigo" onClick={() => alterarItem(i.produtoId, 'quantidade', 0)} title="Remover">
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Vazio titulo="Carrinho vazio">Busque um produto acima para começar.</Vazio>
            )}
          </section>

          <section className="cartao">
            <h2>Últimas vendas</h2>
            {ultimas.length ? (
              <div className="tabela-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Nº</th>
                      <th>Data</th>
                      <th>Cliente</th>
                      <th>Pagamento</th>
                      <th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ultimas.map((v) => (
                      <tr key={v.id}>
                        <td>#{v.numero}</td>
                        <td>{data(v.data)}</td>
                        <td>{v.clienteNome}</td>
                        <td>{FORMAS_PAGAMENTO[v.formaPagamento]}</td>
                        <td className="num">{moeda(v.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Vazio titulo="Nenhuma venda ainda" />
            )}
          </section>
        </div>

        <aside className="cartao pdv-resumo">
          <h2>Finalização</h2>
          <Aviso>{erro}</Aviso>
          <div className="grade-form">
            <Campo rotulo="Cliente" span={6}>
              <select
                value={clienteId}
                onChange={(e) => {
                  setClienteId(e.target.value);
                  setReceitaId('');
                }}
              >
                <option value="">Consumidor final</option>
                {[...clientes]
                  .sort((a, b) => a.nome.localeCompare(b.nome))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                      {c.cpf ? ` — ${c.cpf}` : ''}
                    </option>
                  ))}
              </select>
            </Campo>
            {receitas.length > 0 && (
              <Campo rotulo="Receita utilizada" span={6}>
                <select value={receitaId} onChange={(e) => setReceitaId(e.target.value)}>
                  <option value="">—</option>
                  {receitas.map((r) => (
                    <option key={r.id} value={r.id}>
                      {data(r.data)}
                      {r.medico ? ` — ${r.medico}` : ''}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
            <Campo rotulo="Forma de pagamento" span={6}>
              <select value={forma} onChange={(e) => setForma(e.target.value)}>
                {Object.entries(FORMAS_PAGAMENTO).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Campo>
            {parcelado && (
              <>
                <Campo rotulo="Parcelas" span={2}>
                  <input type="number" min="1" max="24" value={parcelas} onChange={(e) => setParcelas(e.target.value)} />
                </Campo>
                <Campo rotulo="1º vencimento" span={4}>
                  <input type="date" value={primeiroVencimento} onChange={(e) => setPrimeiroVencimento(e.target.value)} />
                </Campo>
              </>
            )}
            <Campo rotulo="Desconto (R$)" span={3}>
              <input type="number" step="0.01" min="0" value={desconto} onChange={(e) => setDesconto(e.target.value)} />
            </Campo>
            <Campo rotulo="Vencimento do óculos" span={3}>
              <input type="date" value={vencimentoOculos} onChange={(e) => setVencimentoEditado(e.target.value)} />
            </Campo>
          </div>

          <div style={{ marginTop: 16 }}>
            <div className="pdv-total">
              <span>Subtotal</span>
              <span>{moeda(subtotal)}</span>
            </div>
            <div className="pdv-total">
              <span>Desconto</span>
              <span>− {moeda(desconto)}</span>
            </div>
            <div className="pdv-total grande">
              <span>Total</span>
              <span>{moeda(total)}</span>
            </div>
            {parcelado && Number(parcelas) > 1 && total > 0 && (
              <p className="muted num" style={{ margin: '2px 0 0' }}>
                {parcelas}x de {moeda(total / parcelas)}
              </p>
            )}
          </div>

          <button className="btn btn-sucesso btn-grande" style={{ marginTop: 16 }} onClick={finalizar} disabled={!carrinho.length || finalizando}>
            {finalizando ? 'Registrando...' : 'Finalizar venda'}
          </button>
        </aside>
      </div>

      <Modal
        titulo={vendaConcluida ? `Venda #${vendaConcluida.venda.numero} registrada` : ''}
        aberto={!!vendaConcluida}
        onFechar={() => setVendaConcluida(null)}
        largura={520}
        rodape={
          <button className="btn btn-primario" onClick={() => setVendaConcluida(null)}>
            Nova venda
          </button>
        }
      >
        {vendaConcluida && (
          <>
            <Aviso tipo="ok">Estoque atualizado e contas a receber geradas.</Aviso>
            <ul className="lista-simples">
              {vendaConcluida.venda.itens.map((i) => (
                <li key={i.produtoId}>
                  <span>
                    {i.quantidade}x {i.descricao}
                  </span>
                  <span className="num">{moeda(i.quantidade * i.valorUnitario)}</span>
                </li>
              ))}
              <li>
                <strong>Total ({FORMAS_PAGAMENTO[vendaConcluida.venda.formaPagamento]})</strong>
                <strong className="num">{moeda(vendaConcluida.venda.total)}</strong>
              </li>
            </ul>
            <div className="acoes" style={{ marginTop: 16 }}>
              {linkRecibo && (
                <a className="btn" href={linkRecibo} target="_blank" rel="noreferrer">
                  <MessageCircle size={16} /> Enviar resumo por WhatsApp
                </a>
              )}
              <button className="btn" disabled title="A emissão de NF-e/NFC-e será integrada na Fase 2 (requer backend e certificado digital).">
                <FileText size={16} /> Emitir NF-e (Fase 2)
              </button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
