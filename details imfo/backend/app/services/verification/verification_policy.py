import os
from typing import List, Tuple


class VerificationPolicy:
    """
    Defines security boundaries, resource limits, and execution policies
    for isolated patch verification and test execution.
    """

    STATIC_CHECKS_TIMEOUT_SECONDS: int = 15
    TESTS_TIMEOUT_SECONDS: int = 30
    MAX_LOG_OUTPUT_BYTES: int = 65536  # 64 KB

    @classmethod
    def is_container_isolation_available(cls) -> bool:
        """
        Determines whether a secure, isolated container execution environment
        (e.g., non-root Docker or gVisor sandbox without host mounts) is available.
        By default on the standard host, container isolation is not assumed available.
        """
        # Can be explicitly enabled via environment variable if an isolated runner daemon is attached
        return os.getenv("CODELENS_CONTAINER_SANDBOX_ENABLED", "false").lower() in ("true", "1")

    @classmethod
    def validate_test_execution_request(cls, run_tests: bool) -> Tuple[bool, List[str]]:
        """
        Validates whether test execution is permitted under the current environment.
        Returns: (is_permitted: bool, policy_limitations: List[str])
        """
        limitations: List[str] = []

        if not run_tests:
            return False, ["Test execution was not requested."]

        if not cls.is_container_isolation_available():
            limitations.append(
                "Automated test execution on the host server is disabled for security. "
                "Untrusted repository code must run only within an isolated container sandbox."
            )
            return False, limitations

        return True, []
