"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export const SPECIALTIES = [
  "freelance",
  "lease",
  "purchase",
  "partnership",
  "employment",
  "service_agreement",
  "nda",
  "ip_licensing",
] as const

type Specialty = typeof SPECIALTIES[number]

export type { Specialty }

export default function LawyerApplicationForm() {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    full_name: "",
    bio: "",
    bar_license_number: "",
    bar_jurisdiction: "",
    specialties: [] as string[],
    years_experience: "",
    notable_cases: "",
    certifications: "",
  })

  const handleChange = (field: string, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (error) setError(null)
  }

  const handleSpecialtyToggle = (specialty: string) => {
    const current = formData.specialties
    const updated = current.includes(specialty)
      ? current.filter(s => s !== specialty)
      : [...current, specialty]
    setFormData(prev => ({ ...prev, specialties: updated }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const specialties = formData.specialties
    const yearsExperience = parseInt(formData.years_experience, 10) || 0
    const certifications = formData.certifications
      .split(",")
      .map(c => c.trim())
      .filter(Boolean)

    try {
      const res = await fetch("/api/lawyer-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: formData.full_name,
          bio: formData.bio,
          bar_license_number: formData.bar_license_number,
          bar_jurisdiction: formData.bar_jurisdiction,
          specialties,
          years_experience: yearsExperience,
          notable_cases: formData.notable_cases,
          certifications,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to submit application")
      }

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Application failed")
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-xl space-y-6 text-center">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Application Submitted</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your application has been received and is under review.
              We will notify you once it has been reviewed.
            </p>
          </div>
          <Link href="/dashboard">
            <Button className="w-full">Go to Dashboard</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F2F0ED] px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <div className="bg-white rounded-2xl border border-black/10 shadow-sm p-6 sm:p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-[#141110]">Apply to Join Dealenz</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Help freelancers and business owners understand their risks before they sign.
            </p>
          </div>

          {error && (
            <div className="mb-6 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="full_name" className="text-sm font-medium">Full Name</label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={e => handleChange("full_name", e.target.value)}
                  placeholder="Jane Doe"
                  required
                />
              </div>
              <div>
                <label htmlFor="bar_license_number" className="text-sm font-medium">Bar License Number</label>
                <Input
                  id="bar_license_number"
                  value={formData.bar_license_number}
                  onChange={e => handleChange("bar_license_number", e.target.value)}
                  placeholder="123456"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="bar_jurisdiction" className="text-sm font-medium">Bar Jurisdiction</label>
              <Input
                id="bar_jurisdiction"
                value={formData.bar_jurisdiction}
                onChange={e => handleChange("bar_jurisdiction", e.target.value)}
                placeholder="e.g. California, New York"
                required
              />
            </div>

            <div>
              <label htmlFor="years_experience" className="text-sm font-medium">Years of Experience</label>
              <Input
                id="years_experience"
                type="number"
                min="0"
                max="60"
                value={formData.years_experience}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange("years_experience", e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="bio" className="text-sm font-medium">Professional Bio</label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange("bio", e.target.value)}
                placeholder="Brief description of your practice areas and experience..."
                rows={4}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium">Specialties</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {SPECIALTIES.map(specialty => (
                  <button
                    key={specialty}
                    type="button"
                    onClick={() => handleSpecialtyToggle(specialty)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-sm font-medium transition-colors border",
                      formData.specialties.includes(specialty)
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
              <label htmlFor="notable_cases" className="text-sm font-medium">Notable Cases (Optional)</label>
              <Textarea
                id="notable_cases"
                value={formData.notable_cases}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange("notable_cases", e.target.value)}
                placeholder="Describe significant cases or outcomes (anonymized)..."
                rows={3}
              />
            </div>

            <div>
              <label htmlFor="certifications" className="text-sm font-medium">Certifications (Optional)</label>
              <Input
                id="certifications"
                value={formData.certifications}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange("certifications", e.target.value)}
                placeholder="Comma-separated (e.g. Certified Mediator, Arbitrator)"
              />
              <p className="mt-1 text-xs text-muted-foreground">Comma-separated list</p>
            </div>

            <div className="pt-4 border-t border-border/50">
              <Button
                type="submit"
                disabled={submitting}
                className="w-full"
                size="lg"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Application"
                )}
              </Button>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                By submitting, you agree to our terms. Your application will be reviewed
                and you will be notified of the decision.
              </p>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Already applied?{" "}
              <Link href="/lawyer-application/status" className="font-medium text-primary underline-offset-2 hover:no-underline">
                Check your status
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}