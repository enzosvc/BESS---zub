'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

interface PontoOrdem {
  data_hora: string;
  potencia_solicitada_mw: number;
  ciclo_id: number;
}

export default function PerfilOrdensChart({ series }: { series: PontoOrdem[] }) {
  // Recharts com 2880 pontos fica pesado — reduz pra 1 a cada 2 (resolução de 30min)
  // sem perder a forma do perfil, que é o que importa visualmente aqui.
  const dados = series
    .filter((_, i) => i % 2 === 0)
    .map((p) => ({
      hora: p.data_hora.slice(5, 16).replace('T', ' '),
      MW: Math.round(p.potencia_solicitada_mw * 100) / 100,
    }));

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">
        Perfil sintético de ordens (mês representativo)
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={dados} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="hora" tick={false} label={{ value: 'Tempo (30 dias)', position: 'insideBottom', offset: -3 }} />
          <YAxis fontSize={12} label={{ value: 'MW', angle: -90, position: 'insideLeft' }} />
          <Tooltip />
          <ReferenceLine y={0} stroke="#000" strokeWidth={1} />
          <Line type="stepAfter" dataKey="MW" stroke="#f97316" dot={false} strokeWidth={1.2} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
