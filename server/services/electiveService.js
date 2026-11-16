import { getDatabase, runTransaction } from "../db/database.js";
import { logAuditEvent } from "./auditService.js";

/**
 * Format raw elective row from DB to JS domain object
 */
function mapElectiveRow(row, allocatedCount = 0) {
  let branches = [];
  let semesters = [];
  try {
    branches = typeof row.applicable_branches === "string" ? JSON.parse(row.applicable_branches) : row.applicable_branches || [];
  } catch (e) {
    branches = [row.applicable_branches];
  }
  try {
    semesters = typeof row.applicable_semesters === "string" ? JSON.parse(row.applicable_semesters) : row.applicable_semesters || [];
  } catch (e) {
    semesters = [row.applicable_semesters];
  }

  return {
    id: row.id,
    courseCode: row.course_code,
    name: row.name,
    description: row.description || "",
    department: row.department,
    applicableBranches: branches,
    applicableSemesters: semesters,
    capacity: row.capacity,
    minCgpa: row.min_cgpa,
    prerequisites: row.prerequisites || "None",
    facultyName: row.faculty_name || "Faculty Coordinator",
    status: row.status,
    allocatedCount,
    availableSeats: Math.max(0, row.capacity - allocatedCount),
  };
}

export function getAllElectives(cycleId = "slot_sem6_active") {
  const db = getDatabase();
  const electives = db.prepare(`SELECT * FROM electives ORDER BY course_code ASC`).all();

  // Get allocated student counts from allocation_results for active cycle
  const allocations = db.prepare(`
    SELECT elective_id, COUNT(*) AS count
    FROM allocation_results
    WHERE status = 'ALLOCATED' AND (cycle_id = ? OR ? IS NULL)
    GROUP BY elective_id
  `).all(cycleId, cycleId);

  const allocMap = new Map();
  allocations.forEach((a) => {
    if (a.elective_id) allocMap.set(a.elective_id, a.count);
  });

  return electives.map((e) => mapElectiveRow(e, allocMap.get(e.id) || 0));
}

export function getElectiveById(id, cycleId = "slot_sem6_active") {
  const db = getDatabase();
  const row = db.prepare(`SELECT * FROM electives WHERE id = ?`).get(id);
  if (!row) return null;

  const alloc = db.prepare(`
    SELECT COUNT(*) AS count
    FROM allocation_results
    WHERE elective_id = ? AND status = 'ALLOCATED' AND (cycle_id = ? OR ? IS NULL)
  `).get(id, cycleId, cycleId);

  return mapElectiveRow(row, alloc?.count || 0);
}

export function getElectivesForStudent(studentProfile, cycleId = "slot_sem6_active") {
  if (!studentProfile) return [];
  const electives = getAllElectives(cycleId);

  return electives.map((elective) => {
    const isBranchEligible =
      !elective.applicableBranches ||
      elective.applicableBranches.length === 0 ||
      elective.applicableBranches.includes(studentProfile.branch);

    const isSemesterEligible =
      !elective.applicableSemesters ||
      elective.applicableSemesters.length === 0 ||
      elective.applicableSemesters.includes(Number(studentProfile.semester));

    const isCgpaEligible =
      !elective.minCgpa || elective.minCgpa === 0 || studentProfile.cgpa >= elective.minCgpa;

    const isEligible = isBranchEligible && isSemesterEligible && isCgpaEligible;

    let ineligibilityReason = null;
    if (!isBranchEligible) {
      ineligibilityReason = `Restricted to branches: ${elective.applicableBranches.join(", ")}`;
    } else if (!isSemesterEligible) {
      ineligibilityReason = `Restricted to Semesters: ${elective.applicableSemesters.join(", ")}`;
    } else if (!isCgpaEligible) {
      ineligibilityReason = `Requires min CGPA ${elective.minCgpa.toFixed(2)} (Student CGPA: ${studentProfile.cgpa.toFixed(2)})`;
    }

    return {
      ...elective,
      isEligible,
      ineligibilityReason,
    };
  });
}

export function createElective(data, actorRole = "faculty", actorName = "Faculty Coordinator") {
  if (!["faculty", "admin", "sysadmin"].includes(actorRole)) {
    return { success: false, errors: ["Unauthorized: Only Faculty Coordinators or Administrators can create electives."] };
  }

  const errors = [];
  if (!data.courseCode || !data.courseCode.trim()) errors.push("Course Code is required.");
  if (!data.name || !data.name.trim()) errors.push("Course Name is required.");
  if (!data.department || !data.department.trim()) errors.push("Department is required.");
  
  const capacity = parseInt(data.capacity, 10);
  if (isNaN(capacity) || capacity <= 0) {
    errors.push("Seat Capacity must be a positive whole integer greater than zero.");
  }

  const minCgpa = data.minCgpa !== undefined && data.minCgpa !== null && data.minCgpa !== ""
    ? parseFloat(data.minCgpa)
    : 0.0;
  if (isNaN(minCgpa) || minCgpa < 0 || minCgpa > 10) {
    errors.push("Minimum CGPA must be a valid number between 0.0 and 10.0.");
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const db = getDatabase();
  const normalizedCode = data.courseCode.trim().toUpperCase();

  const existing = db.prepare(`SELECT id FROM electives WHERE course_code = ?`).get(normalizedCode);
  if (existing) {
    return { success: false, errors: [`Course Code ${normalizedCode} already exists.`] };
  }

  const id = `el_${Date.now()}`;
  const branches = JSON.stringify(Array.isArray(data.applicableBranches) ? data.applicableBranches : ["CSE"]);
  const semesters = JSON.stringify(Array.isArray(data.applicableSemesters) ? data.applicableSemesters.map(Number) : [6]);

  db.prepare(`
    INSERT INTO electives (id, course_code, name, description, department, applicable_branches, applicable_semesters, capacity, min_cgpa, prerequisites, faculty_name, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    normalizedCode,
    data.name.trim(),
    data.description || "",
    data.department.trim(),
    branches,
    semesters,
    capacity,
    isNaN(minCgpa) ? 0.0 : minCgpa,
    data.prerequisites || "None",
    data.facultyName || actorName,
    data.status || "ACTIVE"
  );

  logAuditEvent(actorName, actorRole, "ELECTIVE_CREATED", `Created elective ${normalizedCode} (${data.name}) with capacity ${capacity}`);

  return { success: true, elective: getElectiveById(id) };
}

export function updateElective(id, data, actorRole = "faculty", actorName = "Faculty Coordinator") {
  if (!["faculty", "admin", "sysadmin"].includes(actorRole)) {
    return { success: false, errors: ["Unauthorized: Only Faculty Coordinators or Administrators can edit electives."] };
  }

  const current = getElectiveById(id);
  if (!current) {
    return { success: false, errors: ["Elective not found."] };
  }

  const errors = [];
  if (!data.name || !data.name.trim()) errors.push("Course Name cannot be empty.");
  
  const capacity = parseInt(data.capacity, 10);
  if (isNaN(capacity) || capacity <= 0) {
    errors.push("Seat Capacity must be a positive whole integer greater than zero.");
  } else if (capacity < current.allocatedCount) {
    errors.push(
      `Cannot reduce capacity to ${capacity} seats because ${current.allocatedCount} students have already been allocated to this course.`
    );
  }

  const minCgpa = data.minCgpa !== undefined && data.minCgpa !== null && data.minCgpa !== ""
    ? parseFloat(data.minCgpa)
    : 0.0;
  if (isNaN(minCgpa) || minCgpa < 0 || minCgpa > 10) {
    errors.push("Minimum CGPA must be a valid number between 0.0 and 10.0.");
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const db = getDatabase();
  const branches = JSON.stringify(Array.isArray(data.applicableBranches) ? data.applicableBranches : current.applicableBranches);
  const semesters = JSON.stringify(Array.isArray(data.applicableSemesters) ? data.applicableSemesters.map(Number) : current.applicableSemesters);

  db.prepare(`
    UPDATE electives
    SET name = ?, description = ?, department = ?, applicable_branches = ?, applicable_semesters = ?, capacity = ?, min_cgpa = ?, prerequisites = ?, faculty_name = ?, status = ?
    WHERE id = ?
  `).run(
    data.name.trim(),
    data.description || "",
    data.department || current.department,
    branches,
    semesters,
    capacity,
    isNaN(minCgpa) ? 0.0 : minCgpa,
    data.prerequisites || "None",
    data.facultyName || current.facultyName,
    data.status || "ACTIVE",
    id
  );

  logAuditEvent(actorName, actorRole, "ELECTIVE_UPDATED", `Updated elective ${current.courseCode} (Capacity: ${capacity})`);

  return { success: true, elective: getElectiveById(id) };
}

export function deleteElective(id, actorRole = "faculty", actorName = "Faculty Coordinator") {
  if (!["faculty", "admin", "sysadmin"].includes(actorRole)) {
    return { success: false, error: "Unauthorized." };
  }

  const current = getElectiveById(id);
  if (!current) {
    return { success: false, error: "Elective not found." };
  }

  if (current.allocatedCount > 0) {
    return {
      success: false,
      error: `Cannot delete elective '${current.courseCode}' because ${current.allocatedCount} students are already allocated to it.`,
    };
  }

  const db = getDatabase();
  db.prepare(`DELETE FROM electives WHERE id = ?`).run(id);

  logAuditEvent(actorName, actorRole, "ELECTIVE_DELETED", `Deleted elective ${current.courseCode}`);

  return { success: true };
}
