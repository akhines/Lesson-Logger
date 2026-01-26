import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type CreateSubjectRequest, type UpdateSubjectRequest, type SubjectWithStudents } from "@shared/routes";

export type { SubjectWithStudents };

export function useSubjects() {
  return useQuery({
    queryKey: [api.subjects.list.path],
    queryFn: async () => {
      const res = await fetch(api.subjects.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch subjects");
      return api.subjects.list.responses[200].parse(await res.json());
    },
  });
}

export function useSubject(id: number) {
  return useQuery({
    queryKey: [api.subjects.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.subjects.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch subject");
      return api.subjects.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateSubjectRequest) => {
      const res = await fetch(api.subjects.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create subject");
      return api.subjects.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.subjects.list.path] }),
  });
}

export function useUpdateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & UpdateSubjectRequest) => {
      const url = buildUrl(api.subjects.update.path, { id });
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update subject");
      return api.subjects.update.responses[200].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.subjects.list.path] }),
  });
}

export function useDeleteSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.subjects.delete.path, { id });
      const res = await fetch(url, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete subject");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.subjects.list.path] }),
  });
}

export function useSubjectStudents(subjectId: number | undefined) {
  return useQuery({
    queryKey: ["/api/subjects", subjectId, "students"],
    queryFn: async () => {
      if (!subjectId) return [];
      const res = await fetch(`/api/subjects/${subjectId}/students`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch subject students");
      return res.json();
    },
    enabled: !!subjectId,
  });
}

export function useSetSubjectStudents() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ subjectId, studentIds }: { subjectId: number; studentIds: number[] }) => {
      const res = await fetch(`/api/subjects/${subjectId}/students`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update subject students");
      return res.json();
    },
    onSuccess: (_, { subjectId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subjectId, "students"] });
      queryClient.invalidateQueries({ queryKey: [api.subjects.list.path] });
    },
  });
}
