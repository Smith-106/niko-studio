import time
import logging
import threading
import hashlib
import json
from pathlib import Path
from typing import List, Optional, Callable, Dict, Any, Set
from datetime import datetime
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileSystemEvent

logger = logging.getLogger("FileSyncService")


class FileChangeEvent:
    """Represents a file change event with metadata."""

    def __init__(self, path: str, event_type: str, timestamp: float = None):
        self.path = path
        self.event_type = event_type  # "created", "modified", "deleted"
        self.timestamp = timestamp or time.time()
        self.content_hash: Optional[str] = None

    def compute_hash(self) -> Optional[str]:
        """Compute SHA256 hash of file content."""
        try:
            with open(self.path, 'rb') as f:
                self.content_hash = hashlib.sha256(f.read()).hexdigest()
            return self.content_hash
        except Exception:
            return None


class FileWatcher:
    """
    Standalone file watcher with callback registration.
    Implements the required interface:
    - watch(directory) -> start watching
    - stop() -> stop watching
    - on_change(callback) -> register change callback
    """

    def __init__(self, patterns: List[str] = None, debounce_seconds: float = 1.0):
        """
        Args:
            patterns: File patterns to watch (e.g., ["*.md", "*.txt"])
            debounce_seconds: Debounce delay to avoid duplicate events
        """
        self.patterns = patterns or ["*.md", "*.txt", "*.json"]
        self.debounce_seconds = debounce_seconds
        self._callbacks: List[Callable[[FileChangeEvent], None]] = []
        self._observer: Optional[Observer] = None
        self._watched_dirs: Set[str] = set()
        self._last_events: Dict[str, float] = {}
        self._lock = threading.Lock()
        self._running = False

    def on_change(self, callback: Callable[[FileChangeEvent], None]) -> None:
        """Register a callback for file changes."""
        with self._lock:
            self._callbacks.append(callback)

    def remove_callback(self, callback: Callable[[FileChangeEvent], None]) -> None:
        """Remove a registered callback."""
        with self._lock:
            if callback in self._callbacks:
                self._callbacks.remove(callback)

    def watch(self, directory: str) -> bool:
        """
        Start watching a directory.

        Args:
            directory: Directory path to watch

        Returns:
            True if successfully started watching
        """
        dir_path = Path(directory)
        if not dir_path.exists():
            logger.warning(f"Directory does not exist: {directory}")
            return False

        dir_str = str(dir_path.resolve())

        with self._lock:
            if dir_str in self._watched_dirs:
                logger.debug(f"Already watching: {directory}")
                return True

            if self._observer is None:
                self._observer = Observer()
                self._observer.start()
                self._running = True

            handler = _InternalHandler(self)
            self._observer.schedule(handler, dir_str, recursive=True)
            self._watched_dirs.add(dir_str)

        logger.info(f"Started watching directory: {directory}")
        return True

    def stop(self) -> None:
        """Stop all file watching."""
        with self._lock:
            if self._observer:
                self._observer.stop()
                self._observer.join(timeout=5)
                self._observer = None
            self._watched_dirs.clear()
            self._running = False
        logger.info("FileWatcher stopped")

    def is_running(self) -> bool:
        """Check if watcher is running."""
        return self._running

    def _is_relevant(self, path: str) -> bool:
        """Check if file matches watched patterns."""
        p = Path(path)
        suffix = p.suffix.lower()
        for pattern in self.patterns:
            if pattern.startswith("*."):
                if suffix == pattern[1:]:
                    return True
            elif pattern == p.name:
                return True
        return False

    def _should_debounce(self, path: str) -> bool:
        """Check if event should be debounced."""
        current_time = time.time()
        last_time = self._last_events.get(path, 0)
        if current_time - last_time < self.debounce_seconds:
            return True
        self._last_events[path] = current_time
        return False

    def _notify(self, event: FileChangeEvent) -> None:
        """Notify all registered callbacks."""
        with self._lock:
            callbacks = list(self._callbacks)
        for callback in callbacks:
            try:
                callback(event)
            except Exception as e:
                logger.error(f"Callback error for {event.path}: {e}")


class _InternalHandler(FileSystemEventHandler):
    """Internal watchdog handler that delegates to FileWatcher."""

    def __init__(self, watcher: FileWatcher):
        self.watcher = watcher

    def on_modified(self, event: FileSystemEvent):
        if event.is_directory:
            return
        if not self.watcher._is_relevant(event.src_path):
            return
        if self.watcher._should_debounce(event.src_path):
            return
        change_event = FileChangeEvent(event.src_path, "modified")
        change_event.compute_hash()
        logger.debug(f"File modified: {event.src_path}")
        self.watcher._notify(change_event)

    def on_created(self, event: FileSystemEvent):
        if event.is_directory:
            return
        if not self.watcher._is_relevant(event.src_path):
            return
        if self.watcher._should_debounce(event.src_path):
            return
        change_event = FileChangeEvent(event.src_path, "created")
        change_event.compute_hash()
        logger.debug(f"File created: {event.src_path}")
        self.watcher._notify(change_event)

    def on_deleted(self, event: FileSystemEvent):
        if event.is_directory:
            return
        if not self.watcher._is_relevant(event.src_path):
            return
        change_event = FileChangeEvent(event.src_path, "deleted")
        logger.debug(f"File deleted: {event.src_path}")
        self.watcher._notify(change_event)


class AutoSyncHandler(FileSystemEventHandler):
    """
    Watchdog handler that triggers a callback on file modification.
    (Legacy handler for FileSyncService compatibility)
    """
    def __init__(self, callback: Callable[[str], None], patterns: List[str] = None):
        self.callback = callback
        self.patterns = patterns or ["*.md", "*.txt"]
        self._debounce_times: Dict[str, float] = {}
        self._debounce_seconds = 1.0

    def _is_relevant(self, path: str) -> bool:
        p = Path(path)
        suffix = p.suffix.lower()
        return suffix in [".md", ".txt", ".json"]

    def _should_debounce(self, path: str) -> bool:
        current_time = time.time()
        last_time = self._debounce_times.get(path, 0)
        if current_time - last_time < self._debounce_seconds:
            return True
        self._debounce_times[path] = current_time
        return False

    def on_modified(self, event: FileSystemEvent):
        if event.is_directory:
            return
        if self._is_relevant(event.src_path):
            if self._should_debounce(event.src_path):
                return
            logger.info(f"File modified: {event.src_path}")
            self.callback(event.src_path)

    def on_created(self, event: FileSystemEvent):
        if event.is_directory:
            return
        if self._is_relevant(event.src_path):
            if self._should_debounce(event.src_path):
                return
            logger.info(f"File created: {event.src_path}")
            self.callback(event.src_path)

class SyncResult:
    """Result of a sync operation."""

    def __init__(self, path: str, success: bool, action: str, message: str = ""):
        self.path = path
        self.success = success
        self.action = action  # "indexed", "updated", "deleted", "skipped"
        self.message = message
        self.timestamp = time.time()
        self.content_hash: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "path": self.path,
            "success": self.success,
            "action": self.action,
            "message": self.message,
            "timestamp": self.timestamp,
            "content_hash": self.content_hash
        }


class FileSyncService:
    """
    Service to automatically sync file system changes to the AgentKnowledgeLayer.
    Implements OpenKL's 'File as Truth' philosophy.

    Features:
    - Automatic file watching with debounce
    - Incremental sync (only changed files)
    - Hash-based change detection
    - Sync to memories/citations directories
    """

    def __init__(self, knowledge_layer: Any, watch_paths: List[str], writing_root: str = ".writing"):
        """
        Args:
            knowledge_layer: Instance of AgentKnowledgeLayer to update.
            watch_paths: List of directory paths to watch.
            writing_root: Root directory for .writing structure (OpenKL).
        """
        self.knowledge_layer = knowledge_layer
        self.watch_paths = [Path(p) for p in watch_paths]
        self.writing_root = Path(writing_root)
        self.observer = Observer()
        self._handler = AutoSyncHandler(self._on_file_change)
        self._thread = None
        self._stop_event = threading.Event()
        self._file_hashes: Dict[str, str] = {}
        self._sync_history: List[SyncResult] = []
        self._lock = threading.Lock()

        # Load existing hashes from index
        self._load_hash_index()

    def _load_hash_index(self) -> None:
        """Load file hash index from .ok directory."""
        index_path = self.writing_root / ".ok" / "index" / "file_hashes.json"
        if index_path.exists():
            try:
                with open(index_path, 'r', encoding='utf-8') as f:
                    self._file_hashes = json.load(f)
                logger.debug(f"Loaded {len(self._file_hashes)} file hashes from index")
            except Exception as e:
                logger.warning(f"Failed to load hash index: {e}")

    def _save_hash_index(self) -> None:
        """Save file hash index to .ok directory."""
        index_dir = self.writing_root / ".ok" / "index"
        index_dir.mkdir(parents=True, exist_ok=True)
        index_path = index_dir / "file_hashes.json"
        try:
            with open(index_path, 'w', encoding='utf-8') as f:
                json.dump(self._file_hashes, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save hash index: {e}")

    def _compute_file_hash(self, file_path: str) -> Optional[str]:
        """Compute SHA256 hash of file content."""
        try:
            with open(file_path, 'rb') as f:
                return hashlib.sha256(f.read()).hexdigest()
        except Exception:
            return None

    def _has_file_changed(self, file_path: str) -> bool:
        """Check if file has changed since last sync."""
        current_hash = self._compute_file_hash(file_path)
        if current_hash is None:
            return False
        stored_hash = self._file_hashes.get(file_path)
        return current_hash != stored_hash

    def _determine_target_dir(self, file_path: Path) -> str:
        """Determine target directory based on file location/type."""
        # Check if file is in store, memories, or citations
        rel_path = str(file_path)
        if "citations" in rel_path.lower():
            return "citations"
        elif "memories" in rel_path.lower():
            return "memories"
        else:
            return "store"

    def sync_file(self, file_path: str, force: bool = False) -> SyncResult:
        """
        Sync a single file to the knowledge layer.

        Args:
            file_path: Path to the file to sync.
            force: Force sync even if file hasn't changed.

        Returns:
            SyncResult with operation details.
        """
        path = Path(file_path)

        # Check if file exists
        if not path.exists():
            # File was deleted - remove from index
            with self._lock:
                if file_path in self._file_hashes:
                    del self._file_hashes[file_path]
                    self._save_hash_index()
            result = SyncResult(file_path, True, "deleted", "File removed from index")
            self._sync_history.append(result)
            return result

        # Check if file has changed (incremental sync)
        if not force and not self._has_file_changed(file_path):
            result = SyncResult(file_path, True, "skipped", "File unchanged")
            return result

        try:
            # Read file content
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Compute hash
            content_hash = self._compute_file_hash(file_path)

            # Generate document ID based on path
            doc_id = hashlib.md5(file_path.encode()).hexdigest()[:16]

            # Determine source type based on location
            target_dir = self._determine_target_dir(path)
            source_type = f"sync-{target_dir}"

            # Update knowledge layer
            is_new = file_path not in self._file_hashes
            self.knowledge_layer.add_document(doc_id, content, source_type=source_type)

            # Update hash index
            with self._lock:
                self._file_hashes[file_path] = content_hash
                self._save_hash_index()

            # Create result
            action = "indexed" if is_new else "updated"
            result = SyncResult(file_path, True, action, f"Synced to {target_dir}")
            result.content_hash = content_hash
            self._sync_history.append(result)

            logger.info(f"Synced file: {file_path} -> {action}")
            return result

        except Exception as e:
            result = SyncResult(file_path, False, "error", str(e))
            self._sync_history.append(result)
            logger.error(f"Failed to sync file {file_path}: {e}")
            return result

    def sync_directory(self, directory: str, patterns: List[str] = None, force: bool = False) -> List[SyncResult]:
        """
        Sync all matching files in a directory.

        Args:
            directory: Directory path to sync.
            patterns: File patterns to match (default: ["*.md", "*.txt"]).
            force: Force sync even if files haven't changed.

        Returns:
            List of SyncResult for each file.
        """
        patterns = patterns or ["*.md", "*.txt", "*.json"]
        results = []
        dir_path = Path(directory)

        if not dir_path.exists():
            logger.warning(f"Directory does not exist: {directory}")
            return results

        for pattern in patterns:
            for file_path in dir_path.rglob(pattern):
                if file_path.is_file():
                    result = self.sync_file(str(file_path), force=force)
                    results.append(result)

        logger.info(f"Directory sync complete: {len(results)} files processed")
        return results

    def _on_file_change(self, file_path: str):
        """Callback when a file changes. Triggers incremental sync."""
        self.sync_file(file_path)

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
        self._save_hash_index()
        logger.info("FileSyncService stopped.")

    def get_sync_history(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get recent sync history."""
        return [r.to_dict() for r in self._sync_history[-limit:]]

    def get_indexed_files(self) -> Dict[str, str]:
        """Get all indexed files with their hashes."""
        with self._lock:
            return dict(self._file_hashes)
