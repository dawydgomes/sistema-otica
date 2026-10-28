import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ArrowDownToLine, Boxes, Glasses, LayoutDashboard, LogOut, Menu, ShoppingCart, Truck, Users, Wallet } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

const MENU = [
  { para: '/', rotulo: 'Dashboard', icone: LayoutDashboard },
  { para: '/pdv', rotulo: 'PDV / Vendas', icone: ShoppingCart },
  { para: '/clientes', rotulo: 'Clientes', icone: Users },
  { para: '/fornecedores', rotulo: 'Fornecedores', icone: Truck },
  { para: '/produtos', rotulo: 'Produtos e estoque', icone: Boxes },
  { para: '/entradas', rotulo: 'Entrada de mercadorias', icone: ArrowDownToLine },
  { para: '/financeiro', rotulo: 'Financeiro', icone: Wallet },
];

export default function Layout() {
  const { usuario, sair } = useAuth();
  const { pathname } = useLocation();
  const [menuAberto, setMenuAberto] = useState(false);
  const [ultimaRota, setUltimaRota] = useState(pathname);

  // Fecha o menu lateral (mobile) ao trocar de página.
  if (pathname !== ultimaRota) {
    setUltimaRota(pathname);
    setMenuAberto(false);
  }

  return (
    <div className="app">
      <aside className={`sidebar${menuAberto ? ' aberta' : ''}`}>
        <div className="sidebar-marca">
          <Glasses size={24} /> Ótica
        </div>
        <nav>
          {MENU.map(({ para, rotulo, icone: Icone }) => (
            <NavLink key={para} to={para} end={para === '/'}>
              <Icone size={18} /> {rotulo}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-rodape">
          <span>{usuario?.nome}</span>
          <button type="button" onClick={sair} title="Sair">
            <LogOut size={16} /> Sair
          </button>
        </div>
      </aside>
      <div className={`sidebar-fundo${menuAberto ? ' aberta' : ''}`} onClick={() => setMenuAberto(false)} />

      <main className="conteudo">
        <div className="topo-mobile">
          <button type="button" className="btn-icone" onClick={() => setMenuAberto(true)} aria-label="Abrir menu">
            <Menu size={20} />
          </button>
          <Glasses size={20} /> Ótica
        </div>
        <Outlet />
      </main>
    </div>
  );
}
