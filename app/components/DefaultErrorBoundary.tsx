import {
  isRouteErrorResponse,
  useLocation,
  useNavigate,
  useRouteError,
} from 'react-router-dom'
import { Banner, Layout, Page, Text } from '@shopify/polaris'

/** @type {Record<string, { title: string, desc: string }>} */
const ERR_STATUS_CODE_INFO = {
  400: {
    title: 'Bad Request',
    desc: 'The request was invalid or cannot be fulfilled.',
  },
  404: {
    title: 'Not Found',
    desc: 'The resource you are looking for could not be found.',
  },
  403: {
    title: 'Forbidden',
    desc: 'You do not have permission to access the resource.',
  },
  429: {
    title: 'Too Many Requests',
    desc: 'The rate limit has been exceeded.',
  },
  500: { title: 'Internal Server Error', desc: 'Something went wrong' },
  503: {
    title: 'Service Unavailable',
    desc: 'The service is currently unavailable',
  },
}

export function DefaultErrorBoundary() {
  const navigate = useNavigate()
  const location = useLocation()

  let title = 'Oops! Something went wrong.'
  let displayMsg = 'An unexpected error occured.'

  /** @type {unknown} */
  const error = useRouteError()

  console.error('Error in default error boundary.', error)

  /** @type {string | null} */
  let errorMsg: string | null = error instanceof Error ? error.message : null

  /** @type {string | undefined} */
  let json

  if (isRouteErrorResponse(error)) {
    json = JSON.stringify(error, null, 2)

    const statusInfo =
      ERR_STATUS_CODE_INFO[error.status as keyof typeof ERR_STATUS_CODE_INFO]
    if (statusInfo) {
      title = statusInfo.title
      displayMsg = statusInfo.desc
    } else {
      title += ` (${error.status})`
      errorMsg = null
    }
  }

  return (
    <Page narrowWidth>
      <Layout>
        <Layout.Section>
          <div style={{ marginTop: '100px' }}>
            <Banner
              action={{
                content: 'Back to home',
                onAction() {
                  navigate(`/`, { replace: true })
                },
              }}
              title={title}
              tone="critical"
            >
              <Text as="p" variant="bodyMd">
                {displayMsg}
              </Text>

              {errorMsg && typeof errorMsg === 'string' && (
                <Text as="p" variant="bodySm" tone="critical">
                  {errorMsg}
                </Text>
              )}

              {json && <pre>{json}</pre>}
            </Banner>
          </div>
        </Layout.Section>
      </Layout>
    </Page>
  )
}
