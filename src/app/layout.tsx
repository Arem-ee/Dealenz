import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "Dealenz — Know the Risk Before You Sign",
    template: "%s | Dealenz",
  },
  description:
    "Dealenz looks at the deal you're about to enter, whether that's a contract, a lease, or a partnership agreement, and tells you plainly where the risk actually is before you sign anything.",
  keywords: ["freelance", "contract audit", "risk assessment", "scope protection", "AI auditor"],
  authors: [{ name: "Dealenz" }],
  robots: { index: true, follow: true },
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Dealenz — Know the Risk Before You Sign",
    description:
      "Dealenz looks at the deal you're about to enter, whether that's a contract, a lease, or a partnership agreement, and tells you plainly where the risk actually is before you sign anything.",
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
