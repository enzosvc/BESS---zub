'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';

export default function Home() {
  const { session, carregando } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (carregando) return;
    router.replace(session ? '/dashboard' : '/login');
  }, [carregando, session, router]);

  return (
    <div className="flex h-screen items-center justify-center text-muted">
      Carregando...
    </div>
  );
}
