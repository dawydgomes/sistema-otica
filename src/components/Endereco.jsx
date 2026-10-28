import { useState } from 'react';
import { Campo } from './ui';
import { UFS } from '../services/constantes';
import { mascaraCEP, somenteDigitos } from '../utils/format';
import { buscarCEP } from '../utils/integracoes';

export const enderecoVazio = () => ({ cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' });

// Campos de endereço com preenchimento automático pelo CEP.
export function CamposEndereco({ valor, onMudar }) {
  const [status, setStatus] = useState('');
  const set = (campo) => (e) => onMudar({ ...valor, [campo]: e.target.value });

  async function consultarCEP(cep) {
    if (somenteDigitos(cep).length !== 8) return;
    setStatus('Buscando CEP...');
    try {
      const dados = await buscarCEP(cep);
      onMudar({ ...valor, ...dados, numero: valor.numero, complemento: valor.complemento });
      setStatus('');
    } catch (e) {
      setStatus(`CEP: ${e.message}`);
    }
  }

  return (
    <>
      <Campo rotulo="CEP" span={2} erro={status && !status.endsWith('...') ? status : ''}>
        <input
          value={valor.cep}
          inputMode="numeric"
          placeholder={status.endsWith('...') ? status : '00000-000'}
          onChange={(e) => onMudar({ ...valor, cep: mascaraCEP(e.target.value) })}
          onBlur={(e) => consultarCEP(e.target.value)}
        />
      </Campo>
      <Campo rotulo="Logradouro" span={4}>
        <input value={valor.logradouro} onChange={set('logradouro')} />
      </Campo>
      <Campo rotulo="Número" span={1}>
        <input value={valor.numero} onChange={set('numero')} />
      </Campo>
      <Campo rotulo="Complemento" span={2}>
        <input value={valor.complemento} onChange={set('complemento')} />
      </Campo>
      <Campo rotulo="Bairro" span={3}>
        <input value={valor.bairro} onChange={set('bairro')} />
      </Campo>
      <Campo rotulo="Cidade" span={4}>
        <input value={valor.cidade} onChange={set('cidade')} />
      </Campo>
      <Campo rotulo="UF" span={2}>
        <select value={valor.uf} onChange={set('uf')}>
          <option value="">—</option>
          {UFS.map((uf) => (
            <option key={uf}>{uf}</option>
          ))}
        </select>
      </Campo>
    </>
  );
}
