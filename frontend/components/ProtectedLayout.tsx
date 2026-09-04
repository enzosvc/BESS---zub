'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/useAuth';
import { supabase } from '@/lib/supabase';
import { corTextoSegmento } from '@/lib/segmentTheme';

export default function ProtectedLayout({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  /** Usa um container mais largo (painel de resultados de simulação) em vez
   * do max-w-6xl padrão — só as páginas que realmente precisam da largura
   * extra passam essa prop; o resto do app (dashboard, formulários) continua
   * com o container padrão. */
  wide?: boolean;
}) {
  const { session, carregando, usuario } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const larguraContainer = wide ? 'max-w-[1800px]' : 'max-w-6xl';
  const emUtility = pathname?.startsWith('/utility');
  const emCei = pathname?.startsWith('/cei');

  useEffect(() => {
    if (!carregando && !session) router.replace('/login');
  }, [carregando, session, router]);

  if (carregando) {
    return <div className="flex h-screen items-center justify-center bg-bg font-mono text-sm text-muted">Carregando...</div>;
  }
  if (!session) return null; // aguardando o redirect do useEffect

  async function sair() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-line bg-panel">
        <div className={`mx-auto flex ${larguraContainer} items-center justify-between px-4 py-3`}>
          <div className="flex items-center gap-5">
            <Link href="/dashboard" className="flex items-center">
              <Image src="/logo-zub.png" alt="ZUB" width={92} height={50} priority />
            </Link>
            <div className="h-6 w-px bg-line" />
            <Link
              href="/utility"
              className="rounded-md px-3 py-1.5 text-sm font-medium font-mono transition-colors hover:!text-accent"
              style={{
                color: emUtility ? corTextoSegmento('utility') : '#9BA4C7',
                backgroundColor: emUtility ? '#0C447C' : 'transparent',
              }}
            >
              Utility
            </Link>
            <Link
              href="/cei"
              className="rounded-md px-3 py-1.5 text-sm font-medium font-mono transition-colors hover:!text-accent"
              style={{
                color: emCei ? corTextoSegmento('cei') : '#9BA4C7',
                backgroundColor: emCei ? '#72243E' : 'transparent',
              }}
            >
              C&amp;I
            </Link>
          </div>
          <div className="flex items-center gap-4 font-mono text-sm text-muted">
            <Link href="/admin" className="transition-colors hover:text-accent">
              Atalhos
            </Link>
            <span>{usuario?.email}</span>
            <button onClick={sair} className="text-accent hover:underline">
              Sair
            </button>
          </div>
        </div>
      </header>
      <main className={`mx-auto ${larguraContainer} px-4 py-8`}>{children}</main>
    </div>
  );
}
