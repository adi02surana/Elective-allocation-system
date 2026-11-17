import React, { useState, useEffect } from "react";
import { authService } from "../services/authService";
import { preferenceService } from "../services/preferenceService";
import { electiveService } from "../services/electiveService";
import { allocationService } from "../services/allocationService";
import { storageService } from "../services/storageService";
import { StatusBadge } from "../components/StatusBadge";
import {
  GraduationCap,
  Calendar,
  Clock,
  ListOrdered,
  BookOpen,
  Award,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

export function StudentDashboard({ onNavigate }) {
  const [profile, setProfile] = useState(null);
  const [activeWindow, setActiveWindow] = useState(null);
  const [prefList, setPrefList] = useState(null);
  const [eligibleCount, setEligibleCount] = useState(0);
  const [resultData, setResultData] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await storageService.syncFromBackend();
    } catch {
      // fallback
    }

    const student = authService.getCurrentStudentProfile();
    setProfile(student);

    if (student) {
      const window = preferenceService.getActiveWindow();
      setActiveWindow(window);

      const prefs = await preferenceService.fetchStudentPreferenceList(student.studentId, window?.id);
      setPrefList(prefs);

      const electives = electiveService.getElectivesForStudent(student);
      const eligible = electives.filter((e) => e.isEligible && e.status === "ACTIVE");
      setEligibleCount(eligible.length);

      const res = allocationService.getStudentResult(student.studentId, false);
      setResultData(res);
    }
  };

  if (!profile) {
    return (
      <div className="page-container">
        <div className="alert alert-warning">
          <AlertCircle size={20} />
          <div>Please select or log in as a student demo profile to view this dashboard.</div>
        </div>
      </div>
    );
  }

  const isWindowOpen = activeWindow?.status === "OPEN";

  return (
    <div className="page-container">
      {/* Page Title & Profile Banner */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Student Academic Dashboard</h1>
          <p className="page-description">
            Welcome, <strong>{profile.name}</strong> • Roll Number: <strong>{profile.studentId}</strong>
          </p>
        </div>
        <div>
          <StatusBadge status={prefList?.status || "DRAFT"} label={`Preference: ${prefList?.status || "DRAFT"}`} />
        </div>
      </div>

      {/* Top Academic Profile Grid */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon-box" style={{ backgroundColor: "#eff6ff", color: "#2563eb" }}>
            <GraduationCap size={24} />
          </div>
          <div>
            <div className="metric-value">{profile.branch}</div>
            <div className="metric-label">Branch & Batch {profile.batch}</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box" style={{ backgroundColor: "#ecfdf5", color: "#059669" }}>
            <Calendar size={24} />
          </div>
          <div>
            <div className="metric-value">Sem {profile.semester}</div>
            <div className="metric-label">Current Academic Semester</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box" style={{ backgroundColor: "#fef3c7", color: "#d97706" }}>
            <Award size={24} />
          </div>
          <div>
            <div className="metric-value">{profile.cgpa.toFixed(2)}</div>
            <div className="metric-label">Cumulative GPA (Priority Merit)</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box" style={{ backgroundColor: "#f3e8ff", color: "#7e22ce" }}>
            <BookOpen size={24} />
          </div>
          <div>
            <div className="metric-value">{eligibleCount}</div>
            <div className="metric-label">Eligible Electives Available</div>
          </div>
        </div>
      </div>

      {/* Allocation Cycle & Preference Submission Status */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "1.5rem", marginBottom: "1.5rem" }}>
        {/* Registration Window Details */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div>
              <h2 className="card-title">Registration Cycle Details</h2>
              <p className="card-subtitle">{activeWindow?.name}</p>
            </div>
            <StatusBadge status={activeWindow?.status || "UNKNOWN"} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", fontSize: "0.88rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
              <span style={{ color: "#64748b" }}>Window Status:</span>
              <strong style={{ color: isWindowOpen ? "#059669" : "#dc2626" }}>
                {isWindowOpen ? "Active & Accepting Submissions" : "Closed / Past Deadline"}
              </strong>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
              <span style={{ color: "#64748b" }}>Required Preference Count:</span>
              <strong>{activeWindow?.minPreferences || 3} to {activeWindow?.maxPreferences || 5} ranked choices</strong>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.5rem" }}>
              <span style={{ color: "#64748b" }}>Applicable Scope:</span>
              <strong>{activeWindow?.branches?.join(", ")} • Batch {activeWindow?.batch} (Sem {activeWindow?.semester})</strong>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#64748b" }}>Window Description:</span>
              <span style={{ textAlign: "right", maxWidth: "220px", color: "#334155" }}>
                {activeWindow?.description}
              </span>
            </div>
          </div>
        </div>

        {/* Preference Status Card */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div>
              <h2 className="card-title">Your Preference Status</h2>
              <p className="card-subtitle">Ranked Course Preference Record</p>
            </div>
            <StatusBadge status={prefList?.status || "DRAFT"} />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            {prefList?.status === "SUBMITTED" ? (
              <div className="alert alert-success" style={{ marginBottom: "0.75rem", padding: "0.75rem 1rem" }}>
                <CheckCircle2 size={20} style={{ flexShrink: 0 }} />
                <div>
                  <strong>Preferences Formally Submitted:</strong>
                  <div style={{ fontSize: "0.82rem", marginTop: "0.2rem" }}>
                    Timestamp: {prefList?.submittedAt ? new Date(prefList.submittedAt).toLocaleString() : "Confirmed"}
                  </div>
                </div>
              </div>
            ) : (
              <div className="alert alert-warning" style={{ marginBottom: "0.75rem", padding: "0.75rem 1rem" }}>
                <Clock size={20} style={{ flexShrink: 0 }} />
                <div>
                  <strong>Draft Preferences In Progress:</strong>
                  <div style={{ fontSize: "0.82rem", marginTop: "0.2rem" }}>
                    You have saved {prefList?.items?.length || 0} choices in draft. Final submission required.
                  </div>
                </div>
              </div>
            )}

            <div style={{ fontSize: "0.88rem", color: "#475569", marginBottom: "1rem" }}>
              Current ranked choices in record: <strong>{prefList?.items?.length || 0}</strong>
            </div>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                onClick={() => onNavigate("preference-builder")}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                <ListOrdered size={16} />
                <span>{prefList?.status === "SUBMITTED" ? "View / Modify Preferences" : "Build & Submit Preferences"}</span>
              </button>

              <button
                onClick={() => onNavigate("catalogue")}
                className="btn btn-secondary"
              >
                <BookOpen size={16} />
                <span>Catalogue</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Allocation Result Section */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">
              <Award size={20} color="#2563eb" />
              <span>Final Elective Allocation Outcome</span>
            </h2>
            <p className="card-subtitle">Institutional Centralized Allocation System</p>
          </div>
          {resultData?.isAvailable && (
            <StatusBadge status={resultData.result.status} />
          )}
        </div>

        {resultData?.isAvailable ? (
          <div>
            {resultData.result.status === "ALLOCATED" ? (
              <div
                style={{
                  backgroundColor: "#ecfdf5",
                  border: "1px solid #a7f3d0",
                  borderRadius: "8px",
                  padding: "1.25rem",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "1rem",
                }}
              >
                <CheckCircle2 size={32} color="#059669" style={{ flexShrink: 0, marginTop: "2px" }} />
                <div>
                  <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#065f46" }}>
                    Congratulations! Allocated to {resultData.result.electiveCode || resultData.result.courseCode}
                    {(resultData.result.electiveName || resultData.result.courseName) ? `: ${resultData.result.electiveName || resultData.result.courseName}` : ""}
                  </h3>
                  <div style={{ fontSize: "0.9rem", color: "#047857", marginTop: "0.35rem" }}>
                    <strong>Preference Rank Granted:</strong> Choice #{resultData.result.preferenceRank || 1}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "#065f46", marginTop: "0.25rem" }}>
                    <strong>Allocation Basis:</strong> {resultData.result.reason || resultData.result.assignedReason || "Allocated based on academic merit priority."}
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "8px",
                  padding: "1.25rem",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "1rem",
                }}
              >
                <AlertCircle size={32} color="#dc2626" style={{ flexShrink: 0, marginTop: "2px" }} />
                <div>
                  <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#991b1b" }}>
                    Status: Unallocated
                  </h3>
                  <div style={{ fontSize: "0.88rem", color: "#b91c1c", marginTop: "0.35rem" }}>
                    {resultData.result.reason || resultData.result.assignedReason || "No elective assigned in regular round."}
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "#7f1d1d", marginTop: "0.5rem" }}>
                    Note: Students who remain unallocated will be eligible for institutional Spot Round / Waitlist counseling.
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: "1.5rem", textAlign: "center", backgroundColor: "#f8fafc", borderRadius: "8px" }}>
            <Clock size={36} color="#94a3b8" style={{ margin: "0 auto 0.75rem auto", display: "block" }} />
            <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "#475569" }}>
              Allocation Results Pending Official Publication
            </h3>
            <p style={{ fontSize: "0.85rem", color: "#64748b", maxWidth: "500px", margin: "0.4rem auto 0 auto" }}>
              The Academic Administration conducts centralized allocation after preference submissions close.
              Once official results are released by the Dean of Academics, your assigned elective will be displayed here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
