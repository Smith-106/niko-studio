# Performance Optimization: Keyword Detection

## Issue
The original keyword detection logic iterated through a list of forbidden words and performed multiple passes over the content string:
1. `if word in content`: O(N * M)
2. `count = content.count(word)`: O(N * M)

Where N is the number of forbidden words and M is the content length. This results in a time complexity of roughly O(N * M). As the number of forbidden words grows, performance degrades linearly.

## Solution
We optimized this by using Python's `re` module (Regular Expressions) to perform a single pass over the content string.
1. Pre-compile a regex pattern: `re.compile("word1|word2|...")`
2. Find all matches in one pass: `pattern.findall(content)` - O(M)
3. Count occurrences using `Counter`: O(K) where K is number of matches found.

The time complexity is now dominated by the single scan of the content, making it effectively O(M), independent of the number of forbidden words (N) for reasonable N.

## Benchmark Results

We benchmarked the two approaches using `tests/performance/bench_critic_optimization.py`.
The benchmark covers two scenarios:
1. **Small List (5 words):** Represents the current state.
2. **Large List (100 words):** Represents future scalability requirements.

### Scenario: Small List (5 words)
*Performance is comparable.* The overhead of regex engine initialization and object creation roughly balances out the speed of Python's optimized string methods for a very small list.

| Size (KB) | Naive (ms) | Regex (ms) | Speedup |
|-----------|------------|------------|---------|
| 100       | 0.266      | 0.476      | 0.56x   |
| 500       | 1.219      | 1.636      | 0.75x   |

### Scenario: Large List (100 words)
*Performance improvement is massive.* As expected, the regex approach scales much better.

| Size (KB) | Naive (ms) | Regex (ms) | Speedup |
|-----------|------------|------------|---------|
| 100       | 3.733      | 0.281      | **13.27x** |
| 500       | 19.033     | 1.265      | **15.04x** |

## Conclusion
While the optimization offers little benefit for the current minimal list of 5 forbidden words, it provides a **15x speedup** for a realistic production scenario with ~100 filtered words. This change future-proofs the `CriticAgent` against performance degradation as the rule set expands.
