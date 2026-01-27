import time
import os
import sys
from unittest.mock import MagicMock

# Mock external dependencies
sys.modules["langchain_google_genai"] = MagicMock()
sys.modules["langchain_openai"] = MagicMock()

# Mock langgraph
langgraph = MagicMock()
langgraph.graph = MagicMock()
langgraph.graph.StateGraph = MagicMock
langgraph.graph.END = "END"
langgraph.checkpoint = MagicMock()
langgraph.checkpoint.memory = MagicMock()
langgraph.checkpoint.memory.MemorySaver = MagicMock
sys.modules["langgraph"] = langgraph
sys.modules["langgraph.graph"] = langgraph.graph
sys.modules["langgraph.checkpoint"] = langgraph.checkpoint
sys.modules["langgraph.checkpoint.memory"] = langgraph.checkpoint.memory

# Mock dotenv
def mock_load_dotenv(dotenv_path=None, **kwargs):
    # Simulate file I/O overhead
    try:
        path = dotenv_path or ".env"
        if os.path.exists(path):
            with open(path, "r") as f:
                content = f.read()
                # Extremely simple parsing to simulate work
                for line in content.splitlines():
                    if "=" in line:
                        k, v = line.split("=", 1)
                        os.environ[k.strip()] = v.strip()
    except Exception:
        pass
    return True

dotenv = MagicMock()
dotenv.load_dotenv = mock_load_dotenv
sys.modules["dotenv"] = dotenv

# Ensure src is in python path
sys.path.append(os.getcwd())

# Create a dummy .env file
with open(".env", "w") as f:
    f.write("DUMMY_VAR=1\n" * 10) # 10 lines of dummy vars

# Set env var so _get_llm proceeds
os.environ["GOOGLE_API_KEY"] = "fake_key"

try:
    from src.workflow.adapters.novel_adapter import NovelAdapter
except ImportError as e:
    print(f"Import failed: {e}")
    sys.exit(1)

def benchmark():
    # Instantiate adapter
    try:
        adapter = NovelAdapter(config={})
    except Exception as e:
        print(f"Failed to instantiate NovelAdapter: {e}")
        return

    start_time = time.time()
    iterations = 5000
    for _ in range(iterations):
        try:
            adapter._get_llm()
        except Exception as e:
            print(f"Error during execution: {e}")
            break
    end_time = time.time()
    total_time = end_time - start_time
    print(f"Time for {iterations} calls: {total_time:.4f} seconds")
    print(f"Average time per call: {(total_time) / iterations * 1000:.4f} ms")

if __name__ == "__main__":
    try:
        benchmark()
    finally:
        if os.path.exists(".env"):
            os.remove(".env")
