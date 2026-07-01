import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getPortalSite } from '@/lib/portal/site'
import { portalRootStyle, portalTextColors } from '@/lib/portal/look'
import PortalHeader from '../PortalHeader'
import RedeemForm from './RedeemForm'

export const dynamic = 'force-dynamic'

export default async function RedeemPage() {
  const portal = await getPortalSite()
  const { brand, content, accent } = portal
  const rootStyle = portalRootStyle(portal)
  const { text: portalText, muted: portalMuted } = portalTextColors(portal)

  const user = await getCurrentUser()
  if (!user) redirect('/me')

  return (
    <div className="min-h-screen flex flex-col" style={rootStyle}>
      <PortalHeader
        brand={brand}
        logoImage={content?.logoImage}
        theme={{ muted: portalMuted }}
        accent={accent}
        backHref="/me"
      />
      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-20 text-center">
        <h1 className="font-display italic" style={{ color: portalText, fontSize: 40, lineHeight: 1.1 }}>
          Redeem a code
        </h1>
        <p className="font-body mt-4 mx-auto" style={{ color: portalMuted, fontSize: 15, lineHeight: 1.6, maxWidth: 420 }}>
          Enter the unlock code from your purchase and your workbook will open here, saved to your account.
        </p>
        <RedeemForm accent={accent} text={portalText} muted={portalMuted} />
      </main>
      <footer className="text-center py-10" style={{ borderTop: `1px solid ${accent}1f` }}>
        <p className="font-body" style={{ fontSize: 13, color: portalMuted }}>
          {content?.footer || brand}
        </p>
      </footer>
    </div>
  )
}
