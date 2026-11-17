import React, { useState, useEffect, useRef } from 'react';
import { Quiz, Question, StudentSubmission, StudentAnswer } from '../types/quiz';
import confetti from 'canvas-confetti';
import { studentApi, SubmitResult } from '../services/api';
import { toScale, gradeScale } from '../utils/grade';
import { QTitle, OptText, ExplText, Instructions, LangBar, MultiText } from './MultiLangText';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Send,
  RotateCcw,
  Flag,
  FileText,
  HelpCircle,
  Sparkles,
  Award,
  Check,
  X,
  Edit3,
  AlignLeft,
  CheckSquare,
  ShieldAlert
} from 'lucide-react';

interface StudentQuizSimulatorProps {
  quiz: Quiz;
  session: {
    token: string;
    submissionId: string;
    raw?: { selected: Record<string, string[]>; text: Record<string, string> };
    secondsRemaining?: number;
  };
  onSubmitted: (result: SubmitResult) => void;
  onReturnToDashboard: () => void;
  initialStudentName?: string;
}

export const StudentQuizSimulator: React.FC<StudentQuizSimulatorProps> = ({
  quiz,
  session,
  onSubmitted,
  onReturnToDashboard,
  initialStudentName
}) => {
  const [studentName, setStudentName] = useState(initialStudentName || '');
  const [isStarted, setIsStarted] = useState(true);
  const [isFinished, setIsFinished] = useState(false);
  const [showReviewScreen, setShowReviewScreen] = useState(false);

  // Exam flow states
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>(session.raw?.selected || {});
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>(session.raw?.text || {});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  const [secondsRemaining, setSecondsRemaining] = useState(session.secondsRemaining ?? quiz.durationMinutes * 60);
  const [resultQuiz, setResultQuiz] = useState<Quiz | null>(null);
  const [correctionVisible, setCorrectionVisible] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const latest = useRef({ selectedOptions, textAnswers, currentQIndex });
  latest.current = { selectedOptions, textAnswers, currentQIndex };
  const submittingRef = useRef(false);
  const dirtyRef = useRef(false);
  const [submittedResult, setSubmittedResult] = useState<StudentSubmission | null>(null);
  const [savedPing, setSavedPing] = useState(false);

  // Quick mathematical & scientific symbols for direct questions
  const MATH_SYMBOLS = ['O(n²)', 'O(n log n)', 'O(1)', 'O(n)', '∑', '→', '≤', '≥', '≠', 'π', '⌊x⌋', '⌈x⌉', 'α', 'β', 'λ'];

  // Timer effect
  useEffect(() => {
    if (!isStarted || isFinished) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setTimeout(() => handleFinishQuiz(), 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isStarted, isFinished]);

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleStart = () => {
    setIsStarted(true);
  };

  // Option selection for QCM
  const handleSelectOption = (questionId: string, optionId: string, isSingle: boolean) => {
    setSelectedOptions((prev) => {
      const current = prev[questionId] || [];
      if (isSingle) {
        return { ...prev, [questionId]: [optionId] };
      } else {
        const exists = current.includes(optionId);
        const next = exists ? current.filter((id) => id !== optionId) : [...current, optionId];
        return { ...prev, [questionId]: next };
      }
    });
    triggerSavePing();
  };

  // Text answer typing for direct questions
  const handleTextChange = (questionId: string, text: string) => {
    setTextAnswers((prev) => ({ ...prev, [questionId]: text }));
    triggerSavePing();
  };

  const insertSymbol = (questionId: string, sym: string) => {
    const current = textAnswers[questionId] || '';
    handleTextChange(questionId, current ? `${current} ${sym}` : sym);
  };

  const toggleFlagQuestion = (questionId: string) => {
    setFlaggedQuestions((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
  };

  const triggerSavePing = () => {
    setSavedPing(true);
    setTimeout(() => setSavedPing(false), 1200);
  };

  // Sauvegarde automatique (toutes les ~2 s après une modification) : permet la reprise et le suivi en direct
  useEffect(() => {
    dirtyRef.current = true;
    if (isFinished) return;
    const t = setTimeout(async () => {
      if (!dirtyRef.current || submittingRef.current) return;
      dirtyRef.current = false;
      try {
        await studentApi.progress(
          { submissionId: session.submissionId, token: session.token },
          { selected: latest.current.selectedOptions, text: latest.current.textAnswers, currentQuestionIndex: latest.current.currentQIndex }
        );
      } catch {
        dirtyRef.current = true; // réessaiera à la prochaine modification / remise
      }
    }, 2000);
    return () => clearTimeout(t);
  }, [selectedOptions, textAnswers, currentQIndex, isFinished]);

  // Remise : la correction est faite par le serveur (les bonnes réponses ne quittent jamais le serveur avant la remise)
  const handleFinishQuiz = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await studentApi.submit(
        { submissionId: session.submissionId, token: session.token },
        { selected: latest.current.selectedOptions, text: latest.current.textAnswers }
      );
      setSubmittedResult(res.submission);
      setResultQuiz(res.quiz);
      setCorrectionVisible(Boolean(res.correctionVisible));
      setIsFinished(true);
      setShowReviewScreen(false);
      onSubmitted(res);
      try {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      } catch (e) {
        // ignore
      }
    } catch (err) {
      submittingRef.current = false;
      setSubmitError((err as Error).message);
      setShowReviewScreen(true);
    } finally {
      setSubmitting(false);
    }
  };

  const isQuestionAnswered = (q: Question) => {
    if (q.type === 'direct_short' || q.type === 'direct_open') {
      return Boolean((textAnswers[q.id] || '').trim());
    }
    return (selectedOptions[q.id] || []).length > 0;
  };

  const answeredCount = quiz.questions.filter((q) => isQuestionAnswered(q)).length;
  const currentQ = quiz.questions[currentQIndex];

  // 1. Splash Screen / Student Portal Login
  if (!isStarted) {
    return (
      <div className="max-w-2xl mx-auto py-8 space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-xs space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-indigo-50 text-indigo-700 rounded-2xl flex items-center justify-center mx-auto mb-2 font-mono font-bold text-lg border border-indigo-100">
              {quiz.pinCode}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {quiz.title}
            </h1>
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
              <span>{quiz.subject}</span>
              <span aria-hidden="true">·</span>
              <span>{quiz.level}</span>
              <span aria-hidden="true">·</span>
              <span>{quiz.classGroup}</span>
            </div>
          </div>

          {/* Exam official instructions */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2 text-slate-700">
            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-indigo-600" />
              Consignes Générales & Barème de l'Épreuve
            </div>
            {quiz.instructions ? (
              <Instructions text={quiz.instructions} className="text-slate-600 leading-relaxed" />
            ) : (
              <p className="text-slate-600 leading-relaxed">
                Répondez avec précision. Les questions directes nécessitent une justification rédigée ou une valeur exacte. Vos réponses sont sauvegardées en continu.
              </p>
            )}
            <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500">
              <span>Langues / Languages :</span>
              <LangBar />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-slate-500 font-mono text-[11px]">
              <div>
                Durée : <strong className="text-slate-800">{quiz.durationMinutes} minutes</strong>
              </div>
              <div>
                Questions : <strong className="text-slate-800">{quiz.questions.length}</strong>
              </div>
              <div>
                Note Maximale : <strong className="text-slate-800">{quiz.totalPoints} pts (note sur {gradeScale(quiz)})</strong>
              </div>
            </div>
          </div>

          {/* Student Identifiers Form */}
          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                Nom et Prénom de l'Étudiant *
              </label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Ex: Youssef Amrani"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-900 font-medium"
              />
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-2.5">
            <button
              onClick={handleStart}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold rounded-lg text-xs transition-colors shadow-xs"
            >
              Accéder à l'Interrogation & Lancer le Chronomètre
            </button>
            <button
              onClick={onReturnToDashboard}
              className="w-full py-2 px-4 text-slate-500 hover:text-slate-800 text-xs font-medium transition-colors"
            >
              Retourner au Tableau de Bord Enseignant
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Results Screen
  if (isFinished && submittedResult) {

    return (
      <div className="max-w-3xl mx-auto py-6 space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-xs text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <Award className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Copie Transmise avec Succès !
          </h2>

          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Votre interrogation a été transmise à l'enseignant. La note ne sera pas affichée ici.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
            <button
              onClick={onReturnToDashboard}
              className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs"
            >
              Voir ma Copie dans le Tableau de Bord Professeur
            </button>
            <button
              onClick={() => {
                setIsStarted(false);
                setIsFinished(false);
                setSelectedOptions({});
                setTextAnswers({});
                setFlaggedQuestions({});
              }}
              className="px-4 py-2.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Recommencer un essai
            </button>
          </div>
        </div>

        {/* Corrigé détaillé : uniquement quand l'enseignant l'autorise */}
        {correctionVisible && <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            Corrigé Détaillé : Questions Directes & QCM
          </h3>

          <div className="space-y-4">
            {(resultQuiz || quiz).questions.map((q, idx) => {
              const ans = submittedResult.answers[q.id];
              const isCorrect = ans?.isCorrect;
              const isDirect = q.type === 'direct_short' || q.type === 'direct_open';

              return (
                <div
                  key={q.id}
                  className={`p-4 rounded-lg border text-xs space-y-2.5 ${
                    isCorrect ? 'border-emerald-200 bg-emerald-50/20' : 'border-rose-200 bg-rose-50/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-[11px] font-bold text-slate-400 block mb-0.5">
                        Question {idx + 1} · {q.type === 'direct_open' ? 'Question Directe (Rédaction)' : q.type === 'direct_short' ? 'Question Directe (Réponse Courte)' : 'QCM'}
                      </span>
                      <QTitle q={q} className="font-semibold text-slate-900" />
                    </div>

                    <span className="font-mono font-bold shrink-0 ml-3">
                      {isCorrect ? (
                        <span className="text-emerald-700 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> +{ans?.scoreAwarded || q.points} pts
                        </span>
                      ) : (
                        <span className="text-rose-700 flex items-center gap-1">
                          <X className="w-3.5 h-3.5" /> +{ans?.scoreAwarded || 0} / {q.points} pts
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Direct Question Answer Comparison */}
                  {isDirect ? (
                    <div className="space-y-2 pt-1 text-xs">
                      <div className="p-2.5 rounded bg-white border border-slate-200">
                        <span className="text-slate-500 font-medium block text-[11px]">Votre Réponse Rédigée :</span>
                        <p className="font-mono text-slate-900 mt-0.5 font-medium">
                          {ans?.textAnswer || <em className="text-slate-400 font-sans">Aucune réponse rédigée.</em>}
                        </p>
                      </div>

                      {q.correctAnswerText && (
                        <div className="p-2.5 rounded bg-emerald-50/80 border border-emerald-200">
                          <span className="text-emerald-800 font-semibold block text-[11px]">Réponse Modèle Attendue par l'Enseignant :</span>
                          <p className="font-mono text-emerald-950 mt-0.5">
                            {q.correctAnswerText}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* QCM Options */
                    <div className="space-y-1 pt-1">
                      {(q.options || []).map((opt, optIdx) => {
                        const isSelected = ans?.selectedOptionIds?.includes(opt.id);
                        return (
                          <div
                            key={opt.id}
                            className={`px-3 py-1.5 rounded border text-[11px] flex justify-between ${
                              opt.isCorrect
                                ? 'border-emerald-300 bg-emerald-100/50 text-emerald-900 font-medium'
                                : isSelected
                                ? 'border-rose-300 bg-rose-100/50 text-rose-900 line-through'
                                : 'border-slate-200 text-slate-600'
                            }`}
                          >
                            <span><OptText q={q} opt={opt} index={optIdx} /></span>
                            {opt.isCorrect && <span className="text-emerald-700 font-semibold">Réponse exacte</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Explanation */}
                  {q.explanation ? (
                    <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded border border-slate-200">
                      <strong className="text-slate-800">Justification pédagogique : </strong>
                      <ExplText q={q} />
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500 italic">Le corrigé sera disponible après la clôture de l'épreuve par l'enseignant.</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>}
      </div>
    );
  }

  // 3. Review Summary Screen before final submit
  if (showReviewScreen) {
    return (
      <div className="max-w-3xl mx-auto py-6 space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Récapitulatif & Vérification avant Soumission
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Vérifiez l'ensemble de vos réponses rédigées et choix avant de valider votre copie définitivement.
              </p>
            </div>
            <div className="text-right font-mono">
              <span className="text-xs text-slate-500 block">Temps Restant</span>
              <span className="text-base font-bold text-indigo-700">{formatTimer(secondsRemaining)}</span>
            </div>
          </div>

          <div className="space-y-3">
            {quiz.questions.map((q, idx) => {
              const answered = isQuestionAnswered(q);
              const isDirect = q.type === 'direct_short' || q.type === 'direct_open';
              const textVal = textAnswers[q.id];

              return (
                <div
                  key={q.id}
                  onClick={() => {
                    setCurrentQIndex(idx);
                    setShowReviewScreen(false);
                  }}
                  className={`p-3.5 rounded-lg border text-xs cursor-pointer hover:border-indigo-400 transition-colors flex items-start justify-between gap-3 ${
                    answered ? 'border-slate-200 bg-white' : 'border-amber-300 bg-amber-50/40'
                  }`}
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-500">Q{idx + 1}.</span>
                      <span className="font-semibold text-slate-900 line-clamp-1"><QTitle q={q} langs={['fr']} /></span>
                      {flaggedQuestions[q.id] && (
                        <span className="text-amber-600 font-bold flex items-center gap-0.5 text-[10px]">
                          <Flag className="w-3 h-3 fill-amber-500" /> À revoir
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-600 pl-6">
                      {isDirect ? (
                        <span>
                          Réponse : <strong className="font-mono text-slate-800">{textVal ? `"${textVal}"` : <span className="text-amber-700">Non rédigée</span>}</strong>
                        </span>
                      ) : (
                        <span>
                          Choix : <strong className="text-slate-800">{selectedOptions[q.id]?.length ? `${selectedOptions[q.id].length} option(s) sélectionnée(s)` : <span className="text-amber-700">Non sélectionné</span>}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="text-[11px] text-indigo-600 font-semibold shrink-0">
                    Modifier →
                  </span>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <button
              onClick={() => setShowReviewScreen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              ← Revenir aux questions
            </button>
            <button
              onClick={handleFinishQuiz}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 disabled:opacity-60 px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Envoi en cours…' : 'Confirmer et Transmettre ma Copie'}
            </button>
          </div>
          {submitError && (
            <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {submitError} — vos réponses sont conservées, réessayez.
            </div>
          )}
        </div>
      </div>
    );
  }

  // 4. Active Question View: How the student sees and answers
  const isDirectShort = currentQ.type === 'direct_short';
  const isDirectOpen = currentQ.type === 'direct_open';
  const isDirect = isDirectShort || isDirectOpen;
  const currentTextAnswer = textAnswers[currentQ.id] || '';

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top Banner Context */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs shrink-0 font-mono">
            {studentName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 leading-none">
              {studentName}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
              <span>{quiz.title}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{answeredCount} / {quiz.questions.length} répondues</span>
            </div>
          </div>
        </div>

        <LangBar />

        {/* Auto-save & Timer indicators */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">
              {savedPing ? (
                <span className="text-emerald-600 font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Enregistré
                </span>
              ) : (
                'Sauvegarde auto'
              )}
            </span>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            <Clock
              className={`w-4 h-4 ${
                secondsRemaining < 120 ? 'text-rose-600 animate-pulse' : 'text-slate-500'
              }`}
            />
            <span
              className={`font-mono text-base font-bold tabular-nums ${
                secondsRemaining < 120 ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              {formatTimer(secondsRemaining)}
            </span>
          </div>
        </div>
      </div>

      {/* Question Selector Strip with Flag Status */}
      <div className="flex items-center justify-between gap-1.5 overflow-x-auto py-1">
        {quiz.questions.map((q, i) => {
          const answered = isQuestionAnswered(q);
          const isCurrent = i === currentQIndex;
          const isFlagged = flaggedQuestions[q.id];

          return (
            <button
              key={q.id}
              onClick={() => setCurrentQIndex(i)}
              className={`h-9 flex-1 min-w-[48px] rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center gap-1 relative ${
                isCurrent
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : answered
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Q{i + 1}
              {answered && !isCurrent && <span className="text-[10px]">✓</span>}
              {isFlagged && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 border border-white" />
              )}
            </button>
          );
        })}
      </div>

      {/* Main Question Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
        {/* Header of Question */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="text-indigo-600 uppercase tracking-wider">
                Question {currentQIndex + 1} sur {quiz.questions.length}
              </span>

              <span aria-hidden="true">·</span>
              <span className="text-slate-600">
                {isDirectOpen
                  ? 'Question Directe (Rédaction & Démonstration)'
                  : isDirectShort
                  ? 'Question Directe (Réponse Courte / Valeur)'
                  : currentQ.type === 'true_false'
                  ? 'Question Vrai / Faux'
                  : 'QCM'}
              </span>
            </div>

            <h2 className="text-base font-bold text-slate-900 leading-snug">
              <QTitle q={currentQ} />
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => toggleFlagQuestion(currentQ.id)}
              className={`p-1.5 rounded-lg border transition-colors ${
                flaggedQuestions[currentQ.id]
                  ? 'bg-amber-50 border-amber-300 text-amber-700'
                  : 'bg-white border-slate-200 text-slate-400 hover:text-slate-700'
              }`}
              title="Marquer pour révision ultérieure"
            >
              <Flag className={`w-4 h-4 ${flaggedQuestions[currentQ.id] ? 'fill-amber-500' : ''}`} />
            </button>
            <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded">
              {currentQ.points} points
            </span>
          </div>
        </div>

        {/* =========================================================================
            QUESTION DIRECTE : Réponse Courte ou Rédaction Libre
           ========================================================================= */}
        {isDirect ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
              <label className="flex items-center gap-1.5 text-slate-900 font-bold">
                <Edit3 className="w-4 h-4 text-indigo-600" />
                {isDirectOpen ? 'Votre Réponse Directe & Justification :' : 'Votre réponse / Your answer :'}
              </label>
              {isDirectOpen && (
                <span className="text-slate-400 font-mono text-[11px]">
                  {currentTextAnswer.trim().split(/\s+/).filter(Boolean).length} mots · {currentTextAnswer.length} caractères
                </span>
              )}
            </div>

            {/* Barre de symboles : réservée aux réponses rédigées */}
            {isDirectOpen && <div className="flex items-center gap-1.5 flex-wrap p-2 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-500 font-semibold mr-1">Symboles rapides :</span>
              {MATH_SYMBOLS.map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => insertSymbol(currentQ.id, sym)}
                  className="px-2 py-0.5 text-xs font-mono bg-white hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 rounded transition-colors"
                >
                  {sym}
                </button>
              ))}
            </div>}

            {/* Direct Input Field */}
            {isDirectOpen ? (
              <textarea
                rows={5}
                value={currentTextAnswer}
                onChange={(e) => handleTextChange(currentQ.id, e.target.value)}
                placeholder={currentQ.placeholder || "Rédigez ici votre démonstration, formule ou explication complète..."}
                className="w-full p-3.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-900 font-mono leading-relaxed"
              />
            ) : (
              <input
                type="text"
                value={currentTextAnswer}
                onChange={(e) => handleTextChange(currentQ.id, e.target.value)}
                placeholder={currentQ.placeholder || "Saisissez la valeur, notation asymptotique ou expression exacte..."}
                className="w-full px-3.5 py-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-900 font-mono text-sm font-semibold"
              />
            )}

            {currentQ.gradingCriteria && (
              <div className="text-[11px] text-slate-500 bg-slate-50/80 p-2.5 rounded-md border border-slate-200">
                <span className="font-semibold text-slate-700">Consigne de correction : </span>
                {currentQ.gradingCriteria}
              </div>
            )}
          </div>
        ) : (
          /* =========================================================================
              QCM & VRAI / FAUX
             ========================================================================= */
          <div className="space-y-2.5">
            {(currentQ.options || []).map((opt, optIdx) => {
              const isSelected = (selectedOptions[currentQ.id] || []).includes(opt.id);
              const isSingle = currentQ.type !== 'multiple_choice';

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectOption(currentQ.id, opt.id, isSingle)}
                  className={`w-full text-left p-3.5 rounded-lg border text-xs transition-all flex items-center gap-3 ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 font-medium ring-1 ring-indigo-500'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </div>
                  <span className="flex-1">
                    <span className="font-mono font-bold text-slate-400 mr-1.5 uppercase" dir="ltr">{opt.id})</span>
                    <OptText q={currentQ} opt={opt} index={optIdx} className="inline" />
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Navigation & Controls */}
        <div className="pt-5 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={() => setCurrentQIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentQIndex === 0}
            className="inline-flex items-center gap-1 px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
            Question précédente
          </button>

          <div className="flex items-center gap-2">
            {/* Review summary button */}
            <button
              onClick={() => setShowReviewScreen(true)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
            >
              Revoir toute la copie ({answeredCount}/{quiz.questions.length})
            </button>

            {currentQIndex === quiz.questions.length - 1 ? (
              <button
                onClick={() => setShowReviewScreen(true)}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm"
              >
                <Send className="w-4 h-4" />
                Vérifier & Soumettre
              </button>
            ) : (
              <button
                onClick={() => setCurrentQIndex((prev) => Math.min(quiz.questions.length - 1, prev + 1))}
                className="inline-flex items-center gap-1 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs"
              >
                Question suivante
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
