import type { Question } from '../../src/types/quiz';

export interface GenerateParams { topic: string; level: string; questionCount: number }

const TYPES = ['direct_short', 'direct_open', 'single_choice', 'multiple_choice', 'true_false'] as const;

export async function generateQuestions(p: GenerateParams): Promise<{ questions: Question[]; source: 'gemini' | 'template' }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Tu es un professeur d'université expérimenté. Génère ${p.questionCount} questions académiques variées sur le sujet : "${p.topic}" (niveau : "${p.level}").
Mélange équilibré de : "direct_short" (réponse courte / formule : correctAnswerText + acceptedKeywords), "direct_open" (rédactionnelle : correctAnswerText + gradingCriteria), "single_choice" (QCM, 4 options dont une seule correcte).
Renvoie UNIQUEMENT un tableau JSON brut (sans markdown) d'objets :
{"title":"énoncé","type":"direct_short|direct_open|single_choice|true_false","points":3|4|5,"correctAnswerText":"...","acceptedKeywords":["..."],"gradingCriteria":"...","placeholder":"...","options":[{"text":"...","isCorrect":true}],"explanation":"...","category":"..."}`;
      const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
      const clean = (response.text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(clean);
      if (Array.isArray(parsed) && parsed.length) {
        const stamp = Date.now();
        const questions = parsed.slice(0, 30).map((it: any, i: number): Question => {
          const type = TYPES.includes(it?.type) ? it.type : i % 2 === 0 ? 'direct_short' : 'single_choice';
          const isChoice = type === 'single_choice' || type === 'multiple_choice' || type === 'true_false';
          return {
            id: `ai-q-${stamp}-${i}`,
            title: String(it?.title || '').slice(0, 2000),
            type,
            points: Math.min(20, Math.max(1, Number(it?.points) || 4)),
            correctAnswerText: isChoice ? undefined : String(it?.correctAnswerText || '').slice(0, 3000),
            acceptedKeywords: Array.isArray(it?.acceptedKeywords) ? it.acceptedKeywords.map(String).slice(0, 20) : undefined,
            gradingCriteria: it?.gradingCriteria ? String(it.gradingCriteria).slice(0, 1000) : undefined,
            placeholder: it?.placeholder ? String(it.placeholder).slice(0, 300) : undefined,
            options: isChoice && Array.isArray(it?.options)
              ? it.options.slice(0, 8).map((o: any, j: number) => ({ id: `opt-ai-${stamp}-${i}-${j}`, text: String(o?.text || ''), isCorrect: Boolean(o?.isCorrect) }))
              : undefined,
            explanation: String(it?.explanation || 'Réponse académique validée selon les règles du domaine.').slice(0, 2000),
            category: String(it?.category || p.topic).slice(0, 120),
          };
        }).filter((q) => q.title);
        if (questions.length) return { questions, source: 'gemini' };
      }
    } catch (err) {
      console.warn('[evalis] Gemini indisponible, modèles par défaut utilisés :', (err as Error).message);
    }
  }
  return { questions: templates(p), source: 'template' };
}

function templates(p: GenerateParams): Question[] {
  const t = Date.now();
  return [
    { id: `q-gen-${t}-1`, title: `Donnez la définition fondamentale ou l'expression exacte régissant : "${p.topic}".`, type: 'direct_short', points: 4,
      correctAnswerText: `Principe fondamental de ${p.topic}`, acceptedKeywords: [p.topic.toLowerCase(), 'théorie', 'formule', 'loi'],
      placeholder: `Ex: notation, formule ou énoncé exact pour ${p.topic}...`, explanation: `Cette relation définit formellement ${p.topic}.`, category: 'Définitions & Notations' },
    { id: `q-gen-${t}-2`, title: `Expliquez les conditions de validité et les limites de "${p.topic}" dans un système réel.`, type: 'direct_open', points: 5,
      correctAnswerText: 'Les conditions de validité requièrent un système conservatif ou un régime stationnaire, sans perturbations non linéaires.',
      acceptedKeywords: ['conditions', 'limites', 'validité', 'hypothèse'], gradingCriteria: "3 pts pour les hypothèses + 2 pts pour l'analyse des limites.",
      placeholder: 'Rédigez votre argumentation...', explanation: `Tout modèle relatif à ${p.topic} est circonscrit par ses hypothèses.`, category: 'Analyse & Démonstration' },
    { id: `q-gen-${t}-3`, title: `Quelle propriété fondamentale caractérise ce phénomène en ${p.topic} ?`, type: 'single_choice', points: 4,
      options: [
        { id: `opt-g3-a-${t}`, text: 'La conservation stricte des grandeurs invariantes du système', isCorrect: true },
        { id: `opt-g3-b-${t}`, text: 'Une divergence infinie sans équilibre stable possible', isCorrect: false },
        { id: `opt-g3-c-${t}`, text: "L'absence de dépendance vis-à-vis des conditions initiales", isCorrect: false },
        { id: `opt-g3-d-${t}`, text: 'Une valeur purement aléatoire indépendante de toute loi', isCorrect: false },
      ], explanation: 'La conservation des invariants constitue le socle méthodologique.', category: 'Propriétés' },
  ];
}
