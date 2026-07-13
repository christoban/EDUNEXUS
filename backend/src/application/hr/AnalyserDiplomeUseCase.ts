/**
 * APPLICATION — Use case : analyse par IA vision (Groq) d'une photo/scan de diplôme, pour
 * PRÉ-REMPLIR le formulaire self-service RH — jamais pour écrire directement en base.
 * Même pattern que ScannerListeCandidatsUseCase (entranceExam) : appel multimodal direct
 * à l'API Groq (generateWithGroq() est texte seul), consigne stricte "ne jamais inventer,
 * préférer null à une devinette", confiance par champ pour que le frontend puisse mettre en
 * évidence ce qui mérite une relecture humaine avant confirmation.
 *
 * L'employé reste TOUJOURS le dernier mot : la suggestion est affichée dans le champ texte,
 * modifiable, jamais auto-enregistrée sans un clic explicite sur "Enregistrer".
 */
interface DiplomeAnalyse {
  intitule: string | null;
  institution: string | null;
  anneeObtention: string | null;
  suggestionTermeOfficiel: string | null; // ex. "DIPES II", "CAPIEMP" si reconnaissable
  confidence: 'high' | 'medium' | 'low';
}

export class AnalyserDiplomeUseCase {
  async execute(imageBase64: string, mimeType?: string): Promise<{ analyse: DiplomeAnalyse | null; warnings: string[] }> {
    const warnings: string[] = [];
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      warnings.push('Analyse impossible : clé Groq absente. Veuillez saisir manuellement.');
      return { analyse: null, warnings };
    }

    const prompt = `Tu es un assistant RH pour un établissement scolaire camerounais. Analyse cette image d'un diplôme ou d'une attestation académique/professionnelle.

Extrais :
- intitule (intitulé complet du diplôme tel qu'écrit sur le document, ex. "Licence en Lettres Modernes")
- institution (établissement ou université ayant délivré le diplôme)
- anneeObtention (année d'obtention, au format YYYY)
- suggestionTermeOfficiel : UNIQUEMENT si tu reconnais avec certitude un diplôme professionnel de l'enseignement camerounais correspondant à une abréviation officielle connue (ex. DIPES I, DIPES II, CAPIEMP, CAPIEG, CAPI, CAPIET, CAPIA, CAPIAEG, CAPIAET). Sinon, laisse à null — ne force jamais une correspondance approximative.
- confidence : "high" si le texte est net et complet, "medium" si partiellement lisible, "low" si tu dois deviner une partie importante.

Retourne UNIQUEMENT un JSON strict, sans markdown :
{"intitule": "...", "institution": "...", "anneeObtention": "...", "suggestionTermeOfficiel": null, "confidence": "high"}

Si le document n'est manifestement pas un diplôme/attestation, retourne tous les champs à null avec confidence "low".
Ne fabrique JAMAIS une information absente de l'image — préfère null à une supposition.`;

    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}` } },
            ],
          }],
          max_tokens: 512,
          temperature: 0.1,
        }),
      });

      if (!groqRes.ok) {
        warnings.push("Erreur lors de l'appel à l'IA. Veuillez réessayer ou saisir manuellement.");
        return { analyse: null, warnings };
      }

      const groqData = (await groqRes.json()) as any;
      const response: string = groqData?.choices?.[0]?.message?.content ?? '';
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        warnings.push("Impossible de parser la réponse de l'IA. Veuillez réessayer avec une image plus claire.");
        return { analyse: null, warnings };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const analyse: DiplomeAnalyse = {
        intitule: parsed.intitule ? String(parsed.intitule).trim() : null,
        institution: parsed.institution ? String(parsed.institution).trim() : null,
        anneeObtention: parsed.anneeObtention ? String(parsed.anneeObtention).trim() : null,
        suggestionTermeOfficiel: parsed.suggestionTermeOfficiel ? String(parsed.suggestionTermeOfficiel).trim() : null,
        confidence: (parsed.confidence as 'high' | 'medium' | 'low') ?? 'medium',
      };

      if (!analyse.intitule) warnings.push("Aucun intitulé de diplôme détecté — vérifiez la qualité de l'image.");
      if (analyse.confidence === 'low') warnings.push('Confiance faible — relisez attentivement avant de confirmer.');

      return { analyse, warnings };
    } catch (err: any) {
      warnings.push(`Erreur lors de l'analyse : ${err.message}`);
      return { analyse: null, warnings };
    }
  }
}
