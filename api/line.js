// ここから（今ある axios.post のブロックを丸ごと置き換え）
const r = await axios.post(
  process.env.DIFY_WORKFLOW_URL,
  {
    // Chat アプリは query に質問を入れる
    query: text,
    // 使わなければ inputs は空でもOK
    inputs: {},
    response_mode: 'blocking',
    user: userId,
    conversation_id: userId,
  },
  {
    headers: {
      Authorization: `Bearer ${process.env.DIFY_API_KEY}`,
    },
  }
);

// 返答の取り方（answer が第一候補 / 念のため data.answer も見る）
const out = r.data?.answer ?? r.data?.data?.answer ?? '(Dify返答なし)';

// LINE に返信
await client.replyMessage(event.replyToken, { type: 'text', text: out });
// ここまで
