import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Send, 
  Plus, 
  Trash2, 
  Loader2, 
  Sparkles,
  MessageCircle,
  BookOpen
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: number;
  role: string;
  content: string;
  createdAt: string;
}

interface Conversation {
  id: number;
  title: string;
  createdAt: string;
  messages?: Message[];
}

export default function Wizard() {
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [streamingMessage, setStreamingMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/wizard/conversations"],
  });

  const { data: currentConversation, isLoading: messagesLoading } = useQuery<Conversation>({
    queryKey: ["/api/wizard/conversations", selectedConversationId],
    enabled: !!selectedConversationId,
  });

  const createConversationMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/wizard/conversations", { title: "New Chat" });
      return res.json();
    },
    onSuccess: (newConversation: Conversation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/wizard/conversations"] });
      setSelectedConversationId(newConversation.id);
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/wizard/conversations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wizard/conversations"] });
      if (conversations.length > 1) {
        const remaining = conversations.filter(c => c.id !== selectedConversationId);
        setSelectedConversationId(remaining[0]?.id || null);
      } else {
        setSelectedConversationId(null);
      }
    },
  });

  const sendMessage = async () => {
    if (!inputValue.trim() || !selectedConversationId || isStreaming) return;

    const messageContent = inputValue.trim();
    setInputValue("");
    setIsStreaming(true);
    setStreamingMessage("");

    try {
      const response = await fetch(`/api/wizard/conversations/${selectedConversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: messageContent }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.content) {
              setStreamingMessage(prev => prev + event.content);
            }
            if (event.done) {
              queryClient.invalidateQueries({ queryKey: ["/api/wizard/conversations", selectedConversationId] });
            }
          } catch {
          }
        }
      }
    } catch (error) {
      toast({ title: "Failed to send message", variant: "destructive" });
    } finally {
      setIsStreaming(false);
      setStreamingMessage("");
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentConversation?.messages, streamingMessage]);

  useEffect(() => {
    if (!selectedConversationId && conversations.length > 0) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, selectedConversationId]);

  const messages = currentConversation?.messages || [];

  const formatMessage = (content: string) => {
    const parts = content.split(/(https?:\/\/[^\s]+)/g);
    return parts.map((part, i) => {
      if (part.match(/^https?:\/\//)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:text-primary/80"
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  return (
    <AppLayout>
      <div className="h-[calc(100vh-8rem)] flex gap-4">
        <Card className="w-64 flex-shrink-0 flex flex-col">
          <div className="p-3 border-b flex items-center justify-between">
            <h2 className="font-semibold text-sm">Conversations</h2>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => createConversationMutation.mutate()}
              disabled={createConversationMutation.isPending}
              data-testid="button-new-conversation"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1">
            {conversationsLoading ? (
              <div className="p-2 space-y-2">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No conversations yet</p>
                <Button
                  size="sm"
                  className="mt-2"
                  onClick={() => createConversationMutation.mutate()}
                  data-testid="button-start-first-conversation"
                >
                  Start a chat
                </Button>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {conversations.map(conv => (
                  <div
                    key={conv.id}
                    className={cn(
                      "group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors",
                      selectedConversationId === conv.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                    onClick={() => setSelectedConversationId(conv.id)}
                    data-testid={`conversation-item-${conv.id}`}
                  >
                    <MessageCircle className="h-4 w-4 flex-shrink-0" />
                    <span className="flex-1 truncate">{conv.title}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className={cn(
                        "h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity",
                        selectedConversationId === conv.id && "hover:bg-primary-foreground/20"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversationMutation.mutate(conv.id);
                      }}
                      data-testid={`button-delete-conversation-${conv.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>

        <Card className="flex-1 flex flex-col">
          <div className="p-4 border-b flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold">Homeschool Wizard</h1>
              <p className="text-xs text-muted-foreground">
                Charlotte Mason guide with free resource recommendations
              </p>
            </div>
          </div>

          <ScrollArea className="flex-1 p-4">
            {!selectedConversationId ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <BookOpen className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <h2 className="text-lg font-medium mb-2">Welcome to the Homeschool Wizard</h2>
                <p className="text-muted-foreground max-w-md mb-4">
                  I speak in the spirit of Charlotte Mason and can help you plan curriculum, 
                  find free resources, and guide your homeschool journey.
                </p>
                <Button
                  onClick={() => createConversationMutation.mutate()}
                  disabled={createConversationMutation.isPending}
                  data-testid="button-start-conversation"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Start a Conversation
                </Button>
              </div>
            ) : messagesLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className={cn("flex", i % 2 === 0 ? "justify-end" : "justify-start")}>
                    <Skeleton className="h-16 w-3/4 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : messages.length === 0 && !streamingMessage ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <Sparkles className="h-12 w-12 text-primary/30 mb-4" />
                <p className="text-muted-foreground">
                  Ask me about curriculum planning, lesson ideas, or free educational resources!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg px-4 py-3 whitespace-pre-wrap",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                      data-testid={`message-${msg.id}`}
                    >
                      {formatMessage(msg.content)}
                    </div>
                  </div>
                ))}
                {streamingMessage && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-lg px-4 py-3 bg-muted whitespace-pre-wrap">
                      {formatMessage(streamingMessage)}
                      <span className="inline-block w-2 h-4 bg-primary/50 animate-pulse ml-1" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {selectedConversationId && (
            <div className="p-4 border-t">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage();
                }}
                className="flex gap-2"
              >
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ask about curriculum, lesson ideas, or resources..."
                  disabled={isStreaming}
                  data-testid="input-message"
                />
                <Button
                  type="submit"
                  disabled={!inputValue.trim() || isStreaming}
                  data-testid="button-send-message"
                >
                  {isStreaming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
