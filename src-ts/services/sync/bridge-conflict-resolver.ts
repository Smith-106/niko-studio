export interface ConflictItem {
  type: 'entity_type' | 'memory_content' | 'relation_type'
  localId: string
  remoteId: string
  localValue: unknown
  remoteValue: unknown
  description: string
}

export type ConflictResolution = 'local_wins' | 'remote_wins' | 'manual'

export class BridgeConflictResolver {
  private queue: ConflictItem[] = []

  /** 检测并解决冲突 */
  resolve(conflict: ConflictItem): ConflictResolution {
    switch (conflict.type) {
      case 'entity_type':
        // 引擎层是领域权威，实体类型以本地为准
        return 'local_wins'
      case 'memory_content':
        // 记忆内容以时间戳最新为准 — 默认远端（Nowledge Mem 有衰减机制）
        return 'remote_wins'
      case 'relation_type':
        // 关系类型冲突标记为人工裁决
        this.queue.push(conflict)
        return 'manual'
    }
  }

  /** 获取待人工裁决的冲突 */
  getPendingConflicts(): ConflictItem[] {
    return this.queue
  }

  /** 人工解决冲突 */
  resolveManual(conflictIndex: number, resolution: ConflictResolution) {
    if (conflictIndex >= 0 && conflictIndex < this.queue.length) {
      this.queue.splice(conflictIndex, 1)
    }
  }

  /** 推送冲突到审核队列 */
  enqueue(conflict: ConflictItem) {
    this.queue.push(conflict)
  }
}
