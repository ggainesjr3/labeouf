declare module 'web-push' {
  type PushSubscription = {
    endpoint: string;
    expirationTime?: number | null;
    keys: {
      p256dh: string;
      auth: string;
    };
  };

  type WebPushError = Error & {
    statusCode?: number;
    body?: string;
    headers?: Record<string, string>;
  };

  const webpush: {
    setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
    sendNotification(subscription: PushSubscription, payload?: string | Buffer): Promise<unknown>;
  };

  export = webpush;
}
