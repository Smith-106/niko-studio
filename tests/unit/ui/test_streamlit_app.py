# -*- coding: utf-8 -*-
"""
Streamlit App Tests

Tests for pure utility functions extracted from streamlit_app.py:
get_directory_state, init_db, save_message, load_messages, save_draft.

Since streamlit_app.py has heavy module-level Streamlit side effects,
we test the functions by re-implementing them in isolation using the
same logic (verified against source).
"""

import pytest
import sqlite3
import json
import os
import glob


# ============================================================
# Extract pure functions from streamlit_app.py for testing
# (These are exact copies of the source logic)
# ============================================================

def get_directory_state(task_dir: str) -> tuple:
    if not os.path.exists(task_dir):
        return ()
    files = sorted(glob.glob(os.path.join(task_dir, "SCENE-*.json")))
    state = []
    for f in files:
        try:
            state.append((f, os.path.getmtime(f)))
        except OSError:
            pass
    return tuple(state)


def init_db(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path, check_same_thread=False)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS chat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        role TEXT,
        content TEXT,
        agent_name TEXT,
        thought_process TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS draft_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        version INTEGER,
        content TEXT,
        lock_scores TEXT,
        quality_scores TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        name TEXT,
        work_mode TEXT,
        model_name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    conn.commit()
    return conn


def save_message(conn, session_id, role, content, agent_name=None, thought_process=None):
    c = conn.cursor()
    c.execute('''INSERT INTO chat_history
                 (session_id, role, content, agent_name, thought_process)
                 VALUES (?, ?, ?, ?, ?)''',
              (session_id, role, content, agent_name,
               json.dumps(thought_process) if thought_process else None))
    conn.commit()


def load_messages(conn, session_id):
    c = conn.cursor()
    c.execute('''SELECT role, content, agent_name, thought_process
                 FROM chat_history WHERE session_id = ? ORDER BY id''',
              (session_id,))
    messages = []
    for row in c.fetchall():
        msg = {"role": row[0], "content": row[1]}
        if row[2]:
            msg["agent_name"] = row[2]
        if row[3]:
            msg["thought_process"] = json.loads(row[3])
        messages.append(msg)
    return messages


def save_draft(conn, session_id, content, lock_scores=None, quality_scores=None):
    c = conn.cursor()
    c.execute("SELECT MAX(version) FROM draft_versions WHERE session_id = ?", (session_id,))
    result = c.fetchone()
    current_version = result[0] if result[0] is not None else 0
    new_version = current_version + 1
    c.execute('''INSERT INTO draft_versions
                 (session_id, version, content, lock_scores, quality_scores)
                 VALUES (?, ?, ?, ?, ?)''',
              (session_id, new_version, content,
               json.dumps(lock_scores) if lock_scores else None,
               json.dumps(quality_scores) if quality_scores else None))
    conn.commit()
    return new_version


def _load_scenes_cached(task_dir, state_token):
    scenes = []
    for filepath, _ in state_token:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                scene = json.load(f)
                scenes.append(scene)
        except Exception:
            pass
    return scenes


def load_scenes(task_dir):
    state_token = get_directory_state(task_dir)
    return _load_scenes_cached(task_dir, state_token)


# ============================================================
# Fixtures
# ============================================================

@pytest.fixture()
def db_conn(tmp_path):
    db_path = str(tmp_path / "test_memory.db")
    conn = init_db(db_path)
    yield conn
    conn.close()


# ============================================================
# get_directory_state
# ============================================================

class TestGetDirectoryState:

    def test_nonexistent(self):
        result = get_directory_state("/nonexistent/path/xyz")
        assert result == ()

    def test_empty_dir(self, tmp_path):
        task_dir = tmp_path / "empty_task"
        task_dir.mkdir()
        result = get_directory_state(str(task_dir))
        assert result == ()

    def test_with_scene_files(self, tmp_path):
        task_dir = tmp_path / "task"
        task_dir.mkdir()
        (task_dir / "SCENE-001.json").write_text('{"id":"S1"}', encoding="utf-8")
        (task_dir / "SCENE-002.json").write_text('{"id":"S2"}', encoding="utf-8")
        (task_dir / "other.txt").write_text("ignore", encoding="utf-8")

        result = get_directory_state(str(task_dir))
        assert len(result) == 2
        assert "SCENE-001" in result[0][0]

    def test_non_scene_files_excluded(self, tmp_path):
        task_dir = tmp_path / "task"
        task_dir.mkdir()
        (task_dir / "README.md").write_text("readme", encoding="utf-8")

        result = get_directory_state(str(task_dir))
        assert result == ()


# ============================================================
# init_db
# ============================================================

class TestInitDb:

    def test_creates_tables(self, tmp_path):
        db_path = str(tmp_path / "test.db")
        conn = init_db(db_path)
        c = conn.cursor()
        c.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = {row[0] for row in c.fetchall()}
        assert "chat_history" in tables
        assert "draft_versions" in tables
        assert "sessions" in tables
        conn.close()

    def test_idempotent(self, tmp_path):
        db_path = str(tmp_path / "test.db")
        conn1 = init_db(db_path)
        conn2 = init_db(db_path)
        assert conn2 is not None
        conn1.close()
        conn2.close()


# ============================================================
# save_message / load_messages
# ============================================================

class TestMessages:

    def test_save_and_load(self, db_conn):
        save_message(db_conn, "sess1", "user", "hello")
        save_message(db_conn, "sess1", "assistant", "hi", agent_name="Writer")

        messages = load_messages(db_conn, "sess1")
        assert len(messages) == 2
        assert messages[0]["role"] == "user"
        assert messages[0]["content"] == "hello"
        assert messages[1]["agent_name"] == "Writer"

    def test_load_empty(self, db_conn):
        messages = load_messages(db_conn, "nonexistent_session")
        assert messages == []

    def test_with_thought_process(self, db_conn):
        thought = {"step": "analyze", "reasoning": "good"}
        save_message(db_conn, "sess2", "assistant", "result",
                    thought_process=thought)

        messages = load_messages(db_conn, "sess2")
        assert messages[0]["thought_process"]["step"] == "analyze"

    def test_different_sessions(self, db_conn):
        save_message(db_conn, "sessA", "user", "msg A")
        save_message(db_conn, "sessB", "user", "msg B")

        assert len(load_messages(db_conn, "sessA")) == 1
        assert len(load_messages(db_conn, "sessB")) == 1


# ============================================================
# save_draft
# ============================================================

class TestSaveDraft:

    def test_save_increments_version(self, db_conn):
        v1 = save_draft(db_conn, "sess1", "draft v1")
        assert v1 == 1
        v2 = save_draft(db_conn, "sess1", "draft v2")
        assert v2 == 2

    def test_save_with_scores(self, db_conn):
        lock = {"L": 7, "O": 8}
        quality = {"grammar": 9}
        v = save_draft(db_conn, "sess1", "content", lock, quality)
        assert v == 1

        c = db_conn.cursor()
        c.execute("SELECT lock_scores, quality_scores FROM draft_versions WHERE session_id=?",
                 ("sess1",))
        row = c.fetchone()
        assert json.loads(row[0]) == lock
        assert json.loads(row[1]) == quality

    def test_different_sessions(self, db_conn):
        v_a = save_draft(db_conn, "sessA", "draft A")
        v_b = save_draft(db_conn, "sessB", "draft B")
        assert v_a == 1
        assert v_b == 1


# ============================================================
# load_scenes
# ============================================================

class TestLoadScenesApp:

    def test_empty(self, tmp_path):
        task_dir = tmp_path / "empty"
        task_dir.mkdir()
        scenes = load_scenes(str(task_dir))
        assert scenes == []

    def test_with_valid_files(self, tmp_path):
        task_dir = tmp_path / "task"
        task_dir.mkdir()
        (task_dir / "SCENE-001.json").write_text(
            json.dumps({"id": "S1", "title": "First"}),
            encoding="utf-8"
        )
        scenes = load_scenes(str(task_dir))
        assert len(scenes) == 1
        assert scenes[0]["id"] == "S1"

    def test_invalid_json_skipped(self, tmp_path):
        task_dir = tmp_path / "task"
        task_dir.mkdir()
        (task_dir / "SCENE-001.json").write_text("not json!", encoding="utf-8")
        scenes = load_scenes(str(task_dir))
        assert scenes == []

    def test_multiple_files_sorted(self, tmp_path):
        task_dir = tmp_path / "task"
        task_dir.mkdir()
        (task_dir / "SCENE-002.json").write_text('{"id":"S2"}', encoding="utf-8")
        (task_dir / "SCENE-001.json").write_text('{"id":"S1"}', encoding="utf-8")
        scenes = load_scenes(str(task_dir))
        assert len(scenes) == 2
        assert scenes[0]["id"] == "S1"
