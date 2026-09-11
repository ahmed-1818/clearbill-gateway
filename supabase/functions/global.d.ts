declare namespace Deno {
  export interface Env {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    delete(key: string): void;
    toObject(): Record<string, string>;
  }
  export const env: Env;
  export function serve(
    handler: (request: Request) => Promise<Response> | Response
  ): void;
  export function serve(
    options: { port?: number; onListen?: (localAddr: { hostname: string; port: number }) => void },
    handler: (request: Request) => Promise<Response> | Response
  ): void;
}

declare module "https://*" {
  const content: any;
  export = content;
  export default content;
  export const createClient: any;
  export const serve: any;
}

declare module "http://*" {
  const content: any;
  export = content;
  export default content;
}
