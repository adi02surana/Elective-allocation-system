import React, { useState } from "react";
import { authService } from "../services/authService";
import { storageService } from "../services/storageService";
import { RotateCcw, AlertTriangle } from "lucide-react";
import { Modal } from "./Modal";

export function Navbar({ currentUser, onUserChange, onDataReset, activeCycle }) {
  const [showResetModal, setShowResetModal] = useState(false);
  const allStudents = authService.getAllStudents();

  const handleRoleChange = async (e) => {
    const roleValue = e.target.value;
    if (roleValue === "student") {
      await authService.login("student.demo@example.test");
    } else if (roleValue === "faculty") {
      await authService.login("faculty.demo@example.test");
    } else if (roleValue === "admin") {
      await authService.login("admin.demo@example.test");
    } else if (roleValue === "sysadmin") {
      await authService.login("sysadmin.demo@example.test");
    }
    onUserChange(authService.getCurrentUser());
  };

  const handleStudentSwitch = async (e) => {
    const studentId = e.target.value;
    await authService.switchDemoStudent(studentId);
    onUserChange(authService.getCurrentUser());
  };

  const confirmReset = async () => {
    await storageService.resetToSeedData(currentUser?.name || "Demo User");
    setShowResetModal(false);
    onDataReset();
  };

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          {activeCycle && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.88rem" }}>
              <span style={{ fontWeight: 700, color: "#1e3a8a" }}>Sem 6</span>
              <span className={`badge badge-${activeCycle.status?.toLowerCase() || "open"}`}>
                {activeCycle.status || "OPEN"}
              </span>
            </div>
          )}
        </div>

        <div className="topbar-right">
          {/* Role Picker */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <label htmlFor="role-select" style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b" }}>
              Role:
            </label>
            <select
              id="role-select"
              className="role-switcher-select"
              value={currentUser?.role || "admin"}
              onChange={handleRoleChange}
              title="Switch user role"
            >
              <option value="student">Student</option>
              <option value="faculty">Faculty</option>
              <option value="admin">Administrator</option>
              <option value="sysadmin">System Admin</option>
            </select>
          </div>

          {/* Student Profile Switcher */}
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
                title="Select student profile"
              >
                {allStudents.map((s) => (
                  <option key={s.studentId} value={s.studentId}>
                    {s.studentId} - {s.name} ({s.branch})
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
            title="Reset database records back to baseline seed state"
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
