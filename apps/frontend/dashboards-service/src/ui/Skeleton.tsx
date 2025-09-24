export function Skeleton({ className="" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-gray-200/70 dark:bg-gray-700/40 ${className}`} />;
}

