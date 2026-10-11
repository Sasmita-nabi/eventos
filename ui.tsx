"use client";
import { cloneElement, isValidElement, useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactElement, type ReactNode } from "react";
import { ArrowRight, Inbox, Loader2, X } from "lucide-react";
import type { Person, TaskStatus } from "@/lib/types";

export function Button({ children, className = "", variant = "primary", loading, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; loading?: boolean }) {
  return <button {...props} disabled={props.disabled || loading} className={`btn btn-${variant} ${className}`}>{loading && <Loader2 size={16} className="spin" />}{children}</button>;
}
export function IconButton({ children, label, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) { return <button {...props} title={label} aria-label={label} className={`icon-btn ${className}`}>{children}</button>; }
export function Badge({ children, tone = "neutral", dot = false, className = "" }: { children: ReactNode; tone?: string; dot?: boolean; className?: string }) { return <span className={`badge badge-${tone} ${className}`}>{dot && <span className="badge-dot" />}{children}</span>; }
export function StatusBadge({ status }: { status: TaskStatus | string }) { const tone: Record<string, string> = { "To do": "neutral", "In progress": "blue", Blocked: "red", Done: "green", Ready: "green", Reserved: "blue", "Needs attention": "amber", Available: "green", "On duty": "blue", Unavailable: "neutral", Planning: "green", Live: "green", Completed: "neutral" }; return <Badge tone={tone[status] || "neutral"} dot>{status}</Badge>; }
export function Priority({ value }: { value: string }) { return <span className={`priority priority-${value.toLowerCase()}`}><i /><span>{value}</span></span>; }
export function Avatar({ person, size = "md", title }: { person?: Person; size?: "xs" | "sm" | "md" | "lg"; title?: string }) {
  const initials = person?.name.split(" ").map(x => x[0]).slice(0, 2).join("") || "?";
  return <span title={title || person?.name || "Unassigned"} className={`avatar avatar-${size} avatar-${person?.color || "slate"}`}>{initials}</span>;
}
export function AvatarStack({ people, max = 4 }: { people: Person[]; max?: number }) { return <div className="avatar-stack">{people.slice(0, max).map(p => <Avatar key={p.id} person={p} size="sm" />)}{people.length > max && <span className="avatar avatar-sm avatar-more">+{people.length - max}</span>}</div>; }
export function NotionLogo({ size = 22 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 26 26" fill="none" aria-hidden="true"><path d="M5 2.5 22 1.8 24 5v18l-18 1.1L2 20V5z" fill="currentColor"/><path d="M6 6h16v15H6z" fill="white"/><path d="m8 8 3-.2 7 10V9l-1-.2V7.5h4V9l-1 .2V20h-2L11 10v9l1 .2v1.2H8v-1.2l1-.2V9.2L8 9z" fill="currentColor"/></svg>; }
export function Brand({ compact = false }: { compact?: boolean }) { return <div className="brand"><div className="brand-mark"><span /><span /><span /></div>{!compact && <span>Event<span className="brand-os">OS</span><span className="brand-period">.</span></span>}</div>; }
export function Modal({ title, eyebrow, children, footer, onClose, wide = false, className = "" }: { title: string; eyebrow?: string; children: ReactNode; footer?: ReactNode; onClose: () => void; wide?: boolean; className?: string }) {
  const id = useId(); const ref = useRef<HTMLDivElement>(null); const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    const oldFocus = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    const timer = setTimeout(() => ref.current?.querySelector<HTMLElement>("input,select,textarea,button")?.focus(), 50);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key !== "Tab") return;
      const nodes = Array.from(ref.current?.querySelectorAll<HTMLElement>("button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex='0']") || []).filter(x => x.offsetParent !== null);
      if (!nodes.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => { clearTimeout(timer); document.body.style.overflow = oldOverflow; document.removeEventListener("keydown", handleKey); oldFocus?.focus(); };
  }, []);
  return <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div ref={ref} role="dialog" aria-modal="true" aria-labelledby={id} className={`modal ${wide ? "modal-wide" : ""} ${className}`}><header className="modal-header"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2 id={id}>{title}</h2></div><IconButton label="Close dialog" onClick={onClose}><X size={20} /></IconButton></header><div className="modal-body">{children}</div>{footer && <footer className="modal-footer">{footer}</footer>}</div></div>;
}
export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  const id = useId();
  const control = isValidElement(children) ? cloneElement(children as ReactElement<{ id?: string; "aria-describedby"?: string }>, { id, ...(hint ? { "aria-describedby": `${id}-hint` } : {}) }) : children;
  return <div className={`field ${className}`}><label className="field-label" htmlFor={id}>{label}</label>{control}{hint && <span id={`${id}-hint`} className="field-hint">{hint}</span>}</div>;
}
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) { return <div className="empty-state"><div className="empty-icon"><Inbox size={26} /></div><h3>{title}</h3><p>{description}</p>{action}</div>; }
export function SectionHeader({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) { return <div className="section-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="section-description">{description}</p></div>{children && <div className="header-actions">{children}</div>}</div>; }
export function CardHeader({ title, caption, action }: { title: string; caption?: string; action?: ReactNode }) { return <div className="card-header"><div><h3>{title}</h3>{caption && <p>{caption}</p>}</div>{action}</div>; }
export function TextLink({ children, onClick }: { children: ReactNode; onClick: () => void }) { return <button className="text-link" onClick={onClick}>{children}<ArrowRight size={14} /></button>; }
export function formatTime(value: string) { if (!value || Number.isNaN(Date.parse(value))) return "—"; return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }).format(new Date(value)); }
export function formatDay(value: string, year = false) { if (!value || Number.isNaN(Date.parse(value))) return "No date"; return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}), timeZone: "Asia/Kolkata" }).format(new Date(value)); }
export function localDateTime(value: string) { if (!value || Number.isNaN(Date.parse(value))) return ""; const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)); return parts.replace(" ", "T"); }
export function fromLocal(value: string) { return value ? `${value}:00+05:30` : ""; }
export function timeAgo(value: string) { const minutes = Math.floor((Date.now() - Date.parse(value)) / 60000); if (minutes < 1) return "Just now"; if (minutes < 60) return `${minutes}m ago`; if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`; return `${Math.floor(minutes / 1440)}d ago`; }
export function downloadText(filename: string, content: string, type = "text/plain") { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export function csvCell(value: string) { let clean = value; if (/^[=+@\-]/.test(clean)) clean = `'${clean}`; return `"${clean.replaceAll('"', '""')}"`; }
