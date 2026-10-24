import re
from typing import List
from app.schemas.bug_report import Finding
from app.services.rules import generate_finding_id, get_safe_code_excerpt

# Precompiled detection patterns
PRIVATE_KEY_REGEX = re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")
AWS_KEY_REGEX = re.compile(r"\b(AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b")
GITHUB_TOKEN_REGEX = re.compile(r"\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}\b")
SLACK_WEBHOOK_REGEX = re.compile(r"https://hooks\.slack\.com/services/T[0-9A-Z]{8,11}/B[0-9A-Z]{8,11}/[0-9A-Za-z]{24}")
GENERIC_SECRET_REGEX = re.compile(
    r"(?i)\b(api_key|apikey|secret_key|auth_token|client_secret)\s*[:=]\s*['\"]([a-zA-Z0-9_\-]{30,})['\"]"
)

# Known benign placeholder values to prevent false positives
BENIGN_PLACEHOLDERS = {
    "your_api_key_here", "your_secret_here", "placeholder", "changeme",
    "replace_with_actual_key", "example_key", "xxxx", "dummy_token",
    "test_key", "1234567890", "fake_token", "sample_secret",
}


def redact_secrets(text: str) -> str:
    """Redacts known token patterns and generic secrets from text excerpts."""
    redacted = PRIVATE_KEY_REGEX.sub("[REDACTED_PRIVATE_KEY]", text)
    redacted = AWS_KEY_REGEX.sub("[REDACTED_AWS_KEY]", redacted)
    redacted = GITHUB_TOKEN_REGEX.sub("[REDACTED_GITHUB_TOKEN]", redacted)
    redacted = SLACK_WEBHOOK_REGEX.sub("[REDACTED_SLACK_WEBHOOK]", redacted)
    
    def replace_generic(match):
        prefix = match.group(1)
        val = match.group(2)
        if any(p in val.lower() for p in BENIGN_PLACEHOLDERS):
            return match.group(0)
        return f'{prefix}="[REDACTED_SECRET]"'
        
    redacted = GENERIC_SECRET_REGEX.sub(replace_generic, redacted)
    return redacted


def scan_security_rules(
    file_path: str,
    content: str,
    repo: str,
    branch: str,
    commit_sha: str,
) -> List[Finding]:
    """
    Scans a source file for hardcoded credentials, private keys, and API tokens.
    Extracts exact line numbers, redacting secret material in excerpts.
    """
    findings: List[Finding] = []
    lines = content.splitlines()

    for idx, line in enumerate(lines, start=1):
        # 1. Private Key
        if PRIVATE_KEY_REGEX.search(line):
            findings.append(
                Finding(
                    id=generate_finding_id(repo, commit_sha, file_path, idx, "SEC-KEY-001"),
                    repository=repo,
                    branch=branch,
                    commit_sha=commit_sha,
                    file_path=file_path,
                    start_line=idx,
                    end_line=idx,
                    severity="critical",
                    category="security",
                    title="Hardcoded Private Key Detected",
                    description=(
                        "A private cryptographic key header was detected in source code. "
                        "Committing private keys to repository history exposes systems to unauthorized access and compromise."
                    ),
                    rule_id="SEC-KEY-001",
                    analyzer="security_scanner",
                    confidence="confirmed",
                    remediation=(
                        "Immediately revoke and rotate the exposed key. "
                        "Store cryptographic credentials in a dedicated secrets manager or environment variable."
                    ),
                    status="open",
                    verification_status="not_run",
                    code_excerpt=redact_secrets(get_safe_code_excerpt(lines, idx)),
                )
            )

        # 2. AWS Access Key
        aws_match = AWS_KEY_REGEX.search(line)
        if aws_match:
            findings.append(
                Finding(
                    id=generate_finding_id(repo, commit_sha, file_path, idx, "SEC-AWS-001"),
                    repository=repo,
                    branch=branch,
                    commit_sha=commit_sha,
                    file_path=file_path,
                    start_line=idx,
                    end_line=idx,
                    severity="critical",
                    category="security",
                    title="Hardcoded AWS Access Key ID",
                    description=(
                        "A valid pattern matching an AWS Access Key ID was detected. "
                        "Exposed AWS credentials can result in infrastructure takeover and unauthorized cloud access."
                    ),
                    rule_id="SEC-AWS-001",
                    analyzer="security_scanner",
                    confidence="confirmed",
                    remediation=(
                        "Revoke this AWS Access Key in IAM immediately. "
                        "Use AWS IAM Roles or environment variables via AWS CLI/SDK."
                    ),
                    status="open",
                    verification_status="not_run",
                    code_excerpt=redact_secrets(get_safe_code_excerpt(lines, idx)),
                )
            )

        # 3. GitHub Personal Access Token
        gh_match = GITHUB_TOKEN_REGEX.search(line)
        if gh_match:
            findings.append(
                Finding(
                    id=generate_finding_id(repo, commit_sha, file_path, idx, "SEC-GH-001"),
                    repository=repo,
                    branch=branch,
                    commit_sha=commit_sha,
                    file_path=file_path,
                    start_line=idx,
                    end_line=idx,
                    severity="critical",
                    category="security",
                    title="Hardcoded GitHub Personal Access Token",
                    description=(
                        "A GitHub personal access token was discovered in plaintext. "
                        "Anyone with this token can authenticate as the account and access repositories."
                    ),
                    rule_id="SEC-GH-001",
                    analyzer="security_scanner",
                    confidence="confirmed",
                    remediation=(
                        "Revoke this token immediately via GitHub Settings -> Developer Settings -> Personal Access Tokens. "
                        "Use repository secrets in GitHub Actions or environment variables."
                    ),
                    status="open",
                    verification_status="not_run",
                    code_excerpt=redact_secrets(get_safe_code_excerpt(lines, idx)),
                )
            )

        # 4. Slack Webhook
        slack_match = SLACK_WEBHOOK_REGEX.search(line)
        if slack_match:
            findings.append(
                Finding(
                    id=generate_finding_id(repo, commit_sha, file_path, idx, "SEC-SLACK-001"),
                    repository=repo,
                    branch=branch,
                    commit_sha=commit_sha,
                    file_path=file_path,
                    start_line=idx,
                    end_line=idx,
                    severity="high",
                    category="security",
                    title="Hardcoded Slack Incoming Webhook URL",
                    description=(
                        "An incoming Slack webhook URL was found in source code. "
                        "Exposed webhooks allow unauthorized message broadcasting to private Slack channels."
                    ),
                    rule_id="SEC-SLACK-001",
                    analyzer="security_scanner",
                    confidence="confirmed",
                    remediation="Regenerate the Slack webhook URL and configure it through an environment variable.",
                    status="open",
                    verification_status="not_run",
                    code_excerpt=redact_secrets(get_safe_code_excerpt(lines, idx)),
                )
            )

        # 5. Generic High-Entropy API Secret
        gen_match = GENERIC_SECRET_REGEX.search(line)
        if gen_match:
            val = gen_match.group(2)
            if not any(p in val.lower() for p in BENIGN_PLACEHOLDERS):
                findings.append(
                    Finding(
                        id=generate_finding_id(repo, commit_sha, file_path, idx, "SEC-GEN-001"),
                        repository=repo,
                        branch=branch,
                        commit_sha=commit_sha,
                        file_path=file_path,
                        start_line=idx,
                        end_line=idx,
                        severity="high",
                        category="security",
                        title=f"Hardcoded Credential in variable '{gen_match.group(1)}'",
                        description=(
                            f"The variable '{gen_match.group(1)}' appears to contain a hardcoded plaintext secret "
                            f"with high entropy. Hardcoding credentials in source code exposes secrets to all repository readers."
                        ),
                        rule_id="SEC-GEN-001",
                        analyzer="security_scanner",
                        confidence="high",
                        remediation="Move the secret to an environment variable or secrets manager (.env, Vault, AWS Secrets Manager).",
                        status="open",
                        verification_status="not_run",
                        code_excerpt=redact_secrets(get_safe_code_excerpt(lines, idx)),
                    )
                )

    return findings
