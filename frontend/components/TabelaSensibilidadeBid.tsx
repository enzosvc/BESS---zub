'use client';

interface LinhaSensibilidadeBid {
  bid_testado_rs_ano: number;
  bid_sobre_equilibrio: number;
  vpl_rs: number;
  tir_pct_aa: number;
}

function formatarReais(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export default function TabelaSensibilidadeBid({ dados }: { dados: LinhaSensibilidadeBid[] }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <h3 className="mb-3 text-sm font-semibold text-ink">
        Sensibilidade financeira — BID testado × VPL × TIR
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[500px] text-xs">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="py-2 pr-3">BID testado (R$/ano)</th>
              <th className="py-2 pr-3">BID / BID equilíbrio</th>
              <th className="py-2 pr-3">VPL (R$)</th>
              <th className="py-2 pr-3">TIR (% a.a.)</th>
            </tr>
          </thead>
          <tbody>
            {dados.map((r, i) => {
              const noEquilibrio = Math.abs(r.bid_sobre_equilibrio - 1) < 0.001;
              return (
                <tr
                  key={i}
                  className={`border-b border-line text-ink ${noEquilibrio ? 'bg-panel-2 font-medium' : ''}`}
                >
                  <td className="py-1.5 pr-3">{formatarReais(r.bid_testado_rs_ano)}</td>
                  <td className="py-1.5 pr-3">{(100 * r.bid_sobre_equilibrio).toFixed(1)}%</td>
                  <td className="py-1.5 pr-3">{formatarReais(r.vpl_rs)}</td>
                  <td className="py-1.5 pr-3">{r.tir_pct_aa.toFixed(2)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
