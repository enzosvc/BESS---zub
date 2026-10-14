'use client';

import GradeParametros, { LAYOUT_LRCAP } from '@/components/parametros/GradeParametros';
import { ConfigBESS, ConfigFinanceira, SECOES_FINANCEIRO } from '@/lib/inputSchema';

interface Props {
  bess: ConfigBESS;
  financeiro: ConfigFinanceira;
  onChangeBess: (novo: ConfigBESS) => void;
  onChangeFinanceiro: (novo: ConfigFinanceira) => void;
}

/** Parâmetros de entrada do modelo LRCAP. */
export default function InputForm({ bess, financeiro, onChangeBess, onChangeFinanceiro }: Props) {
  return (
    <GradeParametros
      layout={LAYOUT_LRCAP}
      bess={bess}
      financeiro={financeiro as unknown as Record<string, unknown>}
      secoesFinanceiras={SECOES_FINANCEIRO}
      onChangeBess={(alteracoes) => onChangeBess({ ...bess, ...alteracoes })}
      onChangeFinanceiro={(chave, valor) => onChangeFinanceiro({ ...financeiro, [chave]: valor })}
    />
  );
}
