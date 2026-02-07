# 工具定义 (Tool Definitions - MCP)

> **版本**: 2.0  
> **协议**: Model Context Protocol (MCP)  
> **状态**: 正式规范

---

## 一、概述

本文档定义了写作Agent系统所需的所有MCP工具接口，包括：
- **Obsidian Interface**: Markdown文档读写、Dataview查询
- **Lark Base Interface**: 飞书多维表格CRUD操作  
- **RAG/Search Interface**: 知识检索与伏笔追踪

---

## 二、Obsidian MCP 工具

### 2.1 工具清单

| 工具名 | 功能 | 权限 |
|--------|------|------|
| `obsidian_read_note` | 读取笔记内容 | read |
| `obsidian_write_note` | 写入/更新笔记 | write |
| `obsidian_append_note` | 追加内容到笔记 | write |
| `obsidian_query_dataview` | 执行Dataview查询 | read |
| `obsidian_search` | 全文搜索 | read |
| `obsidian_get_backlinks` | 获取反向链接 | read |
| `obsidian_list_directory` | 列出目录内容 | read |

### 2.2 工具定义

```yaml
obsidian_read_note:
  description: 读取Obsidian笔记的完整内容，包括frontmatter
  parameters:
    path:
      type: string
      required: true
      description: 笔记路径，相对于Vault根目录
      example: "03-Characters/艾琳.md"
  returns:
    content: string        # Markdown内容
    frontmatter: object    # YAML frontmatter解析结果
    exists: boolean
  errors:
    - NOTE_NOT_FOUND: 笔记不存在
    - PERMISSION_DENIED: 无读取权限

---

obsidian_write_note:
  description: 创建或覆盖Obsidian笔记
  parameters:
    path:
      type: string
      required: true
      description: 笔记路径
    content:
      type: string
      required: true
      description: Markdown内容(包含frontmatter)
    create_directories:
      type: boolean
      default: true
      description: 是否自动创建父目录
  returns:
    success: boolean
    path: string
  errors:
    - WRITE_FAILED: 写入失败
    - INVALID_PATH: 路径无效

---

obsidian_append_note:
  description: 在笔记末尾追加内容
  parameters:
    path:
      type: string
      required: true
    content:
      type: string
      required: true
    separator:
      type: string
      default: "\n\n"
      description: 追加内容前的分隔符
  returns:
    success: boolean
    new_length: integer    # 追加后的总字数

---

obsidian_query_dataview:
  description: 执行Dataview DQL查询
  parameters:
    query:
      type: string
      required: true
      description: Dataview查询语句
      example: 'TABLE status, chapter FROM "06-Chapters" WHERE status = "草稿"'
    format:
      type: enum[table, list, task]
      default: table
  returns:
    results: array[object]
    count: integer
  errors:
    - QUERY_SYNTAX_ERROR: 查询语法错误
    - DATAVIEW_NOT_INSTALLED: Dataview插件未安装

---

obsidian_search:
  description: 全文搜索笔记
  parameters:
    keyword:
      type: string
      required: true
    path_prefix:
      type: string
      description: 限制搜索范围
      example: "03-Characters/"
    limit:
      type: integer
      default: 20
  returns:
    results:
      - path: string
        matches: array[object]  # 匹配的上下文

---

obsidian_get_backlinks:
  description: 获取指向指定笔记的所有反向链接
  parameters:
    path:
      type: string
      required: true
  returns:
    backlinks:
      - source_path: string
        context: string        # 链接所在的上下文

---

obsidian_list_directory:
  description: 列出目录下的所有文件和子目录
  parameters:
    path:
      type: string
      required: true
    recursive:
      type: boolean
      default: false
    filter:
      type: string
      description: 文件名过滤模式(glob)
      example: "*.md"
  returns:
    items:
      - name: string
        type: enum[file, directory]
        path: string
```

---

## 三、飞书多维表格 MCP 工具

### 3.1 工具清单

| 工具名 | 功能 | 权限 |
|--------|------|------|
| `lark_get_records` | 查询记录 | read |
| `lark_create_record` | 创建记录 | write |
| `lark_update_record` | 更新记录 | write |
| `lark_delete_record` | 删除记录 | write |
| `lark_batch_update` | 批量更新 | write |
| `lark_get_table_schema` | 获取表结构 | read |

### 3.2 工具定义

```yaml
lark_get_records:
  description: 从飞书多维表格查询记录
  parameters:
    app_token:
      type: string
      required: true
      description: 多维表格App Token
    table_id:
      type: string
      required: true
      description: 表格ID
    filter:
      type: object
      description: 筛选条件
      example:
        conditions:
          - field_name: "状态"
            operator: "is"
            value: ["进行中"]
        conjunction: "and"
    sort:
      type: array
      description: 排序规则
      example:
        - field_name: "创建时间"
          desc: true
    page_size:
      type: integer
      default: 100
      max: 500
  returns:
    records:
      - record_id: string
        fields: object
    has_more: boolean
    page_token: string

---

lark_create_record:
  description: 在飞书多维表格创建新记录
  parameters:
    app_token:
      type: string
      required: true
    table_id:
      type: string
      required: true
    fields:
      type: object
      required: true
      description: 字段名到值的映射
      example:
        "场景ID": "CH01-SC01"
        "状态": "待写作"
        "视角人物": "艾琳"
  returns:
    record_id: string
    created: boolean

---

lark_update_record:
  description: 更新飞书多维表格记录
  parameters:
    app_token:
      type: string
      required: true
    table_id:
      type: string
      required: true
    record_id:
      type: string
      required: true
    fields:
      type: object
      required: true
  returns:
    success: boolean

---

lark_batch_update:
  description: 批量更新多条记录
  parameters:
    app_token:
      type: string
      required: true
    table_id:
      type: string
      required: true
    records:
      type: array
      required: true
      items:
        record_id: string
        fields: object
  returns:
    success_count: integer
    failed_count: integer
    errors: array

---

lark_get_table_schema:
  description: 获取表格字段定义
  parameters:
    app_token:
      type: string
      required: true
    table_id:
      type: string
      required: true
  returns:
    fields:
      - field_id: string
        field_name: string
        field_type: enum[text, number, select, date, ...]
        options: object  # 对于select类型，包含选项列表
```

---

## 四、RAG/Search MCP 工具

### 4.1 工具清单

| 工具名 | 功能 | 说明 |
|--------|------|------|
| `rag_search_foreshadows` | 伏笔检索 | 查找与当前情节相关的伏笔 |
| `rag_search_character_history` | 角色历史检索 | 查找角色在之前章节的行为/状态 |
| `rag_search_world_rules` | 世界观规则检索 | 查找相关设定规则 |
| `rag_semantic_search` | 通用语义搜索 | 基于语义相似度搜索 |

### 4.2 工具定义

```yaml
rag_search_foreshadows:
  description: 检索与当前写作相关的伏笔
  parameters:
    query:
      type: string
      required: true
      description: 检索query(当前场景/情节描述)
    chapter_range:
      type: array[integer, integer]
      description: 限制检索的章节范围
      example: [1, 10]
    status_filter:
      type: array[string]
      description: 伏笔状态筛选
      example: ["已埋下", "待回收"]
    top_k:
      type: integer
      default: 5
  returns:
    foreshadows:
      - id: string
        description: string
        planted_chapter: integer
        status: string
        relevance_score: float

---

rag_search_character_history:
  description: 检索角色在之前章节的历史记录
  parameters:
    character_name:
      type: string
      required: true
    query:
      type: string
      description: 具体查询(如"与艾琳的互动")
    chapter_before:
      type: integer
      description: 只检索此章节之前的历史
  returns:
    events:
      - chapter: integer
        scene_id: string
        summary: string
        emotional_state: string
        relationships_changed: array

---

rag_search_world_rules:
  description: 检索世界观设定规则
  parameters:
    topic:
      type: string
      required: true
      description: 主题(如"魔法规则", "社会等级")
    category:
      type: enum[magic, society, geography, history, technology]
  returns:
    rules:
      - rule_id: string
        description: string
        source_file: string
        constraints: array[string]

---

rag_semantic_search:
  description: 通用语义相似度搜索
  parameters:
    query:
      type: string
      required: true
    search_scope:
      type: array[string]
      description: 搜索范围(目录路径)
      example: ["02-WorldBuilding/", "03-Characters/"]
    top_k:
      type: integer
      default: 10
  returns:
    results:
      - path: string
        content_snippet: string
        similarity_score: float
```

---

## 五、工具使用示例

### 5.1 章节创建流程的工具调用

```python
# 1. 获取章节大纲
outline = await obsidian_read_note(path="05-Outline/第3章大纲.md")

# 2. 查询相关角色
characters_query = '''
TABLE name, traits, motivation 
FROM "03-Characters" 
WHERE contains(appears_in, "第3章")
'''
characters = await obsidian_query_dataview(query=characters_query)

# 3. 获取伏笔任务
foreshadows = await rag_search_foreshadows(
    query="第3章场景",
    chapter_range=[1, 3],
    status_filter=["待埋下", "待回收"]
)

# 4. 检索相关世界设定
world_rules = await rag_search_world_rules(topic="魔法能力限制")

# 5. 写入草稿
await obsidian_write_note(
    path="06-Chapters/草稿/第3章.md",
    content=generated_chapter
)

# 6. 更新飞书进度表
await lark_update_record(
    app_token=APP_TOKEN,
    table_id=PROGRESS_TABLE,
    record_id=chapter_3_record_id,
    fields={"状态": "草稿完成", "字数": 3500}
)
```

---

## 六、错误处理规范

```yaml
ErrorHandling:
  策略:
    - 所有工具调用必须有try-catch
    - 失败时记录详细错误日志
    - 对于非关键工具，允许降级处理
    
  重试策略:
    max_retries: 3
    backoff: exponential
    initial_delay: 1s
    
  降级处理:
    obsidian_query_dataview失败:
      fallback: 使用obsidian_search + 手动过滤
    rag_search失败:
      fallback: 使用obsidian_search作为基础检索
    lark写入失败:
      fallback: 本地缓存，稍后重试
```

---

## 七、版本历史

| 版本 | 日期 | 变更说明 |
|------|------|----------|
| 1.0 | 2026-01-24 | 初始版本 |
| 2.0 | 2026-01-25 | 完善MCP工具定义，增加RAG接口 |

---

*文档结束*
