# UI Annotator MCP

[![npm version](https://img.shields.io/npm/v/@mcpware/ui-annotator)](https://www.npmjs.com/package/@mcpware/ui-annotator)
[![license](https://img.shields.io/github/license/mcpware/ui-annotator-mcp)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/mcpware/ui-annotator-mcp?style=social)](https://github.com/mcpware/ui-annotator-mcp)
[![GitHub forks](https://img.shields.io/github/forks/mcpware/ui-annotator-mcp?style=social)](https://github.com/mcpware/ui-annotator-mcp/fork)

[English](README.md) | **廣東話**

**Hover 任何 element 就睇到佢叫咩名 — 任何 browser，零 extension。**

一個 MCP server，幫任何網頁加上互動式 hover 標註。開個 proxy URL，hover 任何 element，即刻見到佢個名。同你嘅 AI 助手講「將 `sidebar` 整闊啲」— 佢即刻知你講邊個。

![Demo](docs/demo.gif)

## 問題

同 AI coding 助手改 UI 嘅時候，最難嗰part唔係改 code — 而係**形容你想改邊個 element**。

> 「左邊嗰個嘢...第二行...唔係，有個 icon 嗰個...」

你唔知佢叫咩名。AI 唔知你指緊邊個。你浪費時間喺溝通上而唔係 shipping。

## 解決方案

用 annotator proxy 開你個 page。Hover 任何 element — 即刻見到佢個名、CSS selector、尺寸。而家你同 AI 講同一種語言。

```bash
# Add 落 Claude Code
claude mcp add ui-annotator -- npx @mcpware/ui-annotator

# 開任何 browser
# http://localhost:7077/localhost:YOUR_PORT
```

**搞掂。** 零 extension。零 code 改動。零 setup。Chrome、Firefox、Safari、Edge — 任何 browser 都得。

## 功能

### Hover 標註
Hover 任何 element 睇到：
- **Element 名**（粉紅色）— 人類可讀嘅識別名
- **CSS selector**（等寬字）— 技術參考
- **內容預覽** — element 入面嘅文字
- **尺寸** — 闊 × 高 (px)

### Inspect Mode
撳 toolbar 嘅 **Inspect** 掣：
- Click 任何 element → **複製佢個名去 clipboard**
- 所有頁面互動暫停（click 唔會觸發按鈕/link）
- 再撳 Inspect 返回正常模式

### MCP 工具
| 工具 | 做咩 |
|------|------|
| `annotate(url)` | 回傳 proxy URL 畀用戶喺任何 browser 開 |
| `get_elements()` | 回傳所有偵測到嘅 UI elements（名、selector、位置） |
| `highlight_element(name)` | 閃爍特定 element 畀用戶確認 |
| `rescan_elements()` | 頁面改咗之後強制重新掃描 DOM |
| `inspect_mode(enabled)` | 遠程切換 inspect mode |

## 點解唔直接用 DevTools？

| | DevTools | UI Annotator |
|---|---|---|
| **對象** | 識 DOM 嘅 frontend dev | 任何人 — QA、PM、設計師、junior |
| **學習成本** | 要識 DOM tree、CSS selector、box model | Hover 就睇到 — 零學習 |
| **溝通** | 「`div.flex.gap-4` 入面第二個 child 嗰個...」 | 「個 `sidebar`」 |
| **AI 整合** | 冇 — AI 睇唔到你 inspect 緊咩 | MCP — AI 見到同你一樣嘅 element 名 |

**DevTools 係做 debugging 嘅。** UI Annotator 係做**溝通**嘅 — 畀人同 AI 有共同嘅 UI 詞彙。

## 更多 @mcpware 產品

| 產品 | 做咩 | 安裝 |
|------|------|------|
| **[Pagecast](https://github.com/mcpware/pagecast)** | 錄低任何 browser page 做 GIF 或影片 | `npx @mcpware/pagecast` |
| **[Claude Code Organizer](https://github.com/mcpware/claude-code-organizer)** | 視覺化 dashboard 管理 memories、skills、MCP servers | `npx @mcpware/claude-code-organizer` |
| **[Instagram MCP](https://github.com/mcpware/instagram-mcp)** | 23 個 Instagram Graph API 工具 | `npx @mcpware/instagram-mcp` |

## 授權

MIT
