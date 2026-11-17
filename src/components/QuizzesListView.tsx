import React, { useRef, useState } from 'react';
import { Quiz } from '../types/quiz';
import { Play, Plus, Copy, FileText, CheckCircle2, Clock, Trash2, ExternalLink } from 'lucide-react';

interface QuizzesListViewProps {
  quizzes: Quiz[];
  activeQuizId: string;
  onSelectActiveQuiz: (quizId: string) => void;
  onOpenCreate: () => void;
  onImportInterro?: (file: File) => void;
  onDeleteQuiz: (quizId: string) => void;
  onDuplicateQuiz: (quiz: Quiz) => void;
  onTestStudentView: (quizId: string) => void;
  onSetStatus: (quizId: string, status: Quiz['status'], showCorrection?: boolean) => void;
}

export const QuizzesListView: React.FC<QuizzesListViewProps> = ({
  quizzes,
  activeQuizId,
  onSelectActiveQuiz,
  onOpenCreate,
  onImportInterro,
  onDeleteQuiz,
  onDuplicateQuiz,
  onTestStudentView,
  onSetStatus
}) => {
  const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Banque d'Interrogations & Évaluations
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Gérez vos sujets d'examen, lancez une session en direct avec vos étudiants ou exportez les sujets.
          </p>
        </div>

        {onImportInterro && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) onImportInterro(f);
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Importer un fichier d'interrogation (3 groupes · variantes · JSON)
            </button>
          </>
        )}
        <button
          onClick={onOpenCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          Créer une Interrogation
        </button>
      </div>

      {/* Grid of Quizzes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {quizzes.map((quiz) => {
          const isActive = quiz.id === activeQuizId;

          return (
            <div
              key={quiz.id}
              className={`bg-white rounded-xl border transition-all p-5 shadow-xs flex flex-col justify-between ${
                isActive
                  ? 'border-indigo-600 ring-1 ring-indigo-500'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="space-y-3">
                {/* Meta details with zero-pill typography */}
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <span>{quiz.level}</span>
                    <span aria-hidden="true">·</span>
                    <span>{quiz.subject}</span>
                  </div>
                  {isActive && (
                    <span className="text-xs font-bold text-indigo-700 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-indigo-600" />
                      Session Active
                    </span>
                  )}
                </div>

                {/* Title */}
                <h3 className="text-base font-bold text-slate-900 leading-snug">
                  {quiz.title}
                </h3>

                {/* Info row */}
                <div className="text-xs text-slate-500 space-y-1 pt-1 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Code PIN :</span>
                    <strong className="text-indigo-700">{quiz.pinCode}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Questions :</span>
                    <span>{quiz.questions.length} questions ({quiz.totalPoints} pts)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Durée :</span>
                    <span>{quiz.durationMinutes} minutes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Promotion :</span>
                    <span className="truncate max-w-[150px]">{quiz.classGroup}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-slate-400">Statut :</span>
                    <span className="flex items-center gap-2">
                      <span className={quiz.status === 'active' ? 'text-emerald-700 font-semibold' : quiz.status === 'completed' ? 'text-slate-600' : 'text-amber-700'}>
                        {quiz.status === 'active' ? 'Ouverte' : quiz.status === 'completed' ? 'Clôturée' : 'Brouillon'}
                      </span>
                      <button
                        onClick={() => onSetStatus(quiz.id, quiz.status === 'active' ? 'completed' : 'active')}
                        className="px-2 py-0.5 text-[11px] font-sans font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded"
                        title={quiz.status === 'active' ? 'Fermer aux étudiants et afficher le corrigé' : 'Ouvrir aux étudiants'}
                      >
                        {quiz.status === 'active' ? 'Clôturer' : 'Ouvrir'}
                      </button>
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-5 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPreviewQuiz(quiz)}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                    title="Aperçu des questions"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDuplicateQuiz(quiz)}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                    title="Dupliquer l'épreuve"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  {(
                    <button
                      onClick={() => onDeleteQuiz(quiz.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onTestStudentView(quiz.id)}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                  >
                    Tester
                  </button>
                  <button
                    onClick={() => onSelectActiveQuiz(quiz.id)}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                    }`}
                  >
                    {isActive ? 'Session en cours' : 'Activer'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quiz Questions Preview Modal */}
      {previewQuiz && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {previewQuiz.title}
                </h3>
                <div className="text-xs text-slate-500 mt-0.5">
                  {previewQuiz.subject} · {previewQuiz.level} · Barème : {previewQuiz.totalPoints} pts
                </div>
              </div>
              <button
                onClick={() => setPreviewQuiz(null)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Fermer
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {previewQuiz.questions.map((q, i) => (
                <div key={q.id} className="p-3.5 border border-slate-200 rounded-lg text-xs space-y-2">
                  <div className="flex justify-between font-semibold text-slate-900">
                    <div>
                      <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded mr-2">
                        {q.type === 'direct_open'
                          ? 'Question Directe (Rédaction)'
                          : q.type === 'direct_short'
                          ? 'Question Directe (Courte)'
                          : 'QCM'}
                      </span>
                      <span>Q{i + 1}. {q.title}</span>
                    </div>
                    <span className="font-mono text-slate-500 shrink-0 ml-2">{q.points} pts</span>
                  </div>

                  {q.type === 'direct_short' || q.type === 'direct_open' ? (
                    <div className="p-2 rounded bg-emerald-50/70 border border-emerald-200 text-[11px]">
                      <span className="font-semibold text-emerald-800 block text-[10px]">Réponse modèle attendue :</span>
                      <span className="font-mono text-emerald-950 font-medium">{q.correctAnswerText}</span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {(q.options || []).map((opt) => (
                        <div
                          key={opt.id}
                          className={`px-2.5 py-1 rounded border text-[11px] ${
                            opt.isCorrect
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-medium'
                              : 'bg-white border-slate-200 text-slate-600'
                          }`}
                        >
                          {opt.isCorrect ? '✓ ' : '○ '} {opt.text}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded">
                    <strong>Corrigé : </strong>{q.explanation}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between">
              <button
                onClick={() => window.print()}
                className="text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Imprimer le sujet d'examen
              </button>
              <button
                onClick={() => setPreviewQuiz(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg"
              >
                Terminé
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
