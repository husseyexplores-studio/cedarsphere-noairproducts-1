import {
  BlockStack,
  Card,
  EmptyState,
  Layout,
  Page,
  Text,
} from '@shopify/polaris'
import notFoundImage from './empty-state.svg'

export function NotFoundPage({
  withPageLayout = true,
  title = '404 Not found',
  message = 'Page not found. Check the URL and try again.',
  children,
}: {
  withPageLayout?: boolean
  title?: string
  message?: string
  children?: React.ReactNode
}) {
  const notFoundPageContent = (
    <BlockStack>
      <Card>
        <EmptyState heading={title} image={notFoundImage}>
          <Text as="p" variant="bodyMd">
            {message}
          </Text>
        </EmptyState>
      </Card>
    </BlockStack>
  )

  if (withPageLayout) {
    return (
      <Page>
        <Layout>
          <Layout.Section>{notFoundPageContent}</Layout.Section>

          {children ? <Layout.Section>{children}</Layout.Section> : null}
        </Layout>
      </Page>
    )
  }

  return notFoundPageContent
}
