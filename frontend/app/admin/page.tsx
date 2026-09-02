'use client';

import { useState, FormEvent } from 'react';
import ProtectedLayout from '@/components/ProtectedLayout';

// Guarda o HASH (SHA-256) da senha, não a senha em texto puro — quem abrir o
// código-fonte no navegador não vê "zubmaster" direto, só esse hash.
const SENHA_HASH = '852053380bc9875514c0372494f98b90021a6860cef0ff100e973a42fa002b0d';

const ATALHOS = [
  { nome: 'GitHub', url: 'https://github.com/enzosvc', cor: 'bg-slate-800', descricao: 'Repositório do código' },
  { nome: 'Render', url: 'https://dashboard.render.com/project/prj-daapdjbtqb8s73806ufg', cor: 'bg-emerald-700', descricao: 'Backend (API)' },
  { nome: 'Supabase', url: 'https://supabase.com/dashboard/project/vcgizgbfitdagtankpca', cor: 'bg-green-700', descricao: 'Banco de dados e autenticação' },
  { nome: 'Vercel', url: 'https://vercel.com/zub-enzo-cunha-1/bess-zub', cor: 'bg-black', descricao: 'Frontend' },
];

async function calcularHash(texto: string): Promise<string> {
  const bytes = new TextEncoder().encode(texto);
  const buffer = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export default function AdminPage() {
  const [senha, setSenha] = useState('');
  const [desbloqueado, setDesbloqueado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    const hash = await calcularHash(senha);
    if (hash === SENHA_HASH) {
      setDesbloqueado(true);
    } else {
      setErro('Senha incorreta.');
    }
  }

  return (
    <ProtectedLayout>
      <h1 className="mb-6 text-xl font-semibold text-ink">Atalhos do projeto</h1>

      {!desbloqueado ? (
        <form onSubmit={handleSubmit} className="max-w-xs space-y-3">
          <label className="block text-sm font-medium text-ink">Senha de acesso</label>
          <input
            type="password"
            autoFocus
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full rounded-md border border-line bg-panel-2 text-ink px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
          {erro && <p className="text-sm text-bad">{erro}</p>}
          <button
            type="submit"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:opacity-90"
          >
            Desbloquear
          </button>
        </form>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ATALHOS.map((atalho) => (
            <a
              key={atalho.nome}
              href={atalho.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-line bg-panel p-4 shadow-sm transition hover:shadow-md"
            >
              <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium text-on-accent ${atalho.cor}`}>
                {atalho.nome}
              </span>
              <p className="mt-2 text-sm text-muted">{atalho.descricao}</p>
              <p className="mt-1 truncate text-xs text-muted-2">{atalho.url}</p>
            </a>
          ))}
        </div>
      )}
    </ProtectedLayout>
  );
}
