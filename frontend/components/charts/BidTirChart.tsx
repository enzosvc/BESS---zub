'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';

interface LinhaSensibilidadeBid {
  bid_testado_rs_ano: number;
  bid_sobre_equilibrio: number;
  vpl_rs: number;
  tir_pct_aa: number;
}

export default function BidTirChart({
  dados,
  waccPctAa,
}: {
  dados: LinhaSensibilidadeBid[];
  waccPctAa: number;
}) {
  const dadosGrafico = dados.map((r) => ({
    'BID (R$ milhões/ano)': Math.round((r.bid_testado_rs_ano / 1_000_000) * 100) / 100,
    'TIR (% a.a.)': Math.round(r.tir_pct_aa * 100) / 100,
  }));

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">BID testado × TIR resultante</h3>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={dadosGrafico} margin={{ top: 5, right: 20, left: 0, bottom: 15 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="BID (R$ milhões/ano)"
            type="number"
            label={{ value: 'BID testado (R$ milhões/ano)', position: 'bottom', offset: 0 }}
            fontSize={12}
          />
          <YAxis fontSize={12} label={{ value: 'TIR (% a.a.)', angle: -90, position: 'insideLeft' }} />
          <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} />
          <Legend verticalAlign="top" />
          <ReferenceLine
            y={waccPctAa}
            stroke="#94a3b8"
            strokeDasharray="3 3"
            label={{ value: 'WACC', position: 'insideTopRight', fontSize: 11 }}
          />
          <Line type="monotone" dataKey="TIR (% a.a.)" stroke="#4f46e5" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
