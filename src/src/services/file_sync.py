import time
import logging
import threading
from pathlib import Path
from typing import List, Optional, Callable
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileSystemEvent

logger = logging.getLogger("FileSyncService")

class AutoSyncHandler(FileSystemEventHandler):
    """
    Watchdog handler that triggers a callback on file modification.
    """
    def __init__(self, callback: Callable[[str], None], patterns: List[str] = None):
        self.callback = callback
        self.patterns = patterns or ["*.md", "*.txt"]

    def _is_relevant(self, path: str) -> bool:
        # Simple glob matching
        # In production, use fnmatch or wcmatch for robust globbing
        p = Path(path)
        return p.suffix in [".md", ".txt"] # Simplification for demo

    def on_modified(self, event: FileSystemEvent):
        if event.is_directory:
            return
        if self._is_relevant(event.src_path):
            logger.info(f"File modified: {event.src_path}")
            self.callback(event.src_path)

    def on_created(self, event: FileSystemEvent):
        if event.is_directory:
            return
        if self._is_relevant(event.src_path):
            logger.info(f"File created: {event.src_path}")
            self.callback(event.src_path)

class FileSyncService:
    """
    Service to automatically sync file system changes to the AgentKnowledgeLayer.
    Implements OpenKL's 'File as Truth' philosophy.
    """

    def __init__(self, knowledge_layer: Any, watch_paths: List[str]):
        """
        Args:
            knowledge_layer: Instance of AgentKnowledgeLayer to update.
            watch_paths: List of directory paths to watch.
        """
        self.knowledge_layer = knowledge_layer
        self.watch_paths = [Path(p) for p in watch_paths]
        self.observer = Observer()
        self._handler = AutoSyncHandler(self._on_file_change)
        self._thread = None
        self._stop_event = threading.Event()

    def _on_file_change(self, file_path: str):
        """Callback when a file changes. Triggers re-ingestion."""
        try:
            # Debounce logic could go here
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Use file path hash or relative path as doc_id
            doc_id = str(Path(file_path).name) 
            
            logger.info(f"Auto-syncing document: {doc_id}")
            self.knowledge_layer.add_document(doc_id, content, source_type="auto-sync")
            
        except Exception as e:
            logger.error(f"Failed to sync file {file_path}: {e}")

    def start(self):
        """Start the background file watcher."""
        for path in self.watch_paths:
            if path.exists():
                self.observer.schedule(self._handler, str(path), recursive=True)
                logger.info(f"Watching directory: {path}")
            else:
                logger.warning(f"Watch directory does not exist: {path}")

        self.observer.start()
        logger.info("FileSyncService started.")

    def stop(self):
        """Stop the background watcher."""
        self.observer.stop()
        self.observer.join()
        logger.info("FileSyncService stopped.")
