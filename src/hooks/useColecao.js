import { useCallback, useEffect, useState } from 'react';
import { listar, observar } from '../db/database';

// Lê uma coleção e recarrega sozinho quando ela é alterada em qualquer tela.
export function useColecao(colecao) {
  const [dados, setDados] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    setDados(await listar(colecao));
    setCarregando(false);
  }, [colecao]);

  useEffect(() => {
    recarregar();
    return observar(colecao, recarregar);
  }, [colecao, recarregar]);

  return { dados, carregando };
}
