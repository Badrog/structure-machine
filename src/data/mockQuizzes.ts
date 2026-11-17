import { Quiz } from '../types/quiz';

export const INITIAL_QUIZZES: Quiz[] = [
  {
    id: 'quiz-algo-l2',
    title: 'Contrôle Continu : Algorithmique & Complexité',
    subject: 'Informatique Fondamentale',
    level: 'Licence 2 (L2)',
    classGroup: 'Groupe Info-A & B',
    durationMinutes: 25,
    totalPoints: 20,
    pinCode: '#ALGO-204',
    createdAt: '2026-11-08',
    status: 'active',
    instructions: 'Calculatrice interdite. Justifiez brièvement vos réponses aux questions directes avec la notation mathématique appropriée.',
    questions: [
      {
        id: 'q1',
        title: 'Donnez la complexité temporelle asymptotique exacte dans le pire des cas de l\'algorithme de tri Quicksort (tri rapide) sans pivot aléatoire sur un tableau déjà trié.',
        type: 'direct_short',
        points: 3,
        correctAnswerText: 'O(n²)',
        acceptedKeywords: ['O(n^2)', 'O(n²)', 'O(n*n)', 'quadratique', 'n^2'],
        placeholder: 'Ex: O(n log n), O(n²)...',
        explanation: 'Dans le pire des cas (quand le premier ou dernier élément est choisi comme pivot sur un tableau déjà ordonné), la partition divise en tailles 0 et n-1, produisant la récurrence T(n) = T(n-1) + O(n) = O(n²).',
        category: 'Complexité'
      },
      {
        id: 'q2',
        title: 'Expliquez brièvement le mécanisme par lequel une recherche dans une table de hachage peut dégénérer en complexité O(n), et citez deux techniques standard pour gérer les collisions.',
        type: 'direct_open',
        points: 5,
        correctAnswerText: 'Lorsque toutes les clés sont hachées vers la même alvéole (collision totale ou mauvaise fonction de hachage), la structure devient une liste chaînée linéaire de taille n, d\'où une recherche en O(n). Techniques de résolution : 1) Le chaînage séparé (listes chaînées), 2) L\'adressage ouvert (sondage linéaire, quadratique ou double hachage).',
        acceptedKeywords: ['collision', 'liste chaînée', 'chaînage', 'adressage ouvert', 'sondage linéaire'],
        gradingCriteria: '3 pts pour l\'explication du regroupement sur une même alvéole (dégénérescence en liste) + 2 pts pour les deux techniques de résolution.',
        placeholder: 'Rédigez votre explication théorique ici (4 à 6 lignes recommandées)...',
        explanation: 'Une mauvaise fonction de hachage ou une attaque par déni de service peut concentrer toutes les clés dans le même panier. On résout cela par chaînage externe ou adressage ouvert (linear probing, double hashing).',
        category: 'Structures de données'
      },
      {
        id: 'q3',
        title: 'Quelle est la complexité temporelle dans le pire des cas du tri par tas (HeapSort) sur un tableau de taille n ?',
        type: 'single_choice',
        points: 3,
        options: [
          { id: 'opt-3-a', text: 'O(n²)', isCorrect: false },
          { id: 'opt-3-b', text: 'O(n log n)', isCorrect: true },
          { id: 'opt-3-c', text: 'O(n)', isCorrect: false },
          { id: 'opt-3-d', text: 'O(log n)', isCorrect: false }
        ],
        explanation: 'HeapSort garantit O(n log n) dans le pire, meilleur et cas moyen grâce à la construction en O(n) puis n extractions en O(log n).',
        category: 'Tris'
      },
      {
        id: 'q4',
        title: 'Soit un tas binaire min représenté sous forme de tableau compact. Si un nœud est stocké à l\'indice i (indexation commençant à 0), donnez les expressions exactes des indices de son fils gauche et de son père.',
        type: 'direct_short',
        points: 3,
        correctAnswerText: 'Fils gauche : 2i + 1, Père : ⌊(i - 1) / 2⌋',
        acceptedKeywords: ['2i+1', '2*i+1', '(i-1)/2', '(i - 1) / 2', '2i + 1'],
        placeholder: 'Ex: Fils gauche: 2i + 1, Père: (i - 1) / 2',
        explanation: 'Dans un arbre binaire complet numéroté à partir de 0 : le fils gauche est à 2i + 1, le fils droit à 2i + 2, et le parent à ⌊(i - 1) / 2⌋.',
        category: 'Arbres & Tas'
      },
      {
        id: 'q5',
        title: 'L\'algorithme de Dijkstra fonctionne-t-il correctement sur un graphe orienté comportant des arêtes de poids négatif sans cycle absorbant ?',
        type: 'true_false',
        points: 3,
        options: [
          { id: 'opt-5-a', text: 'Vrai', isCorrect: false },
          { id: 'opt-5-b', text: 'Faux', isCorrect: true }
        ],
        explanation: 'Faux. Dijkstra est un algorithme glouton qui suppose que l\'extraction d\'un sommet garantit sa distance minimale définitive, hypothèse faussée par les arêtes négatives (il faut utiliser Bellman-Ford).',
        category: 'Graphes'
      },
      {
        id: 'q6',
        title: 'Écrivez la condition d\'arrêt (cas de base) indispensable lors de la conception d\'une fonction récursive calculant la factorielle d\'un entier positif n (notée n!).',
        type: 'direct_short',
        points: 3,
        correctAnswerText: 'si n <= 1 alors retourner 1 (ou si n == 0 ou n == 1 renvoyer 1)',
        acceptedKeywords: ['n <= 1', 'n==0', 'n == 0', 'n=0', 'n <= 1 renvoie 1', 'n=1', 'n == 1'],
        placeholder: 'Ex: si n <= 1 retourner 1',
        explanation: 'Par convention 0! = 1 et 1! = 1. Sans ce cas de base, la pile d\'appels récursifs croît indéfiniment jusqu\'à provoquer un stack overflow.',
        category: 'Récursivité'
      }
    ]
  },
  {
    id: 'quiz-physique-meca',
    title: 'Interrogation Flash : Mécanique Newtonienne & Énergie',
    subject: 'Physique Fondamentale',
    level: 'Licence 1 (L1)',
    classGroup: 'Section Physique-Chimie',
    durationMinutes: 20,
    totalPoints: 20,
    pinCode: '#PHYS-101',
    createdAt: '2026-11-06',
    status: 'draft',
    instructions: 'Précisez toujours les unités du système international (SI) dans vos réponses directes.',
    questions: [
      {
        id: 'qp1',
        title: 'Écrivez l\'énoncé vectoriel rigoureux de la deuxième loi de Newton (principe fondamental de la dynamique) pour un point matériel de masse constante m.',
        type: 'direct_short',
        points: 5,
        correctAnswerText: '∑ F_ext = m · a (la somme vectorielle des forces extérieures est égale à la masse multipliée par le vecteur accélération)',
        acceptedKeywords: ['sum F = m a', 'F = m.a', 'F = ma', 'somme des forces', 'm*a', 'm.a'],
        placeholder: 'Ex: ∑ F = m · a',
        explanation: '∑ F_ext = dp/dt = m · dv/dt = m · a dans un référentiel galiléen avec une masse invariante.',
        category: 'Lois de Newton'
      },
      {
        id: 'qp2',
        title: 'Le travail d\'une force conservative le long d\'une trajectoire fermée quelconque est rigoureusement nul.',
        type: 'true_false',
        points: 4,
        options: [
          { id: 'opt-p2-a', text: 'Vrai', isCorrect: true },
          { id: 'opt-p2-b', text: 'Faux', isCorrect: false }
        ],
        explanation: 'Vrai. Pour une force conservative F = -grad(Ep), la circulation sur une courbe fermée ∮ F·dr = 0.',
        category: 'Énergie & Travail'
      },
      {
        id: 'qp3',
        title: 'Donnez la dimension physique et l\'expression en unités fondamentales du Système International (kg, m, s) de l\'énergie mécanique.',
        type: 'direct_short',
        points: 5,
        correctAnswerText: 'kg · m² · s⁻² (ou [M][L]²[T]⁻²)',
        acceptedKeywords: ['kg m2 s-2', 'kg.m2.s-2', 'kg*m^2/s^2', 'kg m² s⁻²', 'kg·m²·s⁻²'],
        placeholder: 'Ex: kg · m² · s⁻²',
        explanation: '1 Joule = 1 Newton × 1 mètre = (1 kg · m · s⁻²) · m = kg · m² · s⁻².',
        category: 'Dimensions SI'
      },
      {
        id: 'qp4',
        title: 'Lors d\'un choc inélastique entre deux solides, pourquoi l\'énergie cinétique totale n\'est-elle pas conservée, et sous quelles formes d\'énergie se transforme la fraction manquante ?',
        type: 'direct_open',
        points: 6,
        correctAnswerText: 'Une partie de l\'énergie cinétique initiale est absorbée par le travail des forces de déformation irréversible des solides (plastification) et dissipée sous forme d\'énergie thermique (chaleur) et acoustique (bruit/ondes de choc). Seule la quantité de mouvement totale du système isolé demeure strictement conservée.',
        acceptedKeywords: ['déformation', 'chaleur', 'thermique', 'dissipation', 'acoustique', 'plastique'],
        gradingCriteria: '3 pts pour la déformation mécanique irréversible + 3 pts pour la dissipation thermique et sonore.',
        placeholder: 'Expliquez la dissipation d\'énergie et la déformation plastique...',
        explanation: 'Dans un choc inélastique, une part de l\'énergie mécanique se dégrade en énergie interne/thermique et travail de déformation microscopique.',
        category: 'Collisions'
      }
    ]
  }
];
