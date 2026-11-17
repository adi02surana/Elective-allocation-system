import React, { useState, useEffect } from "react";
import { authService } from "../services/authService";
import { electiveService } from "../services/electiveService";
import { StatusBadge } from "../components/StatusBadge";
import { Search, Filter, BookOpen, User, CheckCircle2, XCircle, Plus } from "lucide-react";

export function ElectivesCatalogue({ onAddToPreferences }) {
  const [electives, setElectives] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [eligibilityFilter, setEligibilityFilter] = useState("ALL");
  const currentUser = authService.getCurrentUser();
  const studentProfile = authService.getCurrentStudentProfile();

  useEffect(() => {
    loadElectives();
  }, [currentUser]);

  const loadElectives = () => {
    if (currentUser?.role === "student" && studentProfile) {
      setElectives(electiveService.getElectivesForStudent(studentProfile));
    } else {
      setElectives(electiveService.getAllElectives());
    }
  };

  const filteredElectives = electives.filter((e) => {
    const matchesSearch =
      e.courseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.facultyName && e.facultyName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesDept = deptFilter === "ALL" || e.department === deptFilter;

    let matchesEligibility = true;
    if (currentUser?.role === "student" && eligibilityFilter !== "ALL") {
      if (eligibilityFilter === "ELIGIBLE") matchesEligibility = e.isEligible;
      if (eligibilityFilter === "INELIGIBLE") matchesEligibility = !e.isEligible;
    }

    return matchesSearch && matchesDept && matchesEligibility;
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Elective Courses Catalogue</h1>
          <p className="page-description">
            Explore approved open and departmental electives offered for Spring 2026.
          </p>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div
        className="card"
        style={{
          padding: "1rem 1.25rem",
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: "1", minWidth: "260px" }}>
          <Search size={18} color="#64748b" />
          <input
            type="text"
            className="form-input"
            placeholder="Search by course code, name, or faculty..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Filter size={16} color="#64748b" />
            <span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 600 }}>Department:</span>
            <select
              className="form-select"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              style={{ padding: "0.35rem 0.75rem", width: "auto" }}
            >
              <option value="ALL">All Departments</option>
              <option value="CSE">CSE</option>
              <option value="ECE">ECE</option>
            </select>
          </div>

          {currentUser?.role === "student" && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 600 }}>Eligibility:</span>
              <select
                className="form-select"
                value={eligibilityFilter}
                onChange={(e) => setEligibilityFilter(e.target.value)}
                style={{ padding: "0.35rem 0.75rem", width: "auto" }}
              >
                <option value="ALL">All Courses</option>
                <option value="ELIGIBLE">Eligible Only</option>
                <option value="INELIGIBLE">Ineligible Only</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Catalogue Cards Grid */}
      {filteredElectives.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem 1rem" }}>
          <BookOpen size={40} color="#94a3b8" style={{ margin: "0 auto 1rem auto" }} />
          <h3 style={{ fontSize: "1.1rem", color: "#475569" }}>No Elective Courses Found</h3>
          <p style={{ fontSize: "0.88rem", color: "#64748b" }}>
            Try adjusting your search criteria or filter options.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
            gap: "1.25rem",
          }}
        >
          {filteredElectives.map((elective) => {
            const isStudent = currentUser?.role === "student";
            const isEligible = elective.isEligible ?? true;

            return (
              <div
                key={elective.id}
                className="card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  marginBottom: 0,
                  border: !isEligible ? "1px solid #fecaca" : "1px solid #e2e8f0",
                  backgroundColor: !isEligible ? "#fffafa" : "#ffffff",
                }}
              >
                {/* Course Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                  <div>
                    <span
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        color: "#2563eb",
                        backgroundColor: "#eff6ff",
                        padding: "0.2rem 0.5rem",
                        borderRadius: "4px",
                      }}
                    >
                      {elective.courseCode}
                    </span>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "#64748b",
                        marginLeft: "0.5rem",
                      }}
                    >
                      {elective.department}
                    </span>
                  </div>
                  <div>
                    {isStudent ? (
                      isEligible ? (
                        <span className="badge badge-allocated">Eligible</span>
                      ) : (
                        <span className="badge badge-unallocated">Ineligible</span>
                      )
                    ) : (
                      <StatusBadge status={elective.status} />
                    )}
                  </div>
                </div>

                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.5rem" }}>
                  {elective.name}
                </h3>

                <p
                  style={{
                    fontSize: "0.85rem",
                    color: "#475569",
                    marginBottom: "1rem",
                    flex: 1,
                    lineHeight: "1.45",
                  }}
                >
                  {elective.description}
                </p>

                {/* Ineligibility Warning if any */}
                {isStudent && !isEligible && (
                  <div
                    style={{
                      fontSize: "0.8rem",
                      color: "#991b1b",
                      backgroundColor: "#fee2e2",
                      padding: "0.45rem 0.75rem",
                      borderRadius: "6px",
                      marginBottom: "0.75rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                    }}
                  >
                    <XCircle size={15} style={{ flexShrink: 0 }} />
                    <span>{elective.ineligibilityReason}</span>
                  </div>
                )}

                {/* Scope & Capacity Meta */}
                <div
                  style={{
                    backgroundColor: "#f8fafc",
                    padding: "0.75rem",
                    borderRadius: "6px",
                    fontSize: "0.8rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.35rem",
                    marginBottom: "1rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b" }}>Seat Capacity:</span>
                    <strong>{elective.capacity} seats</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b" }}>Applicable Branches:</span>
                    <strong>{elective.applicableBranches?.join(", ") || "All"}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b" }}>Applicable Semesters:</span>
                    <strong>Sem {elective.applicableSemesters?.join(", ") || "All"}</strong>
                  </div>
                  {elective.minCgpa > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>Minimum CGPA Cutoff:</span>
                      <strong style={{ color: "#b45309" }}>{elective.minCgpa.toFixed(2)}</strong>
                    </div>
                  )}
                  {elective.prerequisites && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>Prerequisites:</span>
                      <span style={{ textAlign: "right", maxWidth: "180px", color: "#334155" }}>
                        {elective.prerequisites}
                      </span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b" }}>Instructor / Coordinator:</span>
                    <strong>{elective.facultyName || "Dept Faculty"}</strong>
                  </div>
                </div>

                {/* Student Action */}
                {isStudent && onAddToPreferences && (
                  <button
                    onClick={() => onAddToPreferences(elective.id)}
                    className={`btn ${isEligible ? "btn-primary" : "btn-secondary"}`}
                    style={{ width: "100%", justifyContent: "center" }}
                    disabled={!isEligible}
                  >
                    <Plus size={16} />
                    <span>{isEligible ? "Add to Preference List" : "Ineligible for Course"}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
