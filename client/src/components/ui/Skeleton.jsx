export function Skeleton({ className='' }) { return <div className={`animate-pulse rounded-lg bg-slate-200 dark:bg-navy-700 ${className}`} />; }
export function PageSkeleton() {
  return <div className="space-y-4">{[1,2,3].map(i=><div key={i} className="card p-5 space-y-3"><Skeleton className="h-5 w-1/3"/><Skeleton className="h-4 w-full"/><Skeleton className="h-4 w-2/3"/></div>)}</div>;
}
