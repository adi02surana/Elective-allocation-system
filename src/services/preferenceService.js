import { storageService } from "./storageService";
import { validationService } from "./validationService";
import { apiClient } from "./apiClient";

class PreferenceService {
  getActiveWindow(cycleId = "slot_sem6_active") {
    const data = storageService.getData();
    return (
      data.registrationWindows?.find((w) => w.id === cycleId) ||
      data.registrationWindows?.[0] ||
      null
    );
  }

  getAllWindows() {
    const data = storageService.getData();
    return data.registrationWindows || [];
  }

  getStudentPreferenceList(studentId, cycleId = "slot_sem6_active") {
    const data = storageService.getData();
    let prefList = (data.preferenceLists || []).find(
      (p) =>
        (p.studentId?.toUpperCase() === studentId?.toUpperCase() || p.studentId === studentId) &&
        (!cycleId || p.cycleId === cycleId)
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

  async fetchStudentPreferenceList(studentId, cycleId = "slot_sem6_active") {
    if (typeof window !== "undefined" && window.fetch && studentId) {
      try {
        const res = await apiClient.get(`/api/preferences/list/${studentId}?cycleId=${cycleId}`);
        if (res?.success && res.preferenceList) {
          const data = storageService.getData();
          const idx = (data.preferenceLists || []).findIndex(
            (p) =>
              (p.studentId?.toUpperCase() === studentId?.toUpperCase() || p.studentId === studentId) &&
              p.cycleId === cycleId
          );
          if (idx >= 0) {
            data.preferenceLists[idx] = res.preferenceList;
          } else {
            data.preferenceLists = data.preferenceLists || [];
            data.preferenceLists.push(res.preferenceList);
          }
          storageService.saveData(data);
          return res.preferenceList;
        }
      } catch (err) {
        console.error("Failed to fetch preference list from backend:", err);
      }
    }
    return this.getStudentPreferenceList(studentId, cycleId);
  }

  async saveDraft(studentId, cycleId = "slot_sem6_active", items = []) {
    const normalizedItems = (items || []).map((item, index) => ({
      electiveId: item.electiveId,
      rank: index + 1,
    }));

    const data = storageService.getData();
    let listIndex = (data.preferenceLists || []).findIndex(
      (p) =>
        (p.studentId?.toUpperCase() === studentId?.toUpperCase() || p.studentId === studentId) &&
        p.cycleId === cycleId
    );

    const updatedList = {
      id: listIndex >= 0 ? data.preferenceLists[listIndex].id : `pref_${studentId}`,
      studentId,
      cycleId,
      status: "DRAFT",
      submittedAt: null,
      items: normalizedItems,
    };

    if (listIndex >= 0) {
      data.preferenceLists[listIndex] = updatedList;
    } else {
      data.preferenceLists = data.preferenceLists || [];
      data.preferenceLists.push(updatedList);
    }
    storageService.saveData(data);

    // Call backend API for SQLite draft persistence
    if (typeof globalThis !== "undefined" && typeof globalThis.fetch === "function") {
      try {
        const res = await apiClient.post("/api/preferences/draft", {
          studentId,
          cycleId,
          items: normalizedItems,
        });
        if (res?.success && res.preferenceList) {
          const freshData = storageService.getData();
          const idx = (freshData.preferenceLists || []).findIndex(
            (p) =>
              (p.studentId?.toUpperCase() === studentId?.toUpperCase() || p.studentId === studentId) &&
              p.cycleId === cycleId
          );
          if (idx >= 0) freshData.preferenceLists[idx] = res.preferenceList;
          storageService.saveData(freshData);
          return { success: true, preferenceList: res.preferenceList };
        }
      } catch (err) {
        console.error("Draft save API call failed:", err);
      }
    }

    return { success: true, preferenceList: updatedList };
  }

  async submitPreferences(studentProfile, cycleId = "slot_sem6_active", items = []) {
    const data = storageService.getData();
    const regWindow = this.getActiveWindow(cycleId);
    const electivesMap = new Map();
    (data.electives || []).forEach((e) => electivesMap.set(e.id, e));

    // Normalize items with contiguous ranks
    const normalizedItems = (items || []).map((item, idx) => ({
      electiveId: item.electiveId,
      rank: idx + 1,
    }));

    // Run business validation
    const validation = validationService.validatePreferences(
      studentProfile,
      normalizedItems,
      electivesMap,
      regWindow
    );

    if (!validation.isValid) {
      // Preserve draft on validation failure so student selections are not lost
      await this.saveDraft(studentProfile.studentId, cycleId, normalizedItems);
      return {
        success: false,
        errors: validation.errors,
        warnings: validation.warnings,
      };
    }

    // Call backend API for SQLite submission persistence
    if (typeof globalThis !== "undefined" && typeof globalThis.fetch === "function") {
      const res = await apiClient.post("/api/preferences/submit", {
        studentId: studentProfile.studentId,
        cycleId,
        items: normalizedItems,
      });

      if (!res.success) {
        return {
          success: false,
          errors: res.errors || (res.error ? [res.error] : ["Preference submission rejected by database."]),
        };
      }

      // Backend succeeded - persist exact confirmed record
      const updatedData = storageService.getData();
      const listIndex = (updatedData.preferenceLists || []).findIndex(
        (p) =>
          (p.studentId?.toUpperCase() === studentProfile.studentId?.toUpperCase() ||
            p.studentId === studentProfile.studentId) &&
          p.cycleId === cycleId
      );

      const submittedRecord = res.preferenceList || {
        id: listIndex >= 0 ? updatedData.preferenceLists[listIndex].id : `pref_${studentProfile.studentId}`,
        studentId: studentProfile.studentId,
        cycleId,
        status: "SUBMITTED",
        submittedAt: res.submittedAt || new Date().toISOString(),
        items: normalizedItems,
      };

      if (listIndex >= 0) {
        updatedData.preferenceLists[listIndex] = submittedRecord;
      } else {
        updatedData.preferenceLists = updatedData.preferenceLists || [];
        updatedData.preferenceLists.push(submittedRecord);
      }

      storageService.saveData(updatedData);

      storageService.logAudit(
        studentProfile.name,
        "student",
        "PREFERENCES_SUBMITTED",
        `Submitted ${normalizedItems.length} ranked preferences for cycle ${cycleId} at ${submittedRecord.submittedAt}`
      );

      return {
        success: true,
        preferenceList: submittedRecord,
        submittedAt: submittedRecord.submittedAt,
      };
    }

    // Offline / unit test fallback
    const nowIso = new Date().toISOString();
    const updatedData = storageService.getData();
    const listIndex = (updatedData.preferenceLists || []).findIndex(
      (p) =>
        (p.studentId?.toUpperCase() === studentProfile.studentId?.toUpperCase() ||
          p.studentId === studentProfile.studentId) &&
        p.cycleId === cycleId
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
      updatedData.preferenceLists = updatedData.preferenceLists || [];
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

  async reopenForModification(studentProfile, cycleId = "slot_sem6_active") {
    const regWindow = this.getActiveWindow(cycleId);
    if (regWindow && regWindow.status !== "OPEN") {
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

    // Call backend API for SQLite reopen
    if (typeof globalThis !== "undefined" && typeof globalThis.fetch === "function") {
      const res = await apiClient.post("/api/preferences/reopen", {
        studentId: studentProfile.studentId,
        cycleId,
      });

      if (!res.success) {
        return {
          success: false,
          error: res.error || "Failed to reopen preferences in database.",
        };
      }
    }

    const updatedData = storageService.getData();
    const listIndex = (updatedData.preferenceLists || []).findIndex(
      (p) =>
        (p.studentId?.toUpperCase() === studentProfile.studentId?.toUpperCase() ||
          p.studentId === studentProfile.studentId) &&
        p.cycleId === cycleId
    );

    if (listIndex === -1) {
      return { success: false, error: "No preference list found to edit." };
    }

    updatedData.preferenceLists[listIndex].status = "DRAFT";
    updatedData.preferenceLists[listIndex].submittedAt = null;
    storageService.saveData(updatedData);

    storageService.logAudit(
      studentProfile.name,
      "student",
      "PREFERENCES_REOPENED",
      `Student reopened submitted preferences for modification within open window.`
    );

    return {
      success: true,
      preferenceList: updatedData.preferenceLists[listIndex],
    };
  }
}

export const preferenceService = new PreferenceService();
