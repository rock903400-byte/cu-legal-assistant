/**
 * 法律核心運算與範本自動化單元測試 (tests/test-core.js) - 全面升級版
 */

const assert = require('assert');
const {
  toChineseCurrency,
  validateInterestRate,
  calculate5YearExpiry,
  calculate6MonthNoticeExpiry,
  calculateEstimatedInterest,
  calculateCourtFees,
  formatRocDate
} = require('../js/core-legal');

const {
  MIN_LIVING_EXPENSES_115,
  calculateSalaryGarnishment
} = require('../js/salary-calc');

const {
  generatePaymentOrderDoc,
  generateExecutionDoc,
  generateRenewCertificateDoc,
  generateOffsetShareDoc,
  generateOffsetBoardResolutionDoc,
  generateHouseholdApplyDoc,
  generateInheritanceInquiryDoc,
  generateInheritanceDemandDoc
} = require('../js/templates');

const { generateICSContent } = require('../js/storage');

console.log('🧪 開始執行儲互社法催助手全面單元測試...\n');

// 1. 測試中文大寫金額轉換
console.log('1. 測試中文大寫金額轉換 (toChineseCurrency)');
assert.strictEqual(toChineseCurrency(0), '零元整');
assert.strictEqual(toChineseCurrency(100), '新臺幣壹佰元整');
assert.strictEqual(toChineseCurrency(12345), '新臺幣壹萬貳仟參佰肆拾伍元整');
assert.strictEqual(toChineseCurrency(105000), '新臺幣壹拾萬伍仟元整');
assert.strictEqual(toChineseCurrency(210000), '新臺幣貳拾壹萬元整');
assert.strictEqual(toChineseCurrency(1000000), '新臺幣壹佰萬元整');
assert.strictEqual(toChineseCurrency(3506000), '新臺幣參佰伍拾萬陸仟元整');
console.log('  ✅ 中文大寫金額轉換全部通過');

// 2. 測試 16% 約定利率上限防呆 (民法第 205 條)
console.log('\n2. 測試 16% 約定利率上限防呆 (validateInterestRate)');
const rateOk = validateInterestRate(12);
assert.strictEqual(rateOk.isValid, true);
const rateTooHigh = validateInterestRate(18.5);
assert.strictEqual(rateTooHigh.isValid, false);
assert.strictEqual(rateTooHigh.warning.includes('16%'), true);
console.log('  ✅ 16% 約定利率防呆檢核通過');

// 3. 測試 5 年消滅時效與 6 個月起訴期限
console.log('\n3. 測試 5 年消滅時效與 6 個月催告起訴期限');
const testDate = '2021-05-10';
const res1 = calculate5YearExpiry(testDate, new Date('2026-01-01'));
assert.strictEqual(res1.expiryDateStr, '2026-05-10');
assert.strictEqual(res1.status, 'warning');

const resLeap = calculate5YearExpiry('2024-02-29', new Date('2024-03-01'));
assert.strictEqual(resLeap.expiryDateStr, '2029-02-28');
assert.strictEqual(resLeap.status, 'safe');

const noticeExp = calculate6MonthNoticeExpiry('2026-01-01', new Date('2026-03-01'));
assert.strictEqual(noticeExp.remainingDays > 0, true);
console.log('  ✅ 5 年消滅時效與 6 個月起訴期限計算通過');

// 4. 測試強制執行薪資扣押計算機 (115年最低生活費 1.2 倍與負數防呆)
console.log('\n4. 測試強制執行薪資扣押計算機 (calculateSalaryGarnishment)');
// 案例 A：台中市月薪 42,000，扶養 1 人 (負擔 0.5)
// 台中最低生活費 16,431 * 1.2 = 19,717 (本人) + 9,859 (扶養) = 29,576
// 薪資 42,000 - 29,576 = 12,424
// 1/3 薪資 = 14,000 -> 可扣 12,424 (受生活費保障酌減)
const salA = calculateSalaryGarnishment({
  monthlySalary: 42000,
  regionCode: 'taichung',
  dependentCount: 1,
  supportRatio: 0.5
});
assert.strictEqual(salA.isExempt, false);
assert.strictEqual(salA.garnishableAmount, 12424);
assert.strictEqual(salA.retainedAmount, 29576);

// 案例 B：低薪負數防呆 (月薪 24,000 扶養 2 人，台北市)
// 台北 20,744 * 1.2 = 24,893 -> 已經超過月薪 24,000 -> 可扣 0
const salB = calculateSalaryGarnishment({
  monthlySalary: 24000,
  regionCode: 'taipei',
  dependentCount: 2,
  supportRatio: 1.0
});
assert.strictEqual(salB.isExempt, true);
assert.strictEqual(salB.garnishableAmount, 0);
assert.strictEqual(salB.warningMessage.includes('不得扣押'), true);
console.log('  ✅ 薪資扣押計算與負數邊界防呆全部通過');

// 5. 測試公文書狀生成 (含司法訴訟、股金抵銷、身故繼承等 8 大公文)
console.log('\n5. 測試公文範本庫 (8 大公文)');

// 5.1 支付命令
const paymentOrderDoc = generatePaymentOrderDoc({
  creditorName: '有限責任臺中市第一儲蓄互助社',
  debtorName: '張大同',
  principal: 210000,
  manualInterest: 15000,
  manualPenalty: 2000,
  courtName: '臺中'
});
assert.strictEqual(paymentOrderDoc.includes('民事支付命令聲請狀'), true);
assert.strictEqual(paymentOrderDoc.includes('新臺幣貳拾貳萬柒仟元整'), true);

// 5.2 強制執行
const execDoc = generateExecutionDoc({
  creditorName: '有限責任臺中市第一儲蓄互助社',
  debtorName: '張大同',
  principal: 210000,
  courtName: '臺中',
  targets: { bankDeposit: true, insurance: true, salary: true, taxData: true }
});
assert.strictEqual(execDoc.includes('最高法院 108 年度台抗大字第 897 號'), true);
assert.strictEqual(execDoc.includes('中華民國人壽保險商業同業公會'), true);

// 5.3 換發憑證
const renewDoc = generateRenewCertificateDoc({
  creditorName: '有限責任臺中市第一儲蓄互助社',
  debtorName: '張大同',
  principal: 210000,
  courtName: '臺中'
});
assert.strictEqual(renewDoc.includes('民事聲請換發債權憑證狀'), true);

// 5.4 股金抵銷通知書 (儲互社法第 14 條)
const offsetDoc = generateOffsetShareDoc({
  creditorName: '有限責任臺中市第一儲蓄互助社',
  debtorName: '張大同',
  principal: 100000,
  shareAmount: 60000,
  dividendAmount: 3000
});
assert.strictEqual(offsetDoc.includes('儲蓄互助社法》第 14 條'), true);
assert.strictEqual(offsetDoc.includes('抵銷後剩餘欠款：新臺幣 37,000 元整'), true);

// 5.5 股金抵銷簽呈
const boardDoc = generateOffsetBoardResolutionDoc({
  creditorName: '有限責任臺中市第一儲蓄互助社',
  debtorName: '張大同',
  principal: 100000,
  shareAmount: 60000
});
assert.strictEqual(boardDoc.includes('行使股金抵銷權案'), true);

// 5.6 戶政除戶申請
const houseDoc = generateHouseholdApplyDoc({
  creditorName: '有限責任臺中市第一儲蓄互助社',
  debtorName: '張大同',
  principal: 100000
});
assert.strictEqual(houseDoc.includes('戶籍謄本申請書'), true);

// 5.7 拋棄繼承查詢狀 (家事庭)
const inheritDoc = generateInheritanceInquiryDoc({
  creditorName: '有限責任臺中市第一儲蓄互助社',
  debtorName: '張大同',
  courtName: '臺中'
});
assert.strictEqual(inheritDoc.includes('拋棄繼承'), true);
assert.strictEqual(inheritDoc.includes('家事法庭'), true);

// 5.8 繼承人催告函
const demandDoc = generateInheritanceDemandDoc({
  creditorName: '有限責任臺中市第一儲蓄互助社',
  debtorName: '張大同',
  principal: 100000
});
assert.strictEqual(demandDoc.includes('全體法定繼承人'), true);
assert.strictEqual(demandDoc.includes('民法》第 1148 條'), true);

console.log('  ✅ 8 大公文範本生成全部通過');

// 6. 測試 iCalendar (.ics) 鬧鐘
console.log('\n6. 測試 iCalendar (.ics) 鬧鐘推播格式');
const icsOutput = generateICSContent([{
  id: 'test_1',
  debtorName: '張大同',
  certNo: '111 司執 12345',
  principal: 210000,
  issueDate: '2022-05-10',
  expiryDateStr: '2027-05-10'
}]);
assert.strictEqual(icsOutput.includes('BEGIN:VALARM'), true);
assert.strictEqual(icsOutput.includes('TRIGGER:-P180D'), true);
console.log('  ✅ iCalendar 鬧鐘推播全部通過');

// 7. 迴歸測試：民法第 121 條第 2 項月末調整與時區位移
console.log('\n7. 迴歸測試：6 個月期間之月末調整與本地時區');
// 8/31 加 6 個月，2 月無 31 日 -> 依民法 §121 II 但書以該月末日為期間末日
assert.strictEqual(calculate6MonthNoticeExpiry('2026-08-31').expiryDateStr, '2027-02-28');
// 閏年：2024/8/29 加 6 個月 -> 2025 年 2 月僅至 28 日
assert.strictEqual(calculate6MonthNoticeExpiry('2024-08-29').expiryDateStr, '2025-02-28');
assert.strictEqual(calculate6MonthNoticeExpiry('2026-03-31').expiryDateStr, '2026-09-30');
// 不得因 toISOString() 之 UTC 轉換而整日前移
assert.strictEqual(calculate6MonthNoticeExpiry('2026-01-01').expiryDateStr, '2026-07-01');
assert.strictEqual(calculate6MonthNoticeExpiry('2026-08-25').expiryDateStr, '2027-02-25');
console.log('  ✅ 月末調整與時區位移迴歸測試通過');

// 8. 迴歸測試：中文大寫金額溢位不得輸出 undefined
console.log('\n8. 迴歸測試：中文大寫金額上限防呆');
assert.strictEqual(toChineseCurrency(9007199254740991).includes('undefined'), false);
assert.strictEqual(toChineseCurrency(9007199254740991).startsWith('新臺幣'), true);
const hugeAmount = toChineseCurrency(1e17);
assert.strictEqual(hugeAmount.includes('undefined'), false);
assert.strictEqual(hugeAmount.includes('人工填寫'), true);
console.log('  ✅ 大寫金額溢位防呆通過');

// 9. 迴歸測試：CSV 逸出與公式注入、ICS 特殊字元逸出
console.log('\n9. 迴歸測試：匯出檔案逸出處理');
const { csvCell, icsText, foldIcsLines } = require('../js/storage');
// 雙引號需加倍，否則整份 CSV 錯位
assert.strictEqual(csvCell('王"大"明'), '"王""大""明"');
// Excel 公式注入須前置單引號中和
assert.strictEqual(csvCell('=1+1'), `"'=1+1"`);
assert.strictEqual(csvCell('@SUM(A1)'), `"'@SUM(A1)"`);
assert.strictEqual(csvCell(null), '""');
// ICS 逗號與分號為語法字元，須逸出
assert.strictEqual(icsText('王大明, 有限責任社; 備註'), '王大明\\, 有限責任社\\; 備註');
// 長行須依 RFC 5545 摺疊為 75 octets 以內
const longLine = 'DESCRIPTION:' + '債務人資料'.repeat(40);
foldIcsLines(longLine).split('\r\n').forEach(l => {
  assert.strictEqual(Buffer.byteLength(l, 'utf8') <= 76, true);
});
console.log('  ✅ CSV / ICS 逸出處理全部通過');

console.log('\n🎉 所有全面升級單元測試全數驗證通過！');
