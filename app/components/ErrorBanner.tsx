import { Banner, Layout } from '@shopify/polaris'

type UserError = {
  code?: string
  message: string
  field?: Array<string>
}
type MaybeUserError = undefined | null | Array<UserError>

export type ErrorBannerProps = {
  form_errors?: MaybeUserError
  errors?: Array<{ message: string }>
}

export function ErrorBanner({ errors, form_errors }: ErrorBannerProps) {
  return (form_errors && form_errors.length > 0) ||
    (errors && errors.length > 0) ? (
    <Layout.Section>
      {errors && errors.length > 0 && (
        <Banner tone="critical">
          <p>There were some issues with your submission:</p>
          <ul>
            {errors.map(({ message }, index) => {
              return <li key={`${message}${index}`}>{message}</li>
            })}
          </ul>
        </Banner>
      )}

      {form_errors && form_errors.length > 0 && (
        <Banner tone="critical">
          <p>There were some issues with your form submission:</p>
          <ul>
            {form_errors.map(({ message, field }, index) => {
              return (
                <li key={`${message}${index}`}>
                  {field ? field.join('.') : ''} {message}
                </li>
              )
            })}
          </ul>
        </Banner>
      )}
    </Layout.Section>
  ) : null
}
