/**
 * Validation Service for Elective Allocation System
 * Centralizes all business rule validations across student preference submissions,
 * faculty elective course updates, allocation engine preconditions, and role permissions.
 */

export const validationService = {
  /**
   * Validate a student's preference submission
   * @param {Object} student - Student profile
   * @param {Array} preferenceItems - Array of { electiveId, rank }
   * @param {Map|Object} electivesMap - Map of electiveId -> Elective
   * @param {Object} window - Active registration window
   * @returns {Object} { isValid: boolean, errors: string[], warnings: string[] }
   */
  validatePreferences(student, preferenceItems, electivesMap, window) {
    const errors = [];
    const warnings = [];

    // 1. Check Registration Window Status
    if (!window) {
      errors.push("No active registration window was found for your academic cycle.");
      return { isValid: false, errors, warnings };
    }

    if (window.status !== "OPEN") {
      errors.push(`Registration window is currently ${window.status}. Submissions are not accepted.`);
    }

    const now = new Date();
    if (window.endDateTime && new Date(window.endDateTime) < now) {
      errors.push("Registration deadline has expired. Submissions and modifications are closed.");
    }

    // 2. Check Preferences count
    if (!preferenceItems || preferenceItems.length === 0) {
      errors.push("Preference list cannot be empty. Please select and rank your elective choices.");
      return { isValid: false, errors, warnings };
    }

    const minRequired = window.minPreferences || 3;
    const maxAllowed = window.maxPreferences || 5;

    if (preferenceItems.length < minRequired) {
      errors.push(
        `Minimum of ${minRequired} distinct elective preferences required (you submitted ${preferenceItems.length}).`
      );
    }

    if (preferenceItems.length > maxAllowed) {
      errors.push(
        `Maximum allowed preferences is ${maxAllowed} (you submitted ${preferenceItems.length}).`
      );
    }

    // 3. Check for Duplicate Electives
    const seenElectiveIds = new Set();
    const duplicateIds = new Set();
    preferenceItems.forEach((item) => {
      if (!item.electiveId) {
        errors.push("Empty elective selection detected at rank " + item.rank);
      } else if (seenElectiveIds.has(item.electiveId)) {
        duplicateIds.add(item.electiveId);
      } else {
        seenElectiveIds.add(item.electiveId);
      }
    });

    if (duplicateIds.size > 0) {
      errors.push("Duplicate choices detected! Each ranked preference must be a unique elective.");
    }

    // 4. Validate Each Ranked Course (Eligibility, Availability, Scope)
    preferenceItems.forEach((item) => {
      const elective = electivesMap[item.electiveId] || (electivesMap.get && electivesMap.get(item.electiveId));
      if (!elective) {
        errors.push(`Course with ID ${item.electiveId} does not exist in the active catalogue.`);
        return;
      }

      // Course active status
      if (elective.status !== "ACTIVE") {
        errors.push(
          `Rank #${item.rank}: Course ${elective.courseCode} (${elective.name}) is currently inactive and cannot be selected.`
        );
      }

      // Branch applicability check
      if (
        elective.applicableBranches &&
        elective.applicableBranches.length > 0 &&
        !elective.applicableBranches.includes(student.branch)
      ) {
        errors.push(
          `Rank #${item.rank}: Course ${elective.courseCode} is restricted to branches [${elective.applicableBranches.join(
            ", "
          )}]. Your branch (${student.branch}) is not eligible.`
        );
      }

      // Semester applicability check
      if (
        elective.applicableSemesters &&
        elective.applicableSemesters.length > 0 &&
        !elective.applicableSemesters.includes(student.semester)
      ) {
        errors.push(
          `Rank #${item.rank}: Course ${elective.courseCode} is only offered for Semester(s) [${elective.applicableSemesters.join(
            ", "
          )}]. Your current semester is ${student.semester}.`
        );
      }

      // CGPA threshold check
      if (elective.minCgpa && elective.minCgpa > 0) {
        if (student.cgpa < elective.minCgpa) {
          errors.push(
            `Rank #${item.rank}: Course ${elective.courseCode} requires a minimum CGPA of ${elective.minCgpa.toFixed(
              2
            )}. Your current CGPA is ${student.cgpa.toFixed(2)}.`
          );
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  },

  /**
   * Validate faculty course creation or update
   * @param {Object} data - Course details
   * @param {Number} currentlyAllocatedCount - Number of students allocated in current results (if any)
   * @returns {Object} { isValid: boolean, errors: string[] }
   */
  validateElective(data, currentlyAllocatedCount = 0) {
    const errors = [];

    if (!data.courseCode || !data.courseCode.trim()) {
      errors.push("Course Code is required (e.g. CS4101).");
    } else if (!/^[A-Z]{2,4}\d{4}$/.test(data.courseCode.trim())) {
      errors.push("Course Code should follow standard format like CS4101 or EC4201.");
    }

    if (!data.name || !data.name.trim()) {
      errors.push("Course Name is required.");
    }

    const capacityNum = parseInt(data.capacity, 10);
    if (isNaN(capacityNum) || capacityNum <= 0) {
      errors.push("Course Capacity must be a positive integer greater than zero.");
    } else if (currentlyAllocatedCount > 0 && capacityNum < currentlyAllocatedCount) {
      errors.push(
        `Capacity cannot be reduced to ${capacityNum} because ${currentlyAllocatedCount} students are already allocated to this course. Please reset the allocation first.`
      );
    }

    if (!data.applicableBranches || data.applicableBranches.length === 0) {
      errors.push("Select at least one applicable branch (e.g. CSE, CCE, ECE).");
    }

    if (!data.applicableSemesters || data.applicableSemesters.length === 0) {
      errors.push("Select at least one applicable semester (e.g. Sem 5, Sem 6).");
    }

    const minCgpaNum = parseFloat(data.minCgpa);
    if (isNaN(minCgpaNum) || minCgpaNum < 0 || minCgpaNum > 10) {
      errors.push("Minimum CGPA criteria must be between 0.0 and 10.0.");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },

  /**
   * Validate allocation preconditions before running the allocation engine (UC-011)
   * @param {Array} electives - All electives
   * @param {Array} preferenceLists - All submitted preference lists
   * @param {Object} ruleConfig - Current allocation rule configuration
   * @returns {Object} { isReady: boolean, checks: Array<{ label, passed, message }> }
   */
  validateAllocationReadiness(electives, preferenceLists, ruleConfig) {
    const activeElectives = electives.filter((e) => e.status === "ACTIVE");
    const submittedLists = preferenceLists.filter((p) => p.status === "SUBMITTED");
    const totalCapacity = activeElectives.reduce((sum, e) => sum + (e.capacity || 0), 0);

    const checks = [
      {
        id: "active_electives",
        label: "Active Elective Courses Configured",
        passed: activeElectives.length > 0,
        message:
          activeElectives.length > 0
            ? `${activeElectives.length} active electives configured in the catalogue.`
            : "No active electives available. Faculty must configure courses.",
      },
      {
        id: "valid_capacities",
        label: "Course Capacities Configured",
        passed: totalCapacity > 0 && activeElectives.every((e) => e.capacity > 0),
        message:
          totalCapacity > 0
            ? `Total configured capacity: ${totalCapacity} seats across ${activeElectives.length} courses.`
            : "One or more courses have invalid or zero capacity.",
      },
      {
        id: "submitted_preferences",
        label: "Submitted Student Preference Lists",
        passed: submittedLists.length > 0,
        message:
          submittedLists.length > 0
            ? `${submittedLists.length} students have submitted valid ranked preference lists.`
            : "No student preference lists submitted yet.",
      },
      {
        id: "allocation_policy",
        label: "Deterministic Allocation Policy Approved",
        passed: Boolean(ruleConfig && ruleConfig.tieBreakPolicy),
        message: ruleConfig?.tieBreakPolicy
          ? `Policy set to: ${ruleConfig.tieBreakPolicy} (${ruleConfig.description})`
          : "No allocation tie-break policy configured.",
      },
    ];

    const isReady = checks.every((c) => c.passed);

    return {
      isReady,
      checks,
    };
  },

  /**
   * Role-based authorization guard helpers
   */
  canManageCourses(role) {
    return role === "faculty" || role === "admin" || role === "sysadmin";
  },

  canStartAllocation(role) {
    return role === "admin" || role === "sysadmin";
  },

  canSubmitPreferences(role) {
    return role === "student";
  },

  canManageSystem(role) {
    return role === "sysadmin";
  },
};
