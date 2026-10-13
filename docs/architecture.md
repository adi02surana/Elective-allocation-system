# Architecture Document — Elective Allocation System

**Team:** T016  
**Institution:** The LNM Institute of Information Technology, Jaipur  
**Course:** Software Development Laboratory  
**Status:** Implemented Midterm Prototype Architecture  
**Architecture Style:** Modular Three-Tier Web Application (Presentation Layer, Domain/Service Layer, and Localized Persistence Layer)

---

## 1. System Overview & Architecture Diagram

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   PRESENTATION LAYER (React 19 / JSX)                  │
│                                                                        │
│   LoginPage  •  StudentDashboard  •  ElectivesCatalogue (UC-002)       │
│   PreferenceBuilder (UC-005)  •  FacultyCourseManagement (UC-007)      │
│   AllocationAdmin (UC-011)  •  ReportsPage  •  StudentResultView       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Calls
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   APPLICATION / DOMAIN SERVICE LAYER                   │
│                                                                        │
│  ├── authService.js         : Session identity, role switcher          │
│  ├── preferenceService.js   : Draft management, ranking, submissions   │
│  ├── electiveService.js     : Catalogue queries, CRUD, capacity bounds │
│  ├── validationService.js   : Preconditions, business rule validation  │
│  ├── allocationEngine.js    : Serial Priority Matcher, tie-breaks      │
│  ├── allocationService.js   : Execution coordinator, publication cycle │
│  └── reportService.js       : Aggregate analytics, CSV exporter        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Reads / Writes
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   PERSISTENCE LAYER (storageService.js)                │
│                                                                        │
│  - localStorage key: "LNMIIT_EAS_PROTOTYPE_DATA_V1"                    │
│  - Canonical Baseline: src/data/seedData.js                            │
│  - Entities: Users, StudentProfiles, Electives, Windows,              │
│              PreferenceLists, AllocationRules, Results, AuditEvents    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Responsibilities & Module Mapping

| Architecture Component | Code File | Primary Responsibilities |
|---|---|---|
| **Authentication & Authorization** | `src/services/authService.js` | Manages demo session identity, role checks, quick demo persona switching, student profile resolution. |
| **Course Management** | `src/services/electiveService.js` | Elective catalogue queries, capacity calculation, creation, editing, positive capacity verification, deletion checks. |
| **Preference Management** | `src/services/preferenceService.js` | Ranked preference draft storage, rank reordering, validation invocation, timestamped submissions, reopen modification. |
| **Business Validation Service** | `src/services/validationService.js` | Centralized validation rules: duplicate prevention, window status checks, positive capacity, capacity reduction guard, precondition readiness check. |
| **Allocation Engine** | `src/services/allocationEngine.js` | Isolated, deterministic algorithm executing the Serial Priority Matching model; generates execution trace logs, enforce capacities, outputs outcomes. |
| **Allocation Administration** | `src/services/allocationService.js` | Readiness checks, tie-break policy configuration, engine execution coordination, official publication, result resetting. |
| **Reporting & Export** | `src/services/reportService.js` | KPI summaries, rank satisfaction distribution, course-wise seat occupancy, student rosters, CSV download generation. |
| **Persistence & Audit** | `src/services/storageService.js` | Local storage abstraction with Node/browser fallbacks, factory seed restoration, immutable audit logging. |

---

## 3. Concrete Service Interfaces

| Service Method | Inputs | Output | Purpose |
|---|---|---|---|
| `authService.login(email)` | `email: string` | `{ success: boolean, user: User }` | Authenticates demo persona. |
| `electiveService.getAllElectives()` | none | `Array<Elective & { allocatedCount, availableSeats }>` | Returns catalogue with live vacancy derivations. |
| `electiveService.createElective(data, role, name)` | `data: Object, role: string, name: string` | `{ success: boolean, elective?: Elective, errors?: string[] }` | Validates and creates a course. |
| `electiveService.updateElective(id, data, role, name)` | `id: string, data: Object, ...` | `{ success: boolean, elective?: Elective, errors?: string[] }` | Validates and updates course (blocks reducing capacity below allocations). |
| `preferenceService.saveDraft(studentId, cycleId, items)` | `studentId, cycleId, items` | `{ success: boolean, preferenceList }` | Persists unsubmitted draft choices. |
| `preferenceService.submitPreferences(student, cycleId, items)` | `student, cycleId, items` | `{ success: boolean, submittedAt, errors?: string[] }` | Validates and formally submits preferences (UC-005). |
| `allocationService.checkReadiness(cycleId)` | `cycleId: string` | `{ isReady: boolean, checks: Array<{ label, passed, message }> }` | Evaluates the 4 allocation preconditions. |
| `allocationService.executeAllocation(role, name)` | `role: string, name: string` | `{ success: boolean, results, courseStats, summary, executionLogs }` | Executes deterministic engine (UC-011). |
| `allocationService.publishResults(role, name)` | `role: string, name: string` | `{ success: boolean }` | Releases draft results to student portals. |
| `allocationService.getStudentResult(studentId)` | `studentId: string` | `{ isAvailable: boolean, result?: AllocationResult }` | Strictly exposes only the calling student's result. |
| `storageService.resetToSeedData(actor)` | `actor: string` | `SeedData` | Restores default canonical demo dataset. |

---

## 4. Key Data Flows

### 4.1 Preference Submission Flow (UC-005)
1. `StudentDashboard` / `PreferenceBuilder` retrieves eligible courses via `electiveService.getElectivesForStudent()`.
2. Student prepares ordered preferences using `Move Up` / `Move Down` controls.
3. Draft changes are auto-saved to `preferenceService.saveDraft()`.
4. Student initiates submission $\rightarrow$ `PreferenceBuilder` triggers review dialog.
5. On confirmation, `preferenceService.submitPreferences()` invokes `validationService.validatePreferences()`:
   - Verifies active window deadline.
   - Verifies minimum preference count ($\ge 3$) and maximum ($\le 5$).
   - Verifies no duplicates exist.
   - Verifies course active status, branch applicability, semester applicability, and minimum CGPA.
6. If valid: updates status to `SUBMITTED`, records ISO timestamp, logs audit event, and updates student dashboard.

### 4.2 Allocation Engine Flow (UC-011)
1. Academic Administrator accesses `AllocationAdmin`.
2. `allocationService.checkReadiness()` verifies all 4 preconditions.
3. Administrator reviews the displayed deterministic tie-break policy (default: `CGPA_MERIT`).
4. Administrator confirms execution in modal dialog.
5. `allocationEngine.runAllocationEngine()` executes:
   - Queues submitted preference lists.
   - Sorts students deterministically (CGPA $\downarrow \rightarrow$ Submission Timestamp $\uparrow \rightarrow$ Student Roll No $\uparrow$).
   - Iterates through preferences $1\dots N$ checking branch, semester, minimum CGPA, and live course capacity ($< \text{capacity}$).
   - Assigns student or marks unallocated.
6. Results stored with status `COMPLETED` (draft review mode).
7. Administrator reviews outcomes and clicks "Publish Official Results", transitioning status to `PUBLISHED`.
8. Student portals update immediately to reveal allocated elective and reasons.

---

## 5. Allocation Algorithm Contract & Tie-Breaking

The allocation algorithm implemented in `src/services/allocationEngine.js` guarantees:
1. **Capacity Invariant:** For every course $c$, $\text{allocatedCount}(c) \le \text{capacity}(c)$.
2. **Eligibility Invariant:** No student is allocated to a course for which they do not meet branch, semester, or CGPA requirements.
3. **Strict Preference Ordering:** Choice $\#k$ is considered if and only if Choice $\#(k-1)$ was full or ineligible.
4. **Single Course Bound:** Each student receives at most one course, or is marked `UNALLOCATED`.
5. **Deterministic Reproducibility:** Repeated runs with the same input data produce mathematically identical assignments.

### Prototype Tie-Break Policy vs SRS Ambiguity
The SRS specifies that allocation rules and tie-breaking must be transparent and approved, but does not dictate a single mandatory formula. For the prototype, we implement the **Merit Serial Priority Matching Model** (CGPA descending with FCFS secondary tie-break), which is the standard model in Indian technical institutes (e.g. LNMIIT, IITs).

---

## 6. Persistence & Security Boundaries

- **Prototype Persistence:** Handled in `src/services/storageService.js` via browser `localStorage` under `LNMIIT_EAS_PROTOTYPE_DATA_V1`. In Node/Vitest environments, an in-memory storage fallback is used.
- **Security Boundaries:** Client-side role checking is implemented in `validationService.js` and `authService.js`. Documentation explicitly notes that demo authentication is for evaluation and does not replace production server-side OAuth2/SSO with role-based access control (RBAC).
