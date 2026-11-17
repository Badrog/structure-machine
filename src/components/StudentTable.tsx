import React, { useState, useMemo } from 'react';
import { StudentSubmission, StudentStatus } from '../types/quiz';
import { toScale, gradeScale } from '../utils/grade';

import { Search, Eye, Clock, CheckCircle2, AlertCircle, PauseCircle, HelpCircle } from 'lucide-react';

interface StudentTableProps {
  submissions: StudentSubmission[];
  totalQuestions: number;
  scale?: number;
  onOpenSubmission: (submission: StudentSubmission) => void;
  onHelpStudent?: (studentName: string) => void;
}

export const StudentTable: React.FC<StudentTableProps> = ({
  submissions,
  totalQuestions,
  scale,
  onOpenSubmission,
  onHelpStudent
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'active' | 'struggling'>('all');
  const [sortBy, setSortBy] = useState<'score' | 'name' | 'progress' | 'time'>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      const matchSearch =
        sub.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.matricule.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchSearch) return false;

      if (statusFilter === 'all') return true;
      if (statusFilter === 'completed') return sub.status === 'completed';
      if (statusFilter === 'active') return sub.status === 'active';
      if (statusFilter === 'struggling') return sub.scoreOutOf20 < 10 || sub.status === 'needs_help';

      return true;
    }).sort((a, b) => {
      let comp = 0;
      if (sortBy === 'score') comp = a.scoreOutOf20 - b.scoreOutOf20;
      else if (sortBy === 'name') comp = a.studentName.localeCompare(b.studentName);
      else if (sortBy === 'progress') comp = Object.keys(a.answers).length - Object.keys(b.answers).length;
      else if (sortBy === 'time') comp = a.timeSpentSeconds - b.timeSpentSeconds;

      return sortOrder === 'desc' ? -comp : comp;
    });
  }, [submissions, searchTerm, statusFilter, sortBy, sortOrder]);

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const renderStatus = (status: StudentStatus, score: number) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Terminé
          </span>
        );
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700">
            <Clock className="w-3.5 h-3.5 text-blue-500 animate-spin" style={{ animationDuration: '6s' }} />
            En cours
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <PauseCircle className="w-3.5 h-3.5 text-slate-400" />
            En pause
          </span>
        );
      case 'needs_help':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 font-semibold">
            <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
            Alerte / Difficulté
          </span>
        );
      default:
        return <span className="text-xs text-slate-500">Inscrit</span>;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
      {/* Search & Filter Bar */}
      <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/70">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par nom ou matricule..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-900 placeholder-slate-400"
          />
        </div>

        {/* Functional segmented filter tabs (buttons allowed per frontend-design constitution) */}
        <div className="flex items-center gap-1 p-1 bg-slate-200/80 rounded-lg shrink-0">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              statusFilter === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tous ({submissions.length})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              statusFilter === 'active'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            En cours ({submissions.filter((s) => s.status === 'active').length})
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              statusFilter === 'completed'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Terminés ({submissions.filter((s) => s.status === 'completed').length})
          </button>
          <button
            onClick={() => setStatusFilter('struggling')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              statusFilter === 'struggling'
                ? 'bg-white text-rose-700 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Difficulté &lt; 10/20 ({submissions.filter((s) => s.scoreOutOf20 < 10 || s.status === 'needs_help').length})
          </button>
        </div>
      </div>

      {/* High Density Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <th
                onClick={() => {
                  if (sortBy === 'name') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  else { setSortBy('name'); setSortOrder('asc'); }
                }}
                className="py-3 px-4 cursor-pointer hover:text-slate-900"
              >
                Étudiant {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="py-3 px-3">Statut en direct</th>
              <th
                onClick={() => {
                  if (sortBy === 'progress') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  else { setSortBy('progress'); setSortOrder('desc'); }
                }}
                className="py-3 px-3 cursor-pointer hover:text-slate-900"
              >
                Progression {sortBy === 'progress' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th
                onClick={() => {
                  if (sortBy === 'time') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  else { setSortBy('time'); setSortOrder('desc'); }
                }}
                className="py-3 px-3 cursor-pointer hover:text-slate-900"
              >
                Temps Passé {sortBy === 'time' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th
                onClick={() => {
                  if (sortBy === 'score') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  else { setSortBy('score'); setSortOrder('desc'); }
                }}
                className="py-3 px-4 text-right cursor-pointer hover:text-slate-900"
              >
                Note Actuelle (/{scale || 20}) {sortBy === 'score' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredSubmissions.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">
                  Aucun étudiant ne correspond aux critères de filtre.
                </td>
              </tr>
            ) : (
              filteredSubmissions.map((sub) => {
                const answeredCount = Object.keys(sub.answers).length;
                const progressPct = Math.round((answeredCount / totalQuestions) * 100);
                const isUnder10 = sub.scoreOutOf20 < 10;

                return (
                  <tr
                    key={sub.id}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    {/* Student Info */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0 font-mono">
                          {sub.studentAvatar}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 text-xs">
                            {sub.studentName}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {sub.matricule}
                          </div>
                          {(sub.violations?.length || 0) > 0 && (
                            <div
                              className="text-[11px] font-semibold text-rose-700 mt-0.5"
                              title={sub.violations!.map((v) => `${v.at} · ${v.type === 'screenshot' ? 'capture' : v.type === 'print' ? 'impression' : 'sortie de fenêtre'}`).join('\n')}
                            >
                              ⚠ {sub.violations!.length} sortie(s) de fenêtre
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3">
                      {renderStatus(sub.status, sub.scoreOutOf20)}
                    </td>

                    {/* Progression */}
                    <td className="py-3 px-3">
                      <div className="w-36 space-y-1">
                        <div className="flex justify-between text-[11px] font-mono text-slate-500 tabular-nums">
                          <span>{answeredCount} / {totalQuestions} q.</span>
                          <span>{progressPct}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              sub.status === 'completed'
                                ? 'bg-emerald-500'
                                : sub.status === 'needs_help'
                                ? 'bg-amber-500'
                                : 'bg-indigo-600'
                            }`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Time */}
                    <td className="py-3 px-3 font-mono text-slate-600 tabular-nums">
                      {formatSeconds(sub.timeSpentSeconds)}
                    </td>

                    {/* Score */}
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`font-mono text-sm font-bold tabular-nums ${
                          isUnder10 ? 'text-rose-600' : 'text-slate-900'
                        }`}
                      >
                        {toScale(sub.scoreOutOf20, { gradeScale: scale })}
                      </span>
                      <span className="text-[11px] font-normal text-slate-400 ml-1">/ {scale || 20}</span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => onOpenSubmission(sub)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-indigo-600 bg-white hover:bg-indigo-50 border border-slate-200 rounded-md transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Consulter copie
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Summary Footer */}
      <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span>Affichage de <strong className="text-slate-800 font-mono tabular-nums">{filteredSubmissions.length}</strong> étudiants</span>
          <span aria-hidden="true">·</span>
          <span>Données actualisées en direct</span>
        </div>
        <div className="text-[11px] text-slate-400">
          Cliquez sur les en-têtes de colonnes pour trier par score, nom ou temps.
        </div>
      </div>
    </div>
  );
};
