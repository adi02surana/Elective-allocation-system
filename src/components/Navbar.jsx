import React, { useState } from "react";
import { authService } from "../services/authService";
import { storageService } from "../services/storageService";
import { RotateCcw, AlertTriangle, UserCheck } from "lucide-react";
import { Modal } from "./Modal";

export function Navbar({ currentUser, onUserChange, onDataReset, activeCycle }) {
  const [showResetModal, setShowResetModal] = useState(false);
  const allStudents = authService.getAllStudents();

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
          <div className="demo-banner-badge">
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", backgroundColor: "#2563eb" }}></span>
            <span>Prototype Demo Mode</span>
            <span style={{ color: "#64748b" }}>| Local Demo Data</span>
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
            className="btn btn-secondary btn-sm"
            title="Reset to initial seed data"
          >
            <RotateCcw size={14} />
            <span>Reset Demo Data</span>
          </button>
        </div>
      </header>

      {/* Reset Confirmation Modal */}
      <Modal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        title="Reset to Sample Baseline Data?"
        footer={
          <>
            <button
              onClick={() => setShowResetModal(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={confirmReset}
              className="btn btn-danger"
            >
              <RotateCcw size={16} />
              Confirm Reset
            </button>
          </>
        }
      >
        <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
          <AlertTriangle size={36} color="#dc2626" style={{ flexShrink: 0 }} />
          <div>
            <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
              Are you sure you want to reset the prototype to its default seeded state?
            </p>
            <p style={{ fontSize: "0.88rem", color: "#64748b" }}>
              This will restore all 10 demo student profiles, 7 elective courses, 
              original preference submissions, and clear any computed allocation results.
              This action helps repeat demonstrations from a clean baseline.
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
}
