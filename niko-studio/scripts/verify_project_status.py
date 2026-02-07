import os
import re
import ast
from pathlib import Path

# Paths
ROOT_DIR = Path(".")
TASKS_FILE = ROOT_DIR / "docs/TASKS.md"
CHECKLIST_FILE = ROOT_DIR / "FILES_CHECKLIST.md"

def check_files_checklist():
    """Checks if files in FILES_CHECKLIST.md exist."""
    print("=== Checking FILES_CHECKLIST.md ===")
    if not CHECKLIST_FILE.exists():
        print(f"Error: {CHECKLIST_FILE} not found.")
        return

    content = CHECKLIST_FILE.read_text(encoding="utf-8")
    lines = content.splitlines()
    missing_files = []
    found_files = []

    # State
    current_context = ""

    # Header regex: "### 3. 文档目录 (`docs/`)" -> group 1 is "docs/"
    header_regex = re.compile(r"#{2,}\s+.*`([^`]+)`")
    # File regex: "- ✅ `ARCHITECTURE.md`" -> group 1 is "ARCHITECTURE.md"
    file_regex = re.compile(r"-\s*.*`([^`]+)`")

    for line in lines:
        # 1. Update Context from Headers
        if line.strip().startswith("#"):
            match = header_regex.search(line)
            if match:
                current_context = match.group(1)
                # Ensure context ends with / if it's a directory
                if not current_context.endswith("/") and "." not in current_context:
                    current_context += "/"
                # print(f"DEBUG: Context switched to {current_context}")
            else:
                # Some headers might just say "Agent 模块" without path
                # Use hardcoded mapping if needed, or just reset/keep previous if reasonable
                # But looking at the file, the main sections have paths.
                # Subsections like "#### 核心设计文档" don't change context.
                pass

        # 2. Check File Lines
        file_match = file_regex.search(line)
        if file_match:
            filename = file_match.group(1)

            # Construct potential paths
            # Option A: filename is full path (e.g. src/agents/base.py)
            path_a = ROOT_DIR / filename

            # Option B: filename is relative to context
            path_b = ROOT_DIR / current_context / filename

            final_path = None

            if path_a.exists():
                final_path = path_a
            elif path_b.exists():
                final_path = path_b
            # Check for directory
            elif path_a.is_dir() or (str(path_a).endswith("/") and path_a.parent.exists()): # simplistic
                final_path = path_a
            elif path_b.is_dir() or (str(path_b).endswith("/") and path_b.parent.exists()):
                final_path = path_b

            if final_path:
                found_files.append(str(final_path))
            else:
                # One last try: maybe context was a file and we are listing unrelated stuff?
                # No, strict check.
                # Special case: "d:\工作目录..." paths in "Relevant Resources" section
                if ":" in filename or "\\" in filename:
                    # Skip Windows absolute paths
                    continue

                missing_files.append(f"{filename} (Context: {current_context})")

    print(f"Found {len(found_files)} files listed in checklist.")
    if missing_files:
        print(f"MISSING {len(missing_files)} files from checklist:")
        for f in missing_files:
            print(f"  [MISSING] {f}")
    else:
        print("All checklist files present.")
    print("")

def get_symbols_from_file(file_path):
    """Parses a python file and returns a set of defined names (classes, functions, methods)."""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            tree = ast.parse(f.read())
    except Exception as e:
        return set()

    symbols = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            symbols.add(node.name)
            for item in node.body:
                if isinstance(item, ast.FunctionDef):
                    symbols.add(item.name)
        elif isinstance(node, ast.FunctionDef):
            symbols.add(node.name)
    return symbols

def check_tasks_md():
    """Checks completed tasks in docs/TASKS.md against the codebase."""
    print("=== Checking docs/TASKS.md ===")
    if not TASKS_FILE.exists():
        print(f"Error: {TASKS_FILE} not found.")
        return

    content = TASKS_FILE.read_text(encoding="utf-8")
    lines = content.splitlines()

    current_file_context = None

    # Regex to find tasks marked as done: - [x] ...
    task_pattern = re.compile(r"-\s*\[x\]\s*(.*)")
    # Regex to find file paths: `src/...`
    file_pattern = re.compile(r"`(src/[^`]+)`")

    issues_found = 0

    for line in lines:
        file_match = file_pattern.search(line)
        if file_match:
            potential_file = file_match.group(1)
            if (ROOT_DIR / potential_file).suffix in ['.py', '.md', '.ts']:
                 current_file_context = potential_file

        task_match = task_pattern.search(line)
        if task_match:
            task_desc = task_match.group(1)
            local_file_match = file_pattern.search(task_desc)
            task_file_context = local_file_match.group(1) if local_file_match else current_file_context

            if not task_file_context:
                continue

            file_path = ROOT_DIR / task_file_context

            if not file_path.exists():
                print(f"[FAIL] Task done but file missing: {task_file_context}")
                issues_found += 1
                continue

            if file_path.suffix == ".py":
                symbol_matches = re.findall(r"`([a-zA-Z_][a-zA-Z0-9_]*)(\(\))?`", task_desc)
                if symbol_matches:
                    defined_symbols = get_symbols_from_file(file_path)
                    for sym_name, _ in symbol_matches:
                        if sym_name in str(task_file_context): continue
                        if sym_name.lower() in ["none", "true", "false", "todo"]: continue

                        if sym_name not in defined_symbols:
                             print(f"[WARN] Task marked done but symbol `{sym_name}` not found in {task_file_context}")
                             issues_found += 1

    if issues_found == 0:
        print("No obvious discrepancies found between TASKS.md [x] items and codebase.")
    else:
        print(f"Found {issues_found} potential discrepancies.")

if __name__ == "__main__":
    check_files_checklist()
    check_tasks_md()
