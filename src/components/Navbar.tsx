import React from 'react';

export type UserRole = 'teacher' | 'student';

interface NavbarProps {
  currentRole: UserRole;
  onSwitchRole: (role: UserRole) => void;
  // Teacher navigation tabs
  teacherTab: 'dashboard' | 'quizzes' | 'create' | 'roster';
  onSelectTeacherTab: (tab: 'dashboard' | 'quizzes' | 'create' | 'roster') => void;
  onNewQuiz: () => void;
  isLiveActive: boolean;
  pinCode: string;
  canSwitchRole: boolean;
  onTeacherLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  onSwitchRole,
  teacherTab,
  onSelectTeacherTab,
  onNewQuiz,
  isLiveActive,
  pinCode,
  canSwitchRole,
  onTeacherLogout
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand title, single-line text element */}
        <button
          onClick={() => {
            if (currentRole === 'teacher') onSelectTeacherTab('dashboard');
          }}
          className="text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:text-indigo-600 transition-colors text-left flex items-center gap-2"
        >
          Evalis
        </button>

        {/* Zone 2: Navigation Links depending on Active Role */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          {currentRole === 'teacher' ? (
            <>
              <button
                onClick={() => onSelectTeacherTab('dashboard')}
                className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
                  teacherTab === 'dashboard'
                    ? 'text-indigo-600 font-semibold border-b-2 border-indigo-600'
                    : 'hover:text-slate-900'
                }`}
              >
                Tableau de Bord
              </button>
              <button
                onClick={() => onSelectTeacherTab('quizzes')}
                className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
                  teacherTab === 'quizzes'
                    ? 'text-indigo-600 font-semibold border-b-2 border-indigo-600'
                    : 'hover:text-slate-900'
                }`}
              >
                Mes Interrogations
              </button>
              <button
                onClick={() => onSelectTeacherTab('create')}
                className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
                  teacherTab === 'create'
                    ? 'text-indigo-600 font-semibold border-b-2 border-indigo-600'
                    : 'hover:text-slate-900'
                }`}
              >
                Concevoir une Épreuve
              </button>
              <button
                onClick={() => onSelectTeacherTab('roster')}
                className={`whitespace-nowrap shrink-0 transition-colors py-1 ${
                  teacherTab === 'roster'
                    ? 'text-indigo-600 font-semibold border-b-2 border-indigo-600'
                    : 'hover:text-slate-900'
                }`}
              >
                Promotion & Notes
              </button>
            </>
          ) : (
            <>
              <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md">
                Espace Étudiant Isolé
              </span>
              {canSwitchRole && (
                <span className="text-xs text-slate-500">
                  Code Session Enseignant : <strong className="font-mono text-slate-800">{pinCode}</strong>
                </span>
              )}
            </>
          )}
        </nav>

        {/* Zone 3: Primary Action & Role Switcher */}
        <div className="flex items-center gap-3 shrink-0">
          {currentRole === 'teacher' ? (
            <>
              <button
                onClick={onNewQuiz}
                className="hidden sm:inline-flex px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-xs whitespace-nowrap shrink-0"
              >
                + Nouvelle Épreuve
              </button>
              <button
                onClick={() => onSwitchRole('student')}
                className="px-3.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Basculer sur l'Espace Étudiant →
              </button>
              {onTeacherLogout && (
                <button
                  onClick={onTeacherLogout}
                  className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-rose-700 transition-colors whitespace-nowrap shrink-0"
                >
                  Déconnexion
                </button>
              )}
            </>
          ) : canSwitchRole ? (
            <button
              onClick={() => onSwitchRole('teacher')}
              className="px-4 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              ← Revenir au Tableau de Bord Professeur
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
};
