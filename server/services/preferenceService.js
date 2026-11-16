import { getDatabase, runTransaction } from "../db/database.js";
import { getElectivesForStudent } from "./electiveService.js";
import { logAuditEvent } from "./auditService.js";

function mapWindowRow(row) {
  if (!row) return null;
  let branches = [];
  try {
    branches = typeof row.branches === "string" ? JSON.parse(row.branches) : row.branches || [];
  } catch (e) {
    branches = [row.branches];
  }

  return {
    id: row.id,
    name: row.name,
    branches,
    batch: row.batch,
    semester: row.semester,
    startDateTime: row.start_date_time,
    endDateTime: row.end_date_time,
    status: row.status,
    minPreferences: row.min_preferences,
    maxPreferences: row.max_preferences,
    description: row.description,
  };
}

export function getActiveWindow(cycleId = "slot_sem6_active") {
  const db = getDatabase();
  const row = db.prepare(`SELECT * FROM registration_windows WHERE id = ?`).get(cycleId) ||
              db.prepare(`SELECT * FROM registration_windows ORDER BY id ASC LIMIT 1`).get();
  return mapWindowRow(row);
}

export function getAllWindows() {
  const db = getDatabase();
  const rows = db.prepare(`SELECT * FROM registration_windows ORDER BY start_date_time DESC`).all();
  return rows.map(mapWindowRow);
}

export function getStudentPreferenceList(studentId, cycleId = "slot_sem6_active") {
  const db = getDatabase();
  const listRow = db.prepare(`
    SELECT id, student_id, cycle_id, status, submitted_at, created_at, updated_at
    FROM preference_lists
    WHERE student_id = ? AND cycle_id = ?
  `).get(studentId, cycleId);

  if (!listRow) {
    return {
      id: `pref_${studentId}`,
      studentId,
      cycleId,
      status: "DRAFT",
      submittedAt: null,
      items: [],
    };
  }

  const items = db.prepare(`
    SELECT elective_id AS electiveId, rank
    FROM preference_items
    WHERE preference_list_id = ?
    ORDER BY rank ASC
  `).all(listRow.id);

  return {
    id: listRow.id,
    studentId: listRow.student_id,
    cycleId: listRow.cycle_id,
    status: listRow.status,
    submittedAt: listRow.submitted_at,
    items,
  };
}

export function saveDraft(studentId, cycleId, items) {
  const listId = `pref_${studentId}`;
  return runTransaction((db) => {
    db.prepare(`
      INSERT INTO preference_lists (id, student_id, cycle_id, status, submitted_at, created_at, updated_at)
      VALUES (?, ?, ?, 'DRAFT', NULL, datetime('now'), datetime('now'))
      ON CONFLICT(student_id, cycle_id) DO UPDATE SET
        status = 'DRAFT',
        submitted_at = NULL,
        updated_at = datetime('now')
    `).run(listId, studentId, cycleId);

    // Replace items
    db.prepare(`DELETE FROM preference_items WHERE preference_list_id = ?`).run(listId);

    const insertItem = db.prepare(`
      INSERT INTO preference_items (id, preference_list_id, elective_id, rank)
      VALUES (?, ?, ?, ?)
    `);

    const normalizedItems = [];
    const seen = new Set();
    for (const item of items || []) {
      if (!seen.has(item.electiveId)) {
        seen.add(item.electiveId);
        normalizedItems.push({
          electiveId: item.electiveId,
          rank: normalizedItems.length + 1,
        });
      }
    }

    normalizedItems.forEach((item) => {
      insertItem.run(`pitem_${listId}_${item.rank}`, listId, item.electiveId, item.rank);
    });

    return {
      success: true,
      preferenceList: {
        id: listId,
        studentId,
        cycleId,
        status: "DRAFT",
        submittedAt: null,
        items: normalizedItems,
      },
    };
  });
}

export function submitPreferences(studentProfile, cycleId, items) {
  if (!studentProfile) {
    return { success: false, errors: ["Missing student academic profile."] };
  }

  const window = getActiveWindow(cycleId);
  if (!window || window.status !== "OPEN") {
    return {
      success: false,
      errors: ["Registration window is currently CLOSED. Preferences cannot be submitted."],
    };
  }

  const errors = [];
  const normalizedItems = (items || []).map((item, idx) => ({
    electiveId: item.electiveId,
    rank: idx + 1,
  }));

  const minCount = window.minPreferences || 3;
  const maxCount = window.maxPreferences || 5;

  if (normalizedItems.length < minCount) {
    errors.push(`You must select at least ${minCount} ranked elective choices (currently ${normalizedItems.length}).`);
  }
  if (normalizedItems.length > maxCount) {
    errors.push(`You cannot select more than ${maxCount} elective choices (currently ${normalizedItems.length}).`);
  }

  // Duplicate check
  const seenElectives = new Set();
  for (const item of normalizedItems) {
    if (seenElectives.has(item.electiveId)) {
      errors.push(`Duplicate elective selection found in preference list.`);
      break;
    }
    seenElectives.add(item.electiveId);
  }

  // Eligibility check
  const studentElectives = getElectivesForStudent(studentProfile, cycleId);
  const electiveMap = new Map();
  studentElectives.forEach((e) => electiveMap.set(e.id, e));

  for (const item of normalizedItems) {
    const elective = electiveMap.get(item.electiveId);
    if (!elective) {
      errors.push(`Selected course ID '${item.electiveId}' was not found in active catalogue.`);
    } else if (elective.status !== "ACTIVE") {
      errors.push(`Course '${elective.courseCode}' is inactive and cannot be selected.`);
    } else if (!elective.isEligible) {
      errors.push(`Ineligible for '${elective.courseCode}': ${elective.ineligibilityReason}`);
    }
  }

  if (errors.length > 0) {
    // Preserve draft so user doesn't lose selections
    saveDraft(studentProfile.studentId, cycleId, normalizedItems);
    return { success: false, errors };
  }

  // Validation passed - commit in transaction
  const listId = `pref_${studentProfile.studentId}`;
  const nowIso = new Date().toISOString();

  return runTransaction((db) => {
    db.prepare(`
      INSERT INTO preference_lists (id, student_id, cycle_id, status, submitted_at, created_at, updated_at)
      VALUES (?, ?, ?, 'SUBMITTED', ?, datetime('now'), datetime('now'))
      ON CONFLICT(student_id, cycle_id) DO UPDATE SET
        status = 'SUBMITTED',
        submitted_at = ?,
        updated_at = datetime('now')
    `).run(listId, studentProfile.studentId, cycleId, nowIso, nowIso);

    db.prepare(`DELETE FROM preference_items WHERE preference_list_id = ?`).run(listId);

    const insertItem = db.prepare(`
      INSERT INTO preference_items (id, preference_list_id, elective_id, rank)
      VALUES (?, ?, ?, ?)
    `);

    normalizedItems.forEach((item) => {
      insertItem.run(`pitem_${listId}_${item.rank}`, listId, item.electiveId, item.rank);
    });

    logAuditEvent(
      studentProfile.name,
      "student",
      "PREFERENCES_SUBMITTED",
      `Student ${studentProfile.studentId} submitted ${normalizedItems.length} ranked elective preferences.`
    );

    return {
      success: true,
      submittedAt: nowIso,
      preferenceList: {
        id: listId,
        studentId: studentProfile.studentId,
        cycleId,
        status: "SUBMITTED",
        submittedAt: nowIso,
        items: normalizedItems,
      },
    };
  });
}

export function reopenForModification(studentId, cycleId) {
  const window = getActiveWindow(cycleId);
  if (!window || window.status !== "OPEN") {
    return {
      success: false,
      error: "Cannot modify preferences because the registration window is CLOSED.",
    };
  }

  const db = getDatabase();
  db.prepare(`
    UPDATE preference_lists
    SET status = 'DRAFT', submitted_at = NULL, updated_at = datetime('now')
    WHERE student_id = ? AND cycle_id = ?
  `).run(studentId, cycleId);

  logAuditEvent(
    studentId,
    "student",
    "PREFERENCES_REOPENED",
    `Student ${studentId} reopened submitted preferences for modification.`
  );

  return { success: true };
}
