import type { Capability } from "@/lib/permissions";
import type { Feature } from "@/lib/plans";

// Tutoriais interativos de primeiro uso. Sem imports de servidor.
//
// Como criar um tutorial novo (veja também o CLAUDE.md):
// 1. Dê um id único e comece com version 1. Aumentar a version reexibe o tutorial para todo mundo.
// 2. Marque os elementos reais da tela com data-tour="nome" e use o seletor no passo.
// 3. Títulos com até 4 palavras e textos com até 140 caracteres, em linguagem direta
//    ("Clique aqui para..."), sem prometer resultado financeiro.
// 4. Em página, coloque <AutoTour id="..." />. Em painel ou formulário, coloque o <AutoTour> dentro
//    dele, para o tutorial começar quando o painel abrir (kind: "action").

export type TourSide = "top" | "bottom" | "left" | "right";

export interface TourStep {
  // Seletor do elemento destacado, sempre no formato [data-tour="nome"].
  target: string;
  title: string;
  text: string;
  side: TourSide;
}

export interface TourDef {
  id: string;
  version: number;
  // page: abre ao entrar na tela. action: abre quando uma ação nova aparece (painel, formulário).
  kind: "page" | "action";
  // Só aparece se o plano tiver o recurso.
  requires?: Feature;
  // A função da pessoa precisa ter esta capacidade (quem não abre a tela não recebe o tutorial).
  capability: Capability;
  steps: TourStep[];
}

const t = (name: string) => `[data-tour="${name}"]`;

export const TOURS: Record<string, TourDef> = {
  painel: {
    id: "painel",
    version: 1,
    kind: "page",
    capability: "view_dashboard",
    steps: [
      { target: t("painel-resumo"), title: "Resumo do negócio", text: "Aqui você vê o que pede atenção: atrasos, entregas, o que falta receber e orçamentos aguardando resposta.", side: "bottom" },
      { target: t("painel-atrasados"), title: "Pedidos atrasados", text: "Clique para ver só os pedidos com prazo vencido. O cartão fica vermelho quando há algum.", side: "bottom" },
      { target: t("painel-etapas"), title: "Pedidos por etapa", text: "Veja quantos pedidos estão em cada etapa. Clique em uma barra para abrir o quadro de pedidos.", side: "top" },
      { target: t("painel-hora"), title: "Valor da sua hora", text: "Descubra quanto cobrar pela sua hora de trabalho e use o valor nas suas configurações.", side: "top" },
    ],
  },
  maquinas: {
    id: "maquinas",
    version: 1,
    kind: "page",
    capability: "view_catalog",
    steps: [
      { target: t("maquinas-adicionar"), title: "Adicionar máquina", text: "Clique aqui para cadastrar uma impressora. Você pode escolher no catálogo ou digitar os dados.", side: "bottom" },
      { target: t("maquinas-lista"), title: "Suas máquinas", text: "Cada cartão mostra consumo, preço e o desgaste por hora, que entram no custo das peças.", side: "bottom" },
      { target: t("maquinas-acoes"), title: "Editar ou desativar", text: "Edite os dados, desative uma máquina que não usa mais ou envie para a Lixeira.", side: "top" },
    ],
  },
  "maquina-form": {
    id: "maquina-form",
    version: 1,
    kind: "action",
    capability: "manage_catalog",
    steps: [
      { target: t("maquina-potencia"), title: "Consumo de energia", text: "Informe a potência em watts. Ela define quanto cada hora de impressão custa de energia.", side: "bottom" },
      { target: t("maquina-preco"), title: "Preço da máquina", text: "O preço, dividido pela vida útil, vira o desgaste por hora no custo da peça.", side: "bottom" },
      { target: t("maquina-vida"), title: "Vida útil", text: "Estime quantas horas a máquina dura. Se não souber, deixe em branco e preencha depois.", side: "bottom" },
      { target: t("maquina-manutencao"), title: "Manutenção por hora", text: "Peças e manutenção entram no custo de cada hora de impressão. Use uma média.", side: "top" },
    ],
  },
  materiais: {
    id: "materiais",
    version: 1,
    kind: "page",
    capability: "view_catalog",
    steps: [
      { target: t("materiais-tipos"), title: "Filamentos e resinas", text: "Use as abas para trocar entre filamentos e resinas. Cada tipo tem a sua lista.", side: "bottom" },
      { target: t("materiais-novo"), title: "Novo material", text: "Clique aqui para cadastrar um material com o preço que você pagou.", side: "bottom" },
      { target: t("materiais-lista"), title: "Custo por unidade", text: "O custo por grama ou por ml é calculado com o preço e o tamanho da embalagem.", side: "top" },
    ],
  },
  modelos: {
    id: "modelos",
    version: 1,
    kind: "page",
    capability: "view_models",
    steps: [
      { target: t("modelos-novo"), title: "Novo modelo", text: "Clique aqui para cadastrar um desenho que você imprime, com nome e material.", side: "bottom" },
      { target: t("modelos-lista"), title: "Foto e observações", text: "Ao editar um modelo, anexe uma foto e escreva as observações de impressão.", side: "top" },
      { target: t("modelos-vinculo"), title: "Ligue ao pedido", text: "Ao criar um pedido, escolha o modelo em cada item. Quem imprime vê a foto e as notas.", side: "bottom" },
    ],
  },
  "material-form": {
    id: "material-form",
    version: 1,
    kind: "action",
    capability: "manage_catalog",
    steps: [
      { target: t("material-preco"), title: "Preço pago", text: "Informe quanto você pagou pela embalagem do material.", side: "bottom" },
      { target: t("material-tamanho"), title: "Tamanho da embalagem", text: "Digite o peso em gramas (filamento) ou o volume em ml (resina), como 1000.", side: "bottom" },
      { target: t("material-custo"), title: "Custo calculado", text: "Aqui aparece o custo por unidade. É ele que entra no preço das suas peças.", side: "top" },
    ],
  },
  configuracoes: {
    id: "configuracoes",
    version: 1,
    kind: "page",
    capability: "view_settings",
    steps: [
      { target: t("config-custos"), title: "Custos e margens", text: "Energia, hora de trabalho, embalagem, falhas, taxas e margem. As calculadoras usam estes valores.", side: "bottom" },
      { target: t("config-energia"), title: "Tarifa de energia", text: "Busque a sua distribuidora para preencher o valor do kWh. Você pode ajustar depois.", side: "bottom" },
      { target: t("config-hora"), title: "Valor da hora", text: "Quanto vale o seu tempo. Não sabe? Use o ajudante do Painel para calcular.", side: "bottom" },
      { target: t("config-dados"), title: "Dados do orçamento", text: "Nome, WhatsApp e Instagram aparecem no topo dos orçamentos em PDF.", side: "top" },
      { target: t("config-canais"), title: "Canais de venda", text: "Cadastre onde você vende. A calculadora mostra o preço sugerido em cada canal.", side: "top" },
    ],
  },
  "calculadora-fdm": {
    id: "calculadora-fdm",
    version: 1,
    kind: "page",
    capability: "use_calculators",
    requires: "calculator",
    steps: [
      { target: t("calc-maquina"), title: "Escolha a máquina", text: "Selecione a impressora que vai fazer a peça. O consumo e o desgaste dela entram no preço.", side: "bottom" },
      { target: t("calc-material"), title: "Material e peso", text: "Escolha o filamento e informe o peso da peça e dos suportes, como no fatiador.", side: "bottom" },
      { target: t("calc-mesa"), title: "Várias peças por mesa", text: "Imprime mais de uma peça junto? Ligue aqui e digite os valores da mesa inteira.", side: "bottom" },
      { target: t("calc-calcular"), title: "Calcular preço", text: "Veja o preço sugerido com o detalhamento e o preço em cada canal. Depois, salve no orçamento.", side: "top" },
    ],
  },
  "calculadora-resina": {
    id: "calculadora-resina",
    version: 1,
    kind: "page",
    capability: "use_calculators",
    requires: "calculator",
    steps: [
      { target: t("calc-maquina"), title: "Escolha a máquina", text: "Selecione a impressora que vai fazer a peça. O consumo e o desgaste dela entram no preço.", side: "bottom" },
      { target: t("calc-material"), title: "Resina e volume", text: "Escolha a resina e informe o volume da peça e dos suportes em ml, como no fatiador.", side: "bottom" },
      { target: t("calc-mesa"), title: "Várias peças por mesa", text: "Imprime mais de uma peça junto? Ligue aqui e digite os valores da mesa inteira.", side: "bottom" },
      { target: t("calc-calcular"), title: "Calcular preço", text: "Veja o preço sugerido com o detalhamento e o preço em cada canal. Depois, salve no orçamento.", side: "top" },
    ],
  },
  orcamentos: {
    id: "orcamentos",
    version: 1,
    kind: "page",
    capability: "view_quotes",
    requires: "quotes",
    steps: [
      { target: t("orcamentos-novo"), title: "Novo orçamento", text: "Crie um orçamento para um cliente. Você também pode salvar aqui o resultado das calculadoras.", side: "bottom" },
      { target: t("orcamentos-filtros"), title: "Busca e filtros", text: "Procure pelo nome do cliente ou filtre pelo status do orçamento.", side: "bottom" },
      { target: t("orcamentos-lista"), title: "Seus orçamentos", text: "Clique em um orçamento para ver os itens, mudar o status e baixar o PDF.", side: "top" },
    ],
  },
  "orcamento-detalhe": {
    id: "orcamento-detalhe",
    version: 1,
    kind: "page",
    capability: "view_quotes",
    requires: "quotes",
    steps: [
      { target: t("orc-cliente"), title: "Dados do cliente", text: "Preencha nome, contato, validade e observações. Eles aparecem no PDF.", side: "bottom" },
      { target: t("orc-itens"), title: "Itens do orçamento", text: "Adicione itens avulsos ou traga das calculadoras. Você pode ajustar o valor final de cada item.", side: "top" },
      { target: t("orc-status"), title: "Status", text: "Marque como enviado, aprovado ou recusado conforme a resposta do cliente.", side: "top" },
      { target: t("orc-pdf"), title: "Baixar PDF", text: "Gere o PDF para enviar ao cliente. Ele mostra só o preço final, sem os seus custos.", side: "top" },
      { target: t("orc-pedido"), title: "Gerar pedido", text: "Com o orçamento aprovado, gere o pedido para acompanhar a produção e a entrega.", side: "top" },
    ],
  },
  pedidos: {
    id: "pedidos",
    version: 1,
    kind: "page",
    capability: "view_orders",
    requires: "orders",
    steps: [
      { target: t("pedidos-colunas"), title: "Colunas do pedido", text: "Cada coluna é uma etapa, do pedido feito até a entrega. No celular, troque de etapa pelas abas.", side: "bottom" },
      { target: t("pedidos-cartao"), title: "Cartão do pedido", text: "Clique no cartão para ver os itens, editar os dados e consultar o histórico do pedido.", side: "right" },
      { target: t("pedidos-pagamento"), title: "Pagamento", text: "Toque no selo para marcar o pedido como pago assim que o cliente pagar.", side: "right" },
      { target: t("pedidos-navegacao"), title: "Voltar e Avançar", text: "Use as setas para mudar a etapa. Outras ações, como cancelar, ficam no menu de três pontos.", side: "top" },
      { target: t("pedidos-avisar"), title: "Avisar cliente", text: "Em pedidos prontos ou enviados, abra o WhatsApp com a mensagem pronta para o cliente.", side: "top" },
    ],
  },
  usuarios: {
    id: "usuarios",
    // Versão 2: o tutorial mudou de nome e aparece de novo.
    version: 2,
    kind: "page",
    capability: "view_users",
    steps: [
      { target: t("usuarios-contador"), title: "Usuários do plano", text: "Aqui você vê quantos usuários já usa e quantos o seu plano inclui, contando os convites pendentes.", side: "bottom" },
      { target: t("usuarios-convidar"), title: "Convidar usuário", text: "Clique aqui, digite o e-mail, escolha a função e gere o link do convite. Ele vale por 7 dias.", side: "bottom" },
      { target: t("usuarios-funcoes"), title: "Funções", text: "Gerente usa quase tudo, menos assinatura e usuários. Operador vê só os pedidos, sem valores.", side: "top" },
    ],
  },
  historico: {
    id: "historico",
    version: 1,
    kind: "page",
    capability: "view_history",
    steps: [
      { target: t("historico-abas"), title: "Atividades e Lixeira", text: "Atividades mostra o que mudou na sua conta. A Lixeira guarda o que foi excluído.", side: "bottom" },
      { target: t("historico-linha"), title: "Cada alteração", text: "Cada linha diz quem mudou o quê e quando, com os valores de antes e depois.", side: "bottom" },
      { target: t("historico-desfazer"), title: "Desfazer", text: "Se o item ainda não mudou depois, o Desfazer volta ao estado anterior.", side: "left" },
      { target: t("historico-restaurar"), title: "Restaurar", text: "Na Lixeira, o Restaurar traz de volta máquinas, orçamentos, pedidos e outros itens excluídos.", side: "left" },
    ],
  },
};

// Tutorial da tela atual (usado pelo botão Ajuda). Nunca para formulários.
export function tourForPath(pathname: string): string | null {
  if (/^\/orcamentos\/[^/]+$/.test(pathname)) return "orcamento-detalhe";
  const byPath: Record<string, string> = {
    "/painel": "painel",
    "/maquinas": "maquinas",
    "/materiais": "materiais",
    "/modelos": "modelos",
    "/configuracoes": "configuracoes",
    "/calculadora-fdm": "calculadora-fdm",
    "/calculadora-resina": "calculadora-resina",
    "/orcamentos": "orcamentos",
    "/pedidos": "pedidos",
    "/historico": "historico",
    "/usuarios": "usuarios",
  };
  return byPath[pathname] ?? null;
}

// Chaves guardadas no localStorage: só marcadores de estado, nunca dados do negócio.
export const tourKey = (userId: string, tourId: string, version: number) =>
  `voxa:tour:${userId}:${tourId}:v${version}`;
export const tourDisabledKey = (userId: string) => `voxa:tour:${userId}:disabled`;
export const tourPrefix = (userId: string) => `voxa:tour:${userId}:`;
