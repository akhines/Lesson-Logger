import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type CreateLessonRequest, type UpdateLessonRequest } from "@shared/routes";

type LessonFilters = {
  subjectId?: number;
  startDate?: string;
  endDate?: string;
};

export function useLessons(filters?: LessonFilters) {
  return useQuery({
    queryKey: [api.lessons.list.path, filters],
    queryFn: async () => {
      const url = new URL(api.lessons.list.path, window.location.origin);
      if (filters?.subjectId) url.searchParams.set("subjectId", filters.subjectId.toString());
      if (filters?.startDate) url.searchParams.set("startDate", filters.startDate);
      if (filters?.endDate) url.searchParams.set("endDate", filters.endDate);
      
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch lessons");
      return api.lessons.list.responses[200].parse(await res.json());
    },
  });
}

export function useLesson(id: number) {
  return useQuery({
    queryKey: [api.lessons.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.lessons.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch lesson");
      return api.lessons.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateLesson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateLessonRequest) => {
      const res = await fetch(api.lessons.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create lesson");
      return api.lessons.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.lessons.list.path] }),
  });
}

export function useUpdateLesson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & UpdateLessonRequest) => {
      const url = buildUrl(api.lessons.update.path, { id });
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update lesson");
      return api.lessons.update.responses[200].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.lessons.list.path] }),
  });
}

export function useDeleteLesson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.lessons.delete.path, { id });
      const res = await fetch(url, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete lesson");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.lessons.list.path] }),
  });
}
