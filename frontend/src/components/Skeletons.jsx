import React from "react";

export function Skeleton({ className = "", style }) {
  return <div style={style} className={`shimmer rounded-md ${className}`} />;
}

export function StatCardSkeleton() {
  return (
    <div className="surface rounded-lg p-5">
      <Skeleton className="h-3 w-24 mb-3" />
      <Skeleton className="h-7 w-32 mb-2" />
      <Skeleton className="h-3 w-40" />
    </div>
  );
}

export function ChartSkeleton({ height = 260 }) {
  return (
    <div className="surface rounded-lg p-5">
      <Skeleton className="h-3 w-32 mb-2" />
      <Skeleton className="h-5 w-48 mb-4" />
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

export function ListSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 surface rounded-md">
          <Skeleton className="w-8 h-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-2 w-24" />
          </div>
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}
