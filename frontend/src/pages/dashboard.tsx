import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useRewards } from "@/hooks/use-rewards";
import { MITO_DECIMALS, MITO_PRICE_USD } from "@/lib/constants";
import { refreshRewards, fetchMitosisPrice } from "@/lib/api";
import { cn, formatTokenAmount, formatUsd, parseTokenAmount } from "@/lib/utils";

const formatEpochCreatedUtc = (isoString: string) => {
  const date = new Date(isoString);
  const pad = (value: number) => value.toString().padStart(2, "0");

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hour = pad(date.getUTCHours());
  const minute = pad(date.getUTCMinutes());

  return `${year}년 ${month}월 ${day}일 ${hour}:${minute} (UTC)`;
};

export function DashboardPage() {
  const { user, logout } = useAuth();
  const { data: rewards = [], isLoading, isError, refetch } = useRewards();
  const { data: priceData, isLoading: isPriceLoading } = useQuery({
    queryKey: ["mitosis-price"],
    queryFn: fetchMitosisPrice,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    staleTime: 4 * 60 * 1000, // Consider stale after 4 minutes
  });

  const mitoPrice = priceData?.price ?? MITO_PRICE_USD;

  const toUsd = (tokenAmountBaseUnits: string) => {
    const numeric = parseTokenAmount(tokenAmountBaseUnits, MITO_DECIMALS);
    return Number.isFinite(numeric) ? numeric * mitoPrice : 0;
  };
  const [refreshFeedback, setRefreshFeedback] = useState<
    | { message: string; tone: "success" | "info" | "error" }
    | null
  >(null);

  const refreshMutation = useMutation({
    mutationFn: refreshRewards,
    onSuccess: (data) => {
      refetch();

      if ((data.status === "new-reward" || data.status === "initialized") && data.newReward) {
        setRefreshFeedback({
          message: `${
            data.status === "initialized" ? "Initialized" : "Epoch"
          } ${data.newReward.epoch} recorded (${formatTokenAmount(
            data.newReward.amount,
            MITO_DECIMALS,
            4
          )} $MITO).`,
          tone: "success"
        });
        return;
      }

      if (data.status === "skipped") {
        setRefreshFeedback({
          message: "Refresh already in progress. Please try again shortly.",
          tone: "info"
        });
        return;
      }

      setRefreshFeedback({
        message:
          data.message ??
          (data.updatedClaimedCount > 0
            ? `Updated ${data.updatedClaimedCount} claimed reward${
                data.updatedClaimedCount > 1 ? "s" : ""
              }.`
            : "No new rewards detected."),
        tone: "info"
      });
    },
    onError: () => {
      setRefreshFeedback({
        message: "Manual refresh failed. Please retry in a moment.",
        tone: "error"
      });
    }
  });

  const totals = useMemo(() => {
    return rewards.reduce(
      (acc, reward) => {
        const baseAmount = reward.rewardAmount;
        const usdValue = toUsd(baseAmount);

        acc.totalUsd += usdValue;

        if (reward.claimed) {
          acc.claimedUsd += usdValue;
        }

        return acc;
      },
      { claimedUsd: 0, totalUsd: 0 }
    );
  }, [rewards, mitoPrice]);

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-lg font-semibold">MITO Distribution Overview</p>
            <p className="text-sm text-muted-foreground">Track the latest MITO allocations at a glance.</p>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/reward-management">
              <Button variant="ghost" size="sm">
                Reward Management
              </Button>
            </Link>
            <div className="text-right">
              <p className="text-sm font-medium">{user?.email}</p>
            </div>
            <Button variant="outline" onClick={logout}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-6">
        <section className="grid gap-4 md:grid-cols-3">
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Current MITO Price</CardTitle>
              <CardDescription>Latest price per MITO token from Coingecko.</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              {isPriceLoading ? (
                <p className="text-lg text-muted-foreground">Loading...</p>
              ) : (
                <p className="text-3xl font-semibold">${mitoPrice.toFixed(4)}</p>
              )}
            </CardContent>
          </Card>

          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Claimed to Date</CardTitle>
              <CardDescription>Total USD claimed across epochs.</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <p className="text-3xl font-semibold">{formatUsd(totals.claimedUsd)}</p>
            </CardContent>
          </Card>

          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>All-Time USD Earned</CardTitle>
              <CardDescription>Aggregate USD value across all epochs.</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <p className="text-3xl font-semibold">{formatUsd(totals.totalUsd)}</p>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold">MITO Distribution</h2>
              <p className="text-sm text-muted-foreground">Validator rewards loaded directly from the API.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="md:w-auto"
              onClick={() => {
                setRefreshFeedback(null);
                refreshMutation.mutate();
              }}
              disabled={refreshMutation.isPending}
            >
              {refreshMutation.isPending ? "Refreshing..." : "Refresh now"}
            </Button>
          </div>
          {refreshFeedback && (
            <p
              className={cn(
                "text-sm",
                refreshFeedback.tone === "error"
                  ? "text-destructive"
                  : refreshFeedback.tone === "success"
                    ? "text-emerald-600"
                    : "text-muted-foreground"
              )}
            >
              {refreshFeedback.message}
            </p>
          )}
          <div className="overflow-hidden rounded-lg border bg-background shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                    <th className="px-3 py-2">Epoch</th>
                    <th className="px-3 py-2">$MITO Amount</th>
                    <th className="px-3 py-2">$USD Value</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Created (UTC)</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">
                        Loading rewards...
                      </td>
                    </tr>
                  )}

                  {isError && !isLoading && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-sm text-destructive">
                        Failed to load rewards.{' '}
                        <button className="underline" type="button" onClick={() => refetch()}>
                          Retry
                        </button>
                      </td>
                    </tr>
                  )}

                  {!isLoading && !isError && rewards.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">
                        No rewards have been recorded yet.
                      </td>
                    </tr>
                  )}

                  {!isLoading && !isError &&
                    rewards.map((reward) => {
                      const mitoDisplay = formatTokenAmount(reward.rewardAmount, MITO_DECIMALS, 6);
                      const usdValue = toUsd(reward.rewardAmount);

                      return (
                        <tr key={reward.id} className="border-b last:border-0">
                          <td className="px-3 py-2">Epoch {reward.epoch}</td>
                          <td className="px-3 py-2 font-mono">{mitoDisplay}</td>
                          <td className="px-3 py-2 font-mono">{formatUsd(usdValue)}</td>
                          <td className="px-3 py-2">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
                                reward.claimed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                              )}
                            >
                              {reward.claimed ? "Claimed" : "Pending"}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                            {formatEpochCreatedUtc(reward.createdAt)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
