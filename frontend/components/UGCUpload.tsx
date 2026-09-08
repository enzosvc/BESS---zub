'use client';

import { useState } from 'react';
import { criarUGCScenario } from '@/lib/api';

interface AnoParseado {
  ano: number;
  ano_calendario: number;
  geracao_mw: number[];
  parcial: boolean;
}

interface ResumoAno {
  ano: number;
  ano_calendario: number;
  n_horas: number;
  n_horas_esperado: number;
  parcial: boolean;
  geracao_media_mw: number;
  geracao_max_mw: number;
}

/**
 * Formato esperado do arquivo: `Data, Hora, Unidade, Geracao_MW` — mesma
 * mecânica de PriceScenarioUpload.tsx (mesmo parser de data/número/
 * delimitador, mesma regra de primeiro/último ano parcial), só o conteúdo
 * semântico muda (MW gerado por uma usina/planta, não R$/MWh).
 *
 * `Unidade` é texto livre (não um enum fixo como Submercado) — o arquivo
 * pode ter várias usinas juntas, e o campo do formulário funciona como
 * filtro por nome exato.
 */

const FAIXA_GERACAO_RAZOAVEL = { min: 0, max: 10_000 }; // MW — só pra pegar erro grosseiro de unidade/digitação

function detectarDelimitador(linhaCabecalho: string): string {
  if (linhaCabecalho.includes(';') && !linhaCabecalho.includes(',')) return ';';
  return ',';
}

function parseNumero(texto: string, contexto: string): number {
  const t = texto.trim();
  if (t === '') throw new Error(`${contexto}: valor vazio.`);

  const temVirgula = t.includes(',');
  const temPonto = t.includes('.');
  let normalizado = t;

  if (temVirgula && temPonto) {
    const ultimaVirgula = t.lastIndexOf(',');
    const ultimoPonto = t.lastIndexOf('.');
    normalizado = ultimaVirgula > ultimoPonto ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  } else if (temVirgula) {
    normalizado = t.replace(',', '.');
  }

  const valor = Number(normalizado);
  if (Number.isNaN(valor) || !Number.isFinite(valor)) {
    throw new Error(`${contexto}: "${texto}" não é um número válido.`);
  }
  return valor;
}

function parseData(texto: string, contexto: string): { ano: number; mes: number; dia: number } {
  const t = texto.trim().split(/[ T]/)[0];

  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return { ano: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) };

  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return { ano: Number(m[3]), mes: Number(m[2]), dia: Number(m[1]) };

  throw new Error(`${contexto}: data "${texto}" não reconhecida (use AAAA-MM-DD ou DD/MM/AAAA).`);
}

function ehBissexto(ano: number): boolean {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

interface LinhaParseada {
  chaveOrdenacao: number;
  ano_calendario: number;
  geracao: number;
}

interface AnoIgnorado {
  ano_calendario: number;
  n_horas: number;
  n_horas_esperado: number;
}

function parseArquivo(texto: string, unidadeAlvo: string): { anos: AnoParseado[]; ignorados: AnoIgnorado[] } {
  const linhas = texto.trim().split(/\r?\n/);
  if (linhas.length < 2) throw new Error('Arquivo vazio ou só com cabeçalho.');

  const delimitador = detectarDelimitador(linhas[0]);
  const cabecalho = linhas[0].split(delimitador).map((s) => s.trim().toLowerCase());
  const idxData = cabecalho.indexOf('data');
  const idxHora = cabecalho.indexOf('hora');
  const idxUnidade = cabecalho.indexOf('unidade');
  const idxGeracao = cabecalho.indexOf('geracao_mw');
  if (idxData === -1 || idxHora === -1 || idxUnidade === -1 || idxGeracao === -1) {
    throw new Error(
      `Cabeçalho precisa ter as colunas "Data", "Hora", "Unidade" e "Geracao_MW" ` +
      `(delimitador detectado: "${delimitador}"). Cabeçalho lido: ${linhas[0]}`
    );
  }

  const alvo = unidadeAlvo.trim().toUpperCase();
  const linhasParseadas: LinhaParseada[] = [];

  for (let i = 1; i < linhas.length; i++) {
    const linha = linhas[i].trim();
    if (!linha) continue;
    const partes = linha.split(delimitador);
    if (partes.length <= Math.max(idxData, idxHora, idxUnidade, idxGeracao)) {
      throw new Error(`Linha ${i + 1} tem menos colunas que o esperado: "${linha}"`);
    }

    const unidadeLinha = partes[idxUnidade].trim().toUpperCase();
    if (unidadeLinha !== alvo) continue;

    const { ano, mes, dia } = parseData(partes[idxData], `Linha ${i + 1}, coluna "Data"`);
    const hora = parseNumero(partes[idxHora], `Linha ${i + 1}, coluna "Hora"`);
    if (!Number.isInteger(hora) || hora < 0 || hora > 23) {
      throw new Error(`Linha ${i + 1}: "Hora" precisa ser um inteiro de 0 a 23 (recebido: ${partes[idxHora]}).`);
    }
    const geracao = parseNumero(partes[idxGeracao], `Linha ${i + 1}, coluna "Geracao_MW"`);
    if (geracao < FAIXA_GERACAO_RAZOAVEL.min || geracao > FAIXA_GERACAO_RAZOAVEL.max) {
      throw new Error(
        `Linha ${i + 1}: geração ${geracao} MW está fora da faixa razoável ` +
        `(${FAIXA_GERACAO_RAZOAVEL.min}–${FAIXA_GERACAO_RAZOAVEL.max}). Confira a unidade/formato do arquivo.`
      );
    }

    linhasParseadas.push({
      chaveOrdenacao: ano * 1_000_000 + mes * 10_000 + dia * 100 + hora,
      ano_calendario: ano,
      geracao,
    });
  }

  if (linhasParseadas.length === 0) {
    throw new Error(`Nenhuma linha encontrada para a unidade "${unidadeAlvo}". Confira o nome exato no arquivo.`);
  }

  linhasParseadas.sort((a, b) => a.chaveOrdenacao - b.chaveOrdenacao);

  for (let i = 1; i < linhasParseadas.length; i++) {
    if (linhasParseadas[i].chaveOrdenacao === linhasParseadas[i - 1].chaveOrdenacao) {
      throw new Error(
        `Data/Hora duplicada encontrada para ${unidadeAlvo}: mais de uma linha com a mesma ` +
        `combinação de Data e Hora. Confira o arquivo de origem.`
      );
    }
  }

  const porAnoCalendario = new Map<number, number[]>();
  for (const l of linhasParseadas) {
    if (!porAnoCalendario.has(l.ano_calendario)) porAnoCalendario.set(l.ano_calendario, []);
    porAnoCalendario.get(l.ano_calendario)!.push(l.geracao);
  }

  const anosCalendarioOrdenados = Array.from(porAnoCalendario.keys()).sort((a, b) => a - b);

  const ignorados: AnoIgnorado[] = [];
  const completos: { ano_calendario: number; geracao: number[]; parcial: boolean }[] = [];
  anosCalendarioOrdenados.forEach((anoCalendario, indice) => {
    const geracao = porAnoCalendario.get(anoCalendario)!;
    const esperado = ehBissexto(anoCalendario) ? 8784 : 8760;
    const ehExtremidade = indice === 0 || indice === anosCalendarioOrdenados.length - 1;

    if (geracao.length === esperado) {
      completos.push({ ano_calendario: anoCalendario, geracao, parcial: false });
    } else if (ehExtremidade && geracao.length > 0 && geracao.length % 24 === 0) {
      completos.push({ ano_calendario: anoCalendario, geracao, parcial: true });
    } else {
      ignorados.push({ ano_calendario: anoCalendario, n_horas: geracao.length, n_horas_esperado: esperado });
    }
  });

  if (completos.length === 0) {
    throw new Error(
      `Nenhum ano utilizável encontrado para ${unidadeAlvo} — todos os anos do arquivo estão com ` +
      `horas faltando no meio da série.`
    );
  }

  const anos = completos.map((c, indice) => ({
    ano: indice + 1,
    ano_calendario: c.ano_calendario,
    geracao_mw: c.geracao,
    parcial: c.parcial,
  }));

  return { anos, ignorados };
}

function resumir(anos: AnoParseado[]): ResumoAno[] {
  return anos.map((a) => ({
    ano: a.ano,
    ano_calendario: a.ano_calendario,
    n_horas: a.geracao_mw.length,
    n_horas_esperado: ehBissexto(a.ano_calendario) ? 8784 : 8760,
    parcial: a.parcial,
    geracao_media_mw: a.geracao_mw.reduce((s, v) => s + v, 0) / a.geracao_mw.length,
    geracao_max_mw: Math.max(...a.geracao_mw),
  }));
}

export default function UGCUpload({ onCriado }: { onCriado: (scenario: any) => void }) {
  const [nome, setNome] = useState('');
  const [unidade, setUnidade] = useState('');
  const [fonte, setFonte] = useState('');
  const [anosParseados, setAnosParseados] = useState<AnoParseado[] | null>(null);
  const [ignorados, setIgnorados] = useState<AnoIgnorado[]>([]);
  const [resumo, setResumo] = useState<ResumoAno[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [arquivoTexto, setArquivoTexto] = useState<string | null>(null);

  function processarArquivo(texto: string, unidadeAlvo: string) {
    setErro(null);
    setAnosParseados(null);
    setIgnorados([]);
    setResumo(null);
    if (!unidadeAlvo.trim()) {
      setErro('Preencha o nome da unidade (igual ao que aparece no arquivo) antes de escolher o arquivo.');
      return;
    }
    try {
      const { anos, ignorados: anosIgnorados } = parseArquivo(texto, unidadeAlvo);
      setAnosParseados(anos);
      setIgnorados(anosIgnorados);
      setResumo(resumir(anos));
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao ler o arquivo.');
    }
  }

  function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    const reader = new FileReader();
    reader.onload = () => {
      const texto = reader.result as string;
      setArquivoTexto(texto);
      processarArquivo(texto, unidade);
    };
    reader.readAsText(arquivo);
  }

  function handleTrocarUnidade(novaUnidade: string) {
    setUnidade(novaUnidade);
    if (arquivoTexto) processarArquivo(arquivoTexto, novaUnidade); // reprocessa com o novo filtro
  }

  async function handleSalvar() {
    if (!anosParseados || !nome.trim()) return;
    setEnviando(true);
    setErro(null);
    try {
      const salvo = await criarUGCScenario({
        name: nome,
        unidade,
        fonte: fonte || undefined,
        anos: anosParseados.map((a) => ({ ano: a.ano, geracao_mw: a.geracao_mw })),
      });
      onCriado(salvo);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar UGC.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-line bg-panel p-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Nome do UGC</label>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="ex.: Geração Usina Solar Aracati 2023-2025"
          className="w-full rounded-md border border-line bg-panel-2 text-ink px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">
            Unidade <span className="text-muted-2">(filtra as linhas do arquivo — nome exato)</span>
          </label>
          <input
            value={unidade}
            onChange={(e) => handleTrocarUnidade(e.target.value)}
            placeholder="ex.: USINA_ARACATI"
            className="w-full rounded-md border border-line bg-panel-2 text-ink px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Fonte (opcional)</label>
          <input
            value={fonte}
            onChange={(e) => setFonte(e.target.value)}
            placeholder="ex.: medição SCADA / dado de projeto"
            className="w-full rounded-md border border-line bg-panel-2 text-ink px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted">
          Arquivo CSV — colunas{' '}
          <code className="rounded bg-panel-2 px-1">Data,Hora,Unidade,Geracao_MW</code>
        </label>
        <input type="file" accept=".csv" onChange={handleArquivo} className="text-sm" />
        <p className="mt-1 text-xs text-muted-2">
          Pode conter várias usinas/plantas juntas — só as linhas da unidade preenchida acima entram no
          UGC. O ano simulado (1, 2, 3...) é derivado automaticamente da coluna Data. O primeiro e o
          último ano do arquivo podem ser parciais. Aceita separador <code>,</code> ou <code>;</code>,
          Data em <code>AAAA-MM-DD</code> ou <code>DD/MM/AAAA</code>, e decimal com <code>.</code> ou{' '}
          <code>,</code>.
        </p>
      </div>

      {erro && <p className="text-sm text-bad">{erro}</p>}

      {ignorados.length > 0 && (
        <div className="rounded-lg border border-warn/40 bg-panel-2 p-3 text-xs text-warn">
          {ignorados.length} ano(s) ignorado(s) por estarem incompletos NO MEIO da série:{' '}
          {ignorados.map((a) => `${a.ano_calendario} (${a.n_horas}/${a.n_horas_esperado}h)`).join(', ')}.
        </div>
      )}

      {resumo && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="py-1 pr-4">Ano simulado</th>
                <th className="py-1 pr-4">Ano calendário</th>
                <th className="py-1 pr-4">Horas</th>
                <th className="py-1 pr-4">Geração média</th>
                <th className="py-1 pr-4">Pico</th>
              </tr>
            </thead>
            <tbody>
              {resumo.map((r) => (
                <tr key={r.ano} className="border-b border-line">
                  <td className="py-1 pr-4">{r.ano}</td>
                  <td className="py-1 pr-4">{r.ano_calendario}</td>
                  <td className="py-1 pr-4">
                    {r.n_horas}/{r.n_horas_esperado}
                    {r.parcial && (
                      <span className="ml-1 rounded-full bg-warn/20 px-1.5 py-0.5 text-[10px] font-medium text-warn">
                        parcial
                      </span>
                    )}
                  </td>
                  <td className="py-1 pr-4">{r.geracao_media_mw.toFixed(2)} MW</td>
                  <td className="py-1 pr-4">{r.geracao_max_mw.toFixed(2)} MW</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSalvar}
          disabled={!anosParseados || !nome.trim() || enviando}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:opacity-90 disabled:opacity-50"
        >
          {enviando ? 'Salvando...' : 'Salvar UGC'}
        </button>
      </div>
    </div>
  );
}
