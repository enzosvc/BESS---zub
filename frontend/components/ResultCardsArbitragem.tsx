'use client';

interface Props {
  vplRs: number;
  tirPctAa: number;
  waccPctAa: number;
  receitaLiquidaMediaRsAno: number;
  receitaLiquidaAno1Rs: number;
  modeloNegocio: string;
}

function formatarReais(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function Card({ titulo, valor, destaque, ruim }: { titulo: string; valor: string; destaque?: boolean; ruim?: boolean }) {
  const cor = ruim ? 'border-red-300 bg-red-50 text-red-700' : destaque ? 'border-primary bg-blue-50 text-primary' : 'border-slate-200 bg-white text-slate-900';
  return (
    <div className={`rounded-lg border p-4 ${ruim || destaque ? cor : 'border-slate-200 bg-white'}`}>
      <p className="text-xs text-slate-500">{titulo}</p>
      <p className={`mt-1 text-lg font-semibold ${ruim || destaque ? cor.split(' ').pop() : 'text-slate-900'}`}>{valor}</p>
    </div>
  );
}

export default function ResultCardsArbitragem({
  vplRs,
  tirPctAa,
  waccPctAa,
  receitaLiquidaMediaRsAno,
  receitaLiquidaAno1Rs,
  modeloNegocio,
}: Props) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
        Modelo: {modeloNegocio === 'arbitragem_fv_bess' ? 'Arbitragem FV + BESS' : 'Arbitragem Standalone'}
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Card titulo="VPL do projeto" valor={formatarReais(vplRs)} ruim={vplRs < 0} destaque={vplRs >= 0} />
        <Card titulo="TIR do projeto" valor={Number.isNaN(tirPctAa) ? 'não converge' : `${tirPctAa.toFixed(2)}% a.a.`} ruim={tirPctAa < waccPctAa} />
        <Card titulo="WACC" valor={`${waccPctAa.toFixed(2)}% a.a.`} />
        <Card titulo="Receita líquida média/ano" valor={formatarReais(receitaLiquidaMediaRsAno)} />
        <Card titulo="Receita líquida — ano 1" valor={formatarReais(receitaLiquidaAno1Rs)} />
      </div>
      {tirPctAa < waccPctAa && (
        <p className="mt-2 text-xs text-amber-700">
          TIR abaixo do WACC — nas premissas atuais, a receita de arbitragem não cobre o custo de capital do projeto.
        </p>
      )}
    </div>
  );
}
