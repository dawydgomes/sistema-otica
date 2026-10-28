import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { excluir, salvar } from '../db/database';
import { useColecao } from '../hooks/useColecao';
import { Aviso, Busca, Cabecalho, Campo, Modal, normalizar, Vazio } from '../components/ui';
import { CamposEndereco, enderecoVazio } from '../components/Endereco';
import { hojeISO, mascaraCNPJ, mascaraTelefone, normalizarCNPJ } from '../utils/format';
import { emailValido, validarCNPJ } from '../utils/validators';
import { buscarCNPJ } from '../utils/integracoes';

const fornecedorVazio = () => ({
  razaoSocial: '',
  nomeFantasia: '',
  cnpj: '',
  ie: '',
  telefone: '',
  email: '',
  contato: '',
  endereco: enderecoVazio(),
  observacoes: '',
});

export default function Fornecedores() {
  const { dados: fornecedores, carregando } = useColecao('fornecedores');
  const { dados: produtos } = useColecao('produtos');
  const { dados: entradas } = useColecao('entradas');
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [consultando, setConsultando] = useState(false);

  const filtrados = useMemo(() => {
    const termo = normalizar(busca);
    return fornecedores
      .filter((f) => !termo || normalizar(`${f.razaoSocial} ${f.nomeFantasia} ${f.cnpj}`).includes(termo))
      .sort((a, b) => (a.nomeFantasia || a.razaoSocial).localeCompare(b.nomeFantasia || b.razaoSocial));
  }, [fornecedores, busca]);

  function abrir(f) {
    setForm(f ? structuredClone({ ...fornecedorVazio(), ...f }) : fornecedorVazio());
    setErro('');
    setAviso('');
  }

  const set = (campo, mascara) => (e) => setForm((f) => ({ ...f, [campo]: mascara ? mascara(e.target.value) : e.target.value }));

  async function consultarReceita() {
    if (!validarCNPJ(form.cnpj)) return setErro('Digite um CNPJ válido para consultar.');
    setErro('');
    setConsultando(true);
    try {
      const d = await buscarCNPJ(form.cnpj);
      setForm((f) => ({ ...f, ...d, contato: f.contato, ie: f.ie, observacoes: f.observacoes }));
      setAviso(d.situacao ? `Dados preenchidos pela Receita Federal. Situação cadastral: ${d.situacao}.` : 'Dados preenchidos pela Receita Federal.');
    } catch (e) {
      setErro(`Consulta do CNPJ: ${e.message}`);
    } finally {
      setConsultando(false);
    }
  }

  async function gravar(e) {
    e.preventDefault();
    if (!form.razaoSocial.trim()) return setErro('Informe a razão social.');
    if (!validarCNPJ(form.cnpj)) return setErro('CNPJ inválido.');
    if (!emailValido(form.email)) return setErro('E-mail inválido.');
    if (fornecedores.some((f) => f.id !== form.id && normalizarCNPJ(f.cnpj) === normalizarCNPJ(form.cnpj))) return setErro('Já existe um fornecedor com este CNPJ.');
    const { situacao: _situacao, ...dados } = form;
    await salvar('fornecedores', { ...dados, criadoEm: form.criadoEm ?? hojeISO() });
    setForm(null);
  }

  async function remover(f) {
    if (entradas.some((e) => e.fornecedorId === f.id)) return alert('Este fornecedor possui notas de entrada e não pode ser excluído.');
    if (confirm(`Excluir o fornecedor "${f.nomeFantasia || f.razaoSocial}"?`)) await excluir('fornecedores', f.id);
  }

  return (
    <>
      <Cabecalho titulo="Fornecedores" subtitulo={`${fornecedores.length} cadastrado(s)`}>
        <Busca valor={busca} onMudar={setBusca} placeholder="Nome ou CNPJ" />
        <button className="btn btn-primario" onClick={() => abrir(null)}>
          <Plus size={16} /> Novo fornecedor
        </button>
      </Cabecalho>

      <section className="cartao">
        {!carregando && !filtrados.length ? (
          <Vazio titulo="Nenhum fornecedor encontrado">Fornecedores também são criados automaticamente ao importar o XML de uma nota.</Vazio>
        ) : (
          <div className="tabela-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fornecedor</th>
                  <th>CNPJ</th>
                  <th>Contato</th>
                  <th>Cidade</th>
                  <th className="num">Produtos</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <strong>{f.nomeFantasia || f.razaoSocial}</strong>
                      {f.nomeFantasia && <span className="sub">{f.razaoSocial}</span>}
                    </td>
                    <td>{f.cnpj}</td>
                    <td>
                      {f.contato || '—'}
                      <span className="sub">{[f.telefone, f.email].filter(Boolean).join(' · ')}</span>
                    </td>
                    <td>{f.endereco?.cidade ? `${f.endereco.cidade}/${f.endereco.uf}` : '—'}</td>
                    <td className="num">{produtos.filter((p) => p.fornecedorId === f.id).length}</td>
                    <td className="td-acoes">
                      <button className="btn-icone" onClick={() => abrir(f)} title="Editar">
                        <Pencil size={16} />
                      </button>
                      <button className="btn-icone perigo" onClick={() => remover(f)} title="Excluir">
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
        titulo={form?.id ? 'Editar fornecedor' : 'Novo fornecedor'}
        aberto={!!form}
        onFechar={() => setForm(null)}
        rodape={
          <>
            <button className="btn" onClick={() => setForm(null)}>
              Cancelar
            </button>
            <button className="btn btn-primario" type="submit" form="form-fornecedor">
              Salvar
            </button>
          </>
        }
      >
        {form && (
          <form id="form-fornecedor" className="grade-form" onSubmit={gravar}>
            {(erro || aviso) && (
              <div style={{ gridColumn: '1 / -1' }}>
                <Aviso>{erro}</Aviso>
                <Aviso tipo="ok">{aviso}</Aviso>
              </div>
            )}
            <Campo rotulo="CNPJ *" span={3}>
              <div className="com-botao">
                <input value={form.cnpj} onChange={set('cnpj', mascaraCNPJ)} placeholder="00.000.000/0000-00" autoFocus />
                <button type="button" className="btn" onClick={consultarReceita} disabled={consultando}>
                  {consultando ? 'Buscando...' : 'Buscar'}
                </button>
              </div>
            </Campo>
            <Campo rotulo="Inscrição estadual" span={3}>
              <input value={form.ie} onChange={set('ie')} />
            </Campo>
            <Campo rotulo="Razão social *" span={6}>
              <input value={form.razaoSocial} onChange={set('razaoSocial')} />
            </Campo>
            <Campo rotulo="Nome fantasia" span={6}>
              <input value={form.nomeFantasia} onChange={set('nomeFantasia')} />
            </Campo>
            <Campo rotulo="Pessoa de contato" span={2}>
              <input value={form.contato} onChange={set('contato')} />
            </Campo>
            <Campo rotulo="Telefone" span={2}>
              <input value={form.telefone} onChange={set('telefone', mascaraTelefone)} inputMode="tel" />
            </Campo>
            <Campo rotulo="E-mail" span={2}>
              <input type="email" value={form.email} onChange={set('email')} />
            </Campo>
            <div className="secao-form">Endereço</div>
            <CamposEndereco valor={form.endereco} onMudar={(endereco) => setForm((f) => ({ ...f, endereco }))} />
            <Campo rotulo="Observações" span={6}>
              <textarea value={form.observacoes} onChange={set('observacoes')} />
            </Campo>
          </form>
        )}
      </Modal>
    </>
  );
}
