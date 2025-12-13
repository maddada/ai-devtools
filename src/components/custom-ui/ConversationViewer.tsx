import { FileUp, Upload } from "lucide-react";
import { type FC, useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ConversationSchema,
  type Conversation,
  type ErrorJsonl,
} from "@/lib/conversation-schema";
import type { ToolResultContent } from "@/lib/conversation-schema/content/ToolResultContentSchema";
import { ConversationList } from "./conversation";

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

export const ConversationViewer: FC = () => {
  const [conversations, setConversations] = useState<ParsedLine[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileLoad = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const parsed = parseJsonlContent(content);
      setConversations(parsed);
      setFileName(file.name);
    };
    reader.readAsText(file);
  }, []);

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
      <div className="min-h-screen flex items-center justify-center p-4">
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
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">
                Drop a JSONL file here
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                or click to select a file
              </p>
              <input
                type="file"
                accept=".jsonl"
                onChange={handleFileInput}
                className="hidden"
                id="file-input"
              />
              <label htmlFor="file-input" className="cursor-pointer">
                <Button variant="outline" className="pointer-events-none">
                  Select File
                </Button>
              </label>
              <p className="text-xs text-muted-foreground mt-4">
                JSONL files are typically found in:
                <br />
                <code className="bg-muted px-1 py-0.5 rounded text-xs">
                  ~/.claude/projects/*/sessions/*.jsonl
                </code>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileUp className="h-5 w-5 text-muted-foreground" />
            <div>
              <h1 className="font-semibold">Conversation Viewer</h1>
              <p className="text-xs text-muted-foreground">{fileName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {conversations.filter((c) => c.type !== "x-error").length}{" "}
              messages
            </span>
            <input
              type="file"
              accept=".jsonl"
              onChange={handleFileInput}
              className="hidden"
              id="file-input-header"
            />
            <label htmlFor="file-input-header" className="cursor-pointer">
              <Button variant="outline" size="sm" className="pointer-events-none">
                Load Another
              </Button>
            </label>
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6">
        <ConversationList
          conversations={conversations}
          getToolResult={getToolResult}
        />
      </main>
    </div>
  );
};
