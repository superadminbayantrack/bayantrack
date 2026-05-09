import serverless from "serverless-http";
import { createServer } from "../../server/index.ts";

const app = createServer();

export const handler = serverless(app);
