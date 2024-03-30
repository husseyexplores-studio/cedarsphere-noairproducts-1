import { useEffect, useMemo } from 'react'
import {
  useActionData,
  useLoaderData,
  useNavigation,
  useSubmit,
} from '@remix-run/react'
import {
  json,
  type ActionFunctionArgs,
  // type LoaderFunctionArgs,
} from '@remix-run/cloudflare'
import { useAppBridge } from '@shopify/app-bridge-react'
import { Redirect } from '@shopify/app-bridge/actions'
import {
  DiscountMethod,
  onBreadcrumbAction,
} from '@shopify/discount-app-components'

import { DefaultErrorBoundary } from '~/components/DefaultErrorBoundary'
import { type ErrorBannerProps } from '~/components/ErrorBanner'
import { tryCatch } from '~/utils/index'
import { ShippingDiscountPageComponent } from '~/components/pages/ShippingDiscount'
import { validateShippingDiscountConfig } from '~/utils/route-validators'

// This is a server-side action that is invoked when the form is submitted.
// It makes an admin GraphQL request to create a discount.
export const action = async ({
  params,
  request,
  context,
}: ActionFunctionArgs) => {
  const shopify = context.shopify
  const { functionId } = params
  const { admin } = await shopify.authenticate.admin(request)

  const formData = await request.formData()

  const formDataDiscount = formData.get('discount') as any
  let formDiscount = tryCatch(() => JSON.parse(formDataDiscount), null)
  if (!formDiscount || typeof formDiscount !== 'object') {
    return json({
      errors: [{ message: 'Missing discount' }],
    } as ErrorBannerProps)
  }

  if (!formDiscount.configuration) formDiscount.configuration = {}

  const {
    title,
    method,
    code,
    combinesWith,
    usageLimit,
    appliesOncePerCustomer,
    startsAt,
    endsAt,
    configuration,
  } = formDiscount

  const [confErr, conf] = validateShippingDiscountConfig(
    configuration,
    'configuration',
  )
  if (confErr) {
    return json({
      form_errors: confErr.errors,
    } as ErrorBannerProps)
  }

  if (!conf) {
    return json({
      errors: [{ message: 'Invalid discount configuration' }],
    } as ErrorBannerProps)
  }

  const baseDiscount = {
    functionId,
    title,
    combinesWith,
    startsAt: new Date(startsAt),
    endsAt: endsAt && new Date(endsAt),
  }
  conf.title = title?.trim() || ''

  try {
    if (method === DiscountMethod.Code) {
      const baseCodeDiscount = {
        ...baseDiscount,
        title: code,
        code,
        usageLimit,
        appliesOncePerCustomer,
      }

      const response = await admin.graphql(
        /* GraphQL */ `
          mutation CreateCodeDiscount($discount: DiscountCodeAppInput!) {
            discountCreate: discountCodeAppCreate(codeAppDiscount: $discount) {
              userErrors {
                code
                message
                field
              }
            }
          }
        `,
        {
          variables: {
            discount: {
              ...baseCodeDiscount,
              metafields: [
                {
                  namespace: '$app:shipping-discount',
                  key: 'function-configuration',
                  type: 'json',
                  value: JSON.stringify(conf),
                },
              ],
            },
          },
        },
      )

      const responseJson = (await response.json()) as any
      const errors = responseJson.data.discountCreate?.userErrors as any
      return json({ form_errors: errors } as ErrorBannerProps)
    } else {
      const response = await admin.graphql(
        /* GraphQL */ `
          mutation CreateAutomaticDiscount(
            $discount: DiscountAutomaticAppInput!
          ) {
            discountCreate: discountAutomaticAppCreate(
              automaticAppDiscount: $discount
            ) {
              userErrors {
                code
                message
                field
              }
            }
          }
        `,
        {
          variables: {
            discount: {
              ...baseDiscount,
              metafields: [
                {
                  namespace: '$app:shipping-discount',
                  key: 'function-configuration',
                  type: 'json',
                  value: JSON.stringify(conf),
                },
              ],
            },
          },
        },
      )

      const responseJson = (await response.json()) as any
      const errors = responseJson.data.discountCreate?.userErrors as any

      return json({ form_errors: errors } as ErrorBannerProps)
    }
  } catch (error) {
    return json({
      form_errors: [
        {
          message:
            error instanceof Error
              ? error.message
              : 'Unexpected error. Please try again.',
          field: undefined,
        },
      ],
    } as ErrorBannerProps)
  }
}

// This is the React component for the page.
export default function ShippingDiscountCreate() {
  const submitForm = useSubmit()
  const navigation = useNavigation()
  const app = useAppBridge()

  const actionData = useActionData<typeof action>()
  const isLoading = navigation.state === 'submitting'
  const redirect = Redirect.create(app)

  useEffect(() => {
    if (actionData) {
      let hasErrors = false
      if (
        (actionData.form_errors && actionData.form_errors.length > 0) ||
        (actionData.errors && actionData.errors.length > 0)
      ) {
        hasErrors = true
      }

      if (!hasErrors) {
        redirect.dispatch(Redirect.Action.ADMIN_SECTION, {
          name: Redirect.ResourceType.Discount,
        })
      }
    }
  }, [actionData, redirect])

  return (
    <ShippingDiscountPageComponent
      onSubmit={async (discount) => {
        console.log('discount', discount)
        submitForm({ discount: JSON.stringify(discount) }, { method: 'post' })
      }}
      onBack={() => {
        onBreadcrumbAction(redirect, true)
      }}
      form_errors={actionData?.form_errors}
      errors={actionData?.errors}
      loading={isLoading}
    />
  )
}

export const ErrorBoundry = DefaultErrorBoundary
