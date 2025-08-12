// Chat モード用（/v1/chat-messages）
const r = await axios.post(
  process.env.DIFY_WORKFLOW_URL,
  {
    query: text,                 // ← ここが Chat は必須
    inputs: {},                  // 使わなければ空でOK
    response_mode: 'blocking',
    user: userId,
    conversation_id: userId
  },
  { headers: { Authorization: `Bearer ${process.env.DIFY_API_KEY}` } }
);

const out = r.data?.answer || r.data?.data?.answer || '(Dify返答なし)';
await client.replyMessage(event.replyToken, { type: 'text', text: out });
