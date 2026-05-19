import { type Request, type Response, type NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthPayload {
  userId:      string
  schoolId:    string
  role:        string
  permissions: string[]
  tokenType:   "access" | "refresh"
  isMasterUser?: boolean
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.access_token
    if (!token) return res.status(401).json({ error: 'Non authentifié' })

    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload

    if (payload.tokenType !== "access") {
      return res.status(401).json({ error: 'Token de mauvais type' })
    }

    req.user = payload
    next()
  } catch {
    return res.status(401).json({ error: 'Token invalide ou expiré' })
  }
}

export const requireRole = (...args: (string | string[])[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    const roles = args.flat().map((r) => r.toUpperCase())
    if (!req.user || !roles.includes(req.user.role.toUpperCase())) {
      return res.status(403).json({ error: 'Accès refusé' })
    }
    next()
  }

export const requireSchool = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.schoolId) {
    return res.status(403).json({ error: 'Aucun établissement associé' })
  }
  next()
}

export const protect = requireAuth;
export const authorize = requireRole;