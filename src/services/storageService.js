import { INITIAL_SEED_DATA } from "../data/seedData";
import { apiClient } from "./apiClient";

const STORAGE_KEY = "LNMIIT_EAS_PROTOTYPE_DATA_V1";

let memoryStore = {};
const memoryStorage = {
  getItem: (key) => memoryStore[key] || null,
  setItem: (key, val) => {
    memoryStore[key] = String(val);
  },
  removeItem: (key) => {
    delete memoryStore[key];
  },
  clear: () => {
    memoryStore = {};
  },
};

function getStorage() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== "undefined" && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch (e) {
    // Access to localStorage might be restricted
  }
  return memoryStorage;
}

/**
 * Storage Service - Manages persistence in SQLite via Backend REST API
 * with local caching for instant UI responsiveness and offline Vitest compatibility.
 */
class StorageService {
  constructor() {
    this.isBackendConnected = false;
    this.init();
  }

  init() {
    const storage = getStorage();
    const existing = storage.getItem(STORAGE_KEY);
    if (!existing) {
      this.resetToSeedData("System Auto-Initialization");
    }

    // Probe backend database connectivity when running in browser
    if (typeof window !== "undefined" && window.fetch) {
      this.syncFromBackend();
    }
  }

  async syncFromBackend() {
    try {
      const health = await apiClient.checkHealth();
      if (health && health.status === "UP") {
        this.isBackendConnected = true;

        // Fetch electives and sync
        const electivesRes = await apiClient.get("/api/electives");
        const configRes = await apiClient.get("/api/allocation/config");
        const resultsRes = await apiClient.get("/api/allocation/results");

        const data = this.getData();
        if (electivesRes?.success && Array.isArray(electivesRes.electives)) {
          data.electives = electivesRes.electives;
        }
        if (configRes?.success && configRes.config) {
          data.allocationRuleConfig = configRes.config;
        }
        if (resultsRes?.success && Array.isArray(resultsRes.results)) {
          data.allocationResults = resultsRes.results;
        }

        this.saveData(data);
      }
    } catch (e) {
      // Backend not yet reachable; use persistent local cache
    }
  }

  getData() {
    try {
      const storage = getStorage();
      const serialized = storage.getItem(STORAGE_KEY);
      if (!serialized) {
        return this.resetToSeedData("Auto Reset from Empty");
      }
      return JSON.parse(serialized);
    } catch (e) {
      console.error("Error reading from storage, resetting to seed data:", e);
      return this.resetToSeedData("Recovery from Corrupted State");
    }
  }

  saveData(data) {
    try {
      const storage = getStorage();
      storage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Error saving to storage:", e);
    }
  }

  resetToSeedData(actorName = "Demo User") {
    // Deep clone initial seed data
    const seed = JSON.parse(JSON.stringify(INITIAL_SEED_DATA));

    // Add reset audit event
    const resetEvent = {
      id: `aud_reset_${Date.now()}`,
      actor: actorName,
      role: "sysadmin",
      action: "RESET_TO_SEED_DATA",
      details: "Application reset to canonical baseline seed data in SQLite database.",
      timestamp: new Date().toISOString(),
    };
    seed.auditEvents = [resetEvent, ...seed.auditEvents];

    this.saveData(seed);

    // Also trigger backend SQLite database reset if browser environment
    if (typeof window !== "undefined" && window.fetch) {
      apiClient.post("/api/system/reset", { actorName }).catch(() => {});
    }

    return seed;
  }

  // Generic collection helpers
  getCollection(collectionName) {
    const data = this.getData();
    return data[collectionName] || [];
  }

  setCollection(collectionName, items) {
    const data = this.getData();
    data[collectionName] = items;
    this.saveData(data);
  }

  // Audit event logger
  logAudit(actor, role, action, details) {
    const data = this.getData();
    const event = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      actor,
      role,
      action,
      details,
      timestamp: new Date().toISOString(),
    };
    data.auditEvents = [event, ...(data.auditEvents || [])];
    this.saveData(data);

    return event;
  }
}

export const storageService = new StorageService();
