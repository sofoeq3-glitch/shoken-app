// Vercel Functions: /api/generate
// フロントエンドからのリクエストを受け取り、Anthropic APIを呼ぶ代理エンドポイント
// APIキーはVercelの環境変数 ANTHROPIC_API_KEY から取得する（コードに直書き禁止）

export default async function handler(req, res) {
  // POSTメソッド以外は拒否
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt } = req.body;

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "promptが指定されていません" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "サーバー設定エラー：APIキーが設定されていません" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Anthropic API error:", response.status, errorBody);
      return res.status(502).json({ error: "AI APIの呼び出しに失敗しました（" + response.status + "）" });
    }

    const data = await response.json();
    const text = data.content?.find((b) => b.type === "text")?.text?.trim() || "";

    if (!text) {
      return res.status(502).json({ error: "AIから空のレスポンスが返りました" });
    }

    return res.status(200).json({ text });
  } catch (err) {
    console.error("generate handler error:", err);
    return res.status(500).json({ error: "サーバーエラーが発生しました" });
  }
}
