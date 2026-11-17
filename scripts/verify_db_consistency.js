import { getDatabase } from "../server/db/database.js";
import { seedDatabase } from "../server/db/seed.js";
import * as authService from "../server/services/authService.js";
import * as preferenceService from "../server/services/preferenceService.js";
import * as electiveService from "../server/services/electiveService.js";
import * as allocationService from "../server/services/allocationService.js";

async function verifyAll() {
  console.log("=== STARTING FULL DATABASE CONSISTENCY VERIFICATION ===");
  const db = getDatabase();

  // Step 1: Baseline Seed
  seedDatabase(true, "DB Verifier");
  console.log("✓ Step 1: Database seeded cleanly.");

  // Step 2: Check student 22UCS001 initial state in SQLite
  let row = db.prepare("SELECT * FROM preference_lists WHERE student_id = '22UCS001'").get();
  console.log("✓ Step 2: Initial student 22UCS001 status in SQLite:", row.status, "submitted_at:", row.submitted_at);
  if (row.status !== "SUBMITTED") throw new Error("Expected initial status to be SUBMITTED");

  // Step 3: Reopen preference list for modification (SUBMITTED -> DRAFT)
  const reopenResult = preferenceService.reopenForModification("22UCS001", "slot_sem6_active");
  if (!reopenResult.success) throw new Error("Failed to reopen preferences: " + reopenResult.error);
  
  row = db.prepare("SELECT * FROM preference_lists WHERE student_id = '22UCS001'").get();
  console.log("✓ Step 3: Reopened student 22UCS001 status in SQLite:", row.status, "submitted_at:", row.submitted_at);
  if (row.status !== "DRAFT" || row.submitted_at !== null) {
    throw new Error(`Inconsistency detected! Expected DRAFT with NULL submitted_at, got ${row.status}, ${row.submitted_at}`);
  }

  // Step 4: Modify rankings and save as draft
  const newDraftItems = [
    { electiveId: "el_cyber", rank: 1 },
    { electiveId: "el_nlp", rank: 2 },
    { electiveId: "el_cloud", rank: 3 },
  ];
  const draftResult = preferenceService.saveDraft("22UCS001", "slot_sem6_active", newDraftItems);
  if (!draftResult.success) throw new Error("Failed to save draft");

  row = db.prepare("SELECT * FROM preference_lists WHERE student_id = '22UCS001'").get();
  const itemsInDb = db.prepare("SELECT * FROM preference_items WHERE preference_list_id = ? ORDER BY rank ASC").all(row.id);
  console.log("✓ Step 4: Draft items saved in SQLite table preference_items. Count:", itemsInDb.length);
  if (itemsInDb.length !== 3 || itemsInDb[0].elective_id !== "el_cyber" || itemsInDb[1].elective_id !== "el_nlp") {
    throw new Error("Draft items mismatch in SQLite database!");
  }

  // Step 5: Submit modified preferences (DRAFT -> SUBMITTED)
  const student = authService.getStudentProfile("22UCS001");
  const submitResult = preferenceService.submitPreferences(student, "slot_sem6_active", newDraftItems);
  if (!submitResult.success) throw new Error("Failed to submit preferences: " + JSON.stringify(submitResult.errors));

  row = db.prepare("SELECT * FROM preference_lists WHERE student_id = '22UCS001'").get();
  console.log("✓ Step 5: Submitted preferences status in SQLite:", row.status, "submitted_at:", row.submitted_at);
  if (row.status !== "SUBMITTED" || !row.submitted_at) {
    throw new Error(`Inconsistency detected! Expected SUBMITTED with valid timestamp, got ${row.status}, ${row.submitted_at}`);
  }

  // Step 6: Case insensitivity verification
  const lowerStudent = authService.getStudentProfile("22ucs001");
  if (!lowerStudent || lowerStudent.studentId !== "22UCS001") {
    throw new Error("Case-insensitive student profile lookup failed!");
  }
  console.log("✓ Step 6: Student ID case normalization verified.");

  // Step 7: Course Management Lifecycle in SQLite
  const newCourse = {
    id: "el_test_arch",
    courseCode: "CS4999",
    name: "Advanced Distributed Architectures",
    department: "CSE",
    applicableBranches: ["CSE", "CCE"],
    applicableSemesters: [6],
    capacity: 20,
    minCgpa: 7.0,
    prerequisites: "Distributed Systems",
  };
  const createRes = electiveService.createElective(newCourse, "faculty", "Dr. Preeti Jain");
  if (!createRes.success) throw new Error("Elective creation failed");

  let courseRow = db.prepare("SELECT * FROM electives WHERE course_code = 'CS4999'").get();
  if (!courseRow || courseRow.capacity !== 20) throw new Error("Elective row not found in SQLite!");
  console.log("✓ Step 7a: Elective course created in SQLite:", courseRow.course_code, courseRow.name);

  // Update course capacity
  const updateRes = electiveService.updateElective(courseRow.id, { ...newCourse, capacity: 25 }, "faculty", "Dr. Preeti Jain");
  if (!updateRes.success) throw new Error("Elective update failed");
  courseRow = db.prepare("SELECT * FROM electives WHERE id = ?").get(courseRow.id);
  if (courseRow.capacity !== 25) throw new Error("Elective capacity not updated in SQLite!");
  console.log("✓ Step 7b: Elective course updated in SQLite. New capacity:", courseRow.capacity);

  // Delete course
  const delRes = electiveService.deleteElective(courseRow.id, "faculty", "Dr. Preeti Jain");
  if (!delRes.success) throw new Error("Elective deletion failed");
  courseRow = db.prepare("SELECT * FROM electives WHERE id = ?").get(courseRow.id);
  if (courseRow) throw new Error("Elective still exists in SQLite after deletion!");
  console.log("✓ Step 7c: Elective course successfully deleted from SQLite.");

  // Step 8: Centralized Allocation Execution in SQLite
  const allocRes = allocationService.executeAllocation("slot_sem6_active", "admin", "Admin User");
  if (!allocRes.success) throw new Error("Allocation execution failed: " + allocRes.error);
  
  const allocCount = db.prepare("SELECT COUNT(*) AS count FROM allocation_results WHERE cycle_id = 'slot_sem6_active'").get();
  const cfgRow = db.prepare("SELECT * FROM allocation_rule_configs WHERE cycle_id = 'slot_sem6_active'").get();
  console.log("✓ Step 8: Allocation computed. Stored results in SQLite:", allocCount.count, "Config status:", cfgRow.status);
  if (allocCount.count === 0 || cfgRow.status !== "COMPLETED") throw new Error("Allocation results not properly persisted!");

  // Step 9: Publish Results
  const pubRes = allocationService.publishResults("slot_sem6_active", "admin", "Admin User");
  if (!pubRes.success) throw new Error("Publishing failed: " + pubRes.error);
  const publishedCfg = db.prepare("SELECT is_published FROM allocation_rule_configs WHERE cycle_id = 'slot_sem6_active'").get();
  console.log("✓ Step 9: Results published in SQLite. is_published:", publishedCfg.is_published);
  if (publishedCfg.is_published !== 1) throw new Error("Rule config is_published not 1!");

  // Step 10: Invariant check - preference modifications blocked after publication
  const lateReopen = preferenceService.reopenForModification("22UCS001", "slot_sem6_active");
  console.log("✓ Step 10: Post-publication preference reopen blocked as expected:", lateReopen.success === false);
  if (lateReopen.success) throw new Error("Late reopen should have been blocked!");

  // Step 11: Allocation Reset in SQLite
  const resetRes = allocationService.resetAllocation("slot_sem6_active", "admin", "Admin User");
  if (!resetRes.success) throw new Error("Allocation reset failed");
  const postResetCount = db.prepare("SELECT COUNT(*) AS count FROM allocation_results WHERE cycle_id = 'slot_sem6_active'").get();
  const postResetCfg = db.prepare("SELECT * FROM allocation_rule_configs WHERE cycle_id = 'slot_sem6_active'").get();
  console.log("✓ Step 11: Allocation reset. Results count in SQLite:", postResetCount.count, "Config status:", postResetCfg.status);
  if (postResetCount.count !== 0 || postResetCfg.status !== "NOT_STARTED" || postResetCfg.is_published !== 0) {
    throw new Error("Allocation reset failed to clear SQLite tables cleanly!");
  }

  // Final confirmation: Re-seed database
  seedDatabase(true, "Final System Clean");
  console.log("✓ Final: Canonical demo database re-seeded cleanly.");
  console.log("=== ALL DATABASE CONSISTENCY VERIFICATIONS PASSED (100%) ===");
}

verifyAll().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
