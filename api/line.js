// api/line.js
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
  // LINE 署名検証（ここを通ると unauthorized ではなくなる）
  const mw = middleware(lineConfig);
  await new Promise((ok, ng) => mw(req, res, e => (e ? ng(e) : ok())));

  const events = req.body?.events || [];
  await Promise.all(events.map(handleEvent));
  res.status(200).end();
}

async function handleEvent(event) {
  if (event?.type !== 'message' || event.message?.type !== 'text') return;

  const text = (event.message.text || '').trim();
  const userId = event.source?.userId || 'anonymous';

  const url = process.env.DIFY_WORKFLOW_URL || 'https://api.dify.ai/v1/chat-messages';
  const isChat = url.endsWith('/chat-messages');

  // どちらのAPIでも通るようにペイロードを切替
  const payload = isChat
    ? {
        inputs: {},                // chat-messages では inputs は空でもOK
        query: text,               // ここにユーザーの発話
        user: userId,
        response_mode: 'blocking',
        conversation_id: userId,
      }
    : {
        inputs: { [INPUT_KEY]: text }, // workflows は inputs のキー名が必要
        user: userId,
        response_mode: 'blocking',
        conversation_id: userId,
      };

  const { data } = await axios.post(url, payload, {
    headers: { Authorization: `Bearer ${process.env.DIFY_API_KEY}` },
  });

  // どちらのAPIでも答えを拾えるように網を広く
  const out =
    data?.answer ||
    data?.data?.outputs?.text ||
    data?.outputs?.text ||
    '(Dify応答なし)';

  await client.replyMessage(event.replyToken, { type: 'text', text: out });
}
