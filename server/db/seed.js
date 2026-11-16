import { getDatabase, runTransaction, hashPassword, generateSalt } from "./database.js";
import { INITIAL_SEED_DATA } from "../../src/data/seedData.js";

const DEFAULT_DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD || "demo123";

/**
 * Seed database with initial canonical demo data
 * @param {boolean} forceReset - If true, clears existing tables first
 * @param {string} actorName - Actor performing reset
 */
export function seedDatabase(forceReset = false, actorName = "System Seed Initializer") {
  const db = getDatabase();

  return runTransaction((transactionDb) => {
    if (forceReset) {
      // Clear in reverse dependency order
      transactionDb.exec("DELETE FROM sessions;");
      transactionDb.exec("DELETE FROM allocation_results;");
      transactionDb.exec("DELETE FROM preference_items;");
      transactionDb.exec("DELETE FROM preference_lists;");
      transactionDb.exec("DELETE FROM allocation_rule_configs;");
      transactionDb.exec("DELETE FROM electives;");
      transactionDb.exec("DELETE FROM student_profiles;");
      transactionDb.exec("DELETE FROM registration_windows;");
      transactionDb.exec("DELETE FROM users;");
      transactionDb.exec("DELETE FROM audit_events;");
    }

    // 1. Seed Users
    const checkUser = transactionDb.prepare("SELECT COUNT(*) AS count FROM users").get();
    if (checkUser.count === 0 || forceReset) {
      const insertUser = transactionDb.prepare(`
        INSERT OR REPLACE INTO users (id, email, password_hash, password_salt, name, role, department, designation, student_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);

      for (const u of INITIAL_SEED_DATA.users) {
        const salt = generateSalt();
        const hash = hashPassword(DEFAULT_DEMO_PASSWORD, salt);
        insertUser.run(
          u.id,
          u.email.toLowerCase(),
          hash,
          salt,
          u.name,
          u.role,
          u.department || null,
          u.designation || null,
          u.studentId || null
        );
      }
    }

    // 2. Seed Registration Windows
    const checkWindows = transactionDb.prepare("SELECT COUNT(*) AS count FROM registration_windows").get();
    if (checkWindows.count === 0 || forceReset) {
      const insertWindow = transactionDb.prepare(`
        INSERT OR REPLACE INTO registration_windows (id, name, branches, batch, semester, start_date_time, end_date_time, status, min_preferences, max_preferences, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const w of INITIAL_SEED_DATA.registrationWindows) {
        insertWindow.run(
          w.id,
          w.name,
          JSON.stringify(w.branches),
          w.batch,
          w.semester,
          w.startDateTime,
          w.endDateTime,
          w.status,
          w.minPreferences || 3,
          w.maxPreferences || 5,
          w.description || null
        );
      }
    }

    // 3. Seed Student Profiles
    const checkStudents = transactionDb.prepare("SELECT COUNT(*) AS count FROM student_profiles").get();
    if (checkStudents.count === 0 || forceReset) {
      const insertStudent = transactionDb.prepare(`
        INSERT OR REPLACE INTO student_profiles (student_id, user_id, name, branch, batch, semester, cgpa, slot_id, email)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const s of INITIAL_SEED_DATA.studentProfiles) {
        insertStudent.run(
          s.studentId,
          s.userId,
          s.name,
          s.branch,
          s.batch,
          s.semester,
          s.cgpa,
          s.slotId || null,
          s.email
        );
      }
    }

    // 4. Seed Electives
    const checkElectives = transactionDb.prepare("SELECT COUNT(*) AS count FROM electives").get();
    if (checkElectives.count === 0 || forceReset) {
      const insertElective = transactionDb.prepare(`
        INSERT OR REPLACE INTO electives (id, course_code, name, description, department, applicable_branches, applicable_semesters, capacity, min_cgpa, prerequisites, faculty_name, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const e of INITIAL_SEED_DATA.electives) {
        insertElective.run(
          e.id,
          e.courseCode.toUpperCase(),
          e.name,
          e.description || "",
          e.department,
          JSON.stringify(e.applicableBranches),
          JSON.stringify(e.applicableSemesters),
          e.capacity,
          e.minCgpa || 0.0,
          e.prerequisites || "None",
          e.facultyName || "Faculty Coordinator",
          e.status || "ACTIVE"
        );
      }
    }

    // 5. Seed Allocation Rule Config
    const checkConfig = transactionDb.prepare("SELECT COUNT(*) AS count FROM allocation_rule_configs").get();
    if (checkConfig.count === 0 || forceReset) {
      const insertConfig = transactionDb.prepare(`
        INSERT OR REPLACE INTO allocation_rule_configs (cycle_id, cycle_name, tie_break_policy, status, description, max_allocations_per_student, last_run_at, is_published)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const cfg = INITIAL_SEED_DATA.allocationRuleConfig;
      if (cfg) {
        insertConfig.run(
          cfg.cycleId || "slot_sem6_active",
          cfg.cycleName || "Spring 2026 Regular Open Elective Window (Sem 6)",
          cfg.tieBreakPolicy || "CGPA_MERIT",
          cfg.status || "NOT_STARTED",
          cfg.description || "Merit-based priority ordering by CGPA descending with FCFS tie-break.",
          cfg.maxAllocationsPerStudent || 1,
          cfg.lastRunAt || null,
          cfg.isPublished ? 1 : 0
        );
      }
    }

    // 6. Seed Preference Lists & Ranked Items
    const checkPrefs = transactionDb.prepare("SELECT COUNT(*) AS count FROM preference_lists").get();
    if (checkPrefs.count === 0 || forceReset) {
      const insertPrefList = transactionDb.prepare(`
        INSERT OR REPLACE INTO preference_lists (id, student_id, cycle_id, status, submitted_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `);

      const insertPrefItem = transactionDb.prepare(`
        INSERT OR REPLACE INTO preference_items (id, preference_list_id, elective_id, rank)
        VALUES (?, ?, ?, ?)
      `);

      for (const pref of INITIAL_SEED_DATA.preferenceLists) {
        insertPrefList.run(
          pref.id,
          pref.studentId,
          pref.cycleId || "slot_sem6_active",
          pref.status,
          pref.submittedAt || null
        );

        if (Array.isArray(pref.items)) {
          pref.items.forEach((item, idx) => {
            insertPrefItem.run(
              `pitem_${pref.id}_${idx + 1}`,
              pref.id,
              item.electiveId,
              item.rank || idx + 1
            );
          });
        }
      }
    }

    // 7. Seed Baseline Audit Events
    const checkAudit = transactionDb.prepare("SELECT COUNT(*) AS count FROM audit_events").get();
    if (checkAudit.count === 0 || forceReset) {
      const insertAudit = transactionDb.prepare(`
        INSERT OR REPLACE INTO audit_events (id, actor, role, action, details, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const resetEvent = {
        id: `aud_seed_${Date.now()}`,
        actor: actorName,
        role: "sysadmin",
        action: forceReset ? "RESET_TO_SEED_DATA" : "INITIAL_DATABASE_SEED",
        details: forceReset
          ? "Database successfully restored to canonical baseline seed data."
          : "Initial database initialization completed.",
        timestamp: new Date().toISOString(),
      };

      const seedEvents = [resetEvent, ...(INITIAL_SEED_DATA.auditEvents || [])];
      for (const aud of seedEvents) {
        insertAudit.run(
          aud.id,
          aud.actor,
          aud.role,
          aud.action,
          aud.details,
          aud.timestamp || new Date().toISOString()
        );
      }
    }

    const counts = {
      users: transactionDb.prepare("SELECT COUNT(*) AS c FROM users").get().c,
      students: transactionDb.prepare("SELECT COUNT(*) AS c FROM student_profiles").get().c,
      electives: transactionDb.prepare("SELECT COUNT(*) AS c FROM electives").get().c,
      preferenceLists: transactionDb.prepare("SELECT COUNT(*) AS c FROM preference_lists").get().c,
      preferenceItems: transactionDb.prepare("SELECT COUNT(*) AS c FROM preference_items").get().c,
    };

    console.log("[ECAS Database] Seed completed successfully:", counts);
    return counts;
  });
}

// Allow CLI execution: `node server/db/seed.js`
if (process.argv[1] && process.argv[1].endsWith("seed.js")) {
  const force = process.argv.includes("--reset");
  console.log(`[ECAS Database] Running seed (forceReset: ${force})...`);
  const result = seedDatabase(force, "CLI Seed Script");
  console.log("[ECAS Database] Done! Counts:", result);
}

