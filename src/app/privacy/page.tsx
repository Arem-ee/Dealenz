import Link from "next/link"

export const metadata = {
  title: "Privacy",
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          Back to Dealenz
        </Link>
        <h1 className="mt-8 text-3xl font-semibold">Privacy</h1>
        <div className="mt-6 space-y-5 text-sm leading-7 text-muted-foreground">
          <p>
            Dealenz stores the project details, uploaded files, generated documents, and activity records you create while using the product. Storage and database hosting are provided by Supabase; deal content you submit for analysis is also sent to our AI processing provider to produce that analysis, and to email infrastructure when you choose to send documents or alerts.
          </p>
          <p>
            Your account controls access to your audits. Project data should only be uploaded when you have permission to process it.
          </p>
          <p>
            Dealenz uses submitted project information to provide audit analysis, document generation, sharing, and signing features inside your account.
          </p>
          <p>
            You can avoid including sensitive information that is not required for a deal audit. Do not upload regulated, confidential, or third-party material unless you are authorized to do so.
          </p>
          <p>
            Sign-in relies on session cookies. Dealenz does not use advertising trackers.
          </p>
          <p>
            You can delete your account and everything in it at any time from Settings → Delete account. For any other privacy question, including what is held about you, write to{" "}
            <a href="mailto:support@dealenz.com" className="font-medium text-foreground hover:underline">
              support@dealenz.com
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  )
}
