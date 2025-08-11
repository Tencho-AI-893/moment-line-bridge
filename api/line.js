// api/line.js  — Vercel (Node 18, ESM)
import axios from 'axios';
import { middleware, Client } from '@line/bot-sdk';

export const config = { api: { bodyParser: false } };

const lineConfig = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const client = new Client(lineConfig);
const INPUT_KEY = process.env.DIFY_INPUT_KEY || 'sys.query';

export default async function handler(req, res) {
  // ← Verify/ブラウザアクセス(GET/HEAD)は200で返す
  if (req.method !== 'POST') { res.status(200).send('OK'); return; }

  const mw = middleware(lineConfig);
  await new Promise((resolve, reject) => mw(req, res, err => (err ? reject(err) : resolve())));

  const events = req.body?.events || [];
  await Promise.all(events.map(handleEvent));
  res.status(200).end();
}

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return;
  const text = (event.message.text || '').trim();
  const userId = event.source.userId || 'anonymous';

  const difyRes = await axios.post(
    process.env.DIFY_WORKFLOW_URL || 'https://api.dify.ai/v1/workflows/run',
    {
      inputs: { [INPUT_KEY]: text },
      response_mode: 'blocking',
      user: userId,
      conversation_id: userId,
    },
    { headers: { Authorization: `Bearer ${process.env.DIFY_API_KEY}` } }
  );

  const out =
    difyRes.data?.data?.outputs?.text ??
    difyRes.data?.outputs?.text ??
    difyRes.data?.answer ??
    '（BOTからの応答を取得できませんでした）';

  for (const chunk of splitByBytes(out.replace(/```/g, ''), 4500)) {
    await client.replyMessage(event.replyToken, { type: 'text', text: chunk });
  }
}

function splitByBytes(s, max) {
  const arr = []; let buf = '';
  for (const ch of s) {
    const b = Buffer.from(ch).length;
    if (Buffer.from(buf).length + b > max) { arr.push(buf); buf = ch; } else buf += ch;
  }
  if (buf) arr.push(buf);
  return arr;
}
