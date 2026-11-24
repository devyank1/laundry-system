import { useEffect, useRef, useState, type ReactNode } from "react";
import { photoUrl } from "../profile/photos";

// Topo do site: sino de notificações, tema e o menu da conta (clique no nome):
// Meus projetos, Meus orçamentos e Sair. Nome, cargo e foto vêm do cadastro;
// trocar foto/cargo é em "Meus dados".

const SEEN_KEY = "lavanderia.notificacoes.lidas.v1";

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

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

function Avatar({ name, photo, size = 32 }: { name: string; photo: string | null; size?: number }) {
  return photo ? (
    <img className="avatar" src={photo} alt="" width={size} height={size} />
  ) : (
    <span className="avatar avatar-initials" style={{ width: size, height: size }} aria-hidden="true">
      {initials(name)}
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

/** Foto do cadastro (URL assinada); sem foto ou com erro fica nas iniciais. */
function usePhoto(photoPath: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    setUrl(null);
    if (!photoPath) return;
    let cancelled = false;
    photoUrl(photoPath)
      .then((u) => !cancelled && setUrl(u))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [photoPath]);
  return url;
}

export interface UserMenuProps {
  name: string;
  subtitle: string;
  photoPath: string | null;
  /** Sem ele (admin) o item Meus projetos não aparece. */
  onProjects?: () => void;
  onSignOut: () => void;
}

export function UserMenu({ name, subtitle, photoPath, onProjects, onSignOut }: UserMenuProps) {
  const { open, setOpen, ref } = useDropdown();
  const photo = usePhoto(photoPath);
  const pick = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  return (
    <div className="topbar-pop" ref={ref}>
      <button type="button" className="topbar-user" aria-haspopup="menu" aria-expanded={open}
        aria-label={`Minha conta: ${name}`} onClick={() => setOpen(!open)}>
        <Avatar name={name} photo={photo} />
        <span className="topbar-user-text">
          <b>{name}</b>
          <small>{subtitle}</small>
        </span>
        <IconChevron />
      </button>
      {open && (
        <div className="topbar-menu topbar-user-menu" role="menu" aria-label="Minha conta">
          <div className="topbar-user-card">
            <Avatar name={name} photo={photo} size={48} />
            <div className="topbar-card-text">
              <b>{name}</b>
              <small>{subtitle}</small>
            </div>
          </div>
          {onProjects && <MenuItem onClick={pick(onProjects)}>Meus projetos</MenuItem>}
          <MenuItem soon>Meus orçamentos</MenuItem>
          <div className="topbar-menu-sep" />
          <MenuItem onClick={pick(onSignOut)}>Sair</MenuItem>
        </div>
      )}
    </div>
  );
}

const THEME_KEY = "lavanderia.tema";
type Theme = "light" | "dark";
const currentTheme = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

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
