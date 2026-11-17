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

  async updateRuleConfig(updates, actorRole = "admin", actorName = "Academic Administrator") {
    if (!validationService.canStartAllocation(actorRole)) {
      return { success: false, error: "Unauthorized to configure allocation rules." };
    }

    const data = storageService.getData();
    const cycleId = data.allocationRuleConfig?.cycleId || "slot_sem6_active";

    if (typeof window !== "undefined" && window.fetch) {
      const res = await apiClient.put("/api/allocation/config", {
        ...updates,
        cycleId,
        actorRole,
        actorName,
      });
      if (res?.success && res.config) {
        data.allocationRuleConfig = res.config;
      }
    } else {
      data.allocationRuleConfig = {
        ...data.allocationRuleConfig,
        ...updates,
      };
    }

    storageService.saveData(data);
    storageService.logAudit(
      actorName,
      actorRole,
      "ALLOCATION_RULE_UPDATED",
      `Tie-break policy updated to ${data.allocationRuleConfig.tieBreakPolicy}`
    );

    return { success: true, config: data.allocationRuleConfig };
  }

  checkReadiness(cycleId = "slot_sem6_active") {
    const data = storageService.getData();
    const electives = data.electives || [];
    const preferenceLists = (data.preferenceLists || []).filter((p) => p.cycleId === cycleId);
    const ruleConfig = this.getRuleConfig();

    return validationService.validateAllocationReadiness(electives, preferenceLists, ruleConfig);
  }

  async executeAllocation(actorRole = "admin", actorName = "Academic Administrator") {
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

    const ruleConfig = this.getRuleConfig();

    // Persist directly into backend SQLite database in transaction
    if (typeof window !== "undefined" && window.fetch) {
      const res = await apiClient.post("/api/allocation/execute", {
        cycleId: ruleConfig.cycleId || "slot_sem6_active",
        actorRole,
        actorName,
      });

      if (!res.success) {
        return {
          success: false,
          error: res.error || "Failed to execute allocation on server.",
          checks: res.checks,
        };
      }

      const data = storageService.getData();
      data.allocationResults = res.results;
      data.allocationRuleConfig.status = "COMPLETED";
      data.allocationRuleConfig.lastRunAt = new Date().toISOString();
      data.allocationRuleConfig.isPublished = false;
      storageService.saveData(data);

      return {
        success: true,
        results: res.results,
        courseStats: res.courseStats,
        summary: res.summary,
        executionLogs: res.executionLogs,
      };
    }

    // Offline / unit test fallback
    const data = storageService.getData();
    const students = data.studentProfiles || [];
    const electives = data.electives || [];
    const preferenceLists = data.preferenceLists || [];

    const engineOutput = runAllocationEngine(students, electives, preferenceLists, ruleConfig);

    data.allocationResults = engineOutput.results;
    data.allocationRuleConfig.status = "COMPLETED";
    data.allocationRuleConfig.lastRunAt = new Date().toISOString();
    data.allocationRuleConfig.isPublished = false;
    storageService.saveData(data);

    storageService.logAudit(
      actorName,
      actorRole,
      "ALLOCATION_EXECUTED",
      `Allocated ${engineOutput.summary.totalAllocated} students, ${engineOutput.summary.totalUnallocated} unallocated across ${engineOutput.summary.totalElectives} electives.`
    );

    return {
      success: true,
      results: engineOutput.results,
      courseStats: engineOutput.courseStats,
      summary: engineOutput.summary,
      executionLogs: engineOutput.executionLogs,
    };
  }

  async publishResults(actorRole = "admin", actorName = "Academic Administrator") {
    if (!validationService.canStartAllocation(actorRole)) {
      return { success: false, error: "Unauthorized to publish results." };
    }

    const data = storageService.getData();
    if (!data.allocationResults || data.allocationResults.length === 0) {
      return { success: false, error: "No allocation results exist to publish. Run allocation first." };
    }

    if (typeof window !== "undefined" && window.fetch) {
      const res = await apiClient.post("/api/allocation/publish", {
        cycleId: data.allocationRuleConfig?.cycleId || "slot_sem6_active",
        actorRole,
        actorName,
      });

      if (!res.success) {
        return { success: false, error: res.error || "Failed to publish results on server." };
      }
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

    return { success: true };
  }

  async resetAllocation(actorRole = "admin", actorName = "Academic Administrator") {
    if (!validationService.canStartAllocation(actorRole)) {
      return { success: false, error: "Unauthorized." };
    }

    const data = storageService.getData();

    if (typeof window !== "undefined" && window.fetch) {
      const res = await apiClient.post("/api/allocation/reset", {
        cycleId: data.allocationRuleConfig?.cycleId || "slot_sem6_active",
        actorRole,
        actorName,
      });

      if (!res.success) {
        return { success: false, error: res.error || "Failed to reset allocation in database." };
      }
    }

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
