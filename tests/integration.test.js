import { describe, it, expect, beforeEach } from "vitest";
import { getDatabase, verifyDatabaseConnection } from "../server/db/database.js";
import { seedDatabase } from "../server/db/seed.js";
import * as authService from "../server/services/authService.js";
import * as electiveService from "../server/services/electiveService.js";
import * as preferenceService from "../server/services/preferenceService.js";
import * as allocationService from "../server/services/allocationService.js";
import * as reportService from "../server/services/reportService.js";
import { handleApiRoute } from "../server/routes/apiRouter.js";

function callApi(method, path, body = {}, headers = {}) {
  return new Promise((resolve) => {
    let statusCode = 200;
    let responseData = null;
    const req = {
      method,
      headers: { ...headers },
    };
    const res = {
      writeHead(code) {
        statusCode = code;
      },
      end(data) {
        try {
          responseData = JSON.parse(data);
        } catch {
          responseData = data;
        }
        resolve({ status: statusCode, body: responseData });
      },
    };
    const parsedUrl = new URL(path, "http://localhost:5000");
    handleApiRoute(req, res, parsedUrl, body);
  });
}

describe("ECAS End-to-End System & Database Integration Tests", () => {
  beforeEach(() => {
    // Reset database to clean canonical baseline before each test
    seedDatabase(true, "Integration Test Runner");
  });

  describe("1. Database Connectivity & Persistence (Layer 4)", () => {
    it("establishes valid SQLite connection and reports health", () => {
      const health = verifyDatabaseConnection();
      expect(health.connected).toBe(true);
      expect(health.healthy).toBe(true);
      expect(health.engine).toContain("SQLite");
      expect(health.stats.users).toBeGreaterThanOrEqual(13);
      expect(health.stats.electives).toBeGreaterThanOrEqual(7);
    });

    it("persists records in SQLite tables across service queries", () => {
      const db = getDatabase();
      const users = db.prepare("SELECT COUNT(*) AS count FROM users").get();
      expect(users.count).toBeGreaterThanOrEqual(13);

      const electives = db.prepare("SELECT COUNT(*) AS count FROM electives").get();
      expect(electives.count).toBe(7);
    });
  });

  describe("2. Authentication & Role-Based Access", () => {
    it("authenticates valid student credentials and returns student profile", () => {
      const res = authService.loginUser("student.demo@example.test", "demo123");
      expect(res.success).toBe(true);
      expect(res.user.role).toBe("student");
      expect(res.user.name).toBe("Aarav Sharma");
      expect(res.studentProfile).toBeDefined();
      expect(res.studentProfile.studentId).toBe("22UCS001");
      expect(res.token).toBeDefined();
    });

    it("rejects invalid password credentials", () => {
      const res = authService.loginUser("student.demo@example.test", "wrongPassword");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Invalid password");
    });

    it("rejects non-existent email accounts", () => {
      const res = authService.loginUser("doesnotexist@example.test", "demo123");
      expect(res.success).toBe(false);
      expect(res.error).toContain("not found");
    });

    it("authorizes faculty and administrators with correct roles", () => {
      const facRes = authService.loginUser("faculty.demo@example.test", "demo123");
      expect(facRes.success).toBe(true);
      expect(facRes.user.role).toBe("faculty");

      const admRes = authService.loginUser("admin.demo@example.test", "demo123");
      expect(admRes.success).toBe(true);
      expect(admRes.user.role).toBe("admin");
    });
  });

  describe("3. UC-007: Manage Elective Courses", () => {
    it("allows Faculty Coordinator to create a new elective with valid capacity", () => {
      const newCourseData = {
        courseCode: "CS4199",
        name: "Generative AI Systems",
        description: "Transformers and diffusion models.",
        department: "CSE",
        applicableBranches: ["CSE", "CCE"],
        applicableSemesters: [6],
        capacity: 15,
        minCgpa: 7.5,
        prerequisites: "Deep Learning",
      };

      const result = electiveService.createElective(newCourseData, "faculty", "Dr. Preeti Jain");
      expect(result.success).toBe(true);
      expect(result.elective.courseCode).toBe("CS4199");
      expect(result.elective.capacity).toBe(15);

      // Verify persisted in SQLite
      const fromDb = electiveService.getElectiveById(result.elective.id);
      expect(fromDb).toBeDefined();
      expect(fromDb.name).toBe("Generative AI Systems");
    });

    it("rejects duplicate course code creation", () => {
      const duplicateData = {
        courseCode: "CS4101", // Already exists (Machine Learning)
        name: "Duplicate Machine Learning",
        department: "CSE",
        capacity: 10,
      };

      const result = electiveService.createElective(duplicateData, "faculty", "Dr. Preeti Jain");
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain("already exists");
    });

    it("rejects non-positive course capacity", () => {
      const invalidData = {
        courseCode: "CS4188",
        name: "Zero Capacity Course",
        department: "CSE",
        capacity: 0,
      };

      const result = electiveService.createElective(invalidData, "faculty", "Dr. Preeti Jain");
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain("positive whole integer");
    });

    it("blocks student role from creating electives", () => {
      const data = {
        courseCode: "CS4177",
        name: "Unauthorized Course",
        department: "CSE",
        capacity: 10,
      };

      const result = electiveService.createElective(data, "student", "Aarav Sharma");
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain("Unauthorized");
    });
  });

  describe("4. UC-005: Submit Elective Preferences", () => {
    it("submits valid ranked preferences and transitions status to SUBMITTED", () => {
      // Jai Kapoor (22UCS088) is pre-seeded with DRAFT status
      const student = authService.getStudentProfile("22UCS088");
      expect(student).toBeDefined();

      const items = [
        { electiveId: "el_ml", rank: 1 },
        { electiveId: "el_cloud", rank: 2 },
        { electiveId: "el_cyber", rank: 3 },
      ];

      const res = preferenceService.submitPreferences(student, "slot_sem6_active", items);
      expect(res.success).toBe(true);
      expect(res.preferenceList.status).toBe("SUBMITTED");
      expect(res.preferenceList.items.length).toBe(3);

      // Verify persisted in SQLite
      const updated = preferenceService.getStudentPreferenceList("22UCS088", "slot_sem6_active");
      expect(updated.status).toBe("SUBMITTED");
      expect(updated.items[0].electiveId).toBe("el_ml");
    });

    it("rejects preference lists containing duplicate courses", () => {
      const student = authService.getStudentProfile("22UCS088");
      const duplicateItems = [
        { electiveId: "el_ml", rank: 1 },
        { electiveId: "el_ml", rank: 2 }, // Duplicate!
        { electiveId: "el_cloud", rank: 3 },
      ];

      const res = preferenceService.submitPreferences(student, "slot_sem6_active", duplicateItems);
      expect(res.success).toBe(false);
      expect(res.errors[0]).toContain("Duplicate elective");
    });

    it("rejects preference lists with fewer than minimum required choices (< 3)", () => {
      const student = authService.getStudentProfile("22UCS088");
      const fewItems = [
        { electiveId: "el_ml", rank: 1 },
        { electiveId: "el_cloud", rank: 2 },
      ];

      const res = preferenceService.submitPreferences(student, "slot_sem6_active", fewItems);
      expect(res.success).toBe(false);
      expect(res.errors[0]).toContain("at least 3");
    });

    it("rejects courses for which student does not meet eligibility (e.g. CGPA cutoff)", () => {
      // Jai Kapoor has CGPA 6.60. CS4105 Quantum Computing requires min CGPA 8.0!
      const student = authService.getStudentProfile("22UCS088");
      const ineligibleItems = [
        { electiveId: "el_quantum", rank: 1 }, // Ineligible!
        { electiveId: "el_cloud", rank: 2 },
        { electiveId: "el_cyber", rank: 3 },
      ];

      const res = preferenceService.submitPreferences(student, "slot_sem6_active", ineligibleItems);
      expect(res.success).toBe(false);
      expect(res.errors[0]).toContain("Ineligible");
    });
  });

  describe("5. UC-011: Initiate Elective Allocation & Verification", () => {
    it("checks readiness preconditions successfully", () => {
      const readiness = allocationService.checkReadiness("slot_sem6_active");
      expect(readiness.isReady).toBe(true);
      expect(readiness.checks.every((c) => c.passed)).toBe(true);
    });

    it("executes deterministic allocation engine and stores results persistently", () => {
      const execRes = allocationService.executeAllocation("slot_sem6_active", "admin", "Prof. S. R. Verma");
      expect(execRes.success).toBe(true);
      expect(execRes.summary.totalProcessed).toBeGreaterThan(0);
      expect(execRes.summary.totalAllocated).toBeGreaterThan(0);

      // Verify stored in SQLite
      const dbResults = allocationService.getAllocationResults("slot_sem6_active");
      expect(dbResults.length).toBe(execRes.results.length);

      // Aarav Sharma (CGPA 9.45) receives 1st preference (Machine Learning)
      const aaravResult = dbResults.find((r) => r.studentId === "22UCS001");
      expect(aaravResult).toBeDefined();
      expect(aaravResult.status).toBe("ALLOCATED");
      expect(aaravResult.electiveId).toBe("el_ml");
      expect(aaravResult.preferenceRank).toBe(1);

      // Chirag Mehta (CGPA 8.85) ranked ML (full, cap 2) and gets 2nd preference (Cloud)
      const chiragResult = dbResults.find((r) => r.studentId === "22UCC007");
      expect(chiragResult).toBeDefined();
      expect(chiragResult.status).toBe("ALLOCATED");
      expect(chiragResult.preferenceRank).toBe(2);

      // Ishita Saxena (CGPA 6.95) ranked only full courses and becomes UNALLOCATED
      const ishitaResult = dbResults.find((r) => r.studentId === "22UCC032");
      expect(ishitaResult).toBeDefined();
      expect(ishitaResult.status).toBe("UNALLOCATED");
    });

    it("enforces capacity limit invariant strictly across all courses", () => {
      allocationService.executeAllocation("slot_sem6_active", "admin", "Prof. S. R. Verma");
      const electives = electiveService.getAllElectives("slot_sem6_active");

      for (const e of electives) {
        expect(e.allocatedCount).toBeLessThanOrEqual(e.capacity);
      }
    });

    it("publishes results and exposes them to student view", () => {
      allocationService.executeAllocation("slot_sem6_active", "admin", "Prof. S. R. Verma");

      // Before publication, student result view is blocked
      const beforePub = allocationService.getStudentResult("22UCS001", "slot_sem6_active", false);
      expect(beforePub.isAvailable).toBe(false);

      // Publish results
      const pubRes = allocationService.publishResults("slot_sem6_active", "admin", "Prof. S. R. Verma");
      expect(pubRes.success).toBe(true);

      // After publication, student result view is available
      const afterPub = allocationService.getStudentResult("22UCS001", "slot_sem6_active", false);
      expect(afterPub.isAvailable).toBe(true);
      expect(afterPub.result.courseCode).toBe("CS4101");
    });

    it("generates comprehensive institution reports and CSV export", () => {
      allocationService.executeAllocation("slot_sem6_active", "admin", "Prof. S. R. Verma");
      const report = reportService.getComprehensiveReport("slot_sem6_active");
      expect(report.totalProcessed).toBeGreaterThan(0);
      expect(report.allocationRate).toBeGreaterThan(0);
      expect(report.courseReport.length).toBe(7);

      const csv = reportService.generateCsvReport("slot_sem6_active");
      expect(csv).toContain("Student ID,Student Name,Branch");
      expect(csv).toContain("22UCS001");
    });
  });

  describe("6. Preference Status Transitions & SQLite Database Consistency (UC-005 & UC-006)", () => {
    it("transitions preference list from SUBMITTED to DRAFT on reopen and clears submitted_at in SQLite", () => {
      const db = getDatabase();

      // Verify initial state for Aarav Sharma (22UCS001) in SQLite
      const initialRow = db
        .prepare("SELECT * FROM preference_lists WHERE UPPER(student_id) = '22UCS001' AND cycle_id = 'slot_sem6_active'")
        .get();
      expect(initialRow).toBeDefined();
      expect(initialRow.status).toBe("SUBMITTED");
      expect(initialRow.submitted_at).not.toBeNull();

      // Reopen preferences for modification
      const res = preferenceService.reopenForModification("22UCS001", "slot_sem6_active");
      expect(res.success).toBe(true);

      // Verify SQLite row updated directly
      const reopenedRow = db
        .prepare("SELECT * FROM preference_lists WHERE UPPER(student_id) = '22UCS001' AND cycle_id = 'slot_sem6_active'")
        .get();
      expect(reopenedRow.status).toBe("DRAFT");
      expect(reopenedRow.submitted_at).toBeNull();

      // Verify items remain intact in preference_items table
      const items = db
        .prepare("SELECT * FROM preference_items WHERE preference_list_id = ? ORDER BY rank ASC")
        .all(reopenedRow.id);
      expect(items.length).toBeGreaterThanOrEqual(3);
    });

    it("saves draft modifications in SQLite without changing DRAFT status", () => {
      const db = getDatabase();

      // Reopen first
      preferenceService.reopenForModification("22UCS001", "slot_sem6_active");

      // Save new modified draft items
      const modifiedItems = [
        { electiveId: "el_cyber", rank: 1 },
        { electiveId: "el_cloud", rank: 2 },
        { electiveId: "el_ml", rank: 3 },
      ];

      const draftRes = preferenceService.saveDraft("22UCS001", "slot_sem6_active", modifiedItems);
      expect(draftRes.success).toBe(true);
      expect(draftRes.preferenceList.status).toBe("DRAFT");

      // Verify SQLite database has updated items and status DRAFT
      const listRow = db
        .prepare("SELECT * FROM preference_lists WHERE UPPER(student_id) = '22UCS001' AND cycle_id = 'slot_sem6_active'")
        .get();
      expect(listRow.status).toBe("DRAFT");
      expect(listRow.submitted_at).toBeNull();

      const itemsInDb = db
        .prepare("SELECT elective_id, rank FROM preference_items WHERE preference_list_id = ? ORDER BY rank ASC")
        .all(listRow.id);

      expect(itemsInDb.length).toBe(3);
      expect(itemsInDb[0].elective_id).toBe("el_cyber");
      expect(itemsInDb[0].rank).toBe(1);
      expect(itemsInDb[1].elective_id).toBe("el_cloud");
      expect(itemsInDb[1].rank).toBe(2);
      expect(itemsInDb[2].elective_id).toBe("el_ml");
      expect(itemsInDb[2].rank).toBe(3);
    });

    it("transitions from DRAFT to SUBMITTED upon submission and sets submitted_at in SQLite", () => {
      const db = getDatabase();

      // Reopen first
      preferenceService.reopenForModification("22UCS001", "slot_sem6_active");

      const student = authService.getStudentProfile("22UCS001");
      const submitItems = [
        { electiveId: "el_nlp", rank: 1 },
        { electiveId: "el_ml", rank: 2 },
        { electiveId: "el_cloud", rank: 3 },
      ];

      const submitRes = preferenceService.submitPreferences(student, "slot_sem6_active", submitItems);
      expect(submitRes.success).toBe(true);
      expect(submitRes.preferenceList.status).toBe("SUBMITTED");
      expect(submitRes.submittedAt).toBeDefined();

      // Verify SQLite database state directly
      const listRow = db
        .prepare("SELECT * FROM preference_lists WHERE UPPER(student_id) = '22UCS001' AND cycle_id = 'slot_sem6_active'")
        .get();
      expect(listRow.status).toBe("SUBMITTED");
      expect(listRow.submitted_at).not.toBeNull();

      const items = db
        .prepare("SELECT elective_id, rank FROM preference_items WHERE preference_list_id = ? ORDER BY rank ASC")
        .all(listRow.id);
      expect(items.length).toBe(3);
      expect(items[0].elective_id).toBe("el_nlp");
    });

    it("prevents reopening preferences once allocation results are published", () => {
      const db = getDatabase();

      // Run and publish allocation
      allocationService.executeAllocation("slot_sem6_active", "admin", "Admin User");
      allocationService.publishResults("slot_sem6_active", "admin", "Admin User");

      // Verify config is published
      const config = allocationService.getRuleConfig("slot_sem6_active");
      expect(config.isPublished).toBe(true);

      // Attempt to reopen preferences
      const reopenRes = preferenceService.reopenForModification("22UCS001", "slot_sem6_active");
      expect(reopenRes.success).toBe(false);
      expect(reopenRes.error).toContain("published");

      // Verify status in SQLite remains SUBMITTED
      const listRow = db
        .prepare("SELECT status FROM preference_lists WHERE UPPER(student_id) = '22UCS001' AND cycle_id = 'slot_sem6_active'")
        .get();
      expect(listRow.status).toBe("SUBMITTED");
    });
  });

  describe("7. End-to-End REST API Routes & Database Consistency", () => {
    it("POST /api/preferences/reopen updates SQLite status to DRAFT", async () => {
      const db = getDatabase();

      const res = await callApi("POST", "/api/preferences/reopen", {
        studentId: "22UCS001",
        cycleId: "slot_sem6_active",
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Check DB
      const row = db
        .prepare("SELECT status, submitted_at FROM preference_lists WHERE UPPER(student_id) = '22UCS001'")
        .get();
      expect(row.status).toBe("DRAFT");
      expect(row.submitted_at).toBeNull();
    });

    it("POST /api/preferences/draft persists draft items in SQLite", async () => {
      const db = getDatabase();

      // First reopen
      await callApi("POST", "/api/preferences/reopen", {
        studentId: "22UCS001",
        cycleId: "slot_sem6_active",
      });

      const items = [
        { electiveId: "el_nlp", rank: 1 },
        { electiveId: "el_cyber", rank: 2 },
        { electiveId: "el_cloud", rank: 3 },
      ];

      const res = await callApi("POST", "/api/preferences/draft", {
        studentId: "22UCS001",
        cycleId: "slot_sem6_active",
        items,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Check DB
      const list = db
        .prepare("SELECT id, status FROM preference_lists WHERE UPPER(student_id) = '22UCS001'")
        .get();
      expect(list.status).toBe("DRAFT");

      const itemsInDb = db
        .prepare("SELECT elective_id, rank FROM preference_items WHERE preference_list_id = ? ORDER BY rank ASC")
        .all(list.id);
      expect(itemsInDb[0].elective_id).toBe("el_nlp");
    });

    it("POST /api/preferences/submit updates SQLite status to SUBMITTED", async () => {
      const db = getDatabase();

      // First reopen
      await callApi("POST", "/api/preferences/reopen", {
        studentId: "22UCS001",
        cycleId: "slot_sem6_active",
      });

      const items = [
        { electiveId: "el_ml", rank: 1 },
        { electiveId: "el_cloud", rank: 2 },
        { electiveId: "el_cyber", rank: 3 },
      ];

      const res = await callApi("POST", "/api/preferences/submit", {
        studentId: "22UCS001",
        cycleId: "slot_sem6_active",
        items,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Check DB
      const row = db
        .prepare("SELECT status, submitted_at FROM preference_lists WHERE UPPER(student_id) = '22UCS001'")
        .get();
      expect(row.status).toBe("SUBMITTED");
      expect(row.submitted_at).not.toBeNull();
    });

    it("POST /api/allocation/reset clears allocation results from SQLite", async () => {
      const db = getDatabase();

      // Run allocation first
      allocationService.executeAllocation("slot_sem6_active", "admin", "Admin User");
      const resultsBefore = db.prepare("SELECT COUNT(*) AS count FROM allocation_results").get();
      expect(resultsBefore.count).toBeGreaterThan(0);

      // Reset via API
      const res = await callApi("POST", "/api/allocation/reset", {
        cycleId: "slot_sem6_active",
        actorRole: "admin",
        actorName: "Admin User",
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Check DB
      const resultsAfter = db.prepare("SELECT COUNT(*) AS count FROM allocation_results").get();
      expect(resultsAfter.count).toBe(0);

      const configRow = db
        .prepare("SELECT status, is_published FROM allocation_rule_configs WHERE cycle_id = 'slot_sem6_active'")
        .get();
      expect(configRow.status).toBe("NOT_STARTED");
      expect(configRow.is_published).toBe(0);
    });

    it("PUT /api/electives/:id updates elective capacity in SQLite", async () => {
      const db = getDatabase();

      const res = await callApi("PUT", "/api/electives/el_ml", {
        courseCode: "CS4101",
        name: "Machine Learning (Advanced)",
        capacity: 35,
        minCgpa: 7.0,
        department: "CSE",
        applicableBranches: ["CSE", "CCE"],
        applicableSemesters: [6],
        actorRole: "faculty",
        actorName: "Dr. Preeti Jain",
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Check SQLite row
      const elRow = db.prepare("SELECT name, capacity, min_cgpa FROM electives WHERE id = 'el_ml'").get();
      expect(elRow.name).toBe("Machine Learning (Advanced)");
      expect(elRow.capacity).toBe(35);
      expect(elRow.min_cgpa).toBe(7.0);
    });
  });
});

