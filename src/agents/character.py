# -*- coding: utf-8 -*-
"""
Character Agent - 角色管理

负责角色档案的查询、关系分析和一致性检查。
从 Graph 存储中获取角色信息和关系网络。
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from .base import BaseAgent


class CharacterProfile(BaseModel):
    """角色档案"""
    name: str = Field(..., description="角色名称")
    role: str = Field(default="", description="角色定位: protagonist/antagonist/supporting")

    # 四个自我模型
    social_self: str = Field(default="", description="社会自我：外界看到的形象")
    personal_self: str = Field(default="", description="个人自我：自我认知")
    private_self: str = Field(default="", description="私密自我：隐藏的一面")
    hidden_self: str = Field(default="", description="隐藏自我：连自己都不知道的")

    # 核心属性
    desire: str = Field(default="", description="核心渴望")
    fear: str = Field(default="", description="最大恐惧")
    flaw: str = Field(default="", description="性格缺陷")
    strength: str = Field(default="", description="核心优势")

    # 外在特征
    appearance: str = Field(default="", description="外貌描述")
    speech_pattern: str = Field(default="", description="说话方式")
    mannerisms: List[str] = Field(default_factory=list, description="习惯动作")

    # 关系
    relationships: Dict[str, str] = Field(default_factory=dict, description="与其他角色的关系")


class CharacterContext(BaseModel):
    """角色上下文"""
    main_character: Optional[CharacterProfile] = None
    present_characters: List[CharacterProfile] = Field(default_factory=list)
    relationship_dynamics: List[str] = Field(default_factory=list, description="当前场景的关系动态")
    dialogue_guidelines: Dict[str, str] = Field(default_factory=dict, description="对话指南")


class CharacterAgent(BaseAgent):
    """
    角色 Agent

    职责：
    1. 查询角色档案
    2. 分析角色关系
    3. 验证角色行为一致性
    4. 提供对话风格指南
    """

    def __init__(self, llm=None, graph_engine=None, name: str = "Character", config: Optional[Dict[str, Any]] = None):
        super().__init__(name, config)
        self.llm = llm
        self._graph_engine = graph_engine

    @property
    def graph_engine(self):
        """延迟加载 Graph Engine"""
        if self._graph_engine is None:
            try:
                from src.graph.graph_engine import GraphEngine
                self._graph_engine = GraphEngine()
            except Exception as e:
                self.log_activity(f"Failed to load GraphEngine: {e}", level="WARNING")
        return self._graph_engine

    async def get_context(self, scene_info: Dict[str, Any]) -> CharacterContext:
        """
        获取场景所需的角色上下文

        Args:
            scene_info: 场景信息，包含 pov_character, characters 等

        Returns:
            CharacterContext: 角色上下文
        """
        pov_character = scene_info.get("pov_character", "")
        character_names = scene_info.get("characters", [])

        main_character = None
        present_characters = []
        relationship_dynamics = []
        dialogue_guidelines = {}

        # 获取 POV 角色档案
        if pov_character:
            main_character = await self._get_character_profile(pov_character)
            if main_character:
                dialogue_guidelines[pov_character] = self._generate_dialogue_guide(main_character)

        # 获取其他在场角色
        for name in character_names:
            if name != pov_character:
                profile = await self._get_character_profile(name)
                if profile:
                    present_characters.append(profile)
                    dialogue_guidelines[name] = self._generate_dialogue_guide(profile)

        # 分析关系动态
        if main_character and present_characters:
            relationship_dynamics = await self._analyze_relationships(
                main_character, present_characters
            )

        context = CharacterContext(
            main_character=main_character,
            present_characters=present_characters,
            relationship_dynamics=relationship_dynamics,
            dialogue_guidelines=dialogue_guidelines
        )

        self.log_activity(f"Generated character context: {pov_character}, {len(present_characters)} others")
        return context

    async def _get_character_profile(self, name: str) -> Optional[CharacterProfile]:
        """获取角色档案"""
        if not self.graph_engine:
            # 返回空档案
            return CharacterProfile(name=name)

        query = f"""
        MATCH (c:Character {{name: '{name}'}})
        OPTIONAL MATCH (c)-[r]->(other:Character)
        RETURN c, collect({{type: type(r), target: other.name}}) as relationships
        """

        try:
            result = self.graph_engine.query(query)
            if result and len(result) > 0:
                node = result[0]
                char_data = node.get("c", {})
                rels = node.get("relationships", [])

                relationships = {}
                for rel in rels:
                    if rel.get("target"):
                        relationships[rel["target"]] = rel.get("type", "KNOWS")

                return CharacterProfile(
                    name=name,
                    role=char_data.get("role", "supporting"),
                    social_self=char_data.get("social_self", ""),
                    personal_self=char_data.get("personal_self", ""),
                    private_self=char_data.get("private_self", ""),
                    hidden_self=char_data.get("hidden_self", ""),
                    desire=char_data.get("desire", ""),
                    fear=char_data.get("fear", ""),
                    flaw=char_data.get("flaw", ""),
                    strength=char_data.get("strength", ""),
                    appearance=char_data.get("appearance", ""),
                    speech_pattern=char_data.get("speech_pattern", ""),
                    mannerisms=char_data.get("mannerisms", []),
                    relationships=relationships
                )
        except Exception as e:
            self.log_activity(f"Character query failed: {e}", level="WARNING")

        return CharacterProfile(name=name)

    async def _analyze_relationships(
        self,
        main: CharacterProfile,
        others: List[CharacterProfile]
    ) -> List[str]:
        """分析角色间关系动态"""
        dynamics = []

        for other in others:
            rel_type = main.relationships.get(other.name, "NEUTRAL")

            # 基于关系类型生成动态描述
            if rel_type in ["ENEMY", "RIVAL", "ANTAGONIST"]:
                dynamics.append(f"{main.name} 与 {other.name} 存在对立关系，对话应充满张力")
            elif rel_type in ["FRIEND", "ALLY", "LOVER"]:
                dynamics.append(f"{main.name} 与 {other.name} 关系亲密，对话可以更轻松")
            elif rel_type in ["MENTOR", "STUDENT"]:
                dynamics.append(f"{main.name} 与 {other.name} 是师徒关系，存在指导与学习")
            else:
                dynamics.append(f"{main.name} 与 {other.name} 关系中性，保持礼貌距离")

        return dynamics

    def _generate_dialogue_guide(self, profile: CharacterProfile) -> str:
        """生成角色对话指南"""
        guides = []

        if profile.speech_pattern:
            guides.append(f"说话方式: {profile.speech_pattern}")

        if profile.mannerisms:
            guides.append(f"习惯动作: {', '.join(profile.mannerisms[:3])}")

        if profile.social_self:
            guides.append(f"表面形象: {profile.social_self}")

        if profile.private_self:
            guides.append(f"内心想法: {profile.private_self}")

        return "; ".join(guides) if guides else "无特殊指南"

    async def validate_behavior(
        self,
        character_name: str,
        action: str,
        context: CharacterContext
    ) -> Dict[str, Any]:
        """
        验证角色行为是否符合其设定

        Args:
            character_name: 角色名
            action: 行为描述
            context: 角色上下文

        Returns:
            验证结果
        """
        issues = []
        suggestions = []

        # 找到对应角色
        profile = None
        if context.main_character and context.main_character.name == character_name:
            profile = context.main_character
        else:
            for char in context.present_characters:
                if char.name == character_name:
                    profile = char
                    break

        if not profile:
            return {"is_valid": True, "issues": [], "suggestions": ["角色档案未找到，跳过验证"]}

        # 检查行为与性格是否冲突
        if profile.fear and profile.fear.lower() in action.lower():
            issues.append(f"{character_name} 的恐惧是 '{profile.fear}'，但行为中似乎克服了它，需要铺垫")

        if profile.flaw and "完美" in action:
            issues.append(f"{character_name} 有缺陷 '{profile.flaw}'，行为不应过于完美")

        is_valid = len(issues) == 0

        return {
            "is_valid": is_valid,
            "issues": issues,
            "suggestions": suggestions
        }

    def run(self, input_data: Any) -> Any:
        """同步运行接口"""
        import asyncio
        return asyncio.run(self.get_context(input_data))
