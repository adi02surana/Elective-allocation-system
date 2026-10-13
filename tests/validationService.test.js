import { describe, it, expect, beforeEach } from "vitest";
import { validationService } from "../src/services/validationService";
import { storageService } from "../src/services/storageService";
import { INITIAL_SEED_DATA } from "../src/data/seedData";

// Mock localStorage for node environment
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

global.localStorage = localStorageMock;

describe("Validation Service & Storage Business Rules", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  const mockStudent = {
    studentId: "22UCS001",
    name: "Aarav Sharma",
    branch: "CSE",
    semester: 6,
    cgpa: 9.45,
  };

  const mockWindowOpen = {
    id: "slot_open",
    status: "OPEN",
    minPreferences: 3,
    maxPreferences: 5,
    endDateTime: "2099-12-31T23:59:59Z",
  };

  const mockWindowClosed = {
    id: "slot_closed",
    status: "CLOSED",
    minPreferences: 3,
    maxPreferences: 5,
    endDateTime: "2020-01-01T23:59:59Z",
  };

  const electivesMap = {
    el_ml: {
      id: "el_ml",
      courseCode: "CS4101",
      name: "Machine Learning",
      status: "ACTIVE",
      applicableBranches: ["CSE", "CCE"],
      applicableSemesters: [6],
      minCgpa: 0.0,
      capacity: 3,
    },
    el_cloud: {
      id: "el_cloud",
      courseCode: "CS4102",
      name: "Cloud Computing",
      status: "ACTIVE",
      applicableBranches: ["CSE", "CCE"],
      applicableSemesters: [6],
      minCgpa: 0.0,
      capacity: 3,
    },
    el_cyber: {
      id: "el_cyber",
      courseCode: "CS4103",
      name: "Cyber Security",
      status: "ACTIVE",
      applicableBranches: ["CSE", "CCE"],
      applicableSemesters: [6],
      minCgpa: 0.0,
      capacity: 3,
    },
  };

  it("RULE 6: Duplicate preferences in the same submission list are rejected", () => {
    const duplicateItems = [
      { electiveId: "el_ml", rank: 1 },
      { electiveId: "el_ml", rank: 2 }, // Duplicate!
      { electiveId: "el_cloud", rank: 3 },
    ];

    const result = validationService.validatePreferences(
      mockStudent,
      duplicateItems,
      electivesMap,
      mockWindowOpen
    );

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("Duplicate choices detected"))).toBe(true);
  });

  it("RULE 7: Closed-window preference submission is rejected", () => {
    const validItems = [
      { electiveId: "el_ml", rank: 1 },
      { electiveId: "el_cloud", rank: 2 },
      { electiveId: "el_cyber", rank: 3 },
    ];

    const result = validationService.validatePreferences(
      mockStudent,
      validItems,
      electivesMap,
      mockWindowClosed
    );

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("CLOSED"))).toBe(true);
  });

  it("RULE 8: Minimum preference count is enforced", () => {
    const insufficientItems = [
      { electiveId: "el_ml", rank: 1 },
      { electiveId: "el_cloud", rank: 2 },
      // Only 2 choices, minRequired is 3
    ];

    const result = validationService.validatePreferences(
      mockStudent,
      insufficientItems,
      electivesMap,
      mockWindowOpen
    );

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes("Minimum of 3"))).toBe(true);
  });

  it("RULE 9: Unauthorized roles cannot manage courses or start allocation", () => {
    // Students cannot manage courses
    expect(validationService.canManageCourses("student")).toBe(false);
    // Faculty can manage courses
    expect(validationService.canManageCourses("faculty")).toBe(true);
    // Students cannot start allocation
    expect(validationService.canStartAllocation("student")).toBe(false);
    // Faculty cannot start allocation (only Admin / SysAdmin)
    expect(validationService.canStartAllocation("faculty")).toBe(false);
    expect(validationService.canStartAllocation("admin")).toBe(true);
  });

  it("RULE 10: Course capacity validation blocks negative values and reductions below allocated count", () => {
    // Negative capacity
    const invalidCap = validationService.validateElective({
      courseCode: "CS4101",
      name: "Machine Learning",
      capacity: -5,
      applicableBranches: ["CSE"],
      applicableSemesters: [6],
    });
    expect(invalidCap.isValid).toBe(false);

    // Reducing capacity below existing allocation
    const reductionBlocked = validationService.validateElective(
      {
        courseCode: "CS4101",
        name: "Machine Learning",
        capacity: 1, // trying to set 1
        applicableBranches: ["CSE"],
        applicableSemesters: [6],
      },
      3 // 3 students currently allocated!
    );
    expect(reductionBlocked.isValid).toBe(false);
    expect(reductionBlocked.errors[0]).toContain("cannot be reduced to 1 because 3 students are already allocated");
  });

  it("RULE 11: Reset returns the application to predictable canonical seed data", () => {
    const initial = storageService.resetToSeedData("Test Runner");
    expect(initial.studentProfiles.length).toBe(INITIAL_SEED_DATA.studentProfiles.length);
    expect(initial.electives.length).toBe(INITIAL_SEED_DATA.electives.length);
    expect(initial.users.length).toBe(INITIAL_SEED_DATA.users.length);

    // Modify data
    const mutated = storageService.getData();
    mutated.electives = [];
    storageService.saveData(mutated);
    expect(storageService.getData().electives.length).toBe(0);

    // Reset
    const restored = storageService.resetToSeedData("Test Reset");
    expect(restored.electives.length).toBe(INITIAL_SEED_DATA.electives.length);
    expect(restored.auditEvents[0].action).toBe("RESET_TO_SEED_DATA");
  });
});
