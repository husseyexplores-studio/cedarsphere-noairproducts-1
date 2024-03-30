
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
} from '@remix-run/cloudflare'
import { json } from '@remix-run/cloudflare'
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  InlineStack,
} from '@shopify/polaris'
// import { initDB, schema } from '~/db.server'
import { Redirect } from '@shopify/app-bridge/actions'
import { useAppBridge } from '@shopify/app-bridge-react'

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const shopify = context.shopify
  await shopify.authenticate.admin(request)

  // const db = initDB(context.env.DB)
  // const test_table = await db.select().from(schema.test_table)

  return json({ test_table: [] })
}

export const action = async ({ request, context }: ActionFunctionArgs) => {
  const shopify = context.shopify
  await shopify.authenticate.admin(request)

  // const color = ['Red', 'Orange', 'Yellow', 'Green'][
  //   Math.floor(Math.random() * 4)
  // ]

  // const db = initDB(context.env.DB)
  // const test_table = await db
  //   .insert(schema.test_table)
  //   .values({ test_data: color })
  //   .returning()

  return json({ test_table: [] })
}

export default function Index() {
  const app = useAppBridge()
  const redirect = Redirect.create(app)

  return (
    <Page>
      <ui-title-bar title="Custom app by Cedarsphere"></ui-title-bar>

      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Start by creating a discount from the discounts dashboard 🎉
                  </Text>
                </BlockStack>

                <InlineStack gap="300">
                  <Button
                    onClick={() => {
                      redirect.dispatch(Redirect.Action.ADMIN_SECTION, {
                        name: Redirect.ResourceType.Discount,
                      })
                    }}
                  >
                    Create a discount
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  )
}
