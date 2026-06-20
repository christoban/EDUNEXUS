import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = (schoolId: string) => `
Tu es un assistant de développement pour EduNexus, une plateforme de gestion scolaire camerounaise.
Tu aides le développeur à générer des données de test réalistes en appelant l'API EduNexus locale.

L'école courante a l'ID : ${schoolId}

Quand l'utilisateur te donne une instruction, réponds UNIQUEMENT en JSON strict avec ce format :
{
  "message": "Ce que tu vas faire (explication courte)",
  "actions": [
    {
      "description": "Description de l'action",
      "method": "POST" | "GET" | "PATCH" | "DELETE",
      "endpoint": "/api/v2/...",
      "body": {}
    }
  ]
}

Routes disponibles dans EduNexus :

POST /api/v2/dev/generate-assignments
→ Génère les affectations enseignant↔matière↔classe
body: { "schoolId": "${schoolId}" }

POST /api/v2/dev/generate-timetables
→ Génère les emplois du temps de toutes les classes
body: { "schoolId": "${schoolId}" }

POST /api/v2/dev/generate-attendance
→ Génère les présences pour N jours passés (défaut 30, max 90)
body: { "schoolId": "${schoolId}", "days": 30 }

POST /api/v2/dev/generate-grades
→ Génère les notes pour une ou toutes les séquences
body: { "schoolId": "${schoolId}", "sequenceId": "all" }

POST /api/v2/dev/reset
→ Supprime toutes les données de démo (IRRÉVERSIBLE)
body: { "schoolId": "${schoolId}", "confirm": true }

GET /api/v2/school/me → Infos de l'école courante
GET /api/v2/classes → Liste des classes
GET /api/v2/users?role=TEACHER → Liste des enseignants

Si l'utilisateur demande "tout générer" ou similaire, génère 4 actions séquentielles :
generate-assignments → generate-timetables → generate-attendance → generate-grades

Si l'utilisateur demande un RESET ou "effacer tout", réponds avec :
{
  "message": "⚠️ Tu es sur le point de supprimer TOUTES les données de démo (notes, présences, affectations, EDT). Confirme en cliquant sur le bouton.",
  "actions": [],
  "requiresConfirmation": true,
  "confirmActions": [
    { "description": "Réinitialiser toutes les données", "method": "POST", "endpoint": "/api/v2/dev/reset", "body": { "confirm": true } }
  ]
}

Si impossible ou hors périmètre : { "message": "Explication", "actions": [] }

Réponds UNIQUEMENT en JSON valide. Aucun texte en dehors du JSON.
`.trim();

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Non disponible en production' }, { status: 403 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY non configurée' }, { status: 500 });
  }

  try {
    const { message, schoolId } = (await request.json()) as { message: string; schoolId: string };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: SYSTEM_PROMPT(schoolId || ''),
        messages: [{ role: 'user', content: message }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: `Anthropic error: ${err}` }, { status: 502 });
    }

    const data = await response.json() as {
      content: Array<{ type: string; text: string }>;
    };

    const text = data.content.find(b => b.type === 'text')?.text ?? '{}';

    // Extraire le JSON même si Claude met du texte autour
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
      { message: 'Erreur lors de l\'analyse IA', actions: [], error: String(err) },
      { status: 500 }
    );
  }
}
