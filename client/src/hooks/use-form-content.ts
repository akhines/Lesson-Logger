import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { FormContent, CreateFormContentRequest, UpdateFormContentRequest } from "@shared/schema";

export function useFormContent(formLevel?: string) {
  return useQuery<FormContent[]>({
    queryKey: formLevel ? ['/api/form-content', formLevel] : ['/api/form-content'],
    queryFn: async () => {
      const url = formLevel ? `/api/form-content?formLevel=${formLevel}` : '/api/form-content';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch form content');
      return res.json();
    },
  });
}

export function useFormContentById(id: number) {
  return useQuery<FormContent>({
    queryKey: ['/api/form-content', id],
    queryFn: async () => {
      const res = await fetch(`/api/form-content/${id}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch form content');
      return res.json();
    },
    enabled: !!id,
  });
}

export function useCreateFormContent() {
  return useMutation({
    mutationFn: async (data: CreateFormContentRequest) => {
      const res = await apiRequest('POST', '/api/form-content', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/form-content'] });
    },
  });
}

export function useUpdateFormContent() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateFormContentRequest }) => {
      const res = await apiRequest('PUT', `/api/form-content/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/form-content'] });
    },
  });
}

export function useDeleteFormContent() {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/form-content/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/form-content'] });
    },
  });
}
