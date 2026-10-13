import React from "react";
import {
  LayoutDashboard,
  BookOpen,
  ListOrdered,
  Award,
  Layers,
  Settings,
  ShieldCheck,
  BarChart3,
  LogOut,
  Users,
} from "lucide-react";

export function Sidebar({ currentTab, onSelectTab, currentUser, onLogout }) {
  const role = currentUser?.role || "student";

  const renderNavLinks = () => {
    if (role === "student") {
      return (
        <>
          <div className="nav-section-label">Student Portal</div>
          <button
            onClick={() => onSelectTab("student-dashboard")}
            className={`nav-item ${currentTab === "student-dashboard" ? "active" : ""}`}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => onSelectTab("catalogue")}
            className={`nav-item ${currentTab === "catalogue" ? "active" : ""}`}
          >
            <BookOpen size={18} />
            <span>Electives Catalogue</span>
          </button>

          <button
            onClick={() => onSelectTab("preference-builder")}
            className={`nav-item ${currentTab === "preference-builder" ? "active" : ""}`}
          >
            <ListOrdered size={18} />
            <span>Preference Builder (UC-005)</span>
          </button>

          <button
            onClick={() => onSelectTab("student-result")}
            className={`nav-item ${currentTab === "student-result" ? "active" : ""}`}
          >
            <Award size={18} />
            <span>My Allocation Result</span>
          </button>
        </>
      );
    }

    if (role === "faculty") {
      return (
        <>
          <div className="nav-section-label">Faculty Coordinator</div>
          <button
            onClick={() => onSelectTab("course-management")}
            className={`nav-item ${currentTab === "course-management" ? "active" : ""}`}
          >
            <Layers size={18} />
            <span>Course Management (UC-007)</span>
          </button>

          <button
            onClick={() => onSelectTab("catalogue")}
            className={`nav-item ${currentTab === "catalogue" ? "active" : ""}`}
          >
            <BookOpen size={18} />
            <span>Electives Catalogue</span>
          </button>

          <button
            onClick={() => onSelectTab("reports")}
            className={`nav-item ${currentTab === "reports" ? "active" : ""}`}
          >
            <BarChart3 size={18} />
            <span>Allocation Summaries</span>
          </button>
        </>
      );
    }

    if (role === "admin") {
      return (
        <>
          <div className="nav-section-label">Academic Administration</div>
          <button
            onClick={() => onSelectTab("allocation-admin")}
            className={`nav-item ${currentTab === "allocation-admin" ? "active" : ""}`}
          >
            <ShieldCheck size={18} />
            <span>Allocation Console (UC-011)</span>
          </button>

          <button
            onClick={() => onSelectTab("reports")}
            className={`nav-item ${currentTab === "reports" ? "active" : ""}`}
          >
            <BarChart3 size={18} />
            <span>Results & Reports</span>
          </button>

          <button
            onClick={() => onSelectTab("course-management")}
            className={`nav-item ${currentTab === "course-management" ? "active" : ""}`}
          >
            <Layers size={18} />
            <span>Course Capacities</span>
          </button>

          <button
            onClick={() => onSelectTab("catalogue")}
            className={`nav-item ${currentTab === "catalogue" ? "active" : ""}`}
          >
            <BookOpen size={18} />
            <span>Catalogue View</span>
          </button>
        </>
      );
    }

    if (role === "sysadmin") {
      return (
        <>
          <div className="nav-section-label">System Administration</div>
          <button
            onClick={() => onSelectTab("sysadmin")}
            className={`nav-item ${currentTab === "sysadmin" ? "active" : ""}`}
          >
            <Settings size={18} />
            <span>System Console & Audits</span>
          </button>

          <button
            onClick={() => onSelectTab("allocation-admin")}
            className={`nav-item ${currentTab === "allocation-admin" ? "active" : ""}`}
          >
            <ShieldCheck size={18} />
            <span>Allocation Engine</span>
          </button>

          <button
            onClick={() => onSelectTab("reports")}
            className={`nav-item ${currentTab === "reports" ? "active" : ""}`}
          >
            <BarChart3 size={18} />
            <span>Institutional Reports</span>
          </button>

          <button
            onClick={() => onSelectTab("course-management")}
            className={`nav-item ${currentTab === "course-management" ? "active" : ""}`}
          >
            <Layers size={18} />
            <span>Manage Courses</span>
          </button>
        </>
      );
    }

    return null;
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="institute-label">The LNMIIT Jaipur</div>
        <div className="system-title">
          <span>Elective Allocator</span>
          <span className="team-chip">Team T016</span>
        </div>
      </div>

      <nav className="sidebar-nav">{renderNavLinks()}</nav>

      <div className="sidebar-footer">
        <div className="user-profile-badge">
          <div className="user-avatar">
            {currentUser?.name ? currentUser.name.charAt(0) : "U"}
          </div>
          <div className="user-info">
            <div className="user-name" title={currentUser?.name}>
              {currentUser?.name || "Demo User"}
            </div>
            <div className="user-role-tag">
              {currentUser?.role === "student" && currentUser.studentId
                ? `${currentUser.role} • ${currentUser.studentId}`
                : currentUser?.role || "user"}
            </div>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="btn btn-secondary btn-sm"
          style={{ width: "100%", justifyContent: "center" }}
        >
          <LogOut size={14} />
          <span>Exit to Login</span>
        </button>
      </div>
    </aside>
  );
}
