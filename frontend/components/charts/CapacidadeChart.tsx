'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { CORES, TOOLTIP_STYLE, EIXO_PROPS } from '@/lib/chartTheme';

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
    <div className="rounded-lg border border-line bg-panel p-4">
      <h3 className="mb-3 text-sm font-semibold text-ink">
        Capacidade ao longo dos 15 anos (marcadores = ano com augmentation)
      </h3>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={dados} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CORES.grid} />
          <XAxis dataKey="ano" label={{ value: 'Ano', position: 'insideBottom', offset: -3, fill: CORES.eixo }} {...EIXO_PROPS} />
          <YAxis label={{ value: 'MWh', angle: -90, position: 'insideLeft', fill: CORES.eixo }} {...EIXO_PROPS} />
          <Tooltip {...TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ color: CORES.eixo, fontSize: 12 }} />
          <Line type="monotone" dataKey="Capacidade de placa (MWh)" stroke={CORES.muted} strokeDasharray="4 2" dot={{ r: 3, fill: CORES.muted }} />
          <Line type="monotone" dataKey="Capacidade líquida no POI (MWh)" stroke={CORES.accent} strokeWidth={2} dot={(props: any) => {
            const { cx, cy, payload } = props;
            return payload.augmentation ? (
              <circle key={`aug-${payload.ano}`} cx={cx} cy={cy} r={5} fill={CORES.amber} stroke={CORES.amber} />
            ) : (
              <circle key={`pt-${payload.ano}`} cx={cx} cy={cy} r={2.5} fill={CORES.accent} />
            );
          }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
