import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const MASTER_SECRET = process.env.MASTER_SECRET_PATH ?? ''

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // ── 1. Chemin secret → entry point super admin ──────────────────────────
  if (MASTER_SECRET && pathname === MASTER_SECRET) {
    const masterJwt = req.cookies.get('master_jwt')?.value

    if (masterJwt) {
      return NextResponse.redirect(new URL('/master/dashboard', req.url))
    }

    const res = NextResponse.redirect(new URL('/master/login', req.url))
    res.cookies.set('master_access', '1', {
      httpOnly: true,
      maxAge: 300,
      path: '/',
      sameSite: 'strict',
    })
    return res
  }

  // ── 2. Protéger /master/login — inaccessible sans passer par le chemin secret ──
  if (pathname === '/master/login') {
    const hasAccess  = req.cookies.get('master_access')?.value
    const hasSession = req.cookies.get('master_jwt')?.value
    const isLogout   = req.nextUrl.searchParams.get('logout') === '1'

    if (!hasAccess && !hasSession && !isLogout) {
      return NextResponse.redirect(new URL('/', req.url))
    }
  }

  // ── 3. Protéger /master/dashboard — session obligatoire ────────────────
  if (pathname.startsWith('/master/dashboard')) {
    const hasSession = req.cookies.get('master_jwt')?.value

    if (!hasSession) {
      return NextResponse.redirect(new URL('/', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|api/).*)',
  ],
}
