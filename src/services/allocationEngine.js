/**
 * Centralized Elective Allocation Engine (Team T016)
 * 
 * Deterministic allocation algorithm module implementing Serial Priority Allocation:
 * 1. Reads submitted preference lists for the active cycle.
 * 2. Reads student academic profiles (branch, semester, CGPA).
 * 3. Reads course eligibility, status, and capacity.
 * 4. Orders students by configured deterministic tie-breaking policy (default: CGPA merit with FCFS secondary tie-break).
 * 5. Iterates through each student's ranked choices in order (Rank 1, 2, 3...).
 * 6. Validates eligibility (branch, semester, minimum CGPA) and remaining capacity at decision time.
 * 7. When a course is full or student is ineligible, immediately considers the next preference.
 * 8. Allocates at most one elective per student. Total allocations never exceed course capacity.
 * 9. If no preference can be satisfied, marks the student as UNALLOCATED with an explicit reason.
 * 10. Generates transparent audit trails and summary metrics.
 */

/**
 * Execute the allocation algorithm
 * @param {Array} students - Array of StudentProfile objects
 * @param {Array} electives - Array of Elective course objects
 * @param {Array} preferenceLists - Array of submitted PreferenceList objects
 * @param {Object} ruleConfig - { tieBreakPolicy: 'CGPA_MERIT' | 'FIRST_COME_FIRST_SERVED' | 'STUDENT_ID', cycleId: string }
 * @returns {Object} { results, courseStats, summary, executionLogs }
 */
export function runAllocationEngine(students, electives, preferenceLists, ruleConfig = {}) {
  const policy = ruleConfig.tieBreakPolicy || "CGPA_MERIT";
  const cycleId = ruleConfig.cycleId || null;
  const executionLogs = [];

  const log = (msg) => {
    executionLogs.push(`[${new Date().toISOString()}] ${msg}`);
  };

  log(`Starting allocation engine run for cycle: ${cycleId || "All active"}`);
  log(`Selected deterministic tie-break policy: ${policy}`);

  // Create lookup maps
  const studentMap = new Map();
  students.forEach((s) => studentMap.set(s.studentId, s));

  const electiveMap = new Map();
  electives.forEach((e) => electiveMap.set(e.id, { ...e }));

  // Track allocated students per elective
  // electiveId -> Array<{ studentId, studentName, cgpa, rank, timestamp }>
  const electiveSeats = new Map();
  electives.forEach((e) => {
    electiveSeats.set(e.id, []);
  });

  // Filter only SUBMITTED preference lists for this cycle
  const validPrefLists = preferenceLists.filter(
    (p) => p.status === "SUBMITTED" && (!cycleId || p.cycleId === cycleId)
  );

  log(`Found ${validPrefLists.length} submitted preference lists for processing.`);

  // Combine student profile with their submitted preference list
  const studentQueue = [];
  validPrefLists.forEach((prefList) => {
    const student = studentMap.get(prefList.studentId);
    if (student) {
      studentQueue.push({
        student,
        prefList,
      });
    } else {
      log(`Warning: Preference list found for unknown studentId ${prefList.studentId}`);
    }
  });

  // Deterministic sorting based on configured tie-break policy
  studentQueue.sort((a, b) => {
    if (policy === "CGPA_MERIT") {
      // 1. CGPA Descending
      const cgpaDiff = (b.student.cgpa || 0) - (a.student.cgpa || 0);
      if (Math.abs(cgpaDiff) > 0.0001) return cgpaDiff;

      // 2. Tie-break: Submission time Ascending (First-Come First-Served)
      const timeA = new Date(a.prefList.submittedAt || 0).getTime();
      const timeB = new Date(b.prefList.submittedAt || 0).getTime();
      if (timeA !== timeB) return timeA - timeB;

      // 3. Final tie-break: Student Roll Number Ascending (deterministic)
      return a.student.studentId.localeCompare(b.student.studentId);
    }

    if (policy === "FIRST_COME_FIRST_SERVED") {
      const timeA = new Date(a.prefList.submittedAt || 0).getTime();
      const timeB = new Date(b.prefList.submittedAt || 0).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return (b.student.cgpa || 0) - (a.student.cgpa || 0);
    }

    if (policy === "STUDENT_ID") {
      return a.student.studentId.localeCompare(b.student.studentId);
    }

    return 0;
  });

  log(`Student priority order established (${studentQueue.length} students):`);
  studentQueue.forEach((entry, idx) => {
    log(
      ` Priority #${idx + 1}: ${entry.student.name} (${entry.student.studentId}) - CGPA: ${entry.student.cgpa.toFixed(
        2
      )}, Submitted: ${entry.prefList.submittedAt}`
    );
  });

  const results = [];

  // Process each student in priority order
  studentQueue.forEach((entry, priorityIndex) => {
    const { student, prefList } = entry;
    // Sort preferences by rank ascending (1, 2, 3...)
    const sortedPrefs = [...prefList.items].sort((a, b) => a.rank - b.rank);

    let allocatedChoice = null;
    let failureReasons = [];

    log(`\nEvaluating preferences for student: ${student.name} (${student.studentId}, CGPA: ${student.cgpa})`);

    for (const pref of sortedPrefs) {
      const elective = electiveMap.get(pref.electiveId);

      if (!elective) {
        const r = `Choice #${pref.rank}: Elective ID '${pref.electiveId}' not found in active catalogue.`;
        log(`  ❌ ${r}`);
        failureReasons.push(r);
        continue;
      }

      if (elective.status !== "ACTIVE") {
        const r = `Choice #${pref.rank} (${elective.courseCode}): Course is marked INACTIVE.`;
        log(`  ❌ ${r}`);
        failureReasons.push(r);
        continue;
      }

      // 1. Check branch eligibility
      if (
        elective.applicableBranches &&
        elective.applicableBranches.length > 0 &&
        !elective.applicableBranches.includes(student.branch)
      ) {
        const r = `Choice #${pref.rank} (${elective.courseCode}): Branch mismatch. Course open only to [${elective.applicableBranches.join(
          ", "
        )}]; student is from ${student.branch}.`;
        log(`  ❌ ${r}`);
        failureReasons.push(r);
        continue;
      }

      // 2. Check semester eligibility
      if (
        elective.applicableSemesters &&
        elective.applicableSemesters.length > 0 &&
        !elective.applicableSemesters.includes(student.semester)
      ) {
        const r = `Choice #${pref.rank} (${elective.courseCode}): Semester mismatch. Course offered for Sem [${elective.applicableSemesters.join(
          ", "
        )}]; student is in Sem ${student.semester}.`;
        log(`  ❌ ${r}`);
        failureReasons.push(r);
        continue;
      }

      // 3. Check minimum CGPA eligibility
      if (elective.minCgpa && elective.minCgpa > 0 && student.cgpa < elective.minCgpa) {
        const r = `Choice #${pref.rank} (${elective.courseCode}): Ineligible due to CGPA threshold. Requires min CGPA ${elective.minCgpa.toFixed(
          2
        )}, student has ${student.cgpa.toFixed(2)}.`;
        log(`  ❌ ${r}`);
        failureReasons.push(r);
        continue;
      }

      // 4. Check available capacity
      const currentAssigned = electiveSeats.get(pref.electiveId) || [];
      if (currentAssigned.length >= elective.capacity) {
        const r = `Choice #${pref.rank} (${elective.courseCode}): Course capacity reached (${currentAssigned.length}/${elective.capacity} seats taken by higher merit students).`;
        log(`  ❌ ${r}`);
        failureReasons.push(r);
        continue;
      }

      // Allocation successful!
      currentAssigned.push({
        studentId: student.studentId,
        studentName: student.name,
        cgpa: student.cgpa,
        rank: pref.rank,
        timestamp: new Date().toISOString(),
      });
      electiveSeats.set(pref.electiveId, currentAssigned);

      allocatedChoice = {
        elective,
        rank: pref.rank,
        assignedCount: currentAssigned.length,
        capacity: elective.capacity,
      };

      log(
        `  ✅ ALLOCATED Choice #${pref.rank} (${elective.courseCode} - ${elective.name}). Remaining seats: ${
          elective.capacity - currentAssigned.length
        }/${elective.capacity}`
      );
      break; // Allocate at most one elective per student
    }

    if (allocatedChoice) {
      let reasonText = "";
      if (allocatedChoice.rank === 1) {
        reasonText = `Allocated 1st Preference based on academic priority (CGPA: ${student.cgpa.toFixed(2)}).`;
      } else {
        const skippedSummary = failureReasons.length > 0 ? ` [Prior choices skipped: ${failureReasons.join(" ")}]` : "";
        reasonText = `Allocated Preference #${allocatedChoice.rank}. Higher choices were either full or eligibility criteria were not met.${skippedSummary}`;
      }

      results.push({
        id: `res_${student.studentId}_${Date.now()}`,
        studentId: student.studentId,
        studentName: student.name,
        branch: student.branch,
        batch: student.batch,
        semester: student.semester,
        cgpa: student.cgpa,
        cycleId,
        status: "ALLOCATED",
        electiveId: allocatedChoice.elective.id,
        electiveCode: allocatedChoice.elective.courseCode,
        electiveName: allocatedChoice.elective.name,
        preferenceRank: allocatedChoice.rank,
        reason: reasonText,
        priorityIndex: priorityIndex + 1,
        processedAt: new Date().toISOString(),
      });
    } else {
      // Unallocated
      const detailedUnallocatedReason =
        failureReasons.length > 0
          ? `Unallocated: All submitted preference choices were unavailable. Details: ${failureReasons.join(" | ")}`
          : "Unallocated: No valid choices could be satisfied.";

      log(`  ⚠️ UNALLOCATED: ${detailedUnallocatedReason}`);

      results.push({
        id: `res_${student.studentId}_${Date.now()}`,
        studentId: student.studentId,
        studentName: student.name,
        branch: student.branch,
        batch: student.batch,
        semester: student.semester,
        cgpa: student.cgpa,
        cycleId,
        status: "UNALLOCATED",
        electiveId: null,
        electiveCode: null,
        electiveName: null,
        preferenceRank: null,
        reason: detailedUnallocatedReason,
        priorityIndex: priorityIndex + 1,
        processedAt: new Date().toISOString(),
      });
    }
  });

  // Calculate course-wise statistics
  const courseStats = electives.map((e) => {
    const assigned = electiveSeats.get(e.id) || [];
    const capacity = e.capacity || 0;
    const remainingSeats = Math.max(0, capacity - assigned.length);
    const isFull = assigned.length >= capacity;

    return {
      electiveId: e.id,
      courseCode: e.courseCode,
      name: e.name,
      department: e.department,
      capacity,
      allocatedCount: assigned.length,
      remainingSeats,
      isFull,
      allocatedStudents: assigned,
    };
  });

  // Overall summary cards
  const totalStudentsProcessed = results.length;
  const totalAllocated = results.filter((r) => r.status === "ALLOCATED").length;
  const totalUnallocated = results.filter((r) => r.status === "UNALLOCATED").length;
  const coursesAtCapacity = courseStats.filter((c) => c.isFull).length;
  const totalSeats = courseStats.reduce((sum, c) => sum + c.capacity, 0);
  const totalSeatsFilled = courseStats.reduce((sum, c) => sum + c.allocatedCount, 0);

  const summary = {
    cycleId,
    tieBreakPolicy: policy,
    runTimestamp: new Date().toISOString(),
    totalStudentsProcessed,
    totalAllocated,
    totalUnallocated,
    coursesAtCapacity,
    totalElectives: electives.length,
    totalSeats,
    totalSeatsFilled,
    remainingSeatsOverall: totalSeats - totalSeatsFilled,
  };

  log(`Allocation completed. ${totalAllocated} allocated, ${totalUnallocated} unallocated.`);

  return {
    results,
    courseStats,
    summary,
    executionLogs,
  };
}
