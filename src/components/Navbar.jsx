import React, { useState, useEffect } from "react";
import { authService } from "../services/authService";
import { storageService } from "../services/storageService";
import { apiClient } from "../services/apiClient";
import { RotateCcw, AlertTriangle, UserCheck, Database } from "lucide-react";
import { Modal } from "./Modal";

export function Navbar({ currentUser, onUserChange, onDataReset, activeCycle }) {
  const [showResetModal, setShowResetModal] = useState(false);
  const [dbStatus, setDbStatus] = useState({ connected: true, engine: "SQLite" });
  const allStudents = authService.getAllStudents();

  useEffect(() => {
    // Probe backend DB status
    apiClient
      .checkHealth()
      .then((res) => {
        if (res && res.database) {
          setDbStatus({
            connected: res.database.connected,
            engine: res.database.engine || "SQLite",
            path: res.database.path,
          });
        }
      })
      .catch(() => {
        // Fallback
        setDbStatus({ connected: true, engine: "SQLite (Local File)" });
      });
  }, []);

  const handleRoleChange = (e) => {
    const roleValue = e.target.value;
    if (roleValue === "student") {
      authService.login("student.demo@example.test");
    } else if (roleValue === "faculty") {
      authService.login("faculty.demo@example.test");
    } else if (roleValue === "admin") {
      authService.login("admin.demo@example.test");
    } else if (roleValue === "sysadmin") {
      authService.login("sysadmin.demo@example.test");
    }
    onUserChange(authService.getCurrentUser());
  };

  const handleStudentSwitch = (e) => {
    const studentId = e.target.value;
    authService.switchDemoStudent(studentId);
    onUserChange(authService.getCurrentUser());
  };

  const confirmReset = () => {
    storageService.resetToSeedData(currentUser?.name || "Demo User");
    setShowResetModal(false);
    onDataReset();
  };

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <div
            className="demo-banner-badge"
            title={`Database: ${dbStatus.engine} | Persistent Storage (ecas.db)`}
          >
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: dbStatus.connected ? "#10b981" : "#ef4444",
              }}
            ></span>
            <span style={{ fontWeight: 600 }}>
              DB: {dbStatus.connected ? "SQLite Connected (ecas.db)" : "Database Disconnected"}
            </span>
            <span style={{ color: "#64748b" }}>| ACID Relational</span>
          </div>

          {activeCycle && (
            <div style={{ fontSize: "0.82rem", color: "#475569" }}>
              Active Window: <strong style={{ color: "#1e3a8a" }}>{activeCycle.name}</strong>
              <span className={`badge badge-${activeCycle.status.toLowerCase()}`} style={{ marginLeft: "0.5rem" }}>
                {activeCycle.status}
              </span>
            </div>
          )}
        </div>

        <div className="topbar-right">
          {/* Quick Demo Role Picker */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <label htmlFor="role-select" style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b" }}>
              Role:
            </label>
            <select
              id="role-select"
              className="role-switcher-select"
              value={currentUser?.role || "admin"}
              onChange={handleRoleChange}
              title="Quick demo role switch"
            >
              <option value="student">Student (Aarav Sharma)</option>
              <option value="faculty">Faculty Coordinator (Dr. Preeti Jain)</option>
              <option value="admin">Academic Administrator (Prof. S. R. Verma)</option>
              <option value="sysadmin">System Administrator (CIT)</option>
            </select>
          </div>

          {/* Quick Student Profile Switcher if currently in student role */}
          {currentUser?.role === "student" && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <label htmlFor="student-select" style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b" }}>
                Student:
              </label>
              <select
                id="student-select"
                className="role-switcher-select"
                value={currentUser?.studentId || "22UCS001"}
                onChange={handleStudentSwitch}
                title="Select specific demo student profile to test different outcomes"
              >
                {allStudents.map((s) => (
                  <option key={s.studentId} value={s.studentId}>
                    {s.studentId} - {s.name} ({s.branch}, CGPA: {s.cgpa.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Reset Demo Data Button */}
          <button
            onClick={() => setShowResetModal(true)}
            className="btn btn-outline"
            style={{ fontSize: "0.78rem", padding: "0.35rem 0.65rem" }}
            title="Reset all database records back to canonical baseline seed state"
          >
            <RotateCcw size={13} />
            <span>Reset Demo DB</span>
          </button>
        </div>
      </header>

      {/* Confirmation Modal for Resetting Demo Data */}
      <Modal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        title="Reset Baseline Demo Database?"
      >
        <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start", marginBottom: "1.5rem" }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              backgroundColor: "#fef2f2",
              color: "#dc2626",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <AlertTriangle size={24} />
          </div>
          <div>
            <p style={{ fontWeight: 600, color: "#0f172a", marginBottom: "0.5rem" }}>
              Are you sure you want to reset all data in the SQLite database?
            </p>
            <p style={{ fontSize: "0.85rem", color: "#64748b", lineHeight: 1.5 }}>
              This will restore all elective courses, sample student preference lists, capacities,
              and allocation statuses to the official evaluation baseline in <code>ecas.db</code>.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
          <button onClick={() => setShowResetModal(false)} className="btn btn-secondary">
            Cancel
          </button>
          <button onClick={confirmReset} className="btn btn-danger">
            Confirm Reset Baseline
          </button>
        </div>
      </Modal>
    </>
  );
}
