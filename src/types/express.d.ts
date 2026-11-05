declare global {
  namespace Express {
    interface Request {
      authenticatedProject?: {
        id: string;
        name: string;
      };
      authenticatedApiKeyId?: string;
    }
  }
}

export {};
