"use client"

import { Check, Plus, Users } from "lucide-react"

const ROLE_COLUMNS = ["Owner", "Admin", "Member", "Viewer"] as const

// Rows: permission -> roles that hold it. This matrix is the design
// decision itself: small, plain-language roles; groups (not individuals)
// carry approvals and access; new members land lowest.
const MATRIX: Array<{ group: string; rows: Array<{ label: string; desc: string; holds: boolean[] }> }> = [
  {
    group: "Deals",
    rows: [
      { label: "View deals", desc: "See deals shared with you.", holds: [true, true, true, true] },
      { label: "Create deals", desc: "Start analyses, drafts, and threads.", holds: [true, true, true, false] },
      { label: "Delete deals", desc: "Remove deals and their history.", holds: [true, true, false, false] },
    ],
  },
  {
    group: "Documents & Signing",
    rows: [
      { label: "Generate documents", desc: "Produce drafts from deals.", holds: [true, true, true, false] },
      { label: "Send for signature", desc: "Start signing ceremonies.", holds: [true, true, true, false] },
      { label: "Sign as owner", desc: "Apply your own signature.", holds: [true, true, true, false] },
    ],
  },
  {
    group: "Approvals",
    rows: [
      { label: "Request approval", desc: "Raise decisions to the queue.", holds: [true, true, true, false] },
      { label: "Approve for the team", desc: "Decide others' requests.", holds: [true, true, false, false] },
      { label: "Manage approval rules", desc: "Set who must approve what.", holds: [true, true, false, false] },
    ],
  },
  {
    group: "Team & Billing",
    rows: [
      { label: "Invite members", desc: "Bring people in at Member or below.", holds: [true, true, false, false] },
      { label: "Manage roles & groups", desc: "Change roles, run groups.", holds: [true, true, false, false] },
      { label: "Manage billing", desc: "Credits, invoices, plans.", holds: [true, false, false, false] },
      { label: "Delete the workspace", desc: "Irreversible, confirmed twice.", holds: [true, false, false, false] },
    ],
  },
]

// Team foreground: layout and states only. Invites, groups, role changes,
// and enforcement wire up when the tab gets its functions.
export function TeamView() {
  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col overflow-y-auto px-4 pb-6 sm:px-6">
      <div className="flex shrink-0 items-end justify-between gap-3 pb-4 pt-6">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">Team</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Members, groups, and who can do what.
          </p>
        </div>
        <span className="inline-flex h-9 shrink-0 items-center gap-1.5 bg-primary px-4 text-xs font-semibold text-primary-foreground opacity-40" aria-disabled="true">
          <Plus className="h-3.5 w-3.5" />
          Invite
        </span>
      </div>

      <section aria-label="Members" className="shrink-0">
        <h2 className="text-sm font-semibold">Members</h2>
        <div className="mt-2 border border-dashed px-4 py-10 text-center">
          <Users className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Only you here — so far</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Invites land here with role and status, newest first. Inviting wires up with this tab&apos;s functions.
          </p>
        </div>
      </section>

      <section aria-label="Groups" className="mt-6 shrink-0">
        <h2 className="text-sm font-semibold">Groups</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Reusable sets of people — approvals and access go to groups, not individuals.
        </p>
        <div className="mt-2 border border-dashed px-4 py-10 text-center">
          <p className="text-sm font-medium">No groups yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Finance, Legal, Founders — group once, assign everywhere. Groups wire up with this tab&apos;s functions.
          </p>
        </div>
      </section>

      <section aria-label="Roles" className="mt-6 shrink-0">
        <h2 className="text-sm font-semibold">Roles</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Small and plain-language. New members land lowest; destructive powers stay at the top.
        </p>
        <div className="mt-2 overflow-x-auto border border-border">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-3 py-2 font-semibold">Permission</th>
                {ROLE_COLUMNS.map((r) => (
                  <th key={r} scope="col" className="px-3 py-2 text-center font-semibold">{r}</th>
                ))}
              </tr>
            </thead>
            {MATRIX.map((g) => (
              <tbody key={g.group} className="border-b border-border last:border-b-0">
                <tr>
                  <td colSpan={5} className="bg-muted/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {g.group}
                  </td>
                </tr>
                {g.rows.map((row) => (
                  <tr key={row.label} className="border-t border-border/60">
                    <td className="px-3 py-2">
                      <span className="block text-[13px] font-medium">{row.label}</span>
                      <span className="block text-[11px] text-muted-foreground">{row.desc}</span>
                    </td>
                    {row.holds.map((has, i) => (
                      <td key={ROLE_COLUMNS[i]} className="px-3 py-2 text-center">
                        {has ? (
                          <Check className="mx-auto h-4 w-4 text-foreground" aria-label="Included" />
                        ) : (
                          <span className="text-muted-foreground" aria-label="Not included">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </section>
    </div>
  )
}
