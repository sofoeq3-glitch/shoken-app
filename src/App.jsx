import { useState } from "react";

const DEFAULT_TRAITS = {
  "学習・授業態度": ["積極的に発言する","集中力がある","ノートが丁寧","予習復習をする","グループ活動でリード","質問をよくする","粘り強く取り組む","理解が早い"],
  "生活・人間関係": ["挨拶がしっかりできる","思いやりがある","友達を助ける","誰にでも公平に接する","整理整頓ができる","時間を守る","責任感が強い","クラスをまとめる"],
  "部活・課外活動": ["部活動に熱心","リーダーシップを発揮","後輩の面倒を見る","行事で活躍","委員会・生徒会で活動","ボランティアに積極的","自主的に取り組む"],
  "成長・変化": ["1年間で大きく成長した","苦手を克服した","自信がついてきた","協調性が高まった","発言が増えた","落ち着きが出てきた","目標を持って行動できた"]
};

const LIMITS = [80, 100, 120, 150, 200];

function Tag({ label, active, onToggle, editMode, onDelete, disabled }) {
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button onClick={editMode ? undefined : (disabled ? undefined : onToggle)} style={{
        padding: "4px 12px",
        paddingRight: editMode ? "26px" : "12px",
        borderRadius: 20, fontSize: 12,
        cursor: editMode ? "default" : (disabled ? "not-allowed" : "pointer"),
        border: active ? "2px solid #1a3a2a" : "1px solid #ccc",
        background: active ? "#1a3a2a" : editMode ? "#fff8f8" : disabled ? "#f5f5f5" : "white",
        color: active ? "white" : disabled ? "#ccc" : "#555",
        fontFamily: "inherit", transition: "all 0.12s",
        borderColor: editMode ? "#e88" : active ? "#1a3a2a" : disabled ? "#eee" : "#ccc",
      }}>{label}</button>
      {editMode && (
        <span onClick={onDelete} style={{
          position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
          cursor: "pointer", fontSize: 13, color: "#c0392b", fontWeight: 700, lineHeight: 1
        }}>x</span>
      )}
    </div>
  );
}

function calcMaxTraits(charLimit) {
  return charLimit <= 80 ? 2 : charLimit <= 100 ? 2 : charLimit <= 120 ? 3 : charLimit <= 150 ? 3 : 4;
}

export default function App() {
  const [view, setView] = useState("setup");
  const [charLimit, setCharLimit] = useState(150);
  const [count, setCount] = useState(35);
  const [students, setStudents] = useState([]);
  const [currentNum, setCurrentNum] = useState(null);
  const [traits, setTraits] = useState([]);
  const [note, setNote] = useState("");
  const [editText, setEditText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [copied, setCopied] = useState(false);
  const [traitMap, setTraitMap] = useState(DEFAULT_TRAITS);
  const [editingKeywords, setEditingKeywords] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [newKeywordCat, setNewKeywordCat] = useState("学習・授業態度");
  const [newCatName, setNewCatName] = useState("");

  const charCount = editText.length;
  const over = charCount > charLimit;
  const pct = Math.min(100, Math.round((charCount / charLimit) * 100));
  const barColor = over ? "#c0392b" : pct > 90 ? "#d35400" : "#27ae60";

  function setupClass() {
    setStudents(Array.from({ length: count }, (_, i) => ({
      num: String(i + 1).padStart(2, "0"), shoken: "", traits: [], note: ""
    })));
    setView("list");
  }

  function openStudent(num) {
    const s = students.find(s => s.num === num);
    setCurrentNum(num);
    setEditText(s.shoken || "");
    setTraits([...(s.traits || [])]);
    setNote(s.note || "");
    setGenError("");
    setView("edit");
  }

  function saveAndBack() {
    setStudents(prev => prev.map(s =>
      s.num === currentNum ? { ...s, shoken: editText, traits: [...traits], note } : s
    ));
    setView("list");
  }

  function toggleTrait(t) {
    setTraits(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }

  function addKeyword() {
    const kw = newKeyword.trim();
    if (!kw) return;
    setTraitMap(prev => ({
      ...prev,
      [newKeywordCat]: prev[newKeywordCat].includes(kw)
        ? prev[newKeywordCat]
        : [...prev[newKeywordCat], kw]
    }));
    setNewKeyword("");
  }

  function deleteKeyword(cat, kw) {
    setTraitMap(prev => ({ ...prev, [cat]: prev[cat].filter(t => t !== kw) }));
    setTraits(prev => prev.filter(t => t !== kw));
  }

  function addCategory() {
    const name = newCatName.trim();
    if (!name || traitMap[name]) return;
    setTraitMap(prev => ({ ...prev, [name]: [] }));
    setNewKeywordCat(name);
    setNewCatName("");
  }

  // Anthropic APIはフロントから直接叩かず、/api/generate（Vercel Functions）経由で呼ぶ
  async function generate() {
    setGenerating(true);
    setGenError("");
    const limit = charLimit;
    const prompt = `あなたは中学校の担任教師です。3学期末の通知表の「所見」を書いてください。
${traits.length ? "取り上げるポイント：" + traits.join("、") : ""}
${note.trim() ? "担任メモ（必ず後半に自然に織り込むこと）：" + note : ""}
【文字数：厳守】
${limit}文字以内。漢字・ひらがな・カタカナ・句読点すべて1文字と数える。
【文章の構成】
- 前半：取り上げるポイントをもとに具体的なようすを書く
- 後半：担任メモの内容を先生自身の言葉として自然に入れ、励ましで締めくくる
- 担任メモがない場合は励ましで締めくくる
【その他】
- 生徒の名前・代名詞は使わない
- 文末は丁寧語で統一
- 箇条書き・記号不使用
所見文のみ出力してください。前置き不要。`;

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "HTTP " + res.status);
      }
      const data = await res.json();
      if (!data.text) throw new Error("空のレスポンス");
      setEditText(data.text);
    } catch (e) {
      setGenError("生成に失敗しました：" + e.message);
    }
    setGenerating(false);
  }

  function downloadCSV() {
    const header = "出席番号,所見文,文字数";
    const rows = students.map(s =>
      `${s.num},"${s.shoken.replace(/"/g, '""')}",${s.shoken.length}`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `所見_${new Date().toLocaleDateString("ja-JP").replace(/\//g, "")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyText() {
    navigator.clipboard.writeText(editText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const S = {
    card: { background: "white", border: "1px solid #e0e0e0", borderRadius: 12, padding: "16px" },
    label: { fontSize: 12, fontWeight: 600, color: "#666", marginBottom: 8 }
  };

  if (view === "setup") return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "32px 20px", fontFamily: "'Hiragino Sans','Yu Gothic',sans-serif" }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: "#1a2e20", marginBottom: 4 }}>通知表 所見サポート</div>
      <div style={{ fontSize: 13, color: "#888", marginBottom: 24 }}>中学校 3学期末 — クラスの設定をしてください</div>
      <div style={{ ...S.card, borderRadius: 14, padding: "24px", display: "flex", flexDirection: "column", gap: 22 }}>
        <div>
          <div style={S.label}>文字数制限</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {LIMITS.map(n => (
              <button key={n} onClick={() => setCharLimit(n)} style={{
                padding: "8px 18px", borderRadius: 20, cursor: "pointer", fontSize: 13, fontFamily: "inherit",
                border: charLimit === n ? "2px solid #1a3a2a" : "1px solid #ccc",
                background: charLimit === n ? "#1a3a2a" : "white",
                color: charLimit === n ? "white" : "#555", fontWeight: charLimit === n ? 700 : 400
              }}>{n}文字</button>
            ))}
          </div>
        </div>
        <div>
          <div style={S.label}>クラスの人数</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input type="number" min={1} max={50} value={count}
              onChange={e => setCount(Math.min(50, Math.max(1, +e.target.value || 1)))}
              style={{ width: 90, padding: "8px 12px", borderRadius: 8, border: "1px solid #ccc", fontSize: 15, fontFamily: "inherit" }} />
            <span style={{ fontSize: 13, color: "#888" }}>名（1〜50）</span>
          </div>
        </div>
        <button onClick={setupClass} style={{
          padding: "13px", borderRadius: 10, background: "#1a3a2a", color: "white",
          border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit"
        }}>クラスを作成して始める</button>
      </div>
    </div>
  );

  if (view === "list") {
    const done = students.filter(s => s.shoken).length;
    const total = students.length;
    const prog = Math.round((done / total) * 100);
    return (
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 20px", fontFamily: "'Hiragino Sans','Yu Gothic',sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#1a2e20" }}>通知表 所見サポート</div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 3 }}>文字数制限 {charLimit}文字 / {total}名</div>
          </div>
          <button onClick={() => { setStudents([]); setView("setup"); }} style={{
            padding: "6px 14px", borderRadius: 8, border: "1px solid #ccc", background: "white",
            fontSize: 12, cursor: "pointer", color: "#888", fontFamily: "inherit"
          }}>設定をやり直す</button>
        </div>
        <div style={{ ...S.card, padding: "16px 20px", marginBottom: 16, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#888", marginBottom: 6 }}>
              <span>進捗</span><span>{done} / {total}名 完了</span>
            </div>
            <div style={{ height: 6, background: "#eee", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: prog + "%", background: "#1a3a2a", borderRadius: 3, transition: "width 0.3s" }} />
            </div>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#1a3a2a", minWidth: 52, textAlign: "right" }}>{prog}%</div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button onClick={downloadCSV}
            disabled={students.every(s => !s.shoken)}
            style={{
              padding: "8px 18px", borderRadius: 8, fontSize: 13, cursor: "pointer",
              fontFamily: "inherit", fontWeight: 600,
              border: "1px solid #1a3a2a", background: "white", color: "#1a3a2a",
              opacity: students.every(s => !s.shoken) ? 0.4 : 1
            }}>
            CSV出力
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))", gap: 8 }}>
          {students.map(s => (
            <button key={s.num} onClick={() => openStudent(s.num)} style={{
              padding: "14px 8px", borderRadius: 12,
              border: s.shoken ? "1.5px solid #27ae60" : "1px solid #ddd",
              background: s.shoken ? "#eafaf1" : "white",
              cursor: "pointer", fontFamily: "inherit",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6
            }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#1a2e20" }}>{s.num}</div>
              <div style={{ fontSize: 10, color: s.shoken ? "#27ae60" : "#aaa" }}>{s.shoken ? "完了" : "未記入"}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const maxTraits = calcMaxTraits(charLimit);
  const reachedMax = traits.length >= maxTraits;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 20px", fontFamily: "'Hiragino Sans','Yu Gothic',sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button onClick={saveAndBack} style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid #ccc", background: "white", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>← 一覧</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "#888" }}>所見を書く</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#1a2e20" }}>{currentNum}番</div>
        </div>
        <button onClick={() => setEditingKeywords(v => !v)} style={{
          padding: "7px 16px", borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
          border: editingKeywords ? "2px solid #c0392b" : "1px solid #ccc",
          background: editingKeywords ? "#fdf0f0" : "white",
          color: editingKeywords ? "#c0392b" : "#555",
          fontWeight: editingKeywords ? 700 : 400
        }}>{editingKeywords ? "編集を終了" : "キーワード編集"}</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ ...S.card, ...(editingKeywords ? { borderColor: "#e88", borderWidth: 1.5 } : {}) }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={S.label}>特徴を選ぶ</div>
              {editingKeywords
                ? <span style={{ fontSize: 11, color: "#c0392b" }}>x で削除</span>
                : <div style={{ fontSize: 11, color: reachedMax ? "#c0392b" : "#aaa", fontWeight: reachedMax ? 700 : 400 }}>
                    {traits.length} / {maxTraits}個まで
                    {note.trim() && <span style={{ color: "#888" }}>（メモあり）</span>}
                  </div>
              }
            </div>
            {Object.entries(traitMap).map(([cat, list]) => (
              <div key={cat} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: "#aaa", fontWeight: 600, marginBottom: 6 }}>{cat}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {list.map(t => (
                    <Tag key={t} label={t}
                      active={traits.includes(t)}
                      onToggle={() => toggleTrait(t)}
                      editMode={editingKeywords}
                      onDelete={() => deleteKeyword(cat, t)}
                      disabled={!traits.includes(t) && reachedMax}
                    />
                  ))}
                  {list.length === 0 && <span style={{ fontSize: 11, color: "#ccc" }}>キーワードなし</span>}
                </div>
              </div>
            ))}
            {editingKeywords && (
              <div style={{ borderTop: "1px solid #f0e0e0", paddingTop: 14, marginTop: 6, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#c0392b" }}>+ キーワードを追加</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <select value={newKeywordCat} onChange={e => setNewKeywordCat(e.target.value)}
                    style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: "1px solid #ccc", fontSize: 12, fontFamily: "inherit", background: "white" }}>
                    {Object.keys(traitMap).map(cat => <option key={cat}>{cat}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={newKeyword} onChange={e => setNewKeyword(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addKeyword()}
                    placeholder="新しいキーワード"
                    style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: "1px solid #ccc", fontSize: 13, fontFamily: "inherit" }} />
                  <button onClick={addKeyword} style={{
                    padding: "7px 16px", borderRadius: 8, background: "#1a3a2a", color: "white",
                    border: "none", fontSize: 13, cursor: "pointer", fontFamily: "inherit", fontWeight: 700, whiteSpace: "nowrap"
                  }}>追加</button>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#888", marginTop: 4 }}>+ カテゴリを追加</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addCategory()}
                    placeholder="新しいカテゴリ名"
                    style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: "1px solid #ccc", fontSize: 13, fontFamily: "inherit" }} />
                  <button onClick={addCategory} style={{
                    padding: "7px 16px", borderRadius: 8, background: "#555", color: "white",
                    border: "none", fontSize: 13, cursor: "pointer", fontFamily: "inherit", fontWeight: 700, whiteSpace: "nowrap"
                  }}>追加</button>
                </div>
              </div>
            )}
          </div>
          <div style={S.card}>
            <div style={S.label}>エピソード・メモ（任意）</div>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              placeholder="体育祭でクラスをまとめた、数学が苦手だったが克服した、など…"
              rows={3} style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none", lineHeight: 1.7, boxSizing: "border-box" }} />
          </div>
          <button onClick={generate} disabled={generating} style={{
            padding: "13px", borderRadius: 10,
            background: generating ? "#aaa" : "#1a3a2a",
            color: "white", border: "none", fontSize: 15, fontWeight: 700,
            cursor: generating ? "not-allowed" : "pointer", fontFamily: "inherit"
          }}>{generating ? "生成中..." : "AIで所見を生成する"}</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ ...S.card, flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={S.label}>所見文</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: barColor }}>{charCount} / {charLimit}文字</div>
            </div>
            <div style={{ height: 4, background: "#eee", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: pct + "%", background: barColor, borderRadius: 2, transition: "width 0.2s" }} />
            </div>
            {genError && <div style={{ fontSize: 12, color: "#c0392b", background: "#fdf0f0", padding: "8px 10px", borderRadius: 6 }}>{genError}</div>}
            <textarea value={editText} onChange={e => setEditText(e.target.value)}
              placeholder="ここに所見文が入ります。直接入力・編集もできます。"
              rows={11} style={{ width: "100%", padding: "12px", borderRadius: 8, border: over ? "2px solid #c0392b" : "1px solid #ddd", fontSize: 15, fontFamily: "inherit", resize: "vertical", outline: "none", lineHeight: 2, boxSizing: "border-box" }} />
            {over && <div style={{ fontSize: 12, color: "#c0392b" }}>あと {charCount - charLimit}文字削ってください</div>}
          </div>
          <button onClick={saveAndBack} style={{ padding: "12px", borderRadius: 10, background: "#1a3a2a", color: "white", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>保存して一覧へ</button>
          <button onClick={copyText} style={{ padding: "10px", borderRadius: 10, background: "white", color: "#555", border: "1px solid #ccc", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{copied ? "コピーしました" : "テキストをコピー"}</button>
        </div>
      </div>
    </div>
  );
}
