'use client';

import { Suspense } from 'react';
import ComparacaoProjetos from '@/components/comparacao/ComparacaoProjetos';

export default function CompararUtilityPage() {
  return (
    <Suspense fallback={null}>
      <ComparacaoProjetos segmento="utility" />
    </Suspense>
  );
}
