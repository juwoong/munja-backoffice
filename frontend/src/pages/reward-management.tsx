import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useRewards } from "@/hooks/use-rewards";
import {
  createRewardAction,
  deleteRewardAction,
  fetchRewardActions,
  fetchRewardActionsSummary,
  type CreateRewardActionPayload,
} from "@/lib/api";
import { MITO_DECIMALS } from "@/lib/constants";
import { cn, formatTokenAmount, formatUsd, parseTokenAmount } from "@/lib/utils";

const formatDateTime = (isoString: string) => {
  const date = new Date(isoString);
  const pad = (value: number) => value.toString().padStart(2, "0");

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());

  return `${year}년 ${month}월 ${day}일 ${hour}:${minute}`;
};

export function RewardManagementPage() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const { data: rewards = [] } = useRewards();

  const [actionType, setActionType] = useState<"RESTAKING" | "SELL">("RESTAKING");
  const [amount, setAmount] = useState("");
  const [averagePrice, setAveragePrice] = useState("");
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState<{
    message: string;
    tone: "success" | "error";
  } | null>(null);

  const { data: actions = [], isLoading: isLoadingActions } = useQuery({
    queryKey: ["reward-actions"],
    queryFn: fetchRewardActions,
  });

  const { data: summary } = useQuery({
    queryKey: ["reward-actions-summary"],
    queryFn: fetchRewardActionsSummary,
  });

  const createMutation = useMutation({
    mutationFn: createRewardAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reward-actions"] });
      queryClient.invalidateQueries({ queryKey: ["reward-actions-summary"] });
      setAmount("");
      setAveragePrice("");
      setNote("");
      setFeedback({
        message: "Action recorded successfully!",
        tone: "success",
      });
    },
    onError: (error: any) => {
      setFeedback({
        message: error.response?.data?.error || "Failed to record action",
        tone: "error",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRewardAction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reward-actions"] });
      queryClient.invalidateQueries({ queryKey: ["reward-actions-summary"] });
    },
  });

  const totalClaimedMito = rewards
    .filter((r) => r.claimed)
    .reduce((sum, r) => sum + BigInt(r.rewardAmount), BigInt(0));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!amount) {
      setFeedback({ message: "Amount is required", tone: "error" });
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setFeedback({ message: "Amount must be greater than 0", tone: "error" });
      return;
    }

    if (actionType === "SELL" && !averagePrice) {
      setFeedback({ message: "Average price is required for SELL action", tone: "error" });
      return;
    }

    if (actionType === "SELL") {
      const priceNum = parseFloat(averagePrice);
      if (isNaN(priceNum) || priceNum <= 0) {
        setFeedback({ message: "Average price must be greater than 0", tone: "error" });
        return;
      }
    }

    // Check available balance
    if (summary?.availableBalance) {
      const availableBalanceNum = parseTokenAmount(summary.availableBalance, MITO_DECIMALS);
      if (amountNum > availableBalanceNum) {
        setFeedback({
          message: `Insufficient balance. Available: ${availableBalanceNum.toFixed(6)} MITO`,
          tone: "error",
        });
        return;
      }
    }

    try {
      // Convert amount to base units
      const amountInBaseUnits = (amountNum * 1e18).toString();

      const payload: CreateRewardActionPayload = {
        actionType,
        amount: amountInBaseUnits,
        averagePrice: actionType === "SELL" ? parseFloat(averagePrice) : undefined,
        note: note.trim() || undefined,
      };

      createMutation.mutate(payload);
    } catch (error) {
      setFeedback({ message: "Invalid amount", tone: "error" });
    }
  };

  const totalRestakingDisplay = summary
    ? formatTokenAmount(summary.totalRestaking, MITO_DECIMALS, 6)
    : "0";

  const totalSellRevenueDisplay = summary ? formatUsd(summary.totalSellRevenue) : "$0.00";

  const availableBalanceDisplay = summary
    ? formatTokenAmount(summary.availableBalance, MITO_DECIMALS, 6)
    : "0";

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-lg font-semibold">Reward Management</p>
            <p className="text-sm text-muted-foreground">Track your MITO actions: restaking and sales</p>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                Dashboard
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
        {/* Summary Cards */}
        <section className="space-y-4">
          {/* Available Balance - 강조 */}
          <Card className="flex flex-col border-2 border-green-200 bg-green-50/50">
            <CardHeader>
              <CardTitle className="text-xl">Available Balance</CardTitle>
              <CardDescription>Current available MITO for actions</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <p className="text-4xl font-bold font-mono text-green-600">
                {availableBalanceDisplay} MITO
              </p>
            </CardContent>
          </Card>

          {/* 나머지 통계 3개 */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle>Total Claimed</CardTitle>
                <CardDescription>Total MITO claimed</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <p className="text-2xl font-semibold font-mono">
                  {formatTokenAmount(totalClaimedMito.toString(), MITO_DECIMALS, 6)} MITO
                </p>
              </CardContent>
            </Card>

            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle>Total Restaked</CardTitle>
                <CardDescription>MITO restaked</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <p className="text-2xl font-semibold font-mono">{totalRestakingDisplay} MITO</p>
              </CardContent>
            </Card>

            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle>Sell Revenue</CardTitle>
                <CardDescription>USD from sales</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <p className="text-2xl font-semibold">{totalSellRevenueDisplay}</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Action Form */}
        <section>
          <Card>
            <CardHeader>
              <CardTitle>Record New Action</CardTitle>
              <CardDescription>Track your MITO restaking or sell actions</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Action Type</Label>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setActionType("RESTAKING")}
                      className={cn(
                        "flex-1 rounded-md border-2 py-3 text-sm font-medium transition-colors",
                        actionType === "RESTAKING"
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:bg-muted"
                      )}
                    >
                      RESTAKING
                    </button>
                    <button
                      type="button"
                      onClick={() => setActionType("SELL")}
                      className={cn(
                        "flex-1 rounded-md border-2 py-3 text-sm font-medium transition-colors",
                        actionType === "SELL"
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:bg-muted"
                      )}
                    >
                      SELL
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (MITO)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.000001"
                    placeholder="0.0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min="0"
                  />
                  <p className="text-xs text-muted-foreground">
                    Available: <span className="font-mono font-semibold text-green-600">{availableBalanceDisplay} MITO</span>
                  </p>
                </div>

                {actionType === "SELL" && (
                  <div className="space-y-2">
                    <Label htmlFor="averagePrice">Average Price (USD per MITO)</Label>
                    <Input
                      id="averagePrice"
                      type="number"
                      step="0.0001"
                      placeholder="0.0"
                      value={averagePrice}
                      onChange={(e) => setAveragePrice(e.target.value)}
                      min="0"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="note">Note (Optional)</Label>
                  <Input
                    id="note"
                    type="text"
                    placeholder="Add a note..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>

                {feedback && (
                  <p
                    className={cn(
                      "text-sm",
                      feedback.tone === "error" ? "text-destructive" : "text-emerald-600"
                    )}
                  >
                    {feedback.message}
                  </p>
                )}

                <Button type="submit" disabled={createMutation.isPending} className="w-full">
                  {createMutation.isPending ? "Recording..." : "Record Action"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>

        {/* Actions History */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Action History</h2>
            <p className="text-sm text-muted-foreground">All recorded MITO actions</p>
          </div>

          <div className="overflow-hidden rounded-lg border bg-background shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Amount (MITO)</th>
                    <th className="px-3 py-2">Avg Price</th>
                    <th className="px-3 py-2">Revenue/Value</th>
                    <th className="px-3 py-2">Note</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingActions && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">
                        Loading actions...
                      </td>
                    </tr>
                  )}

                  {!isLoadingActions && actions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">
                        No actions recorded yet.
                      </td>
                    </tr>
                  )}

                  {!isLoadingActions &&
                    actions.map((action) => {
                      const amountDisplay = formatTokenAmount(action.amount, MITO_DECIMALS, 6);
                      const tokenAmount = parseTokenAmount(action.amount, MITO_DECIMALS);
                      const revenue =
                        action.actionType === "SELL" && action.averagePrice
                          ? tokenAmount * action.averagePrice
                          : 0;

                      return (
                        <tr key={action.id} className="border-b last:border-0">
                          <td className="px-3 py-2 text-xs">
                            {formatDateTime(action.createdAt)}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
                                action.actionType === "RESTAKING"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-orange-100 text-orange-700"
                              )}
                            >
                              {action.actionType}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono">{amountDisplay}</td>
                          <td className="px-3 py-2 font-mono">
                            {action.averagePrice ? `$${action.averagePrice.toFixed(4)}` : "-"}
                          </td>
                          <td className="px-3 py-2 font-mono">
                            {action.actionType === "SELL" ? formatUsd(revenue) : "-"}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {action.note || "-"}
                          </td>
                          <td className="px-3 py-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteMutation.mutate(action.id)}
                              disabled={deleteMutation.isPending}
                            >
                              Delete
                            </Button>
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
