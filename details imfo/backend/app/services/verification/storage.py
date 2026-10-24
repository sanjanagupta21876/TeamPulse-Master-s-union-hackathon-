import threading
from typing import Dict, List, Optional
from datetime import datetime, timezone

from app.schemas.verification import VerificationRecord


class VerificationStorage:
    """
    In-memory thread-safe store for verification job records.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._records: Dict[str, VerificationRecord] = {}
        self._by_fix: Dict[str, List[str]] = {}

    def save_verification(self, record: VerificationRecord) -> VerificationRecord:
        with self._lock:
            self._records[record.verification_id] = record
            if record.fix_id not in self._by_fix:
                self._by_fix[record.fix_id] = []
            if record.verification_id not in self._by_fix[record.fix_id]:
                self._by_fix[record.fix_id].insert(0, record.verification_id)
            return record

    def get_verification(self, verification_id: str) -> Optional[VerificationRecord]:
        with self._lock:
            return self._records.get(verification_id)

    def list_for_fix(self, fix_id: str) -> List[VerificationRecord]:
        with self._lock:
            v_ids = self._by_fix.get(fix_id, [])
            return [self._records[vid] for vid in v_ids if vid in self._records]

    def cancel_verification(self, verification_id: str) -> Optional[VerificationRecord]:
        with self._lock:
            record = self._records.get(verification_id)
            if not record:
                return None
            if record.status in ("queued", "running"):
                record.status = "cancelled"
                record.completed_at = datetime.now(timezone.utc).isoformat()
            return record

    def clear(self) -> None:
        with self._lock:
            self._records.clear()
            self._by_fix.clear()


verification_storage = VerificationStorage()
