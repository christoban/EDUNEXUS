import { Database } from "bun:sqlite";
const db = new Database("C:/Users/USER/.local/share/mimocode/mimocode.db", { readonly: true });

const projId = "bfff4f30-16eb-4f0f-bba1-f78cd942ade4";

// Use history_fts for full-text search
console.log("=== USER MESSAGES WITH RULE KEYWORDS (via history_fts) ===");
const keywords = ["toujours", "jamais", "règle", "décision", "important", "convention", "il faut", "never", "always", "absolument", "obligatoire", "interdit"];
for (const kw of keywords) {
  const rows = db.query(`
    SELECT session_id, body, time_created
    FROM history_fts
    WHERE project_id = ? AND kind = 'user' AND body MATCH ?
    ORDER BY time_created DESC
    LIMIT 2
  `).all(projId, kw) as any[];

  if (rows.length > 0) {
    console.log(`\n--- Keyword: "${kw}" (${rows.length} hits) ---`);
    for (const r of rows) {
      const d = new Date(r.time_created);
      console.log(`  [${d.toISOString().slice(0,10)}] ${r.session_id}`);
      console.log(`  ${r.body.slice(0, 600)}`);
    }
  }
}

// Also search for architecture decisions
console.log("\n\n=== ARCHITECTURE/DESIGN DECISIONS ===");
const archKeywords = ["architecture", "hexagonal", "prisma", "next.js", "bun", "pattern", "backend", "frontend"];
for (const kw of archKeywords) {
  const rows = db.query(`
    SELECT session_id, body, time_created
    FROM history_fts
    WHERE project_id = ? AND kind = 'user' AND body MATCH ?
    ORDER BY time_created DESC
    LIMIT 1
  `).all(projId, kw) as any[];

  if (rows.length > 0) {
    console.log(`\n--- Keyword: "${kw}" (${rows.length} hits) ---`);
    for (const r of rows) {
      const d = new Date(r.time_created);
      console.log(`  [${d.toISOString().slice(0,10)}] ${r.session_id}`);
      console.log(`  ${r.body.slice(0, 500)}`);
    }
  }
}

db.close();
