"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./api";
import type {
  EventDTO,
  EventStatsDTO,
  SimulationDTO,
} from "@/lib/db/serializers";
import type { CreateEventInput } from "@/lib/validation/events";

export interface EventWithStats extends EventDTO {
  stats: EventStatsDTO | null;
  simulationCount: number;
}

export interface EventListResponse {
  items: EventWithStats[];
  total: number;
  page: number;
  pageSize: number;
}

export interface EventFilters {
  ticker?: string;
  from?: string;
  to?: string;
  source?: string;
  category?: string;
  page?: number;
}

export function useEvents(filters: EventFilters) {
  return useQuery({
    queryKey: ["events", filters],
    queryFn: () => {
      const search = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== "") search.set(key, String(value));
      }
      return apiFetch<EventListResponse>(`/api/events?${search}`);
    },
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEventInput) =>
      apiFetch<{ event: EventDTO; stats: EventStatsDTO | null }>(
        "/api/events",
        { method: "POST", body: JSON.stringify(input) },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/events/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["events"] });
      void queryClient.invalidateQueries({ queryKey: ["simulations"] });
    },
  });
}

export interface SimulationWithEvent extends SimulationDTO {
  event: EventDTO;
}

export function useRecentSimulations(limit = 50) {
  return useQuery({
    queryKey: ["simulations", "recent", limit],
    queryFn: () =>
      apiFetch<SimulationWithEvent[]>(`/api/simulations?limit=${limit}`),
  });
}

export function useRunSimulation(eventId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => {
      if (!eventId) throw new Error("Save the event before simulating");
      return apiFetch<SimulationDTO>(`/api/events/${eventId}/simulations`, {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["simulations"] });
      void queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useDeleteSimulation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/simulations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["simulations"] });
      void queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}
