# TeamPulse: Detect. Diagnose. Recover.

TeamPulse has two parts in one React + FastAPI app:

1. **Team room (Mission Control / Ship Intelligence)**: a shared room for a student project team. An AI-assisted recovery agent finds what is blocking the project, recommends a fix for the Captain to approve, checks at the next update whether it worked, and picks a different action if it didn't. See [Mission Control](#mission-control-ship-intelligence).
2. **Code checks**: analyzes public GitHub repositories for bugs and security issues, explains likely root causes, proposes code fixes, verifies them in a throwaway workspace, and can open a pull request.

Everything the app shows is real data from the backend. The only simulated parts are the demo crew's follow-up updates in the team room, and those are labeled "Simulated".

**Code checks pipeline:** inspect repo → analyze (AST rules, Ruff, Bandit, secret scanner, optional ESLint) → diagnose root cause → propose fix → approve → verify in isolated workspace → publish branch / pull request. Monitoring can rerun the analysis automatically on GitHub pushes via webhooks.

---

## Quick Start

You need two terminals: one for the backend (port `8000`) and one for the frontend (port `5173`).

### Prerequisites

| Tool | Version | Check with |
|------|---------|------------|
| Python | 3.10 or newer | `python3 --version` (Windows: `python --version`) |
| Node.js | 18 or newer (20+ recommended) | `node --version` |
| npm | comes with Node.js | `npm --version` |
| git | any recent version | `git --version` |

An internet connection is required: the backend downloads repository files from the GitHub API.

> **Note:** the project folder is named `details imfo` (with a space). Always wrap paths in quotes, e.g. `cd "details imfo"`.

### 1. Clone the repository

```bash
git clone <repository-url> TeamPulse
cd "TeamPulse/details imfo"
```

### 2. Start the backend (terminal 1)

**macOS / Linux:**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # optional, see "Configuration" below
uvicorn app.main:app --reload --port 8000
```

**Windows (PowerShell):**

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1  # if blocked: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
pip install -r requirements.txt
Copy-Item .env.example .env   # optional, see "Configuration" below
uvicorn app.main:app --reload --port 8000
```

Check that it is running: open <http://localhost:8000/api/health>. It should return `{"status":"ok","service":"TeamPulse API"}`. Interactive API docs are at <http://localhost:8000/docs>.

> Run `uvicorn` from inside the `backend/` folder. Running it from anywhere else fails with `ModuleNotFoundError: No module named 'app'`.

### 3. Start the frontend (terminal 2)

From the `details imfo` folder (the one containing `package.json`):

```bash
npm install
npm run dev
```

Open the URL Vite prints, normally <http://localhost:5173>. If port 5173 is taken, Vite picks 5174 or 5175; those are already allowed by the backend's CORS settings.

The frontend calls `http://localhost:8000` by default. To point it elsewhere, copy `.env.example` to `.env` in the same folder and change `VITE_API_BASE_URL`, then restart `npm run dev`.

### 4. Try it

The app opens on the **Team room** with a demo project loaded. To present it, follow [Giving the demo](#giving-the-demo); the presenter guide in the corner of the screen tells you the next click.

To try Code checks instead:

1. Go to **Repositories** → **Check a repository**.
2. Paste a public repo URL, e.g. `https://github.com/pallets/itsdangerous`, and click **Run code checks**.
3. On the repository page, click **Diagnose findings**. Open a finding and use **Propose a fix**, **Approve fix** and **Verify in a clean copy**. With `GITHUB_TOKEN` set, a verified fix can be pushed to a branch and opened as a draft pull request.

Or from the command line:

```bash
curl -X POST http://localhost:8000/api/repositories/analyze \
  -H "Content-Type: application/json" \
  -d '{"repository_url": "https://github.com/pallets/itsdangerous"}'
```

---

## Giving the demo

The demo shows one full recovery loop in the **Team room**: Ship Intelligence spots the blocker, asks privately, diagnoses it, recommends an action, checks whether it worked, and adapts when it didn't. It takes about 90 seconds and fits the pitch's demo slot (2:15 to 3:45).

### The scenario

"Campus Events App" is 36 hours from its deadline. **Backend API** (owned by Orion) has been marked blocked and silent for 20 hours. Frontend (Vega), End-to-End Testing (Lyra) and Deploy (Nova) are all waiting on it. Crew members are shown by call sign only.

All times are relative to when the demo was loaded, so it always looks current. **Reset demo** reloads the scenario at any time.

### Before you present (10 minutes before)

**Servers**
- [ ] Backend running: `cd backend`, activate the venv, `uvicorn app.main:app --port 8000`. <http://localhost:8000/api/health> returns `{"status":"ok", ...}`.
- [ ] Frontend running: `npm run dev` in the `details imfo` folder; the app opens at <http://localhost:5173>. If Vite picked another port (5174/5175 are fine), make sure it's listed in `FRONTEND_ORIGINS`.
- [ ] The bottom of the sidebar says **Backend connected**.
- [ ] Keep the backend terminal open so you can restart it quickly, but don't screen-share it.

**AI mode**
- [ ] The line next to the **Ship Intelligence** heading says **Rule-based mode (no AI key)** or **AI-assisted**.
- [ ] **If the venue Wi-Fi is unreliable, run without `OPENAI_API_KEY`** (remove it from `backend/.env` and restart the backend). With a key set but no internet, **Diagnose and recommend** can hang for 90 seconds or more before falling back to rules. Rule-based mode gives the same demo, fully offline.
- [ ] If you keep the key, click **Diagnose and recommend** once during the dry run to confirm it answers within a few seconds.

**Dry run**
- [ ] Click **Reset demo**, run the whole demo once, then click **Reset demo** again. Do the final reset shortly before you present so the clock reads **36 hours left**.
- [ ] Starting state: **36 hours left**, **High risk**, red **Emergency mode** banner, Backend API circled in red, and the Ship Intelligence panel showing **Send Orion a private check-in**.

**Screen**
- [ ] Browser window at least 1280px wide, or zoom to 90%, so all five missions fit on the whiteboard.
- [ ] Close unrelated tabs, mute notifications, and hide the bookmarks bar.
- [ ] Decide on the **presenter guide** (the dark box in the bottom corner, "1 of 7"). It tells you the next click and a line to say, and makes that button glow. Press `G` to show or hide it. Keep it on for rehearsal; on the projector, keep it if it helps you or hide it for a cleaner screen. It remembers your choice in this browser.

### Run-sheet (about 90 seconds)

Click only the button the step names. The presenter guide shows the same steps and lines.

| Step | Click | What appears on screen | What to say |
|---|---|---|---|
| Open | Nothing yet. Point at the whiteboard. | High risk, Emergency mode, Backend API circled in red, three missions "Waiting on Backend API" | "Thirty-six hours before the deadline. A task board would show four unfinished cards. Here you can see why: Backend API is blocked, and Frontend, Testing and Deploy are all waiting on it." |
| 1 | **Send Orion a private check-in**, then **Send check-in** | A private check-in dialog, then Orion's view | "Backend API has been quiet and 3 missions are waiting on it. Instead of another reminder, we ask what's stopping it." |
| 2 | **Send answer** (the answer is pre-filled) | Orion's answer is quoted in the Ship Intelligence panel | "On Orion's side it's a short private answer. No blame, no scores." |
| 3 | **Diagnose and recommend** | Likely root cause *API contract / requirements not finalized*, the evidence, and the recommended action | "It combines the signals with Orion's answer and names the likely root cause, with the evidence." |
| 4 | **Approve as Captain** (on *Agree a minimal API contract; Frontend continues on mock data*) | The step track moves to **Verify** | "It recommends one specific action. Nothing happens until the Captain approves." |
| 5 | **Still blocked** | Verification fails; a new action appears: *Pairing session on the blocker*, attempt 2 | "This follow-up update is simulated for the demo. Now it checks whether the action actually worked." |
| 6 | **Approve as Captain** | The step track moves back to **Verify** | "The first action didn't work, so it adapts. A different action, never the same reminder twice." |
| 7 | **Blocker resolved** | **Recovered**, risk drops to **Low risk**, Emergency mode turns off, the whiteboard circle disappears | "Verified: the mission is moving again and the work behind it is unblocked." |
| Close | Nothing | | "Don't just track the deadline. Recover before it." |

**Where to point**
- **Whiteboard** ("Who's waiting on whom"): the hidden dependency, made visible. The red circle is the blocker.
- **Step track** under the Ship Intelligence heading: where you are in Detect, Diagnose, Intervene, Verify, Adapt.
- **Room activity** on the right: the conversation between the crew, you as Captain, and Ship Intelligence. Simulated updates carry a **Simulated** tag; point at it in step 5.
- **Draft message** in the recommendation: Ship Intelligence drafts a respectful message, but the Captain sends it. Nothing is sent automatically.

### Say it honestly

- Say **"likely root cause"**, never "the cause".
- Say **"the Captain approves"**. The agent recommends; it never acts on its own.
- In step 5, say clearly that **the follow-up updates are simulated** for the demo.
- Lead with the **verify-and-adapt loop**; that's the innovation.
- Don't claim it's tested at scale or with real teams yet, and don't claim other tools have no dependency tracking.

What is real and what is simulated:

| Real | Simulated (labeled in the UI) |
|------|-------------------------------|
| Risk detection, dependency analysis, root-bottleneck selection, diagnosis, playbook choice, Captain approval, verification and adaptation logic, timeline, SQLite storage | The **follow-up updates** from crew members in steps 5 and 7 (the **Still blocked** and **Blocker resolved** buttons). Also: the demo project is seeded data, the check-in answer is typed by the presenter on the crew member's behalf, and drafted messages are not actually sent |

Without `OPENAI_API_KEY`, diagnosis is rule-based (shown as "Rule-based" in the UI); with it, the LLM classifies the check-in answer and writes the explanation, and the app falls back to rules if the LLM call fails.

### Questions you'll likely get

| Question | Answer |
|---|---|
| What if the AI is wrong? | Detection is deterministic rules, not AI. The diagnosis is shown as a *likely* cause with its evidence and the person's own answer, the Captain approves every action, and the next update verifies whether it worked. A wrong guess gets caught and replaced. |
| Is it reading people's private data? | It uses only mission status, deadlines, dependencies, updates and a private check-in answer. Crew members appear by call sign, alerts are about missions, not people, and there are no scores or rankings. Only the Captain sees check-in answers. |
| What is actually built? | The detection rules, dependency analysis, diagnosis, recommendations, approval, verification and adaptation all run for real and are saved in SQLite. The crew's follow-up updates are simulated in the demo, and the demo project is seeded data. |
| Does it need an AI key? | No. Without one it runs on rules (shown as "Rule-based mode"). With one, an LLM reads the check-in answer and writes the explanation, and the app falls back to rules if the LLM fails. |
| Does it message students automatically? | No. It drafts a message for the Captain to review and send. |
| What happens when nothing works? | After the planned actions for a cause are used up, it stops guessing and asks the Captain to decide: cut scope, change owners, or renegotiate the deadline. |
| How is it different from a task manager? | Task managers track status and can track dependencies. TeamPulse diagnoses why a blocker exists, recommends a matching fix, checks whether it worked, and changes course if it didn't. |
| What's next? | Pull mission updates straight from GitHub and team chat instead of typing them, and pilot with real student teams. (Code-level checks on GitHub repositories already work; see **Code checks** in the sidebar.) |

### If something goes wrong

| What you see | What to do |
|---|---|
| "The team room can't reach the backend", or **Backend not reachable** in the sidebar | The backend stopped or is on another port. Start it and click **Try again**. |
| You clicked the wrong button | Keep going. The presenter guide works out the next step from what's on screen. To start over, click **Reset demo**. |
| **Diagnose and recommend** keeps spinning | The OpenAI key is set but there's no internet. Wait for the fallback, or next time run without the key. |
| The screen shows something unexpected after a reset | Stop the backend, delete `backend/teampulse.db`, and start it again. The demo project is recreated automatically. |

### Showing Code checks (optional, only if asked)

Code checks analyze a real GitHub repository, so they need internet. Don't do a live check during the pitch: a large repository can take a minute.

1. Before you present, go to **Repositories** → **Check a repository**, paste `https://github.com/pallets/itsdangerous`, and click **Run code checks**. Then click **Diagnose findings**.
2. During Q&A, open the repository page to show the findings and likely root causes, then open a finding.
3. Results stay saved in the browser, but the backend forgets scans when it restarts. If you restarted the backend after step 1, click **Run checks again** before using **Propose a fix**.
4. Without an OpenAI key, most findings only get a TODO-comment "fix", and **Verify** honestly reports that it didn't resolve the finding. Use an AI key if you want to show a fix that verifies.

### After the demo

Click **Reset demo** so the next person starts from the beginning.

---

## Mission Control (Ship Intelligence)

Task boards show *what* is unfinished, not *why*. Ship Intelligence targets four gaps: **late detection, hidden dependencies, no clear recovery plan, and no follow-up.** It runs a five-step loop:

| Step | What it does | How |
|------|--------------|-----|
| **Detect** | Notices risk signals in tasks, deadlines, dependencies and updates | Deterministic rules: blocked, overdue, deadline at risk (work left > time left), stale (no update for 12h), upstream blocked, waiting on a dependency, workload exceeding time left. Emergency Mode turns on when the deadline is under 48h and a mission is at HIGH risk |
| **Diagnose** | Finds the likely bottleneck and its downstream impact | The dependency graph picks the **root bottleneck** (the at-risk mission whose own dependencies are done and that blocks the most work). The likely cause comes from its signals and the crew member's **private check-in** answer, using keyword rules or the LLM if `OPENAI_API_KEY` is set |
| **Intervene** | Suggests a practical recovery action for the Captain to review | A playbook of actions per cause (e.g. unclear API contract → agree a minimal contract while Frontend uses mock data). Each action has steps, a drafted message and a success check. **Nothing happens until the Captain approves** |
| **Verify** | Checks the next update for evidence the blocker is gone | Resolved when the mission is no longer blocked and progress moved at least 10 points (or it's done) |
| **Adapt** | If the problem persists, chooses another action | Proposes the next action **not yet tried** for that mission (never the same one twice). When the playbook runs out, it escalates: "Captain decision needed" |

**Privacy and tone:** crew members are shown by call sign only (Orion, Vega, …), alerts are about missions, not people, and there are no scores or rankings. Check-in answers are private to the Captain, and messages are drafted for the Captain to send, never sent automatically.

For how to present it, see [Giving the demo](#giving-the-demo).

### Mission Control API

All under `/api/team`:

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/projects` | List projects |
| `GET` | `/projects/{id}/mission-control` | Everything the page shows: risk, missions + signals, root bottleneck, loop stage, active action, history, timeline |
| `POST` | `/projects/{id}/analyze` | Detect → Diagnose → propose an action (409 if one is already in progress) |
| `POST` | `/interventions/{id}/approve` · `/reject` | Captain decision (reject proposes the next action) |
| `POST` | `/missions/{id}/checkins` | Send a private check-in |
| `POST` | `/checkins/{id}/answer` | Answer a check-in |
| `POST` | `/missions/{id}/updates` | Post a real update (`text`, `progress`, `status`); triggers Verify |
| `POST` | `/missions/{id}/simulate-update` | Demo: `{"outcome": "resolved" \| "still_blocked"}` |
| `POST` | `/demo/reset` | Reload the demo scenario |

---

## Configuration

Everything works without configuration, with reduced capability. The backend reads `backend/.env`; the frontend reads `.env` in the `details imfo` folder.

| Variable | File | Default | What it does |
|----------|------|---------|--------------|
| `VITE_API_BASE_URL` | `.env` | `http://localhost:8000` | Backend URL used by the frontend |
| `FRONTEND_ORIGINS` | `backend/.env` | localhost ports 5173–5175, 3000 | Comma-separated origins allowed by CORS. Add yours if the frontend runs elsewhere |
| `GITHUB_TOKEN` | `backend/.env` | not set | Raises the GitHub API rate limit from 60 to 5,000 requests/hour, and is **required** for publishing branches and pull requests (needs `repo` scope) |
| `OPENAI_API_KEY` | `backend/.env` | not set | Enables AI diagnosis and AI-generated fixes. Without it, the backend uses rule-based templates, which only fix a few patterns automatically (bare `except:`, `shell=True`, `innerHTML`, `==` in JS). For other findings it inserts a TODO comment, and verification correctly reports that fix as **failed** |
| `OPENAI_MODEL` | `backend/.env` | `gpt-4o-mini` | OpenAI model to use |
| `GITHUB_WEBHOOK_SECRET` | `backend/.env` | a built-in development value | Secret used to verify GitHub webhook signatures. **Set your own random value** before exposing the backend publicly; the built-in default is public in this repository |
| `WEBHOOK_MAX_CONCURRENCY` / `WEBHOOK_JOB_RETRY_LIMIT` | `backend/.env` | `5` / `3` | Monitoring job limits |
| `TEAMPULSE_DB_PATH` | `backend/.env` | `backend/teampulse.db` | SQLite file for Mission Control. Created and seeded with the demo project automatically |

Restart the backend after editing `backend/.env`.

**Optional JavaScript analysis:** install ESLint globally (`npm install -g eslint`) to add ESLint findings for JS/TS repositories. If it is missing, the analyzer is skipped and a warning is recorded. Ruff and Bandit are installed by `requirements.txt`.

---

## Running Tests

**Backend** (all GitHub and OpenAI calls are mocked; no accounts needed):

```bash
cd backend
source .venv/bin/activate      # Windows: .\.venv\Scripts\Activate.ps1
pytest -q
```

**Frontend** (type check + production build, then lint):

```bash
npm run build
npm run lint
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Frontend shows "backend offline" / network errors | Make sure the backend is running on port 8000 and `VITE_API_BASE_URL` matches. Restart `npm run dev` after changing `.env` |
| CORS error in the browser console | Add the frontend's exact origin (e.g. `http://localhost:5176`) to `FRONTEND_ORIGINS` in `backend/.env` and restart the backend |
| `ModuleNotFoundError: No module named 'app'` | Run `uvicorn` from inside `backend/` |
| GitHub `403` / rate limit exceeded | Set `GITHUB_TOKEN` in `backend/.env` |
| Code checks say a finding or scan wasn't found | The backend keeps scans **in memory**, so a restart (including `--reload` after code edits) forgets them, while the browser still shows the saved results. Click **Run checks again** on the repository. Team room data is saved in SQLite and survives restarts |
| The team room is in a strange state | Click **Reset demo**, or delete `backend/teampulse.db` and restart the backend |
| Publishing buttons disabled | `GITHUB_TOKEN` is missing or lacks write access to the repository |

> **No sample data:** every page shows real results. Code check results are saved in the browser (localStorage), so a different browser starts empty.

---

## Technology Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, React Router 7, Lucide icons, jsPDF (report export)
- **Backend:** Python 3.10+, FastAPI, Uvicorn, httpx, Pydantic v2, OpenAI SDK (optional)
- **Analyzers:** built-in Python AST and JS rules, secret scanner, Ruff, Bandit, ESLint (optional)
- **Testing:** pytest, pytest-asyncio, respx

## Folder Structure

```
details imfo/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app, CORS, health check, router registration
│   │   ├── routes/                 # team (team room), repositories, diagnosis, fixes, verification, publishing, monitoring
│   │   ├── schemas/                # Pydantic request/response models
│   │   ├── services/
│   │   │   ├── team/               # Mission Control: db, seed, risk_engine, dependency_graph, diagnosis, playbook, recovery_service, simulator
│   │   │   ├── github_service.py   # GitHub API client and URL validation
│   │   │   ├── repository_scanner.py
│   │   │   ├── analysis_engine.py  # Runs all analyzers over a downloaded repo
│   │   │   ├── analyzers/          # Python AST, Ruff, Bandit, JS/ESLint, secret scanner
│   │   │   ├── rules/              # Built-in Python / JS / security rules
│   │   │   ├── diagnosis/          # Root-cause and cross-layer analysis, LLM provider
│   │   │   ├── fixes/              # Patch generation, diffing, validation
│   │   │   ├── verification/       # Isolated workspace, patch apply, re-check
│   │   │   ├── publishing/         # Branch + pull request creation
│   │   │   └── monitoring/         # Webhook verification, auto re-analysis jobs
│   │   └── utils/file_filters.py   # File exclusion, secret-file detection, classification
│   ├── tests/                      # pytest suite
│   ├── .env.example
│   └── requirements.txt
├── src/
│   ├── components/                 # layout, dashboard, bugs, repositories, ui
│   ├── data/repositoryStore.ts     # code check results saved in localStorage
│   ├── pages/                      # one file per route
│   ├── services/api.ts             # typed backend API client (code checks)
│   ├── services/teamApi.ts         # typed client for the team room
│   ├── components/mission/         # team room UI: whiteboard, step track, room activity, presenter guide
│   ├── components/checks/          # code checks UI: findings list, diff view, shared helpers
│   ├── types/
│   ├── utils/pdfGenerator.ts
│   ├── App.tsx                     # routes
│   └── main.tsx
├── .env.example                    # frontend env (VITE_API_BASE_URL)
├── package.json
└── vite.config.ts
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
    "service": "TeamPulse API"
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
- **Testing via PowerShell** (macOS/Linux: see the `curl` example in [Quick Start](#4-try-it)):
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

Ruff and Bandit are installed by `backend/requirements.txt`. For JavaScript/TypeScript analysis, also install ESLint:

```bash
npm install -g eslint
```

If an external tool is not installed in the scanner environment, TeamPulse gracefully skips it and records the limitation in `analysis.warnings` without failing the remaining analyzers.

---

## Finding Classification & Lifecycle

TeamPulse strictly distinguishes between detected issues, potential hypotheses, proposed fixes, and verified fixes.

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

Because public repositories contain untrusted user code, TeamPulse enforces strict sandbox constraints:
1. **No Code Execution**: Repository scripts, build commands (`npm run build`, `make`, `setup.py`), and test suites are **never executed**.
2. **No Dependency Installation**: The backend will never invoke `npm install` or `pip install` against scanned repository packages.
3. **Isolated Ephemeral Sandbox**: When invoking tools like `Ruff` or `Bandit`, files are written to a strictly isolated temporary sandbox directory (`tempfile.mkdtemp`), scanned with a 15–20 second timeout, and wiped immediately upon scan completion.
4. **Credential & Secret Redaction**: Any high-entropy token or private key identified by the `SecurityAnalyzer` is automatically redacted (e.g., `AKIA****************`) in excerpts and API responses to prevent credential exposure.
5. **Deterministic Deduplication**: When multiple tools identify the same underlying issue (e.g. `PY-SEC-001` from the internal AST analyzer and `B602` from Bandit), findings are clustered into a single canonical report to eliminate alert fatigue.

---

## How to Test Static Bug Analysis

1. Make sure the backend is running (`uvicorn app.main:app --port 8000` in `backend/`).
2. Open `http://localhost:5173/repositories` (or whichever port `npm run dev` printed).
3. Click **Check a repository**, enter a public repository (e.g. `https://github.com/pallets/flask`), and click **Run code checks**.
4. The repository page opens with the branch, commit, number of files checked, and findings by severity. If an analyzer couldn't run, its warning is listed.
5. Open **Findings** in the sidebar to see findings from every checked repository. Filter by severity or search by title, file or rule, then open one for the code excerpt and suggested direction.

---

## Step 5: AI-Assisted Root-Cause Diagnosis & Cross-Layer Bug Correlation

Step 5 upgrades TeamPulse with deep diagnostic reasoning that bridges analyzer findings across frontend and backend boundaries.

### AI Provider Configuration & Environment Variables

Configure the following environment variables in `backend/.env`:

```env
# OpenAI Configuration for Step 5
OPENAI_API_KEY=sk-proj-your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini
```

> [!NOTE]
> **Graceful Offline / Unconfigured Fallback**: If `OPENAI_API_KEY` is not set or left as a placeholder, TeamPulse automatically falls back to deterministic static reasoning and records the limitation in the report without crashing or fabricating responses.

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
- **Verified Under Configured Checks** (`completed`): Target finding resolved with 0 regressions under executed tools.
- **Regression Warning** (`partial`): Target finding resolved, but the patch introduced new findings in the patched file.
- **Failed** (`failed`): Patch did not apply, syntax/static checks or tests failed, or the target finding is still reported after the patch.

Only findings in the patched file are compared; pre-existing issues elsewhere in the repository are not counted as regressions.

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

```bash
cd backend && pytest -v tests
```
Tests across inspection, repository scanning, AST static analysis, AI diagnosis, fix generation, isolated workspace verification, and GitHub branch/PR publishing run and pass offline without external network dependencies.

---

## Step 8: GitHub Branch Creation & Pull Request Preparation

### Objective & Architecture
Step 8 extends TeamPulse with a secure publishing lifecycle that enables developers to take explicitly approved and verified code patches, commit them to dedicated, isolated Git branches (`codelens/fix-<finding-id>-<slug>`), and prepare comprehensive GitHub Pull Requests for human review without ever modifying default or protected repository branches directly.

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
4. **No Automatic Merges**: TeamPulse never merges pull requests. Pull requests are prepared solely for human review and continuous integration validation.
5. **Pre-Publishing Eligibility Gate**: Branch publishing is blocked unless:
   - The fix proposal exists.
   - The user has explicitly approved the proposal (`status == "approved"`).
   - The patch has cleanly passed isolated verification (`patch_application_status == "applied"` and `static_checks_status == "passed"`).
   - The target branch exists on GitHub and its HEAD commit matches the analyzed source commit (divergence prevents blind overwrites).
6. **Branch Overwrite Prevention**: If an identically named branch already exists, TeamPulse either flags a conflict (409) or generates a collision-safe suffix to prevent overwriting unrelated work.

### Backend Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/github/auth-status` | Connection check returning authentication mechanism, granted scopes, and rate limits (safe, zero secrets exposed). |
| `GET` | `/api/fixes/{fix_id}/publish-eligibility` | Pre-flight validation verifying approval, isolated verification, and target branch HEAD alignment. |
| `POST` | `/api/fixes/{fix_id}/publish-branch` | Creates an isolated branch (`codelens/fix-...`) and commits the approved patch using GitHub REST APIs. |
| `GET` | `/api/fixes/{fix_id}/publish-status` | Returns the current branch and pull request tracking status for a fix proposal. |
| `POST` | `/api/fixes/{fix_id}/create-pull-request` | Opens a pull request on GitHub with structured defect diagnosis and verification outcomes. Requires `confirm_creation=True`. |
| `GET` | `/api/pull-requests/{pull_request_id}` | Retrieves details of a specific pull request tracked by TeamPulse. |
| `GET` | `/api/repositories/{owner}/{repo}/pull-requests` | Lists all pull requests created for a given repository. |

### Pull Request Description Structure
Pull requests automatically include a structured Markdown body generated by `PRDescriptionBuilder`:
- **Summary**: Defect rule ID, category, severity, and target location.
- **Root Cause Diagnosis**: Architectural and code-level root cause explanation synthesized by TeamPulse.
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
*(If no token is supplied, TeamPulse displays an unconfigured connection status and informs the developer of the setup instructions without pretending the connection succeeded).*

---

## Step 9: Live GitHub Monitoring and Automatic Code Analysis

TeamPulse provides live GitHub repository monitoring. When developers push code or update pull requests, TeamPulse securely verifies the webhook delivery, extracts changed files, triggers static analysis on the exact commit SHA, computes a findings diff (new vs resolved vs persistent), and records the result, available through the monitoring API.

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
GITHUB_WEBHOOK_SECRET=<a long random string>
```
Generate one with `python3 -c "import secrets; print(secrets.token_hex(32))"`. If unset, a built-in development value is used, which is fine locally but must not be used for a publicly reachable backend.

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
4. **Secret**: the same value as `GITHUB_WEBHOOK_SECRET`.
5. **Which events**: Select **Let me select individual events** → Check **Pushes** and **Pull requests**.
6. Click **Add webhook**. GitHub will send an initial `ping` event. TeamPulse will acknowledge it and mark the repository webhook status as **Connected**.

#### D. Run Backend & Frontend
Start both as described in [Quick Start](#quick-start).

#### E. Run Automated Tests
```bash
cd backend
pytest -v tests/test_monitoring.py
```
*(The whole backend suite runs fully mocked with zero external account dependencies.)*

#### F. Troubleshooting
- **401 Invalid Signature**: Verify the secret entered in GitHub Webhook settings exactly matches `GITHUB_WEBHOOK_SECRET`.
- **400 Missing Delivery/Event**: Ensure your webhook forwarder preserves `X-Hub-Signature-256`, `X-GitHub-Event`, and `X-GitHub-Delivery` headers.
- **Skipped Analysis Event**: Check the repository's monitored branches with `GET /api/repositories/{owner}/{repo}/monitoring`. If the push occurred on a feature branch and `analyze_all_branches` is disabled, the push is logged but not analyzed.
- **Retrying Failed Jobs**: `POST /api/analysis-jobs/{job_id}/retry` re-enqueues a failed analysis with exponential backoff.

> Monitoring has no screen in the app; use the API endpoints above (or the interactive docs at `/docs`).



