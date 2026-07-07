import { Database } from "bun:sqlite";
const db = new Database("C:/Users/USER/.local/share/mimocode/mimocode.db", { readonly: true });

// Check schema
const tables = db.query("SELECT name, sql FROM sqlite_master WHERE type='table'").all() as any[];
for (const t of tables) {
  console.log(`\n--- Table: ${t.name} ---`);
  console.log(t.sql?.slice(0, 600));
}

db.close();
