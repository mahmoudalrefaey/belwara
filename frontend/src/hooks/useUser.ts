"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getUserId } from "@/lib/auth";
import type { UsageResponse, UserResponse } from "@/types/api";

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

export function useUsage() {
  return useQuery<UsageResponse>({
    queryKey: ["usage"],
    queryFn: async () => {
      const { data } = await api.get("/users/me/usage");
      return data;
    },
    staleTime: 60_000,
  });
}

/** Download everything stored about the account as a JSON file. */
export async function downloadMyData() {
  const { data } = await api.get("/users/me/export", { responseType: "blob" });
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = "belwara-export.json";
  a.click();
  URL.revokeObjectURL(url);
}

export function useDeleteAccount() {
  return useMutation<void, Error, string>({
    mutationFn: async (password) => {
      await api.delete("/users/me", { data: { password } });
    },
  });
}
