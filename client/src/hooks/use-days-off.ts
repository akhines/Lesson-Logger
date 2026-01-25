import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { DayOff } from "@shared/schema";

export function useDaysOff() {
  return useQuery<DayOff[]>({
    queryKey: ["/api/days-off"],
  });
}

export function useCreateDayOff() {
  return useMutation({
    mutationFn: async (data: { date: string; reason?: string }) => {
      const response = await apiRequest("POST", "/api/days-off", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/days-off"] });
      queryClient.invalidateQueries({ queryKey: ["/api/lessons"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
    },
  });
}

export function useDeleteDayOff() {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/days-off/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/days-off"] });
    },
  });
}
