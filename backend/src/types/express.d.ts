declare global {
  namespace Express {
    interface Request {
      // treat route params as simple string map within this project
      params: Record<string, string>;

      // masterUser is attached by master auth middleware; keep it permissive
      masterUser?: {
        id: string;
        role: string;
        [key: string]: any;
      } | null;
    }
  }
}

export {};
