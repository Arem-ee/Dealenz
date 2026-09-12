import { DetailSkeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="px-4 sm:px-6 py-8 max-w-xl mx-auto">
      <DetailSkeleton />
    </div>
  )
}
