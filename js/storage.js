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

const STORAGE_KEYS = {
  RECORDS: 'cu_legal_records_v1',
  PROFILE: 'cu_profile_info_v1'
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
    // 自動重新計算時效狀態
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

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(list));
  }
  return updatedRecord;
}

/**
 * 刪除案件
 */
function deleteRecord(id) {
  let list = loadRecords();
  list = list.filter(r => r.id !== id);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(list));
  }
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
 * 載入本社預設資訊 (記住本社設定)
 */
function loadCuProfile() {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(STORAGE_KEYS.PROFILE);
    if (!raw) {
      return {
        cuName: '有限責任臺中市第一儲蓄互助社',
        cuTaxId: '04123456',
        cuRep: '陳理事長',
        cuAddress: '臺中市西區民生路 100 號',
        cuPhone: '04-22223333',
        agentName: '李專職'
      };
    }
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

/**
 * 儲存本社預設資訊
 */
function saveCuProfile(profile) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
  }
}

/**
 * 匯出單筆或全部案件為標準 iCalendar (.ics) 檔案
 * 內建 180 天 (6個月前) 及 90 天 (3個月前) 鬧鐘推播
 */
function generateICSContent(records) {
  const recordList = Array.isArray(records) ? records : [records];
  const nowStr = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  let events = '';
  for (const r of recordList) {
    if (!r.issueDate || !r.expiryDateStr) continue;
    const expiryDateCompact = r.expiryDateStr.replace(/-/g, '');
    const amountStr = Number(r.principal || 0).toLocaleString();

    events += `BEGIN:VEVENT
UID:cu-statute-${r.id || Date.now()}@creditunion.local
DTSTAMP:${nowStr}
DTSTART;VALUE=DATE:${expiryDateCompact}
DTEND;VALUE=DATE:${expiryDateCompact}
SUMMARY:【5年時效到期日】儲互社債權憑證換發 - ${r.debtorName}（${r.certNo || '案號未填'}）
DESCRIPTION:債務人：${r.debtorName}\\n身分證字號：${r.debtorId || '未填'}\\n債權憑證案號：${r.certNo || '未填'}\\n管轄法院：${r.courtName || '未填'}\\n未償本金：新臺幣 ${amountStr} 元\\n原核發日：${r.issueDate}\\n\\n⚠️ 注意：此債權憑證 5 年消滅時效今日屆滿，請確認已具狀向法院聲請換發債權憑證，以免債權憑證失效變廢紙！
STATUS:CONFIRMED
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:【6個月前提醒】債權憑證 5 年時效將於半年後到期（債務人：${r.debtorName}），請準備向法院具狀換發！
TRIGGER:-P180D
END:VALARM
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:【3個月前告急】債權憑證 5 年時效將於 90 天後到期（債務人：${r.debtorName}），請立即送件聲請換發債權憑證！
TRIGGER:-P90D
END:VALARM
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:【1個月前最後警告】債權憑證 5 年時效即將屆滿（債務人：${r.debtorName}），請務必於本月完成換證！
TRIGGER:-P30D
END:VALARM
END:VEVENT
`;
  }

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//CULROC//Credit Union Legal Assistant 5-Year Statute Alarm//ZH
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:儲蓄互助社 5 年債權憑證時效鬧鐘
X-WR-TIMEZONE:Asia/Taipei
${events}END:VCALENDAR`;
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
 * 匯出 CSV 台帳清冊 (支援 Excel 繁體中文 UTF-8 with BOM)
 */
function exportRecordsToCSV(records) {
  const headers = ['案件ID', '債務人姓名', '身分證字號', '債權憑證/執行案號', '管轄法院', '債權本金', '核發日期', '5年到期日', '剩餘天數', '時效狀態', '連帶保證人', '備註'];
  const rows = records.map(r => [
    `"${r.id || ''}"`,
    `"${r.debtorName || ''}"`,
    `"${r.debtorId || ''}"`,
    `"${r.certNo || ''}"`,
    `"${r.courtName || ''}"`,
    `"${r.principal || 0}"`,
    `"${r.issueDate || ''}"`,
    `"${r.expiryDateStr || ''}"`,
    `"${r.remainingDays || 0}"`,
    `"${r.statusText || ''}"`,
    `"${r.guarantorName || ''}"`,
    `"${(r.note || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\r\n');
  const dateStr = new Date().toISOString().split('T')[0];
  downloadFile(`儲蓄互助社_債權憑證5年時效管理台帳_${dateStr}.csv`, csvContent, 'text/csv;charset=utf-8;');
}

/**
 * 匯出 JSON 全量備份
 */
function exportRecordsToJSON(records) {
  const data = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    profile: loadCuProfile(),
    records: records
  };
  const dateStr = new Date().toISOString().split('T')[0];
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
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(data.records));
      if (data.profile) {
        localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(data.profile));
      }
    }
    return { success: true, count: data.records.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    loadRecords,
    saveRecord,
    deleteRecord,
    getRecord,
    loadCuProfile,
    saveCuProfile,
    generateICSContent,
    exportRecordsToCSV,
    exportRecordsToJSON,
    importRecordsFromJSON
  };
}
