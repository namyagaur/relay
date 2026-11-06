declare global {
  namespace Express {
    interface Request {
      authenticatedProject?: {
        id: string;
        name: string;
        createdAt: Date;
      };
      authenticatedApiKeyId?: string;
    }
  }
}

export {};
