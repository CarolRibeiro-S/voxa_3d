import "server-only";

// Envio de e-mail pelo Resend, só com fetch (sem pacote). Nunca registra o link nem o token: em
// caso de falha, registra apenas o status HTTP.

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export async function sendInviteEmail(input: {
  to: string;
  storeName: string;
  roleLabel: string;
  link: string;
}): Promise<{ ok: true } | { ok: false }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return { ok: false };

  const store = escapeHtml(input.storeName);
  const html = `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#F5F3FF;font-family:Arial,Helvetica,sans-serif;color:#12091F">
<div style="max-width:480px;margin:0 auto;padding:24px">
<div style="background:#ffffff;border-radius:12px;padding:24px">
<h1 style="font-size:20px;margin:0 0 12px">${store} convidou você para o Voxa3D</h1>
<p style="font-size:15px;line-height:1.5;margin:0 0 16px">Você foi convidado para entrar como <strong>${escapeHtml(input.roleLabel)}</strong>. Clique no botão para aceitar.</p>
<p style="margin:0 0 20px"><a href="${escapeHtml(input.link)}" style="display:inline-block;background:#6D3BFF;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:12px">Aceitar convite</a></p>
<p style="font-size:13px;line-height:1.5;color:#5B5366;margin:0">Este convite vale por 7 dias. Se você não conhece quem enviou, ignore este e-mail.</p>
</div></div></body></html>`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: `${input.storeName} convidou você para o Voxa3D`,
        html,
        text: `${input.storeName} convidou você para o Voxa3D como ${input.roleLabel}.\n\nAceitar convite: ${input.link}\n\nEste convite vale por 7 dias. Se você não conhece quem enviou, ignore este e-mail.`,
      }),
    });
    if (!response.ok) {
      console.error("Resend recusou o envio do convite. Status:", response.status);
      return { ok: false };
    }
    return { ok: true };
  } catch {
    console.error("Falha de rede ao enviar o convite.");
    return { ok: false };
  }
}
