export function CardSkeleton() {
  return (
    <div className="w-full">
      <div className="shimmer aspect-[2/3] rounded-xl" />
      <div className="shimmer mt-3 h-3 w-4/5 rounded" />
      <div className="shimmer mt-2 h-3 w-2/5 rounded" />
    </div>
  )
}
export function GridSkeleton({ n = 12 }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: n }).map((_, i) => <CardSkeleton key={i} />)}
    </div>
  )
}
export function RowSkeleton() {
  return (
    <div className="px-4 sm:px-8">
      <div className="shimmer mb-4 h-6 w-48 rounded" />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="w-36 shrink-0 sm:w-44"><CardSkeleton /></div>)}
      </div>
    </div>
  )
}
export function HeroSkeleton() {
  return <div className="shimmer h-[68vh] min-h-[420px] w-full" />
}
