import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { MessageCircle } from 'lucide-react';
import { useColecao } from '../hooks/useColecao';
import { Cabecalho, Vazio } from '../components/ui';
import { carregarDadosExemplo } from '../db/seed';
import { FORMAS_PAGAMENTO } from '../services/constantes';
import { estoqueBaixo } from './Produtos';
import { mensagemVencimento } from './Clientes';
import { addMeses, data, diasAte, hojeISO, moeda, nomeMes } from '../utils/format';
import { linkWhatsApp } from '../utils/integracoes';

// Lê as cores do CSS global (e acompanha o modo claro/escuro do sistema).
function useCoresGrafico() {
  const ler = () => {
    const css = getComputedStyle(document.documentElement);
    const v = (nome) => css.getPropertyValue(nome).trim();
    return { serie1: v('--serie-1'), serie2: v('--serie-2'), grade: v('--grade-grafico'), texto: v('--texto-3') };
  };
  const [cores, setCores] = useState(ler);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const atualizar = () => setCores(ler());
    mq.addEventListener('change', atualizar);
    return () => mq.removeEventListener('change', atualizar);
  }, []);
  return cores;
}

const moedaCurta = (v) => (Math.abs(v) >= 1000 ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : moeda(v));

function TooltipFluxo({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const [rec, desp] = payload;
  return (
    <div className="tooltip-grafico">
      <strong>{label}</strong>
      <div>Recebido: {moeda(rec.value)}</div>
      <div>Pago: {moeda(desp.value)}</div>
      <div>Saldo: {moeda(rec.value - desp.value)}</div>
    </div>
  );
}

function TooltipValor({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tooltip-grafico">
      <strong>{label}</strong>
      {moeda(payload[0].value)}
    </div>
  );
}

export default function Dashboard() {
  const { dados: contas } = useColecao('contas');
  const { dados: vendas } = useColecao('vendas');
  const { dados: produtos } = useColecao('produtos');
  const { dados: clientes, carregando } = useColecao('clientes');
  const cores = useCoresGrafico();
  const [carregandoExemplo, setCarregandoExemplo] = useState(false);

  const hoje = hojeISO();
  const mesAtual = hoje.slice(0, 7);

  const indicadores = useMemo(() => {
    const soma = (arr) => arr.reduce((s, c) => s + c.valor, 0);
    const vendasMes = vendas.filter((v) => v.data.startsWith(mesAtual));
    const receberAberto = contas.filter((c) => c.tipo === 'receber' && !c.pagoEm);
    const pagarAberto = contas.filter((c) => c.tipo === 'pagar' && !c.pagoEm);
    const liquidadasMes = contas.filter((c) => c.pagoEm?.startsWith(mesAtual));
    return {
      vendasMes: vendasMes.reduce((s, v) => s + v.total, 0),
      qtdVendasMes: vendasMes.length,
      receber: soma(receberAberto),
      receberVencido: soma(receberAberto.filter((c) => c.vencimento < hoje)),
      pagar: soma(pagarAberto),
      pagarVencido: soma(pagarAberto.filter((c) => c.vencimento < hoje)),
      saldoMes: soma(liquidadasMes.filter((c) => c.tipo === 'receber')) - soma(liquidadasMes.filter((c) => c.tipo === 'pagar')),
    };
  }, [contas, vendas, mesAtual, hoje]);

  // Fluxo de caixa realizado (pelo dia da baixa) nos últimos 6 meses.
  const fluxo = useMemo(() => {
    const meses = Array.from({ length: 6 }, (_, i) => addMeses(`${mesAtual}-01`, i - 5).slice(0, 7));
    return meses.map((m) => {
      const doMes = contas.filter((c) => c.pagoEm?.startsWith(m));
      const total = (tipo) => doMes.filter((c) => c.tipo === tipo).reduce((s, c) => s + c.valor, 0);
      return { mes: nomeMes(m), recebido: total('receber'), pago: total('pagar') };
    });
  }, [contas, mesAtual]);

  const porForma = useMemo(() => {
    const limite = addMeses(hoje, -6);
    const totais = {};
    vendas.filter((v) => v.data >= limite).forEach((v) => (totais[v.formaPagamento] = (totais[v.formaPagamento] || 0) + v.total));
    return Object.entries(totais)
      .map(([forma, total]) => ({ forma: FORMAS_PAGAMENTO[forma], total }))
      .sort((a, b) => b.total - a.total);
  }, [vendas, hoje]);

  const vencimentos = useMemo(
    () =>
      vendas
        .filter((v) => v.vencimentoOculos && v.clienteId)
        .map((v) => ({ venda: v, cliente: clientes.find((c) => c.id === v.clienteId), dias: diasAte(v.vencimentoOculos) }))
        .filter((x) => x.cliente && x.dias >= -30 && x.dias <= 45)
        .sort((a, b) => a.dias - b.dias),
    [vendas, clientes],
  );

  const baixos = produtos.filter(estoqueBaixo).sort((a, b) => a.estoque - b.estoque);
  const semDados = !carregando && !clientes.length && !produtos.length && !contas.length;

  async function exemplo() {
    setCarregandoExemplo(true);
    try {
      await carregarDadosExemplo();
    } finally {
      setCarregandoExemplo(false);
    }
  }

  return (
    <>
      <Cabecalho titulo="Dashboard" subtitulo={new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />

      {semDados && (
        <div className="aviso info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span>O sistema está vazio. Quer carregar alguns dados fictícios para conhecer as telas?</span>
          <button className="btn btn-primario" onClick={exemplo} disabled={carregandoExemplo}>
            {carregandoExemplo ? 'Carregando...' : 'Carregar dados de exemplo'}
          </button>
        </div>
      )}

      <div className="grade-kpi">
        <Link to="/pdv" className="cartao kpi" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="rotulo">Vendas no mês</div>
          <div className="valor">{moeda(indicadores.vendasMes)}</div>
          <div className="detalhe">{indicadores.qtdVendasMes} venda(s)</div>
        </Link>
        <Link to="/financeiro" className="cartao kpi" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="rotulo">A receber (em aberto)</div>
          <div className="valor">{moeda(indicadores.receber)}</div>
          <div className="detalhe">{indicadores.receberVencido > 0 ? `${moeda(indicadores.receberVencido)} vencido` : 'Nada vencido'}</div>
        </Link>
        <Link to="/financeiro" className="cartao kpi" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="rotulo">A pagar (em aberto)</div>
          <div className="valor">{moeda(indicadores.pagar)}</div>
          <div className="detalhe">{indicadores.pagarVencido > 0 ? `${moeda(indicadores.pagarVencido)} vencido` : 'Nada vencido'}</div>
        </Link>
        <div className="cartao kpi">
          <div className="rotulo">Saldo realizado no mês</div>
          <div className="valor">{moeda(indicadores.saldoMes)}</div>
          <div className="detalhe">Recebido − pago</div>
        </div>
      </div>

      <div className="grade-2">
        <section className="cartao">
          <div className="cartao-titulo">
            <h2>Fluxo de caixa — últimos 6 meses</h2>
          </div>
          <div className="legenda">
            <span>
              <i style={{ background: cores.serie1 }} />
              Recebido
            </span>
            <span>
              <i style={{ background: cores.serie2 }} />
              Pago
            </span>
          </div>
          <div className="grafico">
            <ResponsiveContainer>
              <BarChart data={fluxo} barGap={2} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={cores.grade} />
                <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fill: cores.texto, fontSize: 12 }} />
                <YAxis tickFormatter={moedaCurta} tickLine={false} axisLine={false} width={80} tick={{ fill: cores.texto, fontSize: 12 }} />
                <Tooltip content={<TooltipFluxo />} cursor={{ fill: cores.grade, opacity: 0.5 }} />
                <Bar dataKey="recebido" name="Recebido" fill={cores.serie1} radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="pago" name="Pago" fill={cores.serie2} radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="cartao">
          <div className="cartao-titulo">
            <h2>Vendas por forma de pagamento (6 meses)</h2>
          </div>
          {porForma.length ? (
            <div className="grafico">
              <ResponsiveContainer>
                <BarChart data={porForma} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid horizontal={false} stroke={cores.grade} />
                  <XAxis type="number" tickFormatter={moedaCurta} tickLine={false} axisLine={false} tick={{ fill: cores.texto, fontSize: 12 }} />
                  <YAxis type="category" dataKey="forma" tickLine={false} axisLine={false} width={120} tick={{ fill: cores.texto, fontSize: 12 }} />
                  <Tooltip content={<TooltipValor />} cursor={{ fill: cores.grade, opacity: 0.5 }} />
                  <Bar dataKey="total" fill={cores.serie1} radius={[0, 4, 4, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Vazio titulo="Sem vendas no período" />
          )}
        </section>
      </div>

      <div className="grade-2">
        <section className="cartao">
          <div className="cartao-titulo">
            <h2>Óculos vencendo (próximos 45 dias)</h2>
            <Link to="/clientes" className="btn btn-pequeno">
              Clientes
            </Link>
          </div>
          {vencimentos.length ? (
            <ul className="lista-simples">
              {vencimentos.map(({ venda, cliente, dias }) => {
                const link = cliente.aceitaWhatsApp ? linkWhatsApp(cliente.whatsapp || cliente.telefone, mensagemVencimento(cliente, venda)) : null;
                return (
                  <li key={venda.id}>
                    <span>
                      <strong>{cliente.nome}</strong>
                      <span className="sub">
                        Venda #{venda.numero} · vence {data(venda.vencimentoOculos)}
                      </span>
                    </span>
                    <span className="acoes">
                      {dias < 0 ? <span className="selo perigo">Vencido há {-dias} dia(s)</span> : <span className="selo alerta">Em {dias} dia(s)</span>}
                      {link ? (
                        <a className="btn btn-pequeno" href={link} target="_blank" rel="noreferrer">
                          <MessageCircle size={14} /> Avisar
                        </a>
                      ) : (
                        <span className="muted" title="Sem WhatsApp ou sem autorização de contato">
                          Sem WhatsApp
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Vazio titulo="Nenhum vencimento próximo" />
          )}
        </section>

        <section className="cartao">
          <div className="cartao-titulo">
            <h2>Estoque baixo</h2>
            <Link to="/produtos" className="btn btn-pequeno">
              Produtos
            </Link>
          </div>
          {baixos.length ? (
            <ul className="lista-simples">
              {baixos.slice(0, 8).map((p) => (
                <li key={p.id}>
                  <span>{p.descricao}</span>
                  <span className="selo alerta">
                    {p.estoque} / mín. {p.estoqueMinimo}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Vazio titulo="Estoque em dia" />
          )}
        </section>
      </div>
    </>
  );
}
