"use client"

import { AlertCircle, CheckCircle2, Target, FileText, Clock, DollarSign, BarChart3, Lightbulb, HelpCircle } from "lucide-react"
import type { ExtractedData } from "@/lib/ai/extract"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ExtractionResultsProps {
  data: ExtractedData
}

function TagList({ items, icon: Icon, title, variant }: {
  items: string[]
  icon: React.ElementType
  title: string
  variant?: "positive" | "negative"
}) {
  if (items.length === 0) return null

  const colors = variant === "positive"
    ? "bg-green-50 text-green-700 border-green-200"
    : variant === "negative"
    ? "bg-red-50 text-red-700 border-red-200"
    : "bg-secondary text-secondary-foreground border-border"

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span
            key={i}
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors}`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null }) {
  if (!value) return null

  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <span className="text-muted-foreground">{label}: </span>
        <span>{value}</span>
      </div>
    </div>
  )
}

export function ExtractionResults({ data }: ExtractionResultsProps) {
  const positiveSignals = data.clientSignals.filter((s) =>
    /professional|clear|responsive|organized|detailed|reasonable|flexible|trust|great|good|positive/i.test(s)
  )
  const negativeSignals = data.clientSignals.filter((s) =>
    !/professional|clear|responsive|organized|detailed|reasonable|flexible|trust|great|good|positive/i.test(s)
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-green-600" />
        <h3 className="font-semibold">Extraction Complete</h3>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Goals</CardTitle>
          </CardHeader>
          <CardContent>
            {data.goals.length > 0 ? (
              <ul className="space-y-1">
                {data.goals.map((goal, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>{goal}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Not specified</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Deliverables</CardTitle>
          </CardHeader>
          <CardContent>
            {data.deliverables.length > 0 ? (
              <ul className="space-y-1">
                {data.deliverables.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Not specified</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-4">
        <InfoRow icon={Clock} label="Timeline" value={data.timeline} />
        <InfoRow icon={DollarSign} label="Budget" value={data.budget} />
        <InfoRow icon={BarChart3} label="Project type" value={data.projectType} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {positiveSignals.length > 0 && (
          <TagList
            items={positiveSignals}
            icon={Lightbulb}
            title="Positive Signals"
            variant="positive"
          />
        )}
        {negativeSignals.length > 0 && (
          <TagList
            items={negativeSignals}
            icon={AlertCircle}
            title="Risk Signals"
            variant="negative"
          />
        )}
      </div>

      {data.missingInformation.length > 0 && (
        <TagList
          items={data.missingInformation}
          icon={HelpCircle}
          title="Missing Information"
        />
      )}

      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Confidence:</span>
        <div className="flex h-2 w-32 overflow-hidden rounded-full bg-secondary">
          <div
            className="rounded-full transition-all bg-primary"
            style={{ width: `${Math.round(data.confidence * 100)}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {Math.round(data.confidence * 100)}%
        </span>
      </div>
    </div>
  )
}
