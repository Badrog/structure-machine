import { Question } from '../types/quiz';
import { teacherApi } from './api';

interface GenerateQuizParams {
  topic: string;
  level: string;
  questionCount: number;
}

/** La génération se fait côté serveur : la clé Gemini n'est jamais envoyée au navigateur. */
export async function generateQuestionsWithAI(params: GenerateQuizParams): Promise<Question[]> {
  const { questions } = await teacherApi.generate(params);
  return questions;
}
