export default function SkeletonCard({ size = 'md', variant = 'portrait' }) {
  if (variant === 'landscape') {
    return (
      <div className="flex flex-col gap-2 w-72 sm:w-80 animate-shimmer">
        <div className="aspect-video w-full rounded-2xl bg-surface-2/60 border border-white/5"></div>
        <div className="flex flex-col gap-1.5 px-1 mt-1">
          <div className="h-4 bg-surface-2/60 rounded w-3/4"></div>
          <div className="h-3 bg-surface-2/60 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  const sizeClasses = {
    sm: 'w-36 h-56 min-w-[9rem]',
    md: 'w-48 h-72 min-w-[12rem]',
    lg: 'w-64 h-96 min-w-[16rem]'
  };

  return (
    <div className={`rounded-xl overflow-hidden bg-surface animate-shimmer ${sizeClasses[size]}`}>
      <div className="w-full h-full"></div>
    </div>
  );
}
