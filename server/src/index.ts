import { createApp } from "./app.ts";

const app = await createApp();
const port = Number(process.env.PORT || 3000);
await app.listen({ port, host: "0.0.0.0" });
