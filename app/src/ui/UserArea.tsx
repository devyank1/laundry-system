import { useEffect, useRef, useState, type ReactNode } from "react";

// Topo do site: sino de notificações e área do cliente (foto, nome e menu).
// Ainda sem login: o perfil (nome + foto) fica salvo neste navegador e o
// "Entrar" aparece como em breve. Quando o login chegar, é só trocar a origem
// de `useProfile` pelos dados da conta.

const PROFILE_KEY = "lavanderia.perfil.v1";
const SEEN_KEY = "lavanderia.notificacoes.lidas.v1";

interface Profile {
  name: string;
  photo: string | null;
}

function loadProfile(): Profile {
  try {
    const p = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "null") as Partial<Profile> | null;
    if (p && typeof p.name === "string") return { name: p.name, photo: typeof p.photo === "string" ? p.photo : null };
  } catch {
    /* sem perfil salvo */
  }
  return { name: "", photo: null };
}

function useProfile() {
  const [profile, setProfile] = useState<Profile>(loadProfile);
  const save = (patch: Partial<Profile>) =>
    setProfile((cur) => {
      const next = { ...cur, ...patch };
      try {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
      } catch {
        /* armazenamento cheio/indisponível: vale só nesta sessão */
      }
      return next;
    });
  return [profile, save] as const;
}

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

/** Foto quadrada pequena (128 px) pra caber no armazenamento do navegador. */
function readPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const size = 128;
      const side = Math.min(img.width, img.height);
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      c.getContext("2d")?.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("imagem inválida"));
    };
    img.src = url;
  });
}

/** Menu suspenso: fecha ao clicar fora ou com Esc. */
function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

function Avatar({ profile, size = 32 }: { profile: Profile; size?: number }) {
  return profile.photo ? (
    <img className="avatar" src={profile.photo} alt="" width={size} height={size} />
  ) : (
    <span className="avatar avatar-initials" style={{ width: size, height: size }} aria-hidden="true">
      {initials(profile.name)}
    </span>
  );
}

const IconBell = () => (
  <svg className="icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9" />
    <path d="M10.3 20a1.9 1.9 0 0 0 3.4 0" />
  </svg>
);

const IconChevron = () => (
  <svg className="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export interface Notice {
  id: string;
  title: string;
  body?: string;
  tone?: "warn" | "info";
}

export function NotificationsButton({ notices }: { notices: Notice[] }) {
  const { open, setOpen, ref } = useDropdown();
  const [seen, setSeen] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  const unread = notices.filter((n) => !seen.includes(n.id)).length;
  const toggle = () => {
    setOpen(!open);
    if (!open && unread > 0) {
      const next = [...new Set([...seen, ...notices.map((n) => n.id)])];
      setSeen(next);
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify(next));
      } catch {
        /* segue sem guardar */
      }
    }
  };
  return (
    <div className="topbar-pop" ref={ref}>
      <button type="button" className="topbar-icon-btn" aria-label={unread ? `Notificações (${unread} novas)` : "Notificações"}
        aria-expanded={open} onClick={toggle}>
        <IconBell />
        {unread > 0 && <span className="topbar-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="topbar-menu topbar-notices" role="dialog" aria-label="Notificações">
          <div className="topbar-menu-head">Notificações</div>
          {notices.length === 0 ? (
            <p className="topbar-empty">Nada novo por aqui.</p>
          ) : (
            <ul>
              {notices.map((n) => (
                <li key={n.id} className={n.tone === "warn" ? "is-warn" : undefined}>
                  <i aria-hidden="true" />
                  <div>
                    <b>{n.title}</b>
                    {n.body && <span>{n.body}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({ children, onClick, soon }: { children: ReactNode; onClick?: () => void; soon?: boolean }) {
  return (
    <button type="button" role="menuitem" className="topbar-menu-item" disabled={soon} onClick={onClick}>
      {children}
      {soon && <em>em breve</em>}
    </button>
  );
}

export function UserMenu() {
  const { open, setOpen, ref } = useDropdown();
  const [profile, save] = useProfile();
  const file = useRef<HTMLInputElement>(null);
  const name = profile.name.trim() || "Visitante";
  return (
    <div className="topbar-pop" ref={ref}>
      <button type="button" className="topbar-user" aria-haspopup="menu" aria-expanded={open}
        aria-label={`Área do cliente: ${name}`} onClick={() => setOpen(!open)}>
        <Avatar profile={profile} />
        <span className="topbar-user-text">
          <b>{name}</b>
          <small>Área do cliente</small>
        </span>
        <IconChevron />
      </button>
      {open && (
        <div className="topbar-menu topbar-user-menu" role="menu" aria-label="Área do cliente">
          <div className="topbar-user-card">
            <button type="button" className="topbar-photo" title="Trocar foto" aria-label="Trocar foto"
              onClick={() => file.current?.click()}>
              <Avatar profile={profile} size={48} />
              <span className="topbar-photo-hint">trocar</span>
            </button>
            <label className="topbar-name">
              <small>Seu nome</small>
              <input value={profile.name} placeholder="Como quer ser chamado" maxLength={40}
                onChange={(e) => save({ name: e.target.value })} />
            </label>
          </div>
          <input ref={file} type="file" accept="image/*" hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                save({ photo: await readPhoto(f) });
              } catch {
                /* arquivo que não é imagem: ignora */
              }
            }} />
          <MenuItem soon>Meus projetos</MenuItem>
          <MenuItem soon>Meus orçamentos</MenuItem>
          {profile.photo && <MenuItem onClick={() => save({ photo: null })}>Remover foto</MenuItem>}
          <div className="topbar-menu-sep" />
          <MenuItem soon>Entrar na conta</MenuItem>
        </div>
      )}
    </div>
  );
}

const THEME_KEY = "lavanderia.tema";
type Theme = "light" | "dark";
const currentTheme = (): Theme => (document.documentElement.dataset.theme === "light" ? "light" : "dark");

/** Sol/lua: troca entre claro e escuro e guarda a escolha (index.html aplica antes da 1ª pintura). */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme);
  const next: Theme = theme === "light" ? "dark" : "light";
  const toggle = () => {
    const root = document.documentElement;
    root.classList.add("theme-anim");
    root.dataset.theme = next;
    window.setTimeout(() => root.classList.remove("theme-anim"), 300);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* vale só nesta sessão */
    }
    setTheme(next);
  };
  return (
    <button type="button" className="topbar-icon-btn theme-toggle" onClick={toggle}
      aria-label={next === "light" ? "Usar tema claro" : "Usar tema escuro"}
      title={next === "light" ? "Tema claro" : "Tema escuro"}>
      {theme === "light" ? (
        // no claro mostra a lua (vai pro escuro)
        <svg className="icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a6.8 6.8 0 0 0 10.7 10.7z" />
        </svg>
      ) : (
        <svg className="icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
        </svg>
      )}
    </button>
  );
}
