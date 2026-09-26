// Server-side Higgsfield example: generate a video with Seedance 2.5.
// Run with: npm run generate
// Credentials are read from .env.local (HF_CREDENTIALS=key-id:key-secret) and never logged.
import { existsSync } from "node:fs";
import { config, higgsfield, HiggsfieldError, TimeoutError } from "@higgsfield/client/v2";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

if (!process.env.HF_CREDENTIALS) {
  console.error("HF_CREDENTIALS is not set. Add it to .env.local as key-id:key-secret.");
  process.exit(1);
}

config({
  credentials: process.env.HF_CREDENTIALS,
  // Video generation can take longer than the SDK's 5-minute default.
  maxPollTime: 15 * 60 * 1000,
});

async function main() {
  const result = await higgsfield.subscribe("bytedance/seedance-2.5/text-to-video", {
    input: {
      prompt: "A cinematic scene at sunset",
      // Cheapest settings the model allows: minimum duration, lowest resolution, no audio.
      duration: 4,
      resolution: "480p",
      aspect_ratio: "16:9",
      generate_audio: false,
    },
    withPolling: true,
  });

  // The API reports failures as a status, not an exception, so check it explicitly.
  // The SDK types list failed and nsfw; canceled is also handled here in case the API returns it.
  const status: string = result.status;
  const url = result.video?.url;
  if (status !== "completed" || !url) {
    const reason =
      status === "nsfw" ? "rejected by content moderation"
      : status === "failed" ? "generation failed"
      : status === "canceled" || status === "cancelled" ? "request was canceled"
      : status === "completed" ? "completed but no video URL was returned"
      : `unexpected status "${status}"`;
    console.error(`Request ${result.request_id}: ${reason}.`);
    process.exit(1);
  }

  console.log(`Request ${result.request_id} completed.`);
  console.log(`Video URL: ${url}`);
}

main().catch((err) => {
  if (err instanceof TimeoutError) {
    console.error("Timed out waiting for the video. The request may have stalled or been canceled.");
  } else if (err instanceof HiggsfieldError) {
    console.error(`Higgsfield error (${err.name}): ${err.message}`);
  } else {
    console.error("Unexpected error:", err instanceof Error ? err.message : err);
  }
  process.exit(1);
});
