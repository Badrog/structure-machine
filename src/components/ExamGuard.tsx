import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ShieldAlert } from 'lucide-react';
import { studentApi } from '../services/api';

type ViolationType = 'blur' | 'hidden' | 'screenshot' | 'print';

interface ExamGuardProps {
  auth: { submissionId: string; token: string };
  enabled: boolean;
  lockMinutes: number;
  initialLockSeconds?: number;
  children: React.ReactNode;
}

const REASONS: Record<ViolationType, string> = {
  blur: "Vous avez quitté la fenêtre de l'épreuve (autre application, autre onglet ou fenêtre).",
  hidden: "L'onglet de l'épreuve a été masqué ou réduit.",
  screenshot: "Une capture d'écran a été détectée.",
  print: "Une impression de la page a été détectée.",
};

const fmt = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

/**
 * Surveille l'étudiant pendant l'épreuve. Dès qu'il quitte la fenêtre, change d'application, tente une capture
 * d'écran ou imprime, le contenu est MASQUÉ immédiatement et l'épreuve est BLOQUÉE (5 min par défaut).
 * Le blocage est enregistré côté serveur (il survit à un rechargement de page) et signalé au professeur.
 * Le chronomètre de l'épreuve continue de tourner pendant le blocage.
 */
export const ExamGuard: React.FC<ExamGuardProps> = ({ auth, enabled, lockMinutes, initialLockSeconds = 0, children }) => {
  const [lockEndsAt, setLockEndsAt] = useState<number>(initialLockSeconds > 0 ? Date.now() + initialLockSeconds * 1000 : 0);
  const [reason, setReason] = useState<ViolationType>('blur');
  const [now, setNow] = useState(Date.now());
  const lockedRef = useRef(lockEndsAt > Date.now());
  const lastEventRef = useRef(0);

  const locked = lockEndsAt > now;
  lockedRef.current = locked;

  // Compte à rebours
  useEffect(() => {
    if (!lockEndsAt) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [lockEndsAt]);

  const trigger = useCallback((type: ViolationType) => {
    if (!enabled || lockedRef.current) return;
    const t = Date.now();
    if (t - lastEventRef.current < 1500) return; // un seul incident pour blur + visibilitychange simultanés
    lastEventRef.current = t;

    // 1) masquage IMMÉDIAT (sans attendre le serveur)
    setReason(type);
    setLockEndsAt(t + lockMinutes * 60_000);
    setNow(t);
    lockedRef.current = true;

    // 2) enregistrement serveur : la durée officielle vient du serveur
    studentApi
      .violation(auth, type)
      .then((r) => { if (r.lockSecondsRemaining > 0) setLockEndsAt(Date.now() + r.lockSecondsRemaining * 1000); })
      .catch(() => { /* le blocage local reste actif */ });
  }, [enabled, lockMinutes, auth.submissionId, auth.token]);

  useEffect(() => {
    if (!enabled) return;

    const onBlur = () => trigger('blur');
    const onVisibility = () => { if (document.hidden) trigger('hidden'); };
    const onBeforePrint = () => trigger('print');
    const onKey = (e: KeyboardEvent) => {
      // Windows : PrintScreen, Win+Shift+S (Outil Capture) — macOS : Cmd+Shift+3/4/5
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen') return trigger('screenshot');
      if (e.metaKey && e.shiftKey && ['KeyS', 'Digit3', 'Digit4', 'Digit5'].includes(e.code)) return trigger('screenshot');
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyP') { e.preventDefault(); return trigger('print'); }
    };
    const block = (e: Event) => e.preventDefault();

    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    document.addEventListener('copy', block);
    document.addEventListener('cut', block);
    document.addEventListener('contextmenu', block);
    return () => {
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKey, true);
      document.removeEventListener('copy', block);
      document.removeEventListener('cut', block);
      document.removeEventListener('contextmenu', block);
    };
  }, [enabled, trigger]);

  const remaining = Math.max(0, Math.ceil((lockEndsAt - now) / 1000));

  return (
    <div className={enabled ? 'select-none print:hidden' : undefined}>
      {/* Le contenu reste monté (réponses et chronomètre conservés) mais flouté et inaccessible pendant le blocage */}
      <div aria-hidden={locked} style={locked ? { filter: 'blur(24px)', pointerEvents: 'none', visibility: 'hidden' } : undefined}>
        {children}
      </div>

      {locked && (
        <div role="alertdialog" aria-live="assertive" className="fixed inset-0 z-[100] bg-slate-900 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-5 text-white">
            <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-300 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Épreuve bloquée</h2>
            <p className="text-sm text-slate-300">{REASONS[reason]}</p>
            <div className="font-mono text-5xl font-bold tabular-nums">{fmt(remaining)}</div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Les questions sont masquées. Le chronomètre de l'épreuve continue de s'écouler.
              Cet incident a été signalé à l'enseignant. Restez sur cette page : le blocage se lève automatiquement.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
