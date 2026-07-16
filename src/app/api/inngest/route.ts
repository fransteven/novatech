import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { dailyCollectionsDigest, sendDigestNow } from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [dailyCollectionsDigest, sendDigestNow],
});
