import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

const mitoPriceUsd = 0.14;

const distributionRows = [
  {
    epoch: "Epoch 1",
    mitoAmount: 12500,
    usdValue: 1750,
    isClaimed: true,
    createdAtUtc: "2024-05-30T09:00:00Z"
  },
  {
    epoch: "Epoch 2",
    mitoAmount: 8000,
    usdValue: 1120,
    isClaimed: false,
    createdAtUtc: "2024-06-13T09:00:00Z"
  },
  {
    epoch: "Epoch 3",
    mitoAmount: 5250,
    usdValue: 735,
    isClaimed: false,
    createdAtUtc: "2024-06-27T09:00:00Z"
  }
];

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD"
});

const getClaimTotals = () => {
  return distributionRows.reduce(
    (totals, row) => {
      const usdValue = row.usdValue;
      totals.totalUsd += usdValue;
      if (row.isClaimed) {
        totals.claimedUsd += usdValue;
      }
      return totals;
    },
    { claimedUsd: 0, totalUsd: 0 }
  );
};

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
  const { claimedUsd, totalUsd } = getClaimTotals();

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-lg font-semibold">MITO Distribution Overview</p>
            <p className="text-sm text-muted-foreground">Track the latest MITO allocations at a glance.</p>
          </div>
          <div className="flex items-center gap-4">
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
              <CardDescription>Latest known price per MITO token.</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <p className="text-3xl font-semibold">${mitoPriceUsd.toFixed(2)}</p>
            </CardContent>
          </Card>

          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Claimed to Date</CardTitle>
              <CardDescription>Total USD claimed across epochs.</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <p className="text-3xl font-semibold">{usdFormatter.format(claimedUsd)}</p>
            </CardContent>
          </Card>

          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>All-Time USD Earned</CardTitle>
              <CardDescription>Aggregate USD value across all epochs.</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <p className="text-3xl font-semibold">{usdFormatter.format(totalUsd)}</p>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">MITO Distribution</h2>
            <p className="text-sm text-muted-foreground">Example allocation data for each epoch.</p>
          </div>
          <div className="overflow-hidden rounded-lg border bg-background shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                    <th className="px-3 py-2">Epoch</th>
                    <th className="px-3 py-2">$MITO Amount</th>
                    <th className="px-3 py-2">$USD Value</th>
                    <th className="px-3 py-2">Is Claimed</th>
                    <th className="px-3 py-2">Epoch Created (UTC)</th>
                  </tr>
                </thead>
                <tbody>
                  {distributionRows.map((row) => (
                    <tr key={row.epoch} className="border-b last:border-0">
                      <td className="px-3 py-2">{row.epoch}</td>
                      <td className="px-3 py-2 font-mono">{row.mitoAmount.toLocaleString()}</td>
                      <td className="px-3 py-2 font-mono">{usdFormatter.format(row.usdValue)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                            row.isClaimed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {row.isClaimed ? "Claimed" : "Pending"}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                        {formatEpochCreatedUtc(row.createdAtUtc)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
