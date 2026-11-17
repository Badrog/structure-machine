import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Quiz, StudentSubmission, ClassStudent } from './types/quiz';
import { INITIAL_QUIZZES } from './data/mockQuizzes';
import { Navbar, UserRole } from './components/Navbar';
import { LiveDashboard } from './components/LiveDashboard';
import { QuizBuilder } from './components/QuizBuilder';
import { QuizzesListView } from './components/QuizzesListView';
import { ClassRosterView } from './components/ClassRosterView';
import { StudentPortal } from './components/StudentPortal';
import { TeacherLogin } from './components/TeacherLogin';
import { teacherApi, setUnauthorizedHandler } from './services/api';

// Lien spécial du professeur : https://votre-site.vercel.app/#/enseignant
// Pour le personnaliser, définir VITE_TEACHER_ROUTE (ex: "prof-x7k2q9") dans Vercel.
const TEACHER_ROUTE = (import.meta as any).env?.VITE_TEACHER_ROUTE || 'enseignant';
const isTeacherHash = () => window.location.hash === `#/${TEACHER_ROUTE}`;
const POLL_MS = 4000;

export default function App() {
  // Accès professeur : uniquement via le lien spécial (+ mot de passe vérifié par le serveur)
  const [hasTeacherAccess, setHasTeacherAccess] = useState<boolean>(isTeacherHash);
  const [teacherAuthed, setTeacherAuthed] = useState<boolean>(() => teacherApi.hasToken());

  // Par défaut, l'espace ÉTUDIANT s'affiche
  const [currentRole, setCurrentRole] = useState<UserRole>(() => (isTeacherHash() ? 'teacher' : 'student'));

  const [teacherTab, setTeacherTab] = useState<'dashboard' | 'quizzes' | 'create' | 'roster'>('dashboard');

  // Données serveur (enseignant)
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  activeIdRef.current = activeQuizId;

  const activeQuiz = quizzes.find((q) => q.id === activeQuizId) || quizzes[0];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };
  const showError = (e: unknown) => showToast((e as Error).message || 'Erreur');

  useEffect(() => {
    const onHashChange = () => {
      if (isTeacherHash()) {
        setHasTeacherAccess(true);
        setCurrentRole('teacher');
      } else {
        setHasTeacherAccess(false);
        setCurrentRole('student');
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setTeacherAuthed(false));
    return () => setUnauthorizedHandler(null);
  }, []);

  const refresh = useCallback(async (quizId?: string | null) => {
    const st = await teacherApi.state(quizId ?? activeIdRef.current);
    setQuizzes(st.quizzes);
    setStudents(st.students);
    setSubmissions(st.submissions);
    setActiveQuizId((prev) => (prev && st.quizzes.some((q) => q.id === prev) ? prev : st.activeQuizId));
    setLoaded(true);
  }, []);

  // Suivi en direct : interrogation du serveur toutes les 4 s (onglet visible uniquement)
  const teacherActive = hasTeacherAccess && teacherAuthed && currentRole === 'teacher';
  useEffect(() => {
    if (!teacherActive) return;
    let stopped = false;
    const tick = () => {
      if (stopped || document.hidden) return;
      refresh().catch((e) => { if ((e as any).status !== 401) console.warn(e); });
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    const onVis = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { stopped = true; clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [teacherActive, refresh]);

  const handleSaveNewQuiz = async (newQuiz: Quiz) => {
    try {
      const { quiz } = await teacherApi.createQuiz(newQuiz);
      setActiveQuizId(quiz.id);
      await refresh(quiz.id);
      setTeacherTab('dashboard');
      showToast(`Épreuve "${quiz.title}" créée — PIN ${quiz.pinCode}`);
    } catch (e) { showError(e); }
  };

  const handleSelectActiveQuiz = async (quizId: string) => {
    setActiveQuizId(quizId);
    setSubmissions([]);
    setTeacherTab('dashboard');
    try { await refresh(quizId); } catch (e) { showError(e); }
  };

  const handleDuplicateQuiz = async (quizToDup: Quiz) => {
    try {
      const { quiz } = await teacherApi.createQuiz({
        ...quizToDup,
        title: `${quizToDup.title} (Copie)`,
        pinCode: `#EVAL-${Math.floor(1000 + Math.random() * 9000)}`,
        status: 'draft',
      });
      await refresh();
      showToast(`Interrogation dupliquée (PIN: ${quiz.pinCode})`);
    } catch (e) { showError(e); }
  };

  const handleDeleteQuiz = async (quizId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette interrogation et toutes ses copies ?')) return;
    try {
      await teacherApi.deleteQuiz(quizId);
      if (activeQuizId === quizId) setActiveQuizId(null);
      await refresh(activeQuizId === quizId ? null : activeQuizId);
      showToast('Interrogation supprimée.');
    } catch (e) { showError(e); }
  };

  const handleSetQuizStatus = async (quizId: string, status: Quiz['status'], showCorrection?: boolean) => {
    try {
      await teacherApi.updateQuiz(quizId, { status, ...(showCorrection !== undefined ? { showCorrection } : {}) });
      await refresh();
      showToast(status === 'active' ? 'Interrogation ouverte aux étudiants.' : status === 'completed' ? 'Interrogation clôturée : le corrigé est visible.' : 'Interrogation repassée en brouillon.');
    } catch (e) { showError(e); }
  };

  const handleUpdateFeedback = async (submissionId: string, feedback: string) => {
    try { await teacherApi.setFeedback(submissionId, feedback); await refresh(); } catch (e) { showError(e); }
  };

  const handleUpdateQuestionScore = async (submissionId: string, questionId: string, score: number, comment?: string) => {
    try { await teacherApi.gradeAnswer(submissionId, questionId, score, comment); await refresh(); } catch (e) { showError(e); }
  };

  const handleResetSession = async () => {
    if (!activeQuiz) return;
    try { await teacherApi.resetQuiz(activeQuiz.id); await refresh(); showToast('Session réinitialisée.'); } catch (e) { showError(e); }
  };

  const handleCreateDemo = async () => {
    try {
      const demo = INITIAL_QUIZZES[0];
      const { quiz } = await teacherApi.createQuiz({ ...demo, id: undefined as any });
      setActiveQuizId(quiz.id);
      await refresh(quiz.id);
      showToast(`Exemple créé — PIN ${quiz.pinCode}`);
    } catch (e) { showError(e); }
  };

  /** Crée 3 interrogations (une par groupe) à partir d'un fichier JSON choisi par l'enseignant (les variantes ne sont jamais publiées avec le site). */
  const handleImportInterro = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as any;
      if (!data?.meta || !Array.isArray(data?.variants) || !data.variants.length) throw new Error('Fichier invalide : il faut un JSON avec « meta » et « variants ».');
      let last: Quiz | undefined;
      for (const g of [1, 2, 3]) {
        const { quiz } = await teacherApi.createQuiz({
          ...data.meta,
          title: `${data.meta.title} — Groupe ${g}`,
          classGroup: `Groupe ${g}`,
          pinCode: `#SM1-G${g}`,
          status: 'active',
          showCorrection: false,
          gradeScale: 4,
          variants: data.variants,
        } as any);
        last = quiz;
      }
      if (last) setActiveQuizId(last.id);
      await refresh(last?.id);
      showToast('3 interrogations créées : PIN #SM1-G1, #SM1-G2, #SM1-G3 (30 variantes chacune)');
    } catch (e) { showError(e); }
  };

  const handleAddStudentToRoster = async (newStudent: ClassStudent) => {
    try {
      await teacherApi.addStudent(newStudent);
      await refresh();
      showToast(`Étudiant ${newStudent.name} inscrit dans la promotion.`);
    } catch (e) { showError(e); }
  };

  const handleTeacherLogout = () => {
    teacherApi.logout();
    setTeacherAuthed(false);
    setLoaded(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Navbar
        currentRole={currentRole}
        onSwitchRole={setCurrentRole}
        teacherTab={teacherTab}
        onSelectTeacherTab={setTeacherTab}
        onNewQuiz={() => {
          setCurrentRole('teacher');
          setTeacherTab('create');
        }}
        canSwitchRole={hasTeacherAccess}
        isLiveActive={Boolean(activeQuiz)}
        pinCode={activeQuiz?.pinCode || '—'}
        onTeacherLogout={hasTeacherAccess && teacherAuthed ? handleTeacherLogout : undefined}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-16">
        {/* ESPACE PROFESSEUR : lien spécial + mot de passe */}
        {hasTeacherAccess && currentRole === 'teacher' && !teacherAuthed && (
          <TeacherLogin onLoggedIn={() => setTeacherAuthed(true)} />
        )}

        {hasTeacherAccess && currentRole === 'teacher' && teacherAuthed && !loaded && (
          <div className="py-24 text-center text-sm text-slate-500">Chargement…</div>
        )}

        {hasTeacherAccess && currentRole === 'teacher' && teacherAuthed && loaded && (
          <>
            {teacherTab === 'dashboard' && activeQuiz && (
              <LiveDashboard
                quiz={activeQuiz}
                quizzes={quizzes}
                onSelectQuiz={handleSelectActiveQuiz}
                submissions={submissions}
                onUpdateFeedback={handleUpdateFeedback}
                onUpdateQuestionScore={handleUpdateQuestionScore}
                onResetSession={handleResetSession}
                onSetStatus={(status) => handleSetQuizStatus(activeQuiz.id, status)}
                onOpenCreate={() => setTeacherTab('create')}
                onOpenSimulator={() => setCurrentRole('student')}
              />
            )}

            {teacherTab === 'dashboard' && !activeQuiz && (
              <div className="max-w-xl mx-auto py-16 text-center space-y-5">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Aucune interrogation pour le moment</h1>
                <p className="text-sm text-slate-500">Créez votre première épreuve, ou chargez l'exemple d'Algorithmique pour tester la plateforme.</p>
                <div className="flex items-center justify-center gap-3">
                  <button onClick={() => setTeacherTab('create')} className="px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">
                    Concevoir une épreuve
                  </button>
                  <input
                    ref={importFileRef}
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) handleImportInterro(f);
                    }}
                  />
                  <button onClick={() => importFileRef.current?.click()} className="px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg">
                    Importer un fichier d'interrogation (JSON)
                  </button>
                  <button onClick={handleCreateDemo} className="px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg">
                    Charger l'exemple
                  </button>
                </div>
              </div>
            )}

            {teacherTab === 'quizzes' && (
              <QuizzesListView
                quizzes={quizzes}
                activeQuizId={activeQuizId ?? ''}
                onSelectActiveQuiz={handleSelectActiveQuiz}
                onOpenCreate={() => setTeacherTab('create')}
                onImportInterro={handleImportInterro}
                onDeleteQuiz={handleDeleteQuiz}
                onDuplicateQuiz={handleDuplicateQuiz}
                onSetStatus={handleSetQuizStatus}
                onTestStudentView={() => setCurrentRole('student')}
              />
            )}

            {teacherTab === 'create' && (
              <QuizBuilder onSaveQuiz={handleSaveNewQuiz} onCancel={() => setTeacherTab('dashboard')} />
            )}

            {teacherTab === 'roster' && (
              <ClassRosterView students={students} onAddStudent={handleAddStudentToRoster} />
            )}
          </>
        )}

        {/* ESPACE ÉTUDIANT (par défaut) */}
        {currentRole === 'student' && (
          <StudentPortal
            canSwitchToTeacher={hasTeacherAccess}
            onSwitchToTeacher={() => setCurrentRole('teacher')}
          />
        )}
      </main>

      {/* Subtle Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-lg shadow-xl border border-slate-700 animate-in fade-in slide-in-from-bottom-2 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Quiet Footer adhering to Anti-Slop Guidelines */}
      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            <strong className="text-slate-800">Evalis</strong> · Plateforme d'évaluation universitaire & suivi en temps réel
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>
              {currentRole === 'teacher' ? 'Espace Enseignant Actif' : 'Portail Étudiant Actif'}
            </span>
            <span aria-hidden="true">·</span>
            <span>Système conforme LMD</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
