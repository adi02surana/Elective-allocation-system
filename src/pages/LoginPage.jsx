import React, { useState } from "react";
import { authService } from "../services/authService";
import { GraduationCap, BookOpen, ShieldCheck, Settings, ArrowRight, Info } from "lucide-react";

export function LoginPage({ onLoginSuccess }) {
  const [emailInput, setEmailInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleDemoCardClick = (demoEmail) => {
    const res = authService.login(demoEmail);
    if (res.success) {
      onLoginSuccess(res.user);
    } else {
      setErrorMsg(res.error);
    }
  };

  const handleManualLogin = (e) => {
    e.preventDefault();
    if (!emailInput.trim()) {
      setErrorMsg("Please enter an email address.");
      return;
    }
    const res = authService.login(emailInput.trim());
    if (res.success) {
      onLoginSuccess(res.user);
    } else {
      setErrorMsg("Demo user not found. Please click one of the quick demo roles below.");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f8fafc",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "2rem 1rem",
      }}
    >
      <div style={{ maxWidth: "800px", width: "100%" }}>
        {/* Header Block */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              backgroundColor: "#eff6ff",
              color: "#1e3a8a",
              padding: "0.35rem 0.85rem",
              borderRadius: "9999px",
              fontSize: "0.82rem",
              fontWeight: 600,
              marginBottom: "0.75rem",
              border: "1px solid #bfdbfe",
            }}
          >
            <span>The LNM Institute of Information Technology, Jaipur</span>
            <span>•</span>
            <span>Software Development Lab</span>
          </div>

          <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em" }}>
            Elective Allocation System
          </h1>
          <p style={{ color: "#475569", marginTop: "0.4rem", fontSize: "1rem" }}>
            Midterm Prototype • Developed by <strong>Team T016</strong>
          </p>
          <div style={{ fontSize: "0.82rem", color: "#64748b", marginTop: "0.25rem" }}>
            Krishangee Tayal • Mudit Kumar Dwivedi • Lakshit Agarwal • Ananya Surana
          </div>
        </div>

        {/* Demo Disclaimer Alert */}
        <div className="alert alert-info" style={{ marginBottom: "2rem" }}>
          <Info size={20} style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>
            <strong>Prototype & Sample Data Notice:</strong> This web application demonstrates centralized 
            ranked preference collection and deterministic elective course allocation.
            All student profiles, roll numbers, and records are fictional demo data.
            Local client-side demo storage is used.
          </div>
        </div>

        {/* Quick Demo Role Cards */}
        <div style={{ marginBottom: "2rem" }}>
          <h2
            style={{
              fontSize: "0.95rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "#64748b",
              marginBottom: "1rem",
              textAlign: "center",
            }}
          >
            Select a Demo Persona for Evaluation
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "1rem",
            }}
          >
            {/* Student Role */}
            <div
              onClick={() => handleDemoCardClick("student.demo@example.test")}
              className="card"
              style={{
                cursor: "pointer",
                marginBottom: 0,
                transition: "all 0.2s ease",
                border: "2px solid #e2e8f0",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#2563eb")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e2e8f0")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "8px",
                    backgroundColor: "#eff6ff",
                    color: "#2563eb",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <GraduationCap size={22} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "1rem" }}>Student</div>
                  <div style={{ fontSize: "0.78rem", color: "#64748b" }}>Aarav Sharma (22UCS001)</div>
                </div>
              </div>
              <p style={{ fontSize: "0.82rem", color: "#475569", marginBottom: "1rem" }}>
                Explore eligible electives, build & rank preference choices, submit, and inspect allocated results.
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.82rem", fontWeight: 600, color: "#2563eb" }}>
                <span>Enter as Student</span>
                <ArrowRight size={14} />
              </div>
            </div>

            {/* Faculty Coordinator */}
            <div
              onClick={() => handleDemoCardClick("faculty.demo@example.test")}
              className="card"
              style={{
                cursor: "pointer",
                marginBottom: 0,
                transition: "all 0.2s ease",
                border: "2px solid #e2e8f0",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#2563eb")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e2e8f0")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "8px",
                    backgroundColor: "#fef3c7",
                    color: "#d97706",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <BookOpen size={22} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "1rem" }}>Faculty Coordinator</div>
                  <div style={{ fontSize: "0.78rem", color: "#64748b" }}>Dr. Preeti Jain</div>
                </div>
              </div>
              <p style={{ fontSize: "0.82rem", color: "#475569", marginBottom: "1rem" }}>
                Manage elective courses, seat capacities, branch/semester eligibility criteria, and prerequisites (UC-007).
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.82rem", fontWeight: 600, color: "#2563eb" }}>
                <span>Enter as Faculty</span>
                <ArrowRight size={14} />
              </div>
            </div>

            {/* Academic Administrator */}
            <div
              onClick={() => handleDemoCardClick("admin.demo@example.test")}
              className="card"
              style={{
                cursor: "pointer",
                marginBottom: 0,
                transition: "all 0.2s ease",
                border: "2px solid #e2e8f0",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#2563eb")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e2e8f0")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "8px",
                    backgroundColor: "#ecfdf5",
                    color: "#059669",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "1rem" }}>Academic Admin</div>
                  <div style={{ fontSize: "0.78rem", color: "#64748b" }}>Prof. S. R. Verma</div>
                </div>
              </div>
              <p style={{ fontSize: "0.82rem", color: "#475569", marginBottom: "1rem" }}>
                Verify allocation readiness, configure tie-break policies, execute allocation engine (UC-011), and publish results.
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.82rem", fontWeight: 600, color: "#2563eb" }}>
                <span>Enter as Admin</span>
                <ArrowRight size={14} />
              </div>
            </div>

            {/* System Administrator */}
            <div
              onClick={() => handleDemoCardClick("sysadmin.demo@example.test")}
              className="card"
              style={{
                cursor: "pointer",
                marginBottom: 0,
                transition: "all 0.2s ease",
                border: "2px solid #e2e8f0",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#2563eb")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e2e8f0")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "8px",
                    backgroundColor: "#f3e8ff",
                    color: "#7e22ce",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Settings size={22} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "1rem" }}>System Admin</div>
                  <div style={{ fontSize: "0.78rem", color: "#64748b" }}>Mr. Rajeev N. (CIT)</div>
                </div>
              </div>
              <p style={{ fontSize: "0.82rem", color: "#475569", marginBottom: "1rem" }}>
                Review demo user accounts, inspect system audit trails, and restore default baseline seed data.
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.82rem", fontWeight: 600, color: "#2563eb" }}>
                <span>Enter as SysAdmin</span>
                <ArrowRight size={14} />
              </div>
            </div>
          </div>
        </div>

        {/* Manual Login Card */}
        <div className="card" style={{ maxWidth: "480px", margin: "0 auto" }}>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.75rem", color: "#334155" }}>
            Or Enter Demo Email
          </h3>
          {errorMsg && (
            <div className="alert alert-danger" style={{ padding: "0.5rem 0.75rem", fontSize: "0.82rem", marginBottom: "0.75rem" }}>
              {errorMsg}
            </div>
          )}
          <form onSubmit={handleManualLogin} style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="email"
              className="form-input"
              placeholder="e.g. student.demo@example.test"
              value={emailInput}
              onChange={(e) => {
                setEmailInput(e.target.value);
                setErrorMsg("");
              }}
            />
            <button type="submit" className="btn btn-primary" style={{ whiteSpace: "nowrap" }}>
              Sign In
            </button>
          </form>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.5rem" }}>
            Demo Passwords not required in prototype mode.
          </div>
        </div>
      </div>
    </div>
  );
}
