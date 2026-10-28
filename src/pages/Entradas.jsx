import { useMemo, useState } from 'react';
import { Eye, FileUp, Plus, Trash2 } from 'lucide-react';
import { useColecao } from '../hooks/useColecao';
import { Aviso, Cabecalho, Campo, Modal, Vazio } from '../components/ui';
import { CATEGORIAS_PRODUTO, categoriaPorNCM } from '../services/constantes';
import { dividirParcelas, registrarEntrada } from '../services/negocio';
import { addDias, arredondar, data, hojeISO, moeda, normalizarCNPJ } from '../utils/format';
import { lerXmlNFe } from '../utils/nfeXml';

const novaEntrada = () => ({
  viaXml: false,
  fornecedorId: '',
  fornecedorXml: null,
  nota: { numero: '', serie: '', chave: '', dataEmissao: hojeISO(), valorTotal: 0 },
  itens: [],
  parcelas: [],
  qtdParcelas: 1,
  primeiroVencimento: addDias(hojeISO(), 30),
});

let contadorItem = 0;
const chaveItem = () => `item-${++contadorItem}`;

export default function Entradas() {
  const { dados: entradas, carregando } = useColecao('entradas');
  const { dados: fornecedores } = useColecao('fornecedores');
  const { dados: produtos } = useColecao('produtos');
  const [form, setForm] = useState(null);
  const [detalhe, setDetalhe] = useState(null);
  const [produtoManual, setProdutoManual] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const lista = useMemo(() => [...entradas].sort((a, b) => b.dataEntrada.localeCompare(a.dataEntrada) || b.dataEmissao.localeCompare(a.dataEmissao)), [entradas]);

  const totalItens = form ? arredondar(form.itens.reduce((s, i) => s + i.quantidade * i.valorUnitario, 0)) : 0;
  const totalNota = form?.viaXml && form.nota.valorTotal ? form.nota.valorTotal : totalItens;
  const somaParcelas = form ? arredondar(form.parcelas.reduce((s, p) => s + Number(p.valor), 0)) : 0;

  function abrir() {
    setForm(novaEntrada());
    setErro('');
    setProdutoManual('');
  }

  async function importarXml(e) {
    const arquivo = e.target.files[0];
    e.target.value = '';
    if (!arquivo) return;
    setErro('');
    try {
      const nfe = lerXmlNFe(await arquivo.text());
      const forn = fornecedores.find((f) => normalizarCNPJ(f.cnpj) === normalizarCNPJ(nfe.fornecedor.cnpj));
      const itens = nfe.itens.map((item) => {
        const existente = produtos.find((p) => (item.ean && p.ean === item.ean) || (forn && p.fornecedorId === forn.id && p.codigoFornecedor === item.codigo));
        return {
          ...item,
          chave: chaveItem(),
          produtoId: existente?.id ?? null,
          existente: existente?.descricao ?? null,
          categoria: categoriaPorNCM(item.ncm),
          precoVenda: arredondar(item.valorUnitario * 2),
        };
      });
      setForm({
        ...novaEntrada(),
        viaXml: true,
        fornecedorId: forn?.id ?? '',
        fornecedorXml: forn ? null : nfe.fornecedor,
        nota: { numero: nfe.numero, serie: nfe.serie, chave: nfe.chave, dataEmissao: nfe.dataEmissao || hojeISO(), valorTotal: nfe.valorTotal },
        itens,
        parcelas: nfe.duplicatas.length ? nfe.duplicatas : dividirParcelas(nfe.valorTotal, 1, addDias(nfe.dataEmissao || hojeISO(), 30)),
      });
      if (entradas.some((x) => x.chave && x.chave === nfe.chave)) setErro('Atenção: esta nota já foi lançada anteriormente.');
    } catch (err) {
      setErro(err.message);
    }
  }

  function adicionarManual() {
    const p = produtos.find((x) => x.id === produtoManual);
    if (!p) return;
    setForm((f) => ({
      ...f,
      itens: [...f.itens, { chave: chaveItem(), produtoId: p.id, existente: p.descricao, descricao: p.descricao, quantidade: 1, valorUnitario: p.precoCusto || 0 }],
    }));
    setProdutoManual('');
  }

  const mudarItem = (chave, campo, valor) => setForm((f) => ({ ...f, itens: f.itens.map((i) => (i.chave === chave ? { ...i, [campo]: valor } : i)) }));
  const mudarNota = (campo) => (e) => setForm((f) => ({ ...f, nota: { ...f.nota, [campo]: e.target.value } }));

  function gerarParcelas() {
    setForm((f) => ({ ...f, parcelas: dividirParcelas(totalNota, f.qtdParcelas, f.primeiroVencimento) }));
  }

  async function confirmar() {
    setErro('');
    const fornecedor = form.fornecedorId ? { id: form.fornecedorId } : form.fornecedorXml;
    if (!fornecedor) return setErro('Selecione o fornecedor.');
    if (!form.itens.length) return setErro('Inclua ao menos um item.');
    const parcelas = form.parcelas.length ? form.parcelas : dividirParcelas(totalNota, 1, form.primeiroVencimento);
    setSalvando(true);
    try {
      await registrarEntrada({
        fornecedor,
        nota: { ...form.nota, valorTotal: totalNota },
        itens: form.itens.map((i) => ({ ...i, quantidade: Number(i.quantidade), valorUnitario: Number(i.valorUnitario), precoVenda: Number(i.precoVenda) })),
        parcelas: parcelas.map((p) => ({ ...p, valor: Number(p.valor) })),
      });
      setForm(null);
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Cabecalho titulo="Entrada de mercadorias" subtitulo="Cada entrada soma ao estoque e gera as contas a pagar automaticamente.">
        <button className="btn btn-primario" onClick={abrir}>
          <Plus size={16} /> Nova entrada
        </button>
      </Cabecalho>

      <section className="cartao">
        {!carregando && !lista.length ? (
          <Vazio titulo="Nenhuma entrada lançada">Importe o XML da nota fiscal do fornecedor ou lance os itens manualmente.</Vazio>
        ) : (
          <div className="tabela-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nota</th>
                  <th>Emissão</th>
                  <th>Fornecedor</th>
                  <th className="num">Itens</th>
                  <th className="num">Total</th>
                  <th>Parcelas</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lista.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <strong>NF {e.numero || 's/n'}</strong>
                      {e.serie && <span className="sub">Série {e.serie}</span>}
                    </td>
                    <td>{data(e.dataEmissao)}</td>
                    <td>{e.fornecedorNome}</td>
                    <td className="num">{e.itens.length}</td>
                    <td className="num">{moeda(e.valorTotal)}</td>
                    <td>{e.parcelas.length}x</td>
                    <td className="td-acoes">
                      <button className="btn-icone" onClick={() => setDetalhe(e)} title="Ver itens">
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        titulo="Nova entrada de mercadorias"
        aberto={!!form}
        onFechar={() => setForm(null)}
        largura={1000}
        rodape={
          <>
            <button className="btn" onClick={() => setForm(null)}>
              Cancelar
            </button>
            <button className="btn btn-primario" onClick={confirmar} disabled={salvando}>
              {salvando ? 'Gravando...' : 'Confirmar entrada'}
            </button>
          </>
        }
      >
        {form && (
          <>
            <Aviso>{erro}</Aviso>
            <div className="cartao" style={{ boxShadow: 'none', background: 'var(--superficie-2)' }}>
              <div className="cartao-titulo">
                <h2>
                  <FileUp size={16} style={{ verticalAlign: -3 }} /> Importar XML da NF-e
                </h2>
              </div>
              <input type="file" accept=".xml,text/xml,application/xml" onChange={importarXml} aria-label="Arquivo XML da NF-e" />
              <p className="muted" style={{ margin: '8px 0 0' }}>
                Preenche fornecedor, itens e duplicatas automaticamente. Ou lance a nota manualmente abaixo.
              </p>
            </div>

            <div className="grade-form" style={{ marginTop: 16 }}>
              <Campo rotulo="Fornecedor *" span={3}>
                {form.fornecedorXml ? (
                  <input value={`${form.fornecedorXml.razaoSocial} (novo — será cadastrado)`} disabled />
                ) : (
                  <select value={form.fornecedorId} onChange={(e) => setForm((f) => ({ ...f, fornecedorId: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {fornecedores.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nomeFantasia || f.razaoSocial}
                      </option>
                    ))}
                  </select>
                )}
              </Campo>
              <Campo rotulo="Número da NF" span={1}>
                <input value={form.nota.numero} onChange={mudarNota('numero')} disabled={form.viaXml} />
              </Campo>
              <Campo rotulo="Série" span={1}>
                <input value={form.nota.serie} onChange={mudarNota('serie')} disabled={form.viaXml} />
              </Campo>
              <Campo rotulo="Emissão" span={1}>
                <input type="date" value={form.nota.dataEmissao} onChange={mudarNota('dataEmissao')} disabled={form.viaXml} />
              </Campo>
              {form.nota.chave && (
                <Campo rotulo="Chave de acesso" span={6}>
                  <input value={form.nota.chave} disabled />
                </Campo>
              )}
            </div>

            <h3 style={{ fontSize: 15, margin: '20px 0 8px' }}>Itens</h3>
            {!form.viaXml && (
              <div className="com-botao" style={{ marginBottom: 10 }}>
                <select value={produtoManual} onChange={(e) => setProdutoManual(e.target.value)} aria-label="Produto">
                  <option value="">Selecione um produto cadastrado...</option>
                  {produtos
                    .filter((p) => p.categoria !== 'servico')
                    .sort((a, b) => a.descricao.localeCompare(b.descricao))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.descricao}
                      </option>
                    ))}
                </select>
                <button type="button" className="btn" onClick={adicionarManual} disabled={!produtoManual}>
                  <Plus size={16} /> Adicionar
                </button>
              </div>
            )}
            {form.itens.length ? (
              <div className="tabela-wrap" style={{ margin: 0 }}>
                <table className="tabela-compacta">
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th style={{ width: 90 }}>Qtd.</th>
                      <th style={{ width: 120 }}>Custo unit.</th>
                      <th style={{ width: 160 }}>Categoria (novo)</th>
                      <th style={{ width: 120 }}>Preço venda (novo)</th>
                      <th className="num">Total</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {form.itens.map((i) => (
                      <tr key={i.chave}>
                        <td>
                          {i.descricao}
                          <span className="sub">{i.produtoId ? <span className="selo info">Já cadastrado</span> : <span className="selo alerta">Produto novo</span>}</span>
                        </td>
                        <td>
                          <input type="number" min="0" step="any" value={i.quantidade} onChange={(e) => mudarItem(i.chave, 'quantidade', e.target.value)} />
                        </td>
                        <td>
                          <input type="number" min="0" step="0.01" value={i.valorUnitario} onChange={(e) => mudarItem(i.chave, 'valorUnitario', e.target.value)} />
                        </td>
                        <td>
                          {!i.produtoId && (
                            <select value={i.categoria} onChange={(e) => mudarItem(i.chave, 'categoria', e.target.value)}>
                              {Object.entries(CATEGORIAS_PRODUTO).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td>{!i.produtoId && <input type="number" min="0" step="0.01" value={i.precoVenda} onChange={(e) => mudarItem(i.chave, 'precoVenda', e.target.value)} />}</td>
                        <td className="num">{moeda(i.quantidade * i.valorUnitario)}</td>
                        <td className="td-acoes">
                          <button className="btn-icone perigo" onClick={() => setForm((f) => ({ ...f, itens: f.itens.filter((x) => x.chave !== i.chave) }))} title="Remover item">
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Vazio titulo="Nenhum item" />
            )}
            <p className="num" style={{ margin: '10px 0 0' }}>
              Total dos itens: <strong>{moeda(totalItens)}</strong>
              {form.viaXml && totalNota !== totalItens && (
                <>
                  {' '}
                  · Total da nota (com impostos/frete): <strong>{moeda(totalNota)}</strong>
                </>
              )}
            </p>

            <h3 style={{ fontSize: 15, margin: '20px 0 8px' }}>Contas a pagar</h3>
            <div className="grade-form" style={{ alignItems: 'end' }}>
              <Campo rotulo="Nº de parcelas" span={1}>
                <input type="number" min="1" max="24" value={form.qtdParcelas} onChange={(e) => setForm((f) => ({ ...f, qtdParcelas: e.target.value }))} />
              </Campo>
              <Campo rotulo="1º vencimento" span={2}>
                <input type="date" value={form.primeiroVencimento} onChange={(e) => setForm((f) => ({ ...f, primeiroVencimento: e.target.value }))} />
              </Campo>
              <div className="campo span-3">
                <button type="button" className="btn" onClick={gerarParcelas} disabled={!totalNota}>
                  Gerar parcelas
                </button>
              </div>
            </div>
            {form.parcelas.length > 0 && (
              <table className="tabela-compacta" style={{ marginTop: 10, maxWidth: 480 }}>
                <thead>
                  <tr>
                    <th>Parcela</th>
                    <th>Vencimento</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {form.parcelas.map((p, idx) => (
                    <tr key={p.numero}>
                      <td>
                        {p.numero}/{form.parcelas.length}
                      </td>
                      <td>
                        <input
                          type="date"
                          value={p.vencimento}
                          onChange={(e) => setForm((f) => ({ ...f, parcelas: f.parcelas.map((x, j) => (j === idx ? { ...x, vencimento: e.target.value } : x)) }))}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          value={p.valor}
                          onChange={(e) => setForm((f) => ({ ...f, parcelas: f.parcelas.map((x, j) => (j === idx ? { ...x, valor: e.target.value } : x)) }))}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {form.parcelas.length > 0 && Math.abs(somaParcelas - totalNota) > 0.01 && (
              <Aviso>
                Soma das parcelas ({moeda(somaParcelas)}) diferente do total ({moeda(totalNota)}). Clique em “Gerar parcelas” ou ajuste os valores.
              </Aviso>
            )}
            {!form.parcelas.length && <p className="muted">Sem parcelas definidas: será gerada 1 parcela com o vencimento acima.</p>}
          </>
        )}
      </Modal>

      <Modal titulo={detalhe ? `NF ${detalhe.numero || 's/n'} — ${detalhe.fornecedorNome}` : ''} aberto={!!detalhe} onFechar={() => setDetalhe(null)} largura={700}>
        {detalhe && (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              Emissão {data(detalhe.dataEmissao)} · lançada em {data(detalhe.dataEntrada)}
              {detalhe.chave && <span className="sub">Chave: {detalhe.chave}</span>}
            </p>
            <table className="tabela-compacta">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th className="num">Qtd.</th>
                  <th className="num">Custo unit.</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {detalhe.itens.map((i, idx) => (
                  <tr key={idx}>
                    <td>{i.descricao}</td>
                    <td className="num">{i.quantidade}</td>
                    <td className="num">{moeda(i.valorUnitario)}</td>
                    <td className="num">{moeda(i.quantidade * i.valorUnitario)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3 style={{ fontSize: 14, margin: '16px 0 6px' }}>Parcelas</h3>
            <ul className="lista-simples">
              {detalhe.parcelas.map((p) => (
                <li key={p.numero}>
                  <span>
                    {p.numero}/{detalhe.parcelas.length} · vence {data(p.vencimento)}
                  </span>
                  <strong>{moeda(p.valor)}</strong>
                </li>
              ))}
            </ul>
          </>
        )}
      </Modal>
    </>
  );
}
