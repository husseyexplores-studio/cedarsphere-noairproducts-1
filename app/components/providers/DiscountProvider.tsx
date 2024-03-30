import { AppProvider } from '@shopify/discount-app-components'
import '@shopify/discount-app-components/build/esm/styles.css'

export function DiscountProvider({
  children,
  ianaTimezone = 'America/Toronto',
}: {
  children: React.ReactNode
  ianaTimezone?: string
}) {
  return (
    <AppProvider locale="en" ianaTimezone={ianaTimezone}>
      {children}
    </AppProvider>
  )
}
