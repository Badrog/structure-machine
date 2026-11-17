import React, { useEffect, useState } from 'react';
import { Quiz, Question, StudentSubmission } from '../types/quiz';
import { teacherApi } from '../services/api';
import { toScale, gradeScale } from '../utils/grade';
import { QTitle, OptText, ExplText, LangBar } from './MultiLangText';
import { X, CheckCircle2, XCircle, Clock, Award, Printer, MessageSquare, Edit3 } from 'lucide-react';

interface StudentCopyModalProps {
  submission: StudentSubmission;
  quiz: Quiz;
  onClose: () => void;
  onUpdateFeedback: (submissionId: string, feedback: string) => void;
  onUpdateQuestionScore?: (submissionId: string, questionId: string, newScore: number, comment?: string) => void;
}

export const StudentCopyModal: React.FC<StudentCopyModalProps> = ({
  submission,
  quiz,
  onClose,
  onUpdateFeedback,
  onUpdateQuestionScore
}) => {
  const [feedbackText, setFeedbackText] = useState(submission.teacherFeedback || '');
  const [isSaved, setIsSaved] = useState(false);
  const [localAnswers, setLocalAnswers] = useState(submission.answers);

  // Quiz à variantes : la copie est affichée avec les questions de SA variante
  const hasVariants = Boolean(quiz.variantList?.length && submission.variantId);
  const [variantQs, setVariantQs] = useState<Question[] | null>(null);
  const [variantErr, setVariantErr] = useState('');
  useEffect(() => {
    if (!hasVariants) return;
    let alive = true;
    setVariantQs(null); setVariantErr('');
    teacherApi.variant(quiz.id, submission.variantId!)
      .then((r) => { if (alive) setVariantQs(r.variant.questions); })
      .catch((e) => { if (alive) setVariantErr(e?.message || 'Variante introuvable'); });
    return () => { alive = false; };
  }, [hasVariants, quiz.id, submission.variantId]);
  const questions: Question[] = hasVariants ? variantQs ?? [] : quiz.questions;

  const handleScoreChange = (questionId: string, newScore: number) => {
    const clamped = Math.max(0, Math.min(20, newScore));
    setLocalAnswers((prev) => {
      const existing = prev[questionId];
      if (!existing) return prev;
      return {
        ...prev,
        [questionId]: {
          ...existing,
          scoreAwarded: clamped,
          isCorrect: clamped > 0
        }
      };
    });

    if (onUpdateQuestionScore) {
      onUpdateQuestionScore(submission.id, questionId, clamped);
    }
  };

  const handleSaveFeedback = () => {
    onUpdateFeedback(submission.id, feedbackText);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const totalCalculated = Object.values(localAnswers).reduce((sum, a) => sum + (a.scoreAwarded || 0), 0);
  const calculatedOutOf20 = Number(Math.min(20, (totalCalculated / (quiz.totalPoints || 20)) * 20).toFixed(1));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm shrink-0 font-mono">
                {submission.studentAvatar}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 leading-tight">
                  {submission.studentName}
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span className="font-mono">{submission.matricule}</span>
                  <span aria-hidden="true">·</span>
                  <span>{quiz.classGroup}</span>
                  {submission.variantLabel && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-indigo-700">{submission.variantLabel}</span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span>Remis à {submission.submittedAt || 'En cours de rédaction'}</span>
                </div>
                {(submission.violations?.length || 0) > 0 && (
                  <div className="mt-1.5 text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1">
                    ⚠ Incidents anti-triche : {submission.violations!.map((v) => `${v.at} (${v.type === 'screenshot' ? 'capture' : v.type === 'print' ? 'impression' : 'sortie de fenêtre'})`).join(', ')}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-slate-500 font-medium">Note Finale</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                {toScale(calculatedOutOf20, quiz)} <span className="text-sm font-normal text-slate-500">/ {gradeScale(quiz)}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-3 gap-4 p-3 bg-slate-100 rounded-lg text-xs">
            <div>
              <span className="text-slate-500 block">Temps Total de Passation</span>
              <span className="font-mono font-semibold text-slate-800 text-sm flex items-center gap-1 mt-0.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                {formatSeconds(submission.timeSpentSeconds)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Questions Traitées</span>
              <span className="font-mono font-semibold text-slate-800 text-sm mt-0.5 block">
                {Object.keys(localAnswers).length} sur {hasVariants ? quiz.questions.length : questions.length}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Total Points Barème</span>
              <span className="font-mono font-semibold text-slate-800 text-sm flex items-center gap-1 mt-0.5">
                <Award className="w-3.5 h-3.5 text-indigo-600" />
                {totalCalculated} / {quiz.totalPoints} pts
              </span>
            </div>
          </div>

          {/* Detailed Question Reviews */}
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                Feuille de Réponses Détaillée : Questions Directes & QCM
              </h4>
              <LangBar />
            </div>
            {hasVariants && !variantQs && !variantErr && <p className="text-xs text-slate-500">Chargement de la variante…</p>}
            {variantErr && <p className="text-xs text-rose-700">{variantErr}</p>}

            {questions.map((question, index) => {
              const answer = localAnswers[question.id];
              const isAnswered = Boolean(answer);
              const isDirect = question.type === 'direct_short' || question.type === 'direct_open';
              const isCorrect = answer?.isCorrect;

              return (
                <div
                  key={question.id}
                  className="p-4 rounded-lg border border-slate-200 bg-white space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <span className="font-mono text-xs font-bold text-slate-400 mt-0.5">
                        Q{index + 1}.
                      </span>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                            {isDirect ? 'Question Directe' : 'QCM'}
                          </span>
                          <span className="text-xs text-slate-400">· {question.category || 'Général'}</span>
                        </div>
                        <div className="text-sm font-semibold text-slate-900">
                          <QTitle q={question} />
                        </div>
                      </div>
                    </div>

                    {/* Score badge & Teacher direct score adjustment */}
                    <div className="text-right shrink-0 flex items-center gap-2">
                      {isAnswered && (
                        <div className="flex items-center gap-1.5">
                          <label className="text-[11px] text-slate-400 font-medium">Points :</label>
                          <input
                            type="number"
                            min={0}
                            max={question.points}
                            step={0.5}
                            value={answer.scoreAwarded}
                            onChange={(e) => handleScoreChange(question.id, Number(e.target.value))}
                            className="w-12 px-1.5 py-0.5 text-xs font-mono font-bold text-center border border-slate-200 rounded focus:border-indigo-500"
                          />
                          <span className="text-xs font-mono text-slate-500">/ {question.points}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* DISPLAY FOR DIRECT QUESTIONS */}
                  {isDirect ? (
                    <div className="space-y-2 pt-1">
                      {/* Student's written answer */}
                      <div className="p-3 rounded-md border border-slate-200 bg-slate-50">
                        <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                          Réponse Directe Rédigée par l'Étudiant :
                        </span>
                        <div className="font-mono text-xs text-slate-900 font-medium whitespace-pre-wrap">
                          {answer?.textAnswer || <span className="text-slate-400 italic">L'étudiant n'a pas répondu à cette question directe.</span>}
                        </div>
                      </div>

                      {/* Model answer expected by teacher */}
                      <div className="p-3 rounded-md border border-emerald-200 bg-emerald-50/60">
                        <span className="text-[11px] font-semibold text-emerald-800 block mb-0.5">
                          Réponse Modèle & Critères de Notation :
                        </span>
                        <p className="font-mono text-xs text-emerald-950 font-medium">
                          {question.correctAnswerText}
                        </p>
                        {question.gradingCriteria && (
                          <div className="text-[11px] text-emerald-800 mt-1 pt-1 border-t border-emerald-200/60">
                            <strong>Barème : </strong>{question.gradingCriteria}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* DISPLAY FOR QCM OPTIONS */
                    <div className="space-y-1.5 pt-1">
                      {(question.options || []).map((option, optIdx) => {
                        const isSelected = answer?.selectedOptionIds?.includes(option.id);
                        const isOptionCorrect = option.isCorrect;

                        let itemStyle = 'border-slate-200 bg-slate-50/50 text-slate-700';
                        if (isSelected && isOptionCorrect) {
                          itemStyle = 'border-emerald-300 bg-emerald-50/70 text-emerald-900 font-medium';
                        } else if (isSelected && !isOptionCorrect) {
                          itemStyle = 'border-rose-300 bg-rose-50/70 text-rose-900 line-through';
                        } else if (!isSelected && isOptionCorrect) {
                          itemStyle = 'border-emerald-200 bg-emerald-50/30 text-emerald-800 border-dashed';
                        }

                        return (
                          <div
                            key={option.id}
                            className={`px-3 py-2 text-xs rounded-md border flex items-center justify-between ${itemStyle}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] opacity-60">
                                {isSelected ? '✓ ' : '○ '}
                              </span>
                              <span><OptText q={question} opt={option} index={optIdx} /></span>
                            </div>
                            <div className="text-[11px] shrink-0 font-medium">
                              {isSelected && isOptionCorrect && (
                                <span className="text-emerald-700">Choix exact</span>
                              )}
                              {isSelected && !isOptionCorrect && (
                                <span className="text-rose-700">Erreur commise</span>
                              )}
                              {!isSelected && isOptionCorrect && (
                                <span className="text-emerald-700">Bonne réponse attendue</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Explanation Callout */}
                  <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-md border border-slate-200">
                    <span className="font-semibold text-slate-800">Justification pédagogique : </span>
                    <ExplText q={question} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Teacher Feedback Note Box */}
          <div className="border border-indigo-200 bg-indigo-50/40 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                Remarque & Conseil Pédagogique de l'Enseignant
              </label>
              {isSaved && (
                <span className="text-xs text-emerald-600 font-medium animate-in fade-in">
                  Enregistré avec succès !
                </span>
              )}
            </div>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Saisissez une observation personnalisée pour l'étudiant..."
              rows={2}
              className="w-full text-xs p-2.5 rounded-md bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-800 placeholder-slate-400"
            />
            <div className="flex justify-end">
              <button
                onClick={handleSaveFeedback}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
              >
                Enregistrer l'annotation
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimer la copie
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Fermer l'aperçu
          </button>
        </div>
      </div>
    </div>
  );
};
