// Tipos de acesso compartilhados com o cliente. Sem imports de servidor.
export type AccessStatus = "trialing" | "active" | "readonly";

// Por que a conta está em modo leitura.
export type ReadOnlyReason =
  | "trial_ended"
  | "expired"
  | "canceled"
  | "past_due"
  | "pending_payment"
  | "verify";

// Aviso mostrado na faixa do topo. Datas em ISO.
export type AccessNotice =
  | { kind: "past_due"; graceUntil: string }
  | { kind: "pending_payment" }
  | { kind: "canceled"; until: string }
  | { kind: "readonly"; reason: ReadOnlyReason };
