# 儲蓄互助社 智慧法催公文助手與 5 年時效到期鬧鐘

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Cloudflare Pages](https://img.shields.io/badge/Deploy-Cloudflare%20Pages-orange?logo=cloudflare)](https://cu-legal-assistant.pages.dev/)
[![GitHub Repo](https://img.shields.io/badge/GitHub-cu--legal--assistant-181717?logo=github)](https://github.com/rock903400-byte/cu-legal-assistant)

> 專為儲蓄互助社量身打造的**「純前端本地運算・零個資外洩・司法院標準訴狀」**智慧法催公文助手、115 年扣薪試算、股金抵銷與 5 年時效到期鬧鐘系統。

🔗 **線上正式版網址**：[https://cu-legal-assistant.pages.dev/](https://cu-legal-assistant.pages.dev/)

---

## 🌟 核心功能特色

### 1. 💰 強制執行薪資扣押計算機（115 年度最新衛福部標準）
- 依據《強制執行法》第 115 條之 1、第 122 條。
- 內建 115 年度全台各縣市最低生活費標準（台北 20,744、新北 17,750、桃園 17,186、台中 16,431、台南 15,515、高雄 16,970、台灣省各縣市 15,515、金門連江 15,173）。
- **實質生活費扣除與負數防呆**：
  - 生活必需支出 = `最低生活費 × 1.2 × (1 + 扶養人數 × 負擔比例)`。
  - 可扣押金額上限 = `Math.min(月薪 × 1/3, Math.max(0, 月薪 - 生活必需支出))`。
  - 當月薪不足以保障生活費時，自動警示「無執行實益，免予扣押」。

### 2. ⚖️ 6 種法催公文一鍵產出
公文格式與措辭依實務使用的範本（見 `附件/`）整理，涵蓋「存證信函催告 → 支付命令 → 確定證明書 → 強制執行 → 債權憑證」整條主線。
- **一、催告（郵局存證信函）**：
  1. 《存證信函》清償債務催告（內容沿用附件原文，含副本收件人）
  2. 《存證信函》股金扣除貸款通知（**限已進入執行階段**；引用本社章程條次）。尚未進入執行階段時，寄「清償債務催告」即可。股金扣除貸款的依據是各社自訂的**本社章程**，《儲蓄互助社法》第 14 條規範的是退股程序，並無抵銷規定，系統不引用；章程條次請在「本社資料設定」填寫
  - 填入「送達日」自動計算民法第 130 條 6 個月起訴期限，並可下載 .ics 鬧鐘；另提供郵局用紙（每行 20 字、每頁 10 行）頁數試算與逐行抄寫稿。
- **二、司法訴訟與執行程序**：
  3. 《民事支付命令聲請狀》（民事訴訟法第 508 條）— 支援違約金按利息百分之 N 計算、利率經理事會決議調整、以切結書為憑、債務人死亡（繼承人於遺產範圍內連帶）、多位連帶保證人
  4. 《聲請支付命令確定證明書狀》（民事訴訟法第 521 條第 2 項、第 399 條第 1 項及第 4 項）
  5. 《民事強制執行聲請狀》— 單一書狀，勾選標的後自動補上各標的的第三人當事人、措辭與證物：銀行存款（可指名多家銀行）、函詢郵局存款、薪資（扣 1/3 並按月移轉，自動帶入該區「最低生活費 × 1.2」金額）、查調勞保投保單位、壽險解約金（依 2025 年保險法修正，限解約金逾 §123-1 額度者；健康險、傷害險不得扣押）、股票（集保）、動產與車輛、國稅局查調、不動產
  6. 《民事聲請核發／換發債權憑證狀》（強制執行法第 27 條；執行名義為債權憑證時寫成「換發」，為支付命令或判決時寫成首次「核發」；聲請原因可選「查無財產」或「債務人已離職」，並支援債務人死亡）
- **輸出格式**：支援標準 Word (.doc) 檔匯出、A4 列印、純文字下載與一鍵複製。

### 3. 🛡️ 法律防呆與時效警戒機制
- **未填欄位一律以「○」標示**：書狀不會以預設的假姓名、假案號、假日期代填；本社資料取自「本社資料設定」，尚未設定時顯示「○○縣○○儲蓄互助社」。
- **民法第 205 條 16% 上限防呆**：輸入利率逾 16% 即時提示超過部分無效。
- **民法第 130 條 6 個月起訴期限**：存證信函催告後 6 個月內須起訴或聲請支付命令。
- **民事訴訟法第 515 條 3 個月送達失效**：支付命令核發後 3 個月內不能送達債務人即失其效力。

### 4. ⏰ 5 年預警鬧鐘與 KPI 警戒看板
- **時效依據**：利息請求權時效 5 年（《民法》第 126 條）、本金 15 年（第 125 條）。本系統以**債權憑證核發日起 5 年**為預警日，提醒在利息時效屆滿前換證；5 年是保守的預警設計，並不代表本金 5 年即失效。
- **時效 KPI 統計看板**：總案件數、🔴 90天內緊急換證、🟡 180天內預警、🟢 安全期、⚫ 已逾 5 年預警日。
- **📅 一鍵匯出 `.ics` 行事曆鬧鐘**：可直接匯入 Google Calendar / Outlook / Apple 日曆，內建**「到期前 6 個月」、「到期前 3 個月」、「到期前 1 個月」自動推播鬧鐘提醒**。
- **⚖️ 一鍵連動換證**：在台帳中點擊「一鍵換證」，自動將該案件案號與債權金額帶入《換發債權憑證聲請狀》。
- **📊 資料備份與還原**：支援 Excel 相容之 CSV 台帳清冊匯出、JSON 全量備份與還原。

### 5. 📱 早期溫情關懷話術（逾期 1~2 個月）
- 依催收實務「逾期 1~2 個月宜及早關懷協調」設計（為實務經驗，並非特定法規條文）。
- 一鍵生成「同理心關懷型」、「展延分期協商型」、「幹部正式提醒型」電訪腳本與 3 種 LINE/簡訊文案。

### 6. 🔒 100% 本地離線安全與草稿自動儲存 (Auto-save)
- 採用 **Client-side Rendering（純前端本地運算）** 與 `LocalStorage` 離線儲存。
- 表單即時自動儲存草稿，重新整理不遺失。
- 借款人姓名、身分證字號、債權金額與法院案號等機敏資料，**絕不回傳或儲存於任何外部伺服器**。

---

## 🚀 快速開始

### 1. 線上直接使用
直接開啟 [https://cu-legal-assistant.pages.dev/](https://cu-legal-assistant.pages.dev/) 即可使用。

### 2. 本機執行
```bash
cd cu-legal-assistant
npm start          # 於 http://localhost:3000 啟動本機靜態伺服器
```

### 3. 執行測試
```bash
npm test                      # 核心運算單元測試（含法定期限迴歸測試）
node tests/test-full-e2e.js   # 全端邏輯驗證
```

> CI 會在每次 push 與 PR 執行上述兩組測試；測試通過後，push 到 `main` 才會部署 **GitHub Pages 鏡像站**（見 `.github/workflows/deploy.yml`）。正式站需另行手動部署，見下方「部署」。

### 4. 部署
- **正式站**：Cloudflare Pages 專案 `cu-legal-assistant`（[cu-legal-assistant.pages.dev](https://cu-legal-assistant.pages.dev/)）。它是「**直接上傳**」型專案，**沒有連結 Git，合併或推送到 `main` 不會自動部署**，必須依下方步驟手動上傳。
- **鏡像站**：GitHub Pages（`rock903400-byte.github.io/cu-legal-assistant`），由 `.github/workflows/deploy.yml` 於測試通過後自動部署（僅 push 到 `main` 時）。

#### 手動部署正式站

務必**從乾淨 clone 部署**，並只上傳網站需要的檔案。不要在工作資料夾直接執行 `wrangler pages deploy .`，否則會把未版控的檔案（例如 `附件/` 內部範本）、`tests/`、`.github/` 一併公開。

```bash
# 1. 從 GitHub 取得乾淨的 main，並先跑測試
git clone https://github.com/rock903400-byte/cu-legal-assistant.git deploy-src
cd deploy-src
npm test && node tests/test-full-e2e.js

# 2. 只複製網站需要的檔案（index.html、css/、js/）
mkdir ../site
cp -r index.html css js ../site/

# 3. 登入 Cloudflare（首次或登入過期時），再上傳到 Production
npx wrangler login
npx wrangler pages deploy ../site --project-name cu-legal-assistant --branch main --commit-hash $(git rev-parse HEAD)

# 4. 部署完成後可登出
npx wrangler logout
```

部署後建議確認：
- 正式站的檔案與 `main` 逐字一致（例如用 `curl -sL` 取回後比對雜湊；注意 `/index.html` 會轉址到 `/`，需跟隨轉址）。
- `npx wrangler pages deployment list --project-name cu-legal-assistant` 最新一筆為 `Production`、分支 `main`、提交編號為剛部署的版本。

**還原**：Cloudflare 後台 → Workers & Pages → `cu-legal-assistant` → Deployments → 選擇先前的部署 → *Rollback to this deployment*。

> **注意**：台帳、本社資料與草稿存在使用者**瀏覽器的 localStorage**，依「網址」分開保存。請勿要求同仁改用鏡像站或其他網址，否則會看到一個空的台帳。更新版本後，請同仁按一次 Ctrl+F5 重新整理；原有資料不受影響。

---

## 📂 專案結構

```text
cu-legal-assistant/
├── .github/workflows/deploy.yml  # CI 測試門檻 + GitHub Pages 自動部署工作流
├── css/
│   ├── style.css                 # 系統視覺樣式（海軍藍 #0F2942 專業風格、卡片式 RWD、KPI 看板）
│   └── print.css                 # 司法院 A4 標準訴狀列印樣式
├── js/
│   ├── config.js                 # 介面功能開關（決定顯示哪些分頁與公文種類）
│   ├── court-data.js             # 全台 22 所地方法院管轄行政區對照庫
│   ├── core-legal.js             # 法律核心算法（中文大寫、時效天數、16%利率防呆、規費計算）
│   ├── salary-calc.js            # 115年強制執行薪資扣押計算機（最低生活費1.2倍與負數防呆）
│   ├── templates.js              # 6 種法催公文範本庫（存證信函、支付命令、確定證明書、強執、債權憑證、股金抵銷等）
│   ├── scripts.js                # 早期催收話術與 LINE 文案庫
│   ├── storage.js                # LocalStorage 本地台帳管理、草稿自動儲存、Word匯出與 .ics 鬧鐘
│   └── app.js                    # 主控制器與 UI 互動邏輯
├── tests/
│   ├── test-core.js              # 核心運算單元測試（含法定期限、逸出處理迴歸測試）
│   └── test-full-e2e.js          # 全端深度邏輯驗證
├── index.html                    # 系統主入口頁面
├── package.json                  # 專案設定檔
├── LICENSE                       # MIT License
└── README.md                     # 專案說明文件
```

---

## ⚙️ 介面功能開關

系統預設呈現**法催主線**：存證信函催告 → 支付命令 → 確定證明書 → 強制執行 → 換發債權憑證。

其餘功能（早期關懷話術、法規問答、頂部情境卡片）的**程式碼與版型都完整保留在專案中**，僅由 `js/config.js` 決定是否顯示 —— 改清單即可隨時開回來，不需改動其他檔案。

```js
// js/config.js
const APP_CONFIG = {
  ENABLED_TABS: ['tab-docs', 'tab-salary', 'tab-statute'],
  ENABLED_DOC_TYPES: ['payment_order', 'payment_order_final', 'execution', 'renew_cert',
                      'demand_letter', 'offset_letter'],
  SHOW_SCENARIO_NAV: false
};
```

| 開關 | 作用 |
|---|---|
| `ENABLED_TABS` | 要顯示的分頁；順序即畫面順序，第一個為預設開啟的分頁 |
| `ENABLED_DOC_TYPES` | 公文種類下拉可選的項目；空掉的分組標題會自動移除 |
| `SHOW_SCENARIO_NAV` | 頂部 4 張情境導航大卡片 |

完整功能的設定值寫在 `js/config.js` 的檔頭註解中，直接貼回即可恢復全部 5 分頁與 6 種公文。

---

## 📄 授權條款

本專案採用 [MIT License](LICENSE) 授權。
