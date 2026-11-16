import { storageService } from "./storageService";
import { validationService } from "./validationService";
import { runAllocationEngine } from "./allocationEngine";
import { apiClient } from "./apiClient";

class AllocationService {
  getRuleConfig() {
    const data = storageService.getData();
    return (
      data.allocationRuleConfig || {
        cycleId: "slot_sem6_active",
        cycleName: "Spring 2026 Regular Open Elective Window (Sem 6)",
        tieBreakPolicy: "CGPA_MERIT",
        status: "NOT_STARTED",
        description: "Merit-based priority ordering by CGPA descending with FCFS tie-break.",
        maxAllocationsPerStudent: 1,
        lastRunAt: null,
        isPublished: false,
      }
    );
  }

  updateRuleConfig(updates, actorRole = "admin", actorName = "Academic Administrator") {
    if (!validationService.canStartAllocation(actorRole)) {
      return { success: false, error: "Unauthorized to configure allocation rules." };
    }

    const data = storageService.getData();
    data.allocationRuleConfig = {
      ...data.allocationRuleConfig,
      ...updates,
    };

    storageService.saveData(data);
    storageService.logAudit(
      actorName,
      actorRole,
      "ALLOCATION_RULE_UPDATED",
      `Tie-break policy updated to ${data.allocationRuleConfig.tieBreakPolicy}`
    );

    if (typeof window !== "undefined" && window.fetch) {
      apiClient
        .put("/api/allocation/config", {
          ...updates,
          cycleId: data.allocationRuleConfig.cycleId,
          actorRole,
          actorName,
        })
        .catch(() => {});
    }

    return { success: true, config: data.allocationRuleConfig };
  }

  checkReadiness(cycleId = "slot_sem6_active") {
    const data = storageService.getData();
    const electives = data.electives || [];
    const preferenceLists = (data.preferenceLists || []).filter((p) => p.cycleId === cycleId);
    const ruleConfig = this.getRuleConfig();

    return validationService.validateAllocationReadiness(electives, preferenceLists, ruleConfig);
  }

  executeAllocation(actorRole = "admin", actorName = "Academic Administrator") {
    if (!validationService.canStartAllocation(actorRole)) {
      return { success: false, error: "Unauthorized: Only Academic Administrators can initiate allocation." };
    }

    const readiness = this.checkReadiness();
    if (!readiness.isReady) {
      return {
        success: false,
        error: "Allocation preconditions not met. Please review readiness checklist.",
        checks: readiness.checks,
      };
    }

    const data = storageService.getData();
    const students = data.studentProfiles || [];
    const electives = data.electives || [];
    const preferenceLists = data.preferenceLists || [];
    const ruleConfig = this.getRuleConfig();

    // Run the deterministic engine!
    const engineOutput = runAllocationEngine(students, electives, preferenceLists, ruleConfig);

    // Save results to storage
    data.allocationResults = engineOutput.results;
    data.allocationRuleConfig.status = "COMPLETED";
    data.allocationRuleConfig.lastRunAt = new Date().toISOString();
    data.allocationRuleConfig.isPublished = false; // Computed, but awaiting publication review

    storageService.saveData(data);

    storageService.logAudit(
      actorName,
      actorRole,
      "ALLOCATION_EXECUTED",
      `Allocated ${engineOutput.summary.totalAllocated} students, ${engineOutput.summary.totalUnallocated} unallocated across ${engineOutput.summary.totalElectives} electives.`
    );

    // Also persist directly into backend SQLite database in transaction
    if (typeof window !== "undefined" && window.fetch) {
      apiClient
        .post("/api/allocation/execute", {
          cycleId: ruleConfig.cycleId || "slot_sem6_active",
          actorRole,
          actorName,
        })
        .catch(() => {});
    }

    return {
      success: true,
      results: engineOutput.results,
      courseStats: engineOutput.courseStats,
      summary: engineOutput.summary,
      executionLogs: engineOutput.executionLogs,
    };
  }

  publishResults(actorRole = "admin", actorName = "Academic Administrator") {
    if (!validationService.canStartAllocation(actorRole)) {
      return { success: false, error: "Unauthorized to publish results." };
    }

    const data = storageService.getData();
    if (!data.allocationResults || data.allocationResults.length === 0) {
      return { success: false, error: "No allocation results exist to publish. Run allocation first." };
    }

    data.allocationRuleConfig.isPublished = true;
    data.allocationRuleConfig.status = "PUBLISHED";
    data.allocationRuleConfig.publishedAt = new Date().toISOString();

    storageService.saveData(data);

    storageService.logAudit(
      actorName,
      actorRole,
      "RESULTS_PUBLISHED",
      `Allocation results officially published for students to view.`
    );

    if (typeof window !== "undefined" && window.fetch) {
      apiClient
        .post("/api/allocation/publish", {
          cycleId: data.allocationRuleConfig.cycleId || "slot_sem6_active",
          actorRole,
          actorName,
        })
        .catch(() => {});
    }

    return { success: true };
  }

  resetAllocation(actorRole = "admin", actorName = "Academic Administrator") {
    if (!validationService.canStartAllocation(actorRole)) {
      return { success: false, error: "Unauthorized." };
    }

    const data = storageService.getData();
    data.allocationResults = [];
    data.allocationRuleConfig.status = "NOT_STARTED";
    data.allocationRuleConfig.isPublished = false;
    data.allocationRuleConfig.lastRunAt = null;

    storageService.saveData(data);

    storageService.logAudit(
      actorName,
      actorRole,
      "ALLOCATION_RESET",
      `Allocation run and computed results were reset.`
    );

    if (typeof window !== "undefined" && window.fetch) {
      apiClient
        .post("/api/allocation/reset", {
          cycleId: data.allocationRuleConfig.cycleId || "slot_sem6_active",
          actorRole,
          actorName,
        })
        .catch(() => {});
    }

    return { success: true };
  }

  getResults(cycleId = "slot_sem6_active") {
    const data = storageService.getData();
    return data.allocationResults || [];
  }

  getStudentResult(studentId, isStaff = false) {
    const data = storageService.getData();
    const config = this.getRuleConfig();

    // Students can only view results if published (unless viewed by staff/admin)
    if (!config.isPublished && !isStaff) {
      return {
        isAvailable: false,
        status: "PENDING_PUBLICATION",
        message: "Allocation results have not yet been published by Academic Administration.",
      };
    }

    const result = (data.allocationResults || []).find((r) => r.studentId === studentId);
    if (!result) {
      return {
        isAvailable: false,
        status: "NOT_FOUND",
        message: "No allocation record found. Ensure your preferences were submitted before allocation.",
      };
    }

    return {
      isAvailable: true,
      result,
      isPublished: config.isPublished,
    };
  }
}

export const allocationService = new AllocationService();
