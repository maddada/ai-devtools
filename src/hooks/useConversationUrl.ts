import { useCallback, useEffect, useState } from 'react';
import type { JsonlFile } from '@/lib/directory-utils';

type ConversationPath = {
  folder: string;
  filename: string;
} | null;

function parseUrlPath(): ConversationPath {
  const path = window.location.pathname;
  if (!path || path === '/') return null;

  // Remove leading slash, decode URI components, and split
  const parts = path
    .slice(1)
    .split('/')
    .filter(Boolean)
    .map((part) => decodeURIComponent(part));

  if (parts.length === 0) return null;

  // If only one part, it's a file in the root folder
  if (parts.length === 1) {
    return { folder: '', filename: parts[0] };
  }

  // Last part is the filename, everything before is the folder path
  const filename = parts[parts.length - 1];
  const folder = parts.slice(0, -1).join('/');

  return { folder, filename };
}

function buildUrlPath(file: JsonlFile): string {
  const folder = file.folder === '(root)' ? '' : file.folder;
  const filename = file.name.replace('.jsonl', '');

  if (folder) {
    // Encode each path segment separately to preserve slashes
    const encodedFolder = folder
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    return `/${encodedFolder}/${encodeURIComponent(filename)}`;
  }
  return `/${encodeURIComponent(filename)}`;
}

export type UseConversationUrlReturn = {
  pendingPath: ConversationPath;
  navigationVersion: number;
  updateUrl: (file: JsonlFile) => void;
  clearPendingPath: () => void;
  findFileByPath: (files: JsonlFile[], path: ConversationPath) => JsonlFile | undefined;
};

export function useConversationUrl(): UseConversationUrlReturn {
  const [pendingPath, setPendingPath] = useState<ConversationPath>(() => parseUrlPath());
  // Increments on every popstate navigation to detect home navigation
  const [navigationVersion, setNavigationVersion] = useState(0);

  const updateUrl = useCallback((file: JsonlFile) => {
    const newPath = buildUrlPath(file);

    // Only push if the path is different (decode both to compare properly)
    const currentDecoded = decodeURIComponent(window.location.pathname);
    const newDecoded = decodeURIComponent(newPath);
    if (currentDecoded !== newDecoded) {
      window.history.pushState({ folder: file.folder, name: file.name }, '', newPath);
    }
  }, []);

  const clearPendingPath = useCallback(() => {
    setPendingPath(null);
  }, []);

  const findFileByPath = useCallback((files: JsonlFile[], path: ConversationPath): JsonlFile | undefined => {
    if (!path) return undefined;

    return files.find((file) => {
      const fileFolder = file.folder === '(root)' ? '' : file.folder;
      const fileName = file.name.replace('.jsonl', '');

      return fileFolder === path.folder && fileName === path.filename;
    });
  }, []);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const path = parseUrlPath();
      setPendingPath(path);
      setNavigationVersion((v) => v + 1);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return {
    pendingPath,
    navigationVersion,
    updateUrl,
    clearPendingPath,
    findFileByPath,
  };
}
