/**
 * 強制執行薪資扣押計算機模組 (salary-calc.js)
 * 依據《強制執行法》第 115 條之 1、第 122 條及衛生福利部公告 115 年度全台各縣市最低生活費標準
 */

// 115 年度全台各縣市最低生活費標準 (每月/人)
const MIN_LIVING_EXPENSES_115 = {
  'taipei': { name: '臺北市', amount: 20744 },
  'new_taipei': { name: '新北市', amount: 17750 },
  'taoyuan': { name: '桃園市', amount: 17186 },
  'taichung': { name: '臺中市', amount: 16431 },
  'tainan': { name: '臺南市', amount: 15515 },
  'kaohsiung': { name: '高雄市', amount: 16970 },
  'taiwan_province': { name: '臺灣省各縣市 (含彰投苗雲嘉屏東花宜基澎)', amount: 15515 },
  'kinmen_lienchiang': { name: '福建省 (金門縣、連江縣)', amount: 14064 }
};

/**
 * 計算強制執行每月合法扣薪額度與生活費保障
 * @param {Object} params
 * @param {number} params.monthlySalary 債務人每月實領或應領薪資 (元)
 * @param {string} params.regionCode 縣市代碼 (例: 'taichung')
 * @param {number} params.dependentCount 受扶養親屬人數 (例: 1)
 * @param {number} params.supportRatio 扶養負擔比例 (例: 0.5 或 1.0)
 * @returns {Object} 試算結果
 */
function calculateSalaryGarnishment(params) {
  const salary = Math.max(0, Number(params.monthlySalary) || 0);
  const regionKey = params.regionCode || 'taichung';
  const regionInfo = MIN_LIVING_EXPENSES_115[regionKey] || MIN_LIVING_EXPENSES_115['taichung'];
  
  const baseLivingCost = regionInfo.amount;
  const standard1_2 = Math.round(baseLivingCost * 1.2); // 1.2 倍最低生活費

  const dependents = Math.max(0, Number(params.dependentCount) || 0);
  const ratio = Math.max(0, Math.min(1, Number(params.supportRatio) || 1.0));

  // 債務人本人生活費 (1.2倍) + 扶養親屬生活費 (依比例分攤)
  const personalCost = standard1_2;
  const dependentsCost = Math.round(dependents * standard1_2 * ratio);
  const totalProtectedLivingCost = personalCost + dependentsCost;

  // 薪資 1/3 上限
  const maxOneThird = Math.floor(salary / 3);

  // 扣除生活費後之實質可扣餘額
  const disposableAfterLiving = salary - totalProtectedLivingCost;

  // 實際合法可扣押金額 = Math.min(1/3薪資, Math.max(0, 薪資 - 總生活費))
  let garnishableAmount = 0;
  let isExempt = false; // 是否因薪資不足免予扣押
  let warningMessage = '';

  if (disposableAfterLiving <= 0) {
    garnishableAmount = 0;
    isExempt = true;
    warningMessage = `⚠️ 警告：債務人月薪（${salary.toLocaleString()}元）扣除法定最低生活保障（${totalProtectedLivingCost.toLocaleString()}元）後無餘額，依強制執行法第 122 條不得扣押，若聲請扣薪恐遭法院駁回或遭債務人異議！`;
  } else {
    garnishableAmount = Math.min(maxOneThird, disposableAfterLiving);
    if (garnishableAmount < maxOneThird) {
      warningMessage = `💡 提示：因需保障債務人及其扶養親屬法定生活費（${totalProtectedLivingCost.toLocaleString()}元），每月扣押金額酌減為 ${garnishableAmount.toLocaleString()} 元（未達三分之一全額 ${maxOneThird.toLocaleString()} 元）。`;
    }
  }

  // 債務人保留生活金額
  const retainedAmount = salary - garnishableAmount;

  return {
    salary,
    regionName: regionInfo.name,
    baseLivingCost,
    standard1_2,
    dependents,
    supportRatio: ratio,
    personalCost,
    dependentsCost,
    totalProtectedLivingCost,
    maxOneThird,
    garnishableAmount,
    retainedAmount,
    isExempt,
    warningMessage
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MIN_LIVING_EXPENSES_115,
    calculateSalaryGarnishment
  };
}
