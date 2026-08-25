/**
 * 法律核心運算引擎 (core-legal.js)
 * 包含：
 * 1. 中文大寫金額轉換
 * 2. 民法 5 年消滅時效計算
 * 3. 民法第 205 條 16% 利率上限檢核
 * 4. 民法第 130 條催告 6 個月起訴時效計算
 * 5. 法院規費計算、選用利息試算
 */

/**
 * 將阿拉伯數字轉換為司法院公文專用繁體中文大寫金額
 * 例如：123456 -> 壹拾貳萬參仟肆佰伍拾陸元整
 */
function toChineseCurrency(num) {
  const n = Math.floor(Number(num));
  if (!Number.isFinite(n) || n === 0) return '零元整';
  if (!Number.isSafeInteger(n)) {
    return `⚠️金額 ${num} 超出可精確計算範圍，請人工填寫`;
  }
  if (n < 0) return '負' + toChineseCurrency(Math.abs(n));

  const digits = ['零', '壹', '貳', '參', '肆', '伍', '陸', '柒', '捌', '玖'];
  const units = ['', '拾', '佰', '仟'];
  const bigUnits = ['', '萬', '億', '兆'];

  let numStr = n.toString();
  let result = '';

  // 切割成每 4 位一組 (個十百千)
  const groups = [];
  while (numStr.length > 0) {
    groups.push(numStr.slice(-4));
    numStr = numStr.slice(0, -4);
  }

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    let groupResult = '';
    let groupZero = false;

    for (let j = 0; j < group.length; j++) {
      const digit = Number(group[j]);
      const unit = units[group.length - 1 - j];

      if (digit === 0) {
        groupZero = true;
      } else {
        if (groupZero) {
          groupResult += digits[0];
          groupZero = false;
        }
        groupResult += digits[digit] + unit;
      }
    }

    if (groupResult !== '') {
      // 超出「兆」位 (10^16 以上) 無對應中文單位，避免輸出 undefined
      if (i >= bigUnits.length) return null;
      result = groupResult + bigUnits[i] + result;
    }
  }

  // 清理多餘的零
  result = result.replace(/零+/g, '零').replace(/零萬/g, '萬').replace(/零億/g, '億');
  if (result.endsWith('零')) {
    result = result.slice(0, -1);
  }

  if (result === null) {
    return `⚠️金額 ${n.toLocaleString()} 超出中文大寫可轉換範圍，請人工填寫`;
  }

  return '新臺幣' + result + '元整';
}

/**
 * 檢核約定利率是否符合民法第 205 條上限 (年息 16%)
 */
function validateInterestRate(rate) {
  const r = Number(rate) || 0;
  if (r > 16) {
    return {
      isValid: false,
      rate: r,
      maxRate: 16,
      warning: `⚠️ 依民法第 205 條（110/7/20 修正施行），約定利率上限為年息 16%，超過部分之約定無效！目前輸入 ${r}% 已逾法定上限。`
    };
  }
  return {
    isValid: true,
    rate: r,
    maxRate: 16,
    warning: ''
  };
}

/**
 * 將 Date 物件格式化為本地時區的 YYYY-MM-DD
 * 不可使用 toISOString()，其會以 UTC 輸出，在 UTC+8 會整天前移一日
 */
function formatLocalDate(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 依民法第 121 條第 2 項加算月份
 * 但書：最後之月無相當日者，以其月之末日為期間之末日
 * 例：8/31 加 6 個月 -> 2/28 (而非 JS 預設溢位之 3/3)
 */
function addMonthsWithEomAdjust(dateObj, monthsToAdd) {
  const originalDay = dateObj.getDate();
  const result = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
  result.setMonth(result.getMonth() + monthsToAdd);

  const lastDayOfTargetMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, lastDayOfTargetMonth));

  return result;
}

/**
 * 計算 5 年消滅時效到期日與狀態燈號
 * 依民法第 126 條 (利息 5 年) 與第 137 條第 3 項 (換發債權憑證重行起算 5 年)
 * @param {string} issueDateStr YYYY-MM-DD
 * @param {Date} [currentDate] 預設為當前時間
 */
function calculate5YearExpiry(issueDateStr, currentDate = new Date()) {
  if (!issueDateStr) {
    return {
      issueDateStr: '',
      expiryDateStr: '',
      remainingDays: 0,
      status: 'unknown',
      statusText: '未填寫',
      color: '#94A3B8'
    };
  }

  const [y, m, d] = issueDateStr.split('-').map(Number);
  
  // 計算 5 年後 (若為 2/29 閏日，加 5 年非閏年則自動設為 2/28)
  const targetYear = y + 5;
  let targetMonth = m - 1;
  let targetDay = d;

  if (m === 2 && d === 29) {
    const isLeap = (targetYear % 4 === 0 && targetYear % 100 !== 0) || (targetYear % 400 === 0);
    if (!isLeap) {
      targetDay = 28;
    }
  }

  const expiryDate = new Date(targetYear, targetMonth, targetDay);
  const expiryDateStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;

  // 計算剩餘天數 (以當天 00:00:00 比對)
  const todayZero = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
  const expiryZero = new Date(targetYear, targetMonth, targetDay);
  
  const diffTime = expiryZero.getTime() - todayZero.getTime();
  const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let status = 'safe';
  let statusText = '安全期（正常）';
  let color = '#15803D'; // 綠

  if (remainingDays <= 0) {
    status = 'expired';
    statusText = '已逾 5 年時效（過期）';
    color = '#1E293B'; // 灰黑
  } else if (remainingDays <= 90) {
    status = 'urgent';
    statusText = '緊急告急（請速換證）';
    color = '#DC2626'; // 紅 (< 3 個月)
  } else if (remainingDays <= 180) {
    status = 'warning';
    statusText = '時效預警（6個月內屆滿）';
    color = '#D97706'; // 黃 (3~6 個月)
  }

  return {
    issueDateStr,
    expiryDateStr,
    remainingDays,
    status,
    statusText,
    color
  };
}

/**
 * 依民法第 130 條計算催告後 6 個月內起訴期限
 */
function calculate6MonthNoticeExpiry(noticeDateStr, currentDate = new Date()) {
  if (!noticeDateStr) return null;
  const [y, m, d] = noticeDateStr.split('-').map(Number);
  const noticeDate = new Date(y, m - 1, d);
  
  const expiryDate = addMonthsWithEomAdjust(noticeDate, 6);

  const todayZero = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
  const diffTime = expiryDate.getTime() - todayZero.getTime();
  const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return {
    noticeDateStr,
    expiryDateStr: formatLocalDate(expiryDate),
    remainingDays,
    isExpired: remainingDays <= 0
  };
}

/**
 * 輔助計息引擎 (選用)：按日計息
 * @param {number} principal 未償本金
 * @param {number} annualRatePercent 年利率 (例如 6.5)
 * @param {string} startDateStr 起算日 YYYY-MM-DD
 * @param {string} endDateStr 計算基準日 YYYY-MM-DD
 */
function calculateEstimatedInterest(principal, annualRatePercent, startDateStr, endDateStr) {
  if (!principal || !annualRatePercent || !startDateStr || !endDateStr) {
    return { days: 0, interest: 0 };
  }

  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const diffTime = end.getTime() - start.getTime();
  const days = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  const dailyRate = (Number(annualRatePercent) / 100) / 365;
  const interest = Math.round(Number(principal) * dailyRate * days);

  return { days, interest };
}

/**
 * 計算法院訴訟及強制執行規費
 */
function calculateCourtFees(claimAmount, docType = 'execution') {
  if (docType === 'payment_order') {
    return 500; // 支付命令聲請規費固定 500 元
  }
  
  // 強制執行規費 (未滿 5000 元免徵；5000 元以上按千分之八計算)
  const amount = Number(claimAmount) || 0;
  if (amount < 5000) return 0;
  return Math.floor(amount * 0.008);
}

/**
 * 格式化民國年日期 (例：2026-08-20 -> 民國 115 年 8 月 20 日)
 */
function formatRocDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const rocYear = y - 1911;
  return `民國 ${rocYear} 年 ${m} 月 ${d} 日`;
}

/**
 * 取得當前民國年月日物件
 */
function getCurrentRocDate() {
  const now = new Date();
  return {
    rocYear: now.getFullYear() - 1911,
    month: now.getMonth() + 1,
    day: now.getDate(),
    dateString: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    toChineseCurrency,
    validateInterestRate,
    calculate5YearExpiry,
    calculate6MonthNoticeExpiry,
    calculateEstimatedInterest,
    calculateCourtFees,
    formatRocDate,
    getCurrentRocDate,
    formatLocalDate,
    addMonthsWithEomAdjust
  };
}
