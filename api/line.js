// Node 18 / Vercel Serverless Function
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
  const mw = middleware(lineConfig);
  await new Promise((ok, ng) => mw(req, res, e => (e ? ng(e) : ok())));
  const events = req.body.events || [];
  await Promise.all(events.map(handleEvent));
  res.status(200).end();
}

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return;
  const text = (event.message.text || '').trim();
  const userId = event.source.userId || 'anonymous';

  const dify = await axios.post(
    process.env.DIFY_WORKFLOW_URL || 'https://api.dify.ai/v1/workflows/run',
    { inputs: { [INPUT_KEY]: text }, response_mode: 'blocking', user: userId, conversation_id: userId },
    { headers: { Authorization: `Bearer ${process.env.DIFY_API_KEY}` } }
  );

  const out = dify?.data?.data?.outputs?.text || dify?.data?.outputs?.text || dify?.data?.answer || '（Dify応答なし）';
  for (const t of split(out.replace(/```/g, ''), 4500)) {
    await client.replyMessage(event.replyToken, { type: 'text', text: t });
  }
}
const split = (s, max) => { const a=[]; let b=''; for (const ch of s){const n=Buffer.from(ch).length;
  if (Buffer.from(b).length + n > max){a.push(b); b=ch;} else b+=ch;} if(b) a.push(b); return a; };
