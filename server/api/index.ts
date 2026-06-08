import { app } from '../src/app';
import { connectDatabase } from '../src/infrastructure/database';

let connected = false;

export default async function handler(req: any, res: any) {
  if (!connected) {
    await connectDatabase();
    connected = true;
  }
  return app(req, res);
}
