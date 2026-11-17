import type { Quiz } from '../types/quiz';
export const gradeScale = (quiz?: Pick<Quiz, 'gradeScale'> | null) => quiz?.gradeScale || 20;
/** scoreOutOf20 (normalisé /20) -> note affichée sur le barème de l'interrogation. */
export const toScale = (scoreOutOf20: number, quiz?: Pick<Quiz, 'gradeScale'> | null) =>
  Number(((scoreOutOf20 * gradeScale(quiz)) / 20).toFixed(2));
