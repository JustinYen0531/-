📡 地雷棋：區域網路連線功能開發規格書 (Spec)
1. 技術環境與目標

前端框架：React + Vite + TypeScript (現有架構)。

連線目標：實現區域網路 (LAN) 內的雙人即時對戰。

核心挑戰：在不架設中心伺服器的情況下，讓兩台電腦互相識讀。

2. 連線方案建議 (請 AI 評估選一)

方案 A (PeerJS/WebRTC)：最推薦。不需後端，透過瀏覽器直接 P2P 連線，適合區域網路，延遲最低。

方案 B (Socket.io + 輕量 Node.js Server)：穩定性高，但需要啟動一個簡單的轉發伺服器。

3. 需要設計的模組 (Modules)

連線管理器 (Connection Manager)：

產生唯一的 Room ID 或 Peer ID。

輸入對方 ID 即可建立連線（Handshake）。

通訊協定 (Protocol)：

定義 ActionPacket 格式：包含玩家移動、插旗、地雷觸發、進化選擇。

同步機制 (Sync Logic)：

確定「主機 (Host)」與「客機 (Guest)」身分。

採用「事件驅動同步」：僅傳輸操作指令，不傳輸整個棋盤狀態，以節省頻寬。

4. 階段性開發任務

Phase 1：建立連線 UI（顯示自己的 ID、輸入框、連線按鈕）。

Phase 2：測試文字傳輸（確認兩台電腦能互相傳送 "Hello World"）。

Phase 3：遊戲邏輯串接（將現有的 handleMove 函數封裝進傳輸套件）。

Phase 4：異常處理（連線斷開後的恢復機制）。
