import { useState } from 'react'
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
} from '@remix-run/cloudflare'
import { json } from '@remix-run/cloudflare'
import {
  AppProvider as PolarisAppProvider,
  Button,
  Card,
  FormLayout,
  Page,
  Text,
  TextField,
} from '@shopify/polaris'
import { Form, useActionData, useLoaderData } from '@remix-run/react'
import polarisStyles from '@shopify/polaris/build/esm/styles.css'
import { loginErrorMessage } from './error.server'

export const links = () => [{ rel: 'stylesheet', href: polarisStyles }]

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const shopify = context.shopify
  const errors = loginErrorMessage(await shopify.login(request))

  return json({
    errors,
    polarisTranslations: require(`@shopify/polaris/locales/en.json`),
  })
}

export const action = async ({ request, context }: ActionFunctionArgs) => {
  const shopify = context.shopify
  const errors = loginErrorMessage(await shopify.login(request))

  return json({ errors })
}

export default function Auth() {
  const loaderData = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()
  const [shop, setShop] = useState('')
  const { errors } = actionData || loaderData

  return (
    <PolarisAppProvider i18n={loaderData.polarisTranslations}>
      <Page>
        <Card>
          <Form method="post">
            <FormLayout>
              <Text variant="headingMd" as="h2">
                Log in
              </Text>
              <TextField
                type="text"
                name="shop"
                label="Shop domain"
                helpText="example.myshopify.com"
                value={shop}
                onChange={setShop}
                autoComplete="on"
                error={errors.shop}
              />
              <Button submit>Log in</Button>
            </FormLayout>
          </Form>
        </Card>
      </Page>
    </PolarisAppProvider>
  )
}
