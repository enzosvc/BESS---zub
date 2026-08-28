'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

interface LinhaTrajetoria {
  ano: number;
  capacidade_disponivel_mwh: number;
  capacidade_liquida_poi_mwh: number;
  soh_fim_ano: number;
  evento_augmentation: boolean;
}

export default function CapacidadeChart({ trajetoria }: { trajetoria: LinhaTrajetoria[] }) {
  const dados = trajetoria.map((r) => ({
    ano: r.ano,
    'Capacidade de placa (MWh)': Math.round(r.capacidade_disponivel_mwh * 100) / 100,
    'Capacidade líquida no POI (MWh)': Math.round(r.capacidade_liquida_poi_mwh * 100) / 100,
    'SOH (%)': Math.round(r.soh_fim_ano * 10000) / 100,
    augmentation: r.evento_augmentation,
  }));

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">
        Capacidade ao longo dos 15 anos (marcadores = ano com augmentation)
      </h3>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={dados} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="ano" label={{ value: 'Ano', position: 'insideBottom', offset: -3 }} fontSize={12} />
          <YAxis fontSize={12} label={{ value: 'MWh', angle: -90, position: 'insideLeft' }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="Capacidade de placa (MWh)" stroke="#94a3b8" strokeDasharray="4 2" dot={{ r: 3 }} />
          <Line type="monotone" dataKey="Capacidade líquida no POI (MWh)" stroke="#f97316" strokeWidth={2} dot={(props: any) => {
            const { cx, cy, payload } = props;
            return payload.augmentation ? (
              <circle key={`aug-${payload.ano}`} cx={cx} cy={cy} r={5} fill="#16a34a" stroke="#16a34a" />
            ) : (
              <circle key={`pt-${payload.ano}`} cx={cx} cy={cy} r={2.5} fill="#f97316" />
            );
          }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
