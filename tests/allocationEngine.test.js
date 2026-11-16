import { describe, it, expect } from "vitest";
import { runAllocationEngine } from "../src/services/allocationEngine";

describe("Allocation Engine - Core Business Rules", () => {
  // Test fixture setup
  const mockElectives = [
    {
      id: "el_ml",
      courseCode: "CS4101",
      name: "Machine Learning",
      department: "CSE",
      applicableBranches: ["CSE", "CCE"],
      applicableSemesters: [6],
      capacity: 2, // Only 2 seats!
      minCgpa: 0.0,
      status: "ACTIVE",
    },
    {
      id: "el_cloud",
      courseCode: "CS4102",
      name: "Cloud Computing",
      department: "CSE",
      applicableBranches: ["CSE", "CCE"],
      applicableSemesters: [6],
      capacity: 2,
      minCgpa: 0.0,
      status: "ACTIVE",
    },
    {
      id: "el_quantum",
      courseCode: "CS4105",
      name: "Quantum Computing",
      department: "CSE",
      applicableBranches: ["CSE"],
      applicableSemesters: [6],
      capacity: 2,
      minCgpa: 8.0, // High CGPA cutoff
      status: "ACTIVE",
    },
  ];

  it("RULE 1: Course capacity is strictly never exceeded", () => {
    // 4 students all requesting CS4101 as 1st preference, but capacity is 2
    const students = [
      { studentId: "S1", name: "Student 1", branch: "CSE", semester: 6, cgpa: 9.5 },
      { studentId: "S2", name: "Student 2", branch: "CSE", semester: 6, cgpa: 9.0 },
      { studentId: "S3", name: "Student 3", branch: "CSE", semester: 6, cgpa: 8.5 },
      { studentId: "S4", name: "Student 4", branch: "CSE", semester: 6, cgpa: 8.0 },
    ];

    const preferenceLists = students.map((s) => ({
      studentId: s.studentId,
      cycleId: "cycle1",
      status: "SUBMITTED",
      submittedAt: "2026-02-01T10:00:00Z",
      items: [{ electiveId: "el_ml", rank: 1 }],
    }));

    const result = runAllocationEngine(students, mockElectives, preferenceLists, {
      tieBreakPolicy: "CGPA_MERIT",
    });

    const mlStats = result.courseStats.find((c) => c.electiveId === "el_ml");
    expect(mlStats.allocatedCount).toBe(2);
    expect(mlStats.allocatedCount).toBeLessThanOrEqual(mockElectives[0].capacity);

    // Exactly 2 allocated, 2 unallocated
    expect(result.summary.totalAllocated).toBe(2);
    expect(result.summary.totalUnallocated).toBe(2);
  });

  it("RULE 2: Ineligible students are never assigned to an elective (CGPA and branch checks)", () => {
    const students = [
      {
        studentId: "S_LOW_CGPA",
        name: "Low CGPA Student",
        branch: "CSE",
        semester: 6,
        cgpa: 7.2, // Below 8.0 required for Quantum
      },
      {
        studentId: "S_WRONG_BRANCH",
        name: "ECE Student",
        branch: "ECE", // Quantum only open to CSE
        semester: 6,
        cgpa: 9.5,
      },
    ];

    const preferenceLists = [
      {
        studentId: "S_LOW_CGPA",
        cycleId: "cycle1",
        status: "SUBMITTED",
        submittedAt: "2026-02-01T10:00:00Z",
        items: [{ electiveId: "el_quantum", rank: 1 }],
      },
      {
        studentId: "S_WRONG_BRANCH",
        cycleId: "cycle1",
        status: "SUBMITTED",
        submittedAt: "2026-02-01T10:00:00Z",
        items: [{ electiveId: "el_quantum", rank: 1 }],
      },
    ];

    const result = runAllocationEngine(students, mockElectives, preferenceLists, {
      tieBreakPolicy: "CGPA_MERIT",
    });

    const quantumStats = result.courseStats.find((c) => c.electiveId === "el_quantum");
    expect(quantumStats.allocatedCount).toBe(0);

    const s1Res = result.results.find((r) => r.studentId === "S_LOW_CGPA");
    expect(s1Res.status).toBe("UNALLOCATED");
    expect(s1Res.reason).toContain("CGPA threshold");

    const s2Res = result.results.find((r) => r.studentId === "S_WRONG_BRANCH");
    expect(s2Res.status).toBe("UNALLOCATED");
    expect(s2Res.reason).toContain("Branch mismatch");
  });

  it("RULE 3: Full first choice triggers consideration of next valid preference in rank order", () => {
    const students = [
      { studentId: "S1", name: "High CGPA", branch: "CSE", semester: 6, cgpa: 9.5 },
      { studentId: "S2", name: "Mid High CGPA", branch: "CSE", semester: 6, cgpa: 9.0 },
      { studentId: "S3", name: "Mid CGPA", branch: "CSE", semester: 6, cgpa: 8.5 }, // Will get bumped to rank 2!
    ];

    // S1, S2, S3 all pick ML as Rank 1. But ML capacity is 2.
    // S3 picks Cloud as Rank 2.
    const preferenceLists = [
      {
        studentId: "S1",
        cycleId: "cycle1",
        status: "SUBMITTED",
        submittedAt: "2026-02-01T10:00:00Z",
        items: [{ electiveId: "el_ml", rank: 1 }],
      },
      {
        studentId: "S2",
        cycleId: "cycle1",
        status: "SUBMITTED",
        submittedAt: "2026-02-01T10:00:00Z",
        items: [{ electiveId: "el_ml", rank: 1 }],
      },
      {
        studentId: "S3",
        cycleId: "cycle1",
        status: "SUBMITTED",
        submittedAt: "2026-02-01T10:00:00Z",
        items: [
          { electiveId: "el_ml", rank: 1 },
          { electiveId: "el_cloud", rank: 2 },
        ],
      },
    ];

    const result = runAllocationEngine(students, mockElectives, preferenceLists, {
      tieBreakPolicy: "CGPA_MERIT",
    });

    const s3Res = result.results.find((r) => r.studentId === "S3");
    expect(s3Res.status).toBe("ALLOCATED");
    expect(s3Res.electiveId).toBe("el_cloud");
    expect(s3Res.preferenceRank).toBe(2);
    expect(s3Res.reason).toContain("Allocated Preference #2");
  });

  it("RULE 4: Tie-breaking is completely deterministic across repeated runs", () => {
    const students = [
      { studentId: "S1", name: "Student A", branch: "CSE", semester: 6, cgpa: 8.5 },
      { studentId: "S2", name: "Student B", branch: "CSE", semester: 6, cgpa: 8.5 }, // Same CGPA!
    ];

    // S1 submitted at 10:00, S2 submitted at 10:30. Single seat!
    const singleSeatElectives = [
      {
        id: "el_one",
        courseCode: "CS4999",
        name: "Solo Seat",
        applicableBranches: ["CSE"],
        applicableSemesters: [6],
        capacity: 1,
        minCgpa: 0.0,
        status: "ACTIVE",
      },
    ];

    const preferenceLists = [
      {
        studentId: "S1",
        cycleId: "cycle1",
        status: "SUBMITTED",
        submittedAt: "2026-02-01T10:00:00Z",
        items: [{ electiveId: "el_one", rank: 1 }],
      },
      {
        studentId: "S2",
        cycleId: "cycle1",
        status: "SUBMITTED",
        submittedAt: "2026-02-01T10:30:00Z",
        items: [{ electiveId: "el_one", rank: 1 }],
      },
    ];

    // Run 1
    const run1 = runAllocationEngine(students, singleSeatElectives, preferenceLists, {
      tieBreakPolicy: "CGPA_MERIT",
    });

    // Run 2
    const run2 = runAllocationEngine(students, singleSeatElectives, preferenceLists, {
      tieBreakPolicy: "CGPA_MERIT",
    });

    // In both runs, S1 (earlier timestamp) must deterministically win the seat
    expect(run1.results.find((r) => r.studentId === "S1").status).toBe("ALLOCATED");
    expect(run1.results.find((r) => r.studentId === "S2").status).toBe("UNALLOCATED");

    expect(run2.results.find((r) => r.studentId === "S1").status).toBe("ALLOCATED");
    expect(run2.results.find((r) => r.studentId === "S2").status).toBe("UNALLOCATED");
  });

  it("RULE 5: No eligible and available preference results in Unallocated", () => {
    const students = [
      { studentId: "S1", name: "Student 1", branch: "CSE", semester: 6, cgpa: 8.0 },
    ];

    const unavailableElectives = mockElectives.map((elective) => {
      if (elective.id === "el_ml" || elective.id === "el_cloud") {
        return { ...elective, capacity: 0 };
      }
      return elective;
    });

    const preferenceLists = [
      {
        studentId: "S1",
        cycleId: "cycle1",
        status: "SUBMITTED",
        submittedAt: "2026-02-01T10:00:00Z",
        items: [
          { electiveId: "el_ml", rank: 1 },
          { electiveId: "el_cloud", rank: 2 },
        ],
      },
    ];

    const result = runAllocationEngine(students, unavailableElectives, preferenceLists, {
      tieBreakPolicy: "CGPA_MERIT",
    });

    const s1Res = result.results.find((r) => r.studentId === "S1");
    expect(s1Res.status).toBe("UNALLOCATED");
  });
});
