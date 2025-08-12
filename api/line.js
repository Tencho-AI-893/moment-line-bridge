// Node 18 / Vercel Serverless Function
import axios from 'axios';
import { middleware, Client } from '@line/bot-sdk';

export const config = { api: { bodyParser: false } }; // 署名検証に必要（生ボディ）

const lineConfig = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new Client(lineConfig);

export default async function handler(req, res) {
  // LINEミドルウェア（署名検証）
  const mw = middleware(lineConfig);
  try {
    await new Promise((ok, ng) => mw(req, res, (e) => (e ? ng(e) : ok())));
  } catch (e) {
    console.error('LINE middleware error:', e?.message || e);
    res.status(401).end('unauthorized');
    return;
  }

  const events = req.body?.events || [];
  try {
    await Promise.all(events.map(handleEvent));
    res.status(200).end('ok');
  } catch (e) {
    console.error('handle events error:', e?.message || e);
    res.status(500).end('error');
  }
}

async function handleEvent(event) {
  if (event.type !== 'message' || event.message?.type !== 'text') return;

  const text = (event.message.text || '').trim();
  const userId = event.source?.userId || 'anonymous';

  // --- ★ ここがポイント：inputs を「両方のキー」で送る ---
  // Dify 側が sys.query を読むのか query を読むのか不一致だと 400 になるため、
  // 一旦どちらも同じテキストを渡して確実に通します。
  const inputs = {
    [process.env.DIFY_INPUT_KEY || 'query']: text, // 環境変数優先（なければ query）
    'query': text,       // 保険その1
    'sys.query': text    // 保険その2
  };

  const payload = {
    inputs,
    response_mode: 'blocking',
    user: userId,              // 会話の識別に使われる
    // conversation_id: userId  // 必要なら有効化（なくても動きます）
  };

  try {
    const dify = await axios.post(
      process.env.DIFY_WORKFLOW_URL || 'https://api.dify.ai/v1/workflows/run',
      payload,
      { headers: { Authorization: `Bearer ${process.env.DIFY_API_KEY}` } }
    );

    const out =
      dify.data?.data?.outputs?.text ??
      dify.data?.data?.outputs?.answer ??
      '(Difyの応答が空でした)';

    await client.replyMessage(event.replyToken, { type: 'text', text: out });
  } catch (err) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    console.error('Dify error:', status, JSON.stringify(data || err.message));
    await client.replyMessage(event.replyToken, {
      type: 'text',
      text: `Difyリクエスト失敗（${status ?? '不明'}）。ログを確認してください。`,
    });
  }
}
