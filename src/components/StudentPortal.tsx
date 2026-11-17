import React, { useState } from 'react';
import { toScale, gradeScale } from '../utils/grade';
import { QTitle, OptText, ExplText } from './MultiLangText';
import { Quiz, StudentSubmission } from '../types/quiz';
import { StudentQuizSimulator } from './StudentQuizSimulator';
import { ExamGuard } from './ExamGuard';
import { studentApi, StudentSession, SubmitResult } from '../services/api';
import {
  KeyRound,
  User,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Award,
  FileText,
  LogOut,
  Play,
  Eye
} from 'lucide-react';

interface StudentPortalProps {
  onSwitchToTeacher: () => void;
  canSwitchToTeacher?: boolean;
}

export const StudentPortal: React.FC<StudentPortalProps> = ({
  onSwitchToTeacher,
  canSwitchToTeacher = false
}) => {
  // Step 1: Initial Login Gate State
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Student credentials entered on initial screen (Strictly Name & PIN only)
  const [studentName, setStudentName] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Logged-in session states
  const [matchedQuiz, setMatchedQuiz] = useState<Quiz | null>(null);
  const [studentViewMode, setStudentViewMode] = useState<'exam' | 'dashboard' | 'review'>('exam');
  const [selectedSubmissionForReview, setSelectedSubmissionForReview] = useState<StudentSubmission | null>(null);

  // Session serveur (jeton secret, réponses sauvegardées) et copie remise
  const [session, setSession] = useState<StudentSession | null>(null);
  const [mySubmission, setMySubmission] = useState<StudentSubmission | null>(null);
  const [busy, setBusy] = useState(false);

  // Handle Login submission on the FIRST SCREEN
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const trimmedName = studentName.trim();
    if (!trimmedName) {
      setLoginError("Veuillez renseigner votre Nom et Prénom.");
      return;
    }
    if (!pinCode.trim()) {
      setLoginError("Veuillez saisir le Code PIN de l'interrogation.");
      return;
    }

    setBusy(true);
    try {
      const res = await studentApi.join(trimmedName, pinCode.trim());
      setSession(res);
      setMatchedQuiz(res.quiz);
      setIsAuthenticated(true);
      if (res.phase === 'completed') {
        setMySubmission(res.submission);
        setSelectedSubmissionForReview(res.submission);
        setStudentViewMode('dashboard');
      } else {
        setMySubmission(null);
        setStudentViewMode('exam');
      }
    } catch (err) {
      setLoginError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitted = (res: SubmitResult) => {
    setMatchedQuiz(res.quiz);
    setMySubmission(res.submission);
    setSelectedSubmissionForReview(res.submission);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setStudentName('');
    setPinCode('');
    setMatchedQuiz(null);
    setSession(null);
    setMySubmission(null);
    setStudentViewMode('exam');
    setSelectedSubmissionForReview(null);
  };

  // Filter student submissions
  const mySubmissions = mySubmission ? [mySubmission] : [];

  // =========================================================================
  // ÉCRAN 1 : SAISIE STRICTE DU NOM ET DU CODE PIN (ÉPURÉ ET SANS POLLUTION)
  // =========================================================================
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto py-12 px-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-xs">
              <KeyRound className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Accès à l'Interrogation
            </h1>
            <p className="text-xs text-slate-500">
              Veuillez saisir votre nom et le code PIN de l'épreuve pour débuter.
            </p>
          </div>

          {/* Form strictly containing Name & PIN */}
          <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
            {/* 1. Student Name */}
            <div>
              <label className="block font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                <User className="w-4 h-4 text-indigo-600" />
                Nom et Prénom *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Youssef Amrani"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-900 font-medium text-sm transition-all"
              />
            </div>

            {/* 2. Interrogation PIN Code */}
            <div>
              <label className="block font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-indigo-600" />
                Code PIN d'Interrogation *
              </label>
              <input
                type="text"
                required
                placeholder="Code PIN à 4 ou 6 caractères (ex: #ALGO-204)"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-900 font-mono font-bold text-base uppercase tracking-wider transition-all"
              />
            </div>

            {/* Error banner if PIN or Name invalid */}
            {loginError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={busy}
              className="w-full disabled:opacity-60 py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-2 mt-4"
            >
              <span>{busy ? 'Vérification…' : "Accéder à l'Interrogation"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Discreet link to switch back to teacher if needed */}
          {canSwitchToTeacher && (
            <div className="pt-2 text-center">
              <button
                onClick={onSwitchToTeacher}
                className="text-[11px] font-medium text-slate-400 hover:text-slate-700 transition-colors"
              >
                ← Retour au tableau de bord enseignant
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // ÉCRAN 2 : ÉTUDIANT AUTHENTIFIÉ AVEC NOM & PIN
  // =========================================================================
  const currentQuiz = matchedQuiz as Quiz;

  return (
    <div className="space-y-6 pb-16">
      {/* Top Student Header Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-sm font-mono shadow-xs shrink-0">
            {studentName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 leading-none">
              {studentName}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
              <span>Code PIN : <strong className="font-mono text-indigo-700">{currentQuiz.pinCode}</strong></span>
              <span aria-hidden="true">·</span>
              <span>{currentQuiz.subject}</span>
              <span aria-hidden="true">·</span>
              <span>{currentQuiz.level}</span>
            </div>
          </div>
        </div>

        {/* Navigation within Student Portal */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStudentViewMode('exam')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              studentViewMode === 'exam'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200'
            }`}
          >
            L'Épreuve en Direct
          </button>
          <button
            onClick={() => setStudentViewMode('dashboard')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              studentViewMode === 'dashboard'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200'
            }`}
          >
            Mes Copies Notées ({mySubmissions.length})
          </button>
          <button
            onClick={handleLogout}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-1"
            title="Changer d'étudiant ou de code PIN"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MODE 1: EXAM TAKING VIEW */}
      {studentViewMode === 'exam' && (
        mySubmission ? (
          <div className="max-w-xl mx-auto bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-600 space-y-3 shadow-xs">
            <p>Votre copie a déjà été transmise pour cette interrogation.</p>
            <button onClick={() => setStudentViewMode('dashboard')} className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg">
              Voir ma note
            </button>
          </div>
        ) : session?.token && session.submissionId ? (
          <ExamGuard
            auth={{ submissionId: session.submissionId, token: session.token }}
            enabled={currentQuiz.lockOnLeave !== false}
            lockMinutes={currentQuiz.lockMinutes || 5}
            initialLockSeconds={session.lockSecondsRemaining}
          >
          <StudentQuizSimulator
            quiz={currentQuiz}
            session={{ token: session.token, submissionId: session.submissionId, raw: session.raw, secondsRemaining: session.secondsRemaining }}
            initialStudentName={studentName}
            onSubmitted={(res) => {
              handleSubmitted(res);
              setStudentViewMode('dashboard');
            }}
            onReturnToDashboard={() => setStudentViewMode('dashboard')}
          />
          </ExamGuard>
        ) : null
      )}

      {/* MODE 2: PERSONAL DASHBOARD & COMPLETED SUBMISSIONS */}
      {studentViewMode === 'dashboard' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Espace Personnel de {studentName}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Interrogation active : <strong className="text-indigo-700">{currentQuiz.title}</strong> (PIN {currentQuiz.pinCode})
              </p>
            </div>

            <button
              onClick={() => setStudentViewMode('exam')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs self-start md:self-auto"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              Accéder aux Questions de l'Épreuve
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                Copies Notées & Corrigés Disponibles
              </span>
              <span className="text-xs font-mono text-slate-500">
                {mySubmissions.length} copie(s) transmise(s)
              </span>
            </div>

            {mySubmissions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 space-y-3">
                <p>Vous n'avez pas encore soumis de copie pour cette interrogation.</p>
                <button
                  onClick={() => setStudentViewMode('exam')}
                  className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg"
                >
                  Démarrer l'interrogation maintenant
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {mySubmissions.map((sub) => (
                  <div key={sub.id} className="p-5 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                    <div className="space-y-1">
                      <div className="font-bold text-slate-900 text-sm">{currentQuiz.title}</div>
                      <div className="text-xs text-slate-500">
                        Remis à {sub.submittedAt || '13:30:00'} · Temps : {Math.floor(sub.timeSpentSeconds / 60)} min {sub.timeSpentSeconds % 60}s
                      </div>
                      {sub.teacherFeedback && (
                        <div className="text-xs italic text-indigo-900 bg-indigo-50/70 px-2.5 py-1 rounded border border-indigo-100 mt-1 inline-block">
                          Note de l'enseignant : "{sub.teacherFeedback}"
                        </div>
                      )}
                    </div>

                    <div className="text-right shrink-0 flex items-center gap-4">
                      <button
                        onClick={() => {
                          setSelectedSubmissionForReview(sub);
                          setStudentViewMode('review');
                        }}
                        className="px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
                      >
                        Voir le Corrigé Détaillé →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODE 3: REVIEW PAST SUBMISSION */}
      {studentViewMode === 'review' && selectedSubmissionForReview && (
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <span className="text-xs font-bold text-indigo-700 block uppercase">
                Corrigé Détaillé & Barème
              </span>
              <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                {currentQuiz.title}
              </h2>
            </div>
            <button
              onClick={() => setStudentViewMode('dashboard')}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              ← Retour à mon relevé
            </button>
          </div>

          <div className="space-y-4">
            {currentQuiz.questions.map((q, idx) => {
              const ans = selectedSubmissionForReview.answers[q.id];
              const isDirect = q.type === 'direct_short' || q.type === 'direct_open';
              const isCorrect = ans?.isCorrect;

              return (
                <div key={q.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3 text-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="font-mono text-[11px] font-bold text-slate-400 block mb-0.5">
                        Question {idx + 1} · {isDirect ? 'Question Directe' : 'QCM'}
                      </span>
                      <h3 className="font-semibold text-slate-900 text-sm"><QTitle q={q} /></h3>
                    </div>
                    <span className={`font-mono font-bold shrink-0 ${isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>
                      +{ans?.scoreAwarded || 0} / {q.points} pts
                    </span>
                  </div>

                  {isDirect ? (
                    <div className="space-y-2 pt-1">
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-[11px] font-semibold text-slate-500 block mb-0.5">Votre réponse rédigée :</span>
                        <p className="font-mono text-slate-900 font-medium">
                          {ans?.textAnswer || <em className="text-slate-400">Non rédigée</em>}
                        </p>
                      </div>

                      {q.correctAnswerText && (


                      <div className="p-3 bg-emerald-50/70 rounded-lg border border-emerald-200">
                        <span className="text-[11px] font-semibold text-emerald-800 block mb-0.5">Réponse modèle attendue :</span>
                        <p className="font-mono text-emerald-950 font-medium">
                          {q.correctAnswerText}
                        </p>
                      </div>


                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5 pt-1">
                      {(q.options || []).map((opt, optIdx) => {
                        const isSelected = ans?.selectedOptionIds?.includes(opt.id);
                        return (
                          <div
                            key={opt.id}
                            className={`px-3 py-1.5 rounded border text-[11px] flex justify-between ${
                              opt.isCorrect
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-medium'
                                : isSelected
                                ? 'bg-rose-50 border-rose-200 text-rose-900 line-through'
                                : 'bg-white border-slate-200 text-slate-600'
                            }`}
                          >
                            <span><OptText q={q} opt={opt} index={optIdx} /></span>
                            {opt.isCorrect && <span className="text-emerald-700 font-semibold">Réponse exacte</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {q.explanation && (
                    <div className="p-2.5 rounded bg-slate-50 border border-slate-100 text-slate-600 text-[11px]">
                      <strong className="text-slate-800">Justification pédagogique : </strong><ExplText q={q} />
                    </div>
                  )}
                  {!q.explanation && !q.correctAnswerText && (
                    <div className="text-[11px] text-slate-500 italic">Le corrigé sera disponible après la clôture de l'épreuve par l'enseignant.</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
