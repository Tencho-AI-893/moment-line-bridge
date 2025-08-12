// api/line.js （Node 18 / Vercel Serverless）
// ESM でOK。package.json は "type": "module"

import axios from 'axios';
import { middleware, Client } from '@line/bot-sdk';

// Next.js 由来の記法ですが、Vercelでも raw body を確保するために置いておきます
export const config = { api: { bodyParser: false } };

// ---- LINE 設定 ----
const lineConfig = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const client = new Client(lineConfig);

// ---- Dify 設定（未設定でも既定URLにフォールバック）----
const DIFY_URL = process.env.DIFY_API_URL || 'https://api.dify.ai/v1/chat-messages';
const DIFY_KEY = process.env.DIFY_API_KEY;

// ---- メインハンドラ ----
export default async function handler(req, res) {
  // ブラウザ確認用（署名なしアクセスはここで終わらせる）
  if (req.method !== 'POST') {
    res.status(200).send('OK');
    return;
  }

  // 署名検証（失敗したら 401）
  try {
    const mw = middleware(lineConfig);
    await new Promise((resolve, reject) =>
      mw(req, res, (err) => (err ? reject(err) : resolve()))
    );
  } catch {
    res.status(401).send('unauthorized');
    return;
  }

  const events = req.body?.events ?? [];
  await Promise.all(events.map(handleEvent));
  res.status(200).end();
}

// ---- 各イベント処理 ----
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return;

  const text = (event.message.text || '').trim();
  const userId = event.source?.userId || 'anonymous';

  let answer = '';
  try {
    const r = await axios.post(
      DIFY_URL,
      {
        inputs: {},                // chat-messages は inputs は空でOK
        query: text,               // ユーザーの発言
        response_mode: 'blocking',
        conversation_id: userId,
        user: userId,
      },
      { headers: { Authorization: `Bearer ${DIFY_KEY}` } }
    );

    answer = r.data?.answer ?? r.data?.outputs?.text ?? '(Dify返答なし)';
  } catch (e) {
    const status = e?.response?.status ?? 'ERR';
    answer = `Difyリクエスト失敗（${status}）`;
  }

  await client.replyMessage(event.replyToken, { type: 'text', text: answer });
}
