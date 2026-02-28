#!/usr/bin/env python3
"""Export v0 database using alpine engine.

This script must be run in a subprocess with the actual kuzu 0.11.1 package,
not the real_ladybug alias used in the main codebase.
"""

import sys
import json
import traceback


def main():
    """Export v0 database to specified directory."""
    try:
        if len(sys.argv) < 3:
            raise ValueError("Usage: export_v0.py <db_path> <export_dir>")

        db_path = sys.argv[1]
        export_dir = sys.argv[2]

        # Clean export directory if it exists (from previous failed attempts)
        # IMPORTANT: Do NOT create the directory - kuzu EXPORT DATABASE creates it
        import os
        import shutil
        from pathlib import Path

        export_path = Path(export_dir)
        if export_path.exists():
            shutil.rmtree(export_path, ignore_errors=True)

        # Import actual kuzu 0.11.1 (not the real_ladybug alias)
        import kuzu

        # Open database
        db = kuzu.Database(db_path)
        conn = kuzu.Connection(db)

        # Load required extensions
        conn.execute("INSTALL vector; LOAD vector;")
        conn.execute("INSTALL FTS; LOAD FTS;")
        conn.execute("INSTALL ALGO; LOAD ALGO;")

        # Export database
        conn.execute(f"""
            EXPORT DATABASE '{export_dir}' (format="csv", header=true);
        """)

        # Success - print JSON result to stdout
        result = {
            "success": True,
            "export_path": export_dir,
            "db_path": db_path,
        }
        print(json.dumps(result))
        return 0

    except Exception as e:
        # Error - print JSON error report to stdout
        error_report = {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__,
            "traceback": traceback.format_exc(),
            "error_code": "UPGRADE_EXPORT_FAILED",
        }
        print(json.dumps(error_report))
        return 1


if __name__ == "__main__":
    sys.exit(main())
