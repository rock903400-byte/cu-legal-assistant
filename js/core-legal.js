/**
 * 法律核心運算引擎 (core-legal.js)
 * 包含：中文大寫金額轉換、民法 5 年消滅時效計算、法院規費計算、選用利息試算
 */

/**
 * 將阿拉伯數字轉換為司法院公文專用繁體中文大寫金額
 * 例如：123456 -> 壹拾貳萬參仟肆佰伍拾陸元整
 */
function toChineseCurrency(num) {
  const n = Math.floor(Number(num));
  if (isNaN(n) || n === 0) return '零元整';
  if (n < 0) return '負' + toChineseCurrency(Math.abs(n));

  const digits = ['零', '壹', '貳', '參', '肆', '伍', '陸', '柒', '捌', '玖'];
  const units = ['', '拾', '佰', '仟'];
  const bigUnits = ['', '萬', '億', '兆'];

  let numStr = n.toString();
  let len = numStr.length;
  let result = '';
  let zeroCount = 0;

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
      result = groupResult + bigUnits[i] + result;
    }
  }

  // 清理多餘的零
  result = result.replace(/零+/g, '零').replace(/零萬/g, '萬').replace(/零億/g, '億');
  if (result.endsWith('零')) {
    result = result.slice(0, -1);
  }

  return '新臺幣' + result + '元整';
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
  const issueDate = new Date(y, m - 1, d);
  
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
    calculate5YearExpiry,
    calculateEstimatedInterest,
    calculateCourtFees,
    formatRocDate,
    getCurrentRocDate
  };
}
