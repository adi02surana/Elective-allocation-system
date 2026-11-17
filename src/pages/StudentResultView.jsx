import React, { useState, useEffect } from "react";
import { authService } from "../services/authService";
import { allocationService } from "../services/allocationService";
import { storageService } from "../services/storageService";
import { StatusBadge } from "../components/StatusBadge";
import { Award, CheckCircle2, AlertCircle, Clock, BookOpen, User, Calendar } from "lucide-react";

export function StudentResultView() {
  const [profile, setProfile] = useState(null);
  const [resultState, setResultState] = useState(null);

  useEffect(() => {
    const loadResult = async () => {
      try {
        await storageService.syncFromBackend();
      } catch {
        // fallback
      }
      const student = authService.getCurrentStudentProfile();
      setProfile(student);
      if (student) {
        const res = allocationService.getStudentResult(student.studentId, false);
        setResultState(res);
      }
    };
    loadResult();
  }, []);

  if (!profile) {
    return (
      <div className="page-container">
        <div className="alert alert-warning">
          <AlertCircle size={20} />
          <div>Please select or log in as a student demo account to view your individual allocation outcome.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">My Allocation Result</h1>
          <p className="page-description">
            Use Case <strong>UC-015</strong> • Individual elective course allocation notification for <strong>{profile.name}</strong>.
          </p>
        </div>
        <div>
          {resultState?.isAvailable && (
            <StatusBadge status={resultState.result.status} />
          )}
        </div>
      </div>

      {/* Student Academic Identity Card */}
      <div className="card" style={{ padding: "1.25rem", backgroundColor: "#f8fafc", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                backgroundColor: "#2563eb",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "1.1rem",
              }}
            >
              {profile.name.charAt(0)}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "#0f172a" }}>{profile.name}</div>
              <div style={{ fontSize: "0.82rem", color: "#64748b" }}>
                Roll No: <strong style={{ fontFamily: "var(--font-mono)" }}>{profile.studentId}</strong> • Branch: {profile.branch} • Semester: {profile.semester}
              </div>
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.8rem", color: "#64748b" }}>Priority Merit CGPA</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#1e3a8a" }}>
              {profile.cgpa.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Main Allocation Outcome Panel */}
      {resultState?.isAvailable ? (
        resultState.result.status === "ALLOCATED" ? (
          <div className="card" style={{ border: "2px solid #a7f3d0" }}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "1.25rem",
                padding: "0.5rem 0",
              }}
            >
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: "12px",
                  backgroundColor: "#ecfdf5",
                  color: "#059669",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <CheckCircle2 size={32} />
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                  <span className="badge badge-allocated" style={{ fontSize: "0.82rem" }}>
                    OFFICIALLY ALLOCATED
                  </span>
                  <span
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      color: "#1e3a8a",
                      backgroundColor: "#eff6ff",
                      padding: "0.2rem 0.6rem",
                      borderRadius: "4px",
                    }}
                  >
                    Preference Choice #{resultState.result.preferenceRank}
                  </span>
                </div>

                <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#065f46", margin: "0.5rem 0" }}>
                  {resultState.result.electiveCode || resultState.result.courseCode}
                  {(resultState.result.electiveName || resultState.result.courseName) ? `: ${resultState.result.electiveName || resultState.result.courseName}` : ""}
                </h2>

                <div
                  style={{
                    backgroundColor: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: "8px",
                    padding: "1rem",
                    margin: "1rem 0",
                    fontSize: "0.88rem",
                    color: "#166534",
                  }}
                >
                  <strong>Allocation Decision Basis:</strong>
                  <div style={{ marginTop: "0.25rem" }}>
                    {resultState.result.reason || resultState.result.assignedReason || "Allocated based on academic merit priority and preference ranking."}
                  </div>
                </div>

                <div style={{ fontSize: "0.85rem", color: "#475569", lineHeight: "1.6" }}>
                  <p>
                    ✓ Your enrollment record has been updated in the institutional database.
                  </p>
                  <p>
                    ✓ Classes will commence as per the Spring 2026 academic timetable published by the Dean of Academic Affairs.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ border: "2px solid #fecaca" }}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "1.25rem",
                padding: "0.5rem 0",
              }}
            >
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: "12px",
                  backgroundColor: "#fef2f2",
                  color: "#dc2626",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <AlertCircle size={32} />
              </div>

              <div style={{ flex: 1 }}>
                <span className="badge badge-unallocated" style={{ fontSize: "0.82rem" }}>
                  STATUS: UNALLOCATED
                </span>

                <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#991b1b", margin: "0.5rem 0" }}>
                  No Elective Assigned in Regular Round
                </h2>

                <div
                  style={{
                    backgroundColor: "#fff1f2",
                    border: "1px solid #fecdd3",
                    borderRadius: "8px",
                    padding: "1rem",
                    margin: "1rem 0",
                    fontSize: "0.88rem",
                    color: "#9f1239",
                  }}
                >
                  <strong>Reason for Unallocated Status:</strong>
                  <div style={{ marginTop: "0.25rem" }}>
                    {resultState.result.reason || resultState.result.assignedReason || "Selected courses reached capacity."}
                  </div>
                </div>

                <div style={{ fontSize: "0.85rem", color: "#475569", lineHeight: "1.6" }}>
                  <p style={{ fontWeight: 600, color: "#0f172a" }}>Next Institutional Steps:</p>
                  <p>
                    1. Students who remain unallocated are eligible to participate in the upcoming <strong>Spot Round / Waitlist Counseling</strong>.
                  </p>
                  <p>
                    2. Unfilled course vacancies will be published on the academic notice board prior to the Add/Drop window.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )
      ) : (
        <div className="card" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
          <Clock size={48} color="#94a3b8" style={{ margin: "0 auto 1rem auto", display: "block" }} />
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#334155" }}>
            Official Allocation Results Not Yet Published
          </h2>
          <p style={{ fontSize: "0.9rem", color: "#64748b", maxWidth: "520px", margin: "0.5rem auto 0 auto" }}>
            The preference submission cycle has closed or is under evaluation. 
            Once the Academic Administrator completes and publishes the final allocation outcomes, 
            your assigned elective will be displayed on this page.
          </p>
        </div>
      )}
    </div>
  );
}
