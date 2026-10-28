import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, RotaProtegida } from './auth/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clientes from './pages/Clientes';
import Fornecedores from './pages/Fornecedores';
import Produtos from './pages/Produtos';
import Entradas from './pages/Entradas';
import Financeiro from './pages/Financeiro';
import PDV from './pages/PDV';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <RotaProtegida>
                <Layout />
              </RotaProtegida>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="pdv" element={<PDV />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="fornecedores" element={<Fornecedores />} />
            <Route path="produtos" element={<Produtos />} />
            <Route path="entradas" element={<Entradas />} />
            <Route path="financeiro" element={<Financeiro />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
