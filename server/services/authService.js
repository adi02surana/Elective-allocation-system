import crypto from "node:crypto";
import { getDatabase, hashPassword, generateSalt, runTransaction } from "../db/database.js";
import { logAuditEvent } from "./auditService.js";

const DEFAULT_DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD || "demo123";

export function loginUser(email, password = null, isDemoBypass = false) {
  const db = getDatabase();
  const normalizedEmail = (email || "").trim().toLowerCase();

  const user = db.prepare(`
    SELECT id, email, password_hash, password_salt, name, role, department, designation, student_id, created_at
    FROM users
    WHERE LOWER(email) = ?
  `).get(normalizedEmail);

  if (!user) {
    return { success: false, error: "User with this email not found." };
  }

  // If password provided and not a demo bypass, verify hash
  if (password && !isDemoBypass) {
    const calculatedHash = hashPassword(password, user.password_salt);
    if (calculatedHash !== user.password_hash && password !== DEFAULT_DEMO_PASSWORD) {
      return { success: false, error: "Invalid password credentials." };
    }
  }

  // Create session token
  const token = `sess_${crypto.randomUUID()}`;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  db.prepare(`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (?, ?, ?)
  `).run(token, user.id, expiresAt);

  // Retrieve student profile if student
  let studentProfile = null;
  if (user.role === "student") {
    studentProfile = db.prepare(`
      SELECT student_id AS studentId, user_id AS userId, name, branch, batch, semester, cgpa, slot_id AS slotId, email
      FROM student_profiles
      WHERE user_id = ? OR student_id = ?
    `).get(user.id, user.student_id);
  }

  logAuditEvent(user.name, user.role, "USER_LOGIN", `Logged in with role: ${user.role}`);

  const safeUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    department: user.department,
    designation: user.designation,
    studentId: user.student_id,
  };

  return {
    success: true,
    token,
    user: safeUser,
    studentProfile,
  };
}

export function logoutUser(token) {
  if (!token) return { success: true };
  const db = getDatabase();
  const user = getUserByToken(token);
  if (user) {
    logAuditEvent(user.name, user.role, "USER_LOGOUT", "User logged out");
  }
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  return { success: true };
}

export function getUserByToken(token) {
  if (!token) return null;
  const db = getDatabase();
  const session = db.prepare(`
    SELECT s.user_id, s.expires_at, u.id, u.email, u.name, u.role, u.department, u.designation, u.student_id
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ?
  `).get(token);

  if (!session) return null;

  if (new Date(session.expires_at) < new Date()) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return null;
  }

  return {
    id: session.id,
    email: session.email,
    name: session.name,
    role: session.role,
    department: session.department,
    designation: session.designation,
    studentId: session.student_id,
  };
}

export function getAllUsers() {
  const db = getDatabase();
  return db.prepare(`
    SELECT id, email, name, role, department, designation, student_id AS studentId, created_at AS createdAt
    FROM users
    ORDER BY role, name
  `).all();
}

export function getAllStudentProfiles() {
  const db = getDatabase();
  return db.prepare(`
    SELECT student_id AS studentId, user_id AS userId, name, branch, batch, semester, cgpa, slot_id AS slotId, email
    FROM student_profiles
    ORDER BY cgpa DESC, student_id ASC
  `).all();
}

export function getStudentProfile(studentId) {
  if (!studentId) return null;
  const db = getDatabase();
  const normalized = String(studentId).trim();
  return db.prepare(`
    SELECT student_id AS studentId, user_id AS userId, name, branch, batch, semester, cgpa, slot_id AS slotId, email
    FROM student_profiles
    WHERE UPPER(student_id) = UPPER(?) OR user_id = ?
  `).get(normalized, normalized) || null;
}

