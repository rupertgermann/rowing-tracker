"use client"

import React, { useMemo, useState, useEffect } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { motion } from "framer-motion"
import { Ban, ChevronRight, Code2, Loader2, Terminal } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatTime } from "@/lib/dateTimeUtils"
import { FilePreview } from "@/components/ui/file-preview"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronDown, ChevronUp } from "lucide-react"

// Central configuration for collapsed message height and behavior
const COLLAPSED_MESSAGE_HEIGHT = 250
const COLLAPSE_THRESHOLDS = {
  CHARS: 300,
  LINES: 5,
}

const chatBubbleVariants = cva(
  "group/message relative break-words rounded-lg p-3 text-sm sm:max-w-[70%]",
  {
    variants: {
      isUser: {
        true: "bg-primary text-primary-foreground",
        false: "bg-muted text-foreground",
      },
      animation: {
        none: "",
        slide: "duration-300 animate-in fade-in-0",
        scale: "duration-300 animate-in fade-in-0 zoom-in-75",
        fade: "duration-500 animate-in fade-in-0",
      },
    },
    compoundVariants: [
      {
        isUser: true,
        animation: "slide",
        class: "slide-in-from-right",
      },
      {
        isUser: false,
        animation: "slide",
        class: "slide-in-from-left",
      },
      {
        isUser: true,
        animation: "scale",
        class: "origin-bottom-right",
      },
      {
        isUser: false,
        animation: "scale",
        class: "origin-bottom-left",
      },
    ],
  }
)

type Animation = VariantProps<typeof chatBubbleVariants>["animation"]

interface Attachment {
  name?: string
  contentType?: string
  url: string
}

interface PartialToolCall {
  state: "partial-call"
  toolName: string
}

interface ToolCall {
  state: "call"
  toolName: string
}

interface ToolResult {
  state: "result"
  toolName: string
  result: {
    __cancelled?: boolean
    [key: string]: any
  }
}

type ToolInvocation = PartialToolCall | ToolCall | ToolResult

interface ReasoningPart {
  type: "reasoning"
  reasoning: string
}

interface ToolInvocationPart {
  type: "tool-invocation"
  toolInvocation: ToolInvocation
}

interface TextPart {
  type: "text"
  text: string
}

// For compatibility with AI SDK types, not used
interface SourcePart {
  type: "source"
  source?: any
}

interface FilePart {
  type: "file"
  mimeType: string
  data: string
}

interface StepStartPart {
  type: "step-start"
}

type MessagePart =
  | TextPart
  | ReasoningPart
  | ToolInvocationPart
  | SourcePart
  | FilePart
  | StepStartPart

export interface Message {
  id: string
  role: "user" | "assistant" | (string & {})
  content: string
  createdAt?: Date
  experimental_attachments?: Attachment[]
  toolInvocations?: ToolInvocation[]
  parts?: MessagePart[]
}

export interface ChatMessageProps extends Message {
  showTimeStamp?: boolean
  animation?: Animation
  actions?: React.ReactNode
}

// Helper function to determine if content should be auto-collapsed
const shouldAutoCollapse = (content: string): boolean => {
  // Auto-collapse if content is longer than configured thresholds
  const hasLongContent = content.length > COLLAPSE_THRESHOLDS.CHARS
  const hasManyLines = content.split('\n').length > COLLAPSE_THRESHOLDS.LINES
  
  return hasLongContent || hasManyLines
}

// Collapsible content component for long user messages
const CollapsibleMessage: React.FC<{
  id: string
  content: string
  children: React.ReactNode
  isUser: boolean
  animation: Animation
  actions?: React.ReactNode
}> = ({ id, content, children, isUser, animation, actions }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [hasLoadedState, setHasLoadedState] = useState(false)

  // Load state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem(`chat_message_collapsed_${id}`)
    if (savedState !== null) {
      setIsOpen(savedState === 'true')
    }
    setHasLoadedState(true)
  }, [id])

  // Save state to localStorage when it changes
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    localStorage.setItem(`chat_message_collapsed_${id}`, String(open))
  }

  // Don't render animation until we've loaded the state to prevent jumping
  if (!hasLoadedState) return null

  return (
    <div className={cn("flex flex-col", isUser ? "items-end" : "items-start")}>
      <Collapsible
        open={isOpen}
        onOpenChange={handleOpenChange}
        className={cn(
          "group flex w-full max-w-full flex-col",
          isUser ? "items-end" : "items-start"
        )}
      >
        <div className={cn(chatBubbleVariants({ isUser, animation }), "relative pb-0")}>
          <CollapsibleContent forceMount>
            <motion.div
              initial={false}
              animate={isOpen ? "open" : "closed"}
              variants={{
                open: { height: "auto", opacity: 1 },
                closed: { height: COLLAPSED_MESSAGE_HEIGHT, opacity: 1 },
              }}
              transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
              className="overflow-hidden"
            >
              {children}
            </motion.div>
          </CollapsibleContent>
          
          {shouldAutoCollapse(content) && (
            <>
              {!isOpen ? (
                <div
                  className={cn(
                    "absolute bottom-0 left-0 right-0 flex h-16 items-end justify-center rounded-b-lg bg-gradient-to-t pb-2",
                    isUser 
                      ? "from-primary via-primary/80 to-transparent" 
                      : "from-muted via-muted/80 to-transparent"
                  )}
                >
                  <CollapsibleTrigger asChild>
                    <button className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-background/20 transition-colors">
                      <ChevronDown className="h-5 w-5" />
                      <span className="sr-only">Show all</span>
                    </button>
                  </CollapsibleTrigger>
                </div>
              ) : (
                <div className="mt-2 flex w-full justify-center pb-2">
                  <CollapsibleTrigger asChild>
                    <button className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-background/20 transition-colors">
                      <ChevronUp className="h-5 w-5" />
                      <span className="sr-only">Collapse</span>
                    </button>
                  </CollapsibleTrigger>
                </div>
              )}
            </>
          )}
          
          {actions ? (
            <div className="absolute -bottom-4 right-2 flex space-x-1 rounded-lg border bg-background p-1 text-foreground opacity-0 transition-opacity group-hover/message:opacity-100">
              {actions}
            </div>
          ) : null}
        </div>
      </Collapsible>
    </div>
  )
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  id,
  role,
  content,
  createdAt,
  showTimeStamp = false,
  animation = "scale",
  actions,
  experimental_attachments,
  toolInvocations,
  parts,
}) => {
  const files = useMemo(() => {
    return experimental_attachments?.map((attachment) => {
      const dataArray = dataUrlToUint8Array(attachment.url)
      const file = new File([dataArray], attachment.name ?? "Unknown", {
        type: attachment.contentType,
      })
      return file
    })
  }, [experimental_attachments])

  const isUser = role === "user"

  const formattedTime = createdAt ? formatTime(createdAt) : undefined

  if (isUser) {
    // Use collapsible for long user messages
    if (shouldAutoCollapse(content)) {
      return (
        <CollapsibleMessage
          id={id}
          content={content}
          isUser={isUser}
          animation={animation}
          actions={actions}
        >
          {files ? (
            <div className="mb-1 flex flex-wrap gap-2">
              {files.map((file, index) => {
                return <FilePreview file={file} key={index} />
              })}
            </div>
          ) : null}
          <MarkdownRenderer>{content}</MarkdownRenderer>
          {showTimeStamp && createdAt ? (
            <time
              dateTime={createdAt.toISOString()}
              className={cn(
                "mt-1 block px-1 text-xs opacity-50",
                animation !== "none" && "duration-500 animate-in fade-in-0"
              )}
            >
              {formattedTime}
            </time>
          ) : null}
        </CollapsibleMessage>
      )
    }

    // Regular user message display for short messages
    return (
      <div
        className={cn("flex flex-col", isUser ? "items-end" : "items-start")}
      >
        {files ? (
          <div className="mb-1 flex flex-wrap gap-2">
            {files.map((file, index) => {
              return <FilePreview file={file} key={index} />
            })}
          </div>
        ) : null}

        <div className={cn(chatBubbleVariants({ isUser, animation }), "relative")}>
          <MarkdownRenderer>{content}</MarkdownRenderer>
          {actions ? (
            <div className="absolute -bottom-4 right-2 flex space-x-1 rounded-lg border bg-background p-1 text-foreground opacity-0 transition-opacity group-hover/message:opacity-100">
              {actions}
            </div>
          ) : null}
        </div>

        {showTimeStamp && createdAt ? (
          <time
            dateTime={createdAt.toISOString()}
            className={cn(
              "mt-1 block px-1 text-xs opacity-50",
              animation !== "none" && "duration-500 animate-in fade-in-0"
            )}
          >
            {formattedTime}
          </time>
        ) : null}
      </div>
    )
  }

  if (parts && parts.length > 0) {
    return parts.map((part, index) => {
      if (part.type === "text") {
        // Use collapsible for long user messages only
        if (isUser && shouldAutoCollapse(part.text)) {
          return (
            <CollapsibleMessage
              key={`text-${index}`}
              id={`${id}-part-${index}`}
              content={part.text}
              isUser={isUser}
              animation={animation}
              actions={actions}
            >
              <MarkdownRenderer>{part.text}</MarkdownRenderer>
              {showTimeStamp && createdAt ? (
                <time
                  dateTime={createdAt.toISOString()}
                  className={cn(
                    "mt-1 block px-1 text-xs opacity-50",
                    animation !== "none" && "duration-500 animate-in fade-in-0"
                  )}
                >
                  {formattedTime}
                </time>
              ) : null}
            </CollapsibleMessage>
          )
        }

        return (
          <div
            className={cn(
              "flex flex-col",
              isUser ? "items-end" : "items-start"
            )}
            key={`text-${index}`}
          >
            <div className={cn(chatBubbleVariants({ isUser, animation }), "relative")}>
              <MarkdownRenderer>{part.text}</MarkdownRenderer>
              {actions ? (
                <div className="absolute -bottom-4 right-2 flex space-x-1 rounded-lg border bg-background p-1 text-foreground opacity-0 transition-opacity group-hover/message:opacity-100">
                  {actions}
                </div>
              ) : null}
            </div>

            {showTimeStamp && createdAt ? (
              <time
                dateTime={createdAt.toISOString()}
                className={cn(
                  "mt-1 block px-1 text-xs opacity-50",
                  animation !== "none" && "duration-500 animate-in fade-in-0"
                )}
              >
                {formattedTime}
              </time>
            ) : null}
          </div>
        )
      } else if (part.type === "reasoning") {
        return <ReasoningBlock key={`reasoning-${index}`} part={part} />
      } else if (part.type === "tool-invocation") {
        return (
          <ToolCall
            key={`tool-${index}`}
            toolInvocations={[part.toolInvocation]}
          />
        )
      }
      return null
    })
  }

  if (toolInvocations && toolInvocations.length > 0) {
    return <ToolCall toolInvocations={toolInvocations} />
  }

  
  return (
    <div className={cn("flex flex-col", isUser ? "items-end" : "items-start")}>
      <div className={cn(chatBubbleVariants({ isUser, animation }), "relative")}>
        <MarkdownRenderer>{content}</MarkdownRenderer>
        {actions ? (
          <div className="absolute -bottom-4 right-2 flex space-x-1 rounded-lg border bg-background p-1 text-foreground opacity-0 transition-opacity group-hover/message:opacity-100">
            {actions}
          </div>
        ) : null}
      </div>

      {showTimeStamp && createdAt ? (
        <time
          dateTime={createdAt.toISOString()}
          className={cn(
            "mt-1 block px-1 text-xs opacity-50",
            animation !== "none" && "duration-500 animate-in fade-in-0"
          )}
        >
          {formattedTime}
        </time>
      ) : null}
    </div>
  )
}

function dataUrlToUint8Array(data: string) {
  const base64 = data.split(",")[1]
  const buf = Buffer.from(base64, "base64")
  return new Uint8Array(buf)
}

const ReasoningBlock = ({ part }: { part: ReasoningPart }) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="mb-2 flex flex-col items-start sm:max-w-[70%]">
      <Collapsible
        open={isOpen}
        onOpenChange={setIsOpen}
        className="group w-full overflow-hidden rounded-lg border bg-muted/50"
      >
        <div className="flex items-center p-2">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
              <span>Thinking</span>
            </button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent forceMount>
          <motion.div
            initial={false}
            animate={isOpen ? "open" : "closed"}
            variants={{
              open: { height: "auto", opacity: 1 },
              closed: { height: 0, opacity: 0 },
            }}
            transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
            className="border-t"
          >
            <div className="p-2">
              <div className="whitespace-pre-wrap text-xs">
                {part.reasoning}
              </div>
            </div>
          </motion.div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

function ToolCall({
  toolInvocations,
}: Pick<ChatMessageProps, "toolInvocations">) {
  if (!toolInvocations?.length) return null

  return (
    <div className="flex flex-col items-start gap-2">
      {toolInvocations.map((invocation, index) => {
        const isCancelled =
          invocation.state === "result" &&
          invocation.result.__cancelled === true

        if (isCancelled) {
          return (
            <div
              key={index}
              className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
            >
              <Ban className="h-4 w-4" />
              <span>
                Cancelled{" "}
                <span className="font-mono">
                  {"`"}
                  {invocation.toolName}
                  {"`"}
                </span>
              </span>
            </div>
          )
        }

        switch (invocation.state) {
          case "partial-call":
          case "call":
            return (
              <div
                key={index}
                className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
              >
                <Terminal className="h-4 w-4" />
                <span>
                  Calling{" "}
                  <span className="font-mono">
                    {"`"}
                    {invocation.toolName}
                    {"`"}
                  </span>
                  ...
                </span>
                <Loader2 className="h-3 w-3 animate-spin" />
              </div>
            )
          case "result":
            return (
              <div
                key={index}
                className="flex flex-col gap-1.5 rounded-lg border bg-muted/50 px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Code2 className="h-4 w-4" />
                  <span>
                    Result from{" "}
                    <span className="font-mono">
                      {"`"}
                      {invocation.toolName}
                      {"`"}
                    </span>
                  </span>
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap text-foreground">
                  {JSON.stringify(invocation.result, null, 2)}
                </pre>
              </div>
            )
          default:
            return null
        }
      })}
    </div>
  )
}
