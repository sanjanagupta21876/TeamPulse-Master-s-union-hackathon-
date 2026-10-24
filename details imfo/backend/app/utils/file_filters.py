import os
import re
from typing import Optional, Tuple

# Directory names that must be skipped entirely
EXCLUDED_DIRECTORIES = {
    ".git",
    "node_modules",
    ".venv",
    "venv",
    "env",
    "__pycache__",
    "pycache",
    ".pycache",
    "dist",
    "build",
    "out",
    "coverage",
    ".next",
    ".nuxt",
    ".svelte-kit",
    "vendor",
    ".turbo",
    ".cache",
    ".pytest_cache",
    ".mypy_cache",
    ".idea",
    ".vscode",
    "target",  # Rust / Java build target
    "bin",
    "obj",
}

# Binary and non-source extensions that should not be retrieved as text
BINARY_EXTENSIONS = {
    # Images & Media
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".bmp", ".tiff",
    ".mp3", ".mp4", ".mov", ".avi", ".wav", ".flac", ".ogg",
    # Documents & Fonts
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".woff", ".woff2", ".ttf", ".eot", ".otf",
    # Archives & Packages
    ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar", ".xz",
    # Executables & Binaries
    ".exe", ".dll", ".so", ".dylib", ".wasm", ".bin", ".iso", ".dmg",
    ".pyc", ".pyo", ".class", ".jar", ".war", ".ear",
    # Database files
    ".sqlite", ".sqlite3", ".db", ".mdb",
}

# Secret-bearing files and extensions that MUST NEVER be retrieved
SECRET_PATTERNS = [
    re.compile(r"^\.env(\..+)?$", re.IGNORECASE),  # .env, .env.local, .env.production
    re.compile(r"^id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$", re.IGNORECASE),
    re.compile(r".*\.(pem|key|pkcs12|pfx|p12|keystore|jks)$", re.IGNORECASE),
    re.compile(r"^credentials(\..+)?\.json$", re.IGNORECASE),
    re.compile(r"^secrets?(\..+)?\.(ya?ml|json|toml)$", re.IGNORECASE),
    re.compile(r".*\.service_account\.json$", re.IGNORECASE),
]

# Safe environment templates that can be inspected
SAFE_ENV_TEMPLATES = {
    ".env.example",
    ".env.sample",
    ".env.template",
    ".env.dist",
}

# Extensions considered relevant source / configuration code
SUPPORTED_SOURCE_EXTENSIONS = {
    # JavaScript / TypeScript / Web
    ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".vue", ".svelte",
    ".html", ".htm", ".css", ".scss", ".sass", ".less",
    # Python
    ".py", ".pyi",
    # Systems & Compiled
    ".go", ".rs", ".java", ".c", ".cpp", ".cc", ".cxx", ".h", ".hpp", ".cs",
    # Dynamic Scripting
    ".php", ".rb", ".sh", ".bash", ".zsh", ".ps1",
    # Data & Database
    ".sql", ".prisma", ".graphql", ".gql",
    # Configuration & Manifests
    ".json", ".yaml", ".yml", ".toml", ".xml", ".ini", ".cfg",
    # Documentation & Markdown
    ".md", ".mdx", ".txt", ".rst",
}

# Specific filenames that are configuration/manifests without standard source extensions
SUPPORTED_CONFIG_FILENAMES = {
    "dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
    "makefile",
    "procfile",
    "gemfile",
    "vagrantfile",
    "cmakelists.txt",
}

# Default scanning resource limits
DEFAULT_MAX_CANDIDATE_FILES = 2000
DEFAULT_MAX_FILE_SIZE_BYTES = 200 * 1024  # 200 KB
DEFAULT_MAX_TOTAL_BYTES = 10 * 1024 * 1024  # 10 MB
DEFAULT_MAX_CONCURRENCY = 5
DEFAULT_REQUEST_TIMEOUT = 15.0


def is_safe_path(path: str) -> bool:
    """Verifies that a relative file path is safe and does not attempt directory traversal."""
    if not path or not isinstance(path, str):
        return False
    # Reject path traversal, absolute paths, and null bytes
    if ".." in path or path.startswith("/") or path.startswith("\\") or "\x00" in path:
        return False
    # Check if normalized path tries to climb out
    norm = os.path.normpath(path)
    if norm.startswith("..") or os.path.isabs(norm):
        return False
    return True


def is_secret_file(filename: str, path: str) -> bool:
    """
    Checks if a file appears to contain private keys, tokens, or environment secrets.
    Permits safe sample templates (.env.example, .env.sample).
    """
    lower_filename = filename.lower()

    # Explicit whitelist for safe template files
    if lower_filename in SAFE_ENV_TEMPLATES:
        return False

    for pattern in SECRET_PATTERNS:
        if pattern.match(filename) or pattern.match(lower_filename):
            return True

    return False


def should_skip_file(
    path: str,
    file_size: Optional[int] = None,
    max_file_size_bytes: int = DEFAULT_MAX_FILE_SIZE_BYTES,
) -> Tuple[bool, Optional[str]]:
    """
    Evaluates whether a Git tree entry should be retrieved or skipped.
    Returns (should_skip, reason).
    """
    if not is_safe_path(path):
        return True, "unsafe_path_traversal"

    # Normalize path segments using forward slashes
    clean_path = path.replace("\\", "/").strip("/")
    parts = clean_path.split("/")
    filename = parts[-1]
    name_lower = filename.lower()

    # 1. Directory Exclusion check
    for part in parts[:-1]:
        if part in EXCLUDED_DIRECTORIES or part.lower() in EXCLUDED_DIRECTORIES:
            return True, f"excluded_directory:{part}"

    # 2. Secret-bearing file check
    if is_secret_file(filename, clean_path):
        return True, "secret_bearing_file"

    # 3. File extension extraction
    _, ext = os.path.splitext(name_lower)

    # 4. Binary check
    if ext in BINARY_EXTENSIONS:
        return True, f"binary_file:{ext}"

    # 5. Lockfile content skip check (large generated lockfiles)
    if name_lower in ("package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock", "cargo.lock"):
        # We acknowledge lockfiles exist for package detection, but skip downloading huge content
        return True, "generated_lockfile"

    # 6. File size check if known from Git tree API
    if file_size is not None and file_size > max_file_size_bytes:
        return True, f"exceeds_size_limit:{file_size}_bytes"

    # 7. Check if extension or filename is a supported source or config
    if (
        ext not in SUPPORTED_SOURCE_EXTENSIONS
        and name_lower not in SUPPORTED_CONFIG_FILENAMES
        and name_lower not in SAFE_ENV_TEMPLATES
    ):
        return True, f"unsupported_extension:{ext or 'no_ext'}"

    return False, None


def classify_file(path: str) -> str:
    """
    Categorizes a repository file based on its extension, directory structure, and filename.
    Returns one of: 'frontend', 'backend', 'test', 'database', 'configuration', 'documentation', 'other'.
    """
    clean_path = path.replace("\\", "/").strip("/")
    parts = clean_path.split("/")
    filename = parts[-1]
    name_lower = filename.lower()
    _, ext = os.path.splitext(name_lower)
    dir_parts = [p.lower() for p in parts[:-1]]

    # 1. Tests
    test_dirs = {"test", "tests", "__tests__", "spec", "specs", "e2e", "cypress"}
    if any(p in test_dirs for p in dir_parts):
        return "test"
    if (
        name_lower.startswith("test_")
        or name_lower.endswith("_test.py")
        or name_lower.endswith(".test.js")
        or name_lower.endswith(".test.ts")
        or name_lower.endswith(".test.jsx")
        or name_lower.endswith(".test.tsx")
        or name_lower.endswith(".spec.js")
        or name_lower.endswith(".spec.ts")
        or name_lower.endswith(".spec.jsx")
        or name_lower.endswith(".spec.tsx")
    ):
        return "test"

    # 2. Database & Migrations
    db_dirs = {"migrations", "migration", "seeds", "seeders", "schemas", "sql"}
    if ext in (".sql", ".prisma", ".graphql", ".gql") or any(p in db_dirs for p in dir_parts):
        return "database"

    # 3. Documentation
    doc_dirs = {"docs", "doc", "documentation", "guide", "guides"}
    doc_prefixes = ("readme", "license", "contributing", "changelog", "authors", "code_of_conduct")
    if ext in (".md", ".mdx", ".rst", ".txt") or any(p in doc_dirs for p in dir_parts):
        return "documentation"
    if any(name_lower.startswith(prefix) for prefix in doc_prefixes):
        return "documentation"

    # 4. Configuration & Manifests
    config_exts = {".json", ".yaml", ".yml", ".toml", ".xml", ".ini", ".cfg", ".conf", ".properties"}
    if ext in config_exts or name_lower in SUPPORTED_CONFIG_FILENAMES:
        return "configuration"
    if name_lower.startswith(".env") or name_lower in (
        ".gitignore", ".dockerignore", ".editorconfig", ".eslintrc", ".prettierrc",
        "babel.config.js", "webpack.config.js", "vite.config.ts", "vite.config.js",
        "tailwind.config.js", "tailwind.config.ts", "tsconfig.json"
    ):
        return "configuration"

    # 5. Frontend UI & Styles
    frontend_exts = {".jsx", ".tsx", ".vue", ".svelte", ".html", ".htm", ".css", ".scss", ".sass", ".less"}
    if ext in frontend_exts:
        return "frontend"
    frontend_dirs = {"frontend", "client", "web", "ui", "components", "pages", "views", "styles", "assets", "public"}
    if any(p in frontend_dirs for p in dir_parts):
        return "frontend"

    # 6. Backend Source
    backend_exts = {
        ".py", ".pyi", ".go", ".rs", ".java", ".c", ".cpp", ".cc", ".cxx", ".h", ".hpp",
        ".cs", ".php", ".rb", ".sh", ".bash", ".zsh", ".ps1",
    }
    if ext in backend_exts:
        return "backend"
    backend_dirs = {"backend", "server", "api", "routes", "controllers", "services", "models", "handlers", "middleware", "core", "app"}
    if any(p in backend_dirs for p in dir_parts):
        return "backend"

    # 7. JavaScript / TypeScript files that haven't matched above
    if ext in (".js", ".ts", ".mjs", ".cjs"):
        return "frontend" if not any(p in {"server", "backend", "api"} for p in dir_parts) else "backend"

    return "other"

