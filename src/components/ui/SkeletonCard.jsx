export default function SkeletonCard({ size = 'md', variant = 'portrait', fullWidth = false }) {
  if (variant === 'cinema') {
    return (
      <div className="w-[280px] min-w-[280px] shrink-0 overflow-hidden rounded-lg bg-surface animate-shimmer">
        <div className="aspect-[2/3] w-full bg-surface-2/60" />
        <div className="space-y-3 p-3">
          <div className="h-6 w-4/5 rounded bg-surface-2/60" />
          <div className="h-4 w-2/5 rounded bg-surface-2/60" />
          <div className="h-12 w-full rounded-full bg-surface-2/60" />
        </div>
      </div>
    );
  }

  if (variant === 'coming-soon') {
    return (
      <div className="w-[250px] min-w-[250px] shrink-0 overflow-hidden rounded-lg bg-surface animate-shimmer">
        <div className="aspect-[2/3] w-full bg-surface-2/60" />
        <div className="space-y-3 p-3.5">
          <div className="h-6 w-4/5 rounded bg-surface-2/60" />
          <div className="h-4 w-2/5 rounded bg-surface-2/60" />
          <div className="h-8 w-full rounded bg-surface-2/60" />
          <div className="h-10 w-full rounded-full bg-surface-2/60" />
        </div>
      </div>
    );
  }

  if (variant === 'streaming') {
    return (
      <div className="grid h-[242px] w-[330px] min-w-[330px] animate-shimmer grid-cols-[138px_minmax(0,1fr)] overflow-hidden rounded-lg border border-border bg-surface sm:h-[258px] sm:w-[390px] sm:min-w-[390px] sm:grid-cols-[160px_minmax(0,1fr)]">
        <div className="h-full border-r border-border bg-surface-2/60" />
        <div className="flex flex-col gap-2 p-4">
          <div className="h-5 w-2/5 rounded bg-surface-2/60" />
          <div className="h-9 w-4/5 rounded bg-surface-2/60" />
          <div className="h-3 w-1/2 rounded bg-surface-2/60" />
          <div className="h-12 w-full rounded bg-surface-2/60" />
          <div className="mt-auto h-7 w-full border-t border-border pt-3">
            <div className="h-3 w-3/4 rounded bg-surface-2/60" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'youtube') {
    return (
      <div className={`animate-shimmer overflow-hidden rounded-lg border border-border bg-surface ${fullWidth ? 'h-[360px] w-full sm:h-[430px] lg:h-[390px]' : 'h-[350px] w-72 sm:h-[370px] sm:w-80'}`}>
        <div className="aspect-video w-full border-b border-border bg-surface-2/60" />
        <div className="flex h-full flex-col gap-2 p-3">
          <div className="h-5 w-3/4 rounded bg-surface-2/60" />
          <div className="h-3 w-2/5 rounded bg-surface-2/60" />
          <div className="h-9 w-full rounded bg-surface-2/60" />
          <div className="mt-auto h-8 w-full border-t border-border pt-3">
            <div className="h-3 w-4/5 rounded bg-surface-2/60" />
          </div>
        </div>
      </div>
    );
  }

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
