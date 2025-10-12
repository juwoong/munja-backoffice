import { useQuery } from "@tanstack/react-query";

import { fetchRewards } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

export function useRewards() {
  const { token } = useAuth();

  return useQuery({
    queryKey: ["rewards"],
    queryFn: fetchRewards,
    enabled: Boolean(token),
    staleTime: 60_000,
    refetchInterval: 5 * 60 * 1000
  });
}
