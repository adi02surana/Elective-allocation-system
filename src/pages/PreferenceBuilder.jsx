import React, { useState, useEffect } from "react";
import { authService } from "../services/authService";
import { preferenceService } from "../services/preferenceService";
import { electiveService } from "../services/electiveService";
import { StatusBadge } from "../components/StatusBadge";
import { Modal } from "../components/Modal";
import {
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldAlert,
  Send,
  Edit3,
  HelpCircle,
} from "lucide-react";

export function PreferenceBuilder({ initialAddElectiveId }) {
  const [profile, setProfile] = useState(null);
  const [activeWindow, setActiveWindow] = useState(null);
  const [availableElectives, setAvailableElectives] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [prefStatus, setPrefStatus] = useState("DRAFT");
  const [submittedAt, setSubmittedAt] = useState(null);
  
  // UI states
  const [errors, setErrors] = useState([]);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedElectiveToAdd, setSelectedElectiveToAdd] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const student = authService.getCurrentStudentProfile();
    setProfile(student);

    if (student) {
      const window = preferenceService.getActiveWindow();
      setActiveWindow(window);

      const electives = electiveService.getElectivesForStudent(student);
      setAvailableElectives(electives);

      const prefList = preferenceService.getStudentPreferenceList(student.studentId, window?.id);
      setPrefStatus(prefList.status);
      setSubmittedAt(prefList.submittedAt);

      if (prefList.items && prefList.items.length > 0) {
        setSelectedItems(prefList.items);
      } else if (initialAddElectiveId) {
        setSelectedItems([{ electiveId: initialAddElectiveId, rank: 1 }]);
      }
    }
  };

  const electivesMap = new Map();
  availableElectives.forEach((e) => electivesMap.set(e.id, e));

  const isWindowOpen = activeWindow?.status === "OPEN";
  const isLocked = prefStatus === "SUBMITTED" || !isWindowOpen;

  // Add elective to preference list
  const handleAddElective = () => {
    if (!selectedElectiveToAdd) return;

    if (selectedItems.some((item) => item.electiveId === selectedElectiveToAdd)) {
      setErrors(["This course is already in your preference list. Duplicate choices are not allowed."]);
      return;
    }

    const nextRank = selectedItems.length + 1;
    const newItems = [...selectedItems, { electiveId: selectedElectiveToAdd, rank: nextRank }];
    setSelectedItems(newItems);
    setSelectedElectiveToAdd("");
    setErrors([]);
    setSuccessMessage(null);

    // Auto save draft
    if (profile && activeWindow) {
      preferenceService.saveDraft(profile.studentId, activeWindow.id, newItems);
    }
  };

  // Move choice UP
  const handleMoveUp = (index) => {
    if (index === 0) return;
    const updated = [...selectedItems];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    // Re-index ranks
    const reindexed = updated.map((item, idx) => ({ ...item, rank: idx + 1 }));
    setSelectedItems(reindexed);
    if (profile && activeWindow) {
      preferenceService.saveDraft(profile.studentId, activeWindow.id, reindexed);
    }
  };

  // Move choice DOWN
  const handleMoveDown = (index) => {
    if (index === selectedItems.length - 1) return;
    const updated = [...selectedItems];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    const reindexed = updated.map((item, idx) => ({ ...item, rank: idx + 1 }));
    setSelectedItems(reindexed);
    if (profile && activeWindow) {
      preferenceService.saveDraft(profile.studentId, activeWindow.id, reindexed);
    }
  };

  // Remove choice
  const handleRemove = (index) => {
    const updated = selectedItems.filter((_, idx) => idx !== index);
    const reindexed = updated.map((item, idx) => ({ ...item, rank: idx + 1 }));
    setSelectedItems(reindexed);
    if (profile && activeWindow) {
      preferenceService.saveDraft(profile.studentId, activeWindow.id, reindexed);
    }
  };

  // Open Review Dialog
  const handleInitiateSubmit = () => {
    setErrors([]);
    setSuccessMessage(null);

    // Quick client check
    const minRequired = activeWindow?.minPreferences || 3;
    if (selectedItems.length < minRequired) {
      setErrors([
        `Please select and rank at least ${minRequired} preferences before submitting (currently selected: ${selectedItems.length}).`,
      ]);
      return;
    }

    setShowReviewModal(true);
  };

  // Final submission execution (UC-005)
  const handleConfirmSubmit = () => {
    setShowReviewModal(false);
    const result = preferenceService.submitPreferences(profile, activeWindow.id, selectedItems);

    if (result.success) {
      setPrefStatus("SUBMITTED");
      setSubmittedAt(result.submittedAt);
      setSuccessMessage(
        `Preferences successfully validated and submitted on ${new Date(
          result.submittedAt
        ).toLocaleString()}! Your choices are locked for allocation.`
      );
      setErrors([]);
    } else {
      setErrors(result.errors || ["Validation error during submission."]);
    }
  };

  // Revert to draft for modification (UC-006)
  const handleReopenModification = () => {
    const result = preferenceService.reopenForModification(profile, activeWindow.id);
    if (result.success) {
      setPrefStatus("DRAFT");
      setSuccessMessage("Preferences unlocked. You may modify your rankings and re-submit before the deadline.");
      setErrors([]);
    } else {
      setErrors([result.error]);
    }
  };

  if (!profile) {
    return (
      <div className="page-container">
        <div className="alert alert-warning">
          <AlertCircle size={20} />
          <div>Please switch to a student demo profile to prepare preferences.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Ranked Preference Builder</h1>
          <p className="page-description">
            Use Case <strong>UC-005</strong> • Select and rank your elective choices in order of priority.
          </p>
        </div>
        <div>
          <StatusBadge status={prefStatus} label={`Status: ${prefStatus}`} />
        </div>
      </div>

      {/* Success Banner */}
      {successMessage && (
        <div className="alert alert-success">
          <CheckCircle2 size={20} style={{ flexShrink: 0 }} />
          <div>{successMessage}</div>
        </div>
      )}

      {/* Inline Actionable Errors */}
      {errors.length > 0 && (
        <div className="alert alert-danger">
          <ShieldAlert size={20} style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>
            <strong>Preference Validation Failed:</strong>
            <ul style={{ marginTop: "0.4rem", paddingLeft: "1.2rem" }}>
              {errors.map((err, idx) => (
                <li key={idx} style={{ marginTop: "0.2rem" }}>{err}</li>
              ))}
            </ul>
            <div style={{ marginTop: "0.4rem", fontSize: "0.82rem", opacity: 0.9 }}>
              Note: Your draft choices have been saved. Correct the issues above and re-submit.
            </div>
          </div>
        </div>
      )}

      {/* Window Rule Guidelines Banner */}
      <div className="card" style={{ padding: "1rem 1.25rem", backgroundColor: "#f8fafc", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#1e3a8a" }}>
              {activeWindow?.name}
            </div>
            <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.15rem" }}>
              Rules: Minimum <strong>{activeWindow?.minPreferences || 3}</strong>, Maximum{" "}
              <strong>{activeWindow?.maxPreferences || 5}</strong> choices. No duplicate selections allowed.
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Window Deadline:</span>
            <span className={`badge badge-${activeWindow?.status?.toLowerCase()}`}>
              {activeWindow?.status}
            </span>
          </div>
        </div>
      </div>

      {/* Preference Builder Working Area */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.5rem" }}>
        {/* Course Selector Area (Only enabled if in draft state and window is open) */}
        {!isLocked && (
          <div className="card">
            <h2 className="card-title" style={{ fontSize: "1.05rem" }}>
              <Plus size={18} color="#2563eb" />
              <span>Step 1: Add Course to Preference List</span>
            </h2>
            <p className="card-subtitle" style={{ marginBottom: "1rem" }}>
              Select an elective from your eligible courses catalogue to add to your ranked list.
            </p>

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <select
                className="form-select"
                value={selectedElectiveToAdd}
                onChange={(e) => setSelectedElectiveToAdd(e.target.value)}
                style={{ flex: 1, minWidth: "280px" }}
              >
                <option value="">-- Choose an eligible elective course --</option>
                {availableElectives
                  .filter((e) => e.isEligible && e.status === "ACTIVE")
                  .map((e) => {
                    const isAlreadySelected = selectedItems.some((item) => item.electiveId === e.id);
                    return (
                      <option key={e.id} value={e.id} disabled={isAlreadySelected}>
                        {e.courseCode} - {e.name} (Cap: {e.capacity}) {isAlreadySelected ? "[Already in List]" : ""}
                      </option>
                    );
                  })}
              </select>

              <button
                onClick={handleAddElective}
                disabled={!selectedElectiveToAdd}
                className="btn btn-primary"
              >
                <Plus size={16} />
                <span>Add Choice</span>
              </button>
            </div>
          </div>
        )}

        {/* Ranked Order List Area */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">
                <span>Step 2: Ranked Choice Ordering</span>
                <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "#64748b", marginLeft: "0.5rem" }}>
                  ({selectedItems.length} choices selected)
                </span>
              </h2>
              <p className="card-subtitle">
                Use the Move Up and Move Down buttons to order your choices. Rank 1 is your highest priority.
              </p>
            </div>
            <div>
              {prefStatus === "SUBMITTED" && isWindowOpen && (
                <button onClick={handleReopenModification} className="btn btn-secondary btn-sm">
                  <Edit3 size={14} />
                  <span>Modify Submitted Choices</span>
                </button>
              )}
            </div>
          </div>

          {selectedItems.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2.5rem 1rem", backgroundColor: "#f8fafc", borderRadius: "8px" }}>
              <HelpCircle size={36} color="#94a3b8" style={{ margin: "0 auto 0.75rem auto", display: "block" }} />
              <div style={{ fontWeight: 600, color: "#475569" }}>No preferences selected yet</div>
              <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "0.25rem" }}>
                Add courses using the dropdown above to create your ranked preference list.
              </div>
            </div>
          ) : (
            <div>
              {selectedItems.map((item, index) => {
                const elective = electivesMap.get(item.electiveId);
                const isFirst = index === 0;
                const isLast = index === selectedItems.length - 1;

                return (
                  <div key={item.electiveId} className="pref-rank-item">
                    {/* Rank Number & Course Info */}
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem", flex: 1, minWidth: 0 }}>
                      <div className="rank-badge" title={`Preference Rank #${item.rank}`}>
                        {item.rank}
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <strong style={{ fontSize: "0.95rem", color: "#0f172a" }}>
                            {elective ? `${elective.courseCode} — ${elective.name}` : `Course ID: ${item.electiveId}`}
                          </strong>
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "0.15rem" }}>
                          Dept: {elective?.department || "N/A"} • Capacity: {elective?.capacity || 0} seats • Min CGPA:{" "}
                          {elective?.minCgpa > 0 ? elective.minCgpa.toFixed(2) : "None"}
                        </div>
                      </div>
                    </div>

                    {/* Order Controls (Up, Down, Remove) */}
                    {!isLocked && (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <button
                          onClick={() => handleMoveUp(index)}
                          disabled={isFirst}
                          className="btn btn-secondary btn-sm"
                          title="Move choice higher in rank"
                          style={{ padding: "0.3rem 0.5rem" }}
                        >
                          <ArrowUp size={15} />
                        </button>

                        <button
                          onClick={() => handleMoveDown(index)}
                          disabled={isLast}
                          className="btn btn-secondary btn-sm"
                          title="Move choice lower in rank"
                          style={{ padding: "0.3rem 0.5rem" }}
                        >
                          <ArrowDown size={15} />
                        </button>

                        <button
                          onClick={() => handleRemove(index)}
                          className="btn btn-secondary btn-sm"
                          title="Remove choice from preferences"
                          style={{ padding: "0.3rem 0.5rem", color: "#dc2626" }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Action Toolbar */}
              <div
                style={{
                  marginTop: "1.5rem",
                  paddingTop: "1.25rem",
                  borderTop: "1px solid #e2e8f0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "1rem",
                }}
              >
                <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                  {prefStatus === "SUBMITTED" ? (
                    <span style={{ color: "#059669", fontWeight: 600 }}>
                      ✓ Preferences submitted at {new Date(submittedAt).toLocaleString()}
                    </span>
                  ) : (
                    <span>
                      Choices required: {activeWindow?.minPreferences || 3} to {activeWindow?.maxPreferences || 5} (Current:{" "}
                      <strong>{selectedItems.length}</strong>)
                    </span>
                  )}
                </div>

                {!isLocked && (
                  <button
                    onClick={handleInitiateSubmit}
                    disabled={selectedItems.length < (activeWindow?.minPreferences || 3)}
                    className="btn btn-success"
                  >
                    <Send size={16} />
                    <span>Review & Submit Preferences (UC-005)</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Review & Confirm Submission Modal */}
      <Modal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        title="Review & Confirm Ranked Preferences"
        footer={
          <>
            <button onClick={() => setShowReviewModal(false)} className="btn btn-secondary">
              Back to Edit
            </button>
            <button onClick={handleConfirmSubmit} className="btn btn-success">
              <CheckCircle2 size={16} />
              Confirm & Submit
            </button>
          </>
        }
      >
        <div>
          <p style={{ fontSize: "0.88rem", color: "#475569", marginBottom: "1rem" }}>
            Please review your final preference rankings before submitting. 
            Once submitted, your choices will be evaluated in this exact priority order during allocation.
          </p>

          <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", marginBottom: "1rem" }}>
            <table style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: "60px" }}>Rank</th>
                  <th>Course Code</th>
                  <th>Course Name</th>
                  <th>Capacity</th>
                </tr>
              </thead>
              <tbody>
                {selectedItems.map((item) => {
                  const el = electivesMap.get(item.electiveId);
                  return (
                    <tr key={item.electiveId}>
                      <td>
                        <strong style={{ color: "#1e3a8a" }}>#{item.rank}</strong>
                      </td>
                      <td>{el?.courseCode}</td>
                      <td>{el?.name}</td>
                      <td>{el?.capacity} seats</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="alert alert-info" style={{ marginBottom: 0, fontSize: "0.82rem" }}>
            <Clock size={16} style={{ flexShrink: 0 }} />
            <div>
              Submission timestamp will be recorded for institutional deterministic tie-break resolution.
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
