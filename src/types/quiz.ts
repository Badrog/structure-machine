/**
 * Types pour la plateforme d'évaluation et interrogations en temps réel
 */

export type QuestionType =
  | 'direct_short'     // Question directe : Réponse courte / formule / mot-clé
  | 'direct_open'      // Question directe : Rédaction libre / explication / calcul développé
  | 'single_choice'    // QCM : Choix unique
  | 'multiple_choice'  // QCM : Choix multiples
  | 'true_false';      // Question Vrai / Faux

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

/** Traduction d'une question (le français reste dans `title` / `options[].text` / `explanation`). */
export interface QuestionTranslation {
  title: string;
  options?: string[];   // même ordre que `options` ; absent = identique au français (formules)
  explanation?: string;
}

export interface Question {
  id: string;
  title: string;
  type: QuestionType;
  options?: QuestionOption[]; // Utilisé pour QCM et Vrai/Faux
  correctAnswerText?: string;  // Réponse modèle / attendue pour question directe
  acceptedKeywords?: string[]; // Mots-clés acceptés pour vérification automatique
  gradingCriteria?: string;   // Barème et critères de correction pour l'enseignant
  placeholder?: string;       // Guide de saisie pour l'étudiant
  points: number;
  explanation: string;
  category?: string;
  /** Traductions affichées sous le texte français (anglais). */
  i18n?: { en?: QuestionTranslation };
  /** QCM à choix multiples : 0,5 × points si aucune case fausse mais réponse incomplète. */
  partialCredit?: boolean;
}

/** Une variante d'interrogation : mêmes ids de questions (q01…) et d'options (a…d), contenu différent. */
export interface QuizVariant {
  id: string;
  label: string;
  questions: Question[];
}

export interface Quiz {
  id: string;
  title: string;
  subject: string;
  level: string;
  classGroup: string;
  durationMinutes: number;
  totalPoints: number;
  pinCode: string;
  createdAt: string;
  questions: Question[];
  status: 'draft' | 'active' | 'completed';
  instructions?: string;
  lockOnLeave?: boolean;     // masque l'épreuve et bloque l'étudiant s'il quitte la fenêtre (défaut : oui)
  lockMinutes?: number;      // durée du blocage (défaut : 5)
  showCorrection?: boolean; // le corrigé est visible par les étudiants après remise
  /** Variantes (stockées à part côté serveur) : chaque étudiant reçoit l'une d'elles. */
  /** Barème d'affichage de la note finale (défaut 20) ; scoreOutOf20 reste normalisé sur 20. */
  gradeScale?: number;
  variantList?: { id: string; label: string }[];
  /** Uniquement en entrée de création : contenu complet des variantes. */
  variants?: QuizVariant[];
}

export type StudentStatus = 'active' | 'completed' | 'paused' | 'needs_help';

export interface StudentAnswer {
  questionId: string;
  selectedOptionIds?: string[];
  textAnswer?: string;          // Réponse rédigée saisie par l'étudiant pour question directe
  isCorrect?: boolean;
  scoreAwarded: number;
  timeSpentSeconds: number;
  teacherComment?: string;      // Annotation spécifique du prof sur cette réponse
  isEvaluated?: boolean;        // Validation par le prof pour question ouverte
}

export interface StudentSubmission {
  id: string;
  studentId: string;
  studentName: string;
  studentAvatar: string;
  matricule: string;
  status: StudentStatus;
  startedAt: string;
  submittedAt?: string;
  answers: Record<string, StudentAnswer>;
  currentQuestionIndex: number;
  totalScore: number;
  scoreOutOf20: number;
  timeSpentSeconds: number;
  teacherFeedback?: string;
  violations?: Violation[];     // sorties de fenêtre / captures détectées
  variantId?: string;           // variante attribuée à l'étudiant
  variantLabel?: string;
}

export interface Violation {
  type: 'blur' | 'hidden' | 'screenshot' | 'print';
  at: string; // heure HH:MM:SS
}

export interface ClassStudent {
  id: string;
  name: string;
  matricule: string;
  avatar: string;
  email: string;
  group: string;
  historicalAverage: number;
}
