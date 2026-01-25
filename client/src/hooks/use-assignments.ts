import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type CreateAssignmentRequest, type UpdateAssignmentRequest } from "@shared/routes";

export function useAssignments(lessonId?: number) {
  return useQuery({
    queryKey: [api.assignments.list.path, lessonId],
    queryFn: async () => {
      const url = new URL(api.assignments.list.path, window.location.origin);
      if (lessonId) url.searchParams.set("lessonId", lessonId.toString());
      
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch assignments");
      return api.assignments.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateAssignmentRequest) => {
      const res = await fetch(api.assignments.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create assignment");
      return api.assignments.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.assignments.list.path] }),
  });
}

export function useUpdateAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & UpdateAssignmentRequest) => {
      const url = buildUrl(api.assignments.update.path, { id });
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update assignment");
      return api.assignments.update.responses[200].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.assignments.list.path] }),
  });
}

export function useDeleteAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.assignments.delete.path, { id });
      const res = await fetch(url, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete assignment");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.assignments.list.path] }),
  });
}
