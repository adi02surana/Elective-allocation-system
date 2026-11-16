import { getDatabase } from "../db/database.js";
import { getAllElectives } from "./electiveService.js";
import { getRuleConfig, getAllocationResults } from "./allocationService.js";

export function getComprehensiveReport(cycleId = "slot_sem6_active") {
  const db = getDatabase();
  const config = getRuleConfig(cycleId);
  const electives = getAllElectives(cycleId);
  const results = getAllocationResults(cycleId);

  const totalStudents = db.prepare(`SELECT COUNT(*) AS c FROM student_profiles`).get().c;
  const totalSubmitted = db.prepare(`
    SELECT COUNT(*) AS c FROM preference_lists
    WHERE cycle_id = ? AND status = 'SUBMITTED'
  `).get(cycleId).c;

  const totalAllocated = results.filter((r) => r.status === "ALLOCATED").length;
  const totalUnallocated = results.filter((r) => r.status === "UNALLOCATED").length;
  const totalProcessed = results.length;

  const allocationRate = totalProcessed > 0
    ? Math.round((totalAllocated / totalProcessed) * 100)
    : 0;

  // Preference Rank Satisfaction (Choices #1 through #5)
  const rankDistribution = {
    rank1: 0,
    rank2: 0,
    rank3: 0,
    rank4: 0,
    rank5: 0,
    unallocated: totalUnallocated,
  };

  results.forEach((r) => {
    if (r.status === "ALLOCATED") {
      if (r.preferenceRank === 1) rankDistribution.rank1++;
      else if (r.preferenceRank === 2) rankDistribution.rank2++;
      else if (r.preferenceRank === 3) rankDistribution.rank3++;
      else if (r.preferenceRank === 4) rankDistribution.rank4++;
      else if (r.preferenceRank === 5) rankDistribution.rank5++;
    }
  });

  // Course-wise seat occupancy
  const courseReport = electives.map((e) => {
    const enrolledStudents = results
      .filter((r) => r.electiveId === e.id && r.status === "ALLOCATED")
      .map((r) => ({
        studentId: r.studentId,
        studentName: r.studentName,
        branch: r.branch,
        cgpa: r.cgpa,
        preferenceRank: r.preferenceRank,
      }));

    const allocatedSeats = enrolledStudents.length;
    const capacity = e.capacity || 0;
    const fillPercentage = capacity > 0 ? Math.round((allocatedSeats / capacity) * 100) : 0;

    return {
      id: e.id,
      courseCode: e.courseCode,
      name: e.name,
      department: e.department,
      capacity,
      allocatedSeats,
      availableSeats: Math.max(0, capacity - allocatedSeats),
      fillPercentage,
      isFull: allocatedSeats >= capacity,
      enrolledStudents,
    };
  });

  return {
    totalStudents,
    totalSubmitted,
    totalProcessed,
    totalAllocated,
    totalUnallocated,
    allocationRate,
    rankDistribution,
    courseReport,
    results,
    config,
  };
}

export function generateCsvReport(cycleId = "slot_sem6_active") {
  const report = getComprehensiveReport(cycleId);
  const rows = [
    [
      "Student ID",
      "Student Name",
      "Branch",
      "Semester",
      "CGPA",
      "Allocation Status",
      "Course Code",
      "Course Name",
      "Preference Rank",
      "Decision Reason",
      "Allocated At",
    ],
  ];

  report.results.forEach((r) => {
    rows.push([
      `"${r.studentId}"`,
      `"${r.studentName}"`,
      `"${r.branch}"`,
      r.semester,
      r.cgpa.toFixed(2),
      `"${r.status}"`,
      `"${r.courseCode || "N/A"}"`,
      `"${r.courseName || "N/A"}"`,
      r.preferenceRank || "N/A",
      `"${(r.assignedReason || "").replace(/"/g, '""')}"`,
      `"${r.allocatedAt}"`,
    ]);
  });

  return rows.map((e) => e.join(",")).join("\n");
}

