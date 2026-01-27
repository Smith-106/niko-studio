from typing import Dict

# --- Configuration for Status Display (WCAG Compliance) ---
STATUS_DISPLAY = {
    "DONE": {"icon": "✅", "text": "Completed", "color": "green", "graph_color": "palegreen"},
    "WRITING": {"icon": "✏️", "text": "In Progress", "color": "orange", "graph_color": "lightyellow"},
    "PENDING": {"icon": "⏳", "text": "Pending", "color": "gray", "graph_color": "lightgrey"},
    "REVIEWING": {"icon": "👀", "text": "Under Review", "color": "blue", "graph_color": "lightblue"},
    "FAILED": {"icon": "❌", "text": "Failed", "color": "red", "graph_color": "lightcoral"},
    "UNKNOWN": {"icon": "❓", "text": "Unknown", "color": "gray", "graph_color": "lightgrey"}
}

def get_status_display(status: str) -> Dict[str, str]:
    """获取状态显示信息，带容错处理"""
    status = status.upper() if status else "UNKNOWN"
    return STATUS_DISPLAY.get(status, STATUS_DISPLAY["UNKNOWN"])
