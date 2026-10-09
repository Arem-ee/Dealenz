import en from "./messages/en.json";

type Messages = typeof en;

declare global {
  // Typed translation keys (next-intl): t() autocompletes and errors on
  // unknown keys. fr/de catalogs must mirror this shape — enforced by
  // src/lib/i18n/messages.test.ts key-parity checks.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface IntlMessages extends Messages {}
}
