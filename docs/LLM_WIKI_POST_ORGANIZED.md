# Karpathy "LLM Wiki" Post, Organized

Source:

- Gist: <https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f>
- Raw markdown: <https://gist.githubusercontent.com/karpathy/442a6bf555914893e9891c11519de94f/raw/ac46de1ad27f92b28ac95459c782c07f6b8c964a/llm-wiki.md>

## One-Sentence Thesis

Instead of using LLMs as a query-time RAG layer over raw documents, use them to continuously maintain a persistent, interlinked markdown wiki that compounds knowledge over time.

## What Problem The Post Is Solving

The post argues that standard RAG has a structural weakness:

- every query re-discovers context from raw files,
- subtle synthesis must be rebuilt repeatedly,
- and nothing durable accumulates unless a human manually curates it.

The proposed alternative is a knowledge base that becomes richer each time:

- when a new source arrives,
- when a contradiction is found,
- or when a useful answer should be promoted into durable knowledge.

## Core Idea

The post's central pattern is:

- raw sources stay immutable,
- the LLM reads them and maintains a markdown wiki,
- and the wiki becomes the main knowledge layer between humans and sources.

The wiki is not just a cache.
It is meant to be:

- persistent,
- interlinked,
- revised over time,
- and treated as the accumulated synthesis layer.

## Mental Model

The post gives a strong metaphor:

- Obsidian is the IDE,
- the LLM is the programmer,
- the wiki is the codebase.

That framing matters because it implies:

- the knowledge base is editable,
- maintenance is continuous rather than one-off,
- and the LLM is expected to touch many files in one pass.

## Suggested Architecture

The post describes three layers:

1. Raw sources
   - curated source documents
   - immutable
   - source of truth

2. The wiki
   - markdown pages generated and maintained by the LLM
   - summaries, entity pages, concept pages, comparisons, synthesis

3. The schema
   - an instruction file such as `AGENTS.md` or `CLAUDE.md`
   - defines conventions, structure, and maintenance workflows

## Main Operations

### Ingest

When a new source is added:

- the LLM reads it,
- extracts key takeaways,
- writes or updates wiki pages,
- updates the index,
- and appends a log entry.

The post explicitly prefers integrated updates over isolated summaries.

### Query

Questions are answered from the wiki first.

Useful answers should be promotable back into the wiki as new durable pages.
This avoids losing synthesis inside ephemeral chat history.

### Lint

The wiki should be periodically checked for:

- contradictions,
- stale claims,
- orphan pages,
- missing cross-references,
- and gaps that suggest new research.

## Special Files

The post recommends two especially important files:

### `index.md`

- content-oriented
- organized by category
- links to pages with one-line summaries
- used as the first navigation surface for the LLM

### `log.md`

- chronological
- append-only
- records ingests, queries, and lint passes
- doubles as the change timeline of the wiki

## Optional Tooling

The post treats extra tooling as optional, not foundational.

Examples mentioned:

- local markdown search such as `qmd`
- shell utilities for parsing logs
- additional output formats such as slides or charts

The order of importance is clear:

- wiki conventions first,
- operational workflow second,
- specialized tooling later.

## Obsidian-Specific Ideas Mentioned

The post uses Obsidian as the preferred viewing and navigation environment.

Specific benefits it points to:

- real-time browsing of updated markdown pages,
- following links between notes,
- using graph view to inspect the shape of the knowledge base,
- Web Clipper for ingesting articles,
- local download of images for durable reference,
- optional plugins such as Marp and Dataview.

## Example Use Cases In The Post

The post says the pattern can work for:

- personal reflection and self-tracking,
- research and paper reading,
- reading a book and building a companion wiki,
- internal team knowledge,
- competitive analysis,
- due diligence,
- travel planning,
- and long-running hobby or study domains.

## Why The Author Thinks It Works

The core claim is that humans abandon knowledge systems because maintenance costs are too high.

The post argues LLMs change that economics because they can:

- update many pages at once,
- keep cross-references current,
- track contradictions,
- and do repetitive bookkeeping without fatigue.

In that model:

- the human curates sources and asks good questions,
- the LLM handles maintenance.

## Important Constraints In The Post

The post is intentionally abstract.
It does not prescribe:

- one directory structure,
- one page format,
- one search engine,
- or one output shape.

Instead, it presents a pattern:

- persistent markdown wiki,
- LLM as maintainer,
- schema-driven operations,
- and compounding synthesis.

## Most Important Takeaways For Implementation

If we strip the post down to implementation essentials, the non-optional ideas are:

1. `raw` and `wiki` must be separate.
2. The wiki must be persistent and editable as files.
3. Ingest must update existing knowledge, not just append notes.
4. Query results worth keeping should be written back.
5. Lint must exist, otherwise the wiki decays.
6. A schema/instruction file is required, otherwise the LLM becomes a generic chatbot instead of a disciplined maintainer.
