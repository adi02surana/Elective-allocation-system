import React, { useState, useEffect } from "react";
import { authService } from "../services/authService";
import { allocationService } from "../services/allocationService";
import { storageService } from "../services/storageService";
import { StatusBadge } from "../components/StatusBadge";
import { Modal } from "../components/Modal";
import {
  ShieldCheck,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Terminal,
  Send,
  Eye,
  Award,
  Layers,
} from "lucide-react";

export function AllocationAdmin({ onNavigateToReports }) {
  const [readiness, setReadiness] = useState({ isReady: false, checks: [] });
  const [ruleConfig, setRuleConfig] = useState(null);
  const [allocationStatus, setAllocationStatus] = useState("NOT_STARTED");
  const [executionLogs, setExecutionLogs] = useState([]);
  const [resultsSummary, setResultsSummary] = useState(null);
  const [recentResults, setRecentResults] = useState([]);

  // Modals
  const [showConfirmRunModal, setShowConfirmRunModal] = useState(false);
  const [showConfirmPublishModal, setShowConfirmPublishModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const currentUser = authService.getCurrentUser();

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      await storageService.syncFromBackend();
    } catch {
      // fallback
    }
    const r = allocationService.checkReadiness();
    setReadiness(r);

    const config = allocationService.getRuleConfig();
    setRuleConfig(config);
    setAllocationStatus(config.status);

    const existingResults = allocationService.getResults();
    setRecentResults(existingResults);

    if (existingResults.length > 0) {
      const allocatedCount = existingResults.filter((x) => x.status === "ALLOCATED").length;
      const unallocatedCount = existingResults.filter((x) => x.status === "UNALLOCATED").length;
      setResultsSummary({
        total: existingResults.length,
        allocated: allocatedCount,
        unallocated: unallocatedCount,
      });
    } else {
      setResultsSummary(null);
    }
  };

  const handlePolicyChange = async (e) => {
    const newPolicy = e.target.value;
    let description = "";
    if (newPolicy === "CGPA_MERIT") {
      description = "Merit-based priority ordering by CGPA descending with FCFS tie-break for identical scores.";
    } else if (newPolicy === "FIRST_COME_FIRST_SERVED") {
      description = "First-Come, First-Served priority based strictly on application submission timestamp.";
    } else if (newPolicy === "STUDENT_ID") {
      description = "Ascending order of institutional Student Roll Number.";
    }

    const updated = await allocationService.updateRuleConfig(
      { tieBreakPolicy: newPolicy, description },
      currentUser?.role,
      currentUser?.name
    );

    if (updated.success) {
      setRuleConfig(updated.config);
      setActionMessage(`Tie-break policy updated to ${newPolicy}.`);
    }
  };

  const executeAllocation = async () => {
    setShowConfirmRunModal(false);
    setActionMessage(null);
    setErrorMessage(null);

    const output = await allocationService.executeAllocation(currentUser?.role, currentUser?.name);

    if (output.success) {
      setRecentResults(output.results);
      setExecutionLogs(output.executionLogs || []);
      setResultsSummary({
        total: output.summary.totalStudentsProcessed,
        allocated: output.summary.totalAllocated,
        unallocated: output.summary.totalUnallocated,
      });
      setAllocationStatus("COMPLETED");
      setActionMessage(
        `Allocation computed successfully! Processed ${output.summary.totalStudentsProcessed} students (${output.summary.totalAllocated} allocated, ${output.summary.totalUnallocated} unallocated). Review outcomes below before publishing.`
      );
      await loadStatus();
    } else {
      setErrorMessage(output.error || "Allocation execution failed.");
    }
  };

  const publishResults = async () => {
    setShowConfirmPublishModal(false);
    const res = await allocationService.publishResults(currentUser?.role, currentUser?.name);
    if (res.success) {
      setActionMessage("Allocation outcomes have been officially published! Students can now view their individual results.");
      await loadStatus();
    } else {
      setErrorMessage(res.error);
    }
  };

  const resetAllocation = async () => {
    setShowResetModal(false);
    const res = await allocationService.resetAllocation(currentUser?.role, currentUser?.name);
    if (res.success) {
      setActionMessage("Allocation state cleared. You may adjust capacities or rules and re-run.");
      setRecentResults([]);
      setResultsSummary(null);
      setExecutionLogs([]);
      await loadStatus();
    } else {
      setErrorMessage(res.error);
    }
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Elective Allocation Administration</h1>
          <p className="page-description">
            Verify preconditions, configure tie-break policies, and initiate centralized allocation.
          </p>
        </div>
        <div>
          <StatusBadge status={allocationStatus} label={`Allocation: ${allocationStatus}`} />
        </div>
      </div>

      {/* Notifications */}
      {actionMessage && (
        <div className="alert alert-success">
          <CheckCircle2 size={20} style={{ flexShrink: 0 }} />
          <div>{actionMessage}</div>
        </div>
      )}

      {errorMessage && (
        <div className="alert alert-danger">
          <AlertTriangle size={20} style={{ flexShrink: 0 }} />
          <div>{errorMessage}</div>
        </div>
      )}

      {/* Preconditions Checklist Card */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">
              <ShieldCheck size={20} color="#2563eb" />
              <span>Allocation Preconditions Checklist</span>
            </h2>
            <p className="card-subtitle">
              System verification of all prerequisites prior to starting allocation engine
            </p>
          </div>
          <div>
            <span
              className={`badge ${readiness.isReady ? "badge-allocated" : "badge-unallocated"}`}
            >
              {readiness.isReady ? "All Preconditions Met" : "Preconditions Incomplete"}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          {readiness.checks.map((check) => (
            <div
              key={check.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.85rem 1rem",
                borderRadius: "8px",
                backgroundColor: check.passed ? "#f8fafc" : "#fef2f2",
                border: check.passed ? "1px solid #e2e8f0" : "1px solid #fecaca",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                {check.passed ? (
                  <CheckCircle2 size={20} color="#059669" />
                ) : (
                  <XCircle size={20} color="#dc2626" />
                )}
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.92rem", color: "#0f172a" }}>
                    {check.label}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: check.passed ? "#64748b" : "#b91c1c" }}>
                    {check.message}
                  </div>
                </div>
              </div>

              <div>
                <span className={`badge ${check.passed ? "badge-success" : "badge-danger"}`}>
                  {check.passed ? "PASSED" : "FAILED"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Allocation Rule Configuration & Execution Panel */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Deterministic Allocation Rule Configuration</h2>
            <p className="card-subtitle">
              Configure tie-break resolution and student priority order before starting allocation
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem", marginBottom: "1.5rem" }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Deterministic Tie-Break Policy *</label>
            <select
              className="form-select"
              value={ruleConfig?.tieBreakPolicy || "CGPA_MERIT"}
              onChange={handlePolicyChange}
              disabled={allocationStatus === "PUBLISHED"}
            >
              <option value="CGPA_MERIT">
                CGPA Merit Priority (Tie-break: FCFS Application Timestamp) [Recommended]
              </option>
              <option value="FIRST_COME_FIRST_SERVED">
                Pure First-Come, First-Served (Application Submission Timestamp)
              </option>
              <option value="STUDENT_ID">
                Institutional Student Roll Number Order (Ascending)
              </option>
            </select>
            <div className="form-help" style={{ marginTop: "0.5rem" }}>
              {ruleConfig?.description}
            </div>
          </div>

          <div
            style={{
              backgroundColor: "#f8fafc",
              padding: "1rem",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              fontSize: "0.85rem",
            }}
          >
            <div style={{ fontWeight: 600, color: "#1e3a8a", marginBottom: "0.35rem" }}>
              Engine Algorithm Summary
            </div>
            <ul style={{ paddingLeft: "1.2rem", color: "#475569", lineHeight: "1.5" }}>
              <li>Students ranked by approved policy order.</li>
              <li>Preferences evaluated sequentially (Choice #1, #2, #3...).</li>
              <li>Capacity strictly enforced (never exceeds limit).</li>
              <li>Ineligible choices automatically skipped to next rank.</li>
              <li>Students receive at most 1 course, or marked Unallocated.</li>
            </ul>
          </div>
        </div>

        {/* Action Controls Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "1rem",
            paddingTop: "1.25rem",
            borderTop: "1px solid #e2e8f0",
          }}
        >
          <div>
            {allocationStatus === "COMPLETED" && !ruleConfig?.isPublished && (
              <span style={{ fontSize: "0.85rem", color: "#d97706", fontWeight: 600 }}>
                ⚠️ Results computed in draft. Academic Administrator must publish results to make them visible to students.
              </span>
            )}
            {allocationStatus === "PUBLISHED" && (
              <span style={{ fontSize: "0.85rem", color: "#059669", fontWeight: 600 }}>
                ✓ Official allocation published on {new Date(ruleConfig?.publishedAt || "").toLocaleString()}
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {allocationStatus !== "NOT_STARTED" && (
              <button onClick={() => setShowResetModal(true)} className="btn btn-secondary">
                <RotateCcw size={16} />
                <span>Reset Allocation</span>
              </button>
            )}

            {allocationStatus === "COMPLETED" && !ruleConfig?.isPublished && (
              <button onClick={() => setShowConfirmPublishModal(true)} className="btn btn-success">
                <Send size={16} />
                <span>Publish Official Results</span>
              </button>
            )}

            <button
              onClick={() => setShowConfirmRunModal(true)}
              disabled={!readiness.isReady}
              className="btn btn-primary"
            >
              <Play size={16} />
              <span>{allocationStatus === "NOT_STARTED" ? "Start Allocation" : "Re-Run Allocation"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Allocation Outcomes Summary if results exist */}
      {resultsSummary && (
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-icon-box" style={{ backgroundColor: "#eff6ff", color: "#2563eb" }}>
              <ShieldCheck size={24} />
            </div>
            <div>
              <div className="metric-value">{resultsSummary.total}</div>
              <div className="metric-label">Processed Preference Lists</div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon-box" style={{ backgroundColor: "#ecfdf5", color: "#059669" }}>
              <Award size={24} />
            </div>
            <div>
              <div className="metric-value">{resultsSummary.allocated}</div>
              <div className="metric-label">Students Allocated</div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon-box" style={{ backgroundColor: "#fef2f2", color: "#dc2626" }}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <div className="metric-value">{resultsSummary.unallocated}</div>
              <div className="metric-label">Students Unallocated</div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon-box" style={{ backgroundColor: "#f3e8ff", color: "#7e22ce" }}>
              <Layers size={24} />
            </div>
            <div>
              <div className="metric-value">
                {Math.round((resultsSummary.allocated / resultsSummary.total) * 100)}%
              </div>
              <div className="metric-label">Allocation Success Rate</div>
            </div>
          </div>
        </div>
      )}

      {/* Execution Logs Console (Transparent Engine Trace) */}
      {executionLogs.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">
                <Terminal size={18} color="#2563eb" />
                <span>Allocation Engine Trace Log</span>
              </h2>
              <p className="card-subtitle">
                Step-by-step audit record of merit sorting, contested seat evaluations, and allocation decisions
              </p>
            </div>
          </div>

          <div className="log-console">
            {executionLogs.map((entry, idx) => (
              <div key={idx} className="log-entry">
                {entry}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick View of Computed Student Results */}
      {recentResults.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Computed Student Allocation Results</h2>
              <p className="card-subtitle">
                Outcome preview for all processed students in this cycle
              </p>
            </div>
            <div>
              {onNavigateToReports && (
                <button onClick={onNavigateToReports} className="btn btn-secondary btn-sm">
                  <Eye size={14} />
                  <span>Open Full Reports & Analytics</span>
                </button>
              )}
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Roll No</th>
                  <th>Student Name</th>
                  <th>Branch</th>
                  <th>CGPA</th>
                  <th>Outcome</th>
                  <th>Allocated Course</th>
                  <th>Rank</th>
                  <th>Decision Reason</th>
                </tr>
              </thead>
              <tbody>
                {recentResults.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong style={{ fontFamily: "var(--font-mono)", color: "#1e3a8a" }}>
                        {r.studentId}
                      </strong>
                    </td>
                    <td>{r.studentName}</td>
                    <td>{r.branch}</td>
                    <td>{r.cgpa?.toFixed(2)}</td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td>
                      {r.electiveCode || r.courseCode ? (
                        <strong style={{ color: "#059669" }}>
                          {r.electiveCode || r.courseCode} — {r.electiveName || r.courseName}
                        </strong>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>None</span>
                      )}
                    </td>
                    <td>
                      {r.preferenceRank ? (
                        <span style={{ fontWeight: 700, color: "#2563eb" }}>#{r.preferenceRank}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ fontSize: "0.82rem", color: "#475569", maxWidth: "340px" }}>
                      {r.reason || r.assignedReason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Start Allocation Confirmation Modal */}
      <Modal
        isOpen={showConfirmRunModal}
        onClose={() => setShowConfirmRunModal(false)}
        title="Confirm Elective Allocation Execution"
        footer={
          <>
            <button onClick={() => setShowConfirmRunModal(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button onClick={executeAllocation} className="btn btn-primary">
              <Play size={16} />
              Confirm & Run Engine
            </button>
          </>
        }
      >
        <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
          <Play size={36} color="#2563eb" style={{ flexShrink: 0 }} />
          <div>
            <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
              Ready to execute the centralized allocation algorithm?
            </p>
            <p style={{ fontSize: "0.85rem", color: "#64748b" }}>
              The engine will read all submitted preferences, verify live course capacities, evaluate 
              eligibility criteria, and resolve any contested seats using the configured{" "}
              <strong>{ruleConfig?.tieBreakPolicy}</strong> policy.
            </p>
          </div>
        </div>
      </Modal>

      {/* Publish Results Confirmation Modal */}
      <Modal
        isOpen={showConfirmPublishModal}
        onClose={() => setShowConfirmPublishModal(false)}
        title="Publish Official Allocation Results"
        footer={
          <>
            <button onClick={() => setShowConfirmPublishModal(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button onClick={publishResults} className="btn btn-success">
              <Send size={16} />
              Confirm & Publish
            </button>
          </>
        }
      >
        <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
          <Send size={36} color="#059669" style={{ flexShrink: 0 }} />
          <div>
            <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
              Publish final results to student academic portals?
            </p>
            <p style={{ fontSize: "0.85rem", color: "#64748b" }}>
              Once published, all students will be able to log in and inspect their allocated elective 
              or unallocated status. Preference lists for this cycle will be formally locked.
            </p>
          </div>
        </div>
      </Modal>

      {/* Reset Confirmation Modal */}
      <Modal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        title="Reset Allocation Results"
        footer={
          <>
            <button onClick={() => setShowResetModal(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button onClick={resetAllocation} className="btn btn-danger">
              <RotateCcw size={16} />
              Reset Results
            </button>
          </>
        }
      >
        <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
          <AlertTriangle size={36} color="#dc2626" style={{ flexShrink: 0 }} />
          <div>
            <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
              Clear computed allocation outcomes?
            </p>
            <p style={{ fontSize: "0.85rem", color: "#64748b" }}>
              This will clear the current computed results and return allocation status to "NOT_STARTED". 
              Student submitted preference lists will remain intact.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
