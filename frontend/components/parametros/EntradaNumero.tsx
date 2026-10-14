'use client';

import { useEffect, useState } from 'react';
import { formatarNumeroBR, parseNumeroBR } from '@/lib/numero';

interface Props {
  /** Valor armazenado (frações 0-1 continuam frações aqui). */
  valor: number;
  onChange: (valor: number) => void;
  /** Exibe/edita x100 (0,98 armazenado aparece como 98) — o valor salvo continua fração. */
  percentual?: boolean;
  /** Limites no valor armazenado (mesma escala de `valor`). */
  min?: number;
  max?: number;
  unidade?: string;
  /** Só leitura: valor fixado pelo modelo. */
  fixo?: boolean;
  rotulo: string;
  className?: string;
}

/** Caixa de número em formato brasileiro, com a unidade dentro da caixa. Só
 * propaga valores válidos e dentro dos limites; fora disso a borda fica
 * vermelha e o último valor válido continua salvo. */
export default function EntradaNumero({
  valor, onChange, percentual = false, min, max, unidade, fixo = false, rotulo, className = '',
}: Props) {
  const fator = percentual ? 100 : 1;
  const [texto, setTexto] = useState(formatarNumeroBR(valor * fator));
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    if (!editando) setTexto(formatarNumeroBR(valor * fator));
  }, [valor, fator, editando]);

  const numero = parseNumeroBR(texto);
  const foraDosLimites =
    numero !== null && ((min !== undefined && numero / fator < min) || (max !== undefined && numero / fator > max));
  const invalido = !fixo && (numero === null || foraDosLimites);

  function handleChange(novoTexto: string) {
    setTexto(novoTexto);
    const n = parseNumeroBR(novoTexto);
    if (n === null) return;
    const armazenado = n / fator;
    if ((min !== undefined && armazenado < min) || (max !== undefined && armazenado > max)) return;
    onChange(armazenado);
  }

  const limites =
    min !== undefined || max !== undefined
      ? `Entre ${min !== undefined ? formatarNumeroBR(min * fator) : '−∞'} e ${max !== undefined ? formatarNumeroBR(max * fator) : '∞'}`
      : undefined;

  return (
    <div
      className={`flex h-7 items-center rounded border px-2 ${
        fixo
          ? 'border-dashed border-line bg-transparent'
          : invalido
            ? 'border-bad bg-panel-2'
            : 'border-line bg-panel-2 focus-within:border-accent'
      } ${className}`}
      title={fixo ? 'Fixo pelo modelo' : invalido ? limites ?? 'Número inválido' : undefined}
    >
      <input
        type="text"
        inputMode="decimal"
        aria-label={rotulo}
        value={texto}
        readOnly={fixo}
        onFocus={() => setEditando(true)}
        onBlur={() => setEditando(false)}
        onChange={(e) => handleChange(e.target.value)}
        className={`w-full min-w-0 bg-transparent text-right font-data text-xs focus:outline-none ${
          fixo ? 'text-muted' : 'text-ink'
        }`}
      />
      {unidade && <span className="ml-1.5 shrink-0 whitespace-nowrap text-[10.5px] text-muted-2">{unidade}</span>}
    </div>
  );
}
