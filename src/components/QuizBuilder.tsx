import React, { useState } from 'react';
import { Quiz, Question, QuestionType, QuestionOption } from '../types/quiz';
import { generateQuestionsWithAI } from '../services/aiQuizGenerator';
import { Plus, Trash2, Sparkles, Check, ArrowUp, ArrowDown, Save, Edit3, AlignLeft, CheckSquare } from 'lucide-react';

interface QuizBuilderProps {
  onSaveQuiz: (newQuiz: Quiz) => void;
  onCancel: () => void;
}

export const QuizBuilder: React.FC<QuizBuilderProps> = ({ onSaveQuiz, onCancel }) => {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [level, setLevel] = useState('Licence 2 (L2)');
  const [classGroup, setClassGroup] = useState('Section Principale');
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [lockOnLeave, setLockOnLeave] = useState(true);
  const [lockMinutes, setLockMinutes] = useState(5);
  const [pinCode, setPinCode] = useState(() => `#EVAL-${Math.floor(100 + Math.random() * 900)}`);
  const [instructions, setInstructions] = useState('Calculatrice interdite. Précisez vos démarches et justifiez rigoureusement vos réponses directes.');

  // AI Assistant States
  const [aiTopic, setAiTopic] = useState('');
  const [aiCount, setAiCount] = useState(3);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  // Initial Questions list featuring both Direct Questions and QCM
  const [questions, setQuestions] = useState<Question[]>([
    {
      id: `q-${Date.now()}-1`,
      title: 'Donnez la complexité asymptotique exacte dans le pire des cas de l\'algorithme de recherche binaire (dichotomique) sur un tableau ordonné de taille n.',
      type: 'direct_short',
      points: 4,
      correctAnswerText: 'O(log n)',
      acceptedKeywords: ['O(log n)', 'O(log(n))', 'logarithmique', 'log n'],
      placeholder: 'Ex: O(log n), O(n)...',
      category: 'Complexité',
      explanation: 'À chaque étape, l\'espace de recherche est divisé par deux : n, n/2, n/4... jusqu\'à 1, d\'où une hauteur d\'arbre égale à ⌊log₂ n⌋ + 1.'
    },
    {
      id: `q-${Date.now()}-2`,
      title: 'Démontrez pourquoi un arbre binaire de recherche (ABR) non équilibré peut avoir une complexité de recherche en O(n), et donnez une méthode d\'auto-équilibrage.',
      type: 'direct_open',
      points: 5,
      correctAnswerText: 'Si les éléments sont insérés dans un ordre déjà trié (ou inversement trié), l\'arbre dégénère en une liste simplement chaînée linéaire de hauteur n. Les arbres AVL ou Rouge-Noir appliquent des rotations (gauche/droite) pour garantir une hauteur en O(log n).',
      acceptedKeywords: ['dégénère', 'liste chaînée', 'trié', 'rotations', 'AVL', 'rouge-noir', 'hauteur'],
      gradingCriteria: '3 pts pour l\'explication de la dégénérescence linéaire + 2 pts pour les rotations ou mention d\'arbres AVL / Rouge-Noir.',
      placeholder: 'Rédigez votre démonstration analytique...',
      category: 'Arbres',
      explanation: 'Dans le pire des cas, chaque nœud n\'a qu\'un seul fils, créant une structure filiforme dégénérée.'
    },
    {
      id: `q-${Date.now()}-3`,
      title: 'Quelle est la complexité spatiale auxiliaire de la version standard récursive du tri fusion (MergeSort) ?',
      type: 'single_choice',
      points: 3,
      category: 'Tris',
      explanation: 'La fusion nécessite un tableau temporaire auxiliaire de taille n pour réordonner les éléments.',
      options: [
        { id: 'opt-3-a', text: 'O(1) en place', isCorrect: false },
        { id: 'opt-3-b', text: 'O(n) pour la fusion des sous-tableaux', isCorrect: true },
        { id: 'opt-3-c', text: 'O(log n)', isCorrect: false },
        { id: 'opt-3-d', text: 'O(n²)', isCorrect: false }
      ]
    }
  ]);

  const totalPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);

  const handleAddQuestion = (type: QuestionType) => {
    let newQ: Question;

    if (type === 'direct_short') {
      newQ = {
        id: `q-${Date.now()}-${questions.length + 1}`,
        title: '',
        type: 'direct_short',
        points: 4,
        correctAnswerText: '',
        acceptedKeywords: [],
        placeholder: 'Saisissez la valeur, formule ou notation exacte attendue...',
        category: subject || 'Théorie',
        explanation: ''
      };
    } else if (type === 'direct_open') {
      newQ = {
        id: `q-${Date.now()}-${questions.length + 1}`,
        title: '',
        type: 'direct_open',
        points: 5,
        correctAnswerText: '',
        acceptedKeywords: [],
        gradingCriteria: 'Points attribués selon la rigueur de l\'explication et les arguments clés.',
        placeholder: 'Rédigez ici les consignes pour la démonstration ou l\'explication...',
        category: subject || 'Développement',
        explanation: ''
      };
    } else if (type === 'true_false') {
      newQ = {
        id: `q-${Date.now()}-${questions.length + 1}`,
        title: '',
        type: 'true_false',
        points: 3,
        category: subject || 'Cours',
        explanation: '',
        options: [
          { id: `opt-${Date.now()}-1`, text: 'Vrai', isCorrect: true },
          { id: `opt-${Date.now()}-2`, text: 'Faux', isCorrect: false }
        ]
      };
    } else {
      newQ = {
        id: `q-${Date.now()}-${questions.length + 1}`,
        title: '',
        type,
        points: 4,
        category: subject || 'Cours',
        explanation: '',
        options: [
          { id: `opt-${Date.now()}-1`, text: 'Option A (Correcte)', isCorrect: true },
          { id: `opt-${Date.now()}-2`, text: 'Option B', isCorrect: false },
          { id: `opt-${Date.now()}-3`, text: 'Option C', isCorrect: false },
          { id: `opt-${Date.now()}-4`, text: 'Option D', isCorrect: false }
        ]
      };
    }

    setQuestions([...questions, newQ]);
  };

  const handleDeleteQuestion = (index: number) => {
    if (questions.length <= 1) {
      alert('Une interrogation doit comporter au moins une question.');
      return;
    }
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleUpdateQuestion = (index: number, updated: Partial<Question>) => {
    setQuestions(
      questions.map((q, i) => (i === index ? { ...q, ...updated } : q))
    );
  };

  const handleUpdateOption = (qIndex: number, optIndex: number, text: string) => {
    const q = questions[qIndex];
    if (!q.options) return;
    const newOptions = q.options.map((opt, i) => (i === optIndex ? { ...opt, text } : opt));
    handleUpdateQuestion(qIndex, { options: newOptions });
  };

  const handleToggleCorrectOption = (qIndex: number, optIndex: number) => {
    const q = questions[qIndex];
    if (!q.options) return;
    if (q.type === 'single_choice' || q.type === 'true_false') {
      const newOptions = q.options.map((opt, i) => ({
        ...opt,
        isCorrect: i === optIndex
      }));
      handleUpdateQuestion(qIndex, { options: newOptions });
    } else {
      const newOptions = q.options.map((opt, i) =>
        i === optIndex ? { ...opt, isCorrect: !opt.isCorrect } : opt
      );
      handleUpdateQuestion(qIndex, { options: newOptions });
    }
  };

  const handleAddOption = (qIndex: number) => {
    const q = questions[qIndex];
    if (!q.options) return;
    const newOpt: QuestionOption = {
      id: `opt-${Date.now()}-${q.options.length + 1}`,
      text: `Option ${String.fromCharCode(65 + q.options.length)}`,
      isCorrect: false
    };
    handleUpdateQuestion(qIndex, { options: [...q.options, newOpt] });
  };

  const handleDeleteOption = (qIndex: number, optIndex: number) => {
    const q = questions[qIndex];
    if (!q.options || q.options.length <= 2) return;
    handleUpdateQuestion(qIndex, {
      options: q.options.filter((_, i) => i !== optIndex)
    });
  };

  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === questions.length - 1) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const updated = [...questions];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setQuestions(updated);
  };

  // AI Generation
  const handleGenerateAI = async () => {
    if (!aiTopic.trim()) {
      alert('Veuillez spécifier un sujet de cours (ex: Récursivité, Dynamique newtonienne, ADN).');
      return;
    }

    setIsGeneratingAI(true);
    setAiNotice(null);

    try {
      const generated = await generateQuestionsWithAI({
        topic: aiTopic,
        level,
        questionCount: aiCount
      });

      if (generated && generated.length > 0) {
        setQuestions((prev) => [...prev, ...generated]);
        setAiNotice(`${generated.length} questions générées et intégrées à l'épreuve !`);
        setAiTopic('');
      }
    } catch (err) {
      console.error(err);
      setAiNotice('Erreur lors de la génération. Veuillez réessayer.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSave = () => {
    if (!title.trim()) {
      alert("Veuillez renseigner un titre pour l'interrogation.");
      return;
    }
    if (!subject.trim()) {
      alert('Veuillez renseigner une matière ou discipline.');
      return;
    }

    const newQuiz: Quiz = {
      id: `quiz-${Date.now()}`,
      title: title.trim(),
      subject: subject.trim(),
      level,
      classGroup,
      durationMinutes,
      totalPoints,
      pinCode,
      createdAt: new Date().toISOString().split('T')[0],
      questions,
      status: 'active',
      instructions,
      lockOnLeave,
      lockMinutes
    };

    onSaveQuiz(newQuiz);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Concevoir une Interrogation (Questions Directes & QCM)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Formulez des questions directes avec réponses courtes ou rédigées, ou des QCM avec barème détaillé.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-xs"
          >
            <Save className="w-4 h-4" />
            Enregistrer & Lancer l'Épreuve
          </button>
        </div>
      </div>

      {/* General Settings Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-[11px]">
          Informations Générales & Paramètres
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Titre de l'Interrogation *
            </label>
            <input
              type="text"
              placeholder="Ex: Contrôle Continu 2 : Arbres & Complexité"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-900"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Matière / Discipline *
            </label>
            <input
              type="text"
              placeholder="Ex: Informatique, Physique, Mathématiques, Biologie..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-900"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Niveau d'Études
            </label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-900"
            >
              <option>Licence 1 (L1)</option>
              <option>Licence 2 (L2)</option>
              <option>Licence 3 (L3)</option>
              <option>Master 1 (M1)</option>
              <option>Master 2 (M2)</option>
              <option>Classes Préparatoires</option>
              <option>IUT / BTS</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Groupe / Promotion
            </label>
            <input
              type="text"
              placeholder="Ex: L2 Info - Groupe A, Promotion 2026..."
              value={classGroup}
              onChange={(e) => setClassGroup(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-900"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Durée Limite (minutes)
            </label>
            <input
              type="number"
              min={5}
              max={180}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Code PIN d'Accès Étudiant
            </label>
            <input
              type="text"
              value={pinCode}
              onChange={(e) => setPinCode(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-indigo-700"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block font-medium text-slate-700 mb-1">
              Consignes Officielles pour l'Étudiant
            </label>
            <input
              type="text"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Ex: Justifiez toutes vos réponses rédigées. Calculatrice interdite."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
            />
          </div>

          <div className="md:col-span-2 p-3 bg-rose-50/50 border border-rose-100 rounded-lg flex flex-wrap items-center gap-x-6 gap-y-2">
            <label className="flex items-center gap-2 font-medium text-slate-700">
              <input type="checkbox" checked={lockOnLeave} onChange={(e) => setLockOnLeave(e.target.checked)} />
              Anti-triche : masquer et bloquer l'épreuve si l'étudiant quitte la fenêtre ou fait une capture d'écran
            </label>
            {lockOnLeave && (
              <label className="flex items-center gap-2 text-slate-600">
                Durée du blocage
                <input
                  type="number" min={1} max={60} value={lockMinutes}
                  onChange={(e) => setLockMinutes(Number(e.target.value))}
                  className="w-16 px-2 py-1 bg-white border border-slate-200 rounded font-mono"
                /> min
              </label>
            )}
          </div>
        </div>

        {/* Total Points summary */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
          <span>Total : <strong className="font-mono text-slate-900">{questions.length} questions</strong></span>
          <span>Barème cumulé : <strong className="font-mono text-indigo-700 text-sm">{totalPoints} points</strong></span>
        </div>
      </div>

      {/* AI Assistant Generator */}
      <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
              Assistant IA : Générateur de Questions Directes & QCM
            </h3>
          </div>
        </div>

        <p className="text-xs text-indigo-900">
          Indiquez un thème académique pour générer automatiquement des questions adaptées au niveau avec corrigé et barème.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-2 text-xs">
          <input
            type="text"
            placeholder="Ex: Algorithmes de graphes, Deuxième loi de Newton, Épissage de l'ADN..."
            value={aiTopic}
            onChange={(e) => setAiTopic(e.target.value)}
            className="flex-1 px-3 py-2 bg-white border border-indigo-200 rounded-lg text-slate-900"
          />
          <select
            value={aiCount}
            onChange={(e) => setAiCount(Number(e.target.value))}
            className="px-3 py-2 bg-white border border-indigo-200 rounded-lg text-slate-800"
          >
            <option value={2}>2 questions</option>
            <option value={3}>3 questions</option>
            <option value={4}>4 questions</option>
          </select>
          <button
            onClick={handleGenerateAI}
            disabled={isGeneratingAI}
            className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            {isGeneratingAI ? 'Génération en cours...' : 'Générer avec l\'IA'}
          </button>
        </div>

        {aiNotice && (
          <div className="text-xs text-indigo-800 font-medium bg-white/80 px-3 py-1.5 rounded-md border border-indigo-200">
            {aiNotice}
          </div>
        )}
      </div>

      {/* Questions List */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            Questions de l'Épreuve ({questions.length})
          </h2>

          {/* Quick Add Buttons for DIRECT QUESTIONS and QCM */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleAddQuestion('direct_short')}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              + Question Directe (Courte)
            </button>
            <button
              onClick={() => handleAddQuestion('direct_open')}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
            >
              <AlignLeft className="w-3.5 h-3.5" />
              + Question Directe (Rédaction)
            </button>
            <button
              onClick={() => handleAddQuestion('single_choice')}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              + QCM
            </button>
          </div>
        </div>

        {questions.map((q, qIndex) => {
          const isDirectShort = q.type === 'direct_short';
          const isDirectOpen = q.type === 'direct_open';
          const isDirect = isDirectShort || isDirectOpen;

          return (
            <div
              key={q.id}
              className={`bg-white rounded-xl border p-5 shadow-xs space-y-4 ${
                isDirect ? 'border-indigo-200/80 bg-slate-50/20' : 'border-slate-200'
              }`}
            >
              {/* Question Header & Order */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                    Q{qIndex + 1}
                  </span>
                  <select
                    value={q.type}
                    onChange={(e) => handleUpdateQuestion(qIndex, { type: e.target.value as QuestionType })}
                    className="text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded px-2.5 py-1 focus:border-indigo-500"
                  >
                    <option value="direct_short">Question Directe : Réponse Courte / Valeur</option>
                    <option value="direct_open">Question Directe : Rédaction Libre / Explication</option>
                    <option value="single_choice">QCM : Choix Unique</option>
                    <option value="multiple_choice">QCM : Choix Multiples</option>
                    <option value="true_false">Vrai / Faux</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  {/* Points input */}
                  <div className="flex items-center gap-1 text-xs text-slate-600">
                    <span>Barème :</span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={q.points}
                      onChange={(e) => handleUpdateQuestion(qIndex, { points: Number(e.target.value) })}
                      className="w-14 px-2 py-0.5 text-xs text-center font-mono font-bold bg-white border border-slate-200 rounded"
                    />
                    <span>pts</span>
                  </div>

                  {/* Move up/down */}
                  <button
                    onClick={() => handleMoveQuestion(qIndex, 'up')}
                    disabled={qIndex === 0}
                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                    title="Monter"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleMoveQuestion(qIndex, 'down')}
                    disabled={qIndex === questions.length - 1}
                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                    title="Descendre"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDeleteQuestion(qIndex)}
                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors ml-1"
                    title="Supprimer la question"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Question Title input */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Énoncé de la Question *
                </label>
                <textarea
                  rows={2}
                  value={q.title}
                  onChange={(e) => handleUpdateQuestion(qIndex, { title: e.target.value })}
                  placeholder="Rédigez l'énoncé précis (ex: Donnez la formule de..., Expliquez le fonctionnement de...)"
                  className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 text-slate-900"
                />
              </div>

              {/* DIRECT QUESTION SPECIFIC FIELDS */}
              {isDirect ? (
                <div className="space-y-3 p-3.5 bg-indigo-50/50 rounded-lg border border-indigo-100">
                  <div>
                    <label className="block text-xs font-semibold text-indigo-950 mb-1">
                      Réponse Modèle Attendue par l'Enseignant *
                    </label>
                    <input
                      type="text"
                      value={q.correctAnswerText || ''}
                      onChange={(e) => handleUpdateQuestion(qIndex, { correctAnswerText: e.target.value })}
                      placeholder={isDirectShort ? 'Ex: O(n log n) ou 9.81 m/s²' : 'Rédigez la démonstration ou l\'argumentation de référence attendue...'}
                      className="w-full px-3 py-2 text-xs bg-white border border-indigo-200 rounded-md text-slate-900 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-indigo-950 mb-1">
                      Mots-Clés Acceptés (séparés par des virgules pour validation)
                    </label>
                    <input
                      type="text"
                      value={(q.acceptedKeywords || []).join(', ')}
                      onChange={(e) =>
                        handleUpdateQuestion(qIndex, {
                          acceptedKeywords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                        })
                      }
                      placeholder="Ex: collision, liste chaînée, adressage ouvert, O(n)"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-indigo-200 rounded-md text-slate-800 font-mono"
                    />
                  </div>

                  {isDirectOpen && (
                    <div>
                      <label className="block text-xs font-semibold text-indigo-950 mb-1">
                        Critères d'Évaluation & Barème Détaillé
                      </label>
                      <input
                        type="text"
                        value={q.gradingCriteria || ''}
                        onChange={(e) => handleUpdateQuestion(qIndex, { gradingCriteria: e.target.value })}
                        placeholder="Ex: 3 pts pour l'explication théorique + 2 pts pour les deux exemples concrets."
                        className="w-full px-3 py-1.5 text-xs bg-white border border-indigo-200 rounded-md text-slate-800"
                      />
                    </div>
                  )}
                </div>
              ) : (
                /* QCM / TRUE-FALSE OPTIONS */
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-800">
                    Options de Réponse (Cochez la bonne réponse)
                  </label>

                  {(q.options || []).map((opt, optIndex) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleCorrectOption(qIndex, optIndex)}
                        className={`w-6 h-6 rounded flex items-center justify-center transition-colors shrink-0 ${
                          opt.isCorrect
                            ? 'bg-emerald-600 text-white'
                            : 'border border-slate-300 text-transparent hover:border-slate-400'
                        }`}
                        title={opt.isCorrect ? 'Réponse Correcte' : 'Définir comme réponse correcte'}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>

                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => handleUpdateOption(qIndex, optIndex, e.target.value)}
                        placeholder={`Option ${String.fromCharCode(65 + optIndex)}`}
                        className={`flex-1 px-3 py-1.5 text-xs rounded-md border focus:outline-none focus:border-indigo-500 ${
                          opt.isCorrect
                            ? 'bg-emerald-50/40 border-emerald-300 text-emerald-950 font-medium'
                            : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      />

                      {q.type !== 'true_false' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteOption(qIndex, optIndex)}
                          className="p-1 text-slate-400 hover:text-rose-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}

                  {q.type !== 'true_false' && (q.options || []).length < 6 && (
                    <button
                      type="button"
                      onClick={() => handleAddOption(qIndex)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium pt-1"
                    >
                      + Ajouter une proposition de choix
                    </button>
                  )}
                </div>
              )}

              {/* Justification Pédagogique */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Explication Pédagogique (affichée lors de la correction)
                </label>
                <input
                  type="text"
                  value={q.explanation}
                  onChange={(e) => handleUpdateQuestion(qIndex, { explanation: e.target.value })}
                  placeholder="Justification conceptuelle de la réponse..."
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-indigo-500 text-slate-800"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Save Button Row */}
      <div className="pt-4 flex items-center justify-between border-t border-slate-200">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          Annuler
        </button>

        <button
          onClick={handleSave}
          className="inline-flex items-center gap-1.5 px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-sm"
        >
          <Save className="w-4 h-4" />
          Enregistrer & Activer cette Épreuve
        </button>
      </div>
    </div>
  );
};
