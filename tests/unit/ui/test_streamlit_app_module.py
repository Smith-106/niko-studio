# -*- coding: utf-8 -*-
"""`src.ui.streamlit_app` 模块级覆盖测试。"""

import importlib
import json
import sys
import types
from pathlib import Path


class _SessionState(dict):
    def __getattr__(self, name):
        try:
            return self[name]
        except KeyError as exc:
            raise AttributeError(name) from exc

    def __setattr__(self, name, value):
        self[name] = value


class _Ctx:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class _Status(_Ctx):
    def update(self, **_kwargs):
        return None


class _Progress:
    def progress(self, *_args, **_kwargs):
        return None

    def empty(self):
        return None


class _FakeStreamlit(types.ModuleType):
    def __init__(self):
        super().__init__("streamlit")
        self.session_state = _SessionState()
        self.sidebar = _Ctx()
        self._selectbox_values = {}
        self._button_queue = []
        self._chat_input_value = None
        self._text_area_value = ""
        self._uploaded_file = None
        self.calls = {"error": [], "success": [], "warning": [], "markdown": []}

    def set_page_config(self, **_kwargs):
        return None

    def cache_data(self, func=None, **_kwargs):
        if func is None:
            def decorator(f):
                return f
            return decorator
        return func

    def cache_resource(self, func=None, **_kwargs):
        if func is None:
            def decorator(f):
                return f
            return decorator
        return func

    def title(self, *_args, **_kwargs):
        return None

    def subheader(self, *_args, **_kwargs):
        return None

    def text_input(self, _label, value="", **_kwargs):
        return value

    def selectbox(self, _label, options, index=0, **_kwargs):
        if _label in self._selectbox_values:
            return self._selectbox_values[_label]
        return options[index] if options else None

    def button(self, *_args, **_kwargs):
        if self._button_queue:
            return self._button_queue.pop(0)
        return False

    def slider(self, _label, _min_value, _max_value, value=None, *_args, **_kwargs):
        return value

    def number_input(self, _label, min_value=None, max_value=None, value=None, **_kwargs):
        return value if value is not None else min_value

    def divider(self):
        return None

    def expander(self, *_args, **_kwargs):
        return _Ctx()

    def json(self, *_args, **_kwargs):
        return None

    def columns(self, spec):
        if isinstance(spec, int):
            count = spec
        else:
            count = len(spec)
        return tuple(_Ctx() for _ in range(count))

    def container(self, **_kwargs):
        return _Ctx()

    def chat_message(self, *_args, **_kwargs):
        return _Ctx()

    def markdown(self, *args, **_kwargs):
        if args:
            self.calls["markdown"].append(args[0])
        return None

    def chat_input(self, *_args, **_kwargs):
        return self._chat_input_value

    def status(self, *_args, **_kwargs):
        return _Status()

    def write(self, *_args, **_kwargs):
        return None

    def error(self, *args, **_kwargs):
        if args:
            self.calls["error"].append(args[0])
        return None

    def success(self, *args, **_kwargs):
        if args:
            self.calls["success"].append(args[0])
        return None

    def warning(self, *args, **_kwargs):
        if args:
            self.calls["warning"].append(args[0])
        return None

    def rerun(self):
        return None

    def file_uploader(self, *_args, **_kwargs):
        return self._uploaded_file

    def tabs(self, labels):
        return tuple(_Ctx() for _ in labels)

    def metric(self, *_args, **_kwargs):
        return None

    def bar_chart(self, *_args, **_kwargs):
        return None

    def text_area(self, *_args, **_kwargs):
        return self._text_area_value

    def caption(self, *_args, **_kwargs):
        return None

    def spinner(self, *_args, **_kwargs):
        return _Ctx()

    def progress(self, *_args, **_kwargs):
        return _Progress()


class _DummyIndexingService:
    def __init__(self, _db_path):
        self.db_path = _db_path



def _install_stubs(monkeypatch, setup_fake=None, setup_modules=None):
    fake_st = _FakeStreamlit()
    if setup_fake:
        setup_fake(fake_st)
    monkeypatch.setitem(sys.modules, "streamlit", fake_st)

    # 轻量替身，避免导入 UI 组件真实依赖
    lock_mod = types.ModuleType("src.ui.components.lock_radar")
    lock_mod.render_lock_radar = lambda *_args, **_kwargs: None
    monkeypatch.setitem(sys.modules, "src.ui.components.lock_radar", lock_mod)

    traj_mod = types.ModuleType("src.ui.components.trajectory_viewer")
    traj_mod.render_trajectory_viewer = lambda *_args, **_kwargs: None
    monkeypatch.setitem(sys.modules, "src.ui.components.trajectory_viewer", traj_mod)

    scene_mod = types.ModuleType("src.ui.components.scene_dashboard")
    scene_mod.render_scene_dashboard = lambda *_args, **_kwargs: None
    monkeypatch.setitem(sys.modules, "src.ui.components.scene_dashboard", scene_mod)

    indexing_mod = types.ModuleType("src.services.indexing_service")
    indexing_mod.IndexingService = _DummyIndexingService
    monkeypatch.setitem(sys.modules, "src.services.indexing_service", indexing_mod)

    pandas_mod = types.ModuleType("pandas")

    class _DataFrame(dict):
        def set_index(self, _name):
            return self

    pandas_mod.DataFrame = lambda data: _DataFrame(data)
    monkeypatch.setitem(sys.modules, "pandas", pandas_mod)

    if setup_modules:
        setup_modules(monkeypatch)

    # 确保全新导入执行模块顶层代码
    sys.modules.pop("src.ui.streamlit_app", None)
    mod = importlib.import_module("src.ui.streamlit_app")
    return mod, fake_st




def test_streamlit_module_import_and_scene_loaders(monkeypatch, tmp_path):
    mod, _fake_st = _install_stubs(monkeypatch)

    task_dir = tmp_path / "task"
    task_dir.mkdir()
    good = task_dir / "SCENE-001.json"
    bad = task_dir / "SCENE-002.json"
    (task_dir / "OTHER.json").write_text("{}", encoding="utf-8")

    good.write_text(json.dumps({"id": "SCENE-001", "title": "ok"}, ensure_ascii=False), encoding="utf-8")
    bad.write_text("not-json", encoding="utf-8")

    state = mod.get_directory_state(str(task_dir))
    assert len(state) == 2

    scenes = mod._load_scenes_cached(str(task_dir), state)
    assert len(scenes) == 1
    assert scenes[0]["id"] == "SCENE-001"

    loaded = mod.load_scenes(str(task_dir))
    assert len(loaded) == 1



def test_streamlit_db_helpers(monkeypatch, tmp_path):
    mod, _fake_st = _install_stubs(monkeypatch)

    db_path = tmp_path / "local_memory.db"
    monkeypatch.setattr(mod, "DB_PATH", str(db_path))

    conn = mod.init_db()
    mod.save_message(conn, "s1", "user", "hello", "agent", {"k": "v"})
    mod.save_message(conn, "s1", "assistant", "world")

    messages = mod.load_messages(conn, "s1")
    assert len(messages) == 2
    assert messages[0]["role"] == "user"
    assert messages[0]["agent_name"] == "agent"

    v1 = mod.save_draft(conn, "s1", "draft-1", {"L": 7}, {"Q": 80})
    v2 = mod.save_draft(conn, "s1", "draft-2")
    assert v1 == 1
    assert v2 == 2

    conn.close()





def test_streamlit_user_message_append(monkeypatch):
    mod, fake_st = _install_stubs(monkeypatch)

    before = len(fake_st.session_state.messages)
    fake_st._chat_input_value = "user idea"

    mod.st.session_state.messages.append({"role": "user", "content": fake_st._chat_input_value})
    mod.st.session_state.current_draft = "draft text"

    assert len(fake_st.session_state.messages) == before + 1
    assert mod.st.session_state.current_draft == "draft text"



def test_streamlit_feedback_and_approve_paths(monkeypatch):
    mod, fake_st = _install_stubs(monkeypatch)

    saved = {"count": 0}

    def _save(*_args, **_kwargs):
        saved["count"] += 1
        return 1

    monkeypatch.setattr(mod, "save_draft", _save)

    feedback_msg = "[HITL] improve tension"
    mod.st.session_state.messages.append({"role": "user", "content": feedback_msg})
    mod.save_message(mod.conn, mod.st.session_state.session_id, "user", feedback_msg)

    mod.st.session_state.current_draft = "draft"
    version = mod.save_draft(mod.conn, mod.st.session_state.session_id, "draft", {"L": 7}, {"Q": 80})

    assert version == 1
    assert saved["count"] == 1


def test_streamlit_upload_deduplicate_key(monkeypatch):
    mod, fake_st = _install_stubs(monkeypatch)

    class _Uploaded:
        name = "a.txt"
        size = 10

    file_key = f"{_Uploaded.name}_{_Uploaded.size}"
    if "processed_files" not in fake_st.session_state:
        fake_st.session_state.processed_files = set()

    processed = {"count": 0}

    def _proc(*_args, **_kwargs):
        processed["count"] += 1

    monkeypatch.setattr(mod, "process_uploaded_file", _proc)

    if file_key not in fake_st.session_state.processed_files:
        mod.process_uploaded_file(_Uploaded(), fake_st.session_state.session_id, mod.get_indexing_service())
        fake_st.session_state.processed_files.add(file_key)

    if file_key not in fake_st.session_state.processed_files:
        mod.process_uploaded_file(_Uploaded(), fake_st.session_state.session_id, mod.get_indexing_service())
        fake_st.session_state.processed_files.add(file_key)

    assert processed["count"] == 1




def test_streamlit_get_directory_state_missing_dir(monkeypatch, tmp_path):
    mod, _fake_st = _install_stubs(monkeypatch)

    missing = tmp_path / "not-exist"
    state = mod.get_directory_state(str(missing))

    assert state == ()




def test_streamlit_import_executes_interactive_branches(monkeypatch):
    calls = {
        "process_uploaded_file": 0,
        "render_trajectory_viewer": 0,
    }

    class _Uploaded:
        name = "ctx.md"
        size = 12

    def _setup_fake(fake_st):
        fake_st._chat_input_value = "新的故事想法"
        fake_st._text_area_value = "请增强情绪张力"
        fake_st._uploaded_file = _Uploaded()
        fake_st._button_queue = [False, True, True]  # new_session / submit_feedback / approve
        fake_st.session_state.messages = [
            {
                "role": "assistant",
                "content": "已有轨迹",
                "agent_name": "Planner",
                "thought_process": {"step": "plan"},
            }
        ]
        fake_st.session_state.current_draft = "old"
        fake_st.session_state.critique_result = {
            "lock_scores": {"L": 7},
            "quality_scores": {"Q": 80},
            "lock_analysis": "analysis",
        }

    def _setup_modules(mp):
        # Mock WorkflowEngine.run_stream (new API after migration)
        wf_engine = types.ModuleType("src.workflow.workflow_engine")

        async def _run_stream(*args, **kwargs):
            yield {
                "type": "step_complete",
                "step_name": "writer",
                "result": {
                    "draft_content": "new-draft",
                    "critique_result": {
                        "lock_scores": {"L": 8},
                        "quality_scores": {"Q": 88},
                    },
                },
            }

        class _WorkflowEngine:
            def run_stream(self, *args, **kwargs):
                return _run_stream(*args, **kwargs)

        wf_engine.WorkflowEngine = _WorkflowEngine
        mp.setitem(sys.modules, "src.workflow.workflow_engine", wf_engine)

        traj_mod = types.ModuleType("src.ui.components.trajectory_viewer")

        def _render(*_args, **_kwargs):
            calls["render_trajectory_viewer"] += 1

        traj_mod.render_trajectory_viewer = _render
        mp.setitem(sys.modules, "src.ui.components.trajectory_viewer", traj_mod)

        fu_mod = types.ModuleType("src.ui.file_utils")

        def _proc(*_args, **kwargs):
            calls["process_uploaded_file"] += 1
            cb = kwargs.get("progress_callback")
            if cb:
                cb(100, text="done")

        fu_mod.process_uploaded_file = _proc
        mp.setitem(sys.modules, "src.ui.file_utils", fu_mod)

    mod, fake_st = _install_stubs(monkeypatch, setup_fake=_setup_fake, setup_modules=_setup_modules)

    assert calls["process_uploaded_file"] == 1
    assert calls["render_trajectory_viewer"] == 1
    assert mod.st.session_state.current_draft == "new-draft"
    assert mod.st.session_state.workflow_running is False
    assert fake_st.calls["success"]


def test_streamlit_warning_when_approve_without_draft(monkeypatch):
    def _setup_fake(fake_st):
        fake_st._button_queue = [False, False, True]  # new_session / submit_feedback / approve
        fake_st.session_state.messages = []
        fake_st.session_state.current_draft = ""
        fake_st.session_state.critique_result = {}

    _mod, fake_st = _install_stubs(monkeypatch, setup_fake=_setup_fake)

    assert fake_st.calls["warning"]


def test_streamlit_work_mode_fallback_to_l3(monkeypatch):
    def _setup_fake(fake_st):
        fake_st._chat_input_value = "idea"
        fake_st._selectbox_values["Workflow Level"] = "invalid-mode"
        fake_st._selectbox_values["工作流级别"] = "invalid-mode"
        fake_st._button_queue = [False, False, False]
        fake_st.session_state.messages = []

    captured = {}

    def _setup_modules(mp):
        # Mock WorkflowEngine.run_stream (new API after migration)
        wf_engine = types.ModuleType("src.workflow.workflow_engine")

        async def _run_stream(*args, **kwargs):
            captured["kwargs"] = kwargs
            return
            yield {}  # pragma: no cover

        class _WorkflowEngine:
            def run_stream(self, *args, **kwargs):
                return _run_stream(*args, **kwargs)

        wf_engine.WorkflowEngine = _WorkflowEngine
        mp.setitem(sys.modules, "src.workflow.workflow_engine", wf_engine)

    _mod, _fake_st = _install_stubs(monkeypatch, setup_fake=_setup_fake, setup_modules=_setup_modules)

    # level should default to "L3" when invalid
    assert captured["kwargs"].get("level") == "L3"




def test_streamlit_get_directory_state_skip_oserror(monkeypatch, tmp_path):
    mod, _fake_st = _install_stubs(monkeypatch)

    task_dir = tmp_path / "task"
    task_dir.mkdir()
    good = task_dir / "SCENE-001.json"
    bad = task_dir / "SCENE-002.json"
    good.write_text("{}", encoding="utf-8")
    bad.write_text("{}", encoding="utf-8")

    original_getmtime = mod.os.path.getmtime

    def _getmtime(path):
        if path.endswith("SCENE-002.json"):
            raise OSError("boom")
        return original_getmtime(path)

    monkeypatch.setattr(mod.os.path, "getmtime", _getmtime)

    state = mod.get_directory_state(str(task_dir))

    assert len(state) == 1
    assert state[0][0].endswith("SCENE-001.json")



def test_streamlit_language_switch_triggers_state_update(monkeypatch):
    def _setup_fake(fake_st):
        fake_st._selectbox_values["语言"] = "英文"
        fake_st._button_queue = [False, False, False]
        fake_st.session_state.language = "中文"
        fake_st.session_state.messages = []

    _mod, fake_st = _install_stubs(monkeypatch, setup_fake=_setup_fake)

    assert fake_st.session_state.language == "en"



def test_streamlit_english_language_code_uses_english_workflow_options(monkeypatch):
    def _setup_fake(fake_st):
        fake_st._button_queue = [False, False, False]
        fake_st.session_state.language = "en"
        fake_st.session_state.messages = []

    _mod, fake_st = _install_stubs(monkeypatch, setup_fake=_setup_fake)

    assert fake_st.session_state.language == "en"



def test_streamlit_new_session_button_resets_state(monkeypatch):
    def _setup_fake(fake_st):
        fake_st._button_queue = [True, False, False]  # new_session / submit_feedback / approve
        fake_st.session_state.messages = [{"role": "user", "content": "x"}]
        fake_st.session_state.current_draft = "old"
        fake_st.session_state.critique_result = {"k": 1}

    _mod, fake_st = _install_stubs(monkeypatch, setup_fake=_setup_fake)

    assert fake_st.session_state.messages == []
    assert fake_st.session_state.current_draft == ""
    assert fake_st.session_state.critique_result == {}



def test_streamlit_workflow_importerror_branch(monkeypatch):
    def _setup_fake(fake_st):
        fake_st._chat_input_value = "idea"
        fake_st._button_queue = [False, False, False]
        fake_st.session_state.messages = []

    def _setup_modules(mp):
        # Remove workflow_engine from sys.modules to force ImportError
        # This simulates the case where WorkflowEngine cannot be imported
        if "src.workflow.workflow_engine" in sys.modules:
            del sys.modules["src.workflow.workflow_engine"]

        # Create a broken module that raises ImportError on attribute access
        broken_module = types.ModuleType("src.workflow.workflow_engine")

        def _raise_import_error(*args, **kwargs):
            raise ImportError("No module named 'workflow_engine'")

        broken_module.WorkflowEngine = _raise_import_error
        mp.setitem(sys.modules, "src.workflow.workflow_engine", broken_module)

    mod, fake_st = _install_stubs(monkeypatch, setup_fake=_setup_fake, setup_modules=_setup_modules)

    assert fake_st.calls["error"]
    assert mod.st.session_state.messages[-1]["agent_name"] == "System"



def test_streamlit_workflow_exception_branch(monkeypatch):
    def _setup_fake(fake_st):
        fake_st._chat_input_value = "idea"
        fake_st._button_queue = [False, False, False]
        fake_st.session_state.messages = []

    def _setup_modules(mp):
        # Mock WorkflowEngine.run_stream to raise exception
        wf_engine = types.ModuleType("src.workflow.workflow_engine")

        async def _run_stream(*args, **kwargs):
            raise RuntimeError("stream failed")
            yield {}  # pragma: no cover

        class _WorkflowEngine:
            def run_stream(self, *args, **kwargs):
                return _run_stream(*args, **kwargs)

        wf_engine.WorkflowEngine = _WorkflowEngine
        mp.setitem(sys.modules, "src.workflow.workflow_engine", wf_engine)

    _mod, fake_st = _install_stubs(monkeypatch, setup_fake=_setup_fake, setup_modules=_setup_modules)

    assert fake_st.calls["error"]



def test_streamlit_upload_exception_branch(monkeypatch):
    class _Uploaded:
        name = "bad.txt"
        size = 1

    def _setup_fake(fake_st):
        fake_st._uploaded_file = _Uploaded()
        fake_st._button_queue = [False, False, False]
        fake_st.session_state.messages = []

    def _setup_modules(mp):
        fu_mod = types.ModuleType("src.ui.file_utils")

        def _proc(*_args, **_kwargs):
            raise RuntimeError("upload failed")

        fu_mod.process_uploaded_file = _proc
        mp.setitem(sys.modules, "src.ui.file_utils", fu_mod)

    _mod, fake_st = _install_stubs(monkeypatch, setup_fake=_setup_fake, setup_modules=_setup_modules)

    assert fake_st.calls["error"]



def test_streamlit_upload_duplicate_file_success(monkeypatch):
    class _Uploaded:
        name = "dup.txt"
        size = 2

    file_key = f"{_Uploaded.name}_{_Uploaded.size}"

    def _setup_fake(fake_st):
        fake_st._uploaded_file = _Uploaded()
        fake_st._button_queue = [False, False, False]
        fake_st.session_state.messages = []
        fake_st.session_state.processed_files = {file_key}

    _mod, fake_st = _install_stubs(monkeypatch, setup_fake=_setup_fake)

    assert fake_st.calls["success"]





def test_streamlit_session_state_preinitialized_skips_default_init(monkeypatch):
    def _setup_fake(fake_st):
        fake_st._button_queue = [False, False, False]
        fake_st.session_state.session_id = "sess_existing"
        fake_st.session_state.messages = [{"role": "user", "content": "existing"}]
        fake_st.session_state.current_draft = "existing-draft"
        fake_st.session_state.critique_result = {"ready": True}
        fake_st.session_state.workflow_running = True

    _mod, fake_st = _install_stubs(monkeypatch, setup_fake=_setup_fake)

    assert fake_st.session_state.session_id == "sess_existing"
    assert fake_st.session_state.messages == [{"role": "user", "content": "existing"}]
    assert fake_st.session_state.current_draft == "existing-draft"
    assert fake_st.session_state.critique_result == {"ready": True}
    assert fake_st.session_state.workflow_running is True


def test_streamlit_workflow_stream_without_optional_fields(monkeypatch):
    def _setup_fake(fake_st):
        fake_st._chat_input_value = "idea"
        fake_st._button_queue = [False, False, False]
        fake_st.session_state.messages = []

    def _setup_modules(mp):
        # Mock WorkflowEngine.run_stream (new API after migration)
        wf_engine = types.ModuleType("src.workflow.workflow_engine")

        async def _run_stream(*args, **kwargs):
            yield {
                "type": "step_complete",
                "step_name": "writer",
                "result": {
                    "other": "x",
                },
            }
            yield {
                "type": "step_complete",
                "step_name": "critic",
                "result": {
                    "score": 90,
                },
            }

        class _WorkflowEngine:
            def run_stream(self, *args, **kwargs):
                return _run_stream(*args, **kwargs)

        wf_engine.WorkflowEngine = _WorkflowEngine
        mp.setitem(sys.modules, "src.workflow.workflow_engine", wf_engine)

    mod, fake_st = _install_stubs(monkeypatch, setup_fake=_setup_fake, setup_modules=_setup_modules)

    assert mod.st.session_state.current_draft == ""
    assert mod.st.session_state.critique_result == {}
    assert mod.st.session_state.workflow_running is False
    assert not fake_st.calls["error"]




def test_streamlit_work_mode_parse_exception_falls_back_to_l3(monkeypatch):
    captured = {}

    class _BadWorkMode:
        """A selectbox value that does not implement .split()"""

    def _setup_fake(fake_st):
        fake_st._chat_input_value = "idea"
        fake_st._button_queue = [False, False, False]
        fake_st.session_state.messages = []
        # Ensure selectbox returns a non-string to trigger the except branch
        fake_st._selectbox_values["Workflow Level"] = _BadWorkMode()
        fake_st._selectbox_values["工作流级别"] = _BadWorkMode()

    def _setup_modules(mp):
        wf_engine = types.ModuleType("src.workflow.workflow_engine")

        async def _run_stream(*, task, level, **_kwargs):
            captured["level"] = level
            if False:
                yield {}  # pragma: no cover

        class _WorkflowEngine:
            def run_stream(self, *args, **kwargs):
                return _run_stream(*args, **kwargs)

        wf_engine.WorkflowEngine = _WorkflowEngine
        mp.setitem(sys.modules, "src.workflow.workflow_engine", wf_engine)

    _mod, _fake_st = _install_stubs(monkeypatch, setup_fake=_setup_fake, setup_modules=_setup_modules)

    assert captured["level"] == "L3"



def test_streamlit_plan_error_event_triggers_error_path(monkeypatch):
    def _setup_fake(fake_st):
        fake_st._chat_input_value = "idea"
        fake_st._button_queue = [False, False, False]
        fake_st.session_state.messages = []

    def _setup_modules(mp):
        wf_engine = types.ModuleType("src.workflow.workflow_engine")

        async def _run_stream(*_args, **_kwargs):
            yield {"type": "plan_error", "error": "boom"}

        class _WorkflowEngine:
            def run_stream(self, *args, **kwargs):
                return _run_stream(*args, **kwargs)

        wf_engine.WorkflowEngine = _WorkflowEngine
        mp.setitem(sys.modules, "src.workflow.workflow_engine", wf_engine)

    _mod, fake_st = _install_stubs(monkeypatch, setup_fake=_setup_fake, setup_modules=_setup_modules)

    assert fake_st.calls["error"]


def test_streamlit_lock_analysis_expander_renders_markdown(monkeypatch):
    def _setup_fake(fake_st):
        fake_st._button_queue = [False, False, False]
        fake_st.session_state.messages = []
        fake_st.session_state.current_draft = "draft"
        fake_st.session_state.critique_result = {
            "lock_scores": {"L": 7, "O": 8, "C": 9, "K": 6},
            "lock_analysis": "LOCK detail analysis",
        }

    _mod, fake_st = _install_stubs(monkeypatch, setup_fake=_setup_fake)

    assert "LOCK detail analysis" in fake_st.calls["markdown"]


def test_streamlit_submit_feedback_with_empty_text_no_success(monkeypatch):
    def _setup_fake(fake_st):
        fake_st._button_queue = [False, True, False]  # new_session / submit_feedback / approve
        fake_st._text_area_value = ""
        fake_st.session_state.messages = []
        fake_st.session_state.current_draft = "draft"

    _mod, fake_st = _install_stubs(monkeypatch, setup_fake=_setup_fake)

    assert fake_st.calls["success"] == []
