import React, { useState, useEffect } from "react";
import { authService } from "../services/authService";
import { electiveService } from "../services/electiveService";
import { StatusBadge } from "../components/StatusBadge";
import { Modal } from "../components/Modal";
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Search,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldAlert,
} from "lucide-react";

export function FacultyCourseManagement() {
  const [electives, setElectives] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const currentUser = authService.getCurrentUser();

  // Modal & Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("CREATE"); // "CREATE" | "EDIT"
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    courseCode: "",
    name: "",
    description: "",
    department: "CSE",
    applicableBranches: ["CSE", "CCE"],
    applicableSemesters: [6],
    capacity: 2,
    minCgpa: 0.0,
    prerequisites: "",
    facultyName: "",
    status: "ACTIVE",
  });

  const [formErrors, setFormErrors] = useState([]);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({ isOpen: false, id: null, code: "" });

  useEffect(() => {
    loadElectives();
  }, []);

  const loadElectives = () => {
    setElectives(electiveService.getAllElectives());
  };

  const handleOpenCreate = () => {
    setModalMode("CREATE");
    setEditingId(null);
    setFormData({
      courseCode: "",
      name: "",
      description: "",
      department: "CSE",
      applicableBranches: ["CSE", "CCE"],
      applicableSemesters: [6],
      capacity: 3,
      minCgpa: 0.0,
      prerequisites: "",
      facultyName: currentUser?.name || "Dr. Preeti Jain",
      status: "ACTIVE",
    });
    setFormErrors([]);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (elective) => {
    setModalMode("EDIT");
    setEditingId(elective.id);
    setFormData({
      courseCode: elective.courseCode,
      name: elective.name,
      description: elective.description || "",
      department: elective.department || "CSE",
      applicableBranches: elective.applicableBranches || ["CSE"],
      applicableSemesters: elective.applicableSemesters || [6],
      capacity: elective.capacity,
      minCgpa: elective.minCgpa || 0.0,
      prerequisites: elective.prerequisites || "",
      facultyName: elective.facultyName || "",
      status: elective.status || "ACTIVE",
    });
    setFormErrors([]);
    setIsModalOpen(true);
  };

  const handleBranchToggle = (branch) => {
    const current = formData.applicableBranches || [];
    if (current.includes(branch)) {
      setFormData({ ...formData, applicableBranches: current.filter((b) => b !== branch) });
    } else {
      setFormData({ ...formData, applicableBranches: [...current, branch] });
    }
  };

  const handleSemesterToggle = (sem) => {
    const current = formData.applicableSemesters || [];
    if (current.includes(sem)) {
      setFormData({ ...formData, applicableSemesters: current.filter((s) => s !== sem) });
    } else {
      setFormData({ ...formData, applicableSemesters: [...current, sem] });
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setFormErrors([]);
    setActionSuccess(null);

    if (modalMode === "CREATE") {
      const result = electiveService.createElective(
        formData,
        currentUser?.role || "faculty",
        currentUser?.name || "Faculty Coordinator"
      );

      if (result.success) {
        setIsModalOpen(false);
        setActionSuccess(`Course ${result.elective.courseCode} created successfully!`);
        loadElectives();
      } else {
        setFormErrors(result.errors || ["Failed to create course."]);
      }
    } else {
      const result = electiveService.updateElective(
        editingId,
        formData,
        currentUser?.role || "faculty",
        currentUser?.name || "Faculty Coordinator"
      );

      if (result.success) {
        setIsModalOpen(false);
        setActionSuccess(`Course ${result.elective.courseCode} updated successfully!`);
        loadElectives();
      } else {
        setFormErrors(result.errors || ["Failed to update course."]);
      }
    }
  };

  const handleDeleteCourse = (id) => {
    const result = electiveService.deleteElective(
      id,
      currentUser?.role || "faculty",
      currentUser?.name || "Faculty Coordinator"
    );

    setDeleteConfirmModal({ isOpen: false, id: null, code: "" });

    if (result.success) {
      setActionSuccess("Course deleted successfully.");
      loadElectives();
    } else {
      setFormErrors(result.errors || ["Failed to delete course."]);
    }
  };

  const filteredElectives = electives.filter(
    (e) =>
      e.courseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Elective Course Management</h1>
          <p className="page-description">
            Use Case <strong>UC-007</strong> • Manage elective course details, seat capacities, and eligibility criteria.
          </p>
        </div>
        <div>
          <button onClick={handleOpenCreate} className="btn btn-primary">
            <Plus size={16} />
            <span>Add New Elective</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {actionSuccess && (
        <div className="alert alert-success">
          <CheckCircle2 size={20} style={{ flexShrink: 0 }} />
          <div>{actionSuccess}</div>
        </div>
      )}

      {/* General Error Banner */}
      {formErrors.length > 0 && !isModalOpen && (
        <div className="alert alert-danger">
          <ShieldAlert size={20} style={{ flexShrink: 0 }} />
          <div>{formErrors.join(" ")}</div>
        </div>
      )}

      {/* Capacity Constraint Notice */}
      <div className="alert alert-info">
        <Info size={20} style={{ flexShrink: 0 }} />
        <div>
          <strong>Capacity Integrity Rule:</strong> Once an allocation has completed, reducing a course's seat capacity 
          below the number of currently allocated students is automatically blocked to prevent inconsistent seat counts.
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="card" style={{ padding: "0.85rem 1.25rem", marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", maxWidth: "400px" }}>
          <Search size={18} color="#64748b" />
          <input
            type="text"
            className="form-input"
            placeholder="Search courses by code or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Electives Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Course Code</th>
              <th>Course Name & Department</th>
              <th>Branches</th>
              <th>Sem</th>
              <th>Capacity</th>
              <th>Allocated</th>
              <th>Available</th>
              <th>Min CGPA</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredElectives.map((e) => (
              <tr key={e.id}>
                <td>
                  <strong style={{ color: "#1e3a8a", fontFamily: "var(--font-mono)" }}>
                    {e.courseCode}
                  </strong>
                </td>
                <td>
                  <div style={{ fontWeight: 600, color: "#0f172a" }}>{e.name}</div>
                  <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                    Dept of {e.department} • Coord: {e.facultyName || "Faculty"}
                  </div>
                </td>
                <td>
                  <span style={{ fontSize: "0.82rem", color: "#334155" }}>
                    {e.applicableBranches?.join(", ") || "All"}
                  </span>
                </td>
                <td>Sem {e.applicableSemesters?.join(", ") || "All"}</td>
                <td>
                  <strong>{e.capacity}</strong>
                </td>
                <td>
                  <span style={{ color: e.allocatedCount > 0 ? "#059669" : "#64748b", fontWeight: 600 }}>
                    {e.allocatedCount || 0}
                  </span>
                </td>
                <td>
                  <span
                    style={{
                      fontWeight: 600,
                      color: (e.availableSeats || 0) === 0 ? "#dc2626" : "#2563eb",
                    }}
                  >
                    {e.availableSeats}
                  </span>
                </td>
                <td>{e.minCgpa > 0 ? e.minCgpa.toFixed(2) : "None"}</td>
                <td>
                  <StatusBadge status={e.status} />
                </td>
                <td style={{ textAlign: "right" }}>
                  <div style={{ display: "inline-flex", gap: "0.4rem" }}>
                    <button
                      onClick={() => handleOpenEdit(e)}
                      className="btn btn-secondary btn-sm"
                      title="Edit Course Configuration"
                    >
                      <Edit2 size={14} />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => setDeleteConfirmModal({ isOpen: true, id: e.id, code: e.courseCode })}
                      className="btn btn-secondary btn-sm"
                      title="Delete Course"
                      style={{ color: "#dc2626" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Elective Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalMode === "CREATE" ? "Add New Elective Course" : `Edit Elective: ${formData.courseCode}`}
        maxWidth="680px"
      >
        <form onSubmit={handleFormSubmit}>
          {formErrors.length > 0 && (
            <div className="alert alert-danger" style={{ marginBottom: "1rem" }}>
              <ShieldAlert size={18} style={{ flexShrink: 0 }} />
              <div>
                {formErrors.map((err, i) => (
                  <div key={i}>{err}</div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="form-group">
              <label className="form-label">Course Code *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. CS4109"
                value={formData.courseCode}
                onChange={(e) => setFormData({ ...formData, courseCode: e.target.value.toUpperCase() })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Department *</label>
              <select
                className="form-select"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              >
                <option value="CSE">Computer Science & Eng (CSE)</option>
                <option value="ECE">Electronics & Comm Eng (ECE)</option>
                <option value="HSS">Humanities & Social Sciences</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Course Name *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Advanced Distributed Systems"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Course Description</label>
            <textarea
              className="form-textarea"
              rows={2}
              placeholder="Summary of course contents, objectives, and syllabus..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          {/* Seat Capacity and Eligibility Criteria */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="form-group">
              <label className="form-label">Seat Capacity * (Positive Integer)</label>
              <input
                type="number"
                min="1"
                className="form-input"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                required
              />
              <div className="form-help">Maximum students who can be allocated.</div>
            </div>

            <div className="form-group">
              <label className="form-label">Minimum CGPA Criteria (0.0 - 10.0)</label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="10"
                className="form-input"
                value={formData.minCgpa}
                onChange={(e) => setFormData({ ...formData, minCgpa: e.target.value })}
              />
              <div className="form-help">Leave 0.0 for open merit with no minimum cutoff.</div>
            </div>
          </div>

          {/* Applicable Branches Checkboxes */}
          <div className="form-group">
            <label className="form-label">Eligible Student Branches *</label>
            <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.25rem" }}>
              {["CSE", "CCE", "ECE"].map((branch) => (
                <label key={branch} style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={formData.applicableBranches?.includes(branch)}
                    onChange={() => handleBranchToggle(branch)}
                  />
                  <span>{branch}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Applicable Semesters Checkboxes */}
          <div className="form-group">
            <label className="form-label">Offered In Semester(s) *</label>
            <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.25rem" }}>
              {[5, 6].map((sem) => (
                <label key={sem} style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={formData.applicableSemesters?.includes(sem)}
                    onChange={() => handleSemesterToggle(sem)}
                  />
                  <span>Semester {sem}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="form-group">
              <label className="form-label">Prerequisites (Optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Operating Systems, Data Structures"
                value={formData.prerequisites}
                onChange={(e) => setFormData({ ...formData, prerequisites: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Course Status</label>
              <select
                className="form-select"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="ACTIVE">ACTIVE (Open for Selection)</option>
                <option value="INACTIVE">INACTIVE (Hidden / Suspended)</option>
              </select>
            </div>
          </div>

          <div className="modal-footer" style={{ margin: "1.5rem -1.5rem -1.5rem -1.5rem" }}>
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {modalMode === "CREATE" ? "Create Elective" : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteConfirmModal.isOpen}
        onClose={() => setDeleteConfirmModal({ isOpen: false, id: null, code: "" })}
        title="Confirm Course Deletion"
        footer={
          <>
            <button
              onClick={() => setDeleteConfirmModal({ isOpen: false, id: null, code: "" })}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={() => handleDeleteCourse(deleteConfirmModal.id)}
              className="btn btn-danger"
            >
              Delete Course
            </button>
          </>
        }
      >
        <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
          <AlertTriangle size={32} color="#dc2626" style={{ flexShrink: 0 }} />
          <div>
            <p style={{ fontWeight: 600 }}>
              Are you sure you want to delete course {deleteConfirmModal.code}?
            </p>
            <p style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "0.25rem" }}>
              This will remove the course from the catalogue. Courses with active allocations cannot be deleted.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
