import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: deleted, error } = await supabase
    .from("audits")
    .delete()
    .eq("user_id", user.id)
    .in("title", ["New Audit", "New Deal"])
    .not("status", "in", '("in_progress","processing")')
    .lt("created_at", twentyFourHoursAgo)
    .select("id")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Storage objects do not cascade with the audit row: remove each deleted
  // audit's folder so files cannot orphan. Best-effort per audit; a storage
  // failure never fails the row cleanup.
  let storageErrors = 0
  for (const row of (deleted ?? []) as Array<{ id: string }>) {
    try {
      const prefix = `${user.id}/${row.id}`
      const { data: objects } = await supabase.storage.from("audit-files").list(prefix)
      const paths = (objects ?? [])
        .map((o) => (typeof o.name === "string" ? `${prefix}/${o.name}` : null))
        .filter((p): p is string => p !== null)
      if (paths.length > 0) {
        const { error: removeError } = await supabase.storage.from("audit-files").remove(paths)
        if (removeError) storageErrors++
      }
    } catch {
      storageErrors++
    }
  }
  return NextResponse.json({ ok: true, deleted: (deleted ?? []).length, storageErrors })
}
