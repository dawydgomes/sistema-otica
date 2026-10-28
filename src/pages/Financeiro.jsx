import { useMemo, useState } from 'react';
import { CheckCircle2, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { excluir } from '../db/database';
import { useColecao } from '../hooks/useColecao';
import { Abas, Aviso, Busca, Cabecalho, Campo, Modal, normalizar, Vazio } from '../components/ui';
import { baixarConta, estornarConta, lancarContas } from '../services/negocio';
import { arredondar, data, hojeISO, moeda } from '../utils/format';

export function statusConta(c, hoje = hojeISO()) {
  if (c.pagoEm) return { chave: 'pagas', rotulo: c.tipo === 'pagar' ? 'Paga' : 'Recebida', classe: 'sucesso' };
  if (c.vencimento < hoje) return { chave: 'vencidas', rotulo: 'Vencida', classe: 'perigo' };
  if (c.vencimento === hoje) return { chave: 'abertas', rotulo: 'Vence hoje', classe: 'alerta' };
  return { chave: 'abertas', rotulo: 'Em aberto', classe: 'info' };
}

const FILTROS = { abertas: 'A vencer', vencidas: 'Vencidas', pagas: 'Liquidadas', todas: 'Todas' };

const contaVazia = (tipo) => ({ tipo, descricao: '', valor: '', vencimento: hojeISO(), parcelas: 1, categoria: '', pessoaNome: '' });

export default function Financeiro() {
  const { dados: contas, carregando } = useColecao('contas');
  const [tipo, setTipo] = useState('receber');
  const [filtro, setFiltro] = useState('abertas');
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState(null);
  const [erro, setErro] = useState('');

  const hoje = hojeISO();
  const doTipo = contas.filter((c) => c.tipo === tipo);

  const lista = useMemo(() => {
    const termo = normalizar(busca);
    return contas
      .filter((c) => c.tipo === tipo)
      .filter((c) => filtro === 'todas' || statusConta(c, hoje).chave === filtro)
      .filter((c) => !termo || normalizar(`${c.descricao} ${c.pessoaNome} ${c.categoria}`).includes(termo))
      .sort((a, b) => (filtro === 'pagas' ? b.pagoEm.localeCompare(a.pagoEm) : a.vencimento.localeCompare(b.vencimento)));
  }, [contas, tipo, filtro, busca, hoje]);

  const soma = (arr) => arredondar(arr.reduce((s, c) => s + c.valor, 0));
  const emAberto = doTipo.filter((c) => !c.pagoEm);
  const vencidas = emAberto.filter((c) => c.vencimento < hoje);
  const mesAtual = hoje.slice(0, 7);
  const liquidadasMes = doTipo.filter((c) => c.pagoEm?.startsWith(mesAtual));

  async function baixar(c) {
    const verbo = c.tipo === 'pagar' ? 'pagamento' : 'recebimento';
    if (confirm(`Confirmar ${verbo} de ${moeda(c.valor)} em ${data(hoje)}?\n${c.descricao}`)) await baixarConta(c.id, hoje);
  }

  async function estornar(c) {
    if (confirm(`Estornar a baixa de "${c.descricao}"? A conta volta a ficar em aberto.`)) await estornarConta(c.id);
  }

  async function remover(c) {
    if (confirm(`Excluir a conta "${c.descricao}"?`)) await excluir('contas', c.id);
  }

  async function gravar(e) {
    e.preventDefault();
    const valor = Number(form.valor);
    if (!form.descricao.trim()) return setErro('Informe a descrição.');
    if (!(valor > 0)) return setErro('Informe um valor maior que zero.');
    await lancarContas({ ...form, descricao: form.descricao.trim(), valor });
    setForm(null);
  }

  const rotuloTipo = tipo === 'pagar' ? 'a pagar' : 'a receber';

  return (
    <>
      <Cabecalho titulo="Financeiro" subtitulo="Contas a pagar e a receber">
        <button
          className="btn btn-primario"
          onClick={() => {
            setForm(contaVazia(tipo));
            setErro('');
          }}
        >
          <Plus size={16} /> Nova conta {rotuloTipo}
        </button>
      </Cabecalho>

      <Abas abas={{ receber: 'Contas a receber', pagar: 'Contas a pagar' }} ativa={tipo} onTrocar={setTipo} />

      <div className="grade-kpi">
        <div className="cartao kpi">
          <div className="rotulo">Em aberto</div>
          <div className="valor">{moeda(soma(emAberto))}</div>
          <div className="detalhe">{emAberto.length} conta(s)</div>
        </div>
        <div className="cartao kpi">
          <div className="rotulo">Vencidas</div>
          <div className="valor" style={{ color: vencidas.length ? 'var(--perigo)' : undefined }}>
            {moeda(soma(vencidas))}
          </div>
          <div className="detalhe">{vencidas.length} conta(s)</div>
        </div>
        <div className="cartao kpi">
          <div className="rotulo">{tipo === 'pagar' ? 'Pago no mês' : 'Recebido no mês'}</div>
          <div className="valor">{moeda(soma(liquidadasMes))}</div>
          <div className="detalhe">{liquidadasMes.length} lançamento(s)</div>
        </div>
      </div>

      <section className="cartao">
        <div className="cartao-titulo" style={{ flexWrap: 'wrap' }}>
          <div className="acoes">
            {Object.entries(FILTROS).map(([k, v]) => (
              <button key={k} className={`btn btn-pequeno${filtro === k ? ' btn-primario' : ''}`} onClick={() => setFiltro(k)}>
                {v}
              </button>
            ))}
          </div>
          <Busca valor={busca} onMudar={setBusca} placeholder="Descrição, pessoa ou categoria" />
        </div>
        {!carregando && !lista.length ? (
          <Vazio titulo={`Nenhuma conta ${rotuloTipo} neste filtro`} />
        ) : (
          <div className="tabela-wrap">
            <table>
              <thead>
                <tr>
                  <th>Vencimento</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th className="num">Valor</th>
                  <th>Situação</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lista.map((c) => {
                  const st = statusConta(c, hoje);
                  return (
                    <tr key={c.id}>
                      <td>{data(c.vencimento)}</td>
                      <td>
                        {c.descricao}
                        {c.pessoaNome && <span className="sub">{c.pessoaNome}</span>}
                      </td>
                      <td>{c.categoria || '—'}</td>
                      <td className="num">{moeda(c.valor)}</td>
                      <td>
                        <span className={`selo ${st.classe}`}>{st.rotulo}</span>
                        {c.pagoEm && <span className="sub">em {data(c.pagoEm)}</span>}
                      </td>
                      <td className="td-acoes">
                        {c.pagoEm ? (
                          <button className="btn-icone" onClick={() => estornar(c)} title="Estornar baixa">
                            <RotateCcw size={16} />
                          </button>
                        ) : (
                          <button className="btn btn-pequeno btn-sucesso" onClick={() => baixar(c)}>
                            <CheckCircle2 size={15} /> {c.tipo === 'pagar' ? 'Pagar' : 'Receber'}
                          </button>
                        )}
                        {c.origem?.tipo === 'manual' && !c.pagoEm && (
                          <button className="btn-icone perigo" onClick={() => remover(c)} title="Excluir">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        titulo={form ? `Nova conta ${form.tipo === 'pagar' ? 'a pagar' : 'a receber'}` : ''}
        aberto={!!form}
        onFechar={() => setForm(null)}
        largura={620}
        rodape={
          <>
            <button className="btn" onClick={() => setForm(null)}>
              Cancelar
            </button>
            <button className="btn btn-primario" type="submit" form="form-conta">
              Lançar
            </button>
          </>
        }
      >
        {form && (
          <form id="form-conta" className="grade-form" onSubmit={gravar}>
            {erro && (
              <div style={{ gridColumn: '1 / -1' }}>
                <Aviso>{erro}</Aviso>
              </div>
            )}
            <Campo rotulo="Descrição *" span={6}>
              <input value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Ex.: Aluguel, energia, serviço de laboratório..." autoFocus />
            </Campo>
            <Campo rotulo={form.tipo === 'pagar' ? 'Favorecido' : 'Cliente / pagador'} span={3}>
              <input value={form.pessoaNome} onChange={(e) => setForm((f) => ({ ...f, pessoaNome: e.target.value }))} />
            </Campo>
            <Campo rotulo="Categoria" span={3}>
              <input value={form.categoria} onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))} list="categorias-conta" />
              <datalist id="categorias-conta">
                {[...new Set(contas.map((c) => c.categoria).filter(Boolean))].map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Campo>
            <Campo rotulo="Valor total *" span={2}>
              <input type="number" step="0.01" min="0" value={form.valor} onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))} />
            </Campo>
            <Campo rotulo="1º vencimento" span={2}>
              <input type="date" value={form.vencimento} onChange={(e) => setForm((f) => ({ ...f, vencimento: e.target.value }))} />
            </Campo>
            <Campo rotulo="Parcelas (mensais)" span={2}>
              <input type="number" min="1" max="60" value={form.parcelas} onChange={(e) => setForm((f) => ({ ...f, parcelas: e.target.value }))} />
            </Campo>
          </form>
        )}
      </Modal>
    </>
  );
}
