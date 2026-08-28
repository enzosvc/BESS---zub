// Tipos e metadados dos ~40 campos de input, organizados em seções para o
// formulário. Todo campo aqui precisa ter um espelho em
// backend/app/schemas.py::ConfigBESSInput / ConfigFinanceiraInput — os nomes
// dos campos são idênticos de propósito (facilita o `JSON.stringify` direto).

export interface ConfigBESS {
  capacidade_nominal_mwh: number;
  c_rate: number;
  soc_inicial: number;
  soc_min: number;
  soc_max: number;
  delta_t_h: number;
  dias_simulados_por_ano: number;
  prazo_anos: number;
  mean_rte_por_ano: number[];
  soh_referencia_por_ano: number[];
  temperatura_nominal_c: number;
  temperatura_media_c: number;
  temperatura_desvio_padrao_c: number;
  perda_cabo_dc_ac_pct: number;
  eficiencia_pcs: number;
  eficiencia_transformador_media_pct: number;
  perda_cabo_trafo_media_alta_pct: number;
  perda_cabo_alta_tensao_pct: number;
  consumo_auxiliares_mw: number;
  disponibilidade_ano1_pct: number;
  disponibilidade_ano15_pct: number;
  fator_potencia_derating: number;
  disponibilidade_comprometida_mwh: number;
  margem_seguranca_augmentation: number;
  reducao_custo_modulo_aa: number;
  carga_janela1_inicio_h: number;
  carga_janela1_fim_h: number;
  carga_janela2_inicio_h: number;
  carga_janela2_fim_h: number;
  descarga_janela1_inicio_h: number;
  descarga_janela1_fim_h: number;
  descarga_janela2_inicio_h: number;
  descarga_janela2_fim_h: number;
  fracao_minima_ciclo_secundario: number;
  probabilidade_ciclo_secundario: number;
}

export interface ConfigFinanceira {
  capex_total_rs: number;
  opex_fixo_pct_capex: number;
  custo_variavel_rs_mwh: number;
  preco_energia_perdas_rs_mwh: number;
  custo_augmentation_rs_mwh: number;
  custo_nao_atendimento_rs_mwh: number;
  tarifa_tust_c_rs_kw_mes: number;
  tarifa_tust_g_rs_kw_mes: number;
  taxa_desconto_real: number;
  valor_residual_pct_capex: number;
}

export interface SimulacaoInput {
  nome?: string;
  seed: number;
  bess: ConfigBESS;
  financeiro: ConfigFinanceira;
}

export const CONFIG_BESS_DEFAULT: ConfigBESS = {
  capacidade_nominal_mwh: 240.681,
  c_rate: 0.25,
  soc_inicial: 0.5,
  soc_min: 0.0,
  soc_max: 1.0,
  delta_t_h: 0.25,
  dias_simulados_por_ano: 30,
  prazo_anos: 15,
  mean_rte_por_ano: [
    0.951, 0.9448, 0.9419, 0.9396, 0.9377, 0.9359, 0.9343, 0.9329,
    0.9322, 0.9315, 0.9309, 0.9303, 0.9297, 0.9291, 0.9286, 0.9281,
  ],
  soh_referencia_por_ano: [
    1.0, 1.0, 0.9792, 0.9586, 0.9402, 0.9232, 0.9074, 0.8925,
    0.8783, 0.8647, 0.8516, 0.839, 0.8268, 0.8149, 0.8034, 0.7921,
  ],
  temperatura_nominal_c: 25,
  temperatura_media_c: 25,
  temperatura_desvio_padrao_c: 6,
  perda_cabo_dc_ac_pct: 0.006,
  eficiencia_pcs: 0.985,
  eficiencia_transformador_media_pct: 0.992,
  perda_cabo_trafo_media_alta_pct: 0.0,
  perda_cabo_alta_tensao_pct: 0.025,
  consumo_auxiliares_mw: 0.49448,
  disponibilidade_ano1_pct: 0.98,
  disponibilidade_ano15_pct: 0.96,
  fator_potencia_derating: 0.5,
  disponibilidade_comprometida_mwh: 200.0,
  margem_seguranca_augmentation: 0.05,
  reducao_custo_modulo_aa: 0.0,
  carga_janela1_inicio_h: 23,
  carga_janela1_fim_h: 5,
  carga_janela2_inicio_h: 10,
  carga_janela2_fim_h: 16,
  descarga_janela1_inicio_h: 5,
  descarga_janela1_fim_h: 9,
  descarga_janela2_inicio_h: 16,
  descarga_janela2_fim_h: 22,
  fracao_minima_ciclo_secundario: 0.6,
  probabilidade_ciclo_secundario: 0.35,
};

export const CONFIG_FINANCEIRA_DEFAULT: ConfigFinanceira = {
  capex_total_rs: 251_200_000,
  opex_fixo_pct_capex: 0.02,
  custo_variavel_rs_mwh: 0.0,
  preco_energia_perdas_rs_mwh: 0.0,
  custo_augmentation_rs_mwh: 938_704,
  custo_nao_atendimento_rs_mwh: 400.0,
  tarifa_tust_c_rs_kw_mes: 0.0,
  tarifa_tust_g_rs_kw_mes: 10.0,
  taxa_desconto_real: 0.1,
  valor_residual_pct_capex: 0.0,
};

// ---------------------------------------------------------------------------
// Metadados para renderizar o formulário: rótulo, unidade, ajuda, passo do input
// ---------------------------------------------------------------------------

export interface CampoMeta {
  chave: keyof ConfigBESS | keyof ConfigFinanceira;
  rotulo: string;
  unidade?: string;
  ajuda?: string;
  step?: number;
  min?: number;
  max?: number;
}

export interface SecaoFormulario {
  titulo: string;
  campos: CampoMeta[];
}

export const SECOES_BESS: SecaoFormulario[] = [
  {
    titulo: 'Dimensionamento e C-rate',
    campos: [
      { chave: 'capacidade_nominal_mwh', rotulo: 'Capacidade nominal', unidade: 'MWh', step: 0.1 },
      { chave: 'c_rate', rotulo: 'C-rate', ajuda: '1/C-rate = duração nominal em horas', step: 0.01, min: 0.05, max: 4 },
    ],
  },
  {
    titulo: 'Janela operacional de SOC',
    campos: [
      { chave: 'soc_inicial', rotulo: 'SOC inicial', unidade: '%', step: 0.01, min: 0, max: 1 },
      { chave: 'soc_min', rotulo: 'SOC mínimo', unidade: '%', step: 0.01, min: 0, max: 1 },
      { chave: 'soc_max', rotulo: 'SOC máximo', unidade: '%', step: 0.01, min: 0, max: 1 },
    ],
  },
  {
    titulo: 'Resolução temporal e prazo',
    campos: [
      { chave: 'delta_t_h', rotulo: 'Passo de tempo', unidade: 'h', step: 0.05 },
      { chave: 'dias_simulados_por_ano', rotulo: 'Dias simulados (mês representativo)', unidade: 'dias', step: 1, min: 1, max: 365 },
      { chave: 'prazo_anos', rotulo: 'Prazo do contrato', unidade: 'anos', step: 1, min: 1, max: 30 },
    ],
  },
  {
    titulo: 'Temperatura',
    campos: [
      { chave: 'temperatura_nominal_c', rotulo: 'Temperatura nominal', unidade: '°C', step: 1 },
      { chave: 'temperatura_media_c', rotulo: 'Temperatura média (sorteio diário)', unidade: '°C', step: 1 },
      { chave: 'temperatura_desvio_padrao_c', rotulo: 'Desvio-padrão da temperatura', unidade: '°C', step: 0.5 },
    ],
  },
  {
    titulo: 'Cadeia de perdas (bateria até o POI)',
    campos: [
      { chave: 'perda_cabo_dc_ac_pct', rotulo: 'Perda cabo DC-AC', unidade: '%', step: 0.001, min: 0, max: 1 },
      { chave: 'eficiencia_pcs', rotulo: 'Eficiência do PCS', unidade: '%', step: 0.001, min: 0, max: 1 },
      { chave: 'eficiencia_transformador_media_pct', rotulo: 'Eficiência do transformador', unidade: '%', step: 0.001, min: 0, max: 1 },
      { chave: 'perda_cabo_trafo_media_alta_pct', rotulo: 'Perda cabo trafo média-alta', unidade: '%', step: 0.001, min: 0, max: 1 },
      { chave: 'perda_cabo_alta_tensao_pct', rotulo: 'Perda cabo alta tensão', unidade: '%', step: 0.001, min: 0, max: 1 },
      { chave: 'consumo_auxiliares_mw', rotulo: 'Consumo de auxiliares', unidade: 'MW', step: 0.001 },
    ],
  },
  {
    titulo: 'Disponibilidade',
    campos: [
      { chave: 'disponibilidade_ano1_pct', rotulo: 'Disponibilidade no ano 1', unidade: '%', step: 0.01, min: 0, max: 1 },
      { chave: 'disponibilidade_ano15_pct', rotulo: 'Disponibilidade no ano final', unidade: '%', step: 0.01, min: 0, max: 1 },
      { chave: 'fator_potencia_derating', rotulo: 'Fator de potência em derating', unidade: '%', step: 0.01, min: 0, max: 1 },
    ],
  },
  {
    titulo: 'Augmentation',
    campos: [
      { chave: 'disponibilidade_comprometida_mwh', rotulo: 'Capacidade líquida comprometida', unidade: 'MWh', step: 1 },
      { chave: 'margem_seguranca_augmentation', rotulo: 'Margem de segurança do augmentation', unidade: '%', step: 0.01, min: 0 },
      { chave: 'reducao_custo_modulo_aa', rotulo: 'Redução do custo do módulo a.a.', unidade: '%/ano', step: 0.01, min: 0, max: 1 },
    ],
  },
  {
    titulo: 'Janelas de carga e descarga',
    campos: [
      { chave: 'carga_janela1_inicio_h', rotulo: 'Carga — janela 1, início', unidade: 'h', step: 1, min: 0, max: 23 },
      { chave: 'carga_janela1_fim_h', rotulo: 'Carga — janela 1, fim', unidade: 'h', step: 1, min: 0, max: 23 },
      { chave: 'carga_janela2_inicio_h', rotulo: 'Carga — janela 2, início', unidade: 'h', step: 1, min: 0, max: 23 },
      { chave: 'carga_janela2_fim_h', rotulo: 'Carga — janela 2, fim', unidade: 'h', step: 1, min: 0, max: 23 },
      { chave: 'descarga_janela1_inicio_h', rotulo: 'Descarga — janela 1, início', unidade: 'h', step: 1, min: 0, max: 23 },
      { chave: 'descarga_janela1_fim_h', rotulo: 'Descarga — janela 1, fim', unidade: 'h', step: 1, min: 0, max: 23 },
      { chave: 'descarga_janela2_inicio_h', rotulo: 'Descarga — janela 2, início', unidade: 'h', step: 1, min: 0, max: 23 },
      { chave: 'descarga_janela2_fim_h', rotulo: 'Descarga — janela 2, fim', unidade: 'h', step: 1, min: 0, max: 23 },
      { chave: 'fracao_minima_ciclo_secundario', rotulo: 'Fração mínima do ciclo secundário', unidade: '%', step: 0.01, min: 0, max: 1 },
      { chave: 'probabilidade_ciclo_secundario', rotulo: 'Probabilidade do ciclo secundário', unidade: '% dos dias', step: 0.01, min: 0, max: 1 },
    ],
  },
];

export const SECOES_FINANCEIRO: SecaoFormulario[] = [
  {
    titulo: 'CAPEX e OPEX',
    campos: [
      { chave: 'capex_total_rs', rotulo: 'CAPEX total', unidade: 'R$', step: 1000 },
      { chave: 'opex_fixo_pct_capex', rotulo: 'OPEX fixo (% do CAPEX)', unidade: '%', step: 0.001, min: 0, max: 1 },
      { chave: 'custo_variavel_rs_mwh', rotulo: 'Custo variável', unidade: 'R$/MWh', step: 0.1 },
      { chave: 'preco_energia_perdas_rs_mwh', rotulo: 'Preço da energia de perdas', unidade: 'R$/MWh', step: 0.1 },
    ],
  },
  {
    titulo: 'Augmentation e penalidades',
    campos: [
      { chave: 'custo_augmentation_rs_mwh', rotulo: 'Custo de augmentation', unidade: 'R$/MWh', step: 1000 },
      { chave: 'custo_nao_atendimento_rs_mwh', rotulo: 'Penalidade de não atendimento', unidade: 'R$/MWh', step: 1 },
    ],
  },
  {
    titulo: 'TUST',
    campos: [
      { chave: 'tarifa_tust_c_rs_kw_mes', rotulo: 'Tarifa TUST-C', unidade: 'R$/kW.mês', step: 0.1 },
      { chave: 'tarifa_tust_g_rs_kw_mes', rotulo: 'Tarifa TUST-G', unidade: 'R$/kW.mês', step: 0.1 },
    ],
  },
  {
    titulo: 'Taxas',
    campos: [
      { chave: 'taxa_desconto_real', rotulo: 'WACC (taxa de desconto real)', unidade: '%', step: 0.001, min: -0.5, max: 1 },
      { chave: 'valor_residual_pct_capex', rotulo: 'Valor residual (% do CAPEX)', unidade: '%', step: 0.01, min: 0, max: 1 },
    ],
  },
];
