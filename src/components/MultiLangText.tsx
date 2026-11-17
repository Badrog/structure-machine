import { Fragment, useSyncExternalStore, type ReactNode } from 'react';
import type { Question, QuestionOption } from '../types/quiz';

/**
 * Affichage bilingue (FR / EN) des questions.
 * - Les formules gardent le balisage  x_{10}  (indice)  et  a^{4}  (exposant), rendu en <sub>/<sup>.
 * - Le français est dans title / options[].text / explanation ; EN dans question.i18n.
 */

export type Lang = 'fr' | 'en';
export const LANGS: { id: Lang; label: string; name: string }[] = [
  { id: 'fr', label: 'FR', name: 'Français' },
  { id: 'en', label: 'EN', name: 'English' },
];

// ---------- préférence de langues (mémorisée dans le navigateur, valeur par défaut : les deux) ----------
const KEY = 'evalis.langs';
let current: Lang[] = ['fr', 'en'];
try {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const parsed = (JSON.parse(raw) as Lang[]).filter((l) => LANGS.some((x) => x.id === l));
    if (parsed.length) current = parsed;
  }
} catch { /* stockage indisponible : valeur par défaut */ }
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const snapshot = () => current;

export function toggleLang(l: Lang) {
  const has = current.includes(l);
  if (has && current.length === 1) return; // au moins une langue
  current = LANGS.map((x) => x.id).filter((id) => (id === l ? !has : current.includes(id)));
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* ignore */ }
  listeners.forEach((f) => f());
}
export const useLangs = (): Lang[] => useSyncExternalStore(subscribe, snapshot, snapshot);

// ---------- formules : x_{10} / a^{4} ----------
const SCRIPT = /([_^])\{([^{}]*)\}/g;
export function MathText({ text }: { text: string }) {
  if (!text) return null;
  const out: ReactNode[] = [];
  let last = 0; let k = 0; let m: RegExpExecArray | null;
  SCRIPT.lastIndex = 0;
  while ((m = SCRIPT.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(m[1] === '_' ? <sub key={k++}>{m[2]}</sub> : <sup key={k++}>{m[2]}</sup>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out.map((n, i) => <Fragment key={i}>{n}</Fragment>)}</>;
}

const langTag = (lang: Lang) => (
  <span className="inline-block min-w-[1.6rem] text-center align-middle mr-1.5 ml-1.5 px-1 rounded bg-slate-100 text-slate-500 text-[9px] font-bold tracking-wide not-italic">
    {LANGS.find((l) => l.id === lang)!.label}
  </span>
);

interface BlockProps { fr: string; en?: string; className?: string; trClassName?: string; langs?: Lang[] }

/** Un texte dans les langues choisies : FR en principal, EN dessous si différents du français. */
export function MultiText({ fr, en, className = '', trClassName = 'text-slate-600', langs }: BlockProps) {
  const sel = useLangs();
  const show = langs || sel;
  const blocks: { lang: Lang; node: ReactNode }[] = [];
  if (show.includes('fr')) blocks.push({ lang: 'fr', node: <MathText text={fr} /> });
  if (show.includes('en') && en && en !== fr) blocks.push({ lang: 'en', node: <MathText text={en} /> });
  // si la seule langue choisie n'a pas de version (ou est identique) : retomber sur le français
  if (blocks.length === 0) blocks.push({ lang: 'fr', node: <MathText text={fr} /> });
  return (
    <span className={`block ${className}`}>
      {blocks.map((b, i) => (
        <span
          key={b.lang}
          lang={b.lang}
          className={`block ${i > 0 ? `mt-1 ${trClassName}` : ''}`}
        >
          {blocks.length > 1 ? langTag(b.lang) : null}
          {b.node}
        </span>
      ))}
    </span>
  );
}

/** Énoncé d'une question. */
export function QTitle({ q, className = '', langs }: { q: Question; className?: string; langs?: Lang[] }) {
  return <MultiText fr={q.title} en={q.i18n?.en?.title} className={className} langs={langs} />;
}

/** Texte d'une option (index = position de l'option dans la question). */
export function OptText({ q, opt, index, className = '', langs }: { q: Question; opt: QuestionOption; index: number; className?: string; langs?: Lang[] }) {
  return <MultiText fr={opt.text} en={q.i18n?.en?.options?.[index]} className={className} langs={langs} trClassName="text-slate-500 text-[11px]" />;
}

/** Explication / corrigé. */
export function ExplText({ q, className = '' }: { q: Question; className?: string }) {
  return <MultiText fr={q.explanation} en={q.i18n?.en?.explanation} className={className} trClassName="text-slate-500" />;
}

/** Consignes : blocs FR / EN séparés par une ligne vide (sinon, affichage tel quel). */
export function Instructions({ text, className = '' }: { text: string; className?: string }) {
  const sel = useLangs();
  const blocks = text.split(/\n\s*\n/).map((b) => b.split('\n').filter((l) => l.trim())).filter((b) => b.length);
  if (blocks.length === 2) {
    const order: Lang[] = ['fr', 'en'];
    return (
      <div className={`space-y-2 ${className}`}>
        {blocks.map((b, i) => sel.includes(order[i]) && (
          <div key={i} lang={order[i]} className="space-y-0.5">
            {b.map((l, j) => <p key={j}>{l}</p>)}
          </div>
        ))}
      </div>
    );
  }
  const lines = text.split('\n').filter((l) => l.trim());
  return (
    <div className={`space-y-0.5 ${className}`}>
      {lines.map((l, i) => <p key={i}>{l}</p>)}
    </div>
  );
}

/** Choix des langues affichées (au moins une). */
export function LangBar({ className = '' }: { className?: string }) {
  const sel = useLangs();
  return (
    <div className={`inline-flex items-center gap-1 ${className}`} role="group" aria-label="Langues d'affichage / Languages">
      {LANGS.map((l) => {
        const on = sel.includes(l.id);
        return (
          <button
            key={l.id}
            type="button"
            onClick={() => toggleLang(l.id)}
            aria-pressed={on}
            title={l.name}
            className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-colors ${
              on ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-700'
            }`}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}
