// /api/line.js
// Node 18 / Vercel Serverless
import axios from 'axios';
import { middleware, Client } from '@line/bot-sdk';

export const config = { api: { bodyParser: false } };

const lineConfig = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new Client(lineConfig);

export default async function handler(req, res) {
  // ブラウザのGETは弾く（正常です）
  if (req.method !== 'POST') return res.status(401).send('unauthorized');

  // 署名検証
  await new Promise((ok, ng) =>
    middleware(lineConfig)(req, res, (err) => (err ? ng(err) : ok()))
  );

  const events = req.body.events || [];
  await Promise.all(events.map(handleEvent));
  res.status(200).end();
}

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return;

  const text = (event.message.text || '').trim();
  const userId = event.source?.userId || 'anonymous';

  // 🔸ここがポイント：同じテキストを2つのキーで投げる（保険）
  const payload = {
    inputs: {
      'sys.query': text,      // Difyの推奨キー
      'USER_MESSAGE': text,   // もしワークフローがこの名前を期待していてもOK
    },
    response_mode: 'blocking',
    user: userId,
    conversation_id: userId,
  };

  try {
    const r = await axios.post(
      process.env.DIFY_WORKFLOW_URL, // 例: https://api.dify.ai/v1/workflows/run
      payload,
      {
        headers: {
          'Authorization': `Bearer ${process.env.DIFY_API_KEY}`, // DIFY_API_KEYは「app-」から始まる生キー
          'Content-Type': 'application/json',
        },
        timeout: 45000,
      }
    );

    const out =
      r?.data?.data?.outputs?.text ||
      r?.data?.data?.outputs?.answer ||
      r?.data?.answer ||
      '(Dify応答なし)';

    await client.replyMessage(event.replyToken, { type: 'text', text: out });
  } catch (err) {
    console.error('Dify error', err?.response?.status, err?.response?.data);
    const msg = err?.response?.data?.message || JSON.stringify(err?.response?.data || {});
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: `Difyリクエスト失敗（${err?.response?.status || '---'}）。${msg}`,
    });
  }
}
