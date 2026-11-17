import React, { useState, useEffect } from "react";
import { authService } from "./services/authService";
import { preferenceService } from "./services/preferenceService";
import { storageService } from "./services/storageService";
import { Navbar } from "./components/Navbar";
import { Sidebar } from "./components/Sidebar";

// Pages
import { LoginPage } from "./pages/LoginPage";
import { StudentDashboard } from "./pages/StudentDashboard";
import { ElectivesCatalogue } from "./pages/ElectivesCatalogue";
import { PreferenceBuilder } from "./pages/PreferenceBuilder";
import { StudentResultView } from "./pages/StudentResultView";
import { FacultyCourseManagement } from "./pages/FacultyCourseManagement";
import { AllocationAdmin } from "./pages/AllocationAdmin";
import { ReportsPage } from "./pages/ReportsPage";
import { SysAdminPage } from "./pages/SysAdminPage";

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentTab, setCurrentTab] = useState("student-dashboard");
  const [activeCycle, setActiveCycle] = useState(null);
  const [initialAddCourseId, setInitialAddCourseId] = useState(null);
  const [keyVersion, setKeyVersion] = useState(0); // Used to trigger re-renders on reset

  useEffect(() => {
    const initApp = async () => {
      try {
        await storageService.syncFromBackend();
      } catch {
        // fallback
      }
      const user = authService.getCurrentUser();
      setCurrentUser(user);
      if (user) {
        setDefaultTabForRole(user.role);
      }
      setActiveCycle(preferenceService.getActiveWindow());
    };
    initApp();
  }, [keyVersion]);

  const setDefaultTabForRole = (role) => {
    if (role === "student") {
      setCurrentTab("student-dashboard");
    } else if (role === "faculty") {
      setCurrentTab("course-management");
    } else if (role === "admin") {
      setCurrentTab("allocation-admin");
    } else if (role === "sysadmin") {
      setCurrentTab("sysadmin");
    }
  };

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setDefaultTabForRole(user.role);
    setActiveCycle(preferenceService.getActiveWindow());
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
  };

  const handleUserChange = (newUser) => {
    setCurrentUser(newUser);
    setDefaultTabForRole(newUser.role);
    setActiveCycle(preferenceService.getActiveWindow());
    setKeyVersion((v) => v + 1);
  };

  const handleDataReset = () => {
    setKeyVersion((v) => v + 1);
    setActiveCycle(preferenceService.getActiveWindow());
  };

  const handleAddCourseToPreferences = (electiveId) => {
    setInitialAddCourseId(electiveId);
    setCurrentTab("preference-builder");
  };

  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  const renderActivePage = () => {
    switch (currentTab) {
      case "student-dashboard":
        return <StudentDashboard key={keyVersion} onNavigate={(tab) => setCurrentTab(tab)} />;

      case "catalogue":
        return (
          <ElectivesCatalogue
            key={keyVersion}
            onAddToPreferences={handleAddCourseToPreferences}
          />
        );

      case "preference-builder":
        return (
          <PreferenceBuilder
            key={keyVersion}
            initialAddElectiveId={initialAddCourseId}
          />
        );

      case "student-result":
        return <StudentResultView key={keyVersion} />;

      case "course-management":
        return <FacultyCourseManagement key={keyVersion} />;

      case "allocation-admin":
        return (
          <AllocationAdmin
            key={keyVersion}
            onNavigateToReports={() => setCurrentTab("reports")}
          />
        );

      case "reports":
        return <ReportsPage key={keyVersion} />;

      case "sysadmin":
        return <SysAdminPage key={keyVersion} onDataReset={handleDataReset} />;

      default:
        return <StudentDashboard onNavigate={(tab) => setCurrentTab(tab)} />;
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setInitialAddCourseId(null);
          setCurrentTab(tab);
        }}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="main-content">
        <Navbar
          currentUser={currentUser}
          onUserChange={handleUserChange}
          onDataReset={handleDataReset}
          activeCycle={activeCycle}
        />

        <main style={{ flex: 1 }}>{renderActivePage()}</main>
      </div>
    </div>
  );
}
