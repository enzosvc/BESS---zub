'use client';

import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';

interface PontoDespacho {
  data_hora: string;
  potencia_solicitada_mw: number;
  preco_rs_mwh: number;
}

export default function DespachoPrecoChart({ series }: { series: PontoDespacho[] }) {
  const dados = series.map((p) => ({
    hora: p.data_hora.slice(5, 16).replace('T', ' '),
    MW: Math.round(p.potencia_solicitada_mw * 100) / 100,
    'PLD (R$/MWh)': Math.round(p.preco_rs_mwh * 100) / 100,
  }));

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">
        Despacho x preço — primeiros 30 dias do ano 1 (foresight perfeito: carrega nas horas mais
        baratas, descarrega nas mais caras do dia)
      </h3>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={dados} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="hora" tick={false} label={{ value: 'Tempo (30 dias)', position: 'insideBottom', offset: -3 }} />
          <YAxis yAxisId="mw" fontSize={12} label={{ value: 'MW', angle: -90, position: 'insideLeft' }} />
          <YAxis yAxisId="preco" orientation="right" fontSize={12} label={{ value: 'R$/MWh', angle: 90, position: 'insideRight' }} />
          <Tooltip />
          <Legend />
          <ReferenceLine yAxisId="mw" y={0} stroke="#000" strokeWidth={1} />
          <Bar yAxisId="mw" dataKey="MW" fill="#3b82f6" isAnimationActive={false} />
          <Line yAxisId="preco" type="monotone" dataKey="PLD (R$/MWh)" stroke="#f97316" dot={false} strokeWidth={1.3} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
