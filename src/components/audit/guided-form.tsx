"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

interface ClientProfile {
  id: string
  name: string
  company: string | null
  email: string | null
}

interface FormFields {
  project_type: string
  budget: string
  timeline: string
  deliverables: string
  notes: string
}

interface GuidedFormProps {
  value: FormFields
  onChange: (fields: FormFields) => void
  clientProfiles?: ClientProfile[]
  clientId?: string | null
  onChangeClientId?: (id: string | null) => void
}

export function GuidedForm({ value, onChange, clientProfiles, clientId, onChangeClientId }: GuidedFormProps) {
  const updateField = (key: keyof FormFields, val: string) => {
    onChange({ ...value, [key]: val })
  }

  return (
    <div className="flex flex-col gap-5">
      {clientProfiles && onChangeClientId && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="client_profile">Client</Label>
          <select
            id="client_profile"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={clientId ?? ""}
            onChange={(e) => onChangeClientId(e.target.value || null)}
          >
            <option value="">New client (no profile)</option>
            {clientProfiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.company ? ` — ${p.company}` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      <label className="text-sm font-medium">Project details</label>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="project_type">Project type</Label>
          <Input
            id="project_type"
            placeholder="e.g. Website redesign, Mobile app, Brand identity"
            value={value.project_type}
            onChange={(e) => updateField("project_type", e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="budget">Budget</Label>
          <Input
            id="budget"
            placeholder="e.g. $5,000 - $10,000"
            value={value.budget}
            onChange={(e) => updateField("budget", e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="timeline">Timeline</Label>
        <Input
          id="timeline"
          placeholder="e.g. 4 weeks, Q2 2026, By March 1st"
          value={value.timeline}
          onChange={(e) => updateField("timeline", e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="deliverables">Deliverables</Label>
        <textarea
          id="deliverables"
          className="min-h-[100px] w-full rounded-md border border-input bg-transparent p-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
          placeholder="List the agreed deliverables..."
          value={value.deliverables}
          onChange={(e) => updateField("deliverables", e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">Additional notes</Label>
        <textarea
          id="notes"
          className="min-h-[100px] w-full rounded-md border border-input bg-transparent p-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
          placeholder="Any other relevant information..."
          value={value.notes}
          onChange={(e) => updateField("notes", e.target.value)}
        />
      </div>
    </div>
  )
}
