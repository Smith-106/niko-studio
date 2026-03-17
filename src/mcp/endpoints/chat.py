"""
Chat REST Endpoints

Chat-related HTTP endpoints for Desktop frontend, including SSE streaming.
"""

import asyncio
import inspect
import json
import logging
import re
from typing import Dict, Any, Optional

from starlette.requests import Request
from starlette.responses import JSONResponse, StreamingResponse

from src.mcp.contract import _with_contract, _with_terminal_contract

logger = logging.getLogger("niko-gateway")


MAX_MESSAGES = 128
MAX_MESSAGE_CHARS = 24_000
MAX_TOTAL_CHARS = 120_000


def _count_total_chars(messages: list) -> int:
    # Used for validation (total context cap) and kept as a separate helper for testability.
    total = 0
    for m in messages:
        if isinstance(m, dict):
            content = m.get("content")
            if isinstance(content, str):
                total += len(content)
    return total


def _validate_chat_messages_limits(messages: list) -> Optional[JSONResponse]:
    if not isinstance(messages, list):
        return JSONResponse({"error": "Invalid messages. Expected array"}, status_code=400)

    if len(messages) > MAX_MESSAGES:
        return JSONResponse({"error": f"Too many messages. Max {MAX_MESSAGES}"}, status_code=400)

    # Validate message shape/types first (to preserve deterministic error semantics), then apply
    # total context cap using the shared helper.
    for idx, m in enumerate(messages):
        if not isinstance(m, dict):
            return JSONResponse({"error": f"Invalid message at index {idx}. Expected object"}, status_code=400)

        role = m.get("role")
        content = m.get("content")
        if role not in {"system", "user", "assistant"}:
            return JSONResponse({"error": f"Invalid message.role at index {idx}"}, status_code=400)
        if not isinstance(content, str):
            return JSONResponse({"error": f"Invalid message.content at index {idx}. Expected string"}, status_code=400)

        if len(content) > MAX_MESSAGE_CHARS:
            return JSONResponse({"error": f"Message too long at index {idx}. Max {MAX_MESSAGE_CHARS} chars"}, status_code=400)

    if _count_total_chars(messages) > MAX_TOTAL_CHARS:
        return JSONResponse({"error": f"Context too long. Max {MAX_TOTAL_CHARS} chars"}, status_code=400)

    return None
def adaptive_chunk_content(
    content: str,
    max_chunk_size: int = 500,
    min_chunk_size: int = 50
) -> list:
    """
    按句子边界自适应分块内容。

    优化策略:
    - 在句子边界(。！？!?.\n)处分割
    - 最大块大小 500 字符
    - 最小块大小 50 字符 (避免过于碎片化)

    Args:
        content: 要分块的内容
        max_chunk_size: 最大块大小
        min_chunk_size: 最小块大小

    Returns:
        分块后的内容列表
    """
    if not content:
        return []

    # 中英文句子结束符
    sentence_endings = re.compile(r'([。！？!?.\n])')

    chunks = []
    current_chunk = ""

    # 按句子边界分割
    parts = sentence_endings.split(content)

    for i, part in enumerate(parts):
        if not part:
            continue

        # 如果是标点符号，追加到当前块
        if sentence_endings.match(part):
            current_chunk += part
            continue

        # 检查是否会超过最大大小
        if len(current_chunk) + len(part) > max_chunk_size:
            # 当前块已有内容且超过最小大小，先保存
            if current_chunk and len(current_chunk) >= min_chunk_size:
                chunks.append(current_chunk)
                current_chunk = part
            elif current_chunk:
                # 当前块太小，继续追加
                current_chunk += part
            else:
                # 单个 part 超过最大大小，强制分割
                while len(part) > max_chunk_size:
                    chunks.append(part[:max_chunk_size])
                    part = part[max_chunk_size:]
                current_chunk = part
        else:
            current_chunk += part

        # 如果当前块在句子边界且达到合理大小
        if (current_chunk.endswith(('。', '！', '？', '!', '?', '.', '\n'))
                and len(current_chunk) >= min_chunk_size):
            chunks.append(current_chunk)
            current_chunk = ""

    # 保存剩余内容
    if current_chunk:
        chunks.append(current_chunk)

    return chunks


async def chat_endpoint(request: Request):
    """
    统一聊天入口 - Desktop 应用主接口

    接收用户消息，通过 Commander 路由到正确的工作流，返回结果。
    支持五种模式：
    - L1: 快速修复/润色
    - L2: 轻量扩写/短文
    - L3: 标准章节创作
    - L4: 头脑风暴
    - L5: 深度编排
    """
    from src.workflow.levels.types import WorkflowLevel, to_workflow_label, to_workflow_slug
    from src.workflow.base_state import create_base_state
    from src.mcp.gateway import (
        _is_llm_available,
        get_commander_agent,
        get_writer_agent,
        get_critic_engine,
        adaptive_chunk_content,
        Level5Coordinator,
        asyncio as gateway_asyncio,
    )

    try:
        body = await request.json()
        messages = body.get("messages", [])

        limit_error = _validate_chat_messages_limits(messages)
        if limit_error is not None:
            return limit_error
        has_explicit_workflow_level = "workflowLevel" in body
        if has_explicit_workflow_level:
            raw_workflow_level = body.get("workflowLevel")
            if not isinstance(raw_workflow_level, (str, int)) or not WorkflowLevel.is_valid_label(raw_workflow_level):
                return JSONResponse(
                    {"error": "Invalid workflowLevel. Expected one of: L1, L2, L3, L4, L5"},
                    status_code=400,
                )
            workflow_level = WorkflowLevel.from_label(raw_workflow_level)
        else:
            workflow_level = None
        skills = body.get("skills", [])
        context = body.get("context", {})
        allow_llm_fallback = bool(body.get("allowLlmFallback", True))
        raw_comparison = body.get("comparison", {})
        comparison = raw_comparison if isinstance(raw_comparison, dict) else {}
        comparison_enabled = bool(comparison.get("enabled"))
        control_model = str(comparison.get("controlModel") or "control")
        primary_model = str(comparison.get("primaryModel") or "primary")

        if comparison_enabled and not control_model.strip():
            return JSONResponse({"error": "comparison.controlModel is required when comparison is enabled"}, status_code=400)

        if not allow_llm_fallback and not _is_llm_available():
            return JSONResponse({"error": "LLM unavailable and fallback disabled"}, status_code=503)

        if not messages:
            return JSONResponse({"error": "No messages provided"}, status_code=400)

        # 获取最新用户消息
        user_message = next(
            (m["content"] for m in reversed(messages) if m["role"] == "user"),
            ""
        )

        if not user_message:
            return JSONResponse({"error": "No user message found"}, status_code=400)

        # 使用 Commander Agent 处理
        commander = get_commander_agent()

        # 路由任务
        level = workflow_level if workflow_level is not None else commander.route(user_message)
        if not isinstance(level, WorkflowLevel):
            level = WorkflowLevel.from_label(level)
        scene_type = commander.detect_scene_type(user_message)
        dispatched_skills = commander.dispatch_skills(scene_type)

        # 合并用户选择的技能
        all_skills = list(set(dispatched_skills + skills))

        # 获取任务分配
        assignments = commander.dispatch_tasks(user_message, level)

        # 根据工作流级别执行不同逻辑
        response_content = ""
        evaluation_result = {"score": 0, "feedback": ""}
        writer_metadata: Optional[Dict[str, Any]] = None
        steps_completed = 0

        try:
            # 获取 Writer Agent
            writer = get_writer_agent()

            # 注入技能
            if all_skills:
                writer.inject_skills(all_skills[:5])

            # L1: 快速模式 - 直接续写/润色
            if level == WorkflowLevel.L1_RAPID:
                from src.agents.writer import WriterInput

                # 简单续写
                result = await writer.continue_writing(
                    existing_content=user_message,
                    continuation_hint="继续发展情节",
                    word_target=500,
                    allow_llm_fallback=allow_llm_fallback
                )
                response_content = result
                steps_completed = 1

            # L5: 协调者模式 - 专属执行链路
            elif level == WorkflowLevel.L5_COORDINATOR:
                coordinator_state = create_base_state(
                    user_request=user_message,
                    domain=context.get("domain", "novel"),
                    workflow_level=5,
                    metadata=context.get("metadata", {}),
                )
                coordinator_state["context"] = context.get("context", "")
                if context.get("session_id"):
                    coordinator_state["session_id"] = context.get("session_id")

                coordinator = Level5Coordinator()
                result_state = coordinator.execute(coordinator_state)

                response_content = result_state.get("final_output") or result_state.get("draft_content", "")
                evaluation_result = {
                    "score": result_state.get("score", 0),
                    "feedback": result_state.get("feedback_context", "") or result_state.get("decision_reason", ""),
                }
                steps_completed = len(getattr(coordinator._coordinator_state, "execution_units", [])) or 1

            # L2/L3/L4: 保持现有 Writer 路径
            else:
                from src.agents.writer import WriterInput

                # 构建场景输入
                writer_input = WriterInput(
                    scene_id=context.get("scene_id", "CH01-SC01"),
                    chapter_num=context.get("chapter_num", 1),
                    pov_character=context.get("pov_character", "主角"),
                    objective=user_message[:100],
                    conflict=context.get("conflict", "内心挣扎"),
                    outcome=context.get("outcome", "+"),
                    plot_beat=user_message,
                    emotional_arc=context.get("emotional_arc", "平静→紧张"),
                    sensory_guidance={
                        "location": context.get("location", "未知地点"),
                        "time": context.get("time", "某个时刻"),
                        "atmosphere": context.get("atmosphere", "神秘")
                    },
                    word_target=context.get("word_target", 2000)
                )

                # 执行写作
                result = await writer.write(writer_input, allow_llm_fallback=allow_llm_fallback)
                response_content = result.content
                writer_metadata = result.metadata if isinstance(result.metadata, dict) else None
                steps_completed = 4  # 4-chain prompt

                # 调用 Critic 评估 (如果可用)
                try:
                    critic_engine = get_critic_engine()
                    eval_result = await critic_engine.evaluate(
                        content=result.content,
                        scene_card=None,
                        dimensions=None
                    )
                    evaluation_result = {
                        "score": eval_result.get("total_score", 0),
                        "feedback": eval_result.get("actionable_feedback", "")
                    }
                except Exception as e:
                    if not allow_llm_fallback:
                        raise RuntimeError("Critic evaluation failed with fallback disabled") from e
                    logger.warning(f"Critic evaluation failed: {e}")
                    evaluation_result = {
                        "score": 75,
                        "feedback": f"自检: 使用了 {len(result.sensory_types_used)} 种感官描写"
                    }

        except Exception as e:
            if not allow_llm_fallback:
                raise RuntimeError("Writer execution failed with fallback disabled") from e
            logger.warning(f"Writer execution failed, falling back to analysis: {e}")
            # 回退到分析模式
            response_content = f"""## 任务分析

**工作流级别**: {to_workflow_label(level)}
**场景类型**: {scene_type.value}
**调用技能**: {', '.join(all_skills[:5])}

### 执行计划

"""
            for i, task in enumerate(assignments, 1):
                response_content += f"{i}. **{task.agent_type.upper()}**: {task.instruction[:50]}...\n"

            response_content += f"""
### 提示

检测到您的请求需要 LLM 支持。请确保：
1. 已配置有效的 LLM API 密钥
2. LLM 服务可用

您可以在设置中配置 Claude/OpenAI/Gemini API。
"""
            steps_completed = 1

        comparison_payload = None
        if comparison_enabled:
            comparison_payload = {
                "enabled": True,
                "primary": {
                    "model": primary_model,
                    "content": response_content,
                },
                "control": {
                    "model": control_model,
                    "content": response_content,
                },
            }

        return JSONResponse(_with_contract({
            "content": response_content,
            "skills_used": all_skills[:5],
            "comparison": comparison_payload,
            "writer_metadata": writer_metadata,
            "workflow_info": {
                "level": to_workflow_label(level),
                "level_slug": to_workflow_slug(level),
                "scene_type": scene_type.value,
                "steps_completed": steps_completed,
                "total_steps": len(assignments)
            },
            "workflow_level": to_workflow_label(level),
            "workflow_level_slug": to_workflow_slug(level),
            "evaluation": evaluation_result
        }))

    except Exception as e:
        logger.error(f"Chat endpoint error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)


async def chat_stream_endpoint(request: Request):
    """
    SSE 流式聊天入口 - 实时返回生成内容

    使用 Server-Sent Events 协议，支持：
    - 实时内容流式输出
    - 进度状态更新
    - 评估结果推送
    """
    from src.workflow.levels.types import WorkflowLevel, to_workflow_label, to_workflow_slug
    from src.workflow.base_state import create_base_state
    from src.mcp.gateway import (
        _is_llm_available,
        get_commander_agent,
        get_writer_agent,
        get_critic_engine,
        adaptive_chunk_content,
        Level5Coordinator,
        asyncio as gateway_asyncio,
    )

    try:
        body = await request.json()
        messages = body.get("messages", [])

        limit_error = _validate_chat_messages_limits(messages)
        if limit_error is not None:
            return limit_error
        has_explicit_workflow_level = "workflowLevel" in body
        if has_explicit_workflow_level:
            raw_workflow_level = body.get("workflowLevel")
            if not isinstance(raw_workflow_level, (str, int)) or not WorkflowLevel.is_valid_label(raw_workflow_level):
                return JSONResponse(
                    {"error": "Invalid workflowLevel. Expected one of: L1, L2, L3, L4, L5"},
                    status_code=400,
                )
            workflow_level = WorkflowLevel.from_label(raw_workflow_level)
        else:
            workflow_level = None
        skills = body.get("skills", [])
        context = body.get("context", {})
        allow_llm_fallback = bool(body.get("allowLlmFallback", True))

        if not allow_llm_fallback and not _is_llm_available():
            return JSONResponse({"error": "LLM unavailable and fallback disabled"}, status_code=503)

        if not messages:
            return JSONResponse({"error": "No messages provided"}, status_code=400)

        user_message = next(
            (m["content"] for m in reversed(messages) if m["role"] == "user"),
            ""
        )

        if not user_message:
            return JSONResponse({"error": "No user message found"}, status_code=400)

        async def generate_stream():
            """SSE 事件生成器"""
            stream_diagnostics = {
                "fallback_reason": None,
                "failure_reason": None,
                "error_type": None,
            }
            try:
                # 1. 发送开始事件
                start_payload = _with_contract({
                    "status": "started",
                    "diagnostics": stream_diagnostics,
                })
                yield f"event: start\ndata: {json.dumps(start_payload)}\n\n"

                # 2. 路由分析
                from src.mcp.gateway import get_commander_agent, get_writer_agent  # Lazy import for monkeypatch compatibility
                commander = get_commander_agent()
                level = workflow_level if workflow_level is not None else commander.route(user_message)
                if not isinstance(level, WorkflowLevel):
                    level = WorkflowLevel.from_label(level)
                scene_type = commander.detect_scene_type(user_message)
                dispatched_skills = commander.dispatch_skills(scene_type)
                all_skills = list(set(dispatched_skills + skills))

                yield f"event: routing\ndata: {json.dumps({'level': to_workflow_label(level), 'level_slug': to_workflow_slug(level), 'scene_type': scene_type.value, 'skills': all_skills[:5]})}\n\n"

                # 3. 获取 Writer Agent
                writer = get_writer_agent()
                if all_skills:
                    writer.inject_skills(all_skills[:5])

                yield f"event: progress\ndata: {json.dumps({'step': 1, 'total': 4, 'message': '准备写作环境...'})}\n\n"

                # 4. 执行写作 (模拟分段输出)
                if level == WorkflowLevel.L1_RAPID:
                    # L1 快速模式
                    yield f"event: progress\ndata: {json.dumps({'step': 2, 'total': 4, 'message': '快速续写中...'})}\n\n"

                    try:
                        result = await writer.continue_writing(
                            existing_content=user_message,
                            continuation_hint="继续发展情节",
                            word_target=500,
                            allow_llm_fallback=allow_llm_fallback
                        )
                        content = result if isinstance(result, str) else result.content

                        # 自适应分块流式输出 (按句子边界)
                        chunks = adaptive_chunk_content(content, max_chunk_size=500, min_chunk_size=50)
                        for i, chunk in enumerate(chunks):
                            yield f"event: content\ndata: {json.dumps({'chunk': chunk, 'index': i})}\n\n"
                            # 仅在块之间添加最小延迟以保持流式效果
                            if i < len(chunks) - 1:
                                await gateway_asyncio.sleep(0.005)

                        yield f"event: progress\ndata: {json.dumps({'step': 4, 'total': 4, 'message': '完成'})}\n\n"

                    except Exception as e:
                        if not allow_llm_fallback:
                            raise RuntimeError("Writer execution failed with fallback disabled") from e
                        logger.warning(f"Writer failed: {e}")
                        stream_diagnostics["fallback_reason"] = "writer_unavailable_l1"
                        stream_diagnostics["failure_reason"] = str(e)
                        yield f"event: content\ndata: {json.dumps({'chunk': f'[写作服务暂时不可用，请检查 LLM 配置]'})}\n\n"

                elif level == WorkflowLevel.L5_COORDINATOR:
                    # L5 协调者模式
                    yield f"event: progress\ndata: {json.dumps({'step': 2, 'total': 4, 'message': '协调器分析中...'})}\n\n"

                    coordinator_state = create_base_state(
                        user_request=user_message,
                        domain=context.get("domain", "novel"),
                        workflow_level=5,
                        metadata=context.get("metadata", {}),
                    )
                    coordinator_state["context"] = context.get("context", "")
                    if context.get("session_id"):
                        coordinator_state["session_id"] = context.get("session_id")

                    coordinator = Level5Coordinator()
                    result_state = coordinator.execute(coordinator_state)
                    content = result_state.get("final_output") or result_state.get("draft_content", "")

                    yield f"event: progress\ndata: {json.dumps({'step': 3, 'total': 4, 'message': '生成结果中...'})}\n\n"

                    chunks = adaptive_chunk_content(content, max_chunk_size=500, min_chunk_size=80)
                    for i, chunk in enumerate(chunks):
                        yield f"event: content\ndata: {json.dumps({'chunk': chunk, 'index': i})}\n\n"
                        if i < len(chunks) - 1:
                            await gateway_asyncio.sleep(0.005)

                    yield f"event: progress\ndata: {json.dumps({'step': 4, 'total': 4, 'message': '质量评估...'})}\n\n"
                    yield f"event: evaluation\ndata: {json.dumps({'score': result_state.get('score', 0), 'feedback': result_state.get('feedback_context', '') or result_state.get('decision_reason', '')})}\n\n"

                else:
                    # L2/L3/L4 标准路径
                    from src.agents.writer import WriterInput

                    yield f"event: progress\ndata: {json.dumps({'step': 2, 'total': 4, 'message': '构建场景...'})}\n\n"

                    writer_input = WriterInput(
                        scene_id=context.get("scene_id", "CH01-SC01"),
                        chapter_num=context.get("chapter_num", 1),
                        pov_character=context.get("pov_character", "主角"),
                        objective=user_message[:100],
                        conflict=context.get("conflict", "内心挣扎"),
                        outcome=context.get("outcome", "+"),
                        plot_beat=user_message,
                        emotional_arc=context.get("emotional_arc", "平静→紧张"),
                        sensory_guidance={
                            "location": context.get("location", "未知地点"),
                            "time": context.get("time", "某个时刻"),
                            "atmosphere": context.get("atmosphere", "神秘")
                        },
                        word_target=context.get("word_target", 2000)
                    )

                    yield f"event: progress\ndata: {json.dumps({'step': 3, 'total': 4, 'message': '创作中...'})}\n\n"

                    try:
                        result = await writer.write(writer_input, allow_llm_fallback=allow_llm_fallback)
                        content = result.content

                        # 自适应分块流式输出 (按句子边界，最大 500 字符)
                        chunks = adaptive_chunk_content(content, max_chunk_size=500, min_chunk_size=80)
                        for i, chunk in enumerate(chunks):
                            yield f"event: content\ndata: {json.dumps({'chunk': chunk, 'index': i})}\n\n"
                            # 仅在块之间添加最小延迟
                            if i < len(chunks) - 1:
                                await gateway_asyncio.sleep(0.005)

                        # 5. 评估 (可选)
                        yield f"event: progress\ndata: {json.dumps({'step': 4, 'total': 4, 'message': '质量评估...'})}\n\n"

                        try:
                            critic_engine = get_critic_engine()
                            eval_result = await critic_engine.evaluate(
                                content=content,
                                scene_card=None,
                                dimensions=None
                            )
                            yield f"event: evaluation\ndata: {json.dumps({'score': eval_result.get('total_score', 0), 'feedback': eval_result.get('actionable_feedback', '')})}\n\n"
                        except Exception as e:
                            if not allow_llm_fallback:
                                raise RuntimeError("Critic evaluation failed with fallback disabled") from e
                            logger.warning(f"Critic evaluation failed: {e}")
                            stream_diagnostics["fallback_reason"] = "critic_unavailable"
                            stream_diagnostics["failure_reason"] = str(e)
                            yield f"event: evaluation\ndata: {json.dumps({'score': 75, 'feedback': '自动评估暂不可用'})}\n\n"

                    except Exception as e:
                        if not allow_llm_fallback:
                            raise RuntimeError("Writer execution failed with fallback disabled") from e
                        logger.warning(f"Writer failed: {e}")
                        stream_diagnostics["fallback_reason"] = "writer_unavailable_l234"
                        stream_diagnostics["failure_reason"] = str(e)
                        yield f"event: content\ndata: {json.dumps({'chunk': f'[写作服务暂时不可用: {str(e)[:50]}]'})}\n\n"

                # 6. 完成事件
                decision = "soft_go" if stream_diagnostics["fallback_reason"] else "go"
                terminal_state = "recovered" if stream_diagnostics["fallback_reason"] else "done"
                done_payload = _with_terminal_contract({
                    "status": "completed",
                    "terminal": terminal_state,
                    "decision": decision,
                    "skills_used": all_skills[:5],
                    "diagnostics": stream_diagnostics,
                    "workflow_level": to_workflow_label(level),
                    "workflow_level_slug": to_workflow_slug(level),
                })
                yield f"event: done\ndata: {json.dumps(done_payload)}\n\n"

            except Exception as e:
                logger.error(f"Stream error: {e}")
                stream_diagnostics["failure_reason"] = str(e)
                stream_diagnostics["error_type"] = e.__class__.__name__
                terminal_state = "interrupted" if isinstance(e, (asyncio.CancelledError, TimeoutError)) else "error"
                error_payload = _with_terminal_contract({
                    "error": str(e),
                    "terminal": terminal_state,
                    "decision": "no_go",
                    "diagnostics": stream_diagnostics,
                })
                yield f"event: error\ndata: {json.dumps(error_payload)}\n\n"

        return StreamingResponse(
            generate_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
                "Content-Encoding": "identity",  # SSE 不支持 gzip 压缩
            }
        )

    except Exception as e:
        logger.error(f"Chat stream endpoint error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)


__all__ = [
    "chat_endpoint",
    "chat_stream_endpoint",
    "adaptive_chunk_content",
]
