#!/usr/bin/env python3
"""Import into v1 database using birch engine.

This script must be run in a subprocess with the actual real_ladybug package,
not the kuzu alias used in the main codebase.
"""

import sys
import json
import traceback


def main():
    """Import database from export directory into v1 database."""
    try:
        if len(sys.argv) < 3:
            raise ValueError("Usage: import_v1.py <new_db_path> <export_dir>")

        new_db_path = sys.argv[1]
        export_dir = sys.argv[2]

        # Import actual real_ladybug (not the kuzu alias)
        import real_ladybug as lb
        import numpy as np

        # Create new database
        db = lb.Database(new_db_path)
        conn = lb.Connection(db)

        # Load required extensions
        conn.execute("INSTALL vector; LOAD vector;")
        conn.execute("INSTALL FTS; LOAD FTS;")
        conn.execute("INSTALL ALGO; LOAD ALGO;")

        # Import database from export directory
        conn.execute(f"IMPORT DATABASE '{export_dir}'")

        # Verify vector index works with a test query
        query_vector = np.zeros(384).tolist()
        try:
            result = conn.execute(
                """
                CALL QUERY_VECTOR_INDEX(
                    'Memory',
                    'memory_embedding_idx_new',
                    $query_vector,
                    $limit,
                    efs := 500
                )
                RETURN node.title
                ORDER BY distance;
                """,
                {"query_vector": query_vector, "limit": 1},
            )
            # Query executed successfully - vector index is working
            verified = True
        except Exception as verify_error:
            # Vector index query failed
            verified = False
            verification_error = str(verify_error)

        # Success - print JSON result to stdout
        result_data = {
            "success": True,
            "verified": verified,
            "new_db_path": new_db_path,
            "export_dir": export_dir,
        }

        if not verified:
            result_data["verification_error"] = verification_error
            result_data["error_code"] = "UPGRADE_VERIFY_FAILED"

        print(json.dumps(result_data))
        return 0 if verified else 1

    except Exception as e:
        # Error - print JSON error report to stdout
        error_report = {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__,
            "traceback": traceback.format_exc(),
            "error_code": "UPGRADE_IMPORT_FAILED",
        }
        print(json.dumps(error_report))
        return 1


if __name__ == "__main__":
    sys.exit(main())
