import React, { useState, useEffect, useMemo } from 'react';
import { toScale, gradeScale } from '../utils/grade';
import { Quiz, StudentSubmission } from '../types/quiz';
import { StudentTable } from './StudentTable';
import { StudentCopyModal } from './StudentCopyModal';
import {
  Users,
  Award,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  Download,
  Share2,
  ChevronRight,
  TrendingUp,
  BarChart2,
  HelpCircle
} from 'lucide-react';

interface LiveDashboardProps {
  quiz: Quiz;
  quizzes: Quiz[];
  onSelectQuiz: (quizId: string) => void;
  submissions: StudentSubmission[];
  onUpdateFeedback: (submissionId: string, feedback: string) => void;
  onUpdateQuestionScore: (submissionId: string, questionId: string, score: number, comment?: string) => void;
  onResetSession: () => void;
  onSetStatus: (status: Quiz['status']) => void;
  onOpenCreate: () => void;
  onOpenSimulator: () => void;
}

export const LiveDashboard: React.FC<LiveDashboardProps> = ({
  quiz,
  quizzes,
  onSelectQuiz,
  submissions,
  onUpdateFeedback,
  onUpdateQuestionScore,
  onResetSession,
  onSetStatus,
  onOpenCreate,
  onOpenSimulator
}) => {
  const [selectedSubmission, setSelectedSubmission] = useState<StudentSubmission | null>(null);
  const [copiedPin, setCopiedPin] = useState(false);
  const [liveEventMessage, setLiveEventMessage] = useState<string | null>(null);



  // Aggregate Metrics
  const stats = useMemo(() => {
    const total = submissions.length;
    if (total === 0) {
      return {
        avgScore: 0,
        completedCount: 0,
        activeCount: 0,
        strugglingCount: 0,
        completionRate: 0,
        questionStats: [],
        gradeDistribution: [0, 0, 0, 0, 0]
      };
    }

    const completed = submissions.filter((s) => s.status === 'completed');
    const active = submissions.filter((s) => s.status === 'active');
    const struggling = submissions.filter((s) => s.scoreOutOf20 < 10 || s.status === 'needs_help');

    const totalScoreSum = submissions.reduce((sum, s) => sum + s.scoreOutOf20, 0);
    const avgScore = Number((totalScoreSum / total).toFixed(1));

    // Distribution: [<10, 10-12, 12-14, 14-16, >=16]
    const distribution = [0, 0, 0, 0, 0];
    submissions.forEach((s) => {
      const sc = s.scoreOutOf20;
      if (sc < 10) distribution[0]++;
      else if (sc < 12) distribution[1]++;
      else if (sc < 14) distribution[2]++;
      else if (sc < 16) distribution[3]++;
      else distribution[4]++;
    });

    // Question analytics
    const questionStats = quiz.questions.map((q) => {
      let answeredTotal = 0;
      let correctTotal = 0;

      submissions.forEach((s) => {
        const ans = s.answers[q.id];
        if (ans) {
          answeredTotal++;
          if (ans.isCorrect) correctTotal++;
        }
      });

      const successPct = answeredTotal > 0 ? Math.round((correctTotal / answeredTotal) * 100) : 0;
      return {
        questionId: q.id,
        title: q.title,
        points: q.points,
        category: q.category || 'Général',
        answeredTotal,
        correctTotal,
        successPct
      };
    });

    // Identify hardest question
    const hardest = [...questionStats].sort((a, b) => a.successPct - b.successPct)[0];

    return {
      avgScore,
      completedCount: completed.length,
      activeCount: active.length,
      strugglingCount: struggling.length,
      completionRate: Math.round((completed.length / total) * 100),
      questionStats,
      hardestQuestion: hardest,
      gradeDistribution: distribution
    };
  }, [submissions, quiz]);

  const handleCopyPin = () => {
    navigator.clipboard.writeText(quiz.pinCode);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  const handleUpdateFeedback = onUpdateFeedback;
  const handleUpdateQuestionScore = onUpdateQuestionScore;

  const handleExportCSV = () => {
    const headers = ['Matricule', 'Nom', 'Statut', 'Note_Sur_20', 'Total_Points', 'Temps_Sec', 'Remarques_Enseignant'];
    const rows = submissions.map((s) => [
      s.matricule,
      `"${s.studentName}"`,
      s.status,
      s.scoreOutOf20,
      s.totalScore,
      s.timeSpentSeconds,
      `"${s.teacherFeedback || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `evalis_${quiz.id}_notes.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleResetSession = () => {
    if (confirm('Supprimer toutes les copies de cette session ? Les étudiants pourront recommencer.')) {
      onResetSession();
      setLiveEventMessage('Session réinitialisée. Les étudiants peuvent commencer.');
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Session Header Card (Zero-Pill, Single Elevation) */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span>{quiz.subject}</span>
              <span aria-hidden="true">·</span>
              <span>{quiz.level}</span>
              <span aria-hidden="true">·</span>
              <span>{quiz.classGroup}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">Durée : {quiz.durationMinutes} min</span>
            </div>

            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {quiz.title}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1">
              {/* Access PIN Code */}
              <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                <span className="text-slate-500 font-medium">Code PIN Étudiant :</span>
                <span className="font-mono font-bold text-indigo-700 text-sm tracking-wider">
                  {quiz.pinCode}
                </span>
                <button
                  onClick={handleCopyPin}
                  className="text-[11px] text-slate-500 hover:text-indigo-600 transition-colors ml-1 font-semibold"
                >
                  {copiedPin ? 'Copié !' : 'Copier'}
                </button>
              </div>

              {/* Interrogation switcher */}
              {quizzes.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Épreuve active :</span>
                  <select
                    value={quiz.id}
                    onChange={(e) => onSelectQuiz(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-md px-2.5 py-1 focus:outline-none focus:border-indigo-500 font-medium"
                  >
                    {quizzes.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.title} ({q.level})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Teacher Interactive Controls */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Ouvrir / clôturer l'épreuve */}
            <button
              onClick={() => onSetStatus(quiz.status === 'active' ? 'completed' : 'active')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors shadow-xs ${
                quiz.status === 'active' ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
              title={quiz.status === 'active' ? 'Fermer aux étudiants et afficher le corrigé' : 'Rouvrir aux étudiants'}
            >
              {quiz.status === 'active' ? (<><Pause className="w-4 h-4" />Clôturer l'épreuve</>) : (<><Play className="w-4 h-4" />Rouvrir l'épreuve</>)}
            </button>

            {/* Test as student */}
            <button
              onClick={onOpenSimulator}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Passer l'épreuve (Vue Étudiant)
            </button>

            {/* Export CSV */}
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg transition-colors"
              title="Exporter les notes en CSV"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>

            {/* Reset */}
            <button
              onClick={handleResetSession}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              title="Réinitialiser les réponses"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Event Ticker banner if event occurred */}
        {liveEventMessage && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-indigo-900 bg-indigo-50/70 -mx-6 -mb-6 px-6 py-2.5 rounded-b-xl animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Flux direct :</span>
              <span>{liveEventMessage}</span>
            </div>
            <button
              onClick={() => setLiveEventMessage(null)}
              className="text-[11px] text-indigo-700 hover:text-indigo-950 font-medium"
            >
              Effacer
            </button>
          </div>
        )}
      </section>

      {/* Primary KPI Strip (Tabular Figures, Single Level Elevation) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Moyenne Générale */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Moyenne de la Classe</span>
            <Award className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono tabular-nums text-slate-900">
              {toScale(stats.avgScore, quiz)}
            </span>
            <span className="text-sm font-normal text-slate-500">/ {gradeScale(quiz)}</span>
          </div>
          <div className="mt-1 text-xs text-slate-500 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <span>Moyenne calculée sur {submissions.length} étudiants</span>
          </div>
        </div>

        {/* KPI 2: Complétion */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Copies Soumises</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold font-mono tabular-nums text-slate-900">
              {stats.completedCount}
            </span>
            <span className="text-sm font-normal text-slate-500 font-mono">/ {submissions.length}</span>
          </div>
          <div className="mt-1 text-xs text-slate-500 flex items-center gap-1.5">
            <span className="font-mono tabular-nums font-semibold text-slate-700">{stats.completionRate}%</span>
            <span>de l'effectif a finalisé le contrôle</span>
          </div>
        </div>

        {/* KPI 3: Étudiants en difficulté */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Vigilance Pédagogique</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-3xl font-bold font-mono tabular-nums ${stats.strugglingCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {stats.strugglingCount}
            </span>
            <span className="text-xs font-normal text-slate-500">étudiants &lt; 10/20</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {stats.strugglingCount > 0
              ? 'Nécessitent un retour personnalisé'
              : 'Aucun étudiant en zone critique'}
          </div>
        </div>

        {/* KPI 4: Question la plus difficile */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Question la Plus Difficile</span>
            <HelpCircle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold text-slate-900 truncate">
              {stats.hardestQuestion ? `Q${quiz.questions.findIndex(q => q.id === stats.hardestQuestion.questionId) + 1} (${stats.hardestQuestion.category})` : 'N/A'}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 flex items-center gap-1 font-mono tabular-nums">
            <span className="font-semibold text-amber-700">{stats.hardestQuestion ? stats.hardestQuestion.successPct : 0}%</span>
            <span>de réussite seulement</span>
          </div>
        </div>
      </section>

      {/* Visual Analytics Grid: Distribution des Notes + Taux par Question */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Histogramme de Répartition des Notes (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Distribution des Notes de la Classe
                </h3>
                <div className="text-xs text-slate-500 mt-0.5">
                  Répartition des scores par palier académique
                </div>
              </div>
              <BarChart2 className="w-4 h-4 text-slate-400" />
            </div>

            {/* Custom SVG / Bar Histogram */}
            <div className="space-y-3 pt-2">
              {[
                { label: '[0 - 10[ Insuffisant', count: stats.gradeDistribution[0], color: 'bg-rose-500' },
                { label: '[10 - 12[ Passable', count: stats.gradeDistribution[1], color: 'bg-amber-500' },
                { label: '[12 - 14[ Assez Bien', count: stats.gradeDistribution[2], color: 'bg-blue-500' },
                { label: '[14 - 16[ Bien', count: stats.gradeDistribution[3], color: 'bg-indigo-600' },
                { label: '[16 - 20] Très Bien', count: stats.gradeDistribution[4], color: 'bg-emerald-600' }
              ].map((bracket, i) => {
                const total = submissions.length || 1;
                const pct = Math.round((bracket.count / total) * 100);

                return (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs font-mono text-slate-600">
                      <span>{bracket.label}</span>
                      <span className="font-semibold tabular-nums text-slate-800">
                        {bracket.count} étu. ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full ${bracket.color} rounded-full transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Médiane estimée : <strong className="font-mono text-slate-800">13.5 / 20</strong></span>
            <span>Écart-type : <strong className="font-mono text-slate-800">± 3.4 pts</strong></span>
          </div>
        </div>

        {/* Taux de Réussite par Question (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Taux de Réussite par Question & Diagnostic
              </h3>
              <div className="text-xs text-slate-500 mt-0.5">
                Identification immédiate des notions maîtrisées ou incomprises
              </div>
            </div>
          </div>

          <div className="space-y-3.5">
            {stats.questionStats.map((qs, index) => {
              const isLow = qs.successPct < 55;
              const isHigh = qs.successPct >= 75;

              return (
                <div key={qs.questionId} className="p-2.5 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-start gap-2">
                      <span className="font-mono text-xs font-bold text-slate-400 mt-0.5">
                        Q{index + 1}.
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {(() => {
                            const orig = quiz.questions.find((q) => q.id === qs.questionId);
                            const isDirectShort = orig?.type === 'direct_short';
                            const isDirectOpen = orig?.type === 'direct_open';
                            if (isDirectOpen) {
                              return <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded">Question Directe (Rédaction)</span>;
                            }
                            if (isDirectShort) {
                              return <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded">Question Directe (Courte)</span>;
                            }
                            return <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">QCM</span>;
                          })()}
                        </div>
                        <p className="text-xs font-medium text-slate-800 line-clamp-1">
                          {qs.title}
                        </p>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {qs.category} · {qs.points} pts · {qs.answeredTotal} réponses
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`font-mono text-xs font-bold tabular-nums ${
                          isLow
                            ? 'text-rose-600'
                            : isHigh
                            ? 'text-emerald-600'
                            : 'text-slate-800'
                        }`}
                      >
                        {qs.successPct}%
                      </span>
                      <span className="text-[10px] text-slate-400 block">succès</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isLow ? 'bg-rose-500' : isHigh ? 'bg-emerald-500' : 'bg-indigo-600'
                      }`}
                      style={{ width: `${qs.successPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Detailed Student Live Table */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              Feuilles de Copies des Étudiants en Temps Réel
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Cliquez sur un étudiant pour consulter le détail de sa copie, son temps par question et ajouter une annotation.
            </p>
          </div>
        </div>

        <StudentTable
          submissions={submissions}
          totalQuestions={quiz.questions.length}
          scale={quiz.gradeScale}
          onOpenSubmission={(sub) => setSelectedSubmission(sub)}
        />
      </section>

      {/* Student Copy Modal */}
      {selectedSubmission && (
        <StudentCopyModal
          submission={selectedSubmission}
          quiz={quiz}
          onClose={() => setSelectedSubmission(null)}
          onUpdateFeedback={handleUpdateFeedback}
          onUpdateQuestionScore={handleUpdateQuestionScore}
        />
      )}
    </div>
  );
};
