import { verifyDatabaseConnection, getDatabase } from "../db/database.js";
import { seedDatabase } from "../db/seed.js";
import * as authService from "../services/authService.js";
import * as electiveService from "../services/electiveService.js";
import * as preferenceService from "../services/preferenceService.js";
import * as allocationService from "../services/allocationService.js";
import * as reportService from "../services/reportService.js";
import * as auditService from "../services/auditService.js";

/**
 * Extract auth token from request header or query
 */
function getAuthToken(req) {
  const authHeader = req.headers["authorization"] || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }
  return null;
}

/**
 * Route handler for all /api endpoints
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {object} parsedUrl
 * @param {object} body
 */
export async function handleApiRoute(req, res, parsedUrl, body = {}) {
  const method = req.method.toUpperCase();
  const pathname = parsedUrl.pathname;

  const json = (statusCode, data) => {
    res.writeHead(statusCode, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    res.end(JSON.stringify(data));
  };

  const text = (statusCode, content, contentType = "text/plain") => {
    res.writeHead(statusCode, {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
    });
    res.end(content);
  };

  // Pre-flight OPTIONS
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    return res.end();
  }

  // Resolve calling user if token present
  const token = getAuthToken(req) || body.token;
  const callingUser = token ? authService.getUserByToken(token) : null;
  const actorRole = body.actorRole || callingUser?.role || "student";
  const actorName = body.actorName || callingUser?.name || "Demo User";

  try {
    // 1. Health check & DB verification
    if (pathname === "/api/health" && method === "GET") {
      const dbStatus = verifyDatabaseConnection();
      return json(dbStatus.connected ? 200 : 503, {
        status: dbStatus.connected ? "UP" : "DOWN",
        timestamp: new Date().toISOString(),
        database: dbStatus,
      });
    }

    // 2. Authentication routes
    if (pathname === "/api/auth/login" && method === "POST") {
      const { email, password, isDemoBypass } = body;
      const result = authService.loginUser(email, password, isDemoBypass);
      return json(result.success ? 200 : 401, result);
    }

    if (pathname === "/api/auth/logout" && method === "POST") {
      const result = authService.logoutUser(token);
      return json(200, result);
    }

    if (pathname === "/api/auth/me" && method === "GET") {
      if (!callingUser) {
        return json(401, { success: false, error: "Unauthenticated" });
      }
      let studentProfile = null;
      if (callingUser.role === "student") {
        studentProfile = authService.getStudentProfile(callingUser.studentId);
      }
      return json(200, { success: true, user: callingUser, studentProfile });
    }

    if (pathname === "/api/users" && method === "GET") {
      return json(200, { success: true, users: authService.getAllUsers() });
    }

    if (pathname === "/api/students" && method === "GET") {
      return json(200, { success: true, students: authService.getAllStudentProfiles() });
    }

    // 3. Elective Courses (UC-007)
    if (pathname === "/api/electives" && method === "GET") {
      const cycleId = parsedUrl.searchParams.get("cycleId") || "slot_sem6_active";
      return json(200, { success: true, electives: electiveService.getAllElectives(cycleId) });
    }

    if (pathname.startsWith("/api/electives/student/") && method === "GET") {
      const studentId = pathname.replace("/api/electives/student/", "");
      const cycleId = parsedUrl.searchParams.get("cycleId") || "slot_sem6_active";
      const student = authService.getStudentProfile(studentId);
      return json(200, {
        success: true,
        electives: electiveService.getElectivesForStudent(student, cycleId),
      });
    }

    if (pathname === "/api/electives" && method === "POST") {
      const result = electiveService.createElective(body, actorRole, actorName);
      return json(result.success ? 201 : 400, result);
    }

    if (pathname.startsWith("/api/electives/") && method === "PUT") {
      const id = pathname.replace("/api/electives/", "");
      const result = electiveService.updateElective(id, body, actorRole, actorName);
      return json(result.success ? 200 : 400, result);
    }

    if (pathname.startsWith("/api/electives/") && method === "DELETE") {
      const id = pathname.replace("/api/electives/", "");
      const result = electiveService.deleteElective(id, actorRole, actorName);
      return json(result.success ? 200 : 400, result);
    }

    // 4. Preferences & Registration Windows (UC-005)
    if (pathname === "/api/preferences/window" && method === "GET") {
      const cycleId = parsedUrl.searchParams.get("cycleId") || "slot_sem6_active";
      return json(200, { success: true, window: preferenceService.getActiveWindow(cycleId) });
    }

    if (pathname === "/api/preferences/windows" && method === "GET") {
      return json(200, { success: true, windows: preferenceService.getAllWindows() });
    }

    if (pathname === "/api/preferences/lists" && method === "GET") {
      const cycleId = parsedUrl.searchParams.get("cycleId") || "slot_sem6_active";
      return json(200, { success: true, preferenceLists: preferenceService.getAllPreferenceLists(cycleId) });
    }

    if (pathname.startsWith("/api/preferences/list/") && method === "GET") {
      const studentId = pathname.replace("/api/preferences/list/", "");
      const cycleId = parsedUrl.searchParams.get("cycleId") || "slot_sem6_active";
      const prefList = preferenceService.getStudentPreferenceList(studentId, cycleId);
      return json(200, { success: true, preferenceList: prefList });
    }

    if (pathname === "/api/preferences/draft" && method === "POST") {
      const { studentId, cycleId, items } = body;
      const result = preferenceService.saveDraft(studentId, cycleId || "slot_sem6_active", items);
      return json(200, result);
    }

    if (pathname === "/api/preferences/submit" && method === "POST") {
      const { studentId, cycleId, items } = body;
      const student = authService.getStudentProfile(studentId);
      const result = preferenceService.submitPreferences(student, cycleId || "slot_sem6_active", items);
      return json(result.success ? 200 : 400, result);
    }

    if (pathname === "/api/preferences/reopen" && method === "POST") {
      const { studentId, cycleId } = body;
      const result = preferenceService.reopenForModification(studentId, cycleId || "slot_sem6_active");
      return json(result.success ? 200 : 400, result);
    }

    // 5. Allocation Operations (UC-011)
    if (pathname === "/api/allocation/config" && method === "GET") {
      const cycleId = parsedUrl.searchParams.get("cycleId") || "slot_sem6_active";
      return json(200, { success: true, config: allocationService.getRuleConfig(cycleId) });
    }

    if (pathname === "/api/allocation/config" && method === "PUT") {
      const cycleId = body.cycleId || "slot_sem6_active";
      const result = allocationService.updateRuleConfig(cycleId, body, actorRole, actorName);
      return json(result.success ? 200 : 400, result);
    }

    if (pathname === "/api/allocation/readiness" && method === "GET") {
      const cycleId = parsedUrl.searchParams.get("cycleId") || "slot_sem6_active";
      return json(200, allocationService.checkReadiness(cycleId));
    }

    if (pathname === "/api/allocation/execute" && method === "POST") {
      const cycleId = body.cycleId || "slot_sem6_active";
      const result = allocationService.executeAllocation(cycleId, actorRole, actorName);
      return json(result.success ? 200 : 400, result);
    }

    if (pathname === "/api/allocation/publish" && method === "POST") {
      const cycleId = body.cycleId || "slot_sem6_active";
      const result = allocationService.publishResults(cycleId, actorRole, actorName);
      return json(result.success ? 200 : 400, result);
    }

    if (pathname === "/api/allocation/reset" && method === "POST") {
      const cycleId = body.cycleId || "slot_sem6_active";
      const result = allocationService.resetAllocation(cycleId, actorRole, actorName);
      return json(result.success ? 200 : 400, result);
    }

    if (pathname === "/api/allocation/results" && method === "GET") {
      const cycleId = parsedUrl.searchParams.get("cycleId") || "slot_sem6_active";
      return json(200, { success: true, results: allocationService.getAllocationResults(cycleId) });
    }

    if (pathname.startsWith("/api/allocation/result/") && method === "GET") {
      const studentId = pathname.replace("/api/allocation/result/", "");
      const cycleId = parsedUrl.searchParams.get("cycleId") || "slot_sem6_active";
      const bypass = parsedUrl.searchParams.get("bypass") === "true";
      const result = allocationService.getStudentResult(studentId, cycleId, bypass);
      return json(200, result);
    }

    // 6. Reports & Audits
    if (pathname === "/api/reports/summary" && method === "GET") {
      const cycleId = parsedUrl.searchParams.get("cycleId") || "slot_sem6_active";
      return json(200, { success: true, report: reportService.getComprehensiveReport(cycleId) });
    }

    if (pathname === "/api/reports/csv" && method === "GET") {
      const cycleId = parsedUrl.searchParams.get("cycleId") || "slot_sem6_active";
      const csv = reportService.generateCsvReport(cycleId);
      return text(200, csv, "text/csv; charset=utf-8");
    }

    if (pathname === "/api/audit-events" && method === "GET") {
      const limit = parseInt(parsedUrl.searchParams.get("limit") || "100", 10);
      return json(200, { success: true, auditEvents: auditService.getAuditEvents(limit) });
    }

    // 7. System Factory Reset
    if (pathname === "/api/system/reset" && method === "POST") {
      const counts = seedDatabase(true, actorName);
      return json(200, {
        success: true,
        message: "Database successfully reset to canonical baseline seed data.",
        counts,
      });
    }

    // 8. Live Database Tables & Introspection
    if (pathname === "/api/database/tables" && method === "GET") {
      const db = getDatabase();
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC")
        .all();
      const tableStats = tables.map((t) => {
        const countRow = db.prepare(`SELECT COUNT(*) AS count FROM ${t.name}`).get();
        return { name: t.name, rowCount: countRow?.count || 0 };
      });
      return json(200, { success: true, tables: tableStats });
    }

    if (pathname.startsWith("/api/database/table/") && method === "GET") {
      const rawTableName = pathname.replace("/api/database/table/", "").trim();
      const db = getDatabase();
      if (!/^[a-zA-Z0-9_]+$/.test(rawTableName)) {
        return json(400, { success: false, error: "Invalid table name" });
      }
      const columns = db.prepare(`PRAGMA table_info(${rawTableName})`).all();
      const rows = db.prepare(`SELECT * FROM ${rawTableName} LIMIT 200`).all();
      return json(200, { success: true, tableName: rawTableName, columns, rows });
    }

    // Route not found
    return json(404, { success: false, error: `Endpoint ${method} ${pathname} not found.` });
  } catch (err) {
    console.error(`[ECAS API Error] ${method} ${pathname}:`, err);
    return json(500, { success: false, error: err.message });
  }
}

