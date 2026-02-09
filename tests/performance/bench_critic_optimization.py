import time
import re
import random
import string
from collections import Counter
from typing import List

# --- Configurations ---

# 1. Standard Case: Small list (Current reality)
FORBIDDEN_WORDS_SMALL = ["突然", "不禁", "竟然", "居然", "忍不住"]

# 2. Large List Case: Many forbidden words
def generate_random_words(n=100):
    words = []
    seen = set()
    while len(words) < n:
        w = "".join(random.choices(string.ascii_lowercase, k=4))
        if w not in seen:
            seen.add(w)
            words.append(w)
    return words

FORBIDDEN_WORDS_LARGE = generate_random_words(100)

# --- Content Generators ---

def generate_content_realistic(size_kb: int, words: List[str]) -> str:
    """
    Generates content with a realistic density of forbidden words.
    Assume roughly 1 forbidden word per 500 characters on average.
    """
    base_text_segment = "这是一段很普通的文本，用来模拟正常的小说内容。" * 20 # ~400 chars

    target_bytes = size_kb * 1024
    content_list = []
    current_bytes = 0

    while current_bytes < target_bytes:
        # Add a chunk of normal text
        content_list.append(base_text_segment)
        current_bytes += len(base_text_segment.encode('utf-8'))

        # Occasionally insert a forbidden word
        if random.random() < 0.8: # 80% chance to insert a word after a chunk
            word = random.choice(words)
            content_list.append(word)
            current_bytes += len(word.encode('utf-8'))

    return "".join(content_list)

# --- Implementations ---

def check_naive(content: str, forbidden_words: List[str]):
    forbidden_found = []
    for word in forbidden_words:
        if word in content:
            count = content.count(word)
            forbidden_found.append(f"{word}:{count}")
    return forbidden_found

def check_optimized(content: str, forbidden_words: List[str], pattern):
    matches = pattern.findall(content)
    counts = Counter(matches)
    forbidden_found = []
    for word in forbidden_words:
        if word in counts:
            count = counts[word]
            forbidden_found.append(f"「{word}」出现{count}次")
    return forbidden_found

def benchmark_scenario(name, forbidden_words, content_gen_func):
    print(f"\n--- Scenario: {name} ---")
    print(f"Number of Forbidden Words: {len(forbidden_words)}")

    sizes_kb = [100, 500]
    iterations = 20

    # Pre-compile regex
    pattern = re.compile("|".join(map(re.escape, forbidden_words)))

    print(f"{'Size (KB)':<10} | {'Naive (ms)':<10} | {'Regex (ms)':<10} | {'Speedup':<8}")
    print("-" * 50)

    for size in sizes_kb:
        content = content_gen_func(size, forbidden_words)

        # Warmup
        check_naive(content, forbidden_words)
        check_optimized(content, forbidden_words, pattern)

        # Naive
        start = time.perf_counter()
        for _ in range(iterations):
            check_naive(content, forbidden_words)
        avg_naive = (time.perf_counter() - start) / iterations * 1000

        # Optimized
        start = time.perf_counter()
        for _ in range(iterations):
            check_optimized(content, forbidden_words, pattern)
        avg_opt = (time.perf_counter() - start) / iterations * 1000

        speedup = avg_naive / avg_opt if avg_opt > 0 else 0
        print(f"{size:<10} | {avg_naive:<10.3f} | {avg_opt:<10.3f} | {speedup:.2f}x")

def run_benchmarks():
    # Scenario: Small List (5), Realistic
    benchmark_scenario(
        "Small List (5), Realistic Density",
        FORBIDDEN_WORDS_SMALL,
        generate_content_realistic
    )

    # Scenario: Large List (100), Realistic
    benchmark_scenario(
        "Large List (100), Realistic Density",
        FORBIDDEN_WORDS_LARGE,
        generate_content_realistic
    )

if __name__ == "__main__":
    run_benchmarks()
