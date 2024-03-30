import { useEffect, useMemo } from 'react'
import { json, type ActionFunctionArgs } from '@remix-run/cloudflare'
import { useForm, useField, submitFail } from '@shopify/react-form'
import { useAppBridge } from '@shopify/app-bridge-react'
import { Redirect } from '@shopify/app-bridge/actions'
import { CurrencyCode } from '@shopify/react-i18n'
import { Form, useActionData, useNavigation, useSubmit } from '@remix-run/react'
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
import { DefaultErrorBoundary } from '~/components/DefaultErrorBoundary'
import { ErrorBanner, type ErrorBannerProps } from '~/components/ErrorBanner'
import {
  prettyStringifyb2bThresholdJson,
  tagsToList,
  tryCatch,
  validatedb2bDiscountThresholds,
} from '~/utils/index'

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
                  namespace: '$app:b2b-order-discount',
                  key: 'function-configuration',
                  type: 'json',
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
                  namespace: '$app:b2b-order-discount',
                  key: 'function-configuration',
                  type: 'json',
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
export default function DiscountNew() {
  const submitForm = useSubmit()
  const actionData = useActionData<typeof action>()
  const navigation = useNavigation()
  const app = useAppBridge()
  const todaysDate = useMemo(() => new Date(), [])

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
        redirect.dispatch(Redirect.Action.ADMIN_SECTION, {
          name: Redirect.ResourceType.Discount,
        })
      }
    }
  }, [actionData, redirect])

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
      discountTitle: useField(''),
      discountMethod: useField(DiscountMethod.Code),
      discountCode: useField(''),
      combinesWith: useField({
        orderDiscounts: false,
        productDiscounts: false,
        shippingDiscounts: false,
      }),

      // not using `requirements` - they're passed as-is into Summary Card
      requirementType: useField(RequirementType.None),
      requirementSubtotal: useField('0'),
      requirementQuantity: useField('0'),

      usageLimit: useField<string | null>(null),
      appliesOncePerCustomer: useField(false),
      startDate: useField<string>(todaysDate.toISOString()),
      endDate: useField<string | null>(null),
      configuration: {
        thresholds: useField(
          prettyStringifyb2bThresholdJson([
            [5, 0],
            [10, 600],
            [15, 1500],
            [20, 2500],
            [25, 5000],
          ]),
        ),
        ensureAnyCustomerTags: useField('b2b'),
        excludedProductTags: useField(''),
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
      title="Create discount"
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
          <Form method="post" onSubmit={submit}>
            <BlockStack align="space-around" gap="200">
              <MethodCard
                title="Tiered discount"
                discountTitle={discountTitle}
                discountClass={DiscountClass.Order}
                discountCode={discountCode}
                discountMethod={discountMethod}
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
                    List is denoted by {'[]'} <br />
                    Tiers are denoted by {'[5, 0]'}, where the first value is
                    the discount percentage and the second value is the minimum
                    order amount to trigger the discount.
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

export const ErrorBoundry = DefaultErrorBoundary
