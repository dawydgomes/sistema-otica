import { useMemo, useState } from 'react';
import { PackageCheck, Pencil, Plus, Trash2 } from 'lucide-react';
import { excluir, salvar } from '../db/database';
import { useColecao } from '../hooks/useColecao';
import { Aviso, Busca, Cabecalho, Campo, Modal, normalizar, Vazio } from '../components/ui';
import { CATEGORIAS_PRODUTO } from '../services/constantes';
import { ajustarEstoque } from '../services/negocio';
import { moeda } from '../utils/format';

const produtoVazio = () => ({
  codigo: '',
  ean: '',
  descricao: '',
  categoria: 'armacao',
  marca: '',
  fornecedorId: '',
  ncm: '',
  unidade: 'UN',
  precoCusto: 0,
  precoVenda: 0,
  estoque: 0,
  estoqueMinimo: 0,
});

export const estoqueBaixo = (p) => p.categoria !== 'servico' && (p.estoque || 0) <= (p.estoqueMinimo || 0);

export default function Produtos() {
  const { dados: produtos, carregando } = useColecao('produtos');
  const { dados: fornecedores } = useColecao('fornecedores');
  const { dados: vendas } = useColecao('vendas');
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('');
  const [soBaixo, setSoBaixo] = useState(false);
  const [form, setForm] = useState(null);
  const [ajuste, setAjuste] = useState(null);
  const [erro, setErro] = useState('');

  const filtrados = useMemo(() => {
    const termo = normalizar(busca);
    return produtos
      .filter((p) => (!categoria || p.categoria === categoria) && (!soBaixo || estoqueBaixo(p)))
      .filter((p) => !termo || normalizar(`${p.descricao} ${p.codigo} ${p.ean} ${p.marca}`).includes(termo))
      .sort((a, b) => a.descricao.localeCompare(b.descricao));
  }, [produtos, busca, categoria, soBaixo]);

  const valorEstoque = produtos.reduce((s, p) => s + (p.estoque || 0) * (p.precoCusto || 0), 0);

  function abrir(p) {
    setForm(p ? { ...produtoVazio(), ...p } : produtoVazio());
    setErro('');
  }

  const set = (campo, numero) => (e) => setForm((f) => ({ ...f, [campo]: numero ? Number(e.target.value) : e.target.value }));

  async function gravar(e) {
    e.preventDefault();
    if (!form.descricao.trim()) return setErro('Informe a descrição.');
    if (form.precoVenda < 0 || form.precoCusto < 0) return setErro('Preços não podem ser negativos.');
    if (form.ean && produtos.some((p) => p.id !== form.id && p.ean === form.ean)) return setErro('Já existe um produto com este código de barras.');
    await salvar('produtos', { ...form, descricao: form.descricao.trim(), estoque: form.categoria === 'servico' ? 0 : form.estoque });
    setForm(null);
  }

  async function remover(p) {
    if (vendas.some((v) => v.itens.some((i) => i.produtoId === p.id))) return alert('Este produto já foi vendido e não pode ser excluído.');
    if (confirm(`Excluir "${p.descricao}"?`)) await excluir('produtos', p.id);
  }

  async function gravarAjuste(e) {
    e.preventDefault();
    if (!ajuste.motivo.trim()) return;
    await ajustarEstoque(ajuste.produto.id, Number(ajuste.quantidade), ajuste.motivo.trim());
    setAjuste(null);
  }

  const margem = form && form.precoVenda > 0 ? ((form.precoVenda - form.precoCusto) / form.precoVenda) * 100 : 0;

  return (
    <>
      <Cabecalho titulo="Produtos e estoque" subtitulo={`${produtos.length} produto(s) · estoque a custo: ${moeda(valorEstoque)}`}>
        <Busca valor={busca} onMudar={setBusca} placeholder="Descrição, código ou EAN" />
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} style={{ width: 'auto' }} aria-label="Categoria">
          <option value="">Todas as categorias</option>
          {Object.entries(CATEGORIAS_PRODUTO).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <label className="checkbox">
          <input type="checkbox" checked={soBaixo} onChange={(e) => setSoBaixo(e.target.checked)} /> Estoque baixo
        </label>
        <button className="btn btn-primario" onClick={() => abrir(null)}>
          <Plus size={16} /> Novo produto
        </button>
      </Cabecalho>

      <section className="cartao">
        {!carregando && !filtrados.length ? (
          <Vazio titulo="Nenhum produto encontrado">Produtos também são criados automaticamente na entrada por XML.</Vazio>
        ) : (
          <div className="tabela-wrap">
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Categoria</th>
                  <th className="num">Custo</th>
                  <th className="num">Venda</th>
                  <th className="num">Estoque</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.descricao}</strong>
                      <span className="sub">{[p.marca, p.codigo && `Cód. ${p.codigo}`, p.ean && `EAN ${p.ean}`].filter(Boolean).join(' · ')}</span>
                    </td>
                    <td>{CATEGORIAS_PRODUTO[p.categoria]}</td>
                    <td className="num">{moeda(p.precoCusto)}</td>
                    <td className="num">{moeda(p.precoVenda)}</td>
                    <td className="num">
                      {p.categoria === 'servico' ? (
                        '—'
                      ) : (
                        <>
                          {p.estoque} {p.unidade}{' '}
                          {estoqueBaixo(p) && <span className="selo alerta">Baixo (mín. {p.estoqueMinimo})</span>}
                        </>
                      )}
                    </td>
                    <td className="td-acoes">
                      {p.categoria !== 'servico' && (
                        <button className="btn-icone" onClick={() => setAjuste({ produto: p, quantidade: p.estoque, motivo: '' })} title="Ajustar estoque">
                          <PackageCheck size={16} />
                        </button>
                      )}
                      <button className="btn-icone" onClick={() => abrir(p)} title="Editar">
                        <Pencil size={16} />
                      </button>
                      <button className="btn-icone perigo" onClick={() => remover(p)} title="Excluir">
                        <Trash2 size={16} />
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
        titulo={form?.id ? 'Editar produto' : 'Novo produto'}
        aberto={!!form}
        onFechar={() => setForm(null)}
        rodape={
          <>
            <button className="btn" onClick={() => setForm(null)}>
              Cancelar
            </button>
            <button className="btn btn-primario" type="submit" form="form-produto">
              Salvar
            </button>
          </>
        }
      >
        {form && (
          <form id="form-produto" className="grade-form" onSubmit={gravar}>
            {erro && (
              <div style={{ gridColumn: '1 / -1' }}>
                <Aviso>{erro}</Aviso>
              </div>
            )}
            <Campo rotulo="Descrição *" span={6}>
              <input value={form.descricao} onChange={set('descricao')} autoFocus />
            </Campo>
            <Campo rotulo="Categoria" span={2}>
              <select value={form.categoria} onChange={set('categoria')}>
                {Object.entries(CATEGORIAS_PRODUTO).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Marca" span={2}>
              <input value={form.marca} onChange={set('marca')} />
            </Campo>
            <Campo rotulo="Fornecedor" span={2}>
              <select value={form.fornecedorId} onChange={set('fornecedorId')}>
                <option value="">—</option>
                {fornecedores.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nomeFantasia || f.razaoSocial}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Código interno" span={2}>
              <input value={form.codigo} onChange={set('codigo')} />
            </Campo>
            <Campo rotulo="Código de barras (EAN)" span={2}>
              <input value={form.ean} onChange={set('ean')} inputMode="numeric" />
            </Campo>
            <Campo rotulo="NCM" span={1}>
              <input value={form.ncm} onChange={set('ncm')} inputMode="numeric" />
            </Campo>
            <Campo rotulo="Unidade" span={1}>
              <input value={form.unidade} onChange={set('unidade')} />
            </Campo>
            <Campo rotulo="Preço de custo" span={2}>
              <input type="number" step="0.01" min="0" value={form.precoCusto} onChange={set('precoCusto', true)} />
            </Campo>
            <Campo rotulo={`Preço de venda (margem ${margem.toFixed(0)}%)`} span={2}>
              <input type="number" step="0.01" min="0" value={form.precoVenda} onChange={set('precoVenda', true)} />
            </Campo>
            {form.categoria !== 'servico' && (
              <>
                <Campo rotulo={form.id ? 'Estoque atual' : 'Estoque inicial'} span={1}>
                  <input type="number" min="0" value={form.estoque} onChange={set('estoque', true)} disabled={!!form.id} title={form.id ? 'Use “Ajustar estoque” para alterar' : ''} />
                </Campo>
                <Campo rotulo="Estoque mínimo" span={1}>
                  <input type="number" min="0" value={form.estoqueMinimo} onChange={set('estoqueMinimo', true)} />
                </Campo>
              </>
            )}
          </form>
        )}
      </Modal>

      <Modal
        titulo="Ajustar estoque"
        aberto={!!ajuste}
        onFechar={() => setAjuste(null)}
        largura={460}
        rodape={
          <>
            <button className="btn" onClick={() => setAjuste(null)}>
              Cancelar
            </button>
            <button className="btn btn-primario" type="submit" form="form-ajuste">
              Confirmar ajuste
            </button>
          </>
        }
      >
        {ajuste && (
          <form id="form-ajuste" className="grade-form" onSubmit={gravarAjuste}>
            <p style={{ gridColumn: '1 / -1', margin: 0 }}>
              <strong>{ajuste.produto.descricao}</strong>
              <span className="sub">Estoque atual: {ajuste.produto.estoque}</span>
            </p>
            <Campo rotulo="Nova quantidade (contagem)" span={6}>
              <input type="number" min="0" value={ajuste.quantidade} onChange={(e) => setAjuste((a) => ({ ...a, quantidade: e.target.value }))} autoFocus />
            </Campo>
            <Campo rotulo="Motivo *" span={6}>
              <input value={ajuste.motivo} onChange={(e) => setAjuste((a) => ({ ...a, motivo: e.target.value }))} placeholder="Inventário, quebra, devolução..." required />
            </Campo>
          </form>
        )}
      </Modal>
    </>
  );
}
