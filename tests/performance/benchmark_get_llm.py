import time
import os
import sys
from unittest.mock import MagicMock

# Mock external dependencies to isolate load_dotenv impact and avoid API calls
sys.modules["langchain_google_genai"] = MagicMock()
sys.modules["langchain_openai"] = MagicMock()

# Ensure src is in python path
sys.path.append(os.getcwd())

# Create a dummy .env file to make load_dotenv actually do something
with open(".env", "w") as f:
    f.write("DUMMY_VAR=1\n")

# Set env var so _get_llm proceeds
os.environ["GOOGLE_API_KEY"] = "fake_key"

try:
    from src.workflow.adapters.novel_adapter import NovelAdapter
except ImportError as e:
    print(f"Import failed: {e}")
    sys.exit(1)

def benchmark():
    adapter = NovelAdapter(config={})
    start_time = time.time()
    iterations = 1000
    for _ in range(iterations):
        try:
            adapter._get_llm()
        except Exception as e:
            print(f"Error during execution: {e}")
            break
    end_time = time.time()
    print(f"Time for {iterations} calls: {end_time - start_time:.4f} seconds")
    print(f"Average time per call: {(end_time - start_time) / iterations * 1000:.4f} ms")

if __name__ == "__main__":
    try:
        benchmark()
    finally:
        if os.path.exists(".env"):
            os.remove(".env")
