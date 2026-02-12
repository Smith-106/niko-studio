#!/usr/bin/env python
"""
Niko-Studio MCP Gateway 启动脚本

使用方法:
    python scripts/start_gateway.py
    python scripts/start_gateway.py --port 8000 --host 0.0.0.0
"""

import argparse
import sys
import os
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))


def main():
    parser = argparse.ArgumentParser(description="Start Niko-Studio MCP Gateway")
    parser.add_argument("--host", default=None, help="Host to bind (default: from config)")
    parser.add_argument("--port", type=int, default=None, help="Port to bind (default: from config)")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload")
    parser.add_argument("--log-level", default="info", help="Log level (default: info)")
    parser.add_argument("--env", choices=["development", "production"], default=None, help="Runtime env override")

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
    
    try:
        import uvicorn
        from src.config import init_config, ensure_environment, get_config_value

        if args.env:
            os.environ["NIKO_ENV"] = args.env

        init_config(hot_reload=False)
        ensure_environment(strict=False)

        host = str(args.host or get_config_value("gateway.host", "0.0.0.0"))
        port = int(args.port or get_config_value("gateway.port", 8000))

        env = str(get_config_value("env", "development")).lower()
        is_production = env in {"prod", "production"}

        if args.reload and is_production:
            print("⚠️  Production 环境已忽略 --reload")
        reload_enabled = bool(args.reload and not is_production)

        if is_production:
            cors_prod_origins = get_config_value("gateway.cors_prod_origins", [])
            if isinstance(cors_prod_origins, str):
                cors_prod_origins = [x.strip() for x in cors_prod_origins.split(",") if x.strip()]
            forbidden = {"*", "http://localhost:3000", "http://127.0.0.1:3000"}
            effective_origins = [origin for origin in cors_prod_origins if origin not in forbidden]
            if not effective_origins:
                print("❌ Error: production CORS whitelist is empty")
                print("   Set NIKO_CORS_PROD_ORIGINS or gateway.cors_prod_origins with real domains")
                sys.exit(1)

        print(f"🚀 Starting MCP Gateway on http://{host}:{port}")
        print()
        print("📊 Available MCP Endpoints:")
        print(f"   • http://localhost:{port}/memory   - 记忆服务")
        print(f"   • http://localhost:{port}/graph    - 知识图谱")
        print(f"   • http://localhost:{port}/skills   - 技能包")
        print(f"   • http://localhost:{port}/search   - 搜索服务")
        print(f"   • http://localhost:{port}/workflow - 工作流")
        print(f"   • http://localhost:{port}/critic   - 评估服务")
        print()
        print("📋 Utility Endpoints:")
        print(f"   • http://localhost:{port}/health   - 健康检查")
        print(f"   • http://localhost:{port}/metrics  - 运行指标")
        print(f"   • http://localhost:{port}/tools    - 工具列表")
        print()
        print("🔗 Client Configuration:")
        print(f'   Claude Code: {{"type": "streamable-http", "url": "http://localhost:{port}/memory"}}')
        print()

        uvicorn.run(
            "src.mcp.gateway:app",
            host=host,
            port=port,
            reload=reload_enabled,
            log_level=args.log_level
        )
    except ImportError:
        print("❌ Error: uvicorn not installed")
        print("   Run: pip install uvicorn")
        sys.exit(1)


if __name__ == "__main__":
    main()
