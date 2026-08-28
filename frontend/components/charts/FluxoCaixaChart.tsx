'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';

export default function FluxoCaixaChart({ fluxoCaixaRs }: { fluxoCaixaRs: number[] }) {
  const dados = fluxoCaixaRs.map((v, ano) => ({
    ano,
    'R$ milhões': Math.round((v / 1_000_000) * 100) / 100,
  }));

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">
        Fluxo de caixa do projeto, no BID de equilíbrio (R$ milhões)
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={dados} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="ano" label={{ value: 'Ano', position: 'insideBottom', offset: -3 }} fontSize={12} />
          <YAxis fontSize={12} />
          <Tooltip />
          <ReferenceLine y={0} stroke="#000" />
          <Bar dataKey="R$ milhões">
            {dados.map((d, i) => (
              <Cell key={i} fill={d['R$ milhões'] < 0 ? '#dc2626' : i === 0 ? '#1e3a8a' : '#f97316'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
