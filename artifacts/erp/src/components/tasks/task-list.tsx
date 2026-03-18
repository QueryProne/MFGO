import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateTaskMutation, useDeleteTaskMutation, useEntityTasks, useUpdateTaskMutation } from "@/hooks/use-shared-workflows";

export function TaskList({ entityType, entityId }: { entityType: string; entityId: string }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");

  const { data, isLoading } = useEntityTasks(entityType, entityId);
  const createTask = useCreateTaskMutation();
  const updateTask = useUpdateTaskMutation();
  const deleteTask = useDeleteTaskMutation();

  const tasks = useMemo(() => data?.data ?? [], [data]);

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display">Tasks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-2">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Add a task title..."
            className="bg-background"
          />
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
          <Button
            className="gap-2"
            disabled={!title.trim() || createTask.isPending}
            onClick={() => {
              createTask.mutate(
                {
                  entityType,
                  entityId,
                  title: title.trim(),
                  description: description.trim() || undefined,
                  priority,
                  status: "open",
                },
                {
                  onSuccess: () => {
                    setTitle("");
                    setDescription("");
                    setPriority("medium");
                  },
                },
              );
            }}
          >
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>
        <Textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Optional task description..."
          className="bg-background min-h-[72px]"
        />

        <div className="space-y-2">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading tasks...</div>
          ) : tasks.length === 0 ? (
            <div className="text-sm text-muted-foreground">No tasks yet for this record.</div>
          ) : (
            tasks.map((task) => {
              const done = task.status === "done";
              return (
                <div
                  key={task.id}
                  className="flex items-start justify-between rounded-lg border border-border/50 bg-secondary/20 px-3 py-2"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {done ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <Clock3 className="w-4 h-4 text-amber-500" />
                      )}
                      <p className={`text-sm font-medium ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {task.title}
                      </p>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{task.priority}</span>
                    </div>
                    {task.description ? <p className="text-xs text-muted-foreground">{task.description}</p> : null}
                  </div>
                  <div className="flex items-center gap-1">
                    {!done ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => updateTask.mutate({ id: task.id, status: "done" })}
                      >
                        Complete
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteTask.mutate(task.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
