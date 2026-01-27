"""
LOCK 雷达图组件
===============
可视化 LOCK 系统评分 (Lead, Objective, Confrontation, Knockout)
"""

import streamlit as st
import plotly.graph_objects as go
import pandas as pd
import html
from typing import Dict, Optional


def render_lock_radar(
    scores: Dict[str, float],
    threshold: int = 28,
    title: str = "LOCK 系统评分"
) -> None:
    """
    渲染 LOCK 评分雷达图
    
    Args:
        scores: LOCK 各维度分数，例如 {"L": 7, "O": 8, "C": 6, "K": 7}
        threshold: 通过阈值 (总分)
        title: 图表标题
    """
    # 标准化维度名称
    categories = ["Lead\n(主角魅力)", "Objective\n(目标明确)", 
                  "Confrontation\n(冲突设计)", "Knockout\n(结尾冲击)"]
    
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
        name='当前评分'
    ))
    
    # 添加阈值线 (平均每项需要达到的分数)
    threshold_per_item = threshold / 4
    threshold_values = [threshold_per_item] * 5
    fig.add_trace(go.Scatterpolar(
        r=threshold_values,
        theta=categories_closed,
        fill=None,
        line=dict(color='rgba(239, 68, 68, 0.5)', width=2, dash='dash'),
        name=f'通过阈值 ({threshold})'
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
    
    # 评分摘要
    total = sum(values)
    passed = total >= threshold

    # 无障碍：屏幕阅读器文本摘要
    summary_text = f"{html.escape(title)} Summary: Total {total}/40 ({'Passed' if passed else 'Failed'}). "
    summary_items = []
    for cat, val in zip(categories, values):
        # 移除换行符使朗读更顺畅
        clean_cat = cat.replace('\n', ' ')
        summary_items.append(f"{html.escape(clean_cat)}: {val}/10")
    summary_text += ", ".join(summary_items) + "."

    st.markdown(f'<p class="sr-only">{summary_text}</p>', unsafe_allow_html=True)

    # 渲染
    st.plotly_chart(fig, use_container_width=True)

    # 无障碍：数据表格替代方案
    with st.expander("View as Table (Accessible)"):
        df_scores = pd.DataFrame({
            "Dimension": [c.replace('\n', ' ') for c in categories],
            "Score": values,
            "Max": [10] * 4
        })
        st.dataframe(df_scores, use_container_width=True)
    
    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("总分", f"{total}/40")
    with col2:
        st.metric("阈值", str(threshold))
    with col3:
        st.metric("状态", "✅ 通过" if passed else "❌ 待改进",
                  delta="通过" if passed else "未通过",
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
        ("L", "Lead (主角魅力)", "主角是否有足够的吸引力让读者想要跟随"),
        ("O", "Objective (目标明确)", "主角的目标是否清晰、有吸引力"),
        ("C", "Confrontation (冲突设计)", "障碍和冲突是否足够有挑战性 (权重最高: 40%)"),
        ("K", "Knockout (结尾冲击)", "结尾是否有足够的冲击力和满足感")
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
                st.markdown(f"**分析**: {analysis[key]}")
            
            # 冲突维度的特殊提示
            if is_conflict:
                st.info("💡 **冲突是故事的核心**: 拥有最高权重 (40%)，请确保场景有足够的对抗张力")


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
