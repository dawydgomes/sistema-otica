import { useMemo, useState } from 'react';
import { MessageCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import { excluir, novoId, salvar } from '../db/database';
import { useColecao } from '../hooks/useColecao';
import { Abas, Aviso, Busca, Cabecalho, Campo, Modal, normalizar, Vazio } from '../components/ui';
import { CamposEndereco, enderecoVazio } from '../components/Endereco';
import { data, diasAte, hojeISO, mascaraCPF, mascaraTelefone, moeda } from '../utils/format';
import { emailValido, validarCPF } from '../utils/validators';
import { linkWhatsApp } from '../utils/integracoes';

const clienteVazio = () => ({
  nome: '',
  cpf: '',
  rg: '',
  dataNascimento: '',
  telefone: '',
  whatsapp: '',
  aceitaWhatsApp: false,
  email: '',
  endereco: enderecoVazio(),
  receitas: [],
  observacoes: '',
});

const olhoVazio = () => ({ esferico: '', cilindrico: '', eixo: '', adicao: '', dnp: '', altura: '' });
const receitaVazia = () => ({ id: novoId(), data: hojeISO(), medico: '', od: olhoVazio(), oe: olhoVazio(), observacoes: '' });

const COLUNAS_RECEITA = { esferico: 'Esférico', cilindrico: 'Cilíndrico', eixo: 'Eixo', adicao: 'Adição', dnp: 'DNP', altura: 'Altura' };

export const mensagemVencimento = (cliente, venda) =>
  `Olá, ${cliente.nome.split(' ')[0]}! Aqui é da Ótica. ` +
  (diasAte(venda.vencimentoOculos) < 0
    ? `A garantia/revisão dos seus óculos venceu em ${data(venda.vencimentoOculos)}.`
    : `A garantia/revisão dos seus óculos vence em ${data(venda.vencimentoOculos)}.`) +
  ' Que tal agendar um novo exame de vista? Estamos à disposição!';

export default function Clientes() {
  const { dados: clientes, carregando } = useColecao('clientes');
  const { dados: vendas } = useColecao('vendas');
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState(null);
  const [aba, setAba] = useState('dados');
  const [erro, setErro] = useState('');

  const filtrados = useMemo(() => {
    const termo = normalizar(busca);
    return clientes
      .filter((c) => !termo || normalizar(`${c.nome} ${c.cpf} ${c.telefone} ${c.whatsapp}`).includes(termo))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [clientes, busca]);

  const comprasDoCliente = form?.id ? vendas.filter((v) => v.clienteId === form.id).sort((a, b) => b.data.localeCompare(a.data)) : [];

  function abrir(cliente) {
    setForm(cliente ? structuredClone(cliente) : clienteVazio());
    setAba('dados');
    setErro('');
  }

  const set = (campo, mascara) => (e) => {
    const valor = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [campo]: mascara ? mascara(valor) : valor }));
  };

  function mudarReceita(id, alterar) {
    setForm((f) => ({ ...f, receitas: f.receitas.map((r) => (r.id === id ? alterar(r) : r)) }));
  }

  async function gravar(e) {
    e.preventDefault();
    if (!form.nome.trim()) return setErro('Informe o nome do cliente.');
    if (form.cpf && !validarCPF(form.cpf)) return setErro('CPF inválido.');
    if (!emailValido(form.email)) return setErro('E-mail inválido.');
    const cpfDuplicado = form.cpf && clientes.some((c) => c.id !== form.id && c.cpf === form.cpf);
    if (cpfDuplicado) return setErro('Já existe um cliente com este CPF.');
    await salvar('clientes', { ...form, nome: form.nome.trim(), criadoEm: form.criadoEm ?? hojeISO() });
    setForm(null);
  }

  async function remover(cliente) {
    if (vendas.some((v) => v.clienteId === cliente.id)) {
      alert('Este cliente possui vendas registradas e não pode ser excluído.');
      return;
    }
    if (confirm(`Excluir o cliente "${cliente.nome}"?`)) await excluir('clientes', cliente.id);
  }

  const zap = (c, msg = `Olá, ${c.nome.split(' ')[0]}! Aqui é da Ótica.`) => (c.aceitaWhatsApp ? linkWhatsApp(c.whatsapp || c.telefone, msg) : null);

  return (
    <>
      <Cabecalho titulo="Clientes" subtitulo={`${clientes.length} cadastrado(s)`}>
        <Busca valor={busca} onMudar={setBusca} placeholder="Nome, CPF ou telefone" />
        <button className="btn btn-primario" onClick={() => abrir(null)}>
          <Plus size={16} /> Novo cliente
        </button>
      </Cabecalho>

      <section className="cartao">
        {!carregando && !filtrados.length ? (
          <Vazio titulo={busca ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}>Cadastre o primeiro cliente pelo botão “Novo cliente”.</Vazio>
        ) : (
          <div className="tabela-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>CPF</th>
                  <th>WhatsApp / Telefone</th>
                  <th>Cidade</th>
                  <th>Última receita</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => {
                  const link = zap(c);
                  const ultima = [...(c.receitas || [])].sort((a, b) => b.data.localeCompare(a.data))[0];
                  return (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.nome}</strong>
                        {c.email && <span className="sub">{c.email}</span>}
                      </td>
                      <td>{c.cpf || '—'}</td>
                      <td>{c.whatsapp || c.telefone || '—'}</td>
                      <td>{c.endereco?.cidade ? `${c.endereco.cidade}/${c.endereco.uf}` : '—'}</td>
                      <td>{ultima ? data(ultima.data) : '—'}</td>
                      <td className="td-acoes">
                        {link && (
                          <a className="btn-icone whatsapp" href={link} target="_blank" rel="noreferrer" title="Abrir WhatsApp">
                            <MessageCircle size={17} />
                          </a>
                        )}
                        <button className="btn-icone" onClick={() => abrir(c)} title="Editar">
                          <Pencil size={16} />
                        </button>
                        <button className="btn-icone perigo" onClick={() => remover(c)} title="Excluir">
                          <Trash2 size={16} />
                        </button>
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
        titulo={form?.id ? 'Editar cliente' : 'Novo cliente'}
        aberto={!!form}
        onFechar={() => setForm(null)}
        largura={860}
        rodape={
          <>
            <button className="btn" onClick={() => setForm(null)}>
              Cancelar
            </button>
            <button className="btn btn-primario" type="submit" form="form-cliente">
              Salvar
            </button>
          </>
        }
      >
        {form && (
          <form id="form-cliente" onSubmit={gravar}>
            <Aviso>{erro}</Aviso>
            <Abas
              abas={{ dados: 'Dados pessoais', endereco: 'Endereço', receitas: `Receitas (${form.receitas.length})`, compras: `Compras (${comprasDoCliente.length})` }}
              ativa={aba}
              onTrocar={setAba}
            />

            {aba === 'dados' && (
              <div className="grade-form">
                <Campo rotulo="Nome completo *" span={6}>
                  <input value={form.nome} onChange={set('nome')} autoFocus />
                </Campo>
                <Campo rotulo="CPF" span={2} erro={form.cpf.length === 14 && !validarCPF(form.cpf) ? 'CPF inválido' : ''}>
                  <input value={form.cpf} onChange={set('cpf', mascaraCPF)} inputMode="numeric" placeholder="000.000.000-00" />
                </Campo>
                <Campo rotulo="RG" span={2}>
                  <input value={form.rg} onChange={set('rg')} />
                </Campo>
                <Campo rotulo="Data de nascimento" span={2}>
                  <input type="date" value={form.dataNascimento} onChange={set('dataNascimento')} />
                </Campo>
                <Campo rotulo="Telefone" span={2}>
                  <input value={form.telefone} onChange={set('telefone', mascaraTelefone)} inputMode="tel" />
                </Campo>
                <Campo rotulo="WhatsApp" span={2}>
                  <input value={form.whatsapp} onChange={set('whatsapp', mascaraTelefone)} inputMode="tel" />
                </Campo>
                <Campo rotulo="E-mail" span={2}>
                  <input type="email" value={form.email} onChange={set('email')} />
                </Campo>
                <div className="campo span-6">
                  <label className="checkbox">
                    <input type="checkbox" checked={form.aceitaWhatsApp} onChange={set('aceitaWhatsApp')} />
                    Cliente autoriza contato por WhatsApp (LGPD)
                  </label>
                </div>
                <Campo rotulo="Observações" span={6}>
                  <textarea value={form.observacoes} onChange={set('observacoes')} />
                </Campo>
              </div>
            )}

            {aba === 'endereco' && (
              <div className="grade-form">
                <CamposEndereco valor={form.endereco} onMudar={(endereco) => setForm((f) => ({ ...f, endereco }))} />
              </div>
            )}

            {aba === 'receitas' && (
              <>
                {form.receitas.map((r) => (
                  <div className="receita" key={r.id}>
                    <div className="grade-form">
                      <Campo rotulo="Data da receita" span={2}>
                        <input type="date" value={r.data} onChange={(e) => mudarReceita(r.id, (x) => ({ ...x, data: e.target.value }))} />
                      </Campo>
                      <Campo rotulo="Médico / CRM" span={3}>
                        <input value={r.medico} onChange={(e) => mudarReceita(r.id, (x) => ({ ...x, medico: e.target.value }))} />
                      </Campo>
                      <div className="campo span-1" style={{ justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-perigo"
                          onClick={() => confirm('Remover esta receita?') && setForm((f) => ({ ...f, receitas: f.receitas.filter((x) => x.id !== r.id) }))}
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                    <div className="tabela-wrap" style={{ margin: '12px 0 0' }}>
                      <table className="tabela-compacta">
                        <thead>
                          <tr>
                            <th>Olho</th>
                            {Object.values(COLUNAS_RECEITA).map((t) => (
                              <th key={t}>{t}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {['od', 'oe'].map((olho) => (
                            <tr key={olho}>
                              <td>{olho.toUpperCase()}</td>
                              {Object.keys(COLUNAS_RECEITA).map((campo) => (
                                <td key={campo}>
                                  <input
                                    value={r[olho][campo]}
                                    aria-label={`${olho.toUpperCase()} ${COLUNAS_RECEITA[campo]}`}
                                    onChange={(e) => mudarReceita(r.id, (x) => ({ ...x, [olho]: { ...x[olho], [campo]: e.target.value } }))}
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="grade-form" style={{ marginTop: 10 }}>
                      <Campo rotulo="Observações (tipo de lente, uso, etc.)" span={6}>
                        <input value={r.observacoes} onChange={(e) => mudarReceita(r.id, (x) => ({ ...x, observacoes: e.target.value }))} />
                      </Campo>
                    </div>
                  </div>
                ))}
                {!form.receitas.length && <Vazio titulo="Nenhuma receita registrada" />}
                <button type="button" className="btn" onClick={() => setForm((f) => ({ ...f, receitas: [receitaVazia(), ...f.receitas] }))}>
                  <Plus size={16} /> Adicionar receita
                </button>
              </>
            )}

            {aba === 'compras' &&
              (comprasDoCliente.length ? (
                <div className="tabela-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Venda</th>
                        <th>Data</th>
                        <th>Itens</th>
                        <th className="num">Total</th>
                        <th>Vencimento do óculos</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {comprasDoCliente.map((v) => {
                        const dias = v.vencimentoOculos ? diasAte(v.vencimentoOculos) : null;
                        const link = v.vencimentoOculos && zap(form, mensagemVencimento(form, v));
                        return (
                          <tr key={v.id}>
                            <td>#{v.numero}</td>
                            <td>{data(v.data)}</td>
                            <td>{v.itens.map((i) => i.descricao).join(', ')}</td>
                            <td className="num">{moeda(v.total)}</td>
                            <td>
                              {v.vencimentoOculos ? (
                                <>
                                  {data(v.vencimentoOculos)}{' '}
                                  {dias < 0 ? <span className="selo perigo">Vencido</span> : dias <= 30 ? <span className="selo alerta">Em {dias} dia(s)</span> : null}
                                </>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="td-acoes">
                              {link && (
                                <a className="btn-icone whatsapp" href={link} target="_blank" rel="noreferrer" title="Enviar lembrete por WhatsApp">
                                  <MessageCircle size={17} />
                                </a>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Vazio titulo={form.id ? 'Nenhuma compra registrada' : 'Salve o cliente para registrar compras no PDV'} />
              ))}
          </form>
        )}
      </Modal>
    </>
  );
}
