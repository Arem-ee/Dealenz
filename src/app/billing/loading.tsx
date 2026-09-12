import { DetailSkeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="px-4 sm:px-6 py-5 sm:py-7 max-w-3xl mx-auto">
      <DetailSkeleton />
    </div>
  )
}
