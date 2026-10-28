# Sistema Ótica

Sistema web responsivo (desktop e celular) para gestão de óticas: clientes com receita óptica,
fornecedores, estoque, entrada de mercadorias por XML de NF-e, PDV e financeiro.

## Como rodar

```bash
npm install
npm run dev      # abre em http://localhost:5173
```

- Login inicial: **admin / admin**
- No primeiro acesso, o Dashboard oferece **“Carregar dados de exemplo”** para conhecer as telas.
- Para testar no celular: com o PC e o celular na mesma rede, abra `http://IP-DO-PC:5173`.
- Build de produção: `npm run build` (gera a pasta `dist/`).

## Stack

React 19 + Vite, React Router, Recharts (gráficos), lucide-react (ícones).
Estilo em um único CSS global (`src/styles/global.css`) com variáveis de cor e suporte a modo escuro.

## Estrutura

```
src/
  db/database.js       Camada de dados (IndexedDB). Única porta de acesso aos dados.
  db/seed.js           Usuário padrão e dados de exemplo
  services/negocio.js  Regras que envolvem várias coleções (entrada, venda, baixa, ajuste)
  services/constantes.js
  utils/               Formatação/máscaras, validação CPF/CNPJ, leitura de XML NF-e,
                       consultas BrasilAPI (CEP/CNPJ), link de WhatsApp
  components/          Layout com sidebar, modal, campos de endereço
  pages/               Uma tela por módulo
```

## Regras de negócio implementadas

| Ação | Efeito automático |
|---|---|
| Entrada de mercadorias (XML ou manual) | Cadastra fornecedor/produtos novos, soma estoque, gera contas a pagar por duplicata. Bloqueia nota repetida (pela chave). |
| Venda no PDV | Baixa estoque (bloqueia se insuficiente), gera contas a receber. À vista = já recebida; cartão de crédito/crediário = parcelas em aberto. |
| Venda com armação/lente | Define o vencimento do óculos (padrão: 12 meses) e o Dashboard lista os próximos vencimentos com botão de WhatsApp. |
| Ajuste de estoque | Registra movimentação com motivo (inventário, quebra...). |

Tudo que mexe em mais de uma coleção roda numa transação: ou grava tudo ou nada.

## Roadmap

### Fase 1 — atual (somente frontend)
- [x] Login, layout com sidebar, dashboard com gráficos
- [x] Clientes com receita óptica (OD/OE), histórico de compras e consentimento de WhatsApp (LGPD)
- [x] Fornecedores com consulta de CNPJ (Receita Federal via BrasilAPI) e CEP
- [x] Produtos e estoque com alerta de estoque mínimo
- [x] Entrada de mercadorias por upload do XML da NF-e
- [x] Contas a pagar e a receber, parcelamento, baixa e estorno
- [x] PDV com crediário, leitor de código de barras e resumo por WhatsApp (envio manual)

**Limitações conhecidas desta fase:** os dados ficam no navegador de cada aparelho (não sincronizam
entre computador e celular) e o login é local. Use para validar fluxos e telas, não em produção.

### Fase 2 — backend
- [ ] API (Node) + banco de dados (PostgreSQL) — trocar `db/database.js` por chamadas à API
- [ ] Autenticação real (senha com hash, perfis: administrador, vendedor, financeiro)
- [ ] Emissão de NF-e/NFC-e via provedor (Focus NFe, NFe.io, PlugNotas ou Nuvem Fiscal) com certificado A1
- [ ] Download automático das notas de compra na SEFAZ (Distribuição DF-e)
- [ ] WhatsApp automático (API oficial do WhatsApp Business) + agendador de lembretes de vencimento
- [ ] Ordem de serviço / laboratório (status, previsão de entrega)
- [ ] Backup, logs de auditoria e política LGPD (receita óptica é dado de saúde)
