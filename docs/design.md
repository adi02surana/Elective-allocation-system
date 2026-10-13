# Design Document — Elective Allocation System

**Team:** T016  
**Institution:** The LNM Institute of Information Technology, Jaipur  
**Course:** Software Development Laboratory  
**Status:** Midterm Prototype Design & Implementation Baseline  
**Source Baseline:** SRS, Lab Assignments 3–5, and Working Prototype  

---

## 1. Purpose

This document outlines the user-facing workflows, validation rules, data models, component mappings, and testing checklist implemented in the **Elective Allocation System** midterm prototype.

---

## 2. Design Principles

- **Transparent Role & Cycle Awareness:** Visual status tags indicate active cycles, deadlines, and current user personas.
- **Strict Decoupling of Preference Collection & Allocation:** Preference collection happens independently; allocation is an atomic, administrator-initiated batch operation.
- **Multi-Layer Validation & Capacity Protection:** Business constraints (eligibility, positive capacity, duplicate prevention) are enforced in domain services (`src/services/`), not merely in UI forms.
- **Explainable Outcomes:** Every allocation result provides the preference rank awarded, priority standing, and exact explanatory rationale (including why earlier preferences were skipped).
- **Zero Hardcoding & Determinism:** All outcomes are computed directly from live data using the deterministic Serial Priority matching algorithm.
- **Predictable Repeatability:** A 1-click reset function restores the canonical seed dataset.

---

## 3. Roles and Permissions Matrix

| Capability / Action | Student | Faculty Coordinator | Academic Administrator | System Administrator | Enforcement Location |
|---|:---:|:---:|:---:|:---:|---|
| **View own academic profile** | Yes | No | Yes | Yes | `StudentDashboard.jsx` |
| **Browse eligible electives** | Yes | Yes | Yes | Yes | `ElectivesCatalogue.jsx` |
| **Edit & rank preferences** | Yes | No | No | No | `validationService.canSubmitPreferences` |
| **Submit preferences** | Yes | No | No | No | `preferenceService.submitPreferences` |
| **Reopen submitted choices** | Yes (if window open) | No | No | No | `preferenceService.reopenForModification` |
| **Create & edit electives** | No | Yes | Yes | Yes | `validationService.canManageCourses` |
| **Set seat capacities & cutoffs** | No | Yes | Yes | Yes | `electiveService.updateElective` |
| **Verify readiness preconditions** | No | No | Yes | Yes | `allocationService.checkReadiness` |
| **Configure tie-break rules** | No | No | Yes | Yes | `allocationService.updateRuleConfig` |
| **Execute allocation engine** | No | No | Yes | Yes | `validationService.canStartAllocation` |
| **Publish official results** | No | No | Yes | Yes | `allocationService.publishResults` |
| **Inspect institutional reports** | No | Yes (summary) | Yes (full) | Yes (full) | `ReportsPage.jsx` |
| **View individual student result** | Own result only | Scoped view | Full roster | Full roster | `StudentResultView.jsx` |
| **Reset sample data to baseline**| No | No | Yes | Yes | `storageService.resetToSeedData` |

---

## 4. Implemented Screens & Component Architecture

### 4.1 Login & Persona Access (`src/pages/LoginPage.jsx`)
- Institutional header (The LNMIIT Jaipur, Team T016).
- 4 quick-access demo role cards: Student (Aarav Sharma), Faculty Coordinator (Dr. Preeti Jain), Academic Administrator (Prof. S. R. Verma), and System Administrator (Mr. Rajeev N.).
- Manual email entry with automatic role detection.
- Demo mode disclaimer.

### 4.2 Student Academic Dashboard (`src/pages/StudentDashboard.jsx`)
- Academic credentials: Roll Number, Branch, Batch 2022, Semester 6, Cumulative GPA.
- Active registration window status: `OPEN`, dates, required choice range ($3$ to $5$).
- Preference status chip: `DRAFT`, `SUBMITTED`.
- Allocation outcome card: Displays assigned course when published; informs student when pending publication.

### 4.3 Eligible Electives Catalogue (`src/pages/ElectivesCatalogue.jsx`)
- Search by course code, name, instructor.
- Filter by department and student eligibility.
- Real-time eligibility badge calculation:
  - Branch applicability (e.g. `CS4101` open to CSE/CCE; ECE marked Ineligible).
  - Minimum CGPA cutoff (e.g. `CS4105 Quantum Computing` requires CGPA $\ge 8.0$).
- Seat reservation disclaimer banner.

### 4.4 Preference Builder (`src/pages/PreferenceBuilder.jsx` — UC-005 & UC-006)
- **Step 1:** Select eligible course from dropdown.
- **Step 2:** Explicit rank ordering with accessible **Move Up** and **Move Down** controls.
- Duplicate choice prevention and inline error alerts.
- **Review Step:** Modal dialog displaying ranked order before submission.
- **Timestamped Confirmation:** Upon submission, status transitions to `SUBMITTED` with ISO timestamp.
- **Modification Lifecycle:** Within open window, student can click "Modify Submitted Choices" to revert to `DRAFT`.

### 4.5 Faculty Course Management (`src/pages/FacultyCourseManagement.jsx` — UC-007)
- Course catalogue table with capacities, enrolled counts, and available vacancies.
- Add / Edit Elective modal with positive integer capacity and branch/semester checkboxes.
- **Capacity Constraint Enforcement:** Blocks capacity reductions below currently allocated student count.

### 4.6 Allocation Administration (`src/pages/AllocationAdmin.jsx` — UC-011)
- **Preconditions Checklist:** Active courses configured, valid positive capacities, submitted preference lists, approved tie-breaking policy.
- **Deterministic Policy Selector:** CGPA Merit (FCFS tie-break), Pure FCFS, or Student Roll Number order.
- Two-step confirmation modal before execution.
- Real engine execution with transparent **Execution Trace Log Console**.
- Two-phase result lifecycle: Computed Review $\rightarrow$ Publish Official Results.

### 4.7 Institutional Reports (`src/pages/ReportsPage.jsx`)
- Summary KPI cards (Total processed, allocated count, unallocated count, fill percentage).
- Preference rank satisfaction distribution (Choices #1 through #5).
- Course-wise seat occupancy table with capacity fill bars.
- Student-wise detailed audit roster with search and filter.
- Reliable one-click CSV export (`Elective_Allocation_Report.csv`).

### 4.8 Student Result View (`src/pages/StudentResultView.jsx` — UC-015)
- Exposes strictly only the logged-in student's allocation outcome.
- Explains granted preference rank and decision rationale.
- Explains Spot Round / Waitlist counseling next steps for unallocated students.

### 4.9 System Administration (`src/pages/SysAdminPage.jsx`)
- Seeded user persona directory.
- Chronological system audit events log.
- Factory reset modal.

---

## 5. Primary Workflows

### 5.1 UC-005 — Submit Elective Preferences
```text
Student Portal -> Check Window OPEN -> Add Eligible Electives -> Reorder (Ranks 1..N)
      -> Review Modal -> Validation -> SUBMITTED (Timestamped) -> Confirmation
```

### 5.2 UC-007 — Manage Elective Courses
```text
Faculty Portal -> Add/Edit Course Form -> Validate Positive Capacity & Scope
      -> Capacity Check (New Cap >= Allocated Count) -> Persist Course -> Catalogue Updated
```

### 5.3 UC-011 — Initiate Centralized Allocation
```text
Admin Portal -> Check Preconditions (4/4 Passed) -> Select Tie-Break Policy
      -> Confirm & Run Engine -> Serial Priority Match -> Display Trace Logs
      -> Admin Review -> Confirm & Publish -> Available in Student Portals
```

---

## 6. SRS Ambiguity Resolution Note

The early section of the SRS (BR-002–BR-010, Assignment 2) described slot-based direct registration where students manually raced for seats. Later requirements (FR-023–050, UC-005, UC-011) described ranked preferences followed by centralized automated allocation.  
This prototype adheres to the **ranked-preference centralized allocation workflow**, treating registration slots as the submission time window. The team should confirm this resolution with the instructor before final viva submission.

---

## 7. Concrete Data Model

### User
```typescript
interface User {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'faculty' | 'admin' | 'sysadmin';
  studentId?: string;
  department?: string;
  designation?: string;
}
```

### StudentProfile
```typescript
interface StudentProfile {
  studentId: string;
  userId: string;
  name: string;
  branch: 'CSE' | 'CCE' | 'ECE';
  batch: '2022' | '2023';
  semester: number;
  cgpa: number;
  slotId: string;
  email: string;
}
```

### Elective
```typescript
interface Elective {
  id: string;
  courseCode: string;
  name: string;
  description: string;
  department: string;
  applicableBranches: string[];
  applicableSemesters: number[];
  capacity: number;
  minCgpa: number;
  prerequisites: string;
  facultyName: string;
  status: 'ACTIVE' | 'INACTIVE';
}
```

### PreferenceList
```typescript
interface PreferenceList {
  id: string;
  studentId: string;
  cycleId: string;
  status: 'DRAFT' | 'SUBMITTED' | 'LOCKED';
  submittedAt: string | null;
  items: Array<{ electiveId: string; rank: number }>;
}
```

### AllocationResult
```typescript
interface AllocationResult {
  id: string;
  studentId: string;
  studentName: string;
  branch: string;
  cgpa: number;
  cycleId: string;
  status: 'ALLOCATED' | 'UNALLOCATED';
  electiveId: string | null;
  electiveCode: string | null;
  electiveName: string | null;
  preferenceRank: number | null;
  reason: string;
  priorityIndex: number;
  processedAt: string;
}
```

---

## 8. Automated Unit Test Verification

The test suite in `tests/` executes with `npm test` (Vitest):
1. **Rule 1:** Course capacity is strictly never exceeded under heavy contention.
2. **Rule 2:** Ineligible students (branch mismatch or low CGPA) are never assigned to that course.
3. **Rule 3:** Full first choice triggers consideration of subsequent preferences in rank order.
4. **Rule 4:** Tie-breaking is completely deterministic across repeated runs with identical inputs.
5. **Rule 5:** No eligible and available preference results in `UNALLOCATED`.
6. **Rule 6:** Duplicate preferences in the same submission list are rejected.
7. **Rule 7:** Closed-window preference submissions are rejected.
8. **Rule 8:** Minimum preference count ($3$) is enforced.
9. **Rule 9:** Unauthorized roles cannot manage courses or start allocation.
10. **Rule 10:** Course capacity reductions below current allocations are blocked.
11. **Rule 11:** Factory data reset restores predictable canonical seed data.
