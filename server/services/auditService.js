import { getDatabase } from "../db/database.js";

export function logAuditEvent(actor, role, action, details) {
  try {
    const db = getDatabase();
    const id = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const timestamp = new Date().toISOString();

    db.prepare(`
      INSERT INTO audit_events (id, actor, role, action, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, actor || "System", role || "system", action, details || "", timestamp);

    return { id, actor, role, action, details, timestamp };
  } catch (err) {
    console.error("[ECAS Audit] Failed to log audit event:", err.message);
    return null;
  }
}

export function getAuditEvents(limit = 100) {
  const db = getDatabase();
  return db.prepare(`
    SELECT id, actor, role, action, details, timestamp
    FROM audit_events
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(limit);
}

