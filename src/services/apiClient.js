/**
 * ECAS API Client
 * Connects the Presentation Layer (React 19) to the Application/Control Layer (Node.js REST API).
 * Manages authorization headers and token persistence.
 */

const TOKEN_KEY = "LNMIIT_EAS_AUTH_TOKEN";

export const apiClient = {
  getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch (e) {
      return null;
    }
  },

  setToken(token) {
    try {
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch (e) {
      console.error("Failed to store token:", e);
    }
  },

  clearToken() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (e) {
      // ignore
    }
  },

  async request(endpoint, options = {}) {
    const url = endpoint.startsWith("http") ? endpoint : endpoint;
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };

    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(url, {
        ...options,
        headers,
      });

      const contentType = res.headers.get("content-type") || "";
      let data;
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        data = await res.text();
      }

      if (!res.ok) {
        return {
          success: false,
          error: data?.error || data?.errors?.join(", ") || `HTTP ${res.status}`,
          status: res.status,
          data,
        };
      }

      return data;
    } catch (err) {
      console.error(`[API Client Error] ${options.method || "GET"} ${endpoint}:`, err);
      return {
        success: false,
        error: `Network/API connection error: ${err.message}`,
      };
    }
  },

  get(endpoint) {
    return this.request(endpoint, { method: "GET" });
  },

  post(endpoint, body) {
    return this.request(endpoint, {
      method: "POST",
      body: JSON.stringify(body || {}),
    });
  },

  put(endpoint, body) {
    return this.request(endpoint, {
      method: "PUT",
      body: JSON.stringify(body || {}),
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: "DELETE" });
  },

  async checkHealth() {
    return this.get("/api/health");
  },
};

