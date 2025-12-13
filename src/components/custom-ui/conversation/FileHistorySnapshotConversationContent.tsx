import { History } from "lucide-react";
import type { FC } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { FileHistorySnapshotEntry } from "@/lib/conversation-schema/entry/FileHistorySnapshotEntrySchema";

export const FileHistorySnapshotConversationContent: FC<{
  conversation: FileHistorySnapshotEntry;
}> = ({ conversation }) => {
  const fileCount = Object.keys(
    conversation.snapshot.trackedFileBackups
  ).length;

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20 gap-2 py-3 mb-2">
      <CardHeader className="py-0 px-4">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <CardTitle className="text-sm font-medium">
            File History Snapshot
          </CardTitle>
          <Badge
            variant="outline"
            className="border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300"
          >
            {fileCount} {fileCount === 1 ? "file" : "files"}
          </Badge>
          {conversation.isSnapshotUpdate && (
            <Badge
              variant="secondary"
              className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
            >
              Update
            </Badge>
          )}
        </div>
      </CardHeader>
    </Card>
  );
};
