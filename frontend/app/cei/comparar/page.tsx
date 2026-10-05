'use client';

import { Suspense } from 'react';
import ComparacaoProjetos from '@/components/comparacao/ComparacaoProjetos';

export default function CompararCeiPage() {
  return (
    <Suspense fallback={null}>
      <ComparacaoProjetos segmento="cei" />
    </Suspense>
  );
}
