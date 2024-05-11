const { workerPath } = require("@strafechat/strafe.js");
import type { NextApiRequest, NextApiResponse } from 'next'
const fs = require("fs");

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.send(fs.readFileSync(workerPath));
} 