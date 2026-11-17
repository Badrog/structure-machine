import type { Quiz, Question, StudentAnswer } from '../../src/types/quiz';

export interface RawAnswers { selected: Record<string, string[]>; text: Record<string, string> }

export const isDirect = (q: Question) => q.type === 'direct_short' || q.type === 'direct_open';

/** Correction automatique (reprend la logique d'origine, mais exécutée côté serveur). */
export function gradeQuiz(quiz: Quiz, raw: RawAnswers, timeSpentSeconds: number) {
  let totalScore = 0;
  const answers: Record<string, StudentAnswer> = {};
  const perQ = Math.floor(timeSpentSeconds / Math.max(1, quiz.questions.length));

  for (const q of quiz.questions) {
    if (isDirect(q)) {
      const studentText = (raw.text[q.id] || '').trim();
      const expected = (q.correctAnswerText || '').trim().toLowerCase();
      const keywords = (q.acceptedKeywords || []).map((k) => k.toLowerCase());
      let isCorrect = false;
      let points = 0;
      if (studentText) {
        const s = studentText.toLowerCase();
        if (q.type === 'direct_short') {
          if (s === expected || keywords.some((k) => s.includes(k))) { isCorrect = true; points = q.points; }
        } else {
          const matched = keywords.filter((k) => s.includes(k));
          if (matched.length >= 2 || (keywords.length > 0 && matched.length === keywords.length)) {
            isCorrect = true; points = q.points;
          } else if (matched.length === 1 || studentText.length >= 25) {
            isCorrect = true; points = Math.max(1, Math.round(q.points * 0.7));
          }
        }
      }
      totalScore += points;
      answers[q.id] = {
        questionId: q.id, textAnswer: studentText, isCorrect, scoreAwarded: points, timeSpentSeconds: perQ,
        // les questions rédigées restent à valider par l'enseignant
        isEvaluated: q.type === 'direct_open' ? false : true,
      };
    } else {
      const chosen = raw.selected[q.id] || [];
      const correct = (q.options || []).filter((o) => o.isCorrect).map((o) => o.id);
      const isCorrect = chosen.length === correct.length && chosen.every((id) => correct.includes(id));
      // Barème QCM multiple : aucune case fausse mais réponse incomplète = demi-point
      const incompleteOk = !isCorrect && q.partialCredit === true && chosen.length > 0 && chosen.every((id) => correct.includes(id));
      const points = isCorrect ? q.points : incompleteOk ? q.points / 2 : 0;
      totalScore += points;
      answers[q.id] = {
        questionId: q.id, selectedOptionIds: chosen, isCorrect, scoreAwarded: points, timeSpentSeconds: perQ,
      };
    }
  }
  const scoreOutOf20 = Number(Math.min(20, (totalScore / (quiz.totalPoints || 20)) * 20).toFixed(1)); // le bonus ne dépasse pas 20
  return { answers, totalScore, scoreOutOf20 };
}

/** Réponses partielles (sans notes) pour le suivi en direct du professeur. */
export function partialAnswers(quiz: Quiz, raw: RawAnswers): Record<string, StudentAnswer> {
  const out: Record<string, StudentAnswer> = {};
  for (const q of quiz.questions) {
    const text = (raw.text[q.id] || '').trim();
    const sel = raw.selected[q.id] || [];
    if (isDirect(q) ? text : sel.length) {
      out[q.id] = {
        questionId: q.id, scoreAwarded: 0, timeSpentSeconds: 0,
        ...(isDirect(q) ? { textAnswer: text } : { selectedOptionIds: sel }),
      };
    }
  }
  return out;
}

/** Retire tout ce qui révèle les bonnes réponses. */
export function sanitizeQuizForStudent(quiz: Quiz): Quiz {
  return {
    ...quiz,
    questions: quiz.questions.map((q) => ({
      id: q.id, title: q.title, type: q.type, points: q.points, placeholder: q.placeholder, category: q.category,
      explanation: '',
      i18n: q.i18n ? (Object.fromEntries(Object.entries(q.i18n).map(([l, t]) => [l, { title: t.title, options: t.options }])) as Question['i18n']) : undefined,
      options: q.options?.map((o) => ({ id: o.id, text: o.text, isCorrect: false })),
    })),
  };
}

/** Nettoie les entrées étudiant : n'accepte que des ids/chaînes valides, tailles bornées. */
export function cleanRaw(quiz: Quiz, input: any): RawAnswers {
  const selected: Record<string, string[]> = {};
  const text: Record<string, string> = {};
  for (const q of quiz.questions) {
    const s = input?.selected?.[q.id];
    if (Array.isArray(s) && !isDirect(q)) {
      const valid = new Set((q.options || []).map((o) => o.id));
      selected[q.id] = [...new Set(s.filter((x: unknown): x is string => typeof x === 'string' && valid.has(x)))];
    }
    const t = input?.text?.[q.id];
    if (typeof t === 'string' && isDirect(q)) text[q.id] = t.slice(0, 5000);
  }
  return { selected, text };
}
