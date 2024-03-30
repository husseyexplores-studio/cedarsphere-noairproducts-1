import { useMemo } from 'react'
import { Form } from '@remix-run/react'
import {
  Card,
  Text,
  Layout,
  Page,
  PageActions,
  TextField,
  BlockStack,
  ChoiceList,
  InlineStack,
} from '@shopify/polaris'
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
import { useForm, useField, submitFail } from '@shopify/react-form'
import { CurrencyCode } from '@shopify/react-i18n'
import { ErrorBanner, type ErrorBannerProps } from '~/components/ErrorBanner'
import { validateShippingDiscountConfig } from '~/utils/route-validators'
import type { ShippingDiscount } from '../../../types'

export function ShippingDiscountPageComponent({
  discount: disc,
  onSubmit,
  onBack,
  form_errors: serverErrorsForm,
  errors: serverErrors,
  loading: isLoading = false,
}: {
  discount?: ShippingDiscount | null
  onBack: () => void
  onSubmit: (discount: ShippingDiscount) => Promise<any>
  form_errors?: ErrorBannerProps['form_errors']
  errors?: ErrorBannerProps['errors']
  loading?: boolean
}) {
  const conf = disc?.configuration
  const todaysDate = useMemo(() => new Date(), [])
  const _metafield_id = disc?._metafield_id

  const currencyCode = CurrencyCode.Usd

  const discount_type = useField<'fixed' | 'percentage'>({
    value: conf ? conf.discount_type : 'percentage',
    validates: (x) => {
      if (!x) return 'Required'
      if (x !== 'fixed' && x !== 'percentage')
        return "Must be 'fixed' or 'percentage'"
    },
  })
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
      discountTitle: useField(disc ? disc.title : ''),
      discountMethod: useField(disc ? disc.method : DiscountMethod.Code),
      discountCode: useField(disc ? disc.code : ''),
      combinesWith: useField(
        disc
          ? disc.combinesWith
          : {
              orderDiscounts: false,
              productDiscounts: false,
              shippingDiscounts: false,
            },
      ),

      // not using `requirements` - they're passed as-is into Summary Card
      requirementType: useField(RequirementType.None),
      requirementSubtotal: useField('0'),
      requirementQuantity: useField('0'),

      usageLimit: useField<string | null>(
        disc ? disc.usageLimit?.toString() ?? null : null,
      ),
      appliesOncePerCustomer: useField(false),
      startDate: useField<string>(
        disc ? disc.startsAt : todaysDate.toISOString(),
      ),
      endDate: useField<string | null>(disc ? disc.endsAt : null),
      configuration: {
        // allow_guest: useField(false),
        customer_tags_type: useField<'include' | 'exclude'>(
          conf ? conf.customer_tags_type : 'include',
        ),
        customer_tags: useField(
          conf ? conf.customer_tags?.join(',') || '' : '',
        ),
        discount_type,
        discount_value: useField(
          {
            value: conf ? conf.discount_value?.toString() ?? '0' : '0',
            validates: (y) => {
              const x = Number(y)

              if (Number.isNaN(x)) return 'Must be a number'
              if (x < 0) return 'Discount cannot be negative'
              if (discount_type.value === 'percentage') {
                if (x > 100) return 'Discount cannot exceed 100%'
              }
            },
          },
          [discount_type],
        ),
        discount_message: useField(conf ? conf.discount_message || '' : ''),
      },
    },
    onSubmit: async (form) => {
      const [errors, config] = validateShippingDiscountConfig(
        form.configuration,
        'configuration',
      )

      if (errors) {
        return { status: 'fail', errors: errors.errors }
      }

      if (!config) {
        return submitFail([{ message: 'Invalid discount configuration' }])
      }

      const discount = {
        _metafield_id,
        title: form.discountTitle,
        method: form.discountMethod,
        code: form.discountCode,
        combinesWith: form.combinesWith,
        usageLimit: form.usageLimit == null ? null : parseInt(form.usageLimit),
        appliesOncePerCustomer: form.appliesOncePerCustomer,
        startsAt: form.startDate,
        endsAt: form.endDate,
        configuration: config,
      } satisfies ShippingDiscount

      onSubmit(discount)

      return { status: 'success' }
    },
  })

  const tags_type = configuration.customer_tags_type.value
  const ctags = configuration.customer_tags.value
  const whoGetsDiscountMsg = useMemo(() => {
    if (tags_type === 'include') {
      if (ctags?.trim().length === 0) {
        return 'No one will get the discount. Please add some customer tags'
      }
      return `Only tagged customers will get the discount`
    } else if (tags_type === 'exclude') {
      if (ctags?.trim().length === 0) {
        return 'All customers will get the discount.'
      }
      return `Everyone gets the discount, except the tagged customers`
    }

    return ''
  }, [tags_type, ctags])

  return (
    <Page
      title={!disc ? 'Create shipping discount' : 'Edit shipping discount'}
      backAction={{
        content: 'Discounts',
        onAction: () => onBack?.(),
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
                title="Shipping discount"
                discountTitle={discountTitle}
                discountClass={DiscountClass.Shipping}
                discountCode={discountCode}
                discountMethod={discountMethod}
              />

              <Card>
                <BlockStack gap="400">
                  <BlockStack gap="100">
                    <Text variant="headingSm" as="h3">
                      Discount type
                    </Text>
                    <ChoiceList
                      title="Discount type"
                      allowMultiple={false}
                      titleHidden
                      choices={[
                        {
                          value: 'percentage',
                          label: 'Percentage',
                        },
                        {
                          value: 'fixed',
                          label: 'Fixed amount',
                        },
                      ]}
                      {...discount_type}
                      selected={[discount_type.value]}
                      onChange={(values) => {
                        discount_type.onChange(values[0] as any)
                      }}
                    />
                  </BlockStack>

                  <BlockStack gap="100">
                    <Text variant="headingSm" as="h3">
                      Discount value
                    </Text>
                    <InlineStack>
                      <TextField
                        type="number"
                        labelHidden
                        inputMode="numeric"
                        min="0"
                        max={
                          discount_type.value === 'percentage' ? 100 : undefined
                        }
                        autoComplete="off"
                        label="Discount value"
                        {...configuration.discount_value}
                        suffix={
                          discount_type.value === 'percentage'
                            ? '%'
                            : CurrencyCode.Usd
                        }
                      />
                    </InlineStack>
                  </BlockStack>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">
                    Customer eligibility
                  </Text>
                  {/* <BlockStack gap="100">
                    <Checkbox
                      label="Allow guests"
                      {...asChoiceField(configuration.allow_guest)}
                    />
                  </BlockStack> */}
                  <BlockStack>
                    <Text variant="headingSm" as="h3">
                      If customer is logged in
                    </Text>
                    <ChoiceList
                      title="Discount type"
                      allowMultiple={false}
                      titleHidden
                      choices={[
                        {
                          value: 'include',
                          label:
                            'Only apply discount to tagged customers (any tag)',
                        },
                        {
                          value: 'exclude',
                          label:
                            'Apply discount to all except tagged customers (any tag)',
                        },
                      ]}
                      {...configuration.customer_tags_type}
                      selected={[configuration.customer_tags_type.value]}
                      onChange={(values) => {
                        configuration.customer_tags_type.onChange(
                          values[0] as any,
                        )
                      }}
                    />
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text variant="headingSm" as="h3">
                      Customer tags
                    </Text>
                    <InlineStack>
                      <TextField
                        type="text"
                        labelHidden
                        autoComplete="off"
                        label="Customer tags"
                        {...configuration.customer_tags}
                        helpText="Comma separated list of tags"
                      />
                    </InlineStack>

                    <InlineStack>
                      <Text as="p" variant="bodySm" tone="subdued">
                        {whoGetsDiscountMsg}
                      </Text>
                    </InlineStack>
                  </BlockStack>
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
                discountClass={DiscountClass.Shipping}
                discountDescriptor={'This shipping discount'}
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
              appDiscountType: 'Shipping',
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
