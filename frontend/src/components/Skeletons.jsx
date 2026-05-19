import React from "react";

export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse bg-zinc-900 rounded-md ${className}`} />;
}

export function StatCardSkeleton() {
  return (
    <div className="border border-zinc-800 rounded-md p-5 bg-zinc-950">
      <Skeleton className="h-3 w-24 mb-3" />
      <Skeleton className="h-8 w-32 mb-2" />
      <Skeleton className="h-3 w-40" />
    </div>
  );
}

export function ChartSkeleton({ height = 260 }) {
  return (
    <div className="border border-zinc-800 rounded-md p-5 bg-zinc-950">
      <Skeleton className="h-3 w-32 mb-2" />
      <Skeleton className="h-6 w-48 mb-4" />
      <Skeleton className={`w-full`} style={{ height }} />
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }) {
  return (
    <tr className="border-b border-zinc-900">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-5 py-3"><Skeleton className="h-3 w-full" /></td>
      ))}
    </tr>
  );
}
