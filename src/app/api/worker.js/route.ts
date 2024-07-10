const { workerPath } = require("@strafechat/strafe.js");
const fs = require("fs");

export async function GET() {
  const worker = fs.readFileSync(workerPath);

  return new Response(worker, {
    headers: {
      "Content-Type": "application/javascript",
    },
  });
}