"use client"

import Link from "next/link"
import { ClientTime } from "@/components/datetime"
import { canTransitionSigning, type SigningStatus } from "@/lib/signing/transitions"
import { Section } from "./Section"
import { DocVersionList } from "./DocVersionList"
import type { WorkspaceData } from "./types"

// Signing as work: real versions, real signer states, the immutable event
// trail, and the next action the state machine actually allows. Acting
// (invite, send, sign) stays on the document page behind server checks;
// this surface explains and links, never authorizes.
function nextAction(data: WorkspaceData): string {
  const latestByType = new Map<string, (typeof data.versions)[number]>()
  for (const v of data.versions) {
    if (!latestByType.has(v.document_type)) latestByType.set(v.document_type, v)
  }
  for (const v of latestByType.values()) {
    const status = (v.status ?? "draft") as SigningStatus
    if (status === "locked" || status === "superseded" || status === "fully_signed") continue
    if (canTransitionSigning(status, "owner_signed")) return "This document is ready for your signature."
    if (status === "owner_signed") return "Waiting on the counterparty. Invite or nudge them from the document page."
    if (status === "counterparty_pending" || status === "sent") return "Counterparty signature outstanding."
    return "Prepare this document for signing from the document page."
  }
  return "No document is in a signing state right now."
}

export function SigningWorkspace({ data, auditId }: {
  data: WorkspaceData
  auditId?: string | null
}) {
  const pending = data.signers.filter((s) => s.status === "pending")
  const executed = data.signers.length > 0 && pending.length === 0
  const signingActive = data.signers.length > 0 && !executed
  const reminders = data.monitoringEvents.slice(0, 3)
  return (
    <div>
      {(signingActive || executed) && (
        <Section title={executed ? "Signed" : "Ready to sign"} hint={executed ? "The ceremony is complete." : "Analysis ends here. Certainty begins."}>
          <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {executed ? "Signed" : "Ready to sign"}
            </p>
            {executed ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Fully executed and immutable. {data.monitoringEvents.length > 0
                  ? `${data.monitoringEvents.length} obligation${data.monitoringEvents.length === 1 ? "" : "s"} staying guarded.`
                  : "Track its obligations in monitoring."}
              </p>
            ) : (
              <div className="mt-2 text-left">
                <p className="text-xs font-medium">
                  {data.openCounts.total > 0
                    ? `${data.openCounts.total} open item${data.openCounts.total === 1 ? "" : "s"} on this deal`
                    : "No open items on this deal"}
                </p>
                {reminders.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Things you will want to remember
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {reminders.map((e) => (
                        <li key={e.id} className="text-xs text-muted-foreground">
                          {e.title ?? "Obligation"}{e.due_date ? ` — ${e.due_date}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {auditId && (
                  <Link href={`/document/${auditId}`} className="mt-3 inline-block rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
                    Sign deal
                  </Link>
                )}
              </div>
            )}
          </div>
        </Section>
      )}
      <Section title="Status" hint={nextAction(data)}>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span><span className="font-medium text-foreground">{data.versions.length}</span> versions</span>
          <span><span className="font-medium text-foreground">{data.signers.length}</span> signers</span>
          <span><span className="font-medium text-foreground">{pending.length}</span> signatures outstanding</span>
        </div>
      </Section>
      <Section title="Signers" hint="Who must sign and where each stands.">
        {data.signers.length === 0 ? (
          <p className="text-xs text-muted-foreground">No signers invited yet. Invite them from the document page.</p>
        ) : (
          <div className="space-y-1.5">
            {data.signers.map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
                <span className="font-medium">{s.name ?? s.email ?? "Signer"}</span>
                {s.party_label && <span className="text-muted-foreground">· {s.party_label}</span>}
                <span className="ml-auto rounded-full border px-2 py-0.5 capitalize">{(s.status ?? "pending").replaceAll("_", " ")}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
      <Section title="Versions" hint="Current and previous, newest first.">
        {data.versions.length > 0 ? (
          <DocVersionList versions={data.versions} previewChars={160} />
        ) : (
          <p className="text-xs text-muted-foreground">
            No document versions yet.{" "}
            {auditId ? (
              <Link href={`/document/${auditId}`} className="font-medium text-primary hover:underline">
                Open the document to generate one
              </Link>
            ) : (
              "Generate a draft in chat first."
            )}
          </p>
        )}
      </Section>
      {data.signingEvents.length > 0 && (
        <Section title="Events" hint="Immutable trail, newest last.">
          <div className="space-y-1">
            {data.signingEvents.slice(-12).map((e) => (
              <p key={e.id} className="text-xs text-muted-foreground">
                <span className="font-medium capitalize text-foreground">{(e.event_type ?? "event").replaceAll("_", " ")}</span>
                {e.created_at ? (
                  <>
                    {" · "}
                    <ClientTime iso={e.created_at} kind="datetime" />
                  </>
                ) : (
                  ""
                )}
              </p>
            ))}
          </div>
        </Section>
      )}
      {auditId && (
        <Section title="Next action">
          <Link href={`/document/${auditId}`} className="inline-block rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
            Open document signing
          </Link>
        </Section>
      )}
    </div>
  )
}
