/**
 * 本地儲存、台帳管理與行事曆 .ics 檔案生成 (storage.js)
 * 100% 本地 LocalStorage 儲存，零個資外洩
 */

let _calculate5YearExpiry = typeof calculate5YearExpiry !== 'undefined' ? calculate5YearExpiry : null;

if (typeof require !== 'undefined') {
  try {
    const core = require('./core-legal');
    if (core) {
      _calculate5YearExpiry = _calculate5YearExpiry || core.calculate5YearExpiry;
    }
  } catch (e) {}
}

function calculate5YearExpiryHelper(dateStr) {
  if (_calculate5YearExpiry) return _calculate5YearExpiry(dateStr);
  if (typeof calculate5YearExpiry === 'function') return calculate5YearExpiry(dateStr);
  return { status: 'safe', remainingDays: 1800, expiryDateStr: dateStr };
}

/**
 * 具配額防護的 localStorage 寫入
 * 台帳筆數多時 setItem 會拋 QuotaExceededError，未攔截會讓整個存檔動作靜默失敗
 * @returns {boolean} 是否寫入成功
 */
function safeSetItem(key, value) {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.error('localStorage 寫入失敗（可能已超出瀏覽器儲存配額）', e);
    return false;
  }
}

/**
 * 今日的本地 YYYY-MM-DD
 * 不可用 toISOString()，其以 UTC 輸出，在 UTC+8 的深夜時段會標成前一天
 */
function todayLocalDateStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * CSV 欄位逸出
 * 1. 雙引號需成對加倍，否則含引號的姓名會讓整份 CSV 錯位
 * 2. 以 = + - @ 開頭者，Excel 會視為公式執行（CSV injection），前置單引號中和
 */
function csvCell(value) {
  let str = (value === null || value === undefined) ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  return '"' + str.replace(/"/g, '""') + '"';
}

/**
 * iCalendar 文字逸出 (RFC 5545 3.3.11)
 * 反斜線、分號、逗號為欄位分隔語法字元，未逸出會破壞事件結構
 */
function icsText(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * iCalendar 長行摺疊 (RFC 5545 3.1)：每行不得逾 75 octets
 * 以 UTF-8 位元組計算，且不可從多位元組字元中間切開
 */
function foldIcsLines(content) {
  const encoder = (str) => (typeof Buffer !== 'undefined')
    ? Buffer.byteLength(str, 'utf8')
    : new TextEncoder().encode(str).length;

  return content.split(/\r?\n/).map(line => {
    if (encoder(line) <= 75) return line;

    const chunks = [];
    let current = '';
    let currentBytes = 0;
    let limit = 75;

    for (const ch of line) {
      const chBytes = encoder(ch);
      if (currentBytes + chBytes > limit) {
        chunks.push(current);
        current = ch;
        currentBytes = chBytes;
        limit = 74; // 後續行前置一個空白，可用額度少 1
      } else {
        current += ch;
        currentBytes += chBytes;
      }
    }
    if (current) chunks.push(current);

    return chunks.join('\r\n ');
  }).join('\r\n');
}

const STORAGE_KEYS = {
  RECORDS: 'cu_legal_records_v1',
  PROFILE: 'cu_profile_info_v1',
  // v2：舊版草稿混有「張大同」等預設假資料，不沿用
  DRAFT_DOC: 'cu_draft_doc_form_v2',
  DRAFT_SCRIPT: 'cu_draft_script_form_v1',
  DRAFT_SALARY: 'cu_draft_salary_form_v1'
};

/**
 * 載入儲存的憑證與法催台帳案件清單
 */
function loadRecords() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEYS.RECORDS);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return list.map(item => {
      const expiryInfo = calculate5YearExpiryHelper(item.issueDate);
      return { ...item, ...expiryInfo };
    });
  } catch (e) {
    console.error('Failed to load records from localStorage', e);
    return [];
  }
}

/**
 * 儲存/更新一筆台帳案件
 */
function saveRecord(record) {
  const list = loadRecords();
  const index = list.findIndex(r => r.id === record.id);
  
  const expiryInfo = calculate5YearExpiryHelper(record.issueDate);
  const updatedRecord = {
    ...record,
    ...expiryInfo,
    updatedAt: new Date().toISOString()
  };

  if (index >= 0) {
    list[index] = updatedRecord;
  } else {
    updatedRecord.id = 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    updatedRecord.createdAt = new Date().toISOString();
    list.unshift(updatedRecord);
  }

  const saved = safeSetItem(STORAGE_KEYS.RECORDS, JSON.stringify(list));
  return { ...updatedRecord, saved };
}

/**
 * 刪除案件
 */
function deleteRecord(id) {
  let list = loadRecords();
  list = list.filter(r => r.id !== id);
  safeSetItem(STORAGE_KEYS.RECORDS, JSON.stringify(list));
  return list;
}

/**
 * 取得單一案件
 */
function getRecord(id) {
  const list = loadRecords();
  return list.find(r => r.id === id) || null;
}

/**
 * 計算台帳時效警戒看板 KPI 數據
 */
function getLedgerMetrics(records = null) {
  const list = records || loadRecords();
  let total = list.length;
  let urgent = 0;   // < 90天
  let warning = 0;  // 90 ~ 180天
  let safe = 0;     // > 180天
  let expired = 0;  // <= 0天
  let totalPrincipal = 0;

  list.forEach(r => {
    totalPrincipal += Number(r.principal) || 0;
    if (r.status === 'urgent') urgent++;
    else if (r.status === 'warning') warning++;
    else if (r.status === 'expired') expired++;
    else safe++;
  });

  return {
    total,
    urgent,
    warning,
    safe,
    expired,
    totalPrincipal
  };
}

/**
 * 儲存表單草稿 (Auto-save)
 */
function saveDraft(key, data) {
  return safeSetItem(key, JSON.stringify({
    data,
    savedAt: new Date().toISOString()
  }));
}

/**
 * 載入表單草稿
 */
function loadDraft(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

/**
 * 載入本社預設資訊 (記住本社設定)
 */
function loadCuProfile() {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(STORAGE_KEYS.PROFILE);
    // 尚未儲存本社資料時回傳空白，書狀上以「○」標示待填；
    // 不可預設成示範用的假社名與統編，否則漏設定就會印出別家社的資料。
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

/**
 * 儲存本社預設資訊
 */
function saveCuProfile(profile) {
  return safeSetItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
}

/**
 * 匯出單筆或全部案件為標準 iCalendar (.ics) 檔案
 */
function generateICSContent(records) {
  const recordList = Array.isArray(records) ? records : [records];
  const nowStr = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  let events = '';
  for (const r of recordList) {
    if (!r.issueDate || !r.expiryDateStr) continue;
    const expiryDateCompact = r.expiryDateStr.replace(/-/g, '');
    const amountStr = Number(r.principal || 0).toLocaleString();

    // 所有使用者資料須經 icsText 逸出，姓名或案號含逗號、分號會破壞事件結構
    const name = icsText(r.debtorName) || '未填';
    const certNo = icsText(r.certNo) || '未填';
    const debtorId = icsText(r.debtorId) || '未填';
    const courtName = icsText(r.courtName) || '未填';
    const issueDate = icsText(r.issueDate);

    events += `BEGIN:VEVENT
UID:cu-statute-${r.id || Date.now()}@creditunion.local
DTSTAMP:${nowStr}
DTSTART;VALUE=DATE:${expiryDateCompact}
DTEND;VALUE=DATE:${expiryDateCompact}
SUMMARY:【5年時效到期日】儲互社債權憑證換發 - ${name}（${certNo}）
DESCRIPTION:債務人：${name}\\n身分證字號：${debtorId}\\n債權憑證案號：${certNo}\\n管轄法院：${courtName}\\n未償本金：新臺幣 ${amountStr} 元\\n原核發日：${issueDate}\\n\\n⚠️ 注意：此債權憑證 5 年消滅時效今日屆滿，請確認已具狀向法院聲請換發債權憑證，以免債權憑證失效變廢紙！
STATUS:CONFIRMED
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:【6個月前提醒】債權憑證 5 年時效將於半年後到期（債務人：${name}），請準備向法院具狀換發！
TRIGGER:-P180D
END:VALARM
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:【3個月前告急】債權憑證 5 年時效將於 90 天後到期（債務人：${name}），請立即送件聲請換發債權憑證！
TRIGGER:-P90D
END:VALARM
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:【1個月前最後警告】債權憑證 5 年時效即將屆滿（債務人：${name}），請務必於本月完成換證！
TRIGGER:-P30D
END:VALARM
END:VEVENT
`;
  }

  const raw = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//CULROC//Credit Union Legal Assistant 5-Year Statute Alarm//ZH
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:儲蓄互助社 5 年債權憑證時效鬧鐘
X-WR-TIMEZONE:Asia/Taipei
${events}END:VCALENDAR`;

  return foldIcsLines(raw);
}

/**
 * 存證信函催告後 6 個月起訴期限（民法第 130 條）行事曆鬧鐘 (.ics)
 * @param {{debtorName:string, noticeDateStr:string, expiryDateStr:string}} info
 */
function generateNoticeDeadlineICS(info) {
  const nowStr = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const name = icsText(info.debtorName) || '未填';
  const expiryCompact = String(info.expiryDateStr || '').replace(/-/g, '');
  const noticeDate = icsText(info.noticeDateStr);
  const uidSeed = `${expiryCompact}-${String(info.debtorName || '').length}-${String(info.noticeDateStr || '').replace(/-/g, '')}`;

  const raw = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//CULROC//Credit Union Legal Assistant Notice Deadline//ZH
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:儲蓄互助社 存證信函催告 6 個月起訴期限
X-WR-TIMEZONE:Asia/Taipei
BEGIN:VEVENT
UID:cu-notice-${uidSeed}@creditunion.local
DTSTAMP:${nowStr}
DTSTART;VALUE=DATE:${expiryCompact}
DTEND;VALUE=DATE:${expiryCompact}
SUMMARY:【催告 6 個月起訴期限】${name}
DESCRIPTION:債務人：${name}\\n存證信函送達日：${noticeDate}\\n\\n⚠️ 民法第 130 條：催告後 6 個月內未起訴（含聲請支付命令），時效視為不中斷。今日為期限最後一日，請確認已向法院聲請支付命令或起訴。
STATUS:CONFIRMED
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:【1 個月前提醒】對 ${name} 之催告將於 30 天後屆滿 6 個月，請準備聲請支付命令！
TRIGGER:-P30D
END:VALARM
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:【1 週前最後警告】對 ${name} 之催告 6 個月起訴期限剩 7 天，請立即具狀聲請支付命令！
TRIGGER:-P7D
END:VALARM
END:VEVENT
END:VCALENDAR`;

  return foldIcsLines(raw);
}

/**
 * 觸發下載檔案
 */
function downloadFile(filename, content, mimeType) {
  if (typeof document === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 匯出 Word (.doc) 格式檔案 (標準標楷體、A4直式橫書、段落縮排)
 */
function exportToWordDoc(filename, title, textContent) {
  const formattedHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>${title}</title>
      <style>
        @page Section1 {
          size: 595.3pt 841.9pt; /* A4 */
          margin: 72pt 72pt 72pt 72pt;
          mso-header-margin: 35.4pt;
          mso-footer-margin: 35.4pt;
          mso-paper-source: 0;
        }
        div.Section1 { page: Section1; }
        body {
          font-family: '標楷體', 'DFKai-SB', 'BiauKai', 'Times New Roman', serif;
          font-size: 14pt;
          line-height: 2.0;
          color: #000;
        }
        h1 {
          font-size: 18pt;
          text-align: center;
          font-weight: bold;
          margin-bottom: 24pt;
        }
        p {
          margin: 0 0 10pt;
          text-align: justify;
          text-justify: inter-ideograph;
        }
        pre {
          font-family: inherit;
          font-size: inherit;
          line-height: inherit;
          white-space: pre-wrap;
        }
      </style>
    </head>
    <body>
      <div class="Section1">
        <pre>${textContent}</pre>
      </div>
    </body>
    </html>
  `;

  downloadFile(`${filename}.doc`, formattedHtml, 'application/msword;charset=utf-8');
}

/**
 * 匯出 CSV 台帳清冊
 */
function exportRecordsToCSV(records) {
  const headers = ['案件ID', '債務人姓名', '身分證字號', '債權憑證/執行案號', '管轄法院', '債權本金', '核發日期', '5年到期日', '剩餘天數', '時效狀態', '連帶保證人', '備註'];
  // \u5168\u90E8\u6B04\u4F4D\u4E00\u5F8B\u8D70 csvCell\uFF1A\u7D71\u4E00\u8655\u7406\u96D9\u5F15\u865F\u9038\u51FA\u8207 Excel \u516C\u5F0F\u6CE8\u5165
  const rows = records.map(r => [
    csvCell(r.id),
    csvCell(r.debtorName),
    csvCell(r.debtorId),
    csvCell(r.certNo),
    csvCell(r.courtName),
    csvCell(r.principal || 0),
    csvCell(r.issueDate),
    csvCell(r.expiryDateStr),
    csvCell(r.remainingDays || 0),
    csvCell(r.statusText),
    csvCell(r.guarantorName),
    csvCell(r.note)
  ]);

  const csvContent = '\uFEFF' + [headers.map(csvCell).join(','), ...rows.map(e => e.join(','))].join('\r\n');
  const dateStr = todayLocalDateStr();
  downloadFile(`儲蓄互助社_債權憑證5年時效管理台帳_${dateStr}.csv`, csvContent, 'text/csv;charset=utf-8;');
}

/**
 * 匯出 JSON 全量備份
 */
function exportRecordsToJSON(records) {
  const data = {
    exportedAt: new Date().toISOString(),
    version: '2.3.0',
    profile: loadCuProfile(),
    records: records
  };
  const dateStr = todayLocalDateStr();
  downloadFile(`儲互社法催資料庫備份_${dateStr}.json`, JSON.stringify(data, null, 2), 'application/json');
}

/**
 * 匯入 JSON 備份
 */
function importRecordsFromJSON(jsonText) {
  try {
    const data = JSON.parse(jsonText);
    if (!data.records || !Array.isArray(data.records)) {
      throw new Error('無效的備份檔案格式');
    }
    if (!safeSetItem(STORAGE_KEYS.RECORDS, JSON.stringify(data.records))) {
      return { success: false, error: '瀏覽器儲存空間不足，匯入失敗' };
    }
    if (data.profile) {
      safeSetItem(STORAGE_KEYS.PROFILE, JSON.stringify(data.profile));
    }
    return { success: true, count: data.records.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    STORAGE_KEYS,
    loadRecords,
    saveRecord,
    deleteRecord,
    getRecord,
    getLedgerMetrics,
    saveDraft,
    loadDraft,
    loadCuProfile,
    saveCuProfile,
    generateICSContent,
    generateNoticeDeadlineICS,
    exportToWordDoc,
    exportRecordsToCSV,
    exportRecordsToJSON,
    importRecordsFromJSON,
    safeSetItem,
    csvCell,
    icsText,
    foldIcsLines,
    todayLocalDateStr
  };
}
