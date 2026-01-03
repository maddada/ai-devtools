import { useState, useCallback, useEffect } from "react";
import { ConversationViewer } from "@/components/custom-ui/ConversationViewer";
import { Sidebar } from "@/components/custom-ui/Sidebar";
import { Toaster } from "@/components/ui/sonner";
import { useDirectoryHandle } from "@/hooks/useDirectoryHandle";
import { useConversationUrl } from "@/hooks/useConversationUrl";
import { Loader2 } from "lucide-react";
import type { JsonlFile } from "@/lib/directory-utils";

const THEME_KEY = 'convo-viewer-theme';

function getInitialTheme(): boolean {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored !== null) {
    return stored === 'dark';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// Initialize dark mode class on document before React hydrates
const initialDark = getInitialTheme();
if (initialDark) {
  document.documentElement.classList.add('dark');
}

export function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(getInitialTheme);
  const directoryHandle = useDirectoryHandle();
  const { pendingPath, navigationVersion, updateUrl, clearPendingPath, findFileByPath } = useConversationUrl();

  useEffect(() => {
    localStorage.setItem(THEME_KEY, isDarkMode ? 'dark' : 'light');
    // Apply dark class to document element for proper CSS variable inheritance
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Handle URL-based navigation: when files load or pendingPath changes, select the file
  useEffect(() => {
    // If navigating to home (no path), clear selection
    if (!pendingPath && navigationVersion > 0) {
      setSelectedFile(null);
      setSelectedFileName(null);
      return;
    }

    if (!pendingPath || directoryHandle.files.length === 0) return;

    const matchingFile = findFileByPath(directoryHandle.files, pendingPath);
    if (matchingFile) {
      setSelectedFile(matchingFile.file);
      setSelectedFileName(matchingFile.name);
      clearPendingPath();
    }
  }, [pendingPath, navigationVersion, directoryHandle.files, findFileByPath, clearPendingPath]);

  const handleFileSelect = useCallback((file: File, jsonlFile?: JsonlFile) => {
    setSelectedFile(file);
    setSelectedFileName(file.name);

    // Update URL if we have the full JsonlFile info
    if (jsonlFile) {
      updateUrl(jsonlFile);
    }
  }, [updateUrl]);

  const handleToggleDarkMode = useCallback(() => {
    setIsDarkMode(prev => !prev);
  }, []);

  // Show loading when navigating via URL and waiting for files to load or match
  const isLoadingFromUrl = pendingPath !== null && (
    directoryHandle.isScanning || directoryHandle.files.length === 0
  );

  return (
    <div className="flex h-screen bg-background text-foreground relative">
      {isLoadingFromUrl && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading conversation...</p>
          </div>
        </div>
      )}
      <Sidebar
        onFileSelect={handleFileSelect}
        selectedFile={selectedFileName}
        isDarkMode={isDarkMode}
        onToggleDarkMode={handleToggleDarkMode}
        directoryHandle={directoryHandle}
      />
      <div className="flex-1 overflow-hidden bg-background">
        <ConversationViewer
          file={selectedFile}
          onSelectFolder={directoryHandle.handleSelectFolder}
          hasFilesInSidebar={directoryHandle.files.length > 0}
        />
      </div>
      <Toaster />
    </div>
  );
}

export default App;