// Banco de dados local (IndexedDB) da Fase 1.
// Toda a aplicação acessa os dados por estas funções; na Fase 2 basta
// reimplementá-las chamando a API do backend, sem mexer nas telas.

const DB_NOME = 'sistema-otica';
const DB_VERSAO = 1;

export const COLECOES = [
  'usuarios',
  'clientes',
  'fornecedores',
  'produtos',
  'movimentacoes',
  'entradas',
  'contas',
  'vendas',
];

let conexao;

function abrir() {
  if (!conexao) {
    conexao = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NOME, DB_VERSAO);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const nome of COLECOES) {
          if (!db.objectStoreNames.contains(nome)) db.createObjectStore(nome, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return conexao;
}

const aguardar = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

// crypto.randomUUID só existe em contexto seguro (https/localhost);
// o fallback cobre o acesso pelo celular via http://IP-da-rede.
export function novoId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export async function listar(colecao) {
  const db = await abrir();
  return aguardar(db.transaction(colecao).objectStore(colecao).getAll());
}

export async function buscar(colecao, id) {
  const db = await abrir();
  return aguardar(db.transaction(colecao).objectStore(colecao).get(id));
}

export async function salvar(colecao, registro) {
  const db = await abrir();
  const gravado = { ...registro, id: registro.id ?? novoId() };
  await aguardar(db.transaction(colecao, 'readwrite').objectStore(colecao).put(gravado));
  notificar(colecao);
  return gravado;
}

export async function excluir(colecao, id) {
  const db = await abrir();
  await aguardar(db.transaction(colecao, 'readwrite').objectStore(colecao).delete(id));
  notificar(colecao);
}

// Executa várias leituras/gravações numa única transação: ou tudo é gravado,
// ou nada é (ex.: venda baixa estoque E gera contas a receber).
// Dentro de `fn` só aguarde operações do próprio `tx`, senão a transação fecha.
export async function transacao(colecoes, fn) {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const t = db.transaction(colecoes, 'readwrite');
    const tx = {
      get: (c, id) => aguardar(t.objectStore(c).get(id)),
      getAll: (c) => aguardar(t.objectStore(c).getAll()),
      put: (c, registro) => {
        const gravado = { ...registro, id: registro.id ?? novoId() };
        t.objectStore(c).put(gravado);
        return gravado;
      },
      delete: (c, id) => t.objectStore(c).delete(id),
    };
    let resultado;
    Promise.resolve()
      .then(() => fn(tx))
      .then((r) => {
        resultado = r;
      })
      .catch((erro) => {
        try {
          t.abort();
        } catch {
          /* transação já finalizada */
        }
        reject(erro);
      });
    t.oncomplete = () => {
      colecoes.forEach(notificar);
      resolve(resultado);
    };
    t.onabort = () => reject(t.error ?? new Error('Operação cancelada.'));
  });
}

// Avisos de alteração para as telas recarregarem os dados.
const ouvintes = new Map();

export function observar(colecao, callback) {
  if (!ouvintes.has(colecao)) ouvintes.set(colecao, new Set());
  ouvintes.get(colecao).add(callback);
  return () => ouvintes.get(colecao).delete(callback);
}

function notificar(colecao) {
  ouvintes.get(colecao)?.forEach((cb) => cb());
}
