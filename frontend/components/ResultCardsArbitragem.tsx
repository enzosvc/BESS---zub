'use client';

interface Props {
  vplRs: number;
  tirPctAa: number | null;
  waccPctAa: number;
  receitaLiquidaMediaRsAno: number;
  receitaLiquidaAno1Rs: number;
  modeloNegocio: string;
}

function formatarReais(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function Card({ titulo, valor, destaque, ruim }: { titulo: string; valor: string; destaque?: boolean; ruim?: boolean }) {
  const borda = ruim ? 'border-bad/50 bg-panel-2' : destaque ? 'border-accent bg-panel-2' : 'border-line bg-panel';
  const cor = ruim ? 'text-bad' : destaque ? 'text-accent' : 'text-ink';
  return (
    <div className={`rounded-lg border p-4 ${borda}`}>
      <p className="text-xs text-muted">{titulo}</p>
      <p className={`mt-1 text-lg font-semibold font-data ${cor}`}>{valor}</p>
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
  // TIR pode não convergir (fluxo de caixa nunca cruza zero — ex.: VPL muito
  // negativo) — o backend manda `null` nesse caso (JSON não aceita NaN/Infinity).
  const tirConverge = tirPctAa !== null && !Number.isNaN(tirPctAa);
  const tirAbaixoDoWacc = tirConverge && (tirPctAa as number) < waccPctAa;

  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-2">
        Modelo: {modeloNegocio === 'arbitragem_fv_bess' ? 'Arbitragem FV + BESS' : 'Arbitragem Standalone'}
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Card titulo="VPL do projeto" valor={formatarReais(vplRs)} ruim={vplRs < 0} destaque={vplRs >= 0} />
        <Card
          titulo="TIR do projeto"
          valor={tirConverge ? `${(tirPctAa as number).toFixed(2)}% a.a.` : 'não converge'}
          ruim={!tirConverge || tirAbaixoDoWacc}
        />
        <Card titulo="WACC" valor={`${waccPctAa.toFixed(2)}% a.a.`} />
        <Card titulo="Receita líquida média/ano" valor={formatarReais(receitaLiquidaMediaRsAno)} />
        <Card titulo="Receita líquida — ano 1" valor={formatarReais(receitaLiquidaAno1Rs)} />
      </div>
      {!tirConverge && (
        <p className="mt-2 text-xs text-bad">
          A TIR não converge — o fluxo de caixa nunca fica positivo o suficiente pra zerar o VPL em nenhuma
          taxa testada. Isso normalmente indica um VPL fortemente negativo (projeto não se paga nas premissas atuais).
        </p>
      )}
      {tirAbaixoDoWacc && (
        <p className="mt-2 text-xs text-warn">
          TIR abaixo do WACC — nas premissas atuais, a receita de arbitragem não cobre o custo de capital do projeto.
        </p>
      )}
    </div>
  );
}
