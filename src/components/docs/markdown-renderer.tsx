"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeHighlight from "rehype-highlight";
import type { Components } from "react-markdown";
import { CodeBlockWithCopy } from "./code-block-with-copy";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { bmadSanitizeSchema } from "@/lib/bmad/sanitize-schema";
import {
  ExternalLink,
  Info,
  Lightbulb,
  AlertCircle,
  AlertTriangle,
  OctagonAlert,
  Image as ImageIcon,
} from "lucide-react";

export interface MarkdownRendererProps {
  content: string;
  owner?: string;
  repo?: string;
  currentFilePath?: string;
}

const MarkdownDocContext = React.createContext<{
  owner?: string;
  repo?: string;
  currentFilePath?: string;
}>({});

const CALLOUT_CONFIG: Record<
  string,
  { icon: React.ElementType; label: string; className: string }
> = {
  NOTE: {
    icon: Info,
    label: "Note",
    className: "callout-note",
  },
  TIP: {
    icon: Lightbulb,
    label: "Astuce",
    className: "callout-tip",
  },
  IMPORTANT: {
    icon: AlertCircle,
    label: "Important",
    className: "callout-important",
  },
  WARNING: {
    icon: AlertTriangle,
    label: "Avertissement",
    className: "callout-warning",
  },
  CAUTION: {
    icon: OctagonAlert,
    label: "Attention",
    className: "callout-caution",
  },
};

function findCalloutPattern(node: React.ReactNode): string | null {
  if (typeof node === "string") {
    const match = node.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/);
    return match ? match[1] : null;
  }
  if (React.isValidElement(node)) {
    const props = node.props as Record<string, unknown>;
    const children = React.Children.toArray(props.children as React.ReactNode);
    for (const child of children) {
      const result = findCalloutPattern(child);
      if (result) return result;
    }
  }
  return null;
}

function extractCalloutType(
  children: React.ReactNode
): { type: string; restChildren: React.ReactNode } | null {
  const childArray = React.Children.toArray(children);
  if (childArray.length === 0) return null;

  const firstChild = childArray[0];
  if (!React.isValidElement(firstChild)) return null;

  const firstChildProps = firstChild.props as Record<string, unknown>;
  const firstChildChildren = firstChildProps.children as React.ReactNode;
  if (!firstChildChildren) return null;

  const innerArray = React.Children.toArray(firstChildChildren);
  const firstText =
    typeof innerArray[0] === "string" ? innerArray[0] : null;

  // Direct text match in first paragraph child
  if (firstText) {
    const match = firstText.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/);
    if (match) {
      const calloutType = match[1];
      const remainingText = firstText.slice(match[0].length);

      const newInnerChildren =
        remainingText.length > 0
          ? [remainingText, ...innerArray.slice(1)]
          : innerArray.slice(1);

      const newFirstChild = React.cloneElement(
        firstChild as React.ReactElement,
        {},
        ...newInnerChildren
      );

      return { type: calloutType, restChildren: [newFirstChild, ...childArray.slice(1)] };
    }
  }

  // Fallback: recursive search for callout pattern in nested structure
  const calloutType = findCalloutPattern(firstChild);
  if (!calloutType) return null;

  // Recursively remove the pattern text from the tree
  function removeCalloutPattern(node: React.ReactNode): React.ReactNode {
    if (typeof node === "string") {
      return node.replace(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/, "");
    }
    if (React.isValidElement(node)) {
      const nodeProps = node.props as Record<string, unknown>;
      const nodeChildren = React.Children.toArray(nodeProps.children as React.ReactNode);
      const cleaned = nodeChildren.map(removeCalloutPattern);
      return React.cloneElement(node as React.ReactElement, {}, ...cleaned);
    }
    return node;
  }

  const cleanChildren = childArray.map((child, i) => {
    if (i > 0) return child;
    return removeCalloutPattern(child);
  });

  return { type: calloutType, restChildren: cleanChildren };
}

function CalloutBlockquote(props: React.ComponentProps<"blockquote">) {
  const { children, ...rest } = props;
  const callout = extractCalloutType(children);

  if (!callout) {
    return <blockquote {...rest}>{children}</blockquote>;
  }

  const config = CALLOUT_CONFIG[callout.type];
  if (!config) {
    return <blockquote {...rest}>{children}</blockquote>;
  }

  const Icon = config.icon;

  return (
    <div className={`callout ${config.className}`} role="note">
      <div className="callout-title">
        <Icon className="size-4 shrink-0" />
        <span>{config.label}</span>
      </div>
      <div className="callout-content">{callout.restChildren}</div>
    </div>
  );
}

function SmartLink(props: React.ComponentProps<"a">) {
  const { href, children, ...rest } = props;
  const isExternal =
    href && (href.startsWith("http://") || href.startsWith("https://"));

  if (isExternal) {
    return (
      <a {...rest} href={href} target="_blank" rel="noopener noreferrer">
        {children}
        <ExternalLink className="ml-1 inline-block size-3.5 align-text-bottom" />
      </a>
    );
  }

  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}

function LazyImage(props: React.ComponentProps<"img">) {
  const { className, alt, src, ...rest } = props;
  const { owner, repo, currentFilePath } = React.useContext(MarkdownDocContext);
  const [hasError, setHasError] = React.useState(false);

  const resolvedSrc = React.useMemo(() => {
    if (!src || typeof src !== "string") return "";
    if (
      src.startsWith("http://") ||
      src.startsWith("https://") ||
      src.startsWith("data:") ||
      src.startsWith("/api/")
    ) {
      return src;
    }

    if (!owner || !repo) return src;

    let targetPath = src;
    if (currentFilePath) {
      const dir = currentFilePath.includes("/")
        ? currentFilePath.substring(0, currentFilePath.lastIndexOf("/"))
        : "";
      if (src.startsWith("./") || src.startsWith("../") || !src.startsWith("/")) {
        const parts = (dir ? dir + "/" + src : src).split("/");
        const resolvedParts: string[] = [];
        for (const part of parts) {
          if (part === "" || part === ".") continue;
          if (part === "..") {
            resolvedParts.pop();
          } else {
            resolvedParts.push(part);
          }
        }
        targetPath = resolvedParts.join("/");
      } else {
        targetPath = src.replace(/^\/+/, "");
      }
    }

    return `/api/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/raw?path=${encodeURIComponent(targetPath)}`;
  }, [src, owner, repo, currentFilePath]);

  if (hasError) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground my-2">
        <ImageIcon className="size-4 shrink-0 opacity-60" />
        <span>{alt || "Image preview unavailable"} ({typeof src === "string" ? src : "image"})</span>
      </span>
    );
  }

  /* eslint-disable @next/next/no-img-element */
  return (
    <img
      {...rest}
      src={resolvedSrc}
      alt={alt ?? ""}
      loading="lazy"
      onError={() => setHasError(true)}
      className={cn("rounded-lg border border-border shadow-sm max-w-full h-auto my-3", className)}
    />
  );
  /* eslint-enable @next/next/no-img-element */
}

function ScrollableTable(props: React.ComponentProps<"table">) {
  const { children, ...rest } = props;
  return (
    <ScrollArea className="w-full" type="auto">
      <table {...rest}>{children}</table>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

const components: Components = {
  pre: CodeBlockWithCopy,
  blockquote: CalloutBlockquote,
  a: SmartLink,
  img: LazyImage,
  table: ScrollableTable,
  input(props) {
    if (props.type === "checkbox") {
      return (
        <input
          type="checkbox"
          checked={props.checked}
          readOnly
          className="mr-2 h-4 w-4 rounded border-border accent-primary"
        />
      );
    }
    return <input {...props} />;
  },
};

export function MarkdownRenderer({
  content,
  owner,
  repo,
  currentFilePath,
}: MarkdownRendererProps) {
  return (
    <MarkdownDocContext.Provider value={{ owner, repo, currentFilePath }}>
      <div className="prose prose-zinc dark:prose-invert max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[
            [rehypeSanitize, bmadSanitizeSchema],
            rehypeSlug,
            [rehypeAutolinkHeadings, { behavior: "prepend", properties: { className: ["autolink-heading"], ariaHidden: "true", tabIndex: -1 } }],
            rehypeHighlight,
          ]}
          components={components}
        >
          {content}
        </ReactMarkdown>
      </div>
    </MarkdownDocContext.Provider>
  );
}
