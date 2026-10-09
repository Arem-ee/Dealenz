"use client"

import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";

// Client boundary for next-intl: callbacks (onError, fallback) cannot cross
// from Server Components, so they live here. Missing keys log in dev and
// render the key path; English fallback arrives via the deep-merged
// messages from the request config, never here.
export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: string
  messages: AbstractIntlMessages
  children: React.ReactNode
}) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      onError={(err) => {
        if (process.env.NODE_ENV !== "production") console.error("[i18n]", err.message)
      }}
      getMessageFallback={({ namespace, key }) => `${namespace ? `${namespace}.` : ""}${key}`}
    >
      {children}
    </NextIntlClientProvider>
  )
}
