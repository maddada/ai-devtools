import { useState, useCallback, useEffect } from "react";
import { ConversationViewer } from "@/components/custom-ui/ConversationViewer";
import { Sidebar } from "@/components/custom-ui/Sidebar";
import { Toaster } from "@/components/ui/sonner";
import { useDirectoryHandle } from "@/hooks/useDirectoryHandle";

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

  useEffect(() => {
    localStorage.setItem(THEME_KEY, isDarkMode ? 'dark' : 'light');
    // Apply dark class to document element for proper CSS variable inheritance
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setSelectedFileName(file.name);
  }, []);

  const handleToggleDarkMode = useCallback(() => {
    setIsDarkMode(prev => !prev);
  }, []);

  return (
    <div className="flex h-screen bg-background text-foreground">
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