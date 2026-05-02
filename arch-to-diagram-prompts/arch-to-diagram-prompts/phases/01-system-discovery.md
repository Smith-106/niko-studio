# Phase 1: System Discovery & Mapping

Scan the target directory to build a comprehensive component inventory with types, relationships, and structural hierarchy.

## Objective

- Map the full directory structure of the target path
- Classify components by type (commands, skills, agents, configs, modules, etc.)
- Identify inter-component relationships (references, imports, dependencies)
- Produce a structured `systemInventory` for downstream phases

## Execution

### Step 1.1: Directory Structure Scan

Scan the target path to get the full file tree:

```bash
# Get directory tree (depth-limited for large projects)
find "${targetPath}" -type f -not -path '*/node_modules/*' -not -path '*/.git/*' | head -500
```

If the target has more than 500 files, auto-scope:
1. Top-level files and directories
2. Key config files (package.json, tsconfig.json, CLAUDE.md, etc.)
3. Entry points and index files
4. README / documentation files

Use `Glob` and `Bash(tree)` for efficient scanning.

### Step 1.2: Component Type Classification

Read representative files from each directory to classify component types:

| Component Type | Detection Signals |
|---------------|-------------------|
| **Command** | `.claude/commands/*.md`, frontmatter with `name`/`description` |
| **Skill** | `.claude/skills/*/SKILL.md`, frontmatter with `allowed-tools` |
| **Agent** | `.claude/agents/*.md`, role definitions |
| **Config** | `*.json`, `*.yaml`, `*.toml` in root or config dirs |
| **Source Module** | `src/**/*.{ts,js,py,go}` with exports |
| **Template** | `templates/`, pattern files |
| **Workflow** | Phase files, pipeline definitions |
| **Documentation** | `*.md` non-command files, wiki entries |

For each type found, count instances and note key examples.

### Step 1.3: Relationship Mapping

Scan for cross-references between components:

```
Grep patterns:
- `Ref:` / `@` references in markdown
- `import`/`require`/`from` in source code
- `Skill(skill="...")` invocations
- `Read("phases/...")` direct phase handoffs
- `--to` / `--rule` delegate references
- Frontmatter `allowed-tools` dependencies
```

Build a relationship list:
```
{ from: "component-A", to: "component-B", type: "references|imports|invokes|delegates" }
```

### Step 1.4: Build System Inventory

Assemble the structured inventory:

```
systemInventory = {
  name: "<derived from directory name or config>",
  targetPath: "<absolute path>",
  totalFiles: N,
  componentTypes: {
    "<type>": { count: N, examples: ["file1", "file2", ...], directory: "path" }
  },
  relationships: [
    { from, to, type }
  ],
  fileTree: "<indented tree string>",
  keyFiles: ["<most important files for understanding the system>"],
  scale: "small|medium|large"  // <50 files | 50-200 | >200
}
```

## Output

- **Variable**: `systemInventory` — structured object with components, relationships, file tree
- **TodoWrite**: Mark Phase 1 completed, Phase 2 in_progress

## Next Phase

Return to orchestrator, then auto-continue to [Phase 2: Design Essence Extraction](02-essence-extraction.md).
