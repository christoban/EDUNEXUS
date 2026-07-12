import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:5000';

interface ClassInfo {
  id: string;
  name: string;
  level: string | null;
  serie: string | null;
  students: number;
  professorPrincipal: string | null;
  assignedSubjects: number;
  hasTimetable: boolean;
  timetableSlots: number;
}

interface DiagStats {
  totalClasses: number;
  totalStudents: number;
  totalTeachers: number;
  totalAssignments: number;
  totalTimetables: number;
  classesWithProfPrincipal: number;
  classesWithoutProfPrincipal: number;
  classesWithTimetable: number;
  classesWithoutTimetable: number;
  classesWithAssignments: number;
  classesWithoutAssignments: number;
}

function buildSystemPrompt(schoolId: string, diag: { classes: ClassInfo[]; stats: DiagStats } | null): string {
  const stateSection = diag ? `
## État actuel de l'école (données en temps réel)

Statistiques globales :
- ${diag.stats.totalClasses} classe(s) | ${diag.stats.totalStudents} élève(s) | ${diag.stats.totalTeachers} enseignant(s)
- Affectations matières : ${diag.stats.totalAssignments} au total
- Professeurs principaux : ${diag.stats.classesWithProfPrincipal}/${diag.stats.totalClasses} classes ont un prof principal
- Emplois du temps : ${diag.stats.classesWithTimetable}/${diag.stats.totalClasses} classes ont un EDT
- Affectations matières : ${diag.stats.classesWithAssignments}/${diag.stats.totalClasses} classes ont des affectations

Détail par classe :
${diag.classes.map(c =>
  `• ${c.name}${c.serie ? ` (${c.serie})` : ''} — ${c.students} élève(s) | Prof principal: ${c.professorPrincipal ?? '❌ non assigné'} | Matières: ${c.assignedSubjects} | EDT: ${c.hasTimetable ? `✅ (${c.timetableSlots} créneaux)` : '❌ pas encore'}`
).join('\n')}
` : '\n## État de l\'école : non disponible (erreur de chargement)\n';

  return `Tu es un assistant de développement pour ZekoulABia, une plateforme de gestion scolaire camerounaise.
Tu aides le développeur à vérifier l'état de l'école et à générer des données de test.
L'école courante a l'ID : ${schoolId}
${stateSection}
## Ce que tu peux faire

### 1. Répondre à des questions sur l'état de l'école
Utilise les données ci-dessus pour répondre directement. Ex : "Quelle classe n'a pas de prof principal ?"
→ Réponds avec { "message": "Réponse claire ici", "actions": [] }

### 2. Exécuter des actions de génération de données
Réponds UNIQUEMENT en JSON strict avec ce format :
{
  "message": "Ce que tu vas faire",
  "actions": [
    {
      "description": "Description courte",
      "method": "POST",
      "endpoint": "/api/v2/...",
      "body": {}
    }
  ]
}

Routes disponibles :
POST /api/v2/dev/generate-assignments → Affecte les enseignants aux matières/classes (évite doublons, respecte les compétences)
POST /api/v2/dev/generate-timetables  → Génère les EDT (sans chevauchement, prof principal enseigne dans sa classe)
POST /api/v2/dev/generate-attendance  → Génère les présences | body: { "days": 30 }
POST /api/v2/dev/generate-grades      → Génère les notes     | body: { "sequenceId": "all" }
POST /api/v2/dev/assign-class         → Assigne une classe aux élèves sans classe | body: { "className": "Tle A4-Allemand" } ou { "classId": "xxx" }
POST /api/v2/dev/delete-students      → Supprime TOUS les élèves (et notes, présences, factures…) dans le bon ordre de dépendances | body: { "confirm": true }
POST /api/v2/dev/delete-teachers      → Supprime TOUS les enseignants (désassigne des classes, supprime TeacherSubject, TeachingAssignment…) | body: { "confirm": true }
POST /api/v2/dev/reset                → RESET total notes+présences+affectations+EDT (garde élèves et enseignants) | body: { "confirm": true }

### 3. Enchaîner plusieurs actions
Si l'utilisateur dit "tout générer" ou similaire, génère 4 actions séquentielles :
generate-assignments → generate-timetables → generate-attendance → generate-grades

### 4. Demande de confirmation pour les actions destructives
Pour toute suppression (reset, delete-students, delete-teachers), demande toujours confirmation :
{
  "message": "⚠️ [Description de ce qui va être supprimé et ce qui est perdu définitivement]. Confirme.",
  "actions": [],
  "requiresConfirmation": true,
  "confirmActions": [
    { "description": "[Action]", "method": "POST", "endpoint": "/api/v2/dev/[route]", "body": { "confirm": true } }
  ]
}
Exemples :
- "supprimer tous les élèves" → endpoint: /api/v2/dev/delete-students, body: { "confirm": true }
- "supprimer tous les enseignants" → endpoint: /api/v2/dev/delete-teachers, body: { "confirm": true }
- "reset" ou "réinitialiser" → endpoint: /api/v2/dev/reset, body: { "confirm": true }

Si la demande est hors périmètre : { "message": "Explication", "actions": [] }
Réponds UNIQUEMENT en JSON valide. Aucun texte en dehors du JSON.`.trim();
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Non disponible en production' }, { status: 403 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GROQ_API_KEY non configurée dans .env.local' }, { status: 500 });
  }

  try {
    const { message, schoolId } = (await request.json()) as {
      message: string;
      schoolId: string;
    };

    // Forward the incoming cookies (includes HttpOnly JWT) to the backend
    const cookieHeader = request.headers.get('cookie') ?? '';

    // Fetch diagnostic data to give the AI full context
    let diag: { classes: ClassInfo[]; stats: DiagStats } | null = null;
    try {
      const diagRes = await fetch(`${BACKEND_URL}/api/v2/dev/diagnostic`, {
        headers: { Cookie: cookieHeader, 'Content-Type': 'application/json' },
      });
      if (diagRes.ok) {
        const diagJson = await diagRes.json() as { success: boolean; data: typeof diag };
        if (diagJson.success) diag = diagJson.data;
      }
    } catch { /* non-blocking */ }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: 1024,
        messages: [
          { role: 'system', content: buildSystemPrompt(schoolId || '', diag) },
          { role: 'user', content: message },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: `Groq error: ${err}` }, { status: 502 });
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const text = data.choices?.[0]?.message?.content ?? '{}';

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ message: text, actions: [] });
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      message?: string;
      actions?: unknown[];
      requiresConfirmation?: boolean;
      confirmActions?: unknown[];
    };
    return NextResponse.json(parsed);
  } catch (err) {
    console.error('[dev-ai]', err);
    return NextResponse.json(
      { message: "Erreur lors de l'analyse IA", actions: [], error: String(err) },
      { status: 500 }
    );
  }
}
