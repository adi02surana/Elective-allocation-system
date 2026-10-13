# Elective Allocation System — Midterm Prototype

**Team ID:** T016  
**Institution:** The LNM Institute of Information Technology, Jaipur  
**Course:** Software Development Laboratory (SDE-LAB)  
**Team Members:** Krishangee Tayal, Mudit Kumar Dwivedi, Lakshit Agarwal, Ananya Surana  
**Project Type:** Centralized Web-Based Elective Course Preference and Allocation System  
**Development Approach:** Agile + Incremental Development  

---

## 1. Executive Summary & Objective

The **Elective Allocation System** centralizes elective course preference collection and executes an automated, deterministic allocation engine. It replaces legacy manual slot-based registration with a modern ranked-preference workflow, evaluating:
1. Student academic scope (branch, batch, semester);
2. Elective availability and eligibility criteria (branch restrictions, semester validity, minimum CGPA cutoffs);
3. Configured course seat capacities;
4. Submitted student preference rankings (1st choice, 2nd choice, etc.);
5. An explicit, deterministic tie-breaking policy (Serial Priority by Cumulative GPA descending, with FCFS application timestamp tie-breaking).

This prototype is **genuinely interactive and deterministic**: outcomes are calculated in real time by the allocation engine from live data, with zero hardcoded outcomes.

---

## 2. Technology Stack

- **Frontend Framework:** React 19 with Vite 6 (Fast ESM build and zero-latency HMR)
- **Styling Architecture:** Vanilla CSS design tokens (`src/index.css`) adhering to clean academic administration guidelines (navy/slate palette `#1e3a8a`, accessible contrast, responsive layout, status chips, modal dialogs)
- **Icons:** `lucide-react` (Academic and operational indicators)
- **Unit Testing Framework:** `vitest` (Fast, isolated test runner verifying business logic and validations)
- **Persistence Layer:** Client-side local storage (`localStorage`) with full seed data reset and audit event logging (explicitly labelled as demo persistence, not production DB)

---

## 3. Quick Start & Setup Commands

### Prerequisites
- Node.js (v18+ or v24+ recommended)
- npm (v9+)

### Installation
```bash
npm install
```

### Run Locally (Development Dev Server)
```bash
npm run dev
```
The application will launch at: `http://localhost:5173/`

### Run Test Suite (Vitest)
```bash
npm test
```
Executes all 11 unit tests covering capacity limits, eligibility gating, preference fallback, deterministic tie-breaking, duplicate rejection, and role authorization.

### Build for Production
```bash
npm run build
```
Generates production bundle in `./dist` in under 3 seconds.

---

## 4. Demo Accounts & Persona Directory

The application includes a 1-click Persona Switcher on the Login page and in the top navigation bar. No passwords are required in demo mode:

| Role | Demo Email | Persona Name | Key Responsibility / Test Scenario |
|---|---|---|---|
| **Student (High Merit)** | `student.demo@example.test` | Aarav Sharma (`22UCS001`, CSE, CGPA 9.45) | Submitted preferences; receives 1st preference (Machine Learning). |
| **Student (Contested Rank)** | `chirag.demo@example.test` | Chirag Mehta (`22UCC007`, CCE, CGPA 8.85) | Contested seat on ML; demonstrates fallback to 2nd choice (Cloud Computing). |
| **Student (Ineligible Choice)** | `gauri.demo@example.test` | Gauri Iyer (`22UCS045`, CSE, CGPA 7.75) | Ranked Quantum Computing (ineligible due to CGPA < 8.0); engine skips to 2nd choice. |
| **Student (Unallocated)** | `ishita.demo@example.test` | Ishita Saxena (`22UCC032`, CCE, CGPA 6.95) | Only ranked full courses; demonstrates explainable `UNALLOCATED` status. |
| **Student (Draft / Unsubmitted)**| `jai.demo@example.test` | Jai Kapoor (`22UCS088`, CSE, CGPA 6.60) | Demonstrates draft preference editing, reordering, and live submission. |
| **Faculty Coordinator** | `faculty.demo@example.test` | Dr. Preeti Jain (CSE UG Coordinator) | Course Management (UC-007): add/edit courses, capacities, eligibility rules. |
| **Academic Administrator** | `admin.demo@example.test` | Prof. S. R. Verma (Dean of Academics) | Allocation Console (UC-011): readiness checklist, policy selection, run engine, publish results. |
| **System Administrator** | `sysadmin.demo@example.test` | Mr. Rajeev N. (CIT) | System Console: view users, audit event trail, factory seed data reset. |

---

## 5. Core Screens & Implemented Use Cases

1. **Login & Persona Selector (`src/pages/LoginPage.jsx`):**
   - Clean institutional access with Team T016 details and 1-click persona cards.
   - Demo mode transparency notices.
2. **Student Dashboard (`src/pages/StudentDashboard.jsx`):**
   - Academic profile (branch, batch, semester, priority CGPA).
   - Registration cycle status (`OPEN` vs `CLOSED`) and preference status (`DRAFT`, `SUBMITTED`).
   - Published allocation outcome (allocated course or unallocated status).
3. **Eligible Electives Catalogue (`src/pages/ElectivesCatalogue.jsx` — UC-002):**
   - Search by code, title, or faculty; filter by department and student eligibility.
   - Distinct eligibility tags with reasons (e.g. "Ineligible: Requires min CGPA 8.0").
   - Explicit disclaimer: adding a course to preferences does not reserve a seat.
4. **Preference Builder (`src/pages/PreferenceBuilder.jsx` — UC-005 & UC-006):**
   - Selection from eligible catalogue; explicit **Move Up / Move Down** reordering controls.
   - Real-time validation: minimum 3 choices, maximum 5 choices, no duplicates.
   - Review dialog before final submission; timestamp recorded upon submission.
   - Reopen / modification workflow within open registration window.
5. **Faculty Course Management (`src/pages/FacultyCourseManagement.jsx` — UC-007):**
   - Add and edit electives with validation (positive integer capacity, required fields).
   - Department, applicable branches (CSE, CCE, ECE), semesters (5, 6), prerequisites, and min CGPA.
   - **Capacity Integrity Enforcement:** Blocks reducing capacity below already allocated students.
6. **Allocation Administration (`src/pages/AllocationAdmin.jsx` — UC-011):**
   - Preconditions checklist: active electives, valid capacities, submitted lists, approved policy.
   - Configurable deterministic tie-breaking policy selector.
   - Two-step confirmation dialog before execution.
   - Real engine execution with detailed execution log console.
   - Two-phase result lifecycle: draft/computed review $\rightarrow$ official publication.
7. **Institutional Reports & Analytics (`src/pages/ReportsPage.jsx` — UC-013 & UC-016):**
   - Summary cards: processed students, allocated students, unallocated count, fill percentage.
   - Preference rank satisfaction distribution (Choices #1 through #5).
   - Course-wise seat occupancy report with fill rate bars and enrolled student lists.
   - Complete student roster audit table with search, status filters, and export to CSV.
8. **Student Allocation Result (`src/pages/StudentResultView.jsx` — UC-015):**
   - Strictly exposes **only** the logged-in student's allocation outcome and explanatory reason.
9. **System Administration & Audits (`src/pages/SysAdminPage.jsx`):**
   - Demo user directory, chronological audit event log, and factory data reset.

---

## 6. Allocation Algorithm Explanation (Viva Ready)

The engine is implemented in `src/services/allocationEngine.js` using the **Serial Priority Matching Model**:

1. **Filtering:** Only students with `status === 'SUBMITTED'` for the active cycle are processed.
2. **Deterministic Priority Queue:** Students are sorted according to the approved policy:
   - Primary: Cumulative GPA descending (Merit).
   - Secondary (Tie-break): Preference list submission timestamp ascending (First-Come, First-Served).
   - Tertiary (Final Tie-break): Student Roll Number ascending (guaranteeing 100% deterministic reproducibility).
3. **Sequential Preference Evaluation:**
   - For each student in priority order, their choices are evaluated in rank order ($1, 2, 3\dots$).
   - **Eligibility Verification:** Branch matches course scope, semester matches course scope, and student CGPA $\ge$ minimum cutoff.
   - **Capacity Check:** Total seats already allocated to this course $<$ course capacity.
4. **Assignment:**
   - If eligible and seats remain, the student is assigned to that course and its remaining seats decrement.
   - If full or ineligible, the reason is logged and the engine immediately evaluates the student's next preference.
   - If all preferences are exhausted without an assignment, the student is marked `UNALLOCATED` with an explicit reason.
   - Each student receives at most **one** elective. Course capacities are never exceeded.

---

## 7. SRS Ambiguity Note

> [!NOTE]
> **SRS Policy Inconsistency Note:**  
> The early section of the SRS (Business Rules BR-002 through BR-010, Assignment 2) outlines a slot-based direct registration mechanism where students claim seats in real time. However, the subsequent system requirements and detailed use cases (FR-023–050, UC-005, and UC-011) define a centralized ranked-preference collection model followed by automated allocation.  
>  
> For this prototype, we have followed the detailed **UC-005 / UC-011 ranked preference and centralized allocation workflow**, treating registration slots as a time-window condition for preference submissions. As instructed, the team should confirm this interpretation with the instructor/senate for future phases.

---

## 8. Test Verification Summary

All 11 unit tests pass (`npm test`):
- `RULE 1`: Course capacity is strictly never exceeded.
- `RULE 2`: Ineligible students are never assigned to an elective (CGPA and branch checks).
- `RULE 3`: Full first choice triggers consideration of next valid preference in rank order.
- `RULE 4`: Tie-breaking is completely deterministic across repeated runs.
- `RULE 5`: No eligible and available preference results in Unallocated.
- `RULE 6`: Duplicate preferences in the same submission list are rejected.
- `RULE 7`: Closed-window preference submission is rejected.
- `RULE 8`: Minimum preference count is enforced.
- `RULE 9`: Unauthorized roles cannot manage courses or start allocation.
- `RULE 10`: Course capacity validation blocks negative values and reductions below allocated count.
- `RULE 11`: Reset returns the application to predictable canonical seed data.

---

## 9. Midterm Demonstration Script (Step-by-Step for Viva)

1. **Open the Application:** Launch `http://localhost:5173/`. Point out the Team T016 header, project overview, and the 4 persona quick-login cards.
2. **Student Experience (Jai Kapoor - Draft):**
   - Click "Student" or switch to **Jai Kapoor (`22UCS088`)**.
   - Navigate to **Preference Builder (UC-005)**. Notice status is `DRAFT`.
   - Add an elective (e.g. `CS4101`), use the **Move Up / Move Down** buttons to re-rank.
   - Click **Review & Submit Preferences**, inspect the review table, and confirm. Notice the timestamp and `SUBMITTED` badge.
3. **Faculty Course Management (UC-007):**
   - Switch role to **Faculty Coordinator (Dr. Preeti Jain)**.
   - Navigate to **Course Management (UC-007)**.
   - Edit an elective (e.g. `CS4102 Cloud Computing`), demonstrate positive integer capacity validation and branch/CGPA criteria.
4. **Academic Administration & Allocation (UC-011):**
   - Switch role to **Academic Administrator (Prof. S. R. Verma)**.
   - Navigate to **Allocation Console (UC-011)**.
   - Walk the evaluator through the **4 Preconditions Checklist** (all green).
   - Review the deterministic tie-breaking policy dropdown (**CGPA Merit with FCFS Tie-Break**).
   - Click **Start Allocation (UC-011)** $\rightarrow$ **Confirm & Run Engine**.
   - Show the live **Execution Trace Log** explaining which student received which seat and why.
   - Click **Publish Official Results** to release outcomes.
5. **Review Reports:**
   - Navigate to **Results & Reports**.
   - Show the KPI metrics, preference rank distribution, and course seat occupancy bars.
   - In the student audit table, highlight:
     - **Aarav Sharma (`22UCS001`)**: received Choice #1 (Machine Learning) on high merit.
     - **Chirag Mehta (`22UCC007`)**: Machine Learning filled up (capacity 2), so bumped to Choice #2 (Cloud Computing).
     - **Gauri Iyer (`22UCS045`)**: Ineligible for Choice #1 (Quantum Computing, Min CGPA 8.0), so bumped to Choice #2.
     - **Ishita Saxena (`22UCC032`)**: Remained `UNALLOCATED` because all submitted choices reached capacity.
   - Click **Export CSV** to download the official allocation roster.
6. **Student Published Result View (UC-015):**
   - Switch back to **Student (Aarav Sharma)**.
   - Open **My Allocation Result (UC-015)** and confirm that he now sees his allocated course with decision rationale.
7. **Clean Reset:**
   - Click **Reset Demo Data** in the topbar to prove repeatable demonstration.

---

## 10. Limitations & Out-of-Scope Items

- **Authentication:** Uses simulated demo personas and role switching rather than institutional LDAP/SSO.
- **Persistence:** Local client storage simulates persistence for demonstration without cloud database dependencies.
- **Multiple Elective Baskets:** Evaluates single open-elective allocation per cycle; multiple concurrent elective baskets will be addressed in future phases.
- **Fee / Timetable Integration:** ERP timetable scheduling and fee holds are out of scope for the midterm prototype.
