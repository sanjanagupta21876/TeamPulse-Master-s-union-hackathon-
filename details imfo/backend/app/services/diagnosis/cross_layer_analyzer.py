import re
from typing import Dict, List, Optional, Set, Tuple
from pydantic import BaseModel, Field

from app.schemas.bug_report import Finding
from app.schemas.diagnosis import Relationship


class ApiEndpointCall(BaseModel):
    file_path: str
    line_number: int
    method: str  # GET, POST, PUT, DELETE, etc.
    path: str  # /api/...
    payload_fields: List[str] = Field(default_factory=list)
    has_auth_header: bool = False
    raw_snippet: str


class BackendRouteDefinition(BaseModel):
    file_path: str
    line_number: int
    method: str  # GET, POST, PUT, DELETE, etc.
    path: str  # /api/...
    required_body_fields: List[str] = Field(default_factory=list)
    requires_auth: bool = False
    response_fields: List[str] = Field(default_factory=list)
    raw_snippet: str


class CrossLayerAnalyzer:
    """
    Statically analyzes frontend and backend source files to correlate API contracts,
    detect HTTP method mismatches, payload discrepancies, and missing authentication headers.
    """

    # Frontend call patterns: fetch('/api/...', { method: 'POST', body: ... })
    # axios.post('/api/...', { ... })
    FETCH_PATTERN = re.compile(
        r"""fetch\s*\(\s*['"`]([^'"`]+)['"`]\s*(?:,\s*\{([^}]*)\})?""",
        re.MULTILINE | re.DOTALL,
    )
    AXIOS_PATTERN = re.compile(
        r"""axios\s*\.\s*(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`](?:,\s*\{([^}]*)\})?""",
        re.MULTILINE | re.DOTALL,
    )
    API_CLIENT_PATTERN = re.compile(
        r"""(?:apiClient|api|http)\s*\.\s*(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`](?:,\s*\{([^}]*)\})?""",
        re.MULTILINE | re.DOTALL,
    )

    # Backend route patterns: @app.post("/api/..."), @router.get("/api/...")
    FASTAPI_ROUTE_PATTERN = re.compile(
        r"""@(app|router)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]([^)]*)\)""",
        re.MULTILINE,
    )

    def analyze_cross_layer(
        self,
        files: Dict[str, str],
        findings: Optional[List[Finding]] = None,
    ) -> List[Relationship]:
        """
        Discovers frontend API requests and backend endpoint routes, correlates them,
        and identifies mismatches in method, contract, or authentication.
        """
        frontend_calls: List[ApiEndpointCall] = []
        backend_routes: List[BackendRouteDefinition] = []

        # 1. Extract API calls and route definitions
        for path, content in files.items():
            ext = path.lower()
            if any(ext.endswith(x) for x in [".js", ".jsx", ".ts", ".tsx"]):
                frontend_calls.extend(self._extract_frontend_calls(path, content))
            elif ext.endswith(".py"):
                backend_routes.extend(self._extract_backend_routes(path, content))

        relationships: List[Relationship] = []

        # 2. Correlate frontend calls with backend routes
        for call in frontend_calls:
            matched_routes = [
                r for r in backend_routes
                if self._paths_match(call.path, r.path)
            ]

            if not matched_routes:
                # No internal backend route matched: could be external or unmapped
                if call.path.startswith("/api/"):
                    relationships.append(
                        Relationship(
                            source_file=call.file_path,
                            source_location=f"line {call.line_number}",
                            target_file=None,
                            target_location=None,
                            relationship_type="sends_request_to",
                            evidence=f"Frontend calls '{call.method} {call.path}', but no corresponding backend route was found in the repository.",
                            confidence="medium",
                            potential_impact="May return 404 Not Found if endpoint is not implemented or handled by an external gateway.",
                        )
                    )
                continue

            for route in matched_routes:
                # A. Method Mismatch Check
                if call.method.upper() != route.method.upper():
                    relationships.append(
                        Relationship(
                            source_file=call.file_path,
                            source_location=f"line {call.line_number}",
                            target_file=route.file_path,
                            target_location=f"line {route.line_number}",
                            relationship_type="sends_request_to",
                            evidence=(
                                f"HTTP Method Mismatch: Frontend invokes '{call.method.upper()} {call.path}' "
                                f"whereas backend route is defined for '{route.method.upper()} {route.path}'."
                            ),
                            confidence="high",
                            potential_impact="HTTP 405 Method Not Allowed error at runtime.",
                        )
                    )

                # B. Authentication Check
                elif route.requires_auth and not call.has_auth_header:
                    relationships.append(
                        Relationship(
                            source_file=call.file_path,
                            source_location=f"line {call.line_number}",
                            target_file=route.file_path,
                            target_location=f"line {route.line_number}",
                            relationship_type="expects_response_from",
                            evidence=(
                                f"Authentication Header Missing: Backend route '{route.method} {route.path}' requires authentication, "
                                f"but frontend call omits an Authorization header."
                            ),
                            confidence="high",
                            potential_impact="HTTP 401 Unauthorized or 403 Forbidden rejection.",
                        )
                    )

                # C. Payload Discrepancy Check
                elif (
                    route.required_body_fields
                    and call.payload_fields
                    and not set(route.required_body_fields).issubset(set(call.payload_fields))
                ):
                    missing = set(route.required_body_fields) - set(call.payload_fields)
                    relationships.append(
                        Relationship(
                            source_file=call.file_path,
                            source_location=f"line {call.line_number}",
                            target_file=route.file_path,
                            target_location=f"line {route.line_number}",
                            relationship_type="validates_with",
                            evidence=(
                                f"Request Payload Field Mismatch: Backend schema requires fields {list(missing)} "
                                f"which are missing from the frontend request payload {call.payload_fields}."
                            ),
                            confidence="high",
                            potential_impact="HTTP 422 Unprocessable Entity validation failure.",
                        )
                    )
                else:
                    # Valid correlated contract
                    relationships.append(
                        Relationship(
                            source_file=call.file_path,
                            source_location=f"line {call.line_number}",
                            target_file=route.file_path,
                            target_location=f"line {route.line_number}",
                            relationship_type="sends_request_to",
                            evidence=f"Correlated API client contract for '{call.method.upper()} {call.path}'.",
                            confidence="high",
                            potential_impact="Normal client-server communication.",
                        )
                    )

        # 3. Correlate with static findings if any
        if findings:
            for f in findings:
                # If a finding is security or reliability in a route or client
                for rel in relationships:
                    if f.file_path == rel.source_file or f.file_path == rel.target_file:
                        relationships.append(
                            Relationship(
                                source_file=f.file_path,
                                source_location=f"line {f.start_line}",
                                target_file=rel.target_file if f.file_path == rel.source_file else rel.source_file,
                                target_location=rel.target_location if f.file_path == rel.source_file else rel.source_location,
                                relationship_type="potentially_causes",
                                evidence=f"Analyzer finding '{f.rule_id}: {f.title}' is located directly in the request-handling boundary.",
                                confidence="medium",
                                potential_impact="May lead to cascading failure or unhandled exceptions across the network boundary.",
                            )
                        )
                        break

        return relationships

    def _extract_frontend_calls(self, file_path: str, content: str) -> List[ApiEndpointCall]:
        calls = []
        lines = content.splitlines()

        for idx, line in enumerate(lines, start=1):
            # Check fetch calls
            match_fetch = re.search(r"""fetch\s*\(\s*['"`]([^'"`]+)['"`]""", line)
            if match_fetch:
                path = match_fetch.group(1)
                method = "GET"
                # look ahead 5 lines for method: 'POST'
                context_block = "\n".join(lines[idx - 1 : min(len(lines), idx + 6)])
                m_method = re.search(r"""method\s*:\s*['"](POST|PUT|DELETE|PATCH|GET)['"]""", context_block, re.I)
                if m_method:
                    method = m_method.group(1).upper()
                has_auth = "authorization" in context_block.lower()
                payload_fields = self._extract_payload_keys(context_block)

                calls.append(
                    ApiEndpointCall(
                        file_path=file_path,
                        line_number=idx,
                        method=method,
                        path=path,
                        payload_fields=payload_fields,
                        has_auth_header=has_auth,
                        raw_snippet=line.strip(),
                    )
                )

            # Check axios / apiClient calls: e.g. axios.post('/api/...', { email })
            match_axios = re.search(
                r"""(?:axios|apiClient|api|http)\s*\.\s*(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]""",
                line,
                re.I,
            )
            if match_axios:
                method = match_axios.group(1).upper()
                path = match_axios.group(2)
                context_block = "\n".join(lines[idx - 1 : min(len(lines), idx + 6)])
                has_auth = "authorization" in context_block.lower()
                payload_fields = self._extract_payload_keys(context_block)

                calls.append(
                    ApiEndpointCall(
                        file_path=file_path,
                        line_number=idx,
                        method=method,
                        path=path,
                        payload_fields=payload_fields,
                        has_auth_header=has_auth,
                        raw_snippet=line.strip(),
                    )
                )

        return calls

    def _extract_backend_routes(self, file_path: str, content: str) -> List[BackendRouteDefinition]:
        routes = []
        lines = content.splitlines()

        for idx, line in enumerate(lines, start=1):
            match = self.FASTAPI_ROUTE_PATTERN.search(line)
            if match:
                method = match.group(2).upper()
                path = match.group(3)
                args = match.group(4)

                # Look ahead for function definition and arguments
                func_block = "\n".join(lines[idx - 1 : min(len(lines), idx + 10)])
                requires_auth = (
                    "Depends" in func_block and any(x in func_block for x in ["auth", "user", "token", "security"])
                )

                # Extract required schema fields if pydantic payload is referenced
                required_fields = []
                schema_match = re.search(r"""(\w+)\s*:\s*(\w+Schema|\w+Request|\w+In)\b""", func_block)
                if schema_match:
                    schema_name = schema_match.group(2)
                    required_fields = self._find_schema_fields(schema_name, content)

                routes.append(
                    BackendRouteDefinition(
                        file_path=file_path,
                        line_number=idx,
                        method=method,
                        path=path,
                        required_body_fields=required_fields,
                        requires_auth=requires_auth,
                        raw_snippet=line.strip(),
                    )
                )

        return routes

    def _extract_payload_keys(self, snippet: str) -> List[List[str]]:
        """Extracts JSON or object literal property keys from request context block."""
        keys = []
        # Look for body: JSON.stringify({ email: ... }) or { email, password }
        m = re.search(r"""(?:body\s*:\s*(?:JSON\.stringify\s*\()?)?\{\s*([^}]+)\}""", snippet)
        if m:
            block = m.group(1)
            for part in block.split(","):
                k = part.split(":")[0].strip()
                # Clean identifier
                k = re.sub(r"""['"\s]""", "", k)
                if k and re.match(r"^[a-zA-Z0-9_]+$", k) and k not in ["method", "headers", "body"]:
                    keys.append(k)
        return keys

    def _find_schema_fields(self, schema_name: str, content: str) -> List[str]:
        """Scans for class <SchemaName>(BaseModel): and extracts field names."""
        pattern = re.compile(rf"""class\s+{schema_name}\b[^:]*:\s*\n((?:\s+.*\n)+)""")
        m = pattern.search(content)
        fields = []
        if m:
            body = m.group(1)
            for line in body.splitlines():
                stripped = line.strip()
                if stripped and not stripped.startswith("#") and not stripped.startswith('"""'):
                    f_match = re.match(r"""^([a-zA-Z0-9_]+)\s*:\s*""", stripped)
                    if f_match:
                        fields.append(f_match.group(1))
        return fields

    def _paths_match(self, frontend_path: str, backend_path: str) -> bool:
        """Compares API paths accounting for variable path segments (e.g. {id} vs :id or ${id})."""
        # Normalize /api/v1/users/{id} and /api/v1/users/:id
        p1 = re.sub(r"""\$\{[^}]+\}""", "{param}", frontend_path.split("?")[0].rstrip("/"))
        p1 = re.sub(r""":([a-zA-Z0-9_]+)""", "{param}", p1)
        p1 = re.sub(r"""\{[a-zA-Z0-9_]+\}""", "{param}", p1)

        p2 = re.sub(r"""\{[a-zA-Z0-9_]+\}""", "{param}", backend_path.rstrip("/"))
        return p1 == p2
