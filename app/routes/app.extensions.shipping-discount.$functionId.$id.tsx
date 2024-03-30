import { useEffect } from 'react'
import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from '@remix-run/cloudflare'
import { useAppBridge } from '@shopify/app-bridge-react'
import { Redirect } from '@shopify/app-bridge/actions'
import {
  useActionData,
  useLoaderData,
  useNavigation,
  useSubmit,
} from '@remix-run/react'
import {
  DiscountMethod,
  onBreadcrumbAction,
} from '@shopify/discount-app-components'
import { NotFoundPage } from '~/components/NotFoundPage'
import { type ErrorBannerProps } from '~/components/ErrorBanner'
import { tryCatch } from '~/utils/index'
import { ShippingDiscountPageComponent } from '~/components/pages/ShippingDiscount'
import { DefaultErrorBoundary } from '~/components/DefaultErrorBoundary'
import { validateShippingDiscountConfig } from '~/utils/route-validators'
import type { ShippingDiscount } from 'types'

// This is a server-side action that is invoked when the form is submitted.
// It makes an admin GraphQL request to update a discount.
export const action = async ({
  request,
  params,
  context,
}: ActionFunctionArgs) => {
  const shopify = context.shopify

  const { id, functionId } = params
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
    _metafield_id,
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

  if (!_metafield_id) {
    return json({
      errors: [{ message: 'Missing metafield id' }],
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
        mutation UpdateCodeDiscount(
          $id: ID!
          $discount: DiscountCodeAppInput!
        ) {
          discountUpdate: discountCodeAppUpdate(
            id: $id
            codeAppDiscount: $discount
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
          id: `gid://shopify/DiscountCodeApp/${id}`,
          discount: {
            ...baseCodeDiscount,
            metafields: [
              {
                id: _metafield_id,
                value: JSON.stringify(conf),
              },
            ],
          },
        },
      },
    )

    const responseJson = (await response.json()) as any
    const errors = responseJson.data.discountUpdate?.userErrors as any
    return json({ form_errors: errors } as ErrorBannerProps)
  } else {
    const response = await admin.graphql(
      /* GraphQL */ `
        mutation UpdateAutomaticDiscount(
          $id: ID!
          $discount: DiscountAutomaticAppInput!
        ) {
          discountUpdate: discountAutomaticAppUpdate(
            id: $id
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
          id: `gid://shopify/DiscountAutomaticApp/${id}`,
          discount: {
            ...baseDiscount,
            metafields: [
              {
                id: _metafield_id,
                value: JSON.stringify(conf),
              },
            ],
          },
        },
      },
    )

    const responseJson = (await response.json()) as any
    const errors = responseJson.data.discountUpdate?.userErrors as any
    return json({ form_errors: errors } as ErrorBannerProps)
  }
}

// This is invoked on the server to load the discount data with an admin GraphQL request. The result
// is used by the component below to render the form.
export const loader = async ({
  params,
  request,
  context,
}: LoaderFunctionArgs) => {
  const shopify = context.shopify
  const { id } = params
  const { admin } = await shopify.authenticate.admin(request)

  const response = await admin.graphql(
    /* GraphQL */ `
      query GetDiscount($id: ID!) {
        discountNode(id: $id) {
          id
          configurationField: metafield(
            namespace: "$app:shipping-discount"
            key: "function-configuration"
          ) {
            id
            value
          }
          discount {
            __typename
            ... on DiscountAutomaticApp {
              updatedAt
              title
              discountClass
              combinesWith {
                orderDiscounts
                productDiscounts
                shippingDiscounts
              }
              startsAt
              endsAt
            }
            ... on DiscountCodeApp {
              updatedAt
              title
              discountClass
              combinesWith {
                orderDiscounts
                productDiscounts
                shippingDiscounts
              }
              startsAt
              endsAt
              usageLimit
              appliesOncePerCustomer
              codes(first: 1) {
                nodes {
                  code
                }
              }
            }
          }
        }
      }
    `,
    {
      variables: {
        id: `gid://shopify/DiscountNode/${id}`,
      },
    },
  )

  const responseJson = (await response.json()) as any

  if (!responseJson.data?.discountNode?.discount) {
    // throw new Response(null, {
    //   status: 404,
    //   statusText: 'Not Found',
    // })

    return json({
      discount: null,
      errors: null as ErrorBannerProps['errors'] | null | undefined,
    })
  }

  const method =
    responseJson.data.discountNode.discount.__typename === 'DiscountCodeApp'
      ? DiscountMethod.Code
      : DiscountMethod.Automatic

  const gid = responseJson.data.discountNode.id! as string

  const {
    title,
    codes,
    combinesWith,
    usageLimit,
    appliesOncePerCustomer,
    startsAt,
    endsAt,
  } = responseJson.data.discountNode.discount

  const configuration = tryCatch(
    () =>
      validateShippingDiscountConfig(
        JSON.parse(responseJson.data.discountNode.configurationField.value),
      ),
    null,
  )
  const validatedConfig = configuration ? configuration[1] : null
  if (!validatedConfig) {
    return json({
      discount: null,
      errors: [
        {
          message:
            'Invalid discount config. Delete this discount and create a new one',
        },
      ] as ErrorBannerProps['errors'] | null | undefined,
    })
  }

  const _metafield_id = responseJson.data.discountNode.configurationField
    ?.id as string | null
  const updatedAt = responseJson.data.discountNode.updatedAt as string

  const discount = {
    _metafield_id,
    id: gid,
    updatedAt,

    title,
    method,
    code: codes?.nodes[0]?.code ?? '',
    combinesWith,
    usageLimit: usageLimit ?? null,
    appliesOncePerCustomer: appliesOncePerCustomer ?? false,
    startsAt,
    endsAt,
    configuration: validatedConfig,
  } satisfies ShippingDiscount

  return json({
    discount,
    errors: null as ErrorBannerProps['errors'] | null | undefined,
  })
}

// This is the React component for the page.
export default function ShippingDiscountEdit() {
  const submitForm = useSubmit()
  const navigation = useNavigation()
  const app = useAppBridge()

  const actionData = useActionData<typeof action>()
  const loaderData = useLoaderData<typeof loader>()
  const discount = loaderData.discount as any

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
        shopify.toast.show('Discount updated successfully')
      }
    }
  }, [actionData])

  if (!discount) {
    return <NotFoundPage />
  }

  return (
    <ShippingDiscountPageComponent
      key={loaderData.discount?.updatedAt}
      discount={loaderData.discount as any}
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
