import React, { useState, useEffect } from "react";
import { reportService } from "../services/reportService";
import { storageService } from "../services/storageService";
import { StatusBadge } from "../components/StatusBadge";
import {
  BarChart3,
  Download,
  Users,
  Award,
  AlertTriangle,
  Search,
  Filter,
  CheckCircle2,
  BookOpen,
} from "lucide-react";

export function ReportsPage() {
  const [reportData, setReportData] = useState(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [branchFilter, setBranchFilter] = useState("ALL");

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      await storageService.syncFromBackend();
    } catch {
      // fallback
    }
    setReportData(reportService.getComprehensiveReport());
  };

  if (!reportData) {
    return (
      <div className="page-container">
        <div>Loading reports...</div>
      </div>
    );
  }

  const {
    totalStudents,
    totalSubmitted,
    totalProcessed,
    totalAllocated,
    totalUnallocated,
    allocationRate,
    courseReport,
    rankDistribution,
    results,
    config,
  } = reportData;

  const filteredResults = results.filter((r) => {
    const matchesSearch =
      r.studentName.toLowerCase().includes(studentSearch.toLowerCase()) ||
      r.studentId.toLowerCase().includes(studentSearch.toLowerCase()) ||
      (r.electiveCode && r.electiveCode.toLowerCase().includes(studentSearch.toLowerCase())) ||
      (r.courseCode && r.courseCode.toLowerCase().includes(studentSearch.toLowerCase()));

    const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
    const matchesBranch = branchFilter === "ALL" || r.branch === branchFilter;

    return matchesSearch && matchesStatus && matchesBranch;
  });

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Institutional Allocation Reports & Analytics</h1>
          <p className="page-description">
            Comprehensive audit reports, course seat occupancy, and student allocation breakdown.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <button
            onClick={() => reportService.exportResultsCsv()}
            className="btn btn-secondary"
            disabled={results.length === 0}
          >
            <Download size={16} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon-box" style={{ backgroundColor: "#eff6ff", color: "#2563eb" }}>
            <Users size={24} />
          </div>
          <div>
            <div className="metric-value">{totalProcessed}</div>
            <div className="metric-label">Processed Students ({totalSubmitted} Submitted)</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box" style={{ backgroundColor: "#ecfdf5", color: "#059669" }}>
            <Award size={24} />
          </div>
          <div>
            <div className="metric-value">{totalAllocated}</div>
            <div className="metric-label">Students Allocated ({allocationRate}%)</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box" style={{ backgroundColor: "#fef2f2", color: "#dc2626" }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <div className="metric-value">{totalUnallocated}</div>
            <div className="metric-label">Unallocated Students</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box" style={{ backgroundColor: "#fef3c7", color: "#d97706" }}>
            <BookOpen size={24} />
          </div>
          <div>
            <div className="metric-value">
              {courseReport.filter((c) => c.isFull).length} / {courseReport.length}
            </div>
            <div className="metric-label">Courses at Full Capacity</div>
          </div>
        </div>
      </div>

      {/* Rank Satisfaction Distribution Cards */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Preference Rank Satisfaction Distribution</h2>
            <p className="card-subtitle">
              Distribution of which ranked preference choice allocated students received
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: "1rem",
            textAlign: "center",
          }}
        >
          {[1, 2, 3, 4, 5].map((rank) => {
            const count = rankDistribution[rank] || 0;
            const percentage = totalAllocated > 0 ? Math.round((count / totalAllocated) * 100) : 0;
            return (
              <div
                key={rank}
                style={{
                  padding: "1rem",
                  backgroundColor: "#f8fafc",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 600 }}>
                  Choice #{rank}
                </div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1e3a8a", margin: "0.2rem 0" }}>
                  {count}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#059669", fontWeight: 500 }}>
                  {percentage}% of allocated
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Course-Wise Seat Occupancy Report */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Course-Wise Capacity & Seat Occupancy Report</h2>
            <p className="card-subtitle">
              Configured capacity, filled seats, vacancies, and students allocated per course
            </p>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Course Code</th>
                <th>Course Title</th>
                <th>Department</th>
                <th>Capacity</th>
                <th>Allocated</th>
                <th>Remaining</th>
                <th>Occupancy Rate</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {courseReport.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong style={{ fontFamily: "var(--font-mono)", color: "#1e3a8a" }}>
                      {c.courseCode}
                    </strong>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    {c.allocatedStudents.length > 0 && (
                      <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.2rem" }}>
                        Enrolled: {c.allocatedStudents.map((s) => `${s.studentId} (Choice #${s.preferenceRank})`).join(", ")}
                      </div>
                    )}
                  </td>
                  <td>{c.department}</td>
                  <td>{c.capacity}</td>
                  <td>
                    <strong>{c.allocatedCount}</strong>
                  </td>
                  <td>
                    <span style={{ color: c.remainingSeats === 0 ? "#dc2626" : "#059669", fontWeight: 600 }}>
                      {c.remainingSeats}
                    </span>
                  </td>
                  <td style={{ minWidth: "140px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
                      <span>{c.fillPercentage}%</span>
                      <span>{c.allocatedCount}/{c.capacity}</span>
                    </div>
                    <div className="fill-bar-bg">
                      <div
                        className="fill-bar-fill"
                        style={{
                          width: `${c.fillPercentage}%`,
                          backgroundColor: c.isFull ? "#dc2626" : "#2563eb",
                        }}
                      />
                    </div>
                  </td>
                  <td>
                    {c.isFull ? (
                      <span className="badge badge-unallocated">FULL (100%)</span>
                    ) : (
                      <span className="badge badge-allocated">VACANCY</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student-Wise Detailed Allocation Outcome Table */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Student-Wise Detailed Allocation Audit</h2>
            <p className="card-subtitle">
              Complete student roster with assigned elective, granted choice rank, and explanatory audit reason
            </p>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
          <div style={{ flex: 1, minWidth: "240px", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Search size={18} color="#64748b" />
            <input
              type="text"
              className="form-input"
              placeholder="Search student by name, roll number, or allocated course..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 600 }}>Status:</span>
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: "auto" }}
            >
              <option value="ALL">All Statuses</option>
              <option value="ALLOCATED">Allocated Only</option>
              <option value="UNALLOCATED">Unallocated Only</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 600 }}>Branch:</span>
            <select
              className="form-select"
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              style={{ width: "auto" }}
            >
              <option value="ALL">All Branches</option>
              <option value="CSE">CSE</option>
              <option value="CCE">CCE</option>
              <option value="ECE">ECE</option>
            </select>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Priority</th>
                <th>Roll No</th>
                <th>Student Name</th>
                <th>Branch</th>
                <th>CGPA</th>
                <th>Status</th>
                <th>Allocated Course</th>
                <th>Choice Rank</th>
                <th>Audit Decision Reason</th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                    No results found matching your search.
                  </td>
                </tr>
              ) : (
                filteredResults.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span style={{ fontWeight: 600, color: "#64748b" }}>#{r.priorityIndex || "—"}</span>
                    </td>
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
                        <span style={{ fontWeight: 700, color: "#2563eb" }}>Choice #{r.preferenceRank}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ fontSize: "0.82rem", color: "#475569", maxWidth: "340px" }}>
                      {r.reason || r.assignedReason}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
