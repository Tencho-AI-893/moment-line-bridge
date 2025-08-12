// Node 18 / Vercel
import axios from 'axios';                      // ← これ1回だけ
import { middleware, Client } from '@line/bot-sdk';

export const config = { api: { bodyParser: false } };

const lineConfig = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new Client(lineConfig);
const INPUT_KEY = process.env.DIFY_INPUT_KEY || 'sys.query';

export default async function handler(req, res) {
  // Health check（ブラウザ確認用）: ミドルウェア前に早期 return
  if (req.method === 'GET') {
    return res.status(200).send('OK');
  }

  // LINE 署名検証（ここからはLINEのWebhookだけ通す）
  const mw = middleware(lineConfig);
  await new Promise((ok, ng) => mw(req, res, (err) => (err ? ng(err) : ok())));

  const events = req.body.events || [];
  await Promise.all(events.map(handleEvent));
  res.status(200).end();
}

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return;

  const text   = (event.message.text || '').trim();
  const userId = event.source.userId || 'anonymous';

  // ★ Dify（Workflow の /workflows/run を使う想定）
  const r = await axios.post(
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
    r.data?.data?.outputs?.text ||
    r.data?.data?.outputs?.[INPUT_KEY]?.data?.answer ||
    r.data?.answer ||
    '(Dify返答なし)';

  await client.replyMessage(event.replyToken, { type: 'text', text: out });
}
