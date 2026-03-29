# -*- coding: utf-8 -*-
"""
Level2Lite Tests

Tests for LitePlan, LitePlanResult, LiteFixResult, Level2Lite
(execute, plan_lite, lite_plan, lite_fix, lite_execute,
 helper methods, severity analysis, diagnosis, fix suggestions).
"""

import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime

from src.workflow.levels.level2_lite import (
    LitePlan,
    LitePlanResult,
    LiteFixResult,
    Level2Lite,
)
from src.workflow.base_state import BaseState


# ============================================================
# LitePlan
# ============================================================

class TestLitePlan:

    def test_defaults(self):
        p = LitePlan(objective="write", key_points=["a"])
        assert p.tone == "neutral"
        assert p.word_count_target == 1000

    def test_custom(self):
        p = LitePlan(objective="o", key_points=["x"], tone="humorous", word_count_target=500)
        assert p.tone == "humorous"
        assert p.word_count_target == 500


# ============================================================
# LitePlanResult
# ============================================================

class TestLitePlanResult:

    def test_to_dict(self):
        r = LitePlanResult(
            plan_id="p1",
            steps=[{"name": "s1"}],
            estimated_time=60,
            confidence=0.9,
            objective="obj",
            context={"k": "v"},
        )
        d = r.to_dict()
        assert d["plan_id"] == "p1"
        assert d["confidence"] == 0.9
        assert d["objective"] == "obj"
        assert "created_at" in d

    def test_from_dict_full(self):
        now = datetime.now()
        d = {
            "plan_id": "p2",
            "steps": [{"a": 1}],
            "estimated_time": 30,
            "confidence": 0.7,
            "created_at": now.isoformat(),
            "objective": "o",
            "context": {"x": 1},
        }
        r = LitePlanResult.from_dict(d)
        assert r.plan_id == "p2"
        assert r.confidence == 0.7

    def test_from_dict_minimal(self):
        r = LitePlanResult.from_dict({})
        assert r.plan_id == ""
        assert r.steps == []
        assert r.estimated_time == 0

    def test_from_dict_no_created_at(self):
        r = LitePlanResult.from_dict({"plan_id": "x"})
        assert r.created_at is not None

    def test_from_dict_with_datetime_created_at(self):
        now = datetime.now()
        r = LitePlanResult.from_dict({"plan_id": "x", "created_at": now})
        assert r.created_at is now


# ============================================================
# LiteFixResult
# ============================================================

class TestLiteFixResult:

    def test_to_dict(self):
        r = LiteFixResult(
            diagnosis="diag",
            root_cause="cause",
            fix_suggestions=["fix1"],
            severity="high",
            confidence=0.85,
            affected_areas=["auth"],
        )
        d = r.to_dict()
        assert d["diagnosis"] == "diag"
        assert d["severity"] == "high"
        assert d["affected_areas"] == ["auth"]

    def test_from_dict(self):
        r = LiteFixResult.from_dict({
            "diagnosis": "d",
            "root_cause": "r",
            "fix_suggestions": ["s"],
        })
        assert r.diagnosis == "d"
        assert r.severity == "medium"
        assert r.confidence == 0.8

    def test_from_dict_empty(self):
        r = LiteFixResult.from_dict({})
        assert r.diagnosis == ""
        assert r.fix_suggestions == []


# ============================================================
# Level2Lite class attributes
# ============================================================

class TestLevel2LiteClass:

    def test_class_attrs(self):
        assert Level2Lite.level == 2
        assert Level2Lite.name == "lite"

    def test_get_required_agents(self):
        l2 = Level2Lite()
        agents = l2.get_required_agents()
        assert "writer" in agents
        assert "critic" in agents

    def test_get_default_config(self):
        l2 = Level2Lite()
        cfg = l2.get_default_config()
        assert cfg["max_revisions"] == 1
        assert cfg["pass_score"] == 70
        assert cfg["retrieval_profile"] == "lite_low_cost"




# ============================================================
# _execute_lite / _verify_lite
# ============================================================

class TestExecuteAndVerifyLite:

    def test_execute_lite_success(self):
        mock_writer = MagicMock()
        mock_writer.run.return_value = {"content": "draft content"}

        mock_container = MagicMock()
        mock_container.get_agent = MagicMock(return_value=mock_writer)

        l2 = Level2Lite(container=mock_container)
        state = BaseState()
        state["lite_plan"] = {"objective": "test", "key_points": ["a"]}
        state["context"] = "ctx"

        result = l2._execute_lite(state)
        assert result["draft_content"] == "draft content"
        assert result["draft_version"] == 1

    def test_execute_lite_exception(self):
        mock_container = MagicMock()
        mock_container.get_agent = MagicMock(side_effect=Exception("writer boom"))

        l2 = Level2Lite(container=mock_container)
        state = BaseState()

        result = l2._execute_lite(state)
        assert any("执行失败" in e for e in result.get("errors", []))

    def test_verify_lite_success(self):
        mock_critic = MagicMock()
        mock_critic.run.return_value = {
            "score": 88,
            "decision": "APPROVED",
            "feedback": "ok",
        }

        mock_container = MagicMock()
        mock_container.get_agent = MagicMock(return_value=mock_critic)

        l2 = Level2Lite(container=mock_container)
        state = BaseState()
        state["draft_content"] = "draft"
        state["lite_plan"] = {"objective": "o"}

        result = l2._verify_lite(state)
        assert result["score"] == 88
        assert result["decision"] == "APPROVED"
        assert result["feedback_context"] == "ok"

    def test_verify_lite_exception_defaults_approved(self):
        mock_container = MagicMock()
        mock_container.get_agent = MagicMock(side_effect=Exception("critic boom"))

        l2 = Level2Lite(container=mock_container)
        state = BaseState()

        result = l2._verify_lite(state)
        assert any("验证失败" in e for e in result.get("errors", []))
        assert result["decision"] == "APPROVED"
        assert result["score"] == 70


class TestExtractKeyPoints:

    def test_splits_text(self):
        l2 = Level2Lite()
        points = l2._extract_key_points("这是第一个要点。这是第二个关键观点。第三个信息需要处理")
        assert len(points) >= 2

    def test_max_five(self):
        l2 = Level2Lite()
        text = "。".join([f"这是一个很长的要点编号{i}" for i in range(20)])
        points = l2._extract_key_points(text)
        assert len(points) <= 5

    def test_empty_text(self):
        l2 = Level2Lite()
        points = l2._extract_key_points("")
        assert points == []

    def test_short_segments_filtered(self):
        l2 = Level2Lite()
        points = l2._extract_key_points("ab,cd,ef")
        assert len(points) == 0


# ============================================================
# _infer_tone
# ============================================================

class TestInferTone:

    def test_humorous(self):
        l2 = Level2Lite()
        assert l2._infer_tone("写一段幽默的对话", "") == "humorous"

    def test_serious(self):
        l2 = Level2Lite()
        assert l2._infer_tone("严肃的学术讨论", "") == "serious"

    def test_romantic(self):
        l2 = Level2Lite()
        assert l2._infer_tone("浪漫的邂逅", "") == "romantic"

    def test_suspense(self):
        l2 = Level2Lite()
        assert l2._infer_tone("悬疑推理", "") == "suspense"

    def test_lyrical(self):
        l2 = Level2Lite()
        assert l2._infer_tone("抒情散文", "") == "lyrical"

    def test_neutral_default(self):
        l2 = Level2Lite()
        assert l2._infer_tone("random text", "") == "neutral"

    def test_context_contributes(self):
        l2 = Level2Lite()
        assert l2._infer_tone("", "这是一段幽默的内容") == "humorous"


# ============================================================
# _build_lite_prompt
# ============================================================

class TestBuildLitePrompt:

    def test_basic_prompt(self):
        l2 = Level2Lite()
        plan = {"objective": "写一段", "key_points": ["要点1"], "tone": "neutral", "word_count_target": 500}
        prompt = l2._build_lite_prompt(plan)
        assert "写一段" in prompt
        assert "要点1" in prompt
        assert "500" in prompt

    def test_with_feedback(self):
        l2 = Level2Lite()
        plan = {"objective": "obj", "key_points": [], "tone": "neutral", "word_count_target": 1000}
        prompt = l2._build_lite_prompt(plan, "请修改")
        assert "修改建议" in prompt
        assert "请修改" in prompt


# ============================================================
# _plan_lite
# ============================================================

class TestPlanLite:

    def test_creates_plan(self):
        l2 = Level2Lite()
        state = BaseState()
        state["user_request"] = "写一段幽默对话，关于猫和狗"
        result = l2._plan_lite(state)
        assert "lite_plan" in result
        assert result["lite_plan"]["tone"] == "humorous"
        assert len(result["lite_plan"]["key_points"]) >= 0

    def test_empty_request(self):
        l2 = Level2Lite()
        state = BaseState()
        result = l2._plan_lite(state)
        assert result["lite_plan"]["objective"] == ""


# ============================================================
# _extract_plan
# ============================================================

class TestExtractPlan:

    def test_extracts_from_state(self):
        l2 = Level2Lite()
        state = BaseState()
        state["lite_plan"] = {
            "objective": "test",
            "key_points": ["a"],
            "tone": "serious",
            "word_count_target": 2000,
        }
        plan = l2._extract_plan(state)
        assert isinstance(plan, LitePlan)
        assert plan.objective == "test"
        assert plan.tone == "serious"

    def test_empty_state(self):
        l2 = Level2Lite()
        state = BaseState()
        plan = l2._extract_plan(state)
        assert plan.objective == ""
        assert plan.key_points == []


# ============================================================
# plan_lite (public)
# ============================================================

class TestPlanLitePublic:

    def test_returns_lite_plan(self):
        l2 = Level2Lite()
        state = BaseState()
        state["user_request"] = "test"
        plan = l2.plan_lite(state)
        assert isinstance(plan, LitePlan)


# ============================================================
# execute (full workflow with mocked agents)
# ============================================================

class TestExecuteWorkflow:

    @patch("src.workflow.levels.level2_lite.Level2Lite._verify_lite")
    @patch("src.workflow.levels.level2_lite.Level2Lite._execute_lite")
    def test_approved_first_try(self, mock_exec, mock_verify):
        mock_exec.side_effect = lambda s: s
        def verify_side_effect(s):
            s["score"] = 80
            s["decision"] = "APPROVED"
            return s
        mock_verify.side_effect = verify_side_effect

        l2 = Level2Lite()
        state = BaseState()
        state["user_request"] = "write"
        result = l2.execute(state)
        assert result["decision"] == "APPROVED"

    @patch("src.workflow.levels.level2_lite.Level2Lite._verify_lite")
    @patch("src.workflow.levels.level2_lite.Level2Lite._execute_lite")
    def test_revise_then_approve(self, mock_exec, mock_verify):
        mock_exec.side_effect = lambda s: s
        call_count = {"n": 0}
        def verify_side_effect(s):
            call_count["n"] += 1
            if call_count["n"] == 1:
                s["score"] = 50
                s["decision"] = "REVISE"
            else:
                s["score"] = 80
                s["decision"] = "APPROVED"
            return s
        mock_verify.side_effect = verify_side_effect

        l2 = Level2Lite()
        state = BaseState()
        state["user_request"] = "write"
        result = l2.execute(state)
        assert result["decision"] == "APPROVED"

    @patch("src.workflow.levels.level2_lite.Level2Lite._verify_lite")
    @patch("src.workflow.levels.level2_lite.Level2Lite._execute_lite")
    def test_auto_approved_after_max_revisions(self, mock_exec, mock_verify):
        mock_exec.side_effect = lambda s: s
        def verify_side_effect(s):
            s["score"] = 30
            s["decision"] = "REVISE"
            return s
        mock_verify.side_effect = verify_side_effect

        l2 = Level2Lite()
        state = BaseState()
        state["user_request"] = "write"
        result = l2.execute(state)
        assert result["decision"] == "APPROVED"
        assert result.get("auto_approved") is True

    @patch("src.workflow.levels.level2_lite.Level2Lite._verify_lite")
    @patch("src.workflow.levels.level2_lite.Level2Lite._execute_lite")
    def test_pass_score_overrides(self, mock_exec, mock_verify):
        mock_exec.side_effect = lambda s: s
        def verify_side_effect(s):
            s["score"] = 75
            s["decision"] = "REVISE"
            return s
        mock_verify.side_effect = verify_side_effect

        l2 = Level2Lite(config={"pass_score": 75})
        state = BaseState()
        state["user_request"] = "write"
        result = l2.execute(state)
        assert result["decision"] == "APPROVED"


# ============================================================
# lite_plan (command)
# ============================================================

class TestLitePlanCommand:

    def test_string_task(self):
        l2 = Level2Lite()
        result = l2.lite_plan("写一段关于春天的散文，描写花开的美景")
        assert isinstance(result, LitePlanResult)
        assert result.plan_id.startswith("lite-")
        assert len(result.steps) >= 2
        assert result.estimated_time > 0
        assert result.objective != ""

    def test_dict_task(self):
        l2 = Level2Lite()
        result = l2.lite_plan({
            "objective": "写一段对话",
            "constraints": ["不超过500字"],
        })
        assert isinstance(result, LitePlanResult)
        assert result.objective == "写一段对话"
        assert "constraints" in result.context

    def test_dict_task_with_task_key(self):
        l2 = Level2Lite()
        result = l2.lite_plan({"task": "修复bug"})
        assert result.objective == "修复bug"

    def test_roundtrip(self):
        l2 = Level2Lite()
        result = l2.lite_plan("test task")
        d = result.to_dict()
        restored = LitePlanResult.from_dict(d)
        assert restored.plan_id == result.plan_id
        assert restored.objective == result.objective


# ============================================================
# lite_fix (command)
# ============================================================

class TestLiteFixCommand:

    def test_basic_bug(self):
        l2 = Level2Lite()
        result = l2.lite_fix("程序崩溃了")
        assert isinstance(result, LiteFixResult)
        assert result.severity == "critical"
        assert result.diagnosis != ""
        assert result.root_cause != ""
        assert len(result.fix_suggestions) > 0

    def test_with_context(self):
        l2 = Level2Lite()
        result = l2.lite_fix("null pointer error", {"error_log": "NullPointerException at line 42"})
        assert result.confidence > 0.5
        assert "错误日志" in result.diagnosis or "error" in result.diagnosis.lower() or "空值" in result.diagnosis

    def test_low_severity(self):
        l2 = Level2Lite()
        result = l2.lite_fix("建议优化性能")
        assert result.severity == "low"

    def test_medium_severity(self):
        l2 = Level2Lite()
        result = l2.lite_fix("有个bug需要修复")
        assert result.severity == "medium"

    def test_high_severity(self):
        l2 = Level2Lite()
        result = l2.lite_fix("登录失败 error")
        assert result.severity == "high"


# ============================================================
# _analyze_severity
# ============================================================

class TestAnalyzeSeverity:

    def test_critical(self):
        l2 = Level2Lite()
        assert l2._analyze_severity("crash happened") == "critical"
        assert l2._analyze_severity("数据丢失") == "critical"
        assert l2._analyze_severity("security vulnerability") == "critical"

    def test_high(self):
        l2 = Level2Lite()
        assert l2._analyze_severity("error occurred") == "high"
        assert l2._analyze_severity("操作失败") == "high"

    def test_medium(self):
        l2 = Level2Lite()
        assert l2._analyze_severity("there is a bug") == "medium"

    def test_low(self):
        l2 = Level2Lite()
        assert l2._analyze_severity("just a warning") == "low"
        assert l2._analyze_severity("建议改进") == "low"

    def test_default_medium(self):
        l2 = Level2Lite()
        assert l2._analyze_severity("something happened") == "medium"


# ============================================================
# _diagnose_bug
# ============================================================

class TestDiagnoseBug:

    def test_error_keyword(self):
        l2 = Level2Lite()
        d = l2._diagnose_bug("encountered an error", {})
        assert "错误" in d

    def test_null_keyword(self):
        l2 = Level2Lite()
        d = l2._diagnose_bug("null reference", {})
        assert "空值" in d

    def test_timeout_keyword(self):
        l2 = Level2Lite()
        d = l2._diagnose_bug("connection timeout", {})
        assert "超时" in d

    def test_with_error_log(self):
        l2 = Level2Lite()
        d = l2._diagnose_bug("something", {"error_log": "stack trace here"})
        assert "错误日志" in d

    def test_fallback(self):
        l2 = Level2Lite()
        d = l2._diagnose_bug("unknown issue xyz", {})
        assert "问题描述" in d


# ============================================================
# _identify_root_cause
# ============================================================

class TestIdentifyRootCause:

    def test_null_cause(self):
        l2 = Level2Lite()
        r = l2._identify_root_cause("变量是null", {})
        assert "初始化" in r or "空值" in r

    def test_type_cause(self):
        l2 = Level2Lite()
        r = l2._identify_root_cause("类型错误 type error", {})
        assert "类型" in r

    def test_timeout_cause(self):
        l2 = Level2Lite()
        r = l2._identify_root_cause("操作超时了", {})
        assert "超时" in r

    def test_permission_cause(self):
        l2 = Level2Lite()
        r = l2._identify_root_cause("permission denied access", {})
        assert "权限" in r

    def test_connection_cause(self):
        l2 = Level2Lite()
        r = l2._identify_root_cause("connection refused", {})
        assert "连接" in r

    def test_stack_trace(self):
        l2 = Level2Lite()
        r = l2._identify_root_cause("unknown", {"stack_trace": "at line 10"})
        assert "堆栈" in r

    def test_unknown_cause(self):
        l2 = Level2Lite()
        r = l2._identify_root_cause("weird stuff", {})
        assert "进一步" in r


# ============================================================
# _generate_fix_suggestions
# ============================================================

class TestGenerateFixSuggestions:

    def test_null_suggestions(self):
        l2 = Level2Lite()
        s = l2._generate_fix_suggestions("", "变量未正确初始化或返回了空值", {})
        assert any("空值" in x or "初始化" in x for x in s)

    def test_type_suggestions(self):
        l2 = Level2Lite()
        s = l2._generate_fix_suggestions("", "类型不匹配", {})
        assert any("类型" in x for x in s)

    def test_timeout_suggestions(self):
        l2 = Level2Lite()
        s = l2._generate_fix_suggestions("", "操作耗时过长或资源等待超时", {})
        assert any("超时" in x for x in s)

    def test_permission_suggestions(self):
        l2 = Level2Lite()
        s = l2._generate_fix_suggestions("", "权限配置不正确", {})
        assert any("权限" in x for x in s)

    def test_connection_suggestions(self):
        l2 = Level2Lite()
        s = l2._generate_fix_suggestions("", "网络连接问题", {})
        assert any("连接" in x or "重试" in x for x in s)

    def test_generic_suggestions(self):
        l2 = Level2Lite()
        s = l2._generate_fix_suggestions("", "unknown root cause", {})
        assert len(s) >= 3


# ============================================================
# _identify_affected_areas
# ============================================================

class TestIdentifyAffectedAreas:

    def test_from_context_with_function(self):
        l2 = Level2Lite()
        areas = l2._identify_affected_areas("", {"function": "handle_login"})
        assert "handle_login" in areas

    def test_from_description(self):
        l2 = Level2Lite()
        areas = l2._identify_affected_areas("登录模块有api问题", {})
        assert "认证模块" in areas
        assert "API 接口" in areas

    def test_ui_area(self):
        l2 = Level2Lite()
        areas = l2._identify_affected_areas("界面显示异常", {})
        assert "用户界面" in areas

    def test_data_area(self):
        l2 = Level2Lite()
        areas = l2._identify_affected_areas("数据处理错误", {})
        assert "数据处理" in areas

    def test_default_area(self):
        l2 = Level2Lite()
        areas = l2._identify_affected_areas("something weird", {})
        assert areas == ["待确定"]

    def test_deduplication(self):
        l2 = Level2Lite()
        areas = l2._identify_affected_areas("", {"file": "x", "module": "x"})
        assert areas.count("x") == 1


# ============================================================
# _calculate_diagnosis_confidence
# ============================================================

class TestCalculateDiagnosisConfidence:

    def test_base_confidence(self):
        l2 = Level2Lite()
        c = l2._calculate_diagnosis_confidence("short", {})
        assert c == 0.5

    def test_with_error_log(self):
        l2 = Level2Lite()
        c = l2._calculate_diagnosis_confidence("x", {"error_log": "e"})
        assert c == 0.7

    def test_with_stack_trace(self):
        l2 = Level2Lite()
        c = l2._calculate_diagnosis_confidence("x", {"stack_trace": "t"})
        assert c == 0.65

    def test_with_code_snippet(self):
        l2 = Level2Lite()
        c = l2._calculate_diagnosis_confidence("x", {"code_snippet": "c"})
        assert c == 0.6

    def test_long_description(self):
        l2 = Level2Lite()
        c = l2._calculate_diagnosis_confidence("x" * 200, {})
        assert c == 0.55

    def test_max_capped(self):
        l2 = Level2Lite()
        c = l2._calculate_diagnosis_confidence("x" * 200, {
            "error_log": "e", "stack_trace": "t", "code_snippet": "c"
        })
        assert c <= 0.95


# ============================================================
# _calculate_plan_confidence
# ============================================================

class TestCalculatePlanConfidence:

    def test_short_objective(self):
        l2 = Level2Lite()
        c = l2._calculate_plan_confidence("short", [], {})
        assert c < 0.5  # penalized for short

    def test_ideal_objective(self):
        l2 = Level2Lite()
        c = l2._calculate_plan_confidence("a" * 50, ["a", "b", "c"], {})
        assert c >= 0.7

    def test_long_objective_branch(self):
        l2 = Level2Lite()
        c = l2._calculate_plan_confidence("a" * 220, ["a", "b"], {})
        assert c > 0.5

    def test_more_than_five_keypoints_branch(self):
        l2 = Level2Lite()
        c = l2._calculate_plan_confidence("a" * 50, ["1", "2", "3", "4", "5", "6"], {})
        assert c >= 0.75

    def test_min_capped(self):
        l2 = Level2Lite()
        c = l2._calculate_plan_confidence("", [], {})
        assert c >= 0.1

    def test_max_capped(self):
        l2 = Level2Lite()
        c = l2._calculate_plan_confidence("a" * 100, ["a", "b", "c", "d"], {
            "reference": True, "examples": True, "constraints": True,
        })
        assert c <= 0.95

    def test_empty_objective_without_short_penalty(self):
        l2 = Level2Lite()
        c = l2._calculate_plan_confidence("", ["a", "b"], {})
        assert c == 0.55

    def test_context_without_constraints_branch(self):
        l2 = Level2Lite()
        c = l2._calculate_plan_confidence("a" * 60, ["a", "b"], {"reference": True})
        assert c == 0.95


# ============================================================
# _generate_plan_steps
# ============================================================

class TestGeneratePlanSteps:

    def test_with_key_points(self):
        l2 = Level2Lite()
        steps = l2._generate_plan_steps("obj", ["p1", "p2"], {})
        assert steps[0]["action"] == "analyze_requirements"
        assert steps[-1]["action"] == "verify_output"
        assert len(steps) == 4  # analyze + 2 execute + verify

    def test_without_key_points(self):
        l2 = Level2Lite()
        steps = l2._generate_plan_steps("obj", [], {})
        assert len(steps) == 2  # analyze + verify

    def test_critical_flags(self):
        l2 = Level2Lite()
        steps = l2._generate_plan_steps("obj", ["p1"], {})
        assert steps[0]["critical"] is True
        assert steps[1]["critical"] is False
        assert steps[-1]["critical"] is True


# ============================================================
# _estimate_execution_time
# ============================================================

class TestEstimateExecutionTime:

    def test_basic(self):
        l2 = Level2Lite()
        steps = [{"critical": False}, {"critical": False}]
        t = l2._estimate_execution_time(steps)
        assert t == 30 + 2 * 15  # 60

    def test_with_critical(self):
        l2 = Level2Lite()
        steps = [{"critical": True}, {"critical": False}]
        t = l2._estimate_execution_time(steps)
        assert t == 30 + 2 * 15 + 10  # 70

    def test_empty(self):
        l2 = Level2Lite()
        t = l2._estimate_execution_time([])
        assert t == 30


# ============================================================
# _execute_step
# ============================================================

class TestExecuteStep:

    def test_analyze_action(self):
        l2 = Level2Lite()
        state = BaseState()
        result = l2._execute_step({"action": "analyze_requirements", "inputs": {"objective": "test"}}, state)
        assert result["success"] is True

    def test_execute_action(self):
        l2 = Level2Lite()
        state = BaseState()
        result = l2._execute_step({"action": "execute_task", "inputs": {"task": "do it"}}, state)
        assert result["success"] is True

    def test_verify_action(self):
        l2 = Level2Lite()
        state = BaseState()
        result = l2._execute_step({"action": "verify_output", "inputs": {}}, state)
        assert result["success"] is True
        assert result["score"] == 75

    def test_execute_step_exception_branch(self):
        l2 = Level2Lite()
        state = BaseState()

        class _BoomStep(dict):
            def get(self, key, default=None):
                if key == "description":
                    raise RuntimeError("desc boom")
                return super().get(key, default)

        step = _BoomStep({"action": "custom", "inputs": {}})
        result = l2._execute_step(step, state)
        assert result["success"] is False
        assert "boom" in result["error"]


# ============================================================
# _aggregate_step_results
# ============================================================

class TestAggregateStepResults:

    def test_with_outputs(self):
        l2 = Level2Lite()
        steps = [
            {"result": {"output": "line1"}},
            {"result": {"output": "line2"}},
        ]
        result = l2._aggregate_step_results(steps)
        assert "line1" in result
        assert "line2" in result

    def test_empty(self):
        l2 = Level2Lite()
        result = l2._aggregate_step_results([])
        assert result == "执行完成"

    def test_no_output(self):
        l2 = Level2Lite()
        result = l2._aggregate_step_results([{"result": {}}])
        assert result == "执行完成"


# ============================================================
# lite_execute (command)
# ============================================================

class TestLiteExecuteCommand:

    def test_with_plan_result(self):
        l2 = Level2Lite()
        plan = l2.lite_plan("写一段测试文本，包含多个要点，详细描述场景")
        state = l2.lite_execute(plan)
        assert isinstance(state, dict)
        assert state.get("decision") == "APPROVED"
        assert state.get("final_output") is not None

    def test_with_dict(self):
        l2 = Level2Lite()
        state = l2.lite_execute({
            "plan_id": "test",
            "objective": "test",
            "steps": [
                {"action": "analyze_requirements", "inputs": {"objective": "t"}, "critical": True},
                {"action": "verify_output", "inputs": {}, "critical": True},
            ],
        })
        assert state["decision"] == "APPROVED"

    def test_critical_step_failure(self):
        l2 = Level2Lite()

        def bad_step(step, state):
            if step.get("action") == "analyze_requirements":
                return {"success": False, "error": "boom"}
            return {"success": True, "output": "ok"}

        l2._execute_step = bad_step
        state = l2.lite_execute({
            "steps": [
                {"action": "analyze_requirements", "inputs": {}, "critical": True},
                {"action": "verify_output", "inputs": {}, "critical": True},
            ],
        })
        assert state["decision"] == "FAILED"

    def test_non_critical_failure_continues(self):
        l2 = Level2Lite()

        call_count = {"n": 0}
        original = l2._execute_step

        def tracked_step(step, state):
            call_count["n"] += 1
            if step.get("action") == "execute_task":
                return {"success": False, "error": "minor"}
            return original(step, state)

        l2._execute_step = tracked_step
        state = l2.lite_execute({
            "steps": [
                {"action": "analyze_requirements", "inputs": {"objective": "t"}, "critical": True},
                {"action": "execute_task", "inputs": {"task": "t"}, "critical": False},
                {"action": "verify_output", "inputs": {}, "critical": True},
            ],
        })
        assert state["decision"] == "APPROVED"
        assert call_count["n"] == 3
