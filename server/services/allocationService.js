import { getDatabase, runTransaction } from "../db/database.js";
import { runAllocationEngine } from "../../src/services/allocationEngine.js";
import { getAllElectives } from "./electiveService.js";
import { getAllStudentProfiles } from "./authService.js";
import { logAuditEvent } from "./auditService.js";

export function getRuleConfig(cycleId = "slot_sem6_active") {
  const db = getDatabase();
  const row = db.prepare(`SELECT * FROM allocation_rule_configs WHERE cycle_id = ?`).get(cycleId) ||
              db.prepare(`SELECT * FROM allocation_rule_configs ORDER BY cycle_id ASC LIMIT 1`).get();

  if (!row) {
    return {
      cycleId,
      cycleName: "Spring 2026 Regular Open Elective Window (Sem 6)",
      tieBreakPolicy: "CGPA_MERIT",
      status: "NOT_STARTED",
      description: "Merit-based priority ordering by CGPA descending with FCFS tie-break.",
      maxAllocationsPerStudent: 1,
      lastRunAt: null,
      isPublished: false,
    };
  }

  return {
    cycleId: row.cycle_id,
    cycleName: row.cycle_name,
    tieBreakPolicy: row.tie_break_policy,
    status: row.status,
    description: row.description,
    maxAllocationsPerStudent: row.max_allocations_per_student,
    lastRunAt: row.last_run_at,
    isPublished: Boolean(row.is_published),
  };
}

export function updateRuleConfig(cycleId, updates, actorRole = "admin", actorName = "Academic Administrator") {
  if (!["admin", "sysadmin"].includes(actorRole)) {
    return { success: false, error: "Unauthorized: Only Academic Administrators can configure allocation rules." };
  }

  const db = getDatabase();
  const current = getRuleConfig(cycleId);
  const newPolicy = updates.tieBreakPolicy || current.tieBreakPolicy;
  const newDesc = updates.description || current.description;

  db.prepare(`
    UPDATE allocation_rule_configs
    SET tie_break_policy = ?, description = ?
    WHERE cycle_id = ?
  `).run(newPolicy, newDesc, cycleId);

  logAuditEvent(
    actorName,
    actorRole,
    "ALLOCATION_RULE_UPDATED",
    `Tie-break policy updated to '${newPolicy}' for cycle '${cycleId}'.`
  );

  return { success: true, config: getRuleConfig(cycleId) };
}

export function checkReadiness(cycleId = "slot_sem6_active") {
  const db = getDatabase();
  const electives = getAllElectives(cycleId);
  const submittedLists = db.prepare(`
    SELECT COUNT(*) AS count
    FROM preference_lists
    WHERE cycle_id = ? AND status = 'SUBMITTED'
  `).get(cycleId)?.count || 0;

  const ruleConfig = getRuleConfig(cycleId);

  const activeElectives = electives.filter((e) => e.status === "ACTIVE");
  const totalCapacity = activeElectives.reduce((sum, e) => sum + (e.capacity || 0), 0);
  const allPositiveCapacities = activeElectives.length > 0 && activeElectives.every((e) => e.capacity > 0);

  const checks = [
    {
      id: "active_electives",
      label: "Active Elective Courses Configured",
      passed: activeElectives.length > 0,
      message:
        activeElectives.length > 0
          ? `${activeElectives.length} active electives available.`
          : "No active electives found.",
    },
    {
      id: "valid_capacities",
      label: "Strict Positive Seat Capacities",
      passed: allPositiveCapacities,
      message: allPositiveCapacities
        ? `All ${activeElectives.length} active electives have positive seat capacities (Total: ${totalCapacity} seats).`
        : "Some electives have non-positive capacities.",
    },
    {
      id: "submitted_preferences",
      label: "Submitted Student Preferences Present",
      passed: submittedLists > 0,
      message:
        submittedLists > 0
          ? `${submittedLists} students have submitted verified ranked preferences.`
          : "Zero submitted preference lists found.",
    },
    {
      id: "approved_policy",
      label: "Approved Allocation & Tie-Break Policy",
      passed: Boolean(ruleConfig.tieBreakPolicy),
      message: `Configured Policy: ${ruleConfig.tieBreakPolicy} (${ruleConfig.description || "Deterministic rule set"})`,
    },
  ];

  const isReady = checks.every((c) => c.passed);
  return { isReady, checks };
}

export function executeAllocation(cycleId = "slot_sem6_active", actorRole = "admin", actorName = "Academic Administrator") {
  if (!["admin", "sysadmin"].includes(actorRole)) {
    return { success: false, error: "Unauthorized: Only Academic Administrators can initiate allocation." };
  }

  const readiness = checkReadiness(cycleId);
  if (!readiness.isReady) {
    return {
      success: false,
      error: "Allocation preconditions not met. Please review readiness checklist.",
      checks: readiness.checks,
    };
  }

  const db = getDatabase();
  const students = getAllStudentProfiles();
  const electives = getAllElectives(cycleId);
  const ruleConfig = getRuleConfig(cycleId);

  // Retrieve submitted preference lists with their ranked items
  const prefListRows = db.prepare(`
    SELECT id, student_id AS studentId, cycle_id AS cycleId, status, submitted_at AS submittedAt
    FROM preference_lists
    WHERE cycle_id = ? AND status = 'SUBMITTED'
  `).all(cycleId);

  const preferenceLists = prefListRows.map((pl) => {
    const items = db.prepare(`
      SELECT elective_id AS electiveId, rank
      FROM preference_items
      WHERE preference_list_id = ?
      ORDER BY rank ASC
    `).all(pl.id);

    return {
      ...pl,
      items,
    };
  });

  // Run the deterministic engine (reusing tested algorithm from src/services/allocationEngine.js)
  const engineOutput = runAllocationEngine(students, electives, preferenceLists, {
    tieBreakPolicy: ruleConfig.tieBreakPolicy,
    cycleId,
  });

  // Persist results atomically in a transaction
  return runTransaction((transactionDb) => {
    // Clear previous results for this cycle
    transactionDb.prepare(`DELETE FROM allocation_results WHERE cycle_id = ?`).run(cycleId);

    const insertResult = transactionDb.prepare(`
      INSERT INTO allocation_results (id, cycle_id, student_id, student_name, branch, semester, cgpa, elective_id, course_code, course_name, preference_rank, status, assigned_reason, allocated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const r of engineOutput.results) {
      insertResult.run(
        r.id || `res_${cycleId}_${r.studentId}`,
        cycleId,
        r.studentId,
        r.studentName,
        r.branch,
        r.semester,
        r.cgpa,
        r.electiveId || null,
        r.courseCode || r.electiveCode || null,
        r.courseName || r.electiveName || null,
        r.preferenceRank || null,
        r.status,
        r.assignedReason || r.reason || "",
        r.allocatedAt || new Date().toISOString()
      );
    }

    // Update rule config status
    const nowIso = new Date().toISOString();
    transactionDb.prepare(`
      UPDATE allocation_rule_configs
      SET status = 'COMPLETED', last_run_at = ?, is_published = 0
      WHERE cycle_id = ?
    `).run(nowIso, cycleId);

    const enrichedSummary = {
      ...engineOutput.summary,
      totalProcessed: engineOutput.summary.totalStudentsProcessed || engineOutput.results.length,
    };

    logAuditEvent(
      actorName,
      actorRole,
      "ALLOCATION_EXECUTED",
      `Allocated ${engineOutput.summary.totalAllocated} students, ${engineOutput.summary.totalUnallocated} unallocated across ${engineOutput.summary.totalElectives} electives.`
    );

    return {
      success: true,
      results: engineOutput.results.map((r) => ({
        ...r,
        courseCode: r.courseCode || r.electiveCode || null,
        courseName: r.courseName || r.electiveName || null,
        electiveCode: r.electiveCode || r.courseCode || null,
        electiveName: r.electiveName || r.courseName || null,
        assignedReason: r.assignedReason || r.reason || "",
        reason: r.reason || r.assignedReason || "",
      })),
      courseStats: engineOutput.courseStats,
      summary: enrichedSummary,
      executionLogs: engineOutput.executionLogs,
    };
  });
}

export function publishResults(cycleId = "slot_sem6_active", actorRole = "admin", actorName = "Academic Administrator") {
  if (!["admin", "sysadmin"].includes(actorRole)) {
    return { success: false, error: "Unauthorized: Only Academic Administrators can publish results." };
  }

  const db = getDatabase();
  const config = getRuleConfig(cycleId);
  if (config.status !== "COMPLETED") {
    return { success: false, error: "Cannot publish results before running allocation engine." };
  }

  db.prepare(`
    UPDATE allocation_rule_configs
    SET is_published = 1
    WHERE cycle_id = ?
  `).run(cycleId);

  logAuditEvent(actorName, actorRole, "RESULTS_PUBLISHED", `Official elective allocation results published for cycle ${cycleId}.`);

  return { success: true };
}

export function resetAllocation(cycleId = "slot_sem6_active", actorRole = "admin", actorName = "Academic Administrator") {
  if (!["admin", "sysadmin"].includes(actorRole)) {
    return { success: false, error: "Unauthorized." };
  }

  return runTransaction((db) => {
    db.prepare(`DELETE FROM allocation_results WHERE cycle_id = ?`).run(cycleId);
    db.prepare(`
      UPDATE allocation_rule_configs
      SET status = 'NOT_STARTED', is_published = 0, last_run_at = NULL
      WHERE cycle_id = ?
    `).run(cycleId);

    logAuditEvent(actorName, actorRole, "ALLOCATION_RESET", `Allocation results reset for cycle ${cycleId}.`);
    return { success: true };
  });
}

export function getAllocationResults(cycleId = "slot_sem6_active") {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT ar.id, ar.cycle_id AS cycleId, ar.student_id AS studentId, ar.student_name AS studentName,
           ar.branch, ar.semester, ar.cgpa, ar.elective_id AS electiveId,
           COALESCE(ar.course_code, e.course_code) AS courseCode,
           COALESCE(ar.course_name, e.name) AS courseName,
           ar.preference_rank AS preferenceRank, ar.status,
           ar.assigned_reason AS assignedReason, ar.allocated_at AS allocatedAt
    FROM allocation_results ar
    LEFT JOIN electives e ON ar.elective_id = e.id
    WHERE ar.cycle_id = ?
    ORDER BY ar.status ASC, ar.cgpa DESC
  `).all(cycleId);

  return rows.map((r) => ({
    ...r,
    electiveCode: r.courseCode || "",
    electiveName: r.courseName || "",
    reason: r.assignedReason || "",
  }));
}

export function getStudentResult(studentId, cycleId = "slot_sem6_active", bypassPublish = false) {
  const config = getRuleConfig(cycleId);
  if (!config.isPublished && !bypassPublish) {
    return {
      isAvailable: false,
      reason: "Official allocation results have not been published by the Academic Administrator yet.",
    };
  }

  const db = getDatabase();
  const result = db.prepare(`
    SELECT ar.id, ar.cycle_id AS cycleId, ar.student_id AS studentId, ar.student_name AS studentName,
           ar.branch, ar.semester, ar.cgpa, ar.elective_id AS electiveId,
           COALESCE(ar.course_code, e.course_code) AS courseCode,
           COALESCE(ar.course_name, e.name) AS courseName,
           ar.preference_rank AS preferenceRank, ar.status,
           ar.assigned_reason AS assignedReason, ar.allocated_at AS allocatedAt
    FROM allocation_results ar
    LEFT JOIN electives e ON ar.elective_id = e.id
    WHERE UPPER(ar.student_id) = UPPER(?) AND ar.cycle_id = ?
  `).get(studentId, cycleId);

  if (!result) {
    return {
      isAvailable: false,
      reason: "No allocation record found for this student.",
    };
  }

  return {
    isAvailable: true,
    result: {
      ...result,
      electiveCode: result.courseCode || "",
      electiveName: result.courseName || "",
      reason: result.assignedReason || (result.status === "ALLOCATED" ? "Allocated based on academic merit priority." : "No elective assigned in regular round."),
    },
  };
}
