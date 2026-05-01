import { redirect } from 'next/navigation'
import { loadResolvedConfig } from '@/shared/config/server'
import { defaultLandingRoute, ROUTES } from '@/shared/constants/routes'

interface Props {
  params: Promise<{ orgId: string }>
}

export default async function OrgHomePage({ params }: Props) {
  const { orgId } = await params
  const config = loadResolvedConfig()
  const org = config.orgs.find((o) => o.id === orgId)
  redirect(org ? defaultLandingRoute(orgId, org.role) : ROUTES.ORG_BLOTTER(orgId))
}
