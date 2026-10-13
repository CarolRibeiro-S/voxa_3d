// Nível das vagas do lançamento. Só o nível sai do servidor, nunca a quantidade.
// open: há vagas. last: últimas vagas. soldout: esgotou. hidden: não foi possível saber.
export type LaunchLevel = "open" | "last" | "soldout" | "hidden";
