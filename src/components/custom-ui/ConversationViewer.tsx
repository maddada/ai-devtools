import { Download, FileUp, FolderOpen, MessageSquareText } from "lucide-react";
import { type FC, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOrPromptUsername } from "@/lib/username-utils";
import {
  ConversationSchema,
  type Conversation,
  type ErrorJsonl,
} from "@/lib/conversation-schema";
import type { ToolResultContent } from "@/lib/conversation-schema/content/ToolResultContentSchema";
import { ConversationList } from "./conversation";
import { ExportDialog } from "./ExportDialog";

type ParsedLine = Conversation | ErrorJsonl;

const parseJsonlContent = (content: string): ParsedLine[] => {
  const lines = content.split("\n").filter((line) => line.trim());
  return lines.map((line) => {
    try {
      const parsed = JSON.parse(line);
      const result = ConversationSchema.safeParse(parsed);
      if (result.success) {
        return result.data;
      }
      return { type: "x-error" as const, line };
    } catch {
      return { type: "x-error" as const, line };
    }
  });
};

type ConversationViewerProps = {
  file?: File | null;
  onSelectFolder: () => Promise<void>;
  hasFilesInSidebar: boolean;
};

export const ConversationViewer: FC<ConversationViewerProps> = ({ file, onSelectFolder, hasFilesInSidebar }) => {
  const [conversations, setConversations] = useState<ParsedLine[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileLoad = useCallback((fileToLoad: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const parsed = parseJsonlContent(content);
      setConversations(parsed);
      setFileName(fileToLoad.name);
    };
    reader.readAsText(fileToLoad);
  }, []);

  useEffect(() => {
    if (file) {
      handleFileLoad(file);
    }
  }, [file, handleFileLoad]);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileLoad(file);
      }
    },
    [handleFileLoad]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileLoad(file);
      }
    },
    [handleFileLoad]
  );

  const handleOpenFolderBrowser = useCallback(async () => {
    const username = getOrPromptUsername();
    if (!username) return;

    const claudeProjectsPath = `/Users/${username}/.claude/projects`;
    await navigator.clipboard.writeText(claudeProjectsPath);

    toast.success("Path copied to clipboard!", {
      description: "Press ⌘+V in the file picker to navigate there",
    });

    onSelectFolder();
  }, [onSelectFolder]);

  // Detect if this is an agent file and extract agentId
  const agentId = useMemo(() => {
    for (const conv of conversations) {
      if (conv.type === "x-error") continue;
      if (conv.type === "summary" || conv.type === "file-history-snapshot" || conv.type === "queue-operation") continue;
      if (conv.agentId) return conv.agentId;
    }
    return null;
  }, [conversations]);

  // Build a map of tool_use_id -> tool_result for quick lookup
  const toolResultMap = useMemo(() => {
    const map = new Map<string, ToolResultContent>();
    for (const conv of conversations) {
      if (conv.type === "x-error") continue;
      if (conv.type !== "user") continue;
      const content = conv.message.content;
      if (typeof content === "string") continue;

      for (const item of content) {
        if (typeof item === "string") continue;
        if (item.type === "tool_result") {
          map.set(item.tool_use_id, item);
        }
      }
    }
    return map;
  }, [conversations]);

  const getToolResult = useCallback(
    (toolUseId: string): ToolResultContent | undefined => {
      return toolResultMap.get(toolUseId);
    },
    [toolResultMap]
  );

  if (conversations.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5" />
              Claude Code Conversation Viewer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {hasFilesInSidebar ? (
                <>
                  <MessageSquareText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">
                    Select a Conversation
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Pick a conversation from the sidebar to view it
                  </p>
                  <div className="text-xs text-muted-foreground space-y-1 mt-4">
                    <p className="font-medium text-foreground/80">You'll be able to see:</p>
                    <ul className="list-disc list-inside text-left inline-block">
                      <li>Full conversation history with Claude Code</li>
                      <li>All tool calls and their results</li>
                      <li>Warmup messages and system interactions</li>
                      <li>Everything that happens behind the scenes</li>
                    </ul>
                  </div>
                </>
              ) : (
                <>
                  <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">
                    Select your Claude projects folder
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Browse to find your JSONL conversation files
                  </p>
                  <Button onClick={handleOpenFolderBrowser} className="mb-4">
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Open Folder Browser
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Your Claude projects are located at:
                    <br />
                    <code className="bg-muted px-1 py-0.5 rounded text-xs">
                      ~/.claude/projects
                    </code>
                  </p>
                  <p className="text-xs text-muted-foreground mt-2 opacity-75">
                    The path will be copied to your clipboard when you click the button, hit ⌘+V in the file dialog to navigate there. Then hit select.
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="shrink-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileUp className="h-5 w-5 text-muted-foreground" />
            <div>
              <h1 className="font-semibold">
                {agentId ? `agent-${agentId}` : "Conversation Viewer"}
              </h1>
              <p className="text-xs text-muted-foreground">{fileName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {conversations.filter((c) => c.type !== "x-error").length}{" "}
              messages
            </span>
            <ExportDialog
              conversations={conversations}
              fileName={fileName || "conversation.jsonl"}
            >
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </ExportDialog>
            <input
              type="file"
              accept=".jsonl"
              onChange={handleFileInput}
              className="hidden"
              id="file-input-header"
            />
            <label htmlFor="file-input-header" className="hidden cursor-pointer">
              <Button variant="outline" size="sm" className="pointer-events-none">
                Load Another
              </Button>
            </label>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <ConversationList
            conversations={conversations}
            getToolResult={getToolResult}
          />
        </div>
      </main>
    </div>
  );
};
