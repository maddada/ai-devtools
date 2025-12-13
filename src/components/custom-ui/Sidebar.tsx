import { useState, useEffect, useRef, useMemo, type FC } from 'react';
import { FolderOpen, RefreshCw, ChevronLeft, ChevronRight, Trash2, ChevronDown, ChevronRightIcon, Sun, Moon, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getCachedFile, cacheFile, clearCache } from '@/lib/cache';
import { cn } from '@/lib/utils';

const MIN_FILE_SIZE = 5 * 1024; // 5KB minimum
const HANDLE_STORAGE_KEY = 'convo-viewer-dir-handle';
const USERNAME_KEY = 'macos-username';

function getStoredUsername(): string | null {
  return localStorage.getItem(USERNAME_KEY);
}

function setStoredUsername(username: string): void {
  localStorage.setItem(USERNAME_KEY, username);
}

function getOrPromptUsername(): string | null {
  let username = getStoredUsername();
  if (!username) {
    username = window.prompt('Enter your macOS username (for clipboard path):');
    if (username) {
      setStoredUsername(username);
    }
  }
  return username;
}

// IndexedDB helpers for storing directory handle (required for File System Access API handles)
async function saveDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(HANDLE_STORAGE_KEY, 1);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('handles');
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('handles', 'readwrite');
      tx.objectStore('handles').put(handle, 'directory');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
  });
}

async function loadDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(HANDLE_STORAGE_KEY, 1);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('handles');
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('handles', 'readonly');
      const getRequest = tx.objectStore('handles').get('directory');
      getRequest.onsuccess = () => resolve(getRequest.result || null);
      getRequest.onerror = () => reject(getRequest.error);
    };
  });
}

export interface JsonlFile {
  name: string;
  path: string;
  file: File;
  folder: string;
  size: number;
  summary: string;
  lastModified: number;
  parentDirHandle: FileSystemDirectoryHandle;
}

function extractSummary(content: string): string {
  const lines = content.split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const entry = JSON.parse(line);

      if (entry.type !== 'user' || !entry.message?.content) continue;

      let text = '';
      const msgContent = entry.message.content;

      if (typeof msgContent === 'string') {
        text = msgContent;
      } else if (Array.isArray(msgContent)) {
        const textBlock = msgContent.find(
          (b: { type: string; text?: string }) => b.type === 'text' && b.text
        );
        if (textBlock?.text) {
          text = textBlock.text;
        }
      }

      if (!text) continue;
      if (text.startsWith('<command')) continue;
      if (text.startsWith('<ide_opened_file>')) continue;
      if (text.startsWith('<local-')) continue;
      if (text.startsWith('[Tool Result]')) continue;
      if (text.startsWith('Caveat:')) continue;
      if (text.includes('tool_use_id')) continue;

      const cleaned = text
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (cleaned.length > 0) {
        return cleaned.slice(0, 100);
      }
    } catch {
      continue;
    }
  }

  return '';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1000 * 1000) return `${(bytes / 1000).toFixed(0)} KB`;
  return `${(bytes / (1000 * 1000)).toFixed(1)} MB`;
}

function cleanFolderName(folder: string): string {
  return folder
    .replace(/-?Users-madda-dev-/g, '')
    .replace(/-?Users-madda-/g, '')
    .replace(/^-+/, '');
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${year}-${month}-${day} ${hour12}:${minutes} ${ampm}`;
}

async function scanDirectoryForJsonl(
  dirHandle: FileSystemDirectoryHandle,
  parentPath: string = ''
): Promise<JsonlFile[]> {
  const files: JsonlFile[] = [];

  for await (const entry of dirHandle.values()) {
    const currentPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;

    if (entry.kind === 'directory') {
      const subDirHandle = await dirHandle.getDirectoryHandle(entry.name);
      const subFiles = await scanDirectoryForJsonl(subDirHandle, currentPath);
      files.push(...subFiles);
    } else if (entry.kind === 'file' && entry.name.endsWith('.jsonl')) {
      const fileHandle = await dirHandle.getFileHandle(entry.name);
      const file = await fileHandle.getFile();

      if (file.size >= MIN_FILE_SIZE) {
        let summary = '';

        const cached = getCachedFile(currentPath, file.size, file.lastModified);
        if (cached) {
          summary = cached.summary;
        } else {
          const chunk = file.slice(0, 50 * 1024);
          const text = await chunk.text();
          summary = extractSummary(text);

          cacheFile(
            currentPath,
            parentPath || '(root)',
            entry.name,
            file.size,
            file.lastModified,
            summary
          );
        }

        files.push({
          name: entry.name,
          path: currentPath,
          file,
          folder: parentPath || '(root)',
          size: file.size,
          summary,
          lastModified: file.lastModified,
          parentDirHandle: dirHandle,
        });
      }
    }
  }

  return files;
}

interface FileItemProps {
  file: JsonlFile;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

const FileItem: FC<FileItemProps> = ({ file, isSelected, onSelect, onDelete }) => {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              onClick={onSelect}
              onContextMenu={handleContextMenu}
              className={cn(
                "w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors",
                isSelected
                  ? "bg-sidebar-primary/10 text-sidebar-primary"
                  : "text-foreground hover:bg-sidebar-accent"
              )}
            >
              <span className="flex items-center gap-2">
                <span className="flex-1 truncate">
                  {file.summary || file.name.replace('.jsonl', '')}
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {formatFileSize(file.size)}
                </span>
              </span>
            </button>
          }
        />
        <TooltipContent side="right" className="max-w-xs">
          <p className="text-xs mb-1">{file.summary || 'No summary'}</p>
          <p className="font-mono text-[10px] text-muted-foreground">{file.name}</p>
          <p className="text-[10px] text-muted-foreground/80 mt-1">
            {formatDate(file.lastModified)}
          </p>
        </TooltipContent>
      </Tooltip>
      {showContextMenu && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setShowContextMenu(false)}
          onContextMenu={(e) => {
            e.preventDefault();
            setShowContextMenu(false);
          }}
        >
          <div
            className="absolute z-50 bg-popover border border-border rounded-xl shadow-lg py-1 min-w-40"
            style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                onDelete();
                setShowContextMenu(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete conversation
            </button>
          </div>
        </div>
      )}
    </>
  );
};

interface SidebarProps {
  onFileSelect: (file: File) => void;
  selectedFile: string | null;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export const Sidebar: FC<SidebarProps> = ({ onFileSelect, selectedFile, isDarkMode, onToggleDarkMode }) => {
  const [files, setFiles] = useState<JsonlFile[]>([]);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [deleteDialogFile, setDeleteDialogFile] = useState<JsonlFile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const hasTriedAutoLoad = useRef(false);
  const currentDirHandle = useRef<FileSystemDirectoryHandle | null>(null);

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;
    const query = searchQuery.toLowerCase();
    return files.filter(
      (file) =>
        file.name.toLowerCase().includes(query) ||
        file.summary.toLowerCase().includes(query) ||
        file.folder.toLowerCase().includes(query)
    );
  }, [files, searchQuery]);

  const loadDirectory = async (dirHandle: FileSystemDirectoryHandle, save = true) => {
    currentDirHandle.current = dirHandle;
    setFolderName(dirHandle.name);
    setIsScanning(true);
    setExpandedFolders(new Set());

    try {
      const foundFiles = await scanDirectoryForJsonl(dirHandle);
      foundFiles.sort((a, b) => {
        if (a.folder !== b.folder) {
          return a.folder.localeCompare(b.folder);
        }
        return a.lastModified - b.lastModified;
      });

      setFiles(foundFiles);

      if (save) {
        await saveDirectoryHandle(dirHandle);
      }
    } catch (err) {
      console.error('Error scanning folder:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleRefresh = async () => {
    if (!currentDirHandle.current || isScanning) return;

    clearCache();
    await loadDirectory(currentDirHandle.current, false);
  };

  const handleDeleteFile = async (file: JsonlFile) => {
    if (!file.name.endsWith('.jsonl')) {
      console.error('Safety check failed: Not a .jsonl file');
      return;
    }

    try {
      await file.parentDirHandle.removeEntry(file.name);
      setFiles((prev) => prev.filter((f) => f.path !== file.path));
    } catch (err) {
      console.error('Failed to delete file:', err);
      alert('Failed to delete the file. You may need read-write permission.');
    }

    setDeleteDialogFile(null);
  };

  useEffect(() => {
    if (hasTriedAutoLoad.current) return;
    hasTriedAutoLoad.current = true;

    const tryRestoreFolder = async () => {
      try {
        const savedHandle = await loadDirectoryHandle();
        if (savedHandle) {
          let permission = await savedHandle.queryPermission?.({ mode: 'readwrite' });
          if (permission !== 'granted') {
            permission = await savedHandle.queryPermission?.({ mode: 'read' });
          }
          if (permission === 'granted') {
            await loadDirectory(savedHandle, false);
          }
        }
      } catch {
        // Failed to restore - user can select manually
      }
    };

    tryRestoreFolder();
  }, []);

  const handleSelectFolder = async () => {
    try {
      const username = getOrPromptUsername();
      if (username) {
        await navigator.clipboard.writeText(`/Users/${username}/.claude/projects`);
      }

      const dirHandle = await window.showDirectoryPicker({
        id: 'claude-projects',
        startIn: 'documents',
        mode: 'readwrite',
      });
      await loadDirectory(dirHandle);
    } catch (err) {
      console.error('Error selecting folder:', err);
    }
  };

  const toggleFolder = (folder: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) {
        next.delete(folder);
      } else {
        next.add(folder);
      }
      return next;
    });
  };

  const filesByFolder = filteredFiles.reduce(
    (acc, file) => {
      if (!acc[file.folder]) {
        acc[file.folder] = [];
      }
      acc[file.folder].push(file);
      return acc;
    },
    {} as Record<string, JsonlFile[]>
  );

  if (isCollapsed) {
    return (
      <div className="w-12 h-screen bg-sidebar border-r border-sidebar-border flex flex-col items-center py-3 gap-2 transition-all duration-300 ease-in-out">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setIsCollapsed(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            }
          />
          <TooltipContent side="right">Expand sidebar</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onToggleDarkMode}
                className="text-muted-foreground hover:text-foreground"
              >
                {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            }
          />
          <TooltipContent side="right">{isDarkMode ? 'Light mode' : 'Dark mode'}</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  const folderEntries = Object.entries(filesByFolder);

  return (
    <>
      <div className="w-72 h-screen bg-sidebar border-r border-sidebar-border flex flex-col shrink-0 transition-all duration-300 ease-in-out">
        <div className="p-3 border-b border-sidebar-border flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  onClick={handleSelectFolder}
                  variant="ghost"
                  size="icon-sm"
                  disabled={isScanning}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <FolderOpen className="h-4 w-4" />
                </Button>
              }
            />
            <TooltipContent side="bottom">Select folder</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleRefresh}
                  disabled={!currentDirHandle.current || isScanning}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className={cn("h-4 w-4", isScanning && "animate-spin")} />
                </Button>
              }
            />
            <TooltipContent side="bottom">Refresh</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onToggleDarkMode}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
              }
            />
            <TooltipContent side="bottom">{isDarkMode ? 'Light mode' : 'Dark mode'}</TooltipContent>
          </Tooltip>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsCollapsed(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        {folderName && (
          <div className="px-3 py-2 text-xs text-muted-foreground truncate border-b border-sidebar-border/50">
            {folderName}
          </div>
        )}

        {files.length > 0 && (
          <div className="px-2 py-2 border-b border-sidebar-border/50">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Filter files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 pr-8 text-xs bg-sidebar-accent/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-2">
            {files.length === 0 && !isScanning && (
              <div className="text-sm text-muted-foreground text-center py-8 px-4">
                Select a folder to find .jsonl files
              </div>
            )}

            {isScanning && (
              <div className="text-sm text-muted-foreground text-center py-8">
                Scanning for .jsonl files...
              </div>
            )}

            {files.length > 0 && filteredFiles.length === 0 && searchQuery && (
              <div className="text-sm text-muted-foreground text-center py-8 px-4">
                No files match "{searchQuery}"
              </div>
            )}

            {folderEntries.map(([folder, folderFiles]) => {
              const isExpanded = searchQuery ? true : expandedFolders.has(folder);
              return (
                <div key={folder} className="mb-1">
                  <button
                    onClick={() => toggleFolder(folder)}
                    className="w-full flex items-center gap-1 px-2 py-1.5 hover:bg-sidebar-accent rounded-lg transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRightIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-[11px] font-medium text-muted-foreground truncate flex-1 text-left" title={folder}>
                      {cleanFolderName(folder)}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60 shrink-0">
                      {folderFiles.length}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="ml-3 border-l border-sidebar-border pl-2">
                      {folderFiles.map((file) => (
                        <FileItem
                          key={file.path}
                          file={file}
                          isSelected={selectedFile === file.name}
                          onSelect={() => onFileSelect(file.file)}
                          onDelete={() => setDeleteDialogFile(file)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {files.length > 0 && (
              <div className="text-xs text-muted-foreground/60 text-center py-2">
                {searchQuery ? (
                  <>
                    {filteredFiles.length} of {files.length} file{files.length !== 1 ? 's' : ''}
                  </>
                ) : (
                  <>
                    {files.length} file{files.length !== 1 ? 's' : ''} in {folderEntries.length} project{folderEntries.length !== 1 ? 's' : ''}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={!!deleteDialogFile} onOpenChange={(open) => !open && setDeleteDialogFile(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the conversation file. This action cannot be undone.
              <br /><br />
              <span className="font-medium">{deleteDialogFile?.summary || deleteDialogFile?.name}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => deleteDialogFile && handleDeleteFile(deleteDialogFile)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
