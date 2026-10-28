import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { garantirUsuarioPadrao } from './db/seed';
import './styles/global.css';

const raiz = createRoot(document.getElementById('root'));

garantirUsuarioPadrao()
  .then(() =>
    raiz.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  )
  .catch((erro) => {
    console.error(erro);
    raiz.render(
      <div className="login-pagina">
        <div className="login-cartao">
          <h1>Não foi possível abrir o banco de dados</h1>
          <p>Verifique se o navegador não está em modo anônimo ou com armazenamento bloqueado.</p>
        </div>
      </div>,
    );
  });
