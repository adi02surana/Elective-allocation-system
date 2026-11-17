import React, { useState, useEffect } from "react";
import { storageService } from "../services/storageService";
import { apiClient } from "../services/apiClient";
import { StatusBadge } from "../components/StatusBadge";
import { Modal } from "../components/Modal";
import {
  Settings,
  Users,
  RotateCcw,
  ShieldCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Database,
  Search,
} from "lucide-react";

export function SysAdminPage({ onDataReset }) {
  const [data, setData] = useState(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Live Database Explorer state
  const [dbTables, setDbTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState("preference_lists");
  const [tableData, setTableData] = useState({ columns: [], rows: [] });
  const [isLoadingTable, setIsLoadingTable] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [tableSearch, setTableSearch] = useState("");

  useEffect(() => {
    loadData();
    fetchTables();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      fetchTableData(selectedTable);
    }
  }, [selectedTable]);

  useEffect(() => {
    let intervalId;
    if (autoRefresh && selectedTable) {
      intervalId = setInterval(() => {
        fetchTableData(selectedTable, true);
        fetchTables();
      }, 2000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [autoRefresh, selectedTable]);

  const loadData = () => {
    setData(storageService.getData());
  };

  const fetchTables = async () => {
    try {
      const res = await apiClient.get("/api/database/tables");
      if (res && res.success && res.tables) {
        setDbTables(res.tables);
      }
    } catch {
      // fallback
    }
  };

  const fetchTableData = async (tableName, isSilent = false) => {
    if (!isSilent) setIsLoadingTable(true);
    try {
      const res = await apiClient.get(`/api/database/table/${tableName}`);
      if (res && res.success) {
        setTableData({ columns: res.columns || [], rows: res.rows || [] });
      }
    } catch (err) {
      console.error("Failed to load table data:", err);
    } finally {
      if (!isSilent) setIsLoadingTable(false);
    }
  };

  const handleResetData = async () => {
    await storageService.resetToSeedData("System Administrator");
    setShowResetModal(false);
    setResetSuccess(true);
    loadData();
    fetchTables();
    if (selectedTable) fetchTableData(selectedTable);
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

      {/* Live SQLite Database Explorer */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div className="card-header" style={{ flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h2 className="card-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Database size={20} color="#2563eb" />
              <span>Live SQLite Database Explorer (ecas.db)</span>
            </h2>
            <p className="card-subtitle">
              Inspect database tables, schema columns, and live records in real time as actions occur
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            {/* Table Selector */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748b" }}>Table:</label>
              <select
                className="form-select"
                style={{ minWidth: "190px", padding: "0.35rem 0.6rem", fontSize: "0.85rem" }}
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
              >
                {dbTables.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name} ({t.rowCount} rows)
                  </option>
                ))}
              </select>
            </div>

            {/* Manual Refresh Button */}
            <button
              onClick={() => {
                fetchTableData(selectedTable);
                fetchTables();
              }}
              className="btn btn-secondary btn-sm"
              title="Query SQLite database for latest records"
            >
              <RotateCcw size={14} />
              <span>Refresh</span>
            </button>

            {/* Auto Refresh Toggle */}
            <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8rem", color: "#475569", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                style={{ accentColor: "#2563eb" }}
              />
              <span>Live Poll (2s)</span>
            </label>
          </div>
        </div>

        {/* Search inside table */}
        <div style={{ padding: "0 1.25rem 0.75rem 1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Search size={16} color="#64748b" />
          <input
            type="text"
            className="form-input"
            style={{ maxWidth: "320px", padding: "0.35rem 0.65rem", fontSize: "0.82rem" }}
            placeholder={`Filter ${selectedTable} rows...`}
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
          />
          <span style={{ fontSize: "0.78rem", color: "#64748b", marginLeft: "auto" }}>
            Showing <strong>{tableData.rows.filter((r) => !tableSearch || Object.values(r).some((v) => String(v || "").toLowerCase().includes(tableSearch.toLowerCase()))).length}</strong> of <strong>{tableData.rows.length}</strong> records
          </span>
        </div>

        {/* Database Records Table */}
        <div className="table-container" style={{ maxHeight: "380px", overflowY: "auto" }}>
          {tableData.rows.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#64748b", fontSize: "0.88rem" }}>
              {isLoadingTable ? "Loading records from ecas.db..." : `No records found in table '${selectedTable}'.`}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  {tableData.columns.map((col) => (
                    <th key={col.name} style={{ whiteSpace: "nowrap" }}>
                      {col.name}
                      <span style={{ fontSize: "0.65rem", color: "#94a3b8", display: "block", fontWeight: 400 }}>
                        {col.type} {col.pk ? "(PK)" : ""}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.rows
                  .filter((r) => !tableSearch || Object.values(r).some((v) => String(v || "").toLowerCase().includes(tableSearch.toLowerCase())))
                  .map((row, idx) => (
                    <tr key={idx}>
                      {tableData.columns.map((col) => {
                        const val = row[col.name];
                        const valStr = val === null ? "NULL" : typeof val === "object" ? JSON.stringify(val) : String(val);
                        const isNull = val === null;
                        const isStatus = col.name.toLowerCase() === "status";

                        return (
                          <td key={col.name} style={{ fontSize: "0.82rem", whiteSpace: "nowrap" }}>
                            {isStatus && !isNull ? (
                              <StatusBadge status={String(val)} label={String(val)} />
                            ) : (
                              <span
                                style={{
                                  color: isNull ? "#94a3b8" : "#1e293b",
                                  fontStyle: isNull ? "italic" : "normal",
                                  fontFamily: typeof val === "number" || col.name.includes("id") ? "var(--font-mono)" : "inherit",
                                }}
                              >
                                {valStr}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
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
