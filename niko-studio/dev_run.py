import uvicorn
import os

if __name__ == "__main__":
    # Ensure src is in python path
    import sys
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))

    print("🚀 Starting AI Writing Agent Platform (Web UI)...")
    print("👉 Open http://localhost:8000 in your browser")

    uvicorn.run("src.web.app:app", host="0.0.0.0", port=8000, reload=True)
