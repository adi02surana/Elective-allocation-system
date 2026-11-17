import { storageService } from "./storageService";
import { apiClient } from "./apiClient";
import { INITIAL_SEED_DATA } from "../data/seedData";

const AUTH_USER_KEY = "LNMIIT_EAS_CURRENT_USER";

class AuthService {
  getCurrentUser() {
    try {
      const stored = localStorage.getItem(AUTH_USER_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error("Error reading auth state:", e);
    }
    // Default to admin for seamless first experience
    const defaultUser = {
      id: "usr_admin_1",
      email: "admin.demo@example.test",
      name: "Prof. S. R. Verma",
      role: "admin",
      department: "Office of Academic Affairs",
      designation: "Academic Administrator / Dean (Academics)",
    };
    this.setCurrentUser(defaultUser);
    return defaultUser;
  }

  setCurrentUser(user) {
    try {
      if (user) {
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(AUTH_USER_KEY);
      }
    } catch (e) {
      console.error("Error saving auth state:", e);
    }
  }

  async login(email, password = null) {
    const cleanEmail = (email || "").trim().toLowerCase();
    const data = storageService.getData();
    let user = (data.users || []).find((u) => u.email.toLowerCase() === cleanEmail);

    if (!user) {
      user = INITIAL_SEED_DATA.users.find((u) => u.email.toLowerCase() === cleanEmail);
      if (user) {
        data.users = data.users || [];
        data.users.push(user);
        storageService.saveData(data);
      }
    }

    if (user) {
      this.setCurrentUser(user);
      storageService.logAudit(user.name, user.role, "USER_LOGIN", `Logged in with role: ${user.role}`);

      // Call backend API for session creation & token
      if (typeof globalThis !== "undefined" && typeof globalThis.fetch === "function") {
        try {
          const res = await apiClient.post("/api/auth/login", {
            email: user.email,
            password: password || "demo123",
            isDemoBypass: !password,
          });
          if (res?.success && res.token) {
            apiClient.setToken(res.token);
          }
        } catch (e) {
          console.error("Backend login sync error:", e);
        }
      }

      return { success: true, user };
    }
    return { success: false, error: "Invalid demo credentials or user not found." };
  }

  async logout() {
    const user = this.getCurrentUser();
    if (user) {
      storageService.logAudit(user.name, user.role, "USER_LOGOUT", "User logged out");
    }

    if (typeof window !== "undefined" && window.fetch) {
      try {
        await apiClient.post("/api/auth/logout");
      } catch (e) {}
      apiClient.clearToken();
    }

    localStorage.removeItem(AUTH_USER_KEY);
  }

  getCurrentStudentProfile() {
    const user = this.getCurrentUser();
    if (!user || user.role !== "student") return null;

    const data = storageService.getData();
    const profile = data.studentProfiles.find(
      (p) =>
        (p.studentId && user.studentId && p.studentId.toUpperCase() === user.studentId.toUpperCase()) ||
        p.userId === user.id ||
        p.studentId === user.studentId
    );
    return profile || null;
  }

  getAllStudents() {
    const data = storageService.getData();
    return data.studentProfiles || [];
  }

  async switchDemoStudent(studentId) {
    const data = storageService.getData();
    const studentProfile = data.studentProfiles.find(
      (s) => s.studentId?.toUpperCase() === studentId?.toUpperCase() || s.studentId === studentId
    );
    if (!studentProfile) return false;

    const user = data.users.find(
      (u) =>
        u.id === studentProfile.userId ||
        (u.studentId && u.studentId.toUpperCase() === studentProfile.studentId.toUpperCase())
    ) || {
      id: studentProfile.userId || `usr_${studentProfile.studentId}`,
      email: studentProfile.email,
      name: studentProfile.name,
      role: "student",
      studentId: studentProfile.studentId,
    };

    this.setCurrentUser(user);

    if (typeof window !== "undefined" && window.fetch) {
      try {
        const res = await apiClient.post("/api/auth/login", {
          email: user.email,
          isDemoBypass: true,
        });
        if (res?.token) apiClient.setToken(res.token);
      } catch (e) {
        console.error("Backend student switch login error:", e);
      }
    }

    return true;
  }
}

export const authService = new AuthService();
