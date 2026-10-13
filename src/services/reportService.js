import { storageService } from "./storageService";

export const reportService = {
  getComprehensiveReport() {
    const data = storageService.getData();
    const students = data.studentProfiles || [];
    const electives = data.electives || [];
    const results = data.allocationResults || [];
    const preferenceLists = data.preferenceLists || [];
    const config = data.allocationRuleConfig || {};

    // Course-wise report
    const courseReport = electives.map((e) => {
      const assigned = results.filter((r) => r.electiveId === e.id && r.status === "ALLOCATED");
      const allocatedCount = assigned.length;
      const capacity = e.capacity || 0;
      const remainingSeats = Math.max(0, capacity - allocatedCount);
      const fillPercentage = capacity > 0 ? Math.round((allocatedCount / capacity) * 100) : 0;

      return {
        id: e.id,
        courseCode: e.courseCode,
        name: e.name,
        department: e.department,
        capacity,
        allocatedCount,
        remainingSeats,
        fillPercentage,
        isFull: allocatedCount >= capacity,
        allocatedStudents: assigned.map((a) => ({
          studentId: a.studentId,
          studentName: a.studentName,
          branch: a.branch,
          cgpa: a.cgpa,
          preferenceRank: a.preferenceRank,
        })),
      };
    });

    // Branch-wise distribution
    const branchStats = {};
    students.forEach((s) => {
      if (!branchStats[s.branch]) {
        branchStats[s.branch] = { total: 0, allocated: 0, unallocated: 0 };
      }
      branchStats[s.branch].total += 1;
      const res = results.find((r) => r.studentId === s.studentId);
      if (res) {
        if (res.status === "ALLOCATED") branchStats[s.branch].allocated += 1;
        else if (res.status === "UNALLOCATED") branchStats[s.branch].unallocated += 1;
      }
    });

    // Preference rank breakdown (how many students got 1st choice, 2nd choice, etc.)
    const rankDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    results.forEach((r) => {
      if (r.status === "ALLOCATED" && r.preferenceRank) {
        rankDistribution[r.preferenceRank] = (rankDistribution[r.preferenceRank] || 0) + 1;
      }
    });

    // Summary metrics
    const totalProcessed = results.length;
    const totalAllocated = results.filter((r) => r.status === "ALLOCATED").length;
    const totalUnallocated = results.filter((r) => r.status === "UNALLOCATED").length;
    const allocationRate = totalProcessed > 0 ? Math.round((totalAllocated / totalProcessed) * 100) : 0;

    return {
      config,
      totalStudents: students.length,
      totalSubmitted: preferenceLists.filter((p) => p.status === "SUBMITTED").length,
      totalProcessed,
      totalAllocated,
      totalUnallocated,
      allocationRate,
      courseReport,
      branchStats,
      rankDistribution,
      results,
    };
  },

  exportResultsCsv() {
    const data = storageService.getData();
    const results = data.allocationResults || [];

    if (results.length === 0) {
      alert("No allocation results to export.");
      return;
    }

    const headers = [
      "Student Roll No",
      "Student Name",
      "Branch",
      "Semester",
      "CGPA",
      "Status",
      "Allocated Course Code",
      "Allocated Course Name",
      "Preference Rank Received",
      "Allocation Reason",
    ];

    const rows = results.map((r) => [
      `"${r.studentId}"`,
      `"${r.studentName}"`,
      `"${r.branch}"`,
      r.semester,
      r.cgpa?.toFixed(2) || "N/A",
      `"${r.status}"`,
      `"${r.electiveCode || 'N/A'}"`,
      `"${r.electiveName || 'N/A'}"`,
      r.preferenceRank || "N/A",
      `"${(r.reason || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Elective_Allocation_Report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
};
