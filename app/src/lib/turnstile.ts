// Site key do Cloudflare Turnstile (pública). Vazia = sem captcha (dev/local).
export function turnstileSiteKey(): string {
  return (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() ?? "";
}
