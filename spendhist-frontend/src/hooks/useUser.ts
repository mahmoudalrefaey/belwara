"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getUserId } from "@/lib/auth";
import type { UserResponse } from "@/types/api";

export function useUser() {
  const userId = getUserId();
  return useQuery<UserResponse>({
    queryKey: ["user", userId],
    queryFn: async () => {
      const { data } = await api.get(`/users/${userId}`);
      return data;
    },
    enabled: !!userId,
    staleTime: 300_000,
  });
}
