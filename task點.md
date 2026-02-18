# AI 行動邏輯分析（目前版本）

## 主要程式位置
- `src/hooks/useGameAI.ts`
- `src/hooks/usePlayerActions.ts`（`attemptMove`、`handleActionComplete`）
- `src/gameInit.ts`（PvE 開局自動配置）

## 目前 AI 決策流程
1. **觸發條件**：僅在 `gameMode === 'pve'`、`currentPlayer === P2`、且 `gameOver === false` 時啟動（`useGameAI.ts:21-24`）。
2. **回合節奏**：每次觸發後延遲 1 秒執行一次 AI（`useGameAI.ts:75`）。
3. **單位選擇**：從 P2 所有「存活且尚未行動」單位中隨機選一隻（`useGameAI.ts:28, 36`）。
4. **行為選擇**：
   - 60% 嘗試移動（`useGameAI.ts:39`）
   - 40% 直接結束該單位行動（`useGameAI.ts:72`）
5. **移動策略**：
   - 只考慮上下左右四方向（`useGameAI.ts:42-44`）
   - 以「到 P1 旗幟的曼哈頓距離」選最短方向（`useGameAI.ts:41, 46-57`）
   - 計算移動能量後呼叫 `attemptMove`（`useGameAI.ts:65-67`）
6. **回合推進**：行動完成透過 `handleActionComplete` 切換到下一位可行動單位或下一玩家（`usePlayerActions.ts:345-498`）。

## PvE 開局 AI 預配置
- 進入 `pve/sandbox` 時，P2 會：
  - 將非將軍單位（index 1~4）隨機交換位置 10 次（`gameInit.ts:170-179`）
  - 在右半區隨機放置 3 顆普通地雷（`gameInit.ts:180-200`）

## 我發現的關鍵問題（高優先）
1. **AI 計時器會被頻繁重設，可能導致 AI 幾乎不出手**  
   `useEffect` 依賴中包含整個 `gameState`（`useGameAI.ts:95`）。而 `timeLeft` 每 100ms 更新一次（`useGameLoop.ts:84-88`），會反覆清掉 1 秒 timeout（`useGameAI.ts:77`）再重設，造成 AI timeout 很難真正觸發。

2. **移動失敗時不會補救，AI 可能原地卡住直到倒數結束**  
   `attemptMove` 若遇到障礙、佔位、能量不足、能量上限等會直接 `return`（`usePlayerActions.ts:560-578`）。
   目前 AI 在 `attemptMove(...)` 後直接 `return`（`useGameAI.ts:67-68`），若這步失敗，沒有改走其他格或改為 `handleActionComplete`，可能造成該 AI 單位遲遲不結束動作。

3. **路徑評估未先過濾不可走格**  
   AI 在選最佳方向時只看邊界與距離（`useGameAI.ts:49-57`），未先排除障礙、單位佔位、地雷風險、特殊區域等，導致常選到「理論變近但實際無法移動或很虧」的位置。

## 中優先觀察
- AI 目前只有「走一步 / 跳過」兩種行為，未使用攻擊、拆雷、放雷、技能、旗幟策略。
- 40% 跳過會觸發被動補血（若未移動且未耗能，+3 HP，`usePlayerActions.ts:407-414`），可能讓 AI 行為看起來更保守且隨機。
- 決策無記憶（無 threat map、無目標優先級、無長路徑），同局內表現波動大。

## 總結
目前 AI 屬於「隨機單位 + 單步趨旗」的極簡版本；最大風險不是弱，而是**可能因 effect 依賴與失敗分支處理不足而卡行為**。建議先修正「timeout 重設」與「移動失敗 fallback」，再進階到戰術層（攻擊/技能/目標評分）。

## 本輪已處理（2026-02-05）
- 已修正 `useGameAI` 依賴設計，移除「整個 gameState 造成 timeout 一直重設」問題，改為只在關鍵狀態變化時觸發。
- 已加入 AI 移動候選格檢查：邊界、障礙、佔位、能量、能量上限（cap）。
- 已加入移動失敗 fallback：若第一候選失敗會依序嘗試其他候選，最終仍失敗則自動 `handleActionComplete`，避免卡住。
- 已加入簡易風險評分（敵方地雷、核雷鄰域、麒麟領域入場）作為路徑排序依據。
- 已鎖定 PvE 的 P2（AI 回合）玩家輸入，避免人類誤操作 AI 單位；AI 反應延遲由 1 秒降到 450ms。

## AI 升級進度（Step 1 / Step 2 啟動）
- 已建立 `src/ai/` 模組骨架：`types.ts`、`config.ts`、`evaluator.ts`、`generator.ts`、`selector.ts`、`executor.ts`。
- `useGameAI` 已改為調度層：讀 state → 產生候選 → 選擇 → 執行 → 失敗 fallback。
- 已接入 `AIDifficulty`（目前預設 `normal`）與 action 映射（move/attack/scan/place/disarm/旗幟/結束）。
- 第一層「選單位評分」已啟用（攻擊機會、旗幟壓力、生存、能量效率 + 難度權重）。
- Step 2：行為評分強化完成（攻擊使用實際傷害/擊殺預估；carry 旗幟時移動收益提高；end_turn 降權）。
- Step 3：目標選擇強化完成（移動風險加入鄰敵威脅；放雷/拆雷目標排序；移動/放雷候選限制前幾名）。
- Step 4：技能擴展 + 難度差異化完成（掃描目標自動挑選；放雷依類型策略；拆雷依威脅排序；mine type 支援）。
- Step 5：打磨完成（AI debug 可開關輸出；決策摘要輸出；思考節奏維持 200–500ms）。
- Step 6：難度 UI 完成（Lobby 可選 Easy/Normal/Hard；i18n 文案新增）。
- Step 7：穩定性/策略打磨完成（決策 budget、動作優先級調整、旗幟丟放風險評估）。
- 後續擴充：AI 決策可視化完成（等待區顯示 AI 當前決策、目標與評分摘要）。
- 追加：AI 思考時間改為依行為複雜度與候選數動態延長，讓決策可視化更好觀看。
- 開發者工具：PvE 加入 DevTools（AI 難度/Debug 切換與決策摘要）。

## 下一階段：讓 AI 更能抗衡玩家、且更像人類（追加提案）

### P0（優先做，難度提升最大）
1. **二步前瞻搜尋（Top-K Beam）**
   - 目前多為單步評分，建議在 `Hard` 模式加入「我方一步 -> 敵方最佳反制 -> 我方回應」的淺層搜尋。
   - 只保留每層前 K 個高分候選（例如 K=3）避免爆算；超時直接退回現行啟發式。
   - 效果：顯著減少「剛走上去就被反打」與無意義換血。

2. **全域威脅地圖（Threat Map）**
   - 每回合預先計算每格的危險值：敵方可達、可攻擊、地雷爆發範圍、旗區壓力。
   - 將威脅地圖同時餵給 `move/scan/place_mine/disarm` 的評分，而非分散在個別規則。
   - 效果：路徑選擇更一致，避雷與保命明顯提升。

3. **回合意圖系統（Intent）**
   - 每個 AI 回合先決定「主意圖」：`推旗`、`狙殺持旗者`、`控雷區`、`保命重整`。
   - 同一回合內行為分數都套用同一意圖加權，避免「這步想進攻、下一步又亂跑」。
   - 效果：行為連貫度更像真人，不會抖動。

4. **能量規劃器（Energy Planner）**
   - 在評分前預留戰術能量（例如保留攻擊/拆雷成本），避免把能量全花在低價值移動。
   - 加入「連招價值」：本回合動作是否提高下回合關鍵技能成功率。
   - 效果：中後盤壓制力變強，少見空耗回合。

### P1（提升「人類感」與對局體感）
5. **角色分工與陣型模板**
   - 為 General/Maker/Sweeper/Defuser 定義標準職責與站位區（前壓、側翼、後勤）。
   - 效果：AI 不會所有單位都做同一件事，觀感更像有戰術分工。

6. **玩家風格適應（Opponent Modeling）**
   - 記錄近 N 回合玩家偏好：愛衝旗、愛埋雷、保守換血等，動態調整對應權重。
   - 效果：對同一玩家會越打越有針對性，而非固定套路。

7. **有限度的「假動作」**
   - 在高分接近時，低機率選擇次佳策略（例如先掃描再包夾），模擬真人試探。
   - 僅在不明顯虧損時啟用，避免故意送頭。
   - 效果：減少機械感，提高可讀性與對抗樂趣。

### P2（強度上限與可維護性）
8. **開局庫與局面模板**
   - 建立 5~10 組開局策略（壓旗、控中、雷區封鎖），按地圖與對手行為切換。
   - 效果：前 5 回合不再隨機，強度穩定大幅提升。

9. **終局專用策略（Endgame Policy）**
   - 當場上單位少、旗幟接近決勝時，切換到終局權重（持旗保命 > 換血 > 其他）。
   - 效果：減少「大優勢被翻盤」。

10. **自動化對戰校準（Self-play + Weight Tuning）**
   - 離線跑 AI vs AI / AI vs 固定腳本，統計勝率與行為分布，微調權重。
   - 效果：可持續調參，不靠手感改數字。

## 建議驗收指標（新增）
- `Hard` 對 `Normal` 勝率 >= 65%（固定種子 200 局）。
- 面對「衝旗型腳本玩家」防守成功率 >= 60%。
- 高風險格（Threat 高分）踩入比例較目前版下降 >= 40%。
- 同局連續 3 回合內，AI 主意圖一致率 >= 70%（可從 debug log 驗證）。
- 決策耗時維持：平均 < 300ms，P95 < 800ms（超時自動 fallback）。

## 實作順序（建議）
1. 先做 Threat Map + Intent（P0-2, P0-3），這兩項對「像人」與強度都最有感。
2. 再上二步前瞻（P0-1），只在 `Hard` 啟用並加 budget 保護。
3. 接著補 Energy Planner（P0-4）與角色分工（P1-5）。
4. 最後做玩家適應與開局/終局模板（P1-6, P2-8, P2-9）。

## P0 進度（2026-02-17）
- 已實作 **Threat Map**：新增 `src/ai/context.ts`，每回合生成全域風險圖（敵方單位壓力、將軍射線、地雷/核雷風險），並接入行為評分。
- 已實作 **Intent 系統**：新增 `push_flag / hunt_flag_carrier / control_mines / stabilize` 四種回合意圖，並套用到 unit/action 評分偏置。
- 已實作 **Energy Planner（reserve energy）**：依難度與意圖保留戰術能量，避免低價值行為把能量全花掉。
- 已實作 **二步前瞻（Top-K Beam, 兩層模擬）**：對 top actions 進行「我方動作 -> 敵方最佳回應 -> 我方最佳後續」快速模擬，並以 `lookaheadScore` 重排，降低送頭與無效換血。
- 已將前瞻資訊接入 PvE DevTools：可看到 `Intent` 與 `Beam` 分數，方便你驗收與調參。

## P1 進度（2026-02-17）
- 已實作 **角色分工與陣型模板**：新增 `src/ai/roles.ts`（striker/flanker/controller/scout/support），依單位類型與當前 intent 指派角色，並在 unit 評分加入陣型站位獎懲。
- 已實作 **玩家風格適應（Opponent Modeling）**：新增 `src/ai/opponentModel.ts`，追蹤 `aggression / flagRush / minePressure`，並回饋到 intent 判斷與 action 評分偏置。
- 已實作 **有限度假動作（Feint）**：在分數接近、符合冷卻且非關鍵收手行為時，低機率採用次佳策略，避免 AI 過度機械化。
- 已在 PvE DevTools 顯示 feint 狀態（`Feint: YES/NO`）與來源排名，便於對局驗收與觀察人類化行為。
- 已追加 **玩家熱點路徑建模（Hotspots）**：Opponent model 會記錄玩家近期常出現格位（含衰減），並影響 scan/place_mine/disarm/move 目標評分。
- 已追加 **角色影響行為層評分**：不同角色在 move 目標上有明確偏好（前壓、側翼、控中、護旗），不再只影響選單位階段。
- 已強化 **Feint 安全門檻**：改為從前幾名候選中挑「分差可接受 + 安全不明顯下降」動作，避免假動作變成送頭。
- 已在 DevTools 顯示 `Role` 與對手模型快照（A/F/M），可直接驗收 AI 是否真的在「讀玩家行為」。
- 已加入 **P1 調參檔（Tuning Profiles）**：新增 `aggressive / balanced / conservative` 三組配置（攻擊性、保守度、前瞻權重、假動作幅度）。
- 已在 DevTools 提供 **一鍵切換調參檔**：ATK / BAL / SAFE 按鈕可即時切換，不需重開對局。
- 已讓調參檔影響完整決策鏈：`unit/action 評分`、`reserve energy`、`lookahead counter/followup`、`feint 機率與分差門檻` 都會隨 profile 改變。

## P2 進度（2026-02-17）
- 已實作 **開局庫（Opening Book）**：新增 `src/ai/opening.ts`，提供 `center_break / lane_pressure / mine_screen / scout_probe / fortress / flag_spear` 六種開局模板，並會依難度、調參檔、對手模型與地圖中線障礙自動選擇。
- 已實作 **開局策略鎖定**：AI 在前 6 回合固定使用選定開局模板（中後期自動解除），避免開局抖動導致策略斷裂。
- 已實作 **終局策略（Endgame Policy）**：新增 `src/ai/endgame.ts`，識別 `race / defense / attrition` 三種終局模式與 urgency，並回饋到 unit/action 評分。
- 已將 **開局/終局狀態接入決策鏈**：`buildAIPlanningContext` 會同時提供 opening/endgame 給 evaluator；feint 在高壓終局會自動降頻，避免關鍵回合做花式虧損。
- 已在 DevTools 顯示 `Opening` 與 `Endgame(urgency)`，可直接觀察 P2 行為切換是否合理。

## P2 補強進度（2026-02-17 晚間）
- 已補上 **AI 進化樹行動**：AI 可產生並執行 `evolve_a / evolve_b / evolve_a_1 / evolve_a_2 / evolve_b_1 / evolve_b_2`，門檻與能量規則對齊目前遊戲邏輯。
- 已補上 **AI 感測掃描行動**：AI 可使用 `sensor_scan`，並納入評分、優先序與思考節奏。
- 已補上 **決策鏈全接線**：`types -> generator -> evaluator -> selector -> executor -> useGameAI` 全鏈路已接好，非僅停在候選生成。
- 已補上 **lookahead 對進化動作投影**：前瞻模擬不再把進化視為「無狀態改變」。

## 我判斷目前仍有缺失（更新：P0 已完成首輪）
### P0（2026-02-17 已完成首輪落地）
1. **AI 行動覆蓋率**：已補齊 `place_tower / place_factory / place_hub / teleport / detonate_tower / throw_mine / pickup_mine / drop_mine / move_mine / convert_mine`，並接入 `generator -> evaluator -> selector -> executor` 全鏈路。
2. **前瞻模擬擴充**：lookahead 已加入上述進階技能投影，並補上建築上限、傳送道標消耗、搬雷傷害、旗幟掉落位置等狀態變更。
3. **戰術保底規則**：已加入 hard constraints（必保旗場景、將軍殘血避險、可擊殺優先收頭，含 attack/throw_mine/detonate_tower/move_mine 變體）。

### P1（品質與穩定度缺口，2026-02-17 更新）
4. **固定場景回歸測試仍需擴題庫**  
   已有 4 題核心情境與 `npm run test:ai`，下一步是擴到 20+ 題關鍵局面（防守、搶旗、終局）。
5. **可觀測性已補齊核心欄位，仍可擴深度診斷**  
   目前已有 `Top-K (Scored/Final)` 與 `ENERGY/RISK/RULES` 淘汰統計，後續可補單一候選的完整淘汰鏈路。
6. **前瞻仍有可精算空間**  
   目前已補核心技能互動，但像推擠、地雷連鎖、核雷/煙霧等複合效果仍可再貼近實戰規則。

## P3（2026-02-17 新增）：工程化與可驗證性
11. **建立 AI 基準對戰器（Benchmark Harness）**  
   - 固定 random seed、固定地圖批次跑 `AI vs AI / AI vs script`，輸出勝率、平均回合數、爆雷率、持旗存活率。
   - 目標：每次調參後 5 分鐘內可知道是否退化。

12. **建立戰術題庫回歸（Scenario Regression Suite）**  
   - 準備 20~50 個關鍵盤面（防守、搶旗、雷區、終局），檢查 AI 是否做出預期前 1~3 名行動。
   - 目標：防止「修了一處，壞了另一處」。

13. **決策追蹤輸出（Decision Trace Export）**  
   - 每回合輸出 `intent/role/opening/endgame/topK/最終選擇/理由` 到 JSON。
   - 目標：能離線重播與分析，減少只能靠肉眼看動畫除錯。

14. **權重自動微調流程（Auto Tuning）**  
   - 對 `AI_INTENT_ACTION_BONUS / AI_ROLE_ACTION_BONUS / tuning profile` 建立小步搜尋（網格或貝葉斯）。
   - 目標：調參從「手感」轉成「有數據的迭代」。

15. **版本化 AI Profile（可回滾）**  
   - 將每組權重配置打版本號（如 `v0.9.3`），保留可回滾機制。
   - 目標：比賽/發版時可以鎖定穩定 AI，不被實驗配置污染。

## P1 補強進度（2026-02-17 晚間）
- 已建立 **固定場景回歸測試**：`src/ai/__tests__/regression.test.ts` 已擴充到 **17 題**，覆蓋選單位、攻擊優先、避險走位、低能量拒絕、旗幟防守、終局模式、傳送互動（含阻擋/跨職業）、雷控技能（引爆塔/丟雷/搬雷/轉雷）與鏈雷評分。
- 已新增 **AI 測試指令**：`npm run test:ai`，可在調參後快速驗證是否回歸。
- 已升級 **DevTools 可觀測性**：新增 `Top-K (Scored)` 與 `Top-K (Final)`，可直接對比排序變化。
- 已新增 **淘汰原因摘要**：顯示 `ENERGY / RISK / RULES` 三類被淘汰原因與次數，便於快速定位「為何沒選某行為」。
- 已把上述診斷資訊接入 `AIDecisionInfo` 與 `useGameAI`，同步支援 console debug 與 UI 面板檢視。
