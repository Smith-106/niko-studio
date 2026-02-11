"""
工作流引擎 - L1-L5 五级模式 + Plan-Act + Checkpoint

核心特性:
1. 任务路由 (自动识别复杂度)
2. Plan-Act 模式 (规划与执行分离)
3. Git-based 检查点管理
4. 状态追踪
"""

import json
import logging
import re
import uuid
import subprocess
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Any

from src.workflow.levels.types import (
    WorkflowLevel,
    LevelRouter,
    to_workflow_label,
    to_workflow_slug,
)

logger = logging.getLogger("niko-workflow")


@dataclass
class WorkflowStep:
    """工作流步骤"""
    id: str
    name: str
    description: str
    status: str = "pending"  # pending/running/completed/failed
    dependencies: List[str] = field(default_factory=list)
    output: Any = None
    started_at: str = None
    completed_at: str = None


@dataclass
class WorkflowPlan:
    """工作流计划"""
    id: str
    task: str
    level: str
    steps: List[WorkflowStep] = field(default_factory=list)
    status: str = "created"  # created/running/completed/failed
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    completed_at: str = None


@dataclass
class Checkpoint:
    """检查点"""
    id: str
    description: str
    commit_hash: str = None
    plan_id: str = None
    step_id: str = None
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())


class WorkflowEngine:
    """工作流引擎"""

    def _get_level_indicators(self) -> Dict[WorkflowLevel, List[str]]:
        return {
            WorkflowLevel.L1_RAPID: ["回答", "解释", "什么是", "告诉我", "简单"],
            WorkflowLevel.L2_LITE: ["写一段", "描写", "生成段落", "扩写"],
            WorkflowLevel.L3_STANDARD: ["写一章", "创作章节", "完成场景", "第.*章"],
            WorkflowLevel.L4_BRAINSTORM: ["连续写", "多章", "接着写", "继续"],
            WorkflowLevel.L5_COORDINATOR: ["规划全书", "大纲", "整体设计", "完整故事"],
        }

    def __init__(self, workspace: str = None):
        self.workspace = Path(workspace) if workspace else Path.cwd()
        self.plans: Dict[str, WorkflowPlan] = {}
        self.checkpoints: Dict[str, Checkpoint] = {}
        self.router = LevelRouter()

        logger.info(f"Workflow engine initialized: {self.workspace}")

    async def route(self, task: str) -> dict:
        """
        路由任务到合适的工作流级别

        基于任务描述自动识别复杂度
        """
        task_lower = task.lower()

        # 匹配关键词
        matched_level = WorkflowLevel.L2_LITE  # 默认
        max_score = 0

        for level, keywords in self._get_level_indicators().items():
            score = sum(1 for kw in keywords if re.search(kw, task_lower))
            if score > max_score:
                max_score = score
                matched_level = level

        # 根据任务长度调整
        if len(task) > 100 and matched_level in [WorkflowLevel.L1_RAPID, WorkflowLevel.L2_LITE]:
            matched_level = WorkflowLevel.L3_STANDARD

        level_descriptions = {
            WorkflowLevel.L1_RAPID: "简单问答模式 - 直接回答，无需规划",
            WorkflowLevel.L2_LITE: "段落生成模式 - 单次生成，可能需要技能包",
            WorkflowLevel.L3_STANDARD: "章节创作模式 - Plan-Act 模式，需要检查点",
            WorkflowLevel.L4_BRAINSTORM: "多章连续模式 - 状态管理，跨章节一致性",
            WorkflowLevel.L5_COORDINATOR: "全书规划模式 - 完整工作流，大纲到成稿",
        }

        return {
            "level": matched_level.label,
            "level_slug": matched_level.slug,
            "description": level_descriptions[matched_level],
            "suggested_workflow": self._get_workflow_template(matched_level),
            "reason": f"匹配关键词得分: {max_score}",
        }

    def _get_workflow_template(self, level: WorkflowLevel) -> list:
        """获取工作流模板"""
        if isinstance(level, str):
            level = WorkflowLevel.from_label(level)

        templates = {
            WorkflowLevel.L1_RAPID: [
                {"name": "answer", "description": "直接回答问题"}
            ],
            WorkflowLevel.L2_LITE: [
                {"name": "analyze", "description": "分析任务需求"},
                {"name": "match_skills", "description": "匹配技能包"},
                {"name": "generate", "description": "生成内容"},
            ],
            WorkflowLevel.L3_STANDARD: [
                {"name": "analyze", "description": "分析章节需求"},
                {"name": "load_context", "description": "加载上下文"},
                {"name": "match_skills", "description": "匹配技能包"},
                {"name": "plan_structure", "description": "规划章节结构"},
                {"name": "generate_draft", "description": "生成初稿"},
                {"name": "evaluate", "description": "评估质量"},
                {"name": "revise", "description": "修改优化"},
                {"name": "checkpoint", "description": "创建检查点"},
            ],
            WorkflowLevel.L4_BRAINSTORM: [
                {"name": "load_state", "description": "加载前文状态"},
                {"name": "plan_chapters", "description": "规划多章"},
                {"name": "create_chapter", "description": "创作单章 (循环)"},
                {"name": "consistency_check", "description": "一致性检查"},
                {"name": "save_state", "description": "保存状态"},
            ],
            WorkflowLevel.L5_COORDINATOR: [
                {"name": "concept", "description": "确定核心概念"},
                {"name": "outline", "description": "生成大纲"},
                {"name": "character_design", "description": "角色设计"},
                {"name": "world_building", "description": "世界设定"},
                {"name": "chapter_breakdown", "description": "章节分解"},
                {"name": "create_chapters", "description": "逐章创作"},
                {"name": "final_review", "description": "最终审核"},
            ],
        }
        return templates.get(level, templates[WorkflowLevel.L2_LITE])
    
    async def plan(self, task: str, level: str = None) -> dict:
        """
        生成执行计划 (Plan 模式)
        """
        # 自动路由
        if not level:
            routing = await self.route(task)
            level = routing["level"]

        workflow_level = WorkflowLevel.from_label(level)

        # 获取模板
        template = self._get_workflow_template(workflow_level)

        # 创建计划
        plan_id = str(uuid.uuid4())[:8]
        steps = []

        for i, step_template in enumerate(template):
            step = WorkflowStep(
                id=f"{plan_id}-{i}",
                name=step_template["name"],
                description=step_template["description"],
                dependencies=[f"{plan_id}-{i-1}"] if i > 0 else []
            )
            steps.append(step)

        plan = WorkflowPlan(
            id=plan_id,
            task=task,
            level=workflow_level.label,
            steps=steps
        )

        self.plans[plan_id] = plan

        logger.info(f"Created plan: {plan_id} (Level: {workflow_level.label}, Steps: {len(steps)})")

        return {
            "plan_id": plan_id,
            "level": workflow_level.label,
            "level_slug": workflow_level.slug,
            "steps": [
                {
                    "id": s.id,
                    "name": s.name,
                    "description": s.description,
                    "dependencies": s.dependencies,
                    "status": s.status
                }
                for s in steps
            ],
            "total_steps": len(steps)
        }
    
    async def execute(self, plan_id: str, step_id: str = None) -> dict:
        """
        执行计划 (Act 模式)
        """
        if plan_id not in self.plans:
            return {"error": f"Plan '{plan_id}' not found"}
        
        plan = self.plans[plan_id]
        
        # 找到要执行的步骤
        if step_id:
            step = next((s for s in plan.steps if s.id == step_id), None)
            if not step:
                return {"error": f"Step '{step_id}' not found"}
        else:
            # 找到下一个待执行的步骤
            step = next((s for s in plan.steps if s.status == "pending"), None)
            if not step:
                return {"status": "completed", "message": "All steps completed"}
        
        # 检查依赖
        for dep_id in step.dependencies:
            dep_step = next((s for s in plan.steps if s.id == dep_id), None)
            if dep_step and dep_step.status != "completed":
                return {"error": f"Dependency '{dep_id}' not completed"}
        
        # 标记计划为运行中
        if plan.status == "created":
            plan.status = "running"

        # 执行步骤
        step.status = "running"
        step.started_at = datetime.now().isoformat()
        
        try:
            # 根据步骤名称执行对应操作
            result = await self._execute_step(plan, step)
            
            step.status = "completed"
            step.completed_at = datetime.now().isoformat()
            step.output = result
            
            # 检查是否所有步骤完成
            if all(s.status == "completed" for s in plan.steps):
                plan.status = "completed"
                plan.completed_at = datetime.now().isoformat()
            
            return {
                "step_id": step.id,
                "step_name": step.name,
                "status": "completed",
                "result": result,
                "plan_status": plan.status,
                "remaining_steps": sum(1 for s in plan.steps if s.status == "pending")
            }
        
        except Exception as e:
            step.status = "failed"
            logger.error(f"Step execution failed: {e}")
            return {"error": str(e), "step_id": step.id}
    
    async def _execute_step(self, plan: WorkflowPlan, step: WorkflowStep) -> Any:
        """执行具体步骤"""
        # 这里是步骤执行的占位实现
        # 实际应用中会调用相应的引擎
        
        step_handlers = {
            "analyze": lambda: {"analysis": f"Task analysis for: {plan.task[:50]}..."},
            "match_skills": lambda: {"skills": ["fictional-dream", "character-forge"]},
            "load_context": lambda: {"context_loaded": True},
            "plan_structure": lambda: {"structure": ["开场", "发展", "冲突", "高潮", "结局"]},
            "generate_draft": lambda: {"draft": "Initial draft content..."},
            "generate": lambda: {"content": "Generated content..."},
            "evaluate": lambda: {"score": 7.5, "feedback": "Good overall structure"},
            "revise": lambda: {"revised": True},
            "checkpoint": lambda: {"checkpoint_id": str(uuid.uuid4())[:8]},
            "answer": lambda: {"answer": "Direct answer to the question"},
        }
        
        handler = step_handlers.get(step.name, lambda: {"executed": True})
        return handler()
    
    async def create_checkpoint(
        self,
        description: str = "",
        auto_commit: bool = True
    ) -> dict:
        """
        创建检查点 (Git-based)
        """
        checkpoint_id = str(uuid.uuid4())[:8]
        commit_hash = None
        
        if auto_commit:
            try:
                # Git add - 仅暂存工作区目录下的文件，避免误伤
                subprocess.run(
                    ["git", "add", str(self.workspace)],
                    cwd=self.workspace,
                    capture_output=True,
                    check=True
                )
                
                # Git commit
                commit_msg = f"[checkpoint:{checkpoint_id}] {description or 'Auto checkpoint'}"
                result = subprocess.run(
                    ["git", "commit", "-m", commit_msg],
                    cwd=self.workspace,
                    capture_output=True,
                    text=True
                )
                
                # 获取 commit hash
                if result.returncode == 0:
                    hash_result = subprocess.run(
                        ["git", "rev-parse", "HEAD"],
                        cwd=self.workspace,
                        capture_output=True,
                        text=True
                    )
                    commit_hash = hash_result.stdout.strip()
                
            except subprocess.CalledProcessError as e:
                logger.warning(f"Git operation failed: {e}")
            except FileNotFoundError:
                logger.warning("Git not available")
        
        checkpoint = Checkpoint(
            id=checkpoint_id,
            description=description,
            commit_hash=commit_hash
        )
        
        self.checkpoints[checkpoint_id] = checkpoint
        
        logger.info(f"Created checkpoint: {checkpoint_id}")
        
        return {
            "checkpoint_id": checkpoint_id,
            "commit_hash": commit_hash,
            "description": description,
            "created_at": checkpoint.created_at
        }
    
    async def restore_checkpoint(self, checkpoint_id: str) -> dict:
        """
        恢复到检查点
        """
        if checkpoint_id not in self.checkpoints:
            return {"error": f"Checkpoint '{checkpoint_id}' not found"}
        
        checkpoint = self.checkpoints[checkpoint_id]
        
        if checkpoint.commit_hash:
            try:
                subprocess.run(
                    ["git", "checkout", checkpoint.commit_hash],
                    cwd=self.workspace,
                    capture_output=True,
                    check=True
                )
                
                return {
                    "status": "restored",
                    "checkpoint_id": checkpoint_id,
                    "commit_hash": checkpoint.commit_hash
                }
            
            except subprocess.CalledProcessError as e:
                return {"error": f"Git restore failed: {e}"}
        
        return {"error": "No commit hash available for this checkpoint"}
    
    async def list_checkpoints(self, limit: int = 10) -> list:
        """
        列出最近的检查点
        """
        checkpoints = sorted(
            self.checkpoints.values(),
            key=lambda c: c.created_at,
            reverse=True
        )
        
        return [
            {
                "id": c.id,
                "description": c.description,
                "commit_hash": c.commit_hash,
                "created_at": c.created_at
            }
            for c in checkpoints[:limit]
        ]
    
    def get_plan_status(self, plan_id: str) -> dict:
        """获取计划状态"""
        if plan_id not in self.plans:
            return {"error": f"Plan '{plan_id}' not found"}
        
        plan = self.plans[plan_id]
        
        return {
            "plan_id": plan.id,
            "task": plan.task,
            "level": plan.level,
            "status": plan.status,
            "steps": [
                {
                    "id": s.id,
                    "name": s.name,
                    "status": s.status,
                    "output": s.output
                }
                for s in plan.steps
            ],
            "progress": f"{sum(1 for s in plan.steps if s.status == 'completed')}/{len(plan.steps)}"
        }
