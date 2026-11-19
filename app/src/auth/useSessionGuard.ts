import { useEffect } from "react";
import { useNavigate } from "react-router";
import { supabase } from "../lib/supabaseClient";
import { isCurrentSession } from "./session";

// Aparelho derrubado percebe sozinho: checa ao abrir, a cada intervalo e ao
// voltar o foco. A leitura já é negada no servidor; isto só leva pro login
// com o aviso.
export function useSessionGuard(active: boolean, intervalMs = 20000): void {
  const navigate = useNavigate();
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    async function check() {
      if (stopped) return;
      const current = await isCurrentSession();
      if (stopped || current) return;
      stopped = true;
      navigate("/login?motivo=outro-aparelho", { replace: true });
      await supabase.auth.signOut({ scope: "local" });
    }
    void check();
    const timer = setInterval(() => void check(), intervalMs);
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [active, intervalMs, navigate]);
}
