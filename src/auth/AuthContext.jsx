import { createContext, useContext, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { listar } from '../db/database';

// Fase 1: login local com usuário padrão admin/admin.
// Fase 2: autenticação no backend (senha com hash, tokens, perfis de acesso).
const AuthContext = createContext(null);
const CHAVE_SESSAO = 'otica.sessao';

function lerSessao() {
  try {
    return JSON.parse(sessionStorage.getItem(CHAVE_SESSAO));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(lerSessao);

  async function entrar(login, senha) {
    const usuarios = await listar('usuarios');
    const u = usuarios.find((x) => x.login === login.trim().toLowerCase() && x.senha === senha);
    if (!u) throw new Error('Usuário ou senha inválidos.');
    const sessao = { id: u.id, nome: u.nome, login: u.login, perfil: u.perfil };
    sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
    setUsuario(sessao);
  }

  function sair() {
    sessionStorage.removeItem(CHAVE_SESSAO);
    setUsuario(null);
  }

  return <AuthContext.Provider value={{ usuario, entrar, sair }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export function RotaProtegida({ children }) {
  const { usuario } = useAuth();
  const local = useLocation();
  if (!usuario) return <Navigate to="/login" replace state={{ de: local.pathname }} />;
  return children;
}
