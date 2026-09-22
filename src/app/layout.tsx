import type { Metadata } from "next"
import "./globals.css"
import { ToastProvider } from "@/components/ui/toast"
import { ThemeProvider, THEME_BOOTSTRAP_SCRIPT } from "@/components/theme-provider"

export const metadata: Metadata = {
  title: {
    default: "Dealenz — AI Contract Review Tool: Know the Risk Before You Sign",
    template: "%s | Dealenz",
  },
  description:
    "They sent the contract. Dealenz reads it, tells you where the risk is, gives you the words to push back, and guards what was agreed.",
  keywords: ["AI contract review tool", "freelance", "contract audit", "risk assessment", "scope protection", "AI auditor"],
  authors: [{ name: "Dealenz" }],
  robots: { index: true, follow: true },
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Dealenz — AI Contract Review Tool: Know the Risk Before You Sign",
    description:
      "They sent the contract. Dealenz reads it, tells you where the risk is, gives you the words to push back, and guards what was agreed.",
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
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
