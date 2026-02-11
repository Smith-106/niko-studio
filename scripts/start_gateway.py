#!/usr/bin/env python
"""
Niko-Studio MCP Gateway 启动脚本

使用方法:
    python scripts/start_gateway.py
    python scripts/start_gateway.py --port 8000 --host 0.0.0.0
"""

import argparse
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


def main():
    parser = argparse.ArgumentParser(description="Start Niko-Studio MCP Gateway")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind (default: 8000)")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload")
    parser.add_argument("--log-level", default="info", help="Log level (default: info)")
    
    args = parser.parse_args()
    
    print("""
    ╔═══════════════════════════════════════════════════════════════╗
    ║                                                               ║
    ║     ███╗   ██╗██╗██╗  ██╗ ██████╗                            ║
    ║     ████╗  ██║██║██║ ██╔╝██╔═══██╗                           ║
    ║     ██╔██╗ ██║██║█████╔╝ ██║   ██║                           ║
    ║     ██║╚██╗██║██║██╔═██╗ ██║   ██║                           ║
    ║     ██║ ╚████║██║██║  ██╗╚██████╔╝                           ║
    ║     ╚═╝  ╚═══╝╚═╝╚═╝  ╚═╝ ╚═════╝  Studio V8                ║
    ║                                                               ║
    ║     MCP Gateway - Multi-Model Parallel Access                ║
    ║                                                               ║
    ╚═══════════════════════════════════════════════════════════════╝
    """)
    
    print(f"🚀 Starting MCP Gateway on http://{args.host}:{args.port}")
    print()
    print("📊 Available MCP Endpoints:")
    print(f"   • http://localhost:{args.port}/memory   - 记忆服务")
    print(f"   • http://localhost:{args.port}/graph    - 知识图谱")
    print(f"   • http://localhost:{args.port}/skills   - 技能包")
    print(f"   • http://localhost:{args.port}/search   - 搜索服务")
    print(f"   • http://localhost:{args.port}/workflow - 工作流")
    print(f"   • http://localhost:{args.port}/critic   - 评估服务")
    print()
    print("📋 Utility Endpoints:")
    print(f"   • http://localhost:{args.port}/health   - 健康检查")
    print(f"   • http://localhost:{args.port}/tools    - 工具列表")
    print()
    print("🔗 Client Configuration:")
    print('   Claude Code: {"type": "streamable-http", "url": "http://localhost:8000/memory"}')
    print()
    
    try:
        import uvicorn
        from src.config import init_config, ensure_environment

        init_config(hot_reload=False)
        ensure_environment(strict=False)

        uvicorn.run(
            "src.mcp.gateway:app",
            host=args.host,
            port=args.port,
            reload=args.reload,
            log_level=args.log_level
        )
    except ImportError:
        print("❌ Error: uvicorn not installed")
        print("   Run: pip install uvicorn")
        sys.exit(1)


if __name__ == "__main__":
    main()
