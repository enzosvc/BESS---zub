'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/useAuth';
import { supabase } from '@/lib/supabase';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { session, carregando, usuario } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!carregando && !session) router.replace('/login');
  }, [carregando, session, router]);

  if (carregando) {
    return <div className="flex h-screen items-center justify-center text-slate-500">Carregando...</div>;
  }
  if (!session) return null; // aguardando o redirect do useEffect

  async function sair() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-primary">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="flex items-center">
            <Image src="/logo-zub.png" alt="ZUB" width={92} height={50} priority />
          </Link>
          <div className="flex items-center gap-4 text-sm text-slate-300">
            <Link href="/admin" className="hover:text-accent">
              Atalhos
            </Link>
            <span>{usuario?.email}</span>
            <button onClick={sair} className="text-accent hover:underline">
              Sair
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
