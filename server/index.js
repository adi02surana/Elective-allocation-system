import http from "node:http";
import { URL } from "node:url";
import { verifyDatabaseConnection } from "./db/database.js";
import { seedDatabase } from "./db/seed.js";
import { handleApiRoute } from "./routes/apiRouter.js";

const PORT = parseInt(process.env.PORT || "5001", 10);
const HOST = process.env.HOST || "127.0.0.1";

// 1. Verify Database connectivity and auto-seed if clean
console.log("==========================================================");
console.log("   Elective Course Allocation System (ECAS) - Backend");
console.log("   Team T016 - SDE LAB, The LNMIIT Jaipur");
console.log("==========================================================");

const dbStatus = verifyDatabaseConnection();
if (!dbStatus.connected) {
  console.error("FATAL: Database connectivity check failed:", dbStatus.error);
  process.exit(1);
}

console.log(`[ECAS Backend] Database: Connected successfully (${dbStatus.engine})`);
console.log(`[ECAS Backend] Storage Location: ${dbStatus.path}`);

// If electives or users table is empty, seed demo data
if (dbStatus.stats.users === 0 || dbStatus.stats.electives === 0) {
  console.log("[ECAS Backend] Clean database detected. Auto-seeding canonical demo data...");
  seedDatabase(false, "Server Auto-Init");
}

// 2. Create HTTP Server
export const server = http.createServer(async (req, res) => {
  const protocol = req.socket.encrypted ? "https" : "http";
  const parsedUrl = new URL(req.url, `${protocol}://${req.headers.host || "localhost"}`);

  // Only handle /api endpoints
  if (!parsedUrl.pathname.startsWith("/api")) {
    res.writeHead(404, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Only /api endpoints are served by backend." }));
  }

  // Parse body if present
  let body = {};
  if (["POST", "PUT", "PATCH"].includes(req.method.toUpperCase())) {
    try {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const rawBody = Buffer.concat(chunks).toString("utf-8");
      if (rawBody.trim()) {
        body = JSON.parse(rawBody);
      }
    } catch (parseErr) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ success: false, error: "Invalid JSON request payload." }));
    }
  }

  return handleApiRoute(req, res, parsedUrl, body);
});

// If run directly: `node server/index.js`
if (process.argv[1] && process.argv[1].endsWith("index.js")) {
  server.listen(PORT, HOST, () => {
    console.log(`[ECAS Backend] HTTP API server listening on http://${HOST}:${PORT}`);
    console.log(`[ECAS Backend] Health check endpoint: http://${HOST}:${PORT}/api/health`);
    console.log("==========================================================");
  });
}

