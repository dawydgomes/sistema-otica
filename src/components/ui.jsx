import { useEffect } from 'react';
import { Search, X } from 'lucide-react';

export function Cabecalho({ titulo, subtitulo, children }) {
  return (
    <header className="cabecalho">
      <div>
        <h1>{titulo}</h1>
        {subtitulo && <p>{subtitulo}</p>}
      </div>
      {children && <div className="acoes">{children}</div>}
    </header>
  );
}

export function Modal({ titulo, aberto, onFechar, children, rodape, largura = 760 }) {
  useEffect(() => {
    if (!aberto) return undefined;
    const aoTeclar = (e) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aberto, onFechar]);

  if (!aberto) return null;
  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div className="modal" style={{ maxWidth: largura }} role="dialog" aria-modal="true" aria-label={titulo}>
        <header className="modal-cabecalho">
          <h2>{titulo}</h2>
          <button type="button" className="btn-icone" onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>
        <div className="modal-corpo">{children}</div>
        {rodape && <footer className="modal-rodape">{rodape}</footer>}
      </div>
    </div>
  );
}

export function Campo({ rotulo, erro, span, children }) {
  return (
    <label className={`campo${span ? ` span-${span}` : ''}`}>
      <span>{rotulo}</span>
      {children}
      {erro && <small className="erro">{erro}</small>}
    </label>
  );
}

export function Abas({ abas, ativa, onTrocar }) {
  return (
    <div className="abas" role="tablist">
      {Object.entries(abas).map(([chave, rotulo]) => (
        <button key={chave} type="button" role="tab" aria-selected={ativa === chave} className={ativa === chave ? 'ativa' : ''} onClick={() => onTrocar(chave)}>
          {rotulo}
        </button>
      ))}
    </div>
  );
}

export function Busca({ valor, onMudar, placeholder = 'Buscar...' }) {
  return (
    <div className="busca">
      <Search size={16} />
      <input type="search" value={valor} onChange={(e) => onMudar(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </div>
  );
}

export function Vazio({ titulo, children }) {
  return (
    <div className="vazio">
      <strong>{titulo}</strong>
      {children}
    </div>
  );
}

export const Aviso = ({ tipo = 'erro', children }) => (children ? <div className={`aviso ${tipo}`}>{children}</div> : null);

// Normaliza texto para busca sem acento/maiúsculas.
export const normalizar = (s = '') =>
  String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
