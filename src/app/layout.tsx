import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "Dealenz — AI Auditor for Freelancers",
    template: "%s | Dealenz",
  },
  description: "Identify risks, protect scope, and generate safer deal packages. AI-powered audit tool for freelancers.",
  keywords: ["freelance", "contract audit", "risk assessment", "scope protection", "AI auditor"],
  authors: [{ name: "Dealenz" }],
  robots: { index: true, follow: true },
  openGraph: {
    title: "Dealenz — AI Auditor for Freelancers",
    description: "Identify risks, protect scope, and generate safer deal packages for freelancers.",
    type: "website",
    siteName: "Dealenz",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  )
}
