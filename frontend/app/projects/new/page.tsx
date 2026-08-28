'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedLayout from '@/components/ProtectedLayout';
import InputForm from '@/components/InputForm';
import { CONFIG_BESS_DEFAULT, CONFIG_FINANCEIRA_DEFAULT, ConfigBESS, ConfigFinanceira } from '@/lib/inputSchema';
import { criarProjeto } from '@/lib/api';

export default function NovoProjetoPage() {
  const [nome, setNome] = useState('Novo projeto BESS');
  const [bess, setBess] = useState<ConfigBESS>(CONFIG_BESS_DEFAULT);
  const [financeiro, setFinanceiro] = useState<ConfigFinanceira>(CONFIG_FINANCEIRA_DEFAULT);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();

  async function handleSalvar() {
    setSalvando(true);
    setErro(null);
    try {
      const projeto = await criarProjeto({ nome, seed: 2026, bess, financeiro });
      router.push(`/projects/${projeto.id}`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar projeto.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <ProtectedLayout>
      <div className="mb-6">
        <label className="mb-1 block text-xs font-medium text-slate-600">Nome do projeto</label>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      <InputForm bess={bess} financeiro={financeiro} onChangeBess={setBess} onChangeFinanceiro={setFinanceiro} />

      {erro && <p className="mt-4 text-sm text-red-600">{erro}</p>}

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSalvar}
          disabled={salvando}
          className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {salvando ? 'Salvando...' : 'Salvar e abrir projeto'}
        </button>
      </div>
    </ProtectedLayout>
  );
}
