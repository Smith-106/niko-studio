import sqlite3
import os
import json
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any

class DraftService:
    def __init__(self, db_path: str):
        """
        Initialize the DraftService.

        Args:
            db_path: Path to the SQLite database file.
        """
        self.db_path = db_path
        self._ensure_schema()

    def _ensure_schema(self):
        """
        Ensure the draft_versions table has the required columns.
        Adds 'status' and 'approved_at' columns if they are missing.
        """
        with sqlite3.connect(self.db_path) as conn:
            # Check existing columns
            cursor = conn.execute("PRAGMA table_info(draft_versions)")
            columns = [row[1] for row in cursor.fetchall()]

            # Add columns if they don't exist
            # Note: SQLite does not support adding multiple columns in one ALTER TABLE statement in older versions,
            # so we do them one by one.
            if 'status' not in columns:
                conn.execute("ALTER TABLE draft_versions ADD COLUMN status TEXT DEFAULT 'DRAFT'")

            if 'approved_at' not in columns:
                conn.execute("ALTER TABLE draft_versions ADD COLUMN approved_at TIMESTAMP")

            conn.commit()

    def save_final_version(self, session_id: str, content: str,
                           lock_scores: Optional[Dict] = None,
                           quality_scores: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Save the final version of a draft to the database and export it to a file.

        Args:
            session_id: The session ID associated with the draft.
            content: The text content of the draft.
            lock_scores: Optional dictionary of LOCK scores.
            quality_scores: Optional dictionary of quality scores.

        Returns:
            Dict containing 'version', 'db_id', and 'file_path'.
        """
        # 1. Determine output directory and filename
        # We use a relative path from the project root (assuming CWD is project root or handle absolute paths)
        # Using absolute path based on CWD to be safe.
        output_dir = Path("output/final_drafts")
        output_dir.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        # 2. Database Operations
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()

            # Get next version number
            cursor.execute("SELECT MAX(version) FROM draft_versions WHERE session_id = ?", (session_id,))
            result = cursor.fetchone()
            current_version = result[0] if result and result[0] is not None else 0
            new_version = current_version + 1

            # Insert record
            approved_at = datetime.now().isoformat()
            cursor.execute('''INSERT INTO draft_versions
                              (session_id, version, content, lock_scores, quality_scores, status, approved_at)
                              VALUES (?, ?, ?, ?, ?, ?, ?)''',
                           (session_id, new_version, content,
                            json.dumps(lock_scores) if lock_scores else None,
                            json.dumps(quality_scores) if quality_scores else None,
                            'FINAL', approved_at))

            db_id = cursor.lastrowid
            conn.commit()

        # 3. File Export
        filename = f"{session_id}_v{new_version}_final_{timestamp}.md"
        file_path = output_dir / filename

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(f"# Final Draft - v{new_version}\n")
            f.write(f"Session ID: {session_id}\n")
            f.write(f"Date: {approved_at}\n")
            if lock_scores:
                f.write(f"LOCK Scores: {json.dumps(lock_scores, ensure_ascii=False)}\n")
            f.write("\n---\n\n")
            f.write(content)

        return {
            "version": new_version,
            "db_id": db_id,
            "file_path": str(file_path)
        }
