import React, { useState, useCallback } from 'react'
import {
  FolderOpen,
  BookOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  Plus,
  PanelLeftClose,
  Folder,
} from 'lucide-react'
import { useAppStore } from '../stores/appStore'
import { useProjectSidebarState } from '../stores/selectors'
import { writeChapterContent, writeProjectMeta } from '../services/projectFileService'

type UnsavedToast = { visible: boolean; pendingChapterId: string | null }

export const ProjectSidebar = React.memo(function ProjectSidebar() {
  const {
    projectsById,
    allProjectIds,
    currentProjectId,
    volumesByProjectId,
    chaptersByVolumeId,
    currentChapterId,
    sidebarExpanded,
    toggleSidebar,
    selectProject,
    selectChapter,
    addVolume,
    addChapter,
    createNewProject,
    editorIsDirty,
    setEditorIsDirty,
  } = useProjectSidebarState()

  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({})
  const [expandedVolumes, setExpandedVolumes] = useState<Record<string, boolean>>({})
  const [unsavedToast, setUnsavedToast] = useState<UnsavedToast>({ visible: false, pendingChapterId: null })

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => ({ ...prev, [projectId]: !prev[projectId] }))
    selectProject(projectId)
  }

  const toggleVolume = (volumeId: string) => {
    setExpandedVolumes((prev) => ({ ...prev, [volumeId]: !prev[volumeId] }))
  }

  const handleChapterSelect = useCallback((id: string) => {
    if (editorIsDirty) {
      setUnsavedToast({ visible: true, pendingChapterId: id })
      return
    }
    selectChapter(id)
  }, [editorIsDirty, selectChapter])

  const handleDiscardAndSwitch = useCallback(() => {
    const id = unsavedToast.pendingChapterId
    setEditorIsDirty(false)
    setUnsavedToast({ visible: false, pendingChapterId: null })
    if (id) selectChapter(id)
  }, [unsavedToast.pendingChapterId, setEditorIsDirty, selectChapter])

  const handleCancelSwitch = useCallback(() => {
    setUnsavedToast({ visible: false, pendingChapterId: null })
  }, [])

  const handleAddProject = async () => {
    const id = createNewProject('新项目')
    const volumes = useAppStore.getState().volumesByProjectId[id] ?? []
    const chapters: string[] = []
    for (const v of volumes) {
      const chs = useAppStore.getState().chaptersByVolumeId[v.id] ?? []
      chapters.push(...chs.map((c) => c.id))
    }
    const meta = {
      project: useAppStore.getState().projectsById[id],
      volumes,
      chapters: chapters.length > 0
        ? Object.values(useAppStore.getState().chaptersByVolumeId).flat()
        : [],
    }
    await writeProjectMeta(meta)
    setExpandedProjects((prev) => ({ ...prev, [id]: true }))
  }

  const handleAddVolume = (projectId: string) => {
    const volumes = volumesByProjectId[projectId] ?? []
    addVolume(projectId, `卷${volumes.length + 1}`)
  }

  const handleAddChapter = async (volumeId: string, projectId: string) => {
    const chapters = chaptersByVolumeId[volumeId] ?? []
    addChapter(volumeId, `第${chapters.length + 1}章`)
    const newChapters = useAppStore.getState().chaptersByVolumeId[volumeId]
    if (newChapters.length > chapters.length) {
      const newChapter = newChapters[newChapters.length - 1]
      const emptyDoc = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] })
      await writeChapterContent(projectId, newChapter.id, emptyDoc)
    }
  }

  const currentProject = currentProjectId ? projectsById[currentProjectId] : null

  if (!sidebarExpanded) {
    return (
      <button
        onClick={toggleSidebar}
        className="flex flex-col items-center justify-center gap-1 w-10 py-2 text-dark-text-secondary hover:text-dark-text hover:bg-dark-surface rounded-lg transition-colors"
        title="展开项目面板"
      >
        <Folder size={16} />
        {currentProject && (
          <span className="text-[9px] font-medium leading-none truncate max-w-[36px]">
            {(currentProject.name || '?').charAt(0)}
          </span>
        )}
      </button>
    )
  }

  return (
    <aside className="flex flex-col bg-dark-bg text-dark-text border-r border-dark-border w-64 shrink-0 overflow-hidden">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-dark-border shrink-0">
        <span className="font-semibold text-sm tracking-wide">项目</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleAddProject}
            className="flex items-center justify-center w-7 h-7 rounded hover:bg-dark-surface text-dark-text-secondary hover:text-dark-text transition-colors"
            title="新建项目"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={toggleSidebar}
            className="flex items-center justify-center w-7 h-7 rounded hover:bg-dark-surface text-dark-text-secondary hover:text-dark-text transition-colors"
            title="收起面板"
          >
            <PanelLeftClose size={16} />
          </button>
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto custom-scrollbar py-2 px-2">
        {allProjectIds.map((projectId) => {
          const project = projectsById[projectId]
          if (!project) return null
          const volumes = volumesByProjectId[projectId] ?? []
          const isExpanded = expandedProjects[projectId] ?? false
          const isActive = currentProjectId === projectId

          return (
            <div key={projectId} className="mb-1">
              <button
                onClick={() => toggleProject(projectId)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-primary-900/20 text-primary-300'
                    : 'text-dark-text-secondary hover:bg-dark-surface hover:text-dark-text'
                }`}
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <FolderOpen size={14} />
                <span className="truncate">{project.name}</span>
              </button>

              {isExpanded && (
                <div className="ml-4 mt-0.5">
                  {volumes.map((volume) => {
                    const chapters = chaptersByVolumeId[volume.id] ?? []
                    const isVolExpanded = expandedVolumes[volume.id] ?? false

                    return (
                      <div key={volume.id} className="mb-0.5">
                        <button
                          onClick={() => toggleVolume(volume.id)}
                          className="w-full flex items-center gap-2 px-2 py-1 rounded text-sm text-dark-text-secondary hover:bg-dark-surface hover:text-dark-text transition-colors"
                        >
                          {isVolExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          <BookOpen size={12} />
                          <span className="truncate">{volume.title}</span>
                        </button>

                        {isVolExpanded && (
                          <div className="ml-4">
                            {chapters.map((chapter) => (
                              <button
                                key={chapter.id}
                                onClick={() => handleChapterSelect(chapter.id)}
                                className={`w-full flex items-center gap-2 px-2 py-1 rounded text-sm transition-colors ${
                                  currentChapterId === chapter.id
                                    ? 'bg-primary-900/20 text-primary-300 font-medium'
                                    : 'text-dark-text-muted hover:bg-dark-surface hover:text-dark-text'
                                }`}
                              >
                                <FileText size={12} />
                                <span className="truncate">{chapter.title}</span>
                              </button>
                            ))}
                            <button
                              onClick={() => handleAddChapter(volume.id, projectId)}
                              className="w-full flex items-center gap-2 px-2 py-1 rounded text-xs text-dark-text-muted hover:text-dark-text hover:bg-dark-surface transition-colors"
                            >
                              <Plus size={12} />
                              <span>添加章节</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  <button
                    onClick={() => handleAddVolume(projectId)}
                    className="w-full flex items-center gap-2 px-2 py-1 rounded text-xs text-dark-text-muted hover:text-dark-text hover:bg-dark-surface transition-colors"
                  >
                    <Plus size={12} />
                    <span>添加卷</span>
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Unsaved changes toast */}
      {unsavedToast.visible && (
        <div className="shrink-0 border-t border-amber-500/30 bg-amber-900/20 px-3 py-2.5">
          <p className="text-xs text-amber-200 font-medium mb-2">当前章节有未保存的修改，切换将丢弃。</p>
          <div className="flex gap-2">
            <button
              onClick={handleDiscardAndSwitch}
              className="text-xs px-2.5 py-1 rounded bg-amber-600/80 text-white font-medium hover:bg-amber-500 transition-colors"
            >
              放弃并切换
            </button>
            <button
              onClick={handleCancelSwitch}
              className="text-xs px-2.5 py-1 rounded border border-dark-border2 text-dark-text-secondary hover:text-dark-text hover:bg-dark-surface2 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </aside>
  )
})
