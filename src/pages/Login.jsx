import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Glasses } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Aviso, Campo } from '../components/ui';

export default function Login() {
  const { usuario, entrar } = useAuth();
  const navegar = useNavigate();
  const destino = useLocation().state?.de || '/';
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Navigate to={destino} replace />;

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await entrar(login, senha);
      navegar(destino, { replace: true });
    } catch (err) {
      setErro(err.message);
      setEnviando(false);
    }
  }

  return (
    <div className="login-pagina">
      <div className="login-cartao">
        <div className="marca">
          <Glasses size={30} />
        </div>
        <h1>Sistema Ótica</h1>
        <p className="muted">Entre com seu usuário para continuar.</p>
        <form onSubmit={enviar}>
          <Aviso>{erro}</Aviso>
          <Campo rotulo="Usuário">
            <input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" autoFocus required />
          </Campo>
          <Campo rotulo="Senha">
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required />
          </Campo>
          <button className="btn btn-primario btn-grande" disabled={enviando}>
            {enviando ? 'Entrando...' : 'Entrar'}
          </button>
          <small className="muted">Acesso inicial: admin / admin</small>
        </form>
      </div>
    </div>
  );
}
