import { storageService } from "./storageService";
import { validationService } from "./validationService";

class PreferenceService {
  getActiveWindow(cycleId = "slot_sem6_active") {
    const data = storageService.getData();
    return (
      data.registrationWindows.find((w) => w.id === cycleId) ||
      data.registrationWindows[0]
    );
  }

  getAllWindows() {
    const data = storageService.getData();
    return data.registrationWindows || [];
  }

  getStudentPreferenceList(studentId, cycleId = "slot_sem6_active") {
    const data = storageService.getData();
    let prefList = (data.preferenceLists || []).find(
      (p) => p.studentId === studentId && (!cycleId || p.cycleId === cycleId)
    );

    if (!prefList) {
      prefList = {
        id: `pref_${studentId}`,
        studentId,
        cycleId,
        status: "DRAFT",
        submittedAt: null,
        items: [],
      };
    }
    return prefList;
  }

  saveDraft(studentId, cycleId, items) {
    const data = storageService.getData();
    let listIndex = data.preferenceLists.findIndex(
      (p) => p.studentId === studentId && p.cycleId === cycleId
    );

    const updatedList = {
      id: listIndex >= 0 ? data.preferenceLists[listIndex].id : `pref_${studentId}`,
      studentId,
      cycleId,
      status: "DRAFT",
      submittedAt: null,
      items: items.map((item, index) => ({
        electiveId: item.electiveId,
        rank: index + 1,
      })),
    };

    if (listIndex >= 0) {
      data.preferenceLists[listIndex] = updatedList;
    } else {
      data.preferenceLists.push(updatedList);
    }

    storageService.saveData(data);
    return { success: true, preferenceList: updatedList };
  }

  submitPreferences(studentProfile, cycleId, items) {
    const data = storageService.getData();
    const window = this.getActiveWindow(cycleId);
    const electivesMap = new Map();
    (data.electives || []).forEach((e) => electivesMap.set(e.id, e));

    // Normalize items with contiguous ranks
    const normalizedItems = items.map((item, idx) => ({
      electiveId: item.electiveId,
      rank: idx + 1,
    }));

    // First save draft to preserve user inputs even if validation fails
    this.saveDraft(studentProfile.studentId, cycleId, normalizedItems);

    // Run business validation
    const validation = validationService.validatePreferences(
      studentProfile,
      normalizedItems,
      electivesMap,
      window
    );

    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors,
        warnings: validation.warnings,
      };
    }

    // Validation passed: update state to SUBMITTED
    const nowIso = new Date().toISOString();
    const updatedData = storageService.getData();
    const listIndex = updatedData.preferenceLists.findIndex(
      (p) => p.studentId === studentProfile.studentId && p.cycleId === cycleId
    );

    const submittedRecord = {
      id: listIndex >= 0 ? updatedData.preferenceLists[listIndex].id : `pref_${studentProfile.studentId}`,
      studentId: studentProfile.studentId,
      cycleId,
      status: "SUBMITTED",
      submittedAt: nowIso,
      items: normalizedItems,
    };

    if (listIndex >= 0) {
      updatedData.preferenceLists[listIndex] = submittedRecord;
    } else {
      updatedData.preferenceLists.push(submittedRecord);
    }

    storageService.saveData(updatedData);

    storageService.logAudit(
      studentProfile.name,
      "student",
      "PREFERENCES_SUBMITTED",
      `Submitted ${normalizedItems.length} ranked preferences for cycle ${cycleId} at ${nowIso}`
    );

    return {
      success: true,
      preferenceList: submittedRecord,
      submittedAt: nowIso,
    };
  }

  reopenForModification(studentProfile, cycleId) {
    const window = this.getActiveWindow(cycleId);
    if (window.status !== "OPEN") {
      return {
        success: false,
        error: "Cannot edit preferences because the registration window is closed.",
      };
    }

    const data = storageService.getData();
    // Check if allocation is already published
    if (data.allocationRuleConfig?.isPublished) {
      return {
        success: false,
        error: "Allocation results have already been published. Preferences are locked.",
      };
    }

    const listIndex = data.preferenceLists.findIndex(
      (p) => p.studentId === studentProfile.studentId && p.cycleId === cycleId
    );

    if (listIndex === -1) {
      return { success: false, error: "No preference list found to edit." };
    }

    data.preferenceLists[listIndex].status = "DRAFT";
    storageService.saveData(data);

    storageService.logAudit(
      studentProfile.name,
      "student",
      "PREFERENCES_REOPENED",
      `Student reopened submitted preferences for modification within open window.`
    );

    return {
      success: true,
      preferenceList: data.preferenceLists[listIndex],
    };
  }
}

export const preferenceService = new PreferenceService();
