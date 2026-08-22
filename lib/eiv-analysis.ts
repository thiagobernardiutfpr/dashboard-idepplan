export type EivCriterionStatus = "atendido" | "parcial" | "nao-identificado" | "validacao-tecnica";

export type EivCriterionResult = {
  id: string;
  group: string;
  title: string;
  requirement: string;
  legalBasis: string;
  importance: "critica" | "alta" | "media";
  status: EivCriterionStatus;
  evidence: string;
  recommendation: string;
};

export type EivAnalysisResult = {
  version: 1;
  analyzedAt: string;
  searchableCharacters: number;
  coverageScore: number;
  conclusion: string;
  counts: Record<EivCriterionStatus, number>;
  warnings: string[];
  criteria: EivCriterionResult[];
};

type EivCriterionDefinition = Omit<EivCriterionResult, "status" | "evidence" | "recommendation"> & {
  keywordGroups: string[][];
  requiresQuantification?: boolean;
  requiresTechnicalValidation?: boolean;
};

export const EIV_LEGAL_SOURCES = [
  {
    label: "Plano Diretor de Apucarana — LC nº 5/2020, texto consolidado",
    href: "https://sapl.apucarana.pr.leg.br/ta/2615/text",
    scope: "Arts. 66 a 103, com as alterações da LC nº 3/2024",
  },
  {
    label: "Estatuto da Cidade — Lei Federal nº 10.257/2001",
    href: "https://www.planalto.gov.br/ccivil_03/leis/leis_2001/l10257.htm",
    scope: "Arts. 36 a 38 e diretrizes do art. 2º",
  },
] as const;

const CRITERIA: EivCriterionDefinition[] = [
  {
    id: "caracterizacao",
    group: "Identificação e responsabilidade",
    title: "Caracterização do empreendimento",
    requirement: "Descrever objeto, atividade, porte, localização, implantação, operação e principais quantitativos.",
    legalBasis: "Plano Diretor, arts. 66, § 2º, e 74, I",
    importance: "critica",
    keywordGroups: [["caracterizacao do empreendimento", "descricao do empreendimento", "caracterizacao da atividade"], ["localizacao", "implantacao", "endereco"]],
    requiresQuantification: true,
  },
  {
    id: "empreendedor",
    group: "Identificação e responsabilidade",
    title: "Empreendedor e interessado",
    requirement: "Identificar o empreendedor ou responsável pelo empreendimento e seus dados essenciais.",
    legalBasis: "Plano Diretor, art. 74, II",
    importance: "alta",
    keywordGroups: [["empreendedor", "proprietario", "interessado"], ["cnpj", "cpf", "razao social"]],
  },
  {
    id: "equipe-tecnica",
    group: "Identificação e responsabilidade",
    title: "Equipe técnica habilitada",
    requirement: "Identificar profissionais, formação, atribuições e participação na elaboração do estudo.",
    legalBasis: "Plano Diretor, arts. 73, § 2º, II, 74, II, e 75",
    importance: "critica",
    keywordGroups: [["equipe tecnica", "responsavel tecnico", "profissional responsavel"], ["arquiteto", "engenheiro", "biologo", "geografo", "crea", "cau"]],
  },
  {
    id: "responsabilidade-tecnica",
    group: "Identificação e responsabilidade",
    title: "ART, RRT ou TRT",
    requirement: "Apresentar documento de responsabilidade técnica compatível com as atividades desenvolvidas.",
    legalBasis: "Plano Diretor, art. 74, III",
    importance: "critica",
    keywordGroups: [["art", "rrt", "trt", "anotacao de responsabilidade tecnica", "registro de responsabilidade tecnica"], ["numero", "registro", "recolhimento"]],
  },
  {
    id: "termo-referencia",
    group: "Identificação e responsabilidade",
    title: "Atendimento ao Termo de Referência",
    requirement: "Responder ao TR do IDEPPLAN item a item e justificar expressamente os itens não aplicáveis.",
    legalBasis: "Plano Diretor, arts. 71 a 74",
    importance: "critica",
    keywordGroups: [["termo de referencia", "tr do eiv", "diretrizes do idepplan"], ["nao se aplica", "n/a", "item"]],
  },
  {
    id: "imovel-zoneamento",
    group: "Caracterização territorial",
    title: "Imóvel, inscrição e zoneamento",
    requirement: "Informar matrícula ou inscrição, lote, quadra, coordenadas, endereço, zoneamento e parâmetros aplicáveis.",
    legalBasis: "Plano Diretor, arts. 66, § 1º, e 74; legislação municipal de uso do solo",
    importance: "critica",
    keywordGroups: [["inscricao imobiliaria", "matricula", "lote", "quadra"], ["zoneamento", "zona residencial", "zona comercial", "uso e ocupacao do solo"], ["coordenada", "latitude", "longitude", "utm"]],
  },
  {
    id: "tipologia-quantitativos",
    group: "Caracterização territorial",
    title: "Tipologia e quantitativos controlados",
    requirement: "Consolidar áreas, unidades, população, vagas, fases, capacidade e demais números usados no diagnóstico.",
    legalBasis: "Plano Diretor, arts. 73 e 74",
    importance: "alta",
    keywordGroups: [["area total", "area construida", "area computavel", "unidades", "capacidade"], ["populacao estimada", "habitantes", "usuarios", "funcionarios"]],
    requiresQuantification: true,
    requiresTechnicalValidation: true,
  },
  {
    id: "area-influencia",
    group: "Caracterização territorial",
    title: "Áreas de influência direta e indireta",
    requirement: "Delimitar e justificar AID e AII conforme os impactos sobre vizinhança, tráfego, infraestrutura e ambiente.",
    legalBasis: "Plano Diretor, arts. 73, § 2º, IV, e 74",
    importance: "critica",
    keywordGroups: [["area de influencia direta", "aid"], ["area de influencia indireta", "aii"], ["delimitacao", "perimetro", "raio"]],
    requiresQuantification: true,
    requiresTechnicalValidation: true,
  },
  {
    id: "diagnostico-morfologia",
    group: "Caracterização territorial",
    title: "Diagnóstico e morfologia urbana",
    requirement: "Comparar as condições existentes, a fase de implantação e o cenário com o empreendimento.",
    legalBasis: "Plano Diretor, art. 74, V",
    importance: "alta",
    keywordGroups: [["morfologia urbana", "diagnostico urbano", "ocupacao existente"], ["cenario", "sem o empreendimento", "com o empreendimento", "fase de implantacao"]],
    requiresTechnicalValidation: true,
  },
  {
    id: "mapas-fontes",
    group: "Caracterização territorial",
    title: "Mapas, fontes, métodos e limitações",
    requirement: "Apresentar mapas legíveis, escala, norte, legenda, fonte, data, método e limitações dos levantamentos.",
    legalBasis: "Plano Diretor, arts. 68, IV e V, 73 e 75",
    importance: "alta",
    keywordGroups: [["mapa", "planta", "croqui"], ["fonte", "metodologia", "metodo"], ["escala", "legenda", "norte", "data do levantamento", "limitacao"]],
  },
  {
    id: "adensamento",
    group: "Conteúdo mínimo legal",
    title: "Adensamento populacional",
    requirement: "Quantificar população adicional, perfis de uso e efeitos cumulativos na área de influência.",
    legalBasis: "Estatuto da Cidade, art. 37, I; Plano Diretor, art. 74, IV, a",
    importance: "critica",
    keywordGroups: [["adensamento populacional", "incremento populacional", "populacao projetada"], ["habitantes", "moradores", "usuarios"]],
    requiresQuantification: true,
    requiresTechnicalValidation: true,
  },
  {
    id: "equipamentos",
    group: "Conteúdo mínimo legal",
    title: "Equipamentos urbanos e comunitários",
    requirement: "Identificar equipamentos de referência e avaliar capacidade, demanda incremental, distância e suficiência.",
    legalBasis: "Estatuto da Cidade, art. 37, II; Plano Diretor, art. 74, IV, b",
    importance: "critica",
    keywordGroups: [["equipamentos urbanos", "equipamentos comunitarios"], ["educacao", "escola", "cmei", "saude", "ubs", "assistencia social", "cras", "lazer"], ["capacidade", "matriculas", "demanda", "atendimento"]],
    requiresQuantification: true,
    requiresTechnicalValidation: true,
  },
  {
    id: "uso-ocupacao",
    group: "Conteúdo mínimo legal",
    title: "Uso e ocupação do solo",
    requirement: "Demonstrar compatibilidade de uso, índices urbanísticos, parâmetros, entorno e eventuais conflitos.",
    legalBasis: "Estatuto da Cidade, art. 37, III; Plano Diretor, arts. 66, § 1º, e 74, IV, c",
    importance: "critica",
    keywordGroups: [["uso e ocupacao do solo", "compatibilidade de uso", "parametros urbanisticos"], ["coeficiente de aproveitamento", "taxa de ocupacao", "recuo", "altura", "permeabilidade"]],
    requiresQuantification: true,
    requiresTechnicalValidation: true,
  },
  {
    id: "valorizacao",
    group: "Conteúdo mínimo legal",
    title: "Valorização e desvalorização imobiliária",
    requirement: "Avaliar efeitos positivos e negativos no mercado e na permanência da população local, indicando método e fonte.",
    legalBasis: "Estatuto da Cidade, art. 37, IV; Plano Diretor, art. 74, IV, d",
    importance: "alta",
    keywordGroups: [["valorizacao imobiliaria", "desvalorizacao imobiliaria", "valor do solo"], ["metodologia", "pesquisa de mercado", "amostra", "fonte"]],
    requiresTechnicalValidation: true,
  },
  {
    id: "mobilidade-trafego",
    group: "Conteúdo mínimo legal",
    title: "Mobilidade, tráfego e transporte público",
    requirement: "Quantificar viagens, veículos, pedestres, acessos, níveis de serviço, transporte coletivo e cenários operacionais.",
    legalBasis: "Estatuto da Cidade, art. 37, V, redação da Lei nº 14.849/2024; Plano Diretor, art. 74, IV, e",
    importance: "critica",
    keywordGroups: [["mobilidade urbana", "geracao de trafego", "trafego gerado"], ["transporte publico", "transporte coletivo", "linha de onibus"], ["pedestres", "veiculos", "viagens", "acesso viario"]],
    requiresQuantification: true,
    requiresTechnicalValidation: true,
  },
  {
    id: "estacionamento-acessibilidade",
    group: "Conteúdo mínimo legal",
    title: "Estacionamento, circulação e acessibilidade",
    requirement: "Compatibilizar vagas, carga e descarga, bicicletas, pedestres, pessoas com deficiência e circulação interna/externa.",
    legalBasis: "Estatuto da Cidade, arts. 2º e 37, V; Plano Diretor, arts. 22 e 74",
    importance: "alta",
    keywordGroups: [["estacionamento", "vagas", "carga e descarga"], ["acessibilidade", "pessoa com deficiencia", "mobilidade reduzida", "calcada", "passeio"], ["circulacao", "pedestre", "ciclista"]],
    requiresQuantification: true,
    requiresTechnicalValidation: true,
  },
  {
    id: "ventilacao-iluminacao",
    group: "Conteúdo mínimo legal",
    title: "Ventilação, iluminação e insolação",
    requirement: "Avaliar sombreamento, insolação, ventilação e efeitos nas edificações e espaços próximos.",
    legalBasis: "Estatuto da Cidade, art. 37, VI; Plano Diretor, art. 74, IV, f",
    importance: "alta",
    keywordGroups: [["ventilacao", "iluminacao natural", "insolacao", "sombreamento"], ["estudo solar", "carta solar", "horas de sol", "ventos"]],
    requiresTechnicalValidation: true,
  },
  {
    id: "paisagem-patrimonio",
    group: "Conteúdo mínimo legal",
    title: "Paisagem urbana e patrimônio",
    requirement: "Analisar patrimônio natural, cultural e paisagístico, visuais relevantes e inserção volumétrica.",
    legalBasis: "Estatuto da Cidade, art. 37, VII; Plano Diretor, art. 74, IV, g",
    importance: "alta",
    keywordGroups: [["paisagem urbana", "patrimonio natural", "patrimonio cultural", "patrimonio historico"], ["impacto visual", "insercao urbana", "volumetria", "bem tombado"]],
    requiresTechnicalValidation: true,
  },
  {
    id: "infraestrutura-basica",
    group: "Infraestrutura e ambiente",
    title: "Água, esgoto, energia e iluminação pública",
    requirement: "Estimar demanda e comprovar capacidade/manifestação das redes e concessionárias competentes.",
    legalBasis: "Plano Diretor, arts. 19, 66 e 74",
    importance: "critica",
    keywordGroups: [["abastecimento de agua", "consumo de agua", "sanepar"], ["esgotamento sanitario", "rede de esgoto", "efluentes"], ["energia eletrica", "copel", "iluminacao publica"]],
    requiresQuantification: true,
    requiresTechnicalValidation: true,
  },
  {
    id: "drenagem-terreno",
    group: "Infraestrutura e ambiente",
    title: "Terreno, drenagem e riscos",
    requirement: "Caracterizar topografia, solo, drenagem, impermeabilização, cursos d'água, APP e riscos geotécnicos/hidrológicos.",
    legalBasis: "Estatuto da Cidade, art. 2º, VI e XII; Plano Diretor, arts. 18, 19 e 74",
    importance: "critica",
    keywordGroups: [["drenagem", "aguas pluviais", "impermeabilizacao"], ["topografia", "declividade", "solo", "geologia", "talude"], ["curso dagua", "app", "area de preservacao", "inundacao", "erosao"]],
    requiresQuantification: true,
    requiresTechnicalValidation: true,
  },
  {
    id: "meio-biologico",
    group: "Infraestrutura e ambiente",
    title: "Meio biológico e arborização",
    requirement: "Inventariar vegetação/fauna quando aplicável e avaliar supressão, proteção, compensação e arborização.",
    legalBasis: "Estatuto da Cidade, art. 2º, XII; Plano Diretor, art. 18",
    importance: "alta",
    keywordGroups: [["meio biologico", "vegetacao", "arborizacao", "flora"], ["fauna", "supressao vegetal", "compensacao ambiental", "especies"]],
    requiresTechnicalValidation: true,
  },
  {
    id: "poluicoes",
    group: "Infraestrutura e ambiente",
    title: "Poluições sonora, atmosférica, hídrica e luminosa",
    requirement: "Identificar fontes, receptores, padrões aplicáveis, medições/projeções e controles para cada impacto pertinente.",
    legalBasis: "Plano Diretor, art. 74, V, a e h",
    importance: "critica",
    keywordGroups: [["poluicao sonora", "ruido", "decibeis"], ["poluicao atmosferica", "emissoes atmosfericas", "qualidade do ar"], ["poluicao hidrica", "qualidade da agua", "efluente"], ["poluicao luminosa", "ofuscamento"]],
    requiresQuantification: true,
    requiresTechnicalValidation: true,
  },
  {
    id: "vibracao-riscos-saude",
    group: "Infraestrutura e ambiente",
    title: "Vibração, periculosidade, insalubridade e saúde",
    requirement: "Avaliar vibrações, riscos tecnológicos, acidentes, substâncias perigosas, salubridade e exposição da vizinhança.",
    legalBasis: "Plano Diretor, art. 74, V, b e c",
    importance: "alta",
    keywordGroups: [["vibracao", "trepidacao"], ["periculosidade", "insalubridade", "risco de acidente", "emergencia"], ["saude da populacao", "exposicao", "produto perigoso"]],
    requiresTechnicalValidation: true,
  },
  {
    id: "residuos",
    group: "Infraestrutura e ambiente",
    title: "Resíduos sólidos, líquidos e gasosos",
    requirement: "Quantificar geração, acondicionamento, coleta, transporte, tratamento, destinação e responsabilidades.",
    legalBasis: "Plano Diretor, arts. 19 e 74, V, d",
    importance: "alta",
    keywordGroups: [["residuos solidos", "pgrcc", "gerenciamento de residuos"], ["destinacao final", "coleta", "armazenamento", "tratamento"]],
    requiresQuantification: true,
    requiresTechnicalValidation: true,
  },
  {
    id: "socioeconomia",
    group: "Infraestrutura e ambiente",
    title: "Perfil e impacto socioeconômico",
    requirement: "Caracterizar população, emprego, renda, atividades locais, grupos vulneráveis, benefícios e ônus distributivos.",
    legalBasis: "Plano Diretor, arts. 73, § 1º, V, e 74, V, g",
    importance: "alta",
    keywordGroups: [["socioeconomico", "emprego e renda", "perfil da populacao"], ["vulnerabilidade", "beneficios", "onus", "economia local"]],
    requiresQuantification: true,
    requiresTechnicalValidation: true,
  },
  {
    id: "matriz-impactos",
    group: "Impactos e condicionantes",
    title: "Matriz de impactos positivos e negativos",
    requirement: "Relacionar impacto, fase, natureza, magnitude, duração, abrangência, reversibilidade, probabilidade e significância.",
    legalBasis: "Estatuto da Cidade, art. 37; Plano Diretor, arts. 66, § 2º, e 74",
    importance: "critica",
    keywordGroups: [["matriz de impactos", "matriz de impacto"], ["impacto positivo", "impacto negativo"], ["magnitude", "duracao", "abrangencia", "reversibilidade", "significancia"]],
    requiresTechnicalValidation: true,
  },
  {
    id: "mitigacao-compensacao",
    group: "Impactos e condicionantes",
    title: "Prevenção, recuperação, mitigação e compensação",
    requirement: "Vincular medidas específicas aos impactos, evitando propostas genéricas ou sem comprovação.",
    legalBasis: "Plano Diretor, arts. 68, XI, 74, VII, e 81 a 85",
    importance: "critica",
    keywordGroups: [["medida preventiva", "prevencao"], ["medida mitigadora", "mitigacao"], ["recuperacao", "medida compensatoria", "compensacao"]],
    requiresTechnicalValidation: true,
  },
  {
    id: "responsaveis-cronograma",
    group: "Impactos e condicionantes",
    title: "Responsáveis, custos e cronograma",
    requirement: "Indicar responsável, custo, prazo, fase e forma de comprovação para cada medida.",
    legalBasis: "Plano Diretor, art. 74, VIII",
    importance: "critica",
    keywordGroups: [["responsavel pela medida", "responsavel pela implantacao", "responsabilidade"], ["cronograma", "prazo", "periodicidade"], ["custo", "orcamento", "valor estimado"], ["comprovacao", "evidencia", "registro"]],
    requiresQuantification: true,
  },
  {
    id: "monitoramento",
    group: "Impactos e condicionantes",
    title: "Monitoramento, indicadores e emergência",
    requirement: "Definir indicadores, metas, periodicidade, responsáveis, registros e resposta a desvios/emergências.",
    legalBasis: "Plano Diretor, arts. 83, parágrafo único, e 86",
    importance: "alta",
    keywordGroups: [["plano de monitoramento", "programa de monitoramento", "monitoramento"], ["indicador", "meta", "periodicidade"], ["plano de emergencia", "contingencia", "acao corretiva"]],
    requiresTechnicalValidation: true,
  },
  {
    id: "conclusao",
    group: "Impactos e condicionantes",
    title: "Conclusão coerente e compreensível",
    requirement: "Confrontar vantagens e desvantagens com o diagnóstico, a matriz e as medidas, sem omitir limitações.",
    legalBasis: "Plano Diretor, art. 74, VI",
    importance: "critica",
    keywordGroups: [["conclusao", "consideracoes finais"], ["vantagens", "desvantagens", "impactos positivos", "impactos negativos"], ["limitacao", "condicionante", "recomendacao"]],
    requiresTechnicalValidation: true,
  },
  {
    id: "eia-publicidade",
    group: "Procedimentos legais",
    title: "EIA, publicidade e participação",
    requirement: "Reconhecer que o EIV não substitui o EIA/licenciamento ambiental e prever publicidade/participação quando exigidas.",
    legalBasis: "Estatuto da Cidade, arts. 37, parágrafo único, e 38; Plano Diretor, arts. 79, 101, 102, 132 e 134",
    importance: "alta",
    keywordGroups: [["nao substitui", "licenciamento ambiental", "estudo de impacto ambiental", "eia"], ["publicidade", "consulta publica", "audiencia publica", "participacao popular"]],
  },
  {
    id: "referencias-anexos",
    group: "Procedimentos legais",
    title: "Referências e anexos comprobatórios",
    requirement: "Listar fontes, datas, documentos, memoriais, projetos, laudos, fotos e demais anexos citados no texto.",
    legalBasis: "Plano Diretor, arts. 68, IV a VI, 73, 74 e 75",
    importance: "alta",
    keywordGroups: [["referencias bibliograficas", "fontes consultadas", "bibliografia"], ["anexo", "memorial", "projeto", "laudo", "relatorio", "fotografia"]],
  },
];

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
}

function evidenceFor(text: string, definition: EivCriterionDefinition) {
  const terms = definition.keywordGroups.flat().map(normalize);
  const paragraphs = text.replace(/\r/g, "").split(/\n{1,}|(?<=[.!?;])\s+/).map((item) => item.replace(/\s+/g, " ").trim()).filter((item) => item.length > 20);
  const found = paragraphs.filter((paragraph) => {
    const candidate = normalize(paragraph);
    return terms.some((term) => candidate.includes(term));
  }).slice(0, 2);
  return found.join(" […] ").slice(0, 620);
}

function recommendation(status: EivCriterionStatus, definition: EivCriterionDefinition) {
  if (status === "atendido") return "Conteúdo localizado. Confirmar coerência com projetos, anexos e dados oficiais.";
  if (status === "validacao-tecnica") return "Conteúdo localizado, mas sua suficiência, metodologia e consistência exigem conferência técnica.";
  if (status === "parcial") return `Complementar: ${definition.requirement}`;
  return `Não identificado automaticamente. Inserir ou justificar como não aplicável: ${definition.requirement}`;
}

function evaluate(text: string, definition: EivCriterionDefinition): EivCriterionResult {
  const normalized = normalize(text);
  const matches = definition.keywordGroups.map((group) => group.some((term) => normalized.includes(normalize(term))));
  const matched = matches.filter(Boolean).length;
  const evidence = matched ? evidenceFor(text, definition) : "";
  let status: EivCriterionStatus;
  if (!matched) status = "nao-identificado";
  else if (matched < definition.keywordGroups.length || (definition.requiresQuantification && !/\d/.test(evidence))) status = "parcial";
  else if (definition.requiresTechnicalValidation) status = "validacao-tecnica";
  else status = "atendido";
  return {
    id: definition.id,
    group: definition.group,
    title: definition.title,
    requirement: definition.requirement,
    legalBasis: definition.legalBasis,
    importance: definition.importance,
    status,
    evidence,
    recommendation: recommendation(status, definition),
  };
}

export function analyzeEivText(text: string): EivAnalysisResult {
  const cleaned = text.replace(/\u0000/g, " ").replace(/[ \t]+/g, " ").trim();
  const criteria = CRITERIA.map((definition) => evaluate(cleaned, definition));
  const counts = criteria.reduce<Record<EivCriterionStatus, number>>((current, item) => {
    current[item.status] += 1;
    return current;
  }, { atendido: 0, parcial: 0, "nao-identificado": 0, "validacao-tecnica": 0 });
  const weights: Record<EivCriterionStatus, number> = { atendido: 1, "validacao-tecnica": 0.75, parcial: 0.45, "nao-identificado": 0 };
  const coverageScore = Math.round(criteria.reduce((sum, item) => sum + weights[item.status], 0) / criteria.length * 100);
  const criticalMissing = criteria.filter((item) => item.importance === "critica" && item.status === "nao-identificado").length;
  const warnings: string[] = [];
  const normalized = normalize(cleaned);
  if (cleaned.length < 2_000) warnings.push("Pouco texto foi recuperado. Confira a qualidade do OCR e se todos os volumes/anexos foram selecionados.");
  if (!normalized.includes("mobilidade urbana")) warnings.push("A expressão “mobilidade urbana” não foi localizada; o art. 37, V, do Estatuto da Cidade recebeu essa redação em 2024.");
  if (!normalized.includes("termo de referencia")) warnings.push("O Termo de Referência do IDEPPLAN não foi citado de forma identificável.");
  if (!normalized.includes("nao substitui") && !normalized.includes("licenciamento ambiental")) warnings.push("Não foi localizada a ressalva de que o EIV não substitui EIA/licenciamento ambiental.");
  const conclusion = criticalMissing > 0
    ? "EIV NECESSITA DE ADEQUAÇÕES"
    : coverageScore < 75
      ? "EIV NECESSITA DE COMPLEMENTAÇÃO"
      : "CONTEÚDO LOCALIZADO — EXIGE VALIDAÇÃO TÉCNICA";
  return {
    version: 1,
    analyzedAt: new Date().toISOString(),
    searchableCharacters: cleaned.length,
    coverageScore,
    conclusion,
    counts,
    warnings,
    criteria,
  };
}

