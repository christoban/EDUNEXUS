import { describe, it, expect } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * ARCHITECTURE GUARD — Garde-fous de l'architecture hexagonale (§4.3, §4.12 AGENTS.md).
 *
 * Objectif : rendre les règles de DIRECTION DE DÉPENDANCE exécutables plutôt que documentaires.
 * Chaque `it()` échoue si la violation réapparaît. C'est le seul mécanisme FERME qui empêche
 * une régression même avec un petit modèle IA : une règle qui fait échouer `bun test` est plus
 * forte qu'une règle qu'on lit dans un .md.
 *
 * Règles couvertes (le cœur de l'hexagonal) :
 *   1. application/ n'importe JAMAIS @infrastructure (statique OU dynamic import)
 *   2. application/ n'importe JAMAIS @prisma/client
 *   3. domain/ n'importe JAMAIS @application
 *   4. controllers HTTP n'accèdent jamais à this.prisma (tout passe par UC/ports)
 *
 * Volontairement NON couvert ici (déjà géré par le pre-commit hook : tsc + détection `as any`
 * sur les LIGNES AJOUTÉES) : les casts `as any` préexistants.
 */

const ROOT = join(import.meta.dir, '../../src');
const APP = join(ROOT, 'application');
const DOMAIN = join(ROOT, 'domain');
const CONTROLLERS = join(ROOT, 'infrastructure/http/controllers');

function listerFichiersTs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const result: string[] = [];
  for (const entry of readdirSync(dir)) {
    const chemin = join(dir, entry);
    const s = statSync(chemin);
    if (s.isDirectory()) result.push(...listerFichiersTs(chemin));
    else if (entry.endsWith('.ts')) result.push(chemin);
  }
  return result;
}

function existsSync(p: string): boolean {
  try { statSync(p); return true; } catch { return false; }
}

const isInfraDep = (spec: string): boolean =>
  spec.includes('@infrastructure') || spec.includes('/infrastructure/') || spec.includes('../../infrastructure');

const isAppDep = (spec: string): boolean =>
  spec.includes('@application') || spec.includes('/application/');

describe('Garde-fou hexagonal — sens des dépendances', () => {
  // ── Règle 1 : application/ ne dépend JAMAIS de @infrastructure (ni statique ni dynamic import)
  it('application/ n\'importe aucune dépendance infrastructure (import statique OU dynamique)', () => {
    const violations: string[] = [];
    for (const fichier of listerFichiersTs(APP)) {
      const contenu = readFileSync(fichier, 'utf8');
      const imports = [...contenu.matchAll(/(?:from\s*'([^']+)'|import\(\s*'([^']+)'\)|require\(\s*'([^']+)'\))/g)];
      for (const m of imports) {
        const spec = m[1] ?? m[2] ?? m[3] ?? '';
        if (isInfraDep(spec)) violations.push(`${relative(APP, fichier)} → "${spec}"`);
      }
    }
    expect(violations, `application/ → infrastructure interdite :\n${violations.join('\n')}`).toEqual([]);
  });

  // ── Règle 2 : application/ ne dépend JAMAIS de @prisma/client
  it('application/ n\'importe jamais @prisma/client', () => {
    const violations: string[] = [];
    for (const fichier of listerFichiersTs(APP)) {
      const contenu = readFileSync(fichier, 'utf8');
      if (contenu.includes('@prisma/client')) violations.push(relative(APP, fichier));
    }
    expect(violations, `@prisma/client dans application/ :\n${violations.join('\n')}`).toEqual([]);
  });

  // ── Règle 3 : domain/ ne dépend JAMAIS de @application
  it('domain/ n\'importe jamais @application (le domaine est le plus profond)', () => {
    const violations: string[] = [];
    for (const fichier of listerFichiersTs(DOMAIN)) {
      const contenu = readFileSync(fichier, 'utf8');
      const imports = [...contenu.matchAll(/(?:from\s*'([^']+)'|import\(\s*'([^']+)'\))/g)];
      for (const m of imports) {
        const spec = m[1] ?? m[2] ?? '';
        if (isAppDep(spec)) violations.push(`${relative(DOMAIN, fichier)} → "${spec}"`);
      }
    }
    expect(violations, `domain/ → application/ interdite :\n${violations.join('\n')}`).toEqual([]);
  });

  // ── Règle 4 : aucun controller HTTP n'utilise this.prisma (accès direct)
  // Exception documentée : AssistantController — ActionContext.prisma requis par le catalogue copilot.
  it('controllers HTTP ne font aucun accès this.prisma direct (hors AssistantController)', () => {
    const violations: string[] = [];
    for (const fichier of listerFichiersTs(CONTROLLERS)) {
      const contenu = readFileSync(fichier, 'utf8');
      if (contenu.includes('this.prisma')) {
        const nom = relative(CONTROLLERS, fichier);
        if (!nom.includes('AssistantController')) violations.push(nom);
      }
    }
    expect(violations, `this.prisma dans controllers (hors AssistantController) :\n${violations.join('\n')}`).toEqual([]);
  });
});
