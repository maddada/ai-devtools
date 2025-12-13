import { AlertTriangle, ChevronDown, ExternalLink } from "lucide-react";
import { type FC, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { Conversation, ErrorJsonl } from "@/lib/conversation-schema";
import type { ToolResultContent } from "@/lib/conversation-schema/content/ToolResultContentSchema";
import { ConversationItem } from "./ConversationItem";

const getConversationKey = (conversation: Conversation) => {
  if (conversation.type === "user") {
    return `user_${conversation.uuid}`;
  }

  if (conversation.type === "assistant") {
    return `assistant_${conversation.uuid}`;
  }

  if (conversation.type === "system") {
    return `system_${conversation.uuid}`;
  }

  if (conversation.type === "summary") {
    return `summary_${conversation.leafUuid}`;
  }

  if (conversation.type === "file-history-snapshot") {
    return `file-history-snapshot_${conversation.messageId}`;
  }

  if (conversation.type === "queue-operation") {
    return `queue-operation_${conversation.operation}_${conversation.sessionId}_${conversation.timestamp}`;
  }

  return `unknown_${Math.random()}`;
};

const SchemaErrorDisplay: FC<{ errorLine: string }> = ({ errorLine }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <li className="w-full flex justify-start">
      <div className="w-full max-w-3xl lg:max-w-4xl sm:w-[90%] md:w-[85%] px-2">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger
            className="w-full flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded p-2 -mx-2 border-l-2 border-red-400"
            onClick={() => setIsOpen(!isOpen)}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-3 w-3 text-red-500" />
              <span className="text-xs font-medium text-red-600">
                Schema Error
              </span>
            </div>
            <ChevronDown
              className={`h-3 w-3 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="bg-background rounded border border-red-200 p-3 mt-2">
              <div className="space-y-3">
                <Alert variant="destructive" className="border-red-200 bg-red-50">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="text-red-800">
                    Schema Validation Error
                  </AlertTitle>
                  <AlertDescription className="text-red-700">
                    This entry could not be parsed. Please report this issue.{" "}
                    <a
                      href="https://github.com/d-kimuson/claude-code-viewer/issues"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 underline underline-offset-4"
                    >
                      Report Issue
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </AlertDescription>
                </Alert>
                <div className="bg-gray-50 border rounded px-3 py-2">
                  <h5 className="text-xs font-medium text-gray-700 mb-2">
                    Raw Content
                  </h5>
                  <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono text-gray-800">
                    {errorLine}
                  </pre>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </li>
  );
};

type ConversationListProps = {
  conversations: (Conversation | ErrorJsonl)[];
  getToolResult: (toolUseId: string) => ToolResultContent | undefined;
};

export const ConversationList: FC<ConversationListProps> = ({
  conversations,
  getToolResult,
}) => {

  return (
    <ul className="space-y-2">
      {conversations.flatMap((conversation) => {
        if (conversation.type === "x-error") {
          return (
            <SchemaErrorDisplay
              key={`error_${conversation.line}`}
              errorLine={conversation.line}
            />
          );
        }

        const elm = (
          <ConversationItem
            key={getConversationKey(conversation)}
            conversation={conversation}
            getToolResult={getToolResult}
          />
        );

        const isSidechain =
          conversation.type !== "summary" &&
          conversation.type !== "file-history-snapshot" &&
          conversation.type !== "queue-operation" &&
          conversation.isSidechain;

        if (isSidechain) {
          return [];
        }

        return [
          <li
            className={`w-full flex ${
              isSidechain ||
              conversation.type === "assistant" ||
              conversation.type === "system" ||
              conversation.type === "summary"
                ? "justify-start"
                : "justify-end"
            } animate-in fade-in slide-in-from-bottom-2 duration-300`}
            key={getConversationKey(conversation)}
          >
            <div className="w-full max-w-3xl lg:max-w-4xl sm:w-[90%] md:w-[85%]">
              {elm}
            </div>
          </li>,
        ];
      })}
    </ul>
  );
};
