import threading
from typing import Dict, List, Optional

from app.schemas.publishing import PublishBranchResponse, PullRequestRecord


class PublishingStorage:
    """
    In-memory thread-safe store for GitHub branch publishing records and pull requests.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._publishes: Dict[str, PublishBranchResponse] = {}
        self._publishes_by_fix: Dict[str, str] = {}
        self._prs: Dict[str, PullRequestRecord] = {}
        self._prs_by_fix: Dict[str, str] = {}
        self._prs_by_repo: Dict[str, List[str]] = {}

    def save_publish_record(self, record: PublishBranchResponse) -> PublishBranchResponse:
        with self._lock:
            self._publishes[record.publish_id] = record
            self._publishes_by_fix[record.fix_id] = record.publish_id
            return record

    def get_publish_record(self, publish_id: str) -> Optional[PublishBranchResponse]:
        with self._lock:
            return self._publishes.get(publish_id)

    def get_publish_for_fix(self, fix_id: str) -> Optional[PublishBranchResponse]:
        with self._lock:
            pub_id = self._publishes_by_fix.get(fix_id)
            if pub_id:
                return self._publishes.get(pub_id)
            return None

    def save_pull_request(self, record: PullRequestRecord) -> PullRequestRecord:
        with self._lock:
            self._prs[record.pull_request_id] = record
            self._prs_by_fix[record.fix_id] = record.pull_request_id
            repo_key = record.repository.lower()
            if repo_key not in self._prs_by_repo:
                self._prs_by_repo[repo_key] = []
            if record.pull_request_id not in self._prs_by_repo[repo_key]:
                self._prs_by_repo[repo_key].insert(0, record.pull_request_id)
            return record

    def get_pull_request(self, pr_id: str) -> Optional[PullRequestRecord]:
        with self._lock:
            return self._prs.get(pr_id)

    def get_pull_request_for_fix(self, fix_id: str) -> Optional[PullRequestRecord]:
        with self._lock:
            pr_id = self._prs_by_fix.get(fix_id)
            if pr_id:
                return self._prs.get(pr_id)
            return None

    def list_pull_requests_for_repo(self, repo: str) -> List[PullRequestRecord]:
        with self._lock:
            repo_key = repo.lower()
            pr_ids = self._prs_by_repo.get(repo_key, [])
            return [self._prs[pid] for pid in pr_ids if pid in self._prs]

    def clear(self) -> None:
        with self._lock:
            self._publishes.clear()
            self._publishes_by_fix.clear()
            self._prs.clear()
            self._prs_by_fix.clear()
            self._prs_by_repo.clear()


publishing_storage = PublishingStorage()
