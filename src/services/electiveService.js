import { storageService } from "./storageService";
import { validationService } from "./validationService";

class ElectiveService {
  getAllElectives() {
    const data = storageService.getData();
    const electives = data.electives || [];
    const results = data.allocationResults || [];

    // Derive allocated counts from results
    return electives.map((e) => {
      const allocatedStudents = results.filter(
        (r) => r.electiveId === e.id && r.status === "ALLOCATED"
      );
      const allocatedCount = allocatedStudents.length;
      return {
        ...e,
        allocatedCount,
        availableSeats: Math.max(0, (e.capacity || 0) - allocatedCount),
      };
    });
  }

  getElectiveById(id) {
    const all = this.getAllElectives();
    return all.find((e) => e.id === id) || null;
  }

  getElectivesForStudent(studentProfile) {
    if (!studentProfile) return [];
    const all = this.getAllElectives();

    return all.map((elective) => {
      const isBranchEligible =
        !elective.applicableBranches ||
        elective.applicableBranches.length === 0 ||
        elective.applicableBranches.includes(studentProfile.branch);

      const isSemesterEligible =
        !elective.applicableSemesters ||
        elective.applicableSemesters.length === 0 ||
        elective.applicableSemesters.includes(studentProfile.semester);

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

  createElective(data, actorRole = "faculty", actorName = "Faculty Coordinator") {
    if (!validationService.canManageCourses(actorRole)) {
      return { success: false, errors: ["Unauthorized: Only Faculty Coordinators or Administrators can create electives."] };
    }

    const validation = validationService.validateElective(data, 0);
    if (!validation.isValid) {
      return { success: false, errors: validation.errors };
    }

    const appData = storageService.getData();
    // Check duplicate course code
    const existingCode = appData.electives.find(
      (e) => e.courseCode.toUpperCase() === data.courseCode.trim().toUpperCase()
    );
    if (existingCode) {
      return { success: false, errors: [`Course Code ${data.courseCode} already exists.`] };
    }

    const newElective = {
      id: `el_${Date.now()}`,
      courseCode: data.courseCode.trim().toUpperCase(),
      name: data.name.trim(),
      description: data.description || "",
      department: data.department || "CSE",
      applicableBranches: data.applicableBranches || ["CSE"],
      applicableSemesters: (data.applicableSemesters || [6]).map(Number),
      capacity: parseInt(data.capacity, 10),
      minCgpa: parseFloat(data.minCgpa) || 0.0,
      prerequisites: data.prerequisites || "None",
      facultyName: data.facultyName || actorName,
      status: data.status || "ACTIVE",
    };

    appData.electives.push(newElective);
    storageService.saveData(appData);

    storageService.logAudit(
      actorName,
      actorRole,
      "COURSE_CREATED",
      `Created elective ${newElective.courseCode} (${newElective.name}) with capacity ${newElective.capacity}`
    );

    return { success: true, elective: newElective };
  }

  updateElective(id, data, actorRole = "faculty", actorName = "Faculty Coordinator") {
    if (!validationService.canManageCourses(actorRole)) {
      return { success: false, errors: ["Unauthorized: Only Faculty Coordinators or Administrators can edit electives."] };
    }

    const appData = storageService.getData();
    const electiveIndex = appData.electives.findIndex((e) => e.id === id);
    if (electiveIndex === -1) {
      return { success: false, errors: ["Elective course not found."] };
    }

    // Check currently allocated count
    const allocatedCount = (appData.allocationResults || []).filter(
      (r) => r.electiveId === id && r.status === "ALLOCATED"
    ).length;

    const validation = validationService.validateElective(data, allocatedCount);
    if (!validation.isValid) {
      return { success: false, errors: validation.errors };
    }

    const updated = {
      ...appData.electives[electiveIndex],
      courseCode: data.courseCode.trim().toUpperCase(),
      name: data.name.trim(),
      description: data.description || "",
      department: data.department || appData.electives[electiveIndex].department,
      applicableBranches: data.applicableBranches || appData.electives[electiveIndex].applicableBranches,
      applicableSemesters: (data.applicableSemesters || appData.electives[electiveIndex].applicableSemesters).map(Number),
      capacity: parseInt(data.capacity, 10),
      minCgpa: parseFloat(data.minCgpa) || 0.0,
      prerequisites: data.prerequisites || "",
      facultyName: data.facultyName || appData.electives[electiveIndex].facultyName,
      status: data.status || appData.electives[electiveIndex].status,
    };

    appData.electives[electiveIndex] = updated;
    storageService.saveData(appData);

    storageService.logAudit(
      actorName,
      actorRole,
      "COURSE_UPDATED",
      `Updated elective ${updated.courseCode} (Capacity: ${updated.capacity}, Status: ${updated.status})`
    );

    return { success: true, elective: updated };
  }

  deleteElective(id, actorRole = "faculty", actorName = "Faculty Coordinator") {
    if (!validationService.canManageCourses(actorRole)) {
      return { success: false, errors: ["Unauthorized."] };
    }

    const appData = storageService.getData();
    const elective = appData.electives.find((e) => e.id === id);
    if (!elective) {
      return { success: false, errors: ["Elective not found."] };
    }

    const hasAllocations = (appData.allocationResults || []).some(
      (r) => r.electiveId === id && r.status === "ALLOCATED"
    );
    if (hasAllocations) {
      return {
        success: false,
        errors: ["Cannot delete course with active allocations. Reset allocation first."],
      };
    }

    appData.electives = appData.electives.filter((e) => e.id !== id);
    storageService.saveData(appData);

    storageService.logAudit(
      actorName,
      actorRole,
      "COURSE_DELETED",
      `Deleted elective course ${elective.courseCode} (${elective.name})`
    );

    return { success: true };
  }
}

export const electiveService = new ElectiveService();
