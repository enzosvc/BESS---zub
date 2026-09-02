'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [modo, setModo] = useState<'login' | 'cadastro'>('login');
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setMensagem(null);
    setCarregando(true);

    try {
      if (modo === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
        router.push('/dashboard');
      } else {
        const { error } = await supabase.auth.signUp({ email, password: senha });
        if (error) throw error;
        setMensagem('Conta criada! Verifique seu e-mail para confirmar o cadastro, depois faça login.');
        setModo('login');
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao autenticar.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-xl border border-line bg-panel p-8 shadow-lg shadow-black/30">
        <div className="mb-4 flex justify-center rounded-lg bg-bg py-4">
          <Image src="/logo-zub.png" alt="ZUB" width={120} height={65} priority />
        </div>
        <p className="mb-6 text-center text-sm text-muted">
          Ferramenta de modelagem técnico-financeira de sistemas de armazenamento em bateria.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-line bg-panel-2 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">Senha</label>
            <input
              type="password"
              required
              minLength={6}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full rounded-md border border-line bg-panel-2 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
            />
          </div>

          {erro && <p className="text-sm text-bad">{erro}</p>}
          {mensagem && <p className="text-sm text-good">{mensagem}</p>}

          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-dark disabled:opacity-50"
          >
            {carregando ? 'Aguarde...' : modo === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <button
          onClick={() => setModo(modo === 'login' ? 'cadastro' : 'login')}
          className="mt-4 w-full text-center text-sm text-accent hover:underline"
        >
          {modo === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Faça login'}
        </button>
      </div>
    </div>
  );
}
