import type { Metadata } from "next"
import "./globals.css"
import { getLocale, getMessages } from "next-intl/server"
import { ToastProvider } from "@/components/ui/toast"
import { ThemeProvider, THEME_BOOTSTRAP_SCRIPT } from "@/components/theme-provider"
import { I18nProvider } from "@/components/i18n-provider"

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()
  const messages = await getMessages()
  return (
    <html lang={locale} className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <ThemeProvider>
          <ToastProvider>
            <I18nProvider locale={locale} messages={messages}>
              {children}
            </I18nProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
