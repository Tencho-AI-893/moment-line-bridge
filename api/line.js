// Dify呼び出し（chat-messages 用）
const dify = await axios.post(
  process.env.DIFY_API_URL,        // ← https://api.dify.ai/v1/chat-messages
  {
    inputs: {},                    // ワークフローと違い、ここは空でOK
    query: text,                   // ← ユーザーの発言をそのまま渡す
    response_mode: 'blocking',     // まとめて返してもらう
    conversation_id: userId,       // 会話IDは同じuserIdでOK
    user: userId
  },
  {
    headers: { Authorization: `Bearer ${process.env.DIFY_API_KEY}` }
  }
);

// 返却の取り出しも chat-messages 仕様に
const answer =
  dify.data?.answer ||
  dify.data?.outputs?.text ||
  '(Dify返答なし)';
