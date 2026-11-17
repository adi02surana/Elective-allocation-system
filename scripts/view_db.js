import { getDatabase } from "../server/db/database.js";

const args = process.argv.slice(2);
const isWatch = args.includes("--watch") || args.includes("-w");
const specifiedTable = args.find((a) => !a.startsWith("-"));

function displayTables() {
  const db = getDatabase();
  console.clear();
  console.log("================================================================================");
  console.log("             ECAS LIVE DATABASE TABLE INSPECTOR (SQLite: ecas.db)               ");
  console.log(`             Timestamp: ${new Date().toLocaleTimeString()}                      `);
  console.log("================================================================================\n");

  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC")
    .all();

  if (!specifiedTable) {
    console.log("AVAILABLE TABLES & CURRENT ROW COUNTS:");
    console.log("--------------------------------------------------------------------------------");
    for (const t of tables) {
      const count = db.prepare(`SELECT COUNT(*) AS count FROM ${t.name}`).get().count;
      console.log(` • ${t.name.padEnd(28)} : ${count} entries`);
    }
    console.log("--------------------------------------------------------------------------------\n");

    // Show quick status summary of preference_lists
    console.log("CURRENT PREFERENCE LISTS STATUS (preference_lists):");
    console.log("--------------------------------------------------------------------------------");
    const prefLists = db.prepare("SELECT id, student_id, status, submitted_at FROM preference_lists ORDER BY student_id ASC").all();
    if (prefLists.length === 0) {
      console.log(" (No preference lists recorded yet)");
    } else {
      console.table(prefLists);
    }

    console.log("\nTIP: Run 'node scripts/view_db.js <tableName>' (e.g. preference_items, electives, allocation_results)");
    if (isWatch) {
      console.log("WATCH MODE ACTIVE: Watching ecas.db for live updates (Ctrl+C to stop)...");
    }
  } else {
    // Show specific table
    const tableExists = tables.some((t) => t.name.toLowerCase() === specifiedTable.toLowerCase());
    if (!tableExists) {
      console.log(`Table '${specifiedTable}' not found in ecas.db!`);
      console.log("Available tables:", tables.map((t) => t.name).join(", "));
      return;
    }

    const matchedName = tables.find((t) => t.name.toLowerCase() === specifiedTable.toLowerCase()).name;
    const rows = db.prepare(`SELECT * FROM ${matchedName} LIMIT 100`).all();
    console.log(`TABLE ENTRIES: ${matchedName} (${rows.length} rows):`);
    console.log("--------------------------------------------------------------------------------");
    if (rows.length === 0) {
      console.log(`(Table '${matchedName}' is currently empty)`);
    } else {
      console.table(rows);
    }
    if (isWatch) {
      console.log("\nWATCH MODE ACTIVE: Watching for live updates (Ctrl+C to stop)...");
    }
  }
}

displayTables();

if (isWatch) {
  setInterval(displayTables, 1500);
}
