# CodeLens AI — Code Debugging & GitHub Repository Analysis Platform

CodeLens AI is an AI-powered code intelligence and repository analysis platform designed for modern software engineering teams. In Step 2, the frontend is connected to a FastAPI backend service capable of retrieving, validating, and inspecting public GitHub repositories in real time.

---

## Technology Stack

### Frontend
- **Framework**: React 19 + TypeScript
- **Bundler & Dev Server**: Vite
- **Styling**: Tailwind CSS (custom dark-mode developer design system)
- **Routing**: React Router v7
- **Icons**: Lucide React
- **HTTP Client**: Reusable Fetch-based API client with typed schemas

### Backend
- **Framework**: Python 3.10+ & FastAPI
- **ASGI Server**: Uvicorn
- **HTTP Client**: `httpx` (asynchronous HTTP with redirect support and timeouts)
- **Validation & Serialization**: Pydantic v2
- **Testing**: `pytest`, `pytest-asyncio`, `respx` (for HTTP mocking)

---

## Folder Structure

```
details imfo/
├── backend/
│   ├── .venv/                      # Python virtual environment
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI application, CORS, and health check
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   └── repositories.py     # POST /api/repositories/inspect & /scan endpoints
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── repository.py       # Pydantic models for repository metadata & errors
│   │   │   └── scan.py             # Pydantic models for scan request, discovery & response
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── github_service.py   # Async GitHub API service & URL security validator
│   │   │   └── repository_scanner.py # Repository file discovery & classification service
│   │   └── utils/
│   │       ├── __init__.py
│   │       └── file_filters.py     # Directory exclusion, secret detection & classification
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── test_inspect.py         # Pytest metadata inspection suite with respx mocks
│   │   └── test_scan.py            # Pytest repository scanner & filter suite with respx mocks
│   ├── .env.example                # Backend environment configuration template
│   ├── .gitignore                  # Python ignore rules
│   └── requirements.txt            # Python dependencies
│
├── src/
│   ├── components/
│   │   ├── bugs/                   # Diff viewer, code comparison
│   │   ├── dashboard/              # Statistics cards, health gauges, tables
│   │   ├── layout/                 # Sidebar, Topbar, DashboardLayout
│   │   ├── repositories/           # AnalyzeRepositoryModal
│   │   └── ui/                     # Button, Card, Badge, Modal, Input, Select, Toast
│   ├── data/
│   │   ├── mockBugs.ts             # Illustrative mock bug findings
│   │   ├── mockFixHistory.ts       # Mock audit trail
│   │   ├── mockRepositories.ts     # Initial demo repositories
│   │   └── repositoryStore.ts      # Merges inspected GitHub repos with localStorage
│   ├── pages/                      # Dashboard, Repositories, BugReports, Details, Settings
│   ├── services/
│   │   └── api.ts                  # Reusable frontend API client
│   ├── types/
│   │   └── index.ts                # TypeScript data interfaces
│   ├── App.tsx                     # React Router tree
│   ├── index.css                   # Tailwind directives and theme styles
│   └── main.tsx                    # React application entrypoint
├── .env.example                    # Frontend environment configuration template
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## Setup & Running Instructions (Windows PowerShell)

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)

---

### 1. Backend Setup & Startup

1. Open a PowerShell terminal and navigate to the `backend` folder:
   ```powershell
   cd "s:\details imfo\backend"
   ```

2. Create a virtual environment:
   ```powershell
   python -m venv .venv
   ```

3. Activate the virtual environment:
   ```powershell
   .\.venv\Scripts\Activate.ps1
   ```

4. Install the backend dependencies:
   ```powershell
   pip install -r requirements.txt
   ```

5. (Optional) Create a `.env` file from the example:
   ```powershell
   Copy-Item .env.example .env
   ```

6. Start the FastAPI development server:
   ```powershell
   uvicorn app.main:app --reload --port 8000
   ```
   *The backend will be available at `http://127.0.0.1:8000`. API documentation is available at `http://127.0.0.1:8000/docs`.*

---

### 2. Frontend Setup & Startup

1. Open a second PowerShell terminal in the project root:
   ```powershell
   cd "s:\details imfo"
   ```

2. Install the frontend dependencies (if not already installed):
   ```powershell
   npm install
   ```

3. (Optional) Configure environment variables:
   ```powershell
   Copy-Item .env.example .env
   ```
   *`VITE_API_BASE_URL` defaults to `http://localhost:8000`.*

4. Start the Vite development server:
   ```powershell
   npm run dev
   ```
   *The frontend will run at `http://localhost:5175/`.*

---

## Running Automated Tests

To run the backend test suite with mocked GitHub HTTP responses:

```powershell
cd "s:\details imfo\backend"
.\.venv\Scripts\pytest -v tests
```

To run the frontend production build and type checking:

```powershell
cd "s:\details imfo"
npm run build
```

---

## API Endpoints

### 1. Health Check
- **Endpoint**: `GET /api/health`
- **Description**: Verifies that the FastAPI backend service is running.
- **Response**:
  ```json
  {
    "status": "ok",
    "service": "CodeLens AI API"
  }
  ```

### 2. Inspect Repository
- **Endpoint**: `POST /api/repositories/inspect`
- **Description**: Validates a public GitHub repository URL, resolves branch commit SHA, and retrieves repository metadata.
- **Request Body**:
  ```json
  {
    "repository_url": "https://github.com/facebook/react",
    "branch": null
  }
  ```
- **Response**:
  ```json
  {
    "repository": {
      "owner": "react",
      "name": "react",
      "full_name": "react/react",
      "description": "The library for web and native user interfaces.",
      "html_url": "https://github.com/react/react",
      "default_branch": "main",
      "selected_branch": "main",
      "stars": 251735,
      "language": "JavaScript",
      "visibility": "public",
      "latest_commit_sha": "a6b912fbe77f698ad43c922f206db0d4f4ad7485"
    },
    "inspection": {
      "status": "completed",
      "source": "github_api",
      "files_analyzed": 0,
      "bugs_detected": 0,
      "message": "Repository metadata retrieved successfully. Source-code bug analysis has not been implemented yet."
    }
  }
  ```
- **Error Response**:
  ```json
  {
    "error": {
      "code": "REPOSITORY_NOT_FOUND",
      "message": "The repository could not be found or accessed. Private repository support will be added in a later step."
    }
  }
  ```

### 3. Scan Repository Files (Step 3 Backend Foundation)
- **Endpoint**: `POST /api/repositories/scan`
- **Description**: Discovers files in a public GitHub repository at a resolved commit SHA using the GitHub Git Trees API (`/repos/{owner}/{repo}/git/trees/{commit_sha}?recursive=1`). Applies configurable safeguards, filters out generated directories (`.git`, `node_modules`, `.venv`, `venv`, `pycache`, `dist`, `build`, `coverage`, `.next`, `vendor`), secrets (`.env`, `id_rsa`, `.pem`, `.key`), binary files, and files exceeding 200 KB. Preliminarily classifies files into `frontend`, `backend`, `test`, `database`, `configuration`, `documentation`, or `other`.
- **Request Body**:
  ```json
  {
    "repository_url": "https://github.com/psf/requests",
    "branch": null
  }
  ```

### 4. Analyze Repository for Bugs (Step 4 Real Bug Detection Engine)
- **Endpoint**: `POST /api/repositories/analyze`
- **Description**: Retrieves eligible source code files from the public repository using the repository scanner, executes real static analysis tools (`Ruff`, `Bandit`, `PythonAstAnalyzer`, `JavaScriptRuleAnalyzer`, `SecurityAnalyzer`, `ESLint`), normalizes findings into the platform bug schema, deterministically deduplicates overlapping tool reports, and returns structured findings with line ranges, severity, and remediation guidance.
- **Request Body**:
  ```json
  {
    "repository_url": "https://github.com/psf/requests",
    "branch": null
  }
  ```
- **Response**:
  ```json
  {
    "repository": {
      "full_name": "psf/requests",
      "branch": "main",
      "commit_sha": "9e1c2d3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d"
    },
    "analysis": {
      "status": "completed",
      "files_discovered": 120,
      "files_analyzed": 51,
      "files_skipped": 69,
      "findings_count": 4,
      "analyzers_completed": [
        "python_ast",
        "ruff",
        "bandit",
        "security_secrets"
      ],
      "analyzers_failed": [],
      "warnings": []
    },
    "summary": {
      "critical": 1,
      "high": 1,
      "medium": 2,
      "low": 0,
      "informational": 0
    },
    "findings": [
      {
        "id": "a82f3b9c1d...",
        "repository": "psf/requests",
        "branch": "main",
        "commit_sha": "9e1c2d3f4a5b...",
        "file_path": "src/requests/compat.py",
        "start_line": 42,
        "end_line": 42,
        "severity": "medium",
        "category": "reliability",
        "title": "Bare Exception Handling",
        "description": "Found bare 'except:' clause which catches system-exiting exceptions.",
        "rule_id": "PY-ERR-001",
        "analyzer": "python_ast",
        "confidence": "confirmed",
        "remediation": "Catch explicit exceptions (e.g. 'except Exception:') instead of bare except.",
        "code_excerpt": "42: except:\n43:     pass",
        "status": "open",
        "verification_status": "not_run"
      }
    ]
  }
  ```
- **Testing via PowerShell**:
  ```powershell
  # Test with curl.exe
  curl.exe -X POST "http://127.0.0.1:8000/api/repositories/analyze" `
    -H "Content-Type: application/json" `
    -d '{"repository_url": "https://github.com/psf/requests", "branch": null}'

  # Or using Invoke-RestMethod
  $body = @{ repository_url = "https://github.com/psf/requests"; branch = $null } | ConvertTo-Json
  Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/repositories/analyze" -Method POST -Body $body -ContentType "application/json"
  ```

---

## Static Analysis Engine Architecture

### Supported Programming Languages
- **Python**: (`.py`, `.pyi`)
- **JavaScript & TypeScript**: (`.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`)
- **Security & Secrets**: All candidate source and configuration files

### Supported Analyzers & Detection Tools

| Analyzer | Language | Tool Type | Execution Method | Default Status |
| :--- | :--- | :--- | :--- | :--- |
| **Python AST Analyzer** | Python | Built-in AST syntax & security rules | In-process AST inspection | Always Active |
| **Ruff Analyzer** | Python | Modern linter & code-quality engine | Controlled subprocess (`ruff check --output-format=json`) | Active (installed in venv) |
| **Bandit Analyzer** | Python | AST-based security vulnerability scanner | Controlled subprocess (`bandit -r -f json`) | Active (installed in venv) |
| **JS/TS Rule Analyzer** | JS / TS | Syntax & security deterministic rule engine | In-process deterministic regex/AST matching | Always Active |
| **ESLint Analyzer** | JS / TS | JavaScript/TypeScript linter | Controlled subprocess (`eslint -f json`) | Active if installed on PATH |
| **Security Analyzer** | Cross-Language | High-entropy secret & credential scanner | Safe regex pattern matching with token masking | Always Active |

### Installing External Analyzers

To equip the scanner environment with all supported external CLI tools:

```powershell
# In backend virtual environment:
cd "s:\details imfo\backend"
.\.venv\Scripts\pip install ruff>=0.8.0 bandit>=1.8.0

# Optional JavaScript analyzer:
npm install -g eslint
```

If an external tool is not installed in the scanner environment, CodeLens AI gracefully skips it and records the limitation in `analysis.warnings` without failing the remaining analyzers.

---

## Finding Classification & Lifecycle

CodeLens AI strictly distinguishes between detected issues, potential hypotheses, proposed fixes, and verified fixes.

### Severity Levels
- `critical`: Severe vulnerabilities such as hardcoded private keys, AWS access tokens, or direct SQL injections.
- `high`: Subprocess command execution with `shell=True`, DOM-based XSS with `innerHTML`, unhandled dynamic `eval()`.
- `medium`: Bare exception clauses, silent exception suppression (`except: pass`), insecure storage of bearer tokens.
- `low`: Deprecated syntax or minor maintainability concerns.
- `informational`: Style warnings, unused imports, or code clarity hints.

### Issue Lifecycle & State Tracking
1. **Detected Finding (`confidence: "confirmed" | "high" | "medium"`)**:
   - A static analysis tool or safe deterministic rule flagged a specific line range with verifiable evidence.
2. **Possible Issue Requiring Investigation (`confidence: "medium"`)**:
   - Heuristic patterns (e.g. potential SQL query string formatting) where human or semantic review is required.
3. **Proposed Fix (`verification_status: "proposed"`)**:
   - A prospective remediation patch suggested for the finding. Not yet proven safe.
4. **Verified Fix (`verification_status: "verified"`)**:
   - A fix that has been validated against automated test suites or sandbox verification.

---

## Security Boundaries & Untrusted Code Execution Safeguards

Because public repositories contain untrusted user code, CodeLens AI enforces strict sandbox constraints:
1. **No Code Execution**: Repository scripts, build commands (`npm run build`, `make`, `setup.py`), and test suites are **never executed**.
2. **No Dependency Installation**: The backend will never invoke `npm install` or `pip install` against scanned repository packages.
3. **Isolated Ephemeral Sandbox**: When invoking tools like `Ruff` or `Bandit`, files are written to a strictly isolated temporary sandbox directory (`tempfile.mkdtemp`), scanned with a 15–20 second timeout, and wiped immediately upon scan completion.
4. **Credential & Secret Redaction**: Any high-entropy token or private key identified by the `SecurityAnalyzer` is automatically redacted (e.g., `AKIA****************`) in excerpts and API responses to prevent credential exposure.
5. **Deterministic Deduplication**: When multiple tools identify the same underlying issue (e.g. `PY-SEC-001` from the internal AST analyzer and `B602` from Bandit), findings are clustered into a single canonical report to eliminate alert fatigue.

---

## How to Test Static Bug Analysis

1. Ensure the backend is running (`uvicorn app.main:app --port 8000` in `backend/`).
2. Open `http://localhost:5175/` in your browser.
3. Click **"+ Analyze Repository"**.
4. Enter any public repository (e.g. `https://github.com/pallets/flask` or `https://github.com/tiangolo/fastapi`).
5. Click **"Run Static Bug Analysis"**:
   - The analysis progress bar will display stages: *Retrieving eligible source files*, *Invoking static analyzers*, *Normalizing and deduplicating findings*.
   - Upon completion, view the live severity breakdown (Critical, High, Medium, Low, Informational), analyzer execution status, and warning disclaimers.
6. Click **"View Scanned Bug Reports"**:
   - The **Bug Reports** page will open, displaying the real detected findings alongside a banner showing repository commit info.
   - Use the **Source filter** ("All", "Real Scanned Findings", "Demo Data") to isolate live analysis findings from demo data.
   - Filter by **Severity**, **Category**, or **Analyzer**, and inspect exact line ranges, code excerpts, and remediation instructions in the slide-out drawer.

---

## Step 5: AI-Assisted Root-Cause Diagnosis & Cross-Layer Bug Correlation

Step 5 upgrades CodeLens AI with deep diagnostic reasoning that bridges analyzer findings across frontend and backend boundaries.

### AI Provider Configuration & Environment Variables

Configure the following environment variables in `backend/.env`:

```env
# OpenAI Configuration for Step 5
OPENAI_API_KEY=sk-proj-your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini
```

> [!NOTE]
> **Graceful Offline / Unconfigured Fallback**: If `OPENAI_API_KEY` is not set or left as a placeholder, CodeLens AI automatically falls back to deterministic static reasoning and records the limitation in the report without crashing or fabricating responses.

### Diagnosis Endpoints

#### 1. Diagnose Repository Findings
- **Endpoint**: `POST /api/repositories/{owner}/{repo}/diagnose`
- **Description**: Synthesizes selected or top analyzer findings with surrounding source code, imports, and cross-layer relationships to distinguish true root causes from downstream symptoms.
- **Request Body**:
  ```json
  {
    "scan_id": "scan_1a2b3c4d5e6f",
    "finding_ids": ["fnd_111111111111"]
  }
  ```
- **Response**: `DiagnosisReport` object with `root_causes`, `relationships`, `remediation_order`, and `limitations`.

#### 2. Cross-Layer Relationship Analysis
- **Endpoint**: `POST /api/repositories/{owner}/{repo}/diagnose/cross-layer`
- **Description**: Inspects frontend API client calls (`fetch`, `axios`, `apiClient`) and backend route definitions (`@app.get/post`, `@router.*`) to discover HTTP method mismatches (e.g. GET vs POST), missing required payload schema fields, and omitted authentication headers.
- **Request Body**:
  ```json
  {
    "scan_id": "scan_1a2b3c4d5e6f"
  }
  ```

#### 3. List Stored Diagnoses
- **Endpoint**: `GET /api/repositories/{owner}/{repo}/diagnoses`
- **Description**: Retrieves previously generated diagnostic reports for the target repository.

#### 4. Get Diagnosis by ID
- **Endpoint**: `GET /api/diagnoses/{diagnosis_id}`
- **Description**: Fetches a single diagnostic report by its unique ID.

### Structured Diagnosis Response Schema

```json
{
  "diagnosis_id": "diag_a82f3b9c1d0e",
  "repository": "psf/requests",
  "commit_sha": "9e1c2d3f4a5b...",
  "scan_id": "scan_1a2b3c4d5e6f",
  "status": "completed",
  "summary": "API contract method mismatch leads to unhandled runtime failures in authentication flow.",
  "root_causes": [
    {
      "title": "HTTP Method and Payload Inconsistency",
      "explanation": "Frontend initiates GET request with payload body, while backend route expects POST with password.",
      "confidence": "high",
      "evidence": [
        {
          "file_path": "src/api/auth.ts",
          "start_line": 15,
          "end_line": 15,
          "description": "Client endpoint invocation: line 15",
          "snippet": "15 | fetch('/api/login', { method: 'GET' });"
        }
      ],
      "related_finding_ids": ["fnd_111111111111"],
      "assumptions": ["Assumes direct client-server communication without proxy URL rewriting."],
      "recommended_actions": [
        "Align frontend client method to POST and include password field.",
        "Add contract regression tests verifying schema validation."
      ]
    }
  ],
  "relationships": [
    {
      "source_file": "src/api/auth.ts",
      "source_location": "line 15",
      "target_file": "backend/app/routes/auth.py",
      "target_location": "line 20",
      "relationship_type": "sends_request_to",
      "evidence": "HTTP Method Mismatch: Frontend invokes 'GET /api/login' whereas backend route is defined for 'POST /api/login'.",
      "confidence": "high",
      "potential_impact": "HTTP 405 Method Not Allowed error at runtime."
    }
  ],
  "remediation_order": [
    {
      "order": 1,
      "priority_label": "Investigate first",
      "title": "Resolve Cross-Layer API Contract Mismatch: src/api/auth.ts ↔ backend/app/routes/auth.py",
      "target_file": "backend/app/routes/auth.py",
      "related_finding_ids": ["fnd_111111111111"],
      "reason": "Fixing backend schemas or HTTP methods immediately resolves downstream runtime failures."
    }
  ],
  "limitations": [],
  "model": "gpt-4o-mini",
  "created_at": "2026-10-24T06:15:00Z"
}
```

### Confidence Levels
- `high`: Strongly supported by unambiguous source evidence, AST findings, and contract matching.
- `medium`: Likely root cause based on static patterns, but runtime factors (e.g. gateway rewrites or dynamic routing) may apply.
- `low`: Heuristic hypothesis with limited corroborating evidence.
- `inconclusive`: Evidence is ambiguous or insufficient to determine causality. Marked honestly without fabrication.

### Untrusted Code & Secret Redaction Boundaries
- **Passive Data Isolation**: Repository code and comments are treated strictly as passive data to analyze, preventing prompt injection instructions from executing tools or altering system rules.
- **Pre-Prompt Redaction**: All private keys, AWS tokens, GitHub PATs, and sensitive bearer tokens are redacted (e.g. `[REDACTED_AWS_KEY]`) before context strings are assembled or sent to the model.
- **Bounded Context**: Targeted extraction retrieves only surrounding line windows (max 50 lines per finding) and related schemas/routes, with a hard cap of 24,000 characters per diagnosis request.

---

## Step 6: AI-Powered Fix Suggestions & Code Diff Review

Step 6 enables developers to inspect a finding, request an AI-generated correction, validate the patch against strict safety criteria, inspect the side-by-side or unified code diff, review rationale and potential regressions, and record approval decisions.

### Backend Architecture (`backend/app/services/fixes/`)

- `fix_service.py`: Orchestrates loading findings from the scan, retrieving source code at the analyzed commit SHA, calling the patch generator, validating patches, computing diffs, and storing proposals.
- `patch_generator.py`: Constructs compact, secret-redacted prompts for the AI provider (`LLMProvider`) and includes deterministic templates for common static analysis rules (`PY-ERR-001`, `PY-SEC-001`, `JS-SEC-001`, `JS-CORR-001`) when AI credentials are not configured.
- `patch_validator.py`: Enforces security bounds:
  - Rejects path traversal and files outside the repository.
  - Verifies `sha256(original_content)` matches the exact scanned commit content.
  - Enforces 512 KB size limits.
  - Executes safe, sandboxed syntax checks (Python `ast.parse` and JavaScript/TypeScript bracket/syntax checking) without executing repository code.
- `diff_service.py`: Computes unified diffs and structured line hunks (with additions, deletions, and line offsets) via standard library `difflib`.
- `storage.py`: In-memory persistence store preserving full proposal history, timestamps, and review decisions.

### Fix Proposal API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/findings/{finding_id}/fixes` | Generates and validates a new fix proposal for a finding |
| `GET` | `/api/findings/{finding_id}/fixes` | Lists all historical proposals generated for a finding |
| `GET` | `/api/fixes/{fix_id}` | Retrieves a specific fix proposal with validation metadata |
| `GET` | `/api/fixes/{fix_id}/diff` | Retrieves the computed unified diff and hunk data |
| `POST` | `/api/fixes/{fix_id}/approve` | Records developer approval of the proposal without modifying the repo |
| `POST` | `/api/fixes/{fix_id}/reject` | Records developer rejection of the proposal |
| `POST` | `/api/fixes/{fix_id}/regenerate` | Generates a new proposal while preserving previous proposal records |

### Structured Fix Proposal Schema Example

```json
{
  "id": "fix_9a1b2c3d4e5f",
  "finding_id": "fnd_882830f5a707",
  "scan_id": "scan_436bcfd30a08",
  "repository_id": "octocat/Hello-World",
  "commit_sha": "7fd1a60b01f91b314f59955a4e4d4e80d8edf11d",
  "file_path": "backend/app/routes/auth.py",
  "status": "proposed",
  "original_sha256": "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a",
  "proposed_content": "# corrected file content...",
  "explanation": "Replaced dangerous eval() with json.loads() to eliminate arbitrary code execution vulnerability.",
  "assumptions": [
    "Input is valid JSON formatted string",
    "Preserves existing parameter schema"
  ],
  "potential_regressions": [
    "Non-JSON string inputs will now raise ValueError instead of executing arbitrary Python"
  ],
  "recommended_tests": [
    "Test authentication endpoint with malformed JSON input payload",
    "Test valid credentials deserialization"
  ],
  "validation": {
    "syntax_check": "passed",
    "patch_integrity": "valid",
    "source_hash_match": true,
    "path_traversal_safe": true,
    "within_size_limits": true,
    "details": ["Python AST parsed cleanly without syntax errors"]
  },
  "created_at": "2026-10-24T06:30:00Z",
  "updated_at": "2026-10-24T06:30:00Z",
  "approved_at": null,
  "rejected_at": null
}
```

### Safety & Isolation Guarantees

1. **Read-Only Operation**: The platform never pushes commits, modifies branches, opens pull requests, or alters working tree files on the target repository.
2. **No Repository Code Execution**: Proposed patches and syntax validations are performed statically via language parsers (`ast.parse`) without executing untrusted repository scripts or installing packages.
3. **Audit Immutability**: Regeneration creates new proposals with distinct IDs and timestamps; historical proposals remain accessible in the audit log.
4. **Approval vs. Application**: Approving a proposal records human sign-off in the audit trail (`status = "approved"`, `approved_at = timestamp`). It explicitly does not mark the fix as applied or verified by tests.
5. **Testing Without AI Credentials**: If `OPENAI_API_KEY` or `GEMINI_API_KEY` is omitted, the engine uses deterministic fallback templates matching static analysis finding rules (`PY-ERR-001`, `PY-SEC-001`, `JS-SEC-001`, `JS-CORR-001`), allowing full end-to-end test suites and offline review without third-party API dependencies.

---

## Step 7: Apply Approved Fixes in an Isolated Environment & Verification

Step 7 implements an isolated execution workflow that allows developers to take an approved fix proposal, spin up an ephemeral temporary workspace, verify that the patch matches the exact scanned commit SHA, apply the patch safely, run static and syntax analysis, evaluate comparative defect resolution and regressions, and record full verification audit records.

### Architecture (`backend/app/services/verification/`)

- `workspace_manager.py`: Creates isolated temporary directories prefixed with `codelens_verify_`. Validates and canonicalizes all file paths to prevent directory traversal (`..`) or absolute path escape outside the sandbox boundary.
- `patch_applier.py`: Verifies original file content matches `proposal.original_sha256` before writing. Writes only to the authorized target file, computes the post-patch SHA256 hash (`patch_hash`), and rejects attempts to modify unauthorized files.
- `verification_policy.py`: Enforces execution boundaries and resource limits:
  - Timeouts: 15 seconds for static checks, 30 seconds for test execution.
  - Size Limits: 1 MB max file size, 250 max files per workspace, 64 KB output buffer.
  - Host Protection Policy: Untrusted repository scripts must **never** be executed on the host application server. Automated tests require an isolated container sandbox daemon. If absent, test status is safely marked `unavailable` with documented limitations.
- `verification_runner.py`: Executes safe static analysis and syntax parsers:
  - Python: Safe `ast.parse` syntax verification.
  - JavaScript/TypeScript: Structural bracket, brace, and parenthesis balance checks.
  - Multi-language static rules: Re-runs configured project analyzers (`SecurityAnalyzer`, `PythonAstAnalyzer`, `JavaScriptRuleAnalyzer`, etc.) on the patched workspace.
- `result_comparator.py`: Compares findings on the target file before vs. after patch application:
  - `resolved_findings`: Defects present in the original scan that are no longer reported.
  - `remaining_findings`: Defects still reported after patch application.
  - `newly_introduced_findings`: New warnings or syntax errors introduced by the patch (regressions!).
  - Formulates evidence-based human-readable assessment.
- `storage.py`: Thread-safe persistence store for verification jobs and audit history.
- `verification_service.py`: High-level coordinator enforcing approval prerequisites, commit SHA validation, hash verification, workspace lifecycle, and teardown.

### Verification API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/fixes/{fix_id}/verify` | Creates and executes an isolated verification job for an approved proposal |
| `GET` | `/api/verifications/{verification_id}` | Retrieves verification job results and status by ID |
| `GET` | `/api/fixes/{fix_id}/verifications` | Lists all verification attempts for a specific fix proposal |
| `POST` | `/api/verifications/{verification_id}/cancel` | Requests cancellation of a running or queued verification job |

### Verification Status Lifecycle

The system strictly distinguishes between independent states:
- **Proposal Approved**: Developer recorded review acceptance of the proposed diff.
- **Patch Applied in Workspace**: Patch applied successfully to a temporary ephemeral sandbox.
- **Static Checks Passed**: Static analyzers and syntax parsers completed with 0 critical syntax errors or regressions.
- **Tests Not Requested / Unavailable / Passed / Failed**: Indicates whether restricted container testing ran and its exact outcome.
- **Verified Under Configured Checks**: Target finding resolved with 0 regressions under executed tools.

### Structured Verification Record Schema Example

```json
{
  "verification_id": "ver_3f8a1c9e2b0d",
  "fix_id": "fix_9a1b2c3d4e5f",
  "repository_id": "octocat/Hello-World",
  "scan_id": "scan_436bcfd30a08",
  "original_commit_sha": "7fd1a60b01f91b314f59955a4e4d4e80d8edf11d",
  "patch_hash": "a1b2c3d4e5f6...",
  "status": "completed",
  "workspace_status": "cleaned_up",
  "patch_application_status": "applied",
  "static_checks_status": "passed",
  "tests_status": "not_requested",
  "original_findings": [
    {
      "id": "fnd_882830f5a707",
      "rule_id": "PY-SEC-001",
      "title": "Arbitrary Code Execution via eval()",
      "severity": "critical"
    }
  ],
  "remaining_findings": [],
  "resolved_findings": [
    {
      "id": "fnd_882830f5a707",
      "rule_id": "PY-SEC-001",
      "title": "Arbitrary Code Execution via eval()",
      "severity": "critical"
    }
  ],
  "newly_introduced_findings": [],
  "execution_duration": 0.412,
  "warnings": [],
  "limitations": [
    "Automated test verification was not requested; runtime verification is incomplete."
  ],
  "assessment": "Potentially resolved under the checks that were run. Target finding is no longer reported. (1 finding(s) resolved in file). Automated test verification was not requested; runtime verification is incomplete.",
  "tools_executed": [
    "python_ast_syntax_parser",
    "security_rule_checker",
    "python_ast_analyzer"
  ],
  "created_at": "2026-10-24T06:40:00Z",
  "completed_at": "2026-10-24T06:40:01Z"
}
```

```powershell
$env:PYTHONPATH="backend"; & "backend/.venv/Scripts/pytest.exe" -v backend/tests
```
All 80 tests across inspection, repository scanning, AST static analysis, AI diagnosis, fix generation, isolated workspace verification, and GitHub branch/PR publishing run and pass offline without external network dependencies.

---

## Step 8: GitHub Branch Creation & Pull Request Preparation

### Objective & Architecture
Step 8 extends CodeLens AI with a secure publishing lifecycle that enables developers to take explicitly approved and verified code patches, commit them to dedicated, isolated Git branches (`codelens/fix-<finding-id>-<slug>`), and prepare comprehensive GitHub Pull Requests for human review without ever modifying default or protected repository branches directly.

```
┌────────────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐
│ Approved & Verified Fix│ ---> │ Isolated Git Branch     │ ---> │ GitHub Pull Request     │
│ - status: approved     │      │ - codelens/fix-<id>-slug│      │ - Automated Summary     │
│ - verification: passed │      │ - Never pushes to main  │      │ - Isolated Test Results │
│ - commit SHA recorded  │      │ - Clean patch commit    │      │ - Never Auto-Merged     │
└────────────────────────┘      └─────────────────────────┘      └─────────────────────────┘
```

### Security Guarantees & Credentials Handling
1. **Backend-Only Credentials**: GitHub Personal Access Tokens (PAT) and GitHub App tokens reside exclusively in the backend runtime environment (`GITHUB_TOKEN` or `GITHUB_ACCESS_TOKEN`). Tokens are never returned in API payloads, logs, error messages, or transmitted to the browser.
2. **Minimum Privileges**: Authentication requires only repository contents and pull request write scopes (`contents:write`, `pull_requests:write`).
3. **Strict Default Branch Protection**: The publishing service strictly prohibits committing directly to `main`, `master`, `develop`, or the repository's base branch.
4. **No Automatic Merges**: CodeLens AI never merges pull requests. Pull requests are prepared solely for human review and continuous integration validation.
5. **Pre-Publishing Eligibility Gate**: Branch publishing is blocked unless:
   - The fix proposal exists.
   - The user has explicitly approved the proposal (`status == "approved"`).
   - The patch has cleanly passed isolated verification (`patch_application_status == "applied"` and `static_checks_status == "passed"`).
   - The target branch exists on GitHub and its HEAD commit matches the analyzed source commit (divergence prevents blind overwrites).
6. **Branch Overwrite Prevention**: If an identically named branch already exists, CodeLens AI either flags a conflict (409) or generates a collision-safe suffix to prevent overwriting unrelated work.

### Backend Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/github/auth-status` | Connection check returning authentication mechanism, granted scopes, and rate limits (safe, zero secrets exposed). |
| `GET` | `/api/fixes/{fix_id}/publish-eligibility` | Pre-flight validation verifying approval, isolated verification, and target branch HEAD alignment. |
| `POST` | `/api/fixes/{fix_id}/publish-branch` | Creates an isolated branch (`codelens/fix-...`) and commits the approved patch using GitHub REST APIs. |
| `GET` | `/api/fixes/{fix_id}/publish-status` | Returns the current branch and pull request tracking status for a fix proposal. |
| `POST` | `/api/fixes/{fix_id}/create-pull-request` | Opens a pull request on GitHub with structured defect diagnosis and verification outcomes. Requires `confirm_creation=True`. |
| `GET` | `/api/pull-requests/{pull_request_id}` | Retrieves details of a specific pull request tracked by CodeLens AI. |
| `GET` | `/api/repositories/{owner}/{repo}/pull-requests` | Lists all pull requests created for a given repository. |

### Pull Request Description Structure
Pull requests automatically include a structured Markdown body generated by `PRDescriptionBuilder`:
- **Summary**: Defect rule ID, category, severity, and target location.
- **Root Cause Diagnosis**: Architectural and code-level root cause explanation synthesized by CodeLens AI.
- **Proposed Changes**: Exact file modified and diff statistics (`+additions / -deletions`).
- **Automated Verification Results**: Isolated sandbox outcome, static check status, test execution results, and resolved defects count.
- **Potential Regressions & Review Notes**: Side-effects and developer precautions.
- **Recommended Regression Tests**: Suggested test cases.
- **Security & Lineage References**: Base commit SHA, patch SHA-256 hash, and fix proposal tracking IDs.
- **Human Review Notice**: Explicit statement that pull requests require developer approval and will never be automatically merged.

### Configuration

Add your GitHub token to `backend/.env`:
```env
GITHUB_TOKEN=ghp_your_token_here
```
*(If no token is supplied, CodeLens AI displays an unconfigured connection status and informs the developer of the setup instructions without pretending the connection succeeded).*

---

## Step 9: Live GitHub Monitoring and Automatic Code Analysis

CodeLens AI provides live GitHub repository monitoring. When developers push code or update pull requests, CodeLens AI securely verifies the webhook delivery, extracts changed files, triggers static analysis on the exact commit SHA, computes a findings diff (new vs resolved vs persistent), and updates the dashboard in real time.

### 1. Webhook Security Architecture
- **Signature Verification**: Verifies `X-Hub-Signature-256` using constant-time HMAC-SHA256 comparison (`hmac.compare_digest`) with the shared `GITHUB_WEBHOOK_SECRET`. Payloads with invalid or missing signatures are rejected immediately with 401 Unauthorized.
- **Idempotency & Replay Protection**: Each delivery is tracked by `X-GitHub-Delivery`. Replays or duplicate deliveries are safely acknowledged without creating duplicate analysis jobs.
- **Asynchronous Execution**: Webhook responses are returned promptly (HTTP 200/202). Lengthy static analysis runs asynchronously via background jobs.
- **Branch Scope Filtering**: Pushes to unmonitored branches are safely skipped.
- **Initial & Force Pushes**: Handles initial repository pushes (`before == 0000...`), force pushes, and branch deletions (`after == 0000...`) cleanly.
- **No Arbitrary Code Execution**: No untrusted code is executed on the main server.

### 2. Findings Diff & Regression Detection
Comparing findings between the current commit and prior scan:
- **Newly Introduced (+)**: Bugs appearing in the current commit that were not in the prior scan.
- **Resolved (-)**: Bugs present in the prior scan whose file was analyzed (or full scan) and are now absent. Issues are never marked resolved merely due to omitted files in a partial scan.
- **Persistent**: Unresolved bugs that remain present across commits.

### 3. Monitoring Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/webhooks/github` | Public GitHub webhook receiver for `push`, `pull_request`, and `ping` events. Requires HMAC signature. |
| `GET` | `/api/repositories/{owner}/{repo}/monitoring` | Retrieves live monitoring settings, webhook status, and latest commit info. |
| `PATCH` | `/api/repositories/{owner}/{repo}/monitoring` | Updates monitored branches, branch scope (`analyze_all_branches`), and auto-diagnosis preferences. |
| `POST` | `/api/repositories/{owner}/{repo}/monitoring/enable` | Enables automatic live monitoring for the repository. |
| `POST` | `/api/repositories/{owner}/{repo}/monitoring/disable` | Pauses automatic live monitoring for the repository. |
| `POST` | `/api/repositories/{owner}/{repo}/analyze-latest` | Manually queues an analysis job for the latest repository commit. |
| `GET` | `/api/repositories/{owner}/{repo}/events` | Lists recent GitHub webhook events and deliveries. |
| `GET` | `/api/repositories/{owner}/{repo}/analysis-jobs` | Lists background analysis jobs with status, duration, and findings counts. |
| `GET` | `/api/analysis-jobs/{job_id}` | Retrieves full status, error logs, and findings diff for an analysis job. |
| `POST` | `/api/analysis-jobs/{job_id}/retry` | Safely re-queues a failed or stalled analysis job. |

### 4. Local Development & Testing Instructions

#### A. Configure Webhook Secret
In `backend/.env`:
```env
GITHUB_WEBHOOK_SECRET=codelens_dev_webhook_secret_key
```

#### B. Setup Local Secure Tunnel (e.g. ngrok or smee.io)
To test live webhooks from GitHub to your local machine:
```bash
# Using ngrok:
ngrok http 8000

# Or using smee.io:
smee --url https://smee.io/your-unique-channel --target http://127.0.0.1:8000/api/webhooks/github
```

#### C. Register Webhook on GitHub
1. Go to your repository on GitHub: **Settings** → **Webhooks** → **Add webhook**.
2. **Payload URL**: `https://<your-ngrok-domain>/api/webhooks/github` (or your production URL).
3. **Content type**: `application/json`.
4. **Secret**: `codelens_dev_webhook_secret_key` (matches `GITHUB_WEBHOOK_SECRET`).
5. **Which events**: Select **Let me select individual events** → Check **Pushes** and **Pull requests**.
6. Click **Add webhook**. GitHub will send an initial `ping` event. CodeLens AI will acknowledge it and mark the repository webhook status as **Connected**.

#### D. Run Backend & Frontend
```powershell
# 1. Start Backend:
$env:PYTHONPATH="backend"; & "backend\.venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# 2. Start Frontend:
npm run dev
```

#### E. Run Automated Tests
```powershell
$env:PYTHONPATH="backend"; & "backend\.venv\Scripts\pytest.exe" -v backend/tests/test_monitoring.py
```
*(All 97 unit and integration tests run fully mocked with zero external account dependencies).*

#### F. Troubleshooting
- **401 Invalid Signature**: Verify the secret entered in GitHub Webhook settings exactly matches `GITHUB_WEBHOOK_SECRET`.
- **400 Missing Delivery/Event**: Ensure your webhook forwarder preserves `X-Hub-Signature-256`, `X-GitHub-Event`, and `X-GitHub-Delivery` headers.
- **Skipped Analysis Event**: Check the repository's monitored branches in the CodeLens UI. If the push occurred on a feature branch and `analyze_all_branches` is disabled, the push is logged but not analyzed.
- **Retrying Failed Jobs**: In the repository **Live Monitoring** tab, failed jobs display a **Retry** button that re-enqueues the analysis with exponential backoff.



