"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Clock, CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { SPECIALTIES } from "../application-form"

interface PendingApplication {
  full_name: string
  bio: string
  bar_license_number: string
  bar_jurisdiction: string
  specialties: string[]
  years_experience: number
  notable_cases: string
  certifications: string[]
}

interface ApplicationStatus {
  success: boolean
  status?: "pending" | "verified" | "rejected" | "suspended" | "not_applied"
  verification_status?: "pending" | "verified" | "rejected" | "suspended"
  created_at?: string
  verified_at?: string
  application?: PendingApplication
  error?: string
}

export default function LawyerApplicationStatus() {
  const [status, setStatus] = useState<ApplicationStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [resubmitting, setResubmitting] = useState(false)
  const [resubmitError, setResubmitError] = useState<string | null>(null)

  async function fetchStatus() {
    try {
      const res = await fetch("/api/lawyer-application/status")
      const data = await res.json()
      setStatus(data)
    } catch {
      setStatus({ success: false, error: "Failed to fetch status" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial status fetch on mount
    void fetchStatus()
  }, [])

  async function handleResubmit() {
    setResubmitting(true)
    setResubmitError(null)
    try {
      const res = await fetch("/api/lawyer-application", { method: "PUT", headers: { "Content-Type": "application/json" }, body: "{}" })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setResubmitError(typeof data?.error === "string" ? data.error : "Couldn't resubmit. Please try again.")
        return
      }
      await fetchStatus()
    } catch {
      setResubmitError("Couldn't resubmit. Please try again.")
    } finally {
      setResubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center" role="status">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" aria-hidden />
          <p className="mt-3 text-sm text-muted-foreground">Loading application status…</p>
        </div>
      </div>
    )
  }

  if (!status?.success) {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto max-w-xl text-center">
          <h1 className="text-2xl font-semibold">Unable to Load Status</h1>
          <p className="mt-2 text-sm text-muted-foreground">{status?.error ?? "Unknown error"}</p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <Button onClick={() => { setLoading(true); void fetchStatus() }}>Retry</Button>
            <Link href="/dashboard">
              <Button variant="outline">Back to Dashboard</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const { status: appStatus } = status

  const statusConfig = {
    pending: {
      icon: Clock,
      color: "text-warning-foreground bg-warning/10",
      title: "Application Under Review",
      description: "Your application has been received and is being reviewed by our team. This typically takes 3-5 business days.",
    },
    verified: {
      icon: CheckCircle2,
      color: "text-success bg-success/10",
      title: "Application Approved",
      description: "You are now a verified Dealenz lawyer. You can start receiving consultation requests.",
    },
    rejected: {
      icon: XCircle,
      color: "text-destructive bg-destructive/10",
      title: "Application Not Approved",
      description: "Your application was not approved at this time. You can correct your details and send it back for review below.",
    },
    suspended: {
      icon: AlertCircle,
      color: "text-warning-foreground bg-warning/10",
      title: "Verification Paused",
      description: "Your verification is paused while our team re-checks your professional standing. You will be notified of the outcome; no action is needed unless we contact you.",
    },
    not_applied: {
      icon: AlertCircle,
      color: "text-muted-foreground bg-muted",
      title: "No Application Found",
      description: "You haven't submitted a lawyer application yet.",
    },
  }

  const statusKey = (appStatus ?? "not_applied") as keyof typeof statusConfig
  // Unknown future states fall back to a neutral card instead of crashing.
  const config = statusConfig[statusKey] ?? {    icon: AlertCircle,
    color: "text-muted-foreground bg-muted",
    title: "Application Status",
    description: "Your application state is being reviewed. Check back soon.",
  }
  const Icon = config?.icon ?? AlertCircle

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          Back to Home
        </Link>

        <div className="bg-white rounded-2xl border border-black/10 shadow-sm p-6 sm:p-8 text-center">
          <div className="flex justify-center mb-6">
            <div className={cn("flex h-16 w-16 items-center justify-center rounded-full", config.color)}>
              <Icon className="h-8 w-8" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{config.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{config.description}</p>

          {status.created_at && (
            <div className="mt-6 p-4 rounded-xl bg-muted/50 text-left">
              <p className="text-sm font-medium">Application submitted</p>
              <p className="text-sm text-muted-foreground">{new Date(status.created_at).toLocaleDateString()}</p>
            </div>
          )}

          {status.verified_at && (
            <div className="mt-4 p-4 rounded-xl bg-success/10 text-left">
              <p className="text-sm font-medium text-success">Verified on</p>
              <p className="text-sm text-success">{new Date(status.verified_at).toLocaleDateString()}</p>
            </div>
          )}

          <div className="mt-8 space-y-3">
            {status.verification_status === "verified" || appStatus === "verified" ? (
              <Link href="/lawyer">
                <Button className="w-full">Go to Lawyer workspace</Button>
              </Link>
            ) : (
              <Link href="/dashboard">
                <Button variant="outline" className="w-full">Back to Dashboard</Button>
              </Link>
            )}
            {appStatus === "rejected" && (
              <div>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={resubmitting}
                  onClick={() => void handleResubmit()}
                >
                  {resubmitting ? "Sending back for review…" : "Correct and send back for review"}
                </Button>
                {resubmitError && (
                  <p role="alert" className="mt-2 text-sm text-destructive">{resubmitError}</p>
                )}
              </div>
            )}
            {(appStatus === "not_applied" || !appStatus) && (
              <Link href="/lawyer-application" className="block text-sm text-primary underline-offset-2 hover:no-underline">
                Submit a new application
              </Link>
            )}
          </div>
        </div>

        {appStatus === "pending" && status.application && (
          <PendingEditForm initial={status.application} onSaved={() => void fetchStatus()} />
        )}
        {appStatus === "rejected" && status.application && (
          <PendingEditForm initial={status.application} onSaved={() => void fetchStatus()} rejected />
        )}
      </div>
    </div>
  )
}

function PendingEditForm({ initial, onSaved, rejected }: { initial: PendingApplication; onSaved: () => void; rejected?: boolean }) {
  const [fullName, setFullName] = useState(initial.full_name)
  const [barLicense, setBarLicense] = useState(initial.bar_license_number)
  const [barJurisdiction, setBarJurisdiction] = useState(initial.bar_jurisdiction)
  const [bio, setBio] = useState(initial.bio)
  const [specialties, setSpecialties] = useState<string[]>(initial.specialties)
  const [yearsExperience, setYearsExperience] = useState(String(initial.years_experience))
  const [notableCases, setNotableCases] = useState(initial.notable_cases)
  const [certifications, setCertifications] = useState(initial.certifications.join(", "))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  function toggleSpecialty(specialty: string) {
    setSaved(false)
    setSpecialties((current) =>
      current.includes(specialty) ? current.filter((s) => s !== specialty) : [...current, specialty]
    )
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    setSaved(false)
    try {
      const res = await fetch("/api/lawyer-application", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(rejected
            ? {
                full_name: fullName,
                bar_license_number: barLicense,
                bar_jurisdiction: barJurisdiction,
              }
            : {}),
          bio,
          specialties,
          years_experience: parseInt(yearsExperience, 10) || 0,
          notable_cases: notableCases,
          certifications: certifications.split(",").map((c) => c.trim()).filter(Boolean),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setSaveError(typeof data?.error === "string" ? data.error : "Couldn't save. Please try again.")
        return
      }
      setSaved(true)
      onSaved()
    } catch {
      setSaveError("Couldn't save. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-6 bg-white rounded-2xl border border-black/10 shadow-sm p-6 sm:p-8 text-left">
      <h2 className="text-lg font-semibold tracking-tight">Update your application</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {rejected
          ? "Correct your details below, then send the application back for review. Name, bar license number, and jurisdiction can be corrected on a resubmission."
          : "Your application is still under review. You can update these details any time before a decision. Name, bar license number, and jurisdiction can only be changed by an administrator."}
      </p>
      <form onSubmit={handleSave} className="mt-6 space-y-5">
        {rejected ? (
          <>
            <div>
              <label htmlFor="edit-name" className="text-sm font-medium">Full name</label>
              <Input id="edit-name" value={fullName} onChange={(e) => { setFullName(e.target.value); setSaved(false) }} required className="mt-1" />
            </div>
            <div>
              <label htmlFor="edit-bar" className="text-sm font-medium">Bar license number</label>
              <Input id="edit-bar" value={barLicense} onChange={(e) => { setBarLicense(e.target.value); setSaved(false) }} required className="mt-1" />
            </div>
            <div>
              <label htmlFor="edit-jurisdiction" className="text-sm font-medium">Bar jurisdiction</label>
              <Input id="edit-jurisdiction" value={barJurisdiction} onChange={(e) => { setBarJurisdiction(e.target.value); setSaved(false) }} required className="mt-1" />
            </div>
          </>
        ) : null}
        <div>
          <label htmlFor="edit-bio" className="text-sm font-medium">Professional Bio</label>
          <Textarea id="edit-bio" value={bio} onChange={(e) => { setBio(e.target.value); setSaved(false) }} rows={4} required className="mt-1" />
        </div>
        <div>
          <span className="text-sm font-medium">Specialties</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {SPECIALTIES.map((specialty) => (
              <button
                key={specialty}
                type="button"
                onClick={() => toggleSpecialty(specialty)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium transition-colors border",
                  specialties.includes(specialty)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted border-border hover:bg-muted/50"
                )}
              >
                {specialty.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="edit-years" className="text-sm font-medium">Years of Experience</label>
          <Input id="edit-years" type="number" min="0" max="60" value={yearsExperience} onChange={(e) => { setYearsExperience(e.target.value); setSaved(false) }} required className="mt-1" />
        </div>
        <div>
          <label htmlFor="edit-cases" className="text-sm font-medium">Notable Cases (Optional)</label>
          <Textarea id="edit-cases" value={notableCases} onChange={(e) => { setNotableCases(e.target.value); setSaved(false) }} rows={3} className="mt-1" />
        </div>
        <div>
          <label htmlFor="edit-certs" className="text-sm font-medium">Certifications (Optional)</label>
          <Input id="edit-certs" value={certifications} onChange={(e) => { setCertifications(e.target.value); setSaved(false) }} placeholder="Comma-separated" className="mt-1" />
        </div>
        {saveError && (
          <p role="alert" className="text-sm text-destructive">{saveError}</p>
        )}
        {saved && (
          <p role="status" className="text-sm text-success">Saved. Your updated details are with your pending application.</p>
        )}
        <Button type="submit" disabled={saving} className="w-full">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </form>
    </div>
  )
}