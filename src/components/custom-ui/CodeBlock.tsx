import { useState, type FC, type ReactNode } from "react";
import { WrapText, AlignLeft, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type CodeBlockProps = {
  children: ReactNode;
  language?: string;
  className?: string;
};

export const CodeBlock: FC<CodeBlockProps> = ({
  children,
  language,
  className,
}) => {
  const [wordWrap, setWordWrap] = useState(false);
  const [copied, setCopied] = useState(false);

  const codeContent =
    typeof children === "string"
      ? children
      : children?.toString().replace(/\n$/, "") ?? "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  return (
    <div className={cn("relative my-4 rounded-lg border border-border overflow-hidden", className)}>
      <div className="flex items-center justify-between bg-muted/30 px-3 py-1.5 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {language || "code"}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setWordWrap(!wordWrap)}
            title={wordWrap ? "Disable word wrap" : "Enable word wrap"}
          >
            {wordWrap ? (
              <AlignLeft className="h-3.5 w-3.5" />
            ) : (
              <WrapText className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleCopy}
            title="Copy code"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
      <div
        className={cn(
          "bg-muted/20 p-4 text-sm font-mono",
          wordWrap ? "whitespace-pre-wrap break-words" : "overflow-x-auto"
        )}
      >
        <code className="text-foreground">{children}</code>
      </div>
    </div>
  );
};
