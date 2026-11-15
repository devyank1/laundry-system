// Template puro (sem Deno/npm) pra poder ser testado no vitest.

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// Email transacional com a cara do app. Nunca leva senha: só o link de uso
// único pra pessoa definir a dela.
export function brandedEmailHtml(params: { heading: string; intro: string; actionUrl: string; actionLabel: string }): string {
  const heading = escapeHtml(params.heading);
  const intro = escapeHtml(params.intro);
  const label = escapeHtml(params.actionLabel);
  const url = escapeHtml(params.actionUrl);
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:24px;background:#0b100d;font-family:Arial,Helvetica,sans-serif;color:#f2f5f1;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#121914;border-radius:16px;">
      <tr><td style="padding:32px 28px;">
        <p style="margin:0 0 4px;font-size:13px;letter-spacing:.08em;color:#1fcf77;font-weight:bold;">CONFIGURADOR DE LAVANDERIA</p>
        <h1 style="margin:0 0 16px;font-size:22px;">${heading}</h1>
        <p style="margin:0 0 24px;color:#93a08f;line-height:1.5;">${intro}</p>
        <a href="${url}" style="display:inline-block;padding:12px 20px;background:#1fcf77;color:#04130a;font-weight:bold;text-decoration:none;border-radius:8px;">${label}</a>
        <p style="margin:24px 0 0;color:#5c6960;font-size:13px;line-height:1.5;">O link vale por tempo limitado e só pode ser usado uma vez. Se você não esperava este email, pode ignorá-lo.</p>
      </td></tr>
    </table>
  </body>
</html>`;
}
