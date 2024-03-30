import { useEffect } from 'react'
import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from '@remix-run/cloudflare'
import { useForm, useField, submitFail } from '@shopify/react-form'
import { useAppBridge } from '@shopify/app-bridge-react'
import { Redirect } from '@shopify/app-bridge/actions'
import { CurrencyCode } from '@shopify/react-i18n'
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  useSubmit,
} from '@remix-run/react'
import {
  ActiveDatesCard,
  CombinationCard,
  DiscountClass,
  DiscountMethod,
  MethodCard,
  DiscountStatus,
  RequirementType,
  SummaryCard,
  UsageLimitsCard,
  onBreadcrumbAction,
} from '@shopify/discount-app-components'
import {
  Card,
  Text,
  Layout,
  Page,
  PageActions,
  TextField,
  BlockStack,
} from '@shopify/polaris'
import { NotFoundPage } from '~/components/NotFoundPage'
import { ErrorBanner, type ErrorBannerProps } from '~/components/ErrorBanner'
import {
  prettyStringifyb2bThresholdJson,
  tagsToList,
  tryCatch,
  validatedb2bDiscountThresholds,
  type B2BDiscountThresholds,
} from '~/utils/index'
import { Code } from '~/components/Code'

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

  let thresholds = validatedb2bDiscountThresholds(configuration.thresholds)
  if (!thresholds) {
    return json({
      form_errors: [
        {
          field: ['configuration', 'thresholds'],
          message: 'Invalid configuration',
        },
      ],
    } as ErrorBannerProps)
  }
  configuration.thresholds = thresholds
  configuration.ensureAnyCustomerTags = tagsToList(
    configuration.ensureAnyCustomerTags,
  )
  configuration.excludedProductTags = tagsToList(
    configuration.excludedProductTags,
  )

  const baseDiscount = {
    functionId,
    title,
    combinesWith,
    startsAt: new Date(startsAt),
    endsAt: endsAt && new Date(endsAt),
  }
  configuration.title = title?.trim() || ''

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
                id: configuration.metafieldId,
                value: JSON.stringify({
                  title: configuration.title,
                  thresholds: configuration.thresholds,
                  ensureAnyCustomerTags: configuration.ensureAnyCustomerTags,
                  excludedProductTags: configuration.excludedProductTags,
                }),
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
                id: configuration.metafieldId,
                value: JSON.stringify({
                  title: configuration.title,
                  thresholds: configuration.thresholds,
                  ensureAnyCustomerTags: configuration.ensureAnyCustomerTags,
                  excludedProductTags: configuration.excludedProductTags,
                }),
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
            namespace: "$app:b2b-order-discount"
            key: "function-configuration"
          ) {
            id
            value
          }
          discount {
            __typename
            ... on DiscountAutomaticApp {
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
  const {
    title,
    codes,
    combinesWith,
    usageLimit,
    appliesOncePerCustomer,
    startsAt,
    endsAt,
  } = responseJson.data.discountNode.discount

  const configuration: Record<string, any> = tryCatch(
    () => JSON.parse(responseJson.data.discountNode.configurationField.value),
    {},
  )
  const thresholds = configuration.thresholds as B2BDiscountThresholds

  if (!thresholds) {
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

  let ensureAnyCustomerTags = tagsToList(configuration.ensureAnyCustomerTags)
  let excludedProductTags = tagsToList(configuration.excludedProductTags)

  const discount = {
    title,
    method,
    code: codes?.nodes[0]?.code ?? '',
    combinesWith,
    usageLimit: usageLimit ?? null,
    appliesOncePerCustomer: appliesOncePerCustomer ?? false,
    startsAt,
    endsAt,
    configuration: {
      ...configuration,
      thresholds,
      ensureAnyCustomerTags,
      excludedProductTags,
      metafieldId: responseJson.data.discountNode.configurationField.id,
    },
  }

  return json({
    discount,
    errors: null as ErrorBannerProps['errors'] | null | undefined,
  })
}

// This is the React component for the page.
export default function DiscountEditPage() {
  const actionData = useActionData<typeof action>()
  const loaderData = useLoaderData<typeof loader>()

  if (loaderData.errors && loaderData.errors.length > 0) {
    return <ErrorBanner errors={loaderData.errors} />
  }

  if (!loaderData.discount) {
    return <NotFoundPage />
  }

  return <DiscountEdit actionData={actionData} loaderData={loaderData} />
}

function DiscountEdit({
  actionData,
  loaderData,
}: {
  actionData: ReturnType<typeof useActionData<typeof action>>
  loaderData: ReturnType<typeof useLoaderData<typeof loader>>
}) {
  const discount = loaderData.discount!

  const submitForm = useSubmit()
  const navigation = useNavigation()
  const app = useAppBridge()

  const isLoading = navigation.state === 'submitting'
  const currencyCode = CurrencyCode.Usd

  const serverErrorsForm = actionData?.form_errors || []
  const serverErrors = actionData?.errors || []

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
        // redirect.dispatch(Redirect.Action.ADMIN_SECTION, {
        //   name: Redirect.ResourceType.Discount,
        // })
        shopify.toast.show('Discount updated successfully')
        // navigate('.', { replace: true })
      }
    }
  }, [actionData])

  const { metafieldId } = discount.configuration
  const {
    fields: {
      discountTitle,
      discountCode,
      discountMethod,
      combinesWith,
      requirementType,
      requirementSubtotal,
      requirementQuantity,
      usageLimit,
      appliesOncePerCustomer,
      startDate,
      endDate,
      configuration,
    },
    submit,
    reset: resetForm,
  } = useForm({
    fields: {
      discountTitle: useField(discount.title),
      discountMethod: useField(discount.method),
      discountCode: useField(discount.code),
      combinesWith: useField(discount.combinesWith),
      requirementType: useField(RequirementType.None),
      requirementSubtotal: useField('0'),
      requirementQuantity: useField('0'),
      usageLimit: useField(discount.usageLimit),
      appliesOncePerCustomer: useField(discount.appliesOncePerCustomer),
      startDate: useField(discount.startsAt),
      endDate: useField(discount.endsAt),
      configuration: {
        thresholds: useField(
          prettyStringifyb2bThresholdJson(discount.configuration.thresholds),
        ),
        ensureAnyCustomerTags: useField(
          discount.configuration.ensureAnyCustomerTags.join(', '),
        ),
        excludedProductTags: useField(
          discount.configuration.excludedProductTags.join(', '),
        ),
      },
    },
    onSubmit: async (form) => {
      const validatedThresholds = validatedb2bDiscountThresholds(
        form.configuration.thresholds,
      )

      if (!validatedThresholds) {
        return submitFail([
          {
            message: 'Invalid discount thresholds',
            field: ['configuration', 'thresholds'],
          },
        ])
      }

      const discount = {
        title: form.discountTitle,
        method: form.discountMethod,
        code: form.discountCode,
        combinesWith: form.combinesWith,
        usageLimit: form.usageLimit == null ? null : parseInt(form.usageLimit),
        appliesOncePerCustomer: form.appliesOncePerCustomer,
        startsAt: form.startDate,
        endsAt: form.endDate,
        configuration: {
          metafieldId,
          thresholds: validatedThresholds,
          ensureAnyCustomerTags: form.configuration.ensureAnyCustomerTags,
          excludedProductTags: form.configuration.excludedProductTags,
        },
      }

      submitForm({ discount: JSON.stringify(discount) }, { method: 'post' })

      return { status: 'success' }
    },
  })

  return (
    <Page
      title="Edit discount"
      backAction={{
        content: 'Discounts',
        onAction: () => onBreadcrumbAction(redirect, true),
      }}
      primaryAction={{
        content: 'Save',
        onAction: submit,
        loading: isLoading,
      }}
    >
      <Layout>
        <ErrorBanner
          errors={serverErrors}
          form_errors={serverErrorsForm}
        ></ErrorBanner>

        <Layout.Section>
          <Form method="post">
            <BlockStack align="space-around" gap="500">
              <MethodCard
                title={
                  discountMethod.value === DiscountMethod.Code
                    ? `Discount Code: ${discountCode.value}`
                    : `Automatic discount: ${discountTitle.value}`
                }
                discountTitle={discountTitle}
                discountClass={DiscountClass.Order}
                discountCode={discountCode}
                discountMethod={discountMethod}
                discountMethodHidden
              />
              <Card>
                <BlockStack gap="300">
                  <Text variant="headingMd" as="h2">
                    Tiered discount configuration
                  </Text>
                  <TextField
                    multiline
                    label="Discount tiers"
                    autoComplete="off"
                    {...configuration.thresholds}
                  />

                  <Text as="p" variant="bodySm">
                    List of tiers. <br />
                    List is denoted by <Code>{'[]'}</Code> <br />
                    Tiers are denoted by <Code>{'[5, 0]'}</Code>, where the
                    first value is the discount percentage and the second value
                    is the minimum order amount to trigger the discount.
                  </Text>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text variant="headingMd" as="h2">
                    Other settings
                  </Text>

                  <TextField
                    label="Customer tags"
                    autoComplete="off"
                    {...configuration.ensureAnyCustomerTags}
                    helpText="Limit this discount to customers with any of these tags. Empty/No tags means every customer will get the discount."
                  />

                  <TextField
                    label="Excluded product tags"
                    autoComplete="off"
                    {...configuration.excludedProductTags}
                    helpText="Exclude products with these tags. Excluded products will not be discounted but would count towards the order total to receive the discount."
                  />
                </BlockStack>
              </Card>

              {discountMethod.value === DiscountMethod.Code && (
                <UsageLimitsCard
                  totalUsageLimit={usageLimit}
                  oncePerCustomer={appliesOncePerCustomer}
                />
              )}

              <CombinationCard
                combinableDiscountTypes={combinesWith}
                discountClass={DiscountClass.Product}
                discountDescriptor={'Discount'}
              />

              <ActiveDatesCard
                startDate={startDate}
                endDate={endDate}
                timezoneAbbreviation="EST"
              />
            </BlockStack>
          </Form>
        </Layout.Section>
        <Layout.Section variant="oneThird">
          <SummaryCard
            header={{
              discountMethod: discountMethod.value,
              discountDescriptor:
                discountMethod.value === DiscountMethod.Automatic
                  ? discountTitle.value
                  : discountCode.value,
              appDiscountType: 'Volume',
              isEditing: false,
            }}
            performance={{
              status: DiscountStatus.Scheduled,
              usageCount: 0,
              // isEditing: false,
            }}
            minimumRequirements={{
              requirementType: requirementType.value,
              subtotal: requirementSubtotal.value,
              quantity: requirementQuantity.value,
              currencyCode: currencyCode,
            }}
            usageLimits={{
              oncePerCustomer: appliesOncePerCustomer.value,
              totalUsageLimit: usageLimit.value,
            }}
            activeDates={{
              startDate: startDate.value,
              endDate: endDate.value,
            }}
          />
        </Layout.Section>
        <Layout.Section>
          <PageActions
            primaryAction={{
              content: 'Save discount',
              onAction: submit,
              loading: isLoading,
            }}
            secondaryActions={[
              {
                content: 'Discard',
                onAction: () => resetForm(),
              },
            ]}
          />
        </Layout.Section>
      </Layout>
    </Page>
  )
}
