# -*- coding: utf-8 -*-
"""
Shared fixtures for narrative evaluators tests.
"""

import pytest
from unittest.mock import MagicMock, AsyncMock


@pytest.fixture
def mock_llm_client():
    """Mock LLM client for evaluators."""
    mock = MagicMock()
    mock.generate = AsyncMock(return_value="Mock LLM response")
    return mock


@pytest.fixture
def sample_good_content():
    """High quality narrative sample with rich sensory details and conflict."""
    return """
    李明站在雨中，冰冷的雨水打在脸上，却感觉不到寒冷。他望着远去的列车，
    心中充满了矛盾——他想追上去，却又害怕面对。那个熟悉的背影渐渐模糊，
    他的心也跟着沉了下去。"我应该说些什么的，"他喃喃自语，"可是我不敢。"
    周围的嘈杂声仿佛都消失了，只剩下雨声和他沉重的呼吸。

    他决定不能就这样放弃。因为这是他最后的机会，如果不行动，一切都会结束。
    他必须在列车离开之前追上去，否则他将永远失去她。

    第一，他需要穿过拥挤的人群。其次，他要找到正确的车厢。最后，他必须说出
    那句埋在心底三年的话。时间紧迫，只剩下三分钟。

    因此，他开始奔跑。他的目标很明确——保护这段感情，拯救他们的未来。
    """


@pytest.fixture
def sample_poor_content():
    """Low quality narrative sample lacking details."""
    return "他走了。她哭了。天黑了。"


@pytest.fixture
def sample_medium_content():
    """Medium quality narrative sample."""
    return """
    张华是一个很好的人。他非常善良，特别热心。
    有一天，他遇到了一个问题。这个问题很大。
    他想了很久，最后解决了。大家都很高兴。
    """


@pytest.fixture
def sample_context():
    """Sample context for evaluation."""
    return {
        "character": "李明",
        "scene": "火车站告别",
        "mood": "伤感",
        "character_goal": "追上列车向她表白",
        "premise": "犹豫导致错过，勇气带来转机"
    }


@pytest.fixture
def sample_pyramid_content():
    """Sample content with pyramid structure."""
    return """
    我们建议采用微服务架构重构现有系统。

    这一决定基于以下三个方面的考虑：

    第一，可扩展性。因为当前单体架构已无法满足日益增长的用户需求，
    所以我们需要能够独立扩展各个服务模块。

    第二，开发效率。由于团队规模扩大，微服务允许不同团队并行开发，
    从而提高整体开发速度。

    第三，技术灵活性。此外，微服务架构使我们能够针对不同服务
    选择最适合的技术栈。

    综上所述，微服务架构是解决当前痛点的最佳方案。
    """


@pytest.fixture
def sample_suspenseful_content():
    """Sample content with suspense elements."""
    return """
    还有五分钟，炸弹就会爆炸。

    李警官擦了擦额头的汗，盯着眼前纠缠的红蓝电线。究竟该剪哪一根？
    如果剪错了，整栋大楼的三百人都会丧命。

    "你确定是红色吗？"他问道，声音在颤抖。

    电话那头沉默了。时间在一秒一秒流逝。他必须做出选择，
    否则一切都来不及了。危险就在眼前，他害怕，但他知道自己别无选择。
    """
