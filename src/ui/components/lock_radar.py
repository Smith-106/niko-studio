"""
LOCK 雷达图组件
===============
可视化 LOCK 系统评分 (Lead, Objective, Confrontation, Knockout)
"""

import streamlit as st
import plotly.graph_objects as go
from typing import Dict, Optional
from src.ui.translations import t


def render_lock_radar(
    scores: Dict[str, float],
    threshold: int = 28,
    title: str = None
) -> None:
    """
    渲染 LOCK 评分雷达图
    
    Args:
        scores: LOCK 各维度分数，例如 {"L": 7, "O": 8, "C": 6, "K": 7}
        threshold: 通过阈值 (总分)
        title: 图表标题
    """
    if title is None:
        title = t("lock_system_score")

    # 标准化维度名称
    categories = [
        t("lock_L"),
        t("lock_O"),
        t("lock_C"),
        t("lock_K")
    ]
    
    # 提取分数 (支持多种格式)
    values = []
    for key in ["L", "O", "C", "K"]:
        if key in scores:
            values.append(scores[key])
        elif f"{key} (Lead)" in scores:
            values.append(scores[f"{key} (Lead)"])
        else:
            # 尝试匹配部分键名
            for k, v in scores.items():
                if k.startswith(key):
                    values.append(v)
                    break
            else:
                values.append(0)
    
    # 闭合雷达图
    values_closed = values + [values[0]]
    categories_closed = categories + [categories[0]]
    
    # 创建雷达图
    fig = go.Figure()
    
    # 添加数据轨迹
    fig.add_trace(go.Scatterpolar(
        r=values_closed,
        theta=categories_closed,
        fill='toself',
        fillcolor='rgba(99, 102, 241, 0.3)',
        line=dict(color='rgb(99, 102, 241)', width=2),
        name=t("current_score")
    ))
    
    # 添加阈值线 (平均每项需要达到的分数)
    threshold_per_item = threshold / 4
    threshold_values = [threshold_per_item] * 5
    fig.add_trace(go.Scatterpolar(
        r=threshold_values,
        theta=categories_closed,
        fill=None,
        line=dict(color='rgba(239, 68, 68, 0.5)', width=2, dash='dash'),
        name=t("threshold_label", threshold=threshold)
    ))
    
    # 布局设置
    fig.update_layout(
        polar=dict(
            radialaxis=dict(
                visible=True,
                range=[0, 10],
                tickmode='linear',
                tick0=0,
                dtick=2
            )
        ),
        showlegend=True,
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=-0.2,
            xanchor="center",
            x=0.5
        ),
        title=dict(
            text=title,
            x=0.5,
            xanchor='center'
        ),
        margin=dict(l=80, r=80, t=60, b=80)
    )
    
    # 渲染
    st.plotly_chart(fig, use_container_width=True)
    
    # 评分摘要
    total = sum(values)
    passed = total >= threshold
    
    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric(t("total_score"), f"{total}/40")
    with col2:
        st.metric(t("threshold"), str(threshold))
    with col3:
        st.metric(t("status"), t("passed") if passed else t("needs_improvement"),
                  delta=t("passed_delta") if passed else t("failed_delta"),
                  delta_color="normal" if passed else "inverse")


def render_lock_breakdown(
    scores: Dict[str, float],
    analysis: Optional[Dict[str, str]] = None
) -> None:
    """
    渲染 LOCK 各维度详细分解
    
    Args:
        scores: LOCK 各维度分数
        analysis: 各维度分析文本
    """
    dimensions = [
        ("L", t("lock_L_desc"), t("lock_L_tooltip")),
        ("O", t("lock_O_desc"), t("lock_O_tooltip")),
        ("C", t("lock_C_desc"), t("lock_C_tooltip")),
        ("K", t("lock_K_desc"), t("lock_K_tooltip"))
    ]
    
    for key, name, description in dimensions:
        # 获取分数
        score = 0
        for k, v in scores.items():
            if k.startswith(key):
                score = v
                break
        
        # 冲突维度特殊标记
        is_conflict = key == "C"
        
        with st.expander(f"{'⚡' if is_conflict else '📌'} {name}: {score}/10", 
                        expanded=is_conflict):
            st.caption(description)
            
            # 进度条
            st.progress(score / 10)
            
            # 分析文本
            if analysis and key in analysis:
                st.markdown(f"**{t('analysis_label')}**: {analysis[key]}")
            
            # 冲突维度的特殊提示
            if is_conflict:
                st.info(t("conflict_core_tip"))


# 测试代码
if __name__ == "__main__":
    st.set_page_config(page_title="LOCK Radar Test", layout="wide")
    st.title("LOCK 雷达图组件测试")
    
    # 测试数据
    test_scores = {
        "L (Lead)": 7,
        "O (Objective)": 8,
        "C (Confrontation)": 6,
        "K (Knockout)": 7
    }
    
    test_analysis = {
        "L": "主角个性鲜明，但动机可以更强烈",
        "O": "目标明确，有足够的紧迫感",
        "C": "冲突存在但张力不足，建议增加内外双重障碍",
        "K": "结尾有冲击力，但可以更出人意料"
    }
    
    col1, col2 = st.columns(2)
    
    with col1:
        render_lock_radar(test_scores, threshold=28)
    
    with col2:
        render_lock_breakdown(test_scores, test_analysis)
