export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { handlers, authEnabled } from "../../../../auth";

const disabled = () => Response.json({});

export const GET = authEnabled ? handlers.GET : disabled;
export const POST = authEnabled ? handlers.POST : disabled;
