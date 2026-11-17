import React, { useState } from 'react';
import { ClassStudent } from '../types/quiz';
import { Plus, Search, Mail, UserCheck, GraduationCap, Download } from 'lucide-react';

interface ClassRosterViewProps {
  students: ClassStudent[];
  onAddStudent: (newStudent: ClassStudent) => void;
}

export const ClassRosterView: React.FC<ClassRosterViewProps> = ({ students, onAddStudent }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [matricule, setMatricule] = useState(`ETU-2024-${Math.floor(100 + Math.random() * 900)}`);
  const [email, setEmail] = useState('');
  const [group, setGroup] = useState('L2 Info - Groupe A');
  const [historicalAverage, setHistoricalAverage] = useState(14.0);

  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.matricule.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.group.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const overallClassAvg = (
    students.reduce((sum, s) => sum + s.historicalAverage, 0) / (students.length || 1)
  ).toFixed(1);

  const handleSaveStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const initials = name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    const newStudent: ClassStudent = {
      id: `st-${Date.now()}`,
      name: name.trim(),
      matricule: matricule.trim(),
      avatar: initials || 'ET',
      email: email.trim() || `${name.toLowerCase().replace(/\s+/g, '.')}@univ-poly.edu`,
      group,
      historicalAverage
    };

    onAddStudent(newStudent);
    setName('');
    setEmail('');
    setIsAdding(false);
  };

  const handleExportRoster = () => {
    const headers = ['Matricule', 'Nom', 'Email', 'Groupe', 'Moyenne_Historique_Sur_20'];
    const rows = students.map((s) => [
      s.matricule,
      `"${s.name}"`,
      s.email,
      `"${s.group}"`,
      s.historicalAverage
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `evalis_promotion_roster.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Promotion & Registre Académique
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Gestion du groupe d'étudiants, suivi longitudinal des moyennes et coordonnées universitaires.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportRoster}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Exporter Registre
          </button>
          <button
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Ajouter un Étudiant
          </button>
        </div>
      </div>

      {/* Cohort KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <span className="text-xs font-medium text-slate-500 block">Effectif Total Inscrit</span>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
            {students.length} <span className="text-xs font-normal text-slate-500">étudiants</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">2 groupes de TD / TP</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <span className="text-xs font-medium text-slate-500 block">Moyenne Générale du Groupe</span>
          <div className="text-2xl font-bold font-mono text-indigo-700 mt-1 tabular-nums">
            {overallClassAvg} <span className="text-xs font-normal text-slate-500">/ 20</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Sur l'ensemble des contrôles du semestre</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <span className="text-xs font-medium text-slate-500 block">Taux d'Assiduité aux Interrogations</span>
          <div className="text-2xl font-bold font-mono text-emerald-700 mt-1 tabular-nums">
            96.8%
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Participation régulière aux tests</span>
        </div>
      </div>

      {/* Search and Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div className="relative max-w-sm w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher par nom, matricule ou groupe..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 text-slate-900 placeholder-slate-400"
            />
          </div>
          <span className="text-xs font-mono text-slate-500">
            {filtered.length} étudiants affichés
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Étudiant</th>
                <th className="py-3 px-3">Matricule</th>
                <th className="py-3 px-3">Groupe TD</th>
                <th className="py-3 px-3">Email Universitaire</th>
                <th className="py-3 px-4 text-right">Moyenne Semestre (/20)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0 font-mono">
                        {s.avatar}
                      </div>
                      <span className="font-semibold text-slate-900">{s.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-600 tabular-nums">
                    {s.matricule}
                  </td>
                  <td className="py-3 px-3 text-slate-700">
                    {s.group}
                  </td>
                  <td className="py-3 px-3 text-slate-500 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{s.email}</span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`font-mono font-bold text-xs tabular-nums ${
                        s.historicalAverage < 10
                          ? 'text-rose-600'
                          : s.historicalAverage >= 16
                          ? 'text-emerald-700'
                          : 'text-slate-900'
                      }`}
                    >
                      {s.historicalAverage.toFixed(1)}
                    </span>
                    <span className="text-[11px] text-slate-400 ml-1">/ 20</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Student Modal */}
      {isAdding && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-4 animate-in fade-in">
            <h3 className="text-base font-bold text-slate-900">
              Inscrire un Nouvel Étudiant
            </h3>

            <form onSubmit={handleSaveStudent} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Nom et Prénom *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Selma Bouzid"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Matricule
                </label>
                <input
                  type="text"
                  value={matricule}
                  onChange={(e) => setMatricule(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Email Universitaire
                </label>
                <input
                  type="email"
                  placeholder="nom.prenom@univ-poly.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Groupe TD / TP
                </label>
                <select
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                >
                  <option>L2 Info - Groupe A</option>
                  <option>L2 Info - Groupe B</option>
                  <option>L2 Info - Groupe C</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Note / Moyenne initiale (/20)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="20"
                  value={historicalAverage}
                  onChange={(e) => setHistoricalAverage(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-1.5 text-slate-600 hover:text-slate-800"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-xs"
                >
                  Inscrire l'étudiant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
