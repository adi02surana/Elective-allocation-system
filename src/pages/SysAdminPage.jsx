import React, { useState, useEffect } from "react";
import { storageService } from "../services/storageService";
import { StatusBadge } from "../components/StatusBadge";
import { Modal } from "../components/Modal";
import {
  Settings,
  Users,
  RotateCcw,
  ShieldCheck,
  Clock,
  Database,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

export function SysAdminPage({ onDataReset }) {
  const [data, setData] = useState(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setData(storageService.getData());
  };

  const handleResetData = () => {
    storageService.resetToSeedData("System Administrator");
    setShowResetModal(false);
    setResetSuccess(true);
    loadData();
    if (onDataReset) onDataReset();
  };

  if (!data) return <div className="page-container">Loading...</div>;

  const users = data.users || [];
  const auditEvents = data.auditEvents || [];

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">System Administration & Diagnostics</h1>
          <p className="page-description">
            Demo user credentials directory, system audit trails, and baseline seed data restoration.
          </p>
        </div>
        <div>
          <button onClick={() => setShowResetModal(true)} className="btn btn-danger">
            <RotateCcw size={16} />
            <span>Reset All Demo Data</span>
          </button>
        </div>
      </div>

      {resetSuccess && (
        <div className="alert alert-success">
          <CheckCircle2 size={20} style={{ flexShrink: 0 }} />
          <div>All application entities restored to factory demonstration baseline!</div>
        </div>
      )}

      {/* Persistence Architecture Note */}
      <div className="alert alert-info">
        <Database size={20} style={{ flexShrink: 0 }} />
        <div>
          <strong>Demo Architecture Notice:</strong> This prototype utilizes browser local storage 
          (<code>localStorage</code>) to simulate centralized persistence across demo personas without 
          requiring external cloud database setup. In institutional production, this service layer 
          would interface with LNMIIT's PostgreSQL database and campus ERP.
        </div>
      </div>

      {/* Demo Users Directory */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">
              <Users size={20} color="#2563eb" />
              <span>Registered Demo Users & Personas</span>
            </h2>
            <p className="card-subtitle">
              Pre-seeded institutional accounts for evaluation and testing
            </p>
          </div>
          <div>
            <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
              Total: <strong>{users.length}</strong> accounts
            </span>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>User ID</th>
                <th>Full Name</th>
                <th>Demo Email</th>
                <th>Assigned Role</th>
                <th>Academic Affiliation</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "#64748b" }}>
                      {u.id}
                    </span>
                  </td>
                  <td>
                    <strong style={{ color: "#0f172a" }}>{u.name}</strong>
                  </td>
                  <td>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem", color: "#2563eb" }}>
                      {u.email}
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={u.role.toUpperCase()} label={u.role} />
                  </td>
                  <td style={{ fontSize: "0.82rem", color: "#475569" }}>
                    {u.department || u.designation || (u.studentId ? `Student ID: ${u.studentId}` : "LNMIIT")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* System Audit Events Log */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">
              <Clock size={20} color="#2563eb" />
              <span>System Activity & Audit Log</span>
            </h2>
            <p className="card-subtitle">
              Chronological log of administrative actions, course edits, submissions, and engine runs
            </p>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Role</th>
                <th>Action Type</th>
                <th>Audit Details</th>
              </tr>
            </thead>
            <tbody>
              {auditEvents.map((ev) => (
                <tr key={ev.id}>
                  <td style={{ fontSize: "0.78rem", whiteSpace: "nowrap", color: "#64748b", fontFamily: "var(--font-mono)" }}>
                    {new Date(ev.timestamp).toLocaleString()}
                  </td>
                  <td>
                    <strong>{ev.actor}</strong>
                  </td>
                  <td>
                    <StatusBadge status={ev.role?.toUpperCase()} label={ev.role} />
                  </td>
                  <td>
                    <strong style={{ fontSize: "0.82rem", color: "#1e3a8a" }}>{ev.action}</strong>
                  </td>
                  <td style={{ fontSize: "0.82rem", color: "#475569" }}>
                    {ev.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      <Modal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        title="Confirm Factory Data Reset"
        footer={
          <>
            <button onClick={() => setShowResetModal(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button onClick={handleResetData} className="btn btn-danger">
              <RotateCcw size={16} />
              Reset All Data
            </button>
          </>
        }
      >
        <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
          <AlertTriangle size={36} color="#dc2626" style={{ flexShrink: 0 }} />
          <div>
            <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
              Are you sure you want to reset all data back to the default seed state?
            </p>
            <p style={{ fontSize: "0.85rem", color: "#64748b" }}>
              All 10 student records, 7 electives, and initial preference submissions will be restored. 
              Any custom courses or allocation results generated during this session will be cleared.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
