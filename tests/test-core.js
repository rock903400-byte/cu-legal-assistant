/**
 * 法律核心運算與範本自動化單元測試 (tests/test-core.js)
 */

const assert = require('assert');
const {
  toChineseCurrency,
  calculate5YearExpiry,
  calculateEstimatedInterest,
  calculateCourtFees,
  formatRocDate
} = require('../js/core-legal');

const {
  generatePaymentOrderDoc,
  generateExecutionDoc,
  generateRenewCertificateDoc
} = require('../js/templates');

const { generateICSContent } = require('../js/storage');

console.log('🧪 開始執行儲互社法催助手核心測試...\n');

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

// 2. 測試 5 年消滅時效計算
console.log('\n2. 測試 5 年消滅時效計算 (calculate5YearExpiry)');
const testDate = '2021-05-10';
const res1 = calculate5YearExpiry(testDate, new Date('2026-01-01'));
assert.strictEqual(res1.expiryDateStr, '2026-05-10');
assert.strictEqual(res1.status, 'warning'); // 剩餘約 130 天 (<180)

// 測試閏年 2024-02-29 + 5 年 -> 2029-02-28
const resLeap = calculate5YearExpiry('2024-02-29', new Date('2024-03-01'));
assert.strictEqual(resLeap.expiryDateStr, '2029-02-28');
assert.strictEqual(resLeap.status, 'safe');

// 測試過期
const resExpired = calculate5YearExpiry('2018-01-01', new Date('2026-01-01'));
assert.strictEqual(resExpired.status, 'expired');
assert.strictEqual(resExpired.remainingDays <= 0, true);
console.log('  ✅ 5 年消滅時效與閏年計算全部通過');

// 3. 測試法院規費計算
console.log('\n3. 測試法院規費計算 (calculateCourtFees)');
assert.strictEqual(calculateCourtFees(100000, 'payment_order'), 500); // 支付命令固定 500
assert.strictEqual(calculateCourtFees(4000, 'execution'), 0); // 未滿 5000 免徵
assert.strictEqual(calculateCourtFees(100000, 'execution'), 800); // 100,000 * 0.008 = 800
assert.strictEqual(calculateCourtFees(210000, 'execution'), 1680); // 210,000 * 0.008 = 1680
console.log('  ✅ 法院規費千分之八計算全部通過');

// 4. 測試民事支付命令聲請狀生成
console.log('\n4. 測試支付命令聲請狀生成 (generatePaymentOrderDoc)');
const paymentOrderDoc = generatePaymentOrderDoc({
  creditorName: '有限責任臺中市第一儲蓄互助社',
  creditorRep: '陳理事長',
  debtorName: '張大同',
  debtorId: 'B123456789',
  principal: 210000,
  loanAmount: 300000,
  loanDate: '2023-01-15',
  lastPaymentDate: '2023-11-20',
  interestRate: 6.5,
  manualInterest: 15000,
  manualPenalty: 2000,
  courtName: '臺中'
});
assert.strictEqual(paymentOrderDoc.includes('民事支付命令聲請狀'), true);
assert.strictEqual(paymentOrderDoc.includes('新臺幣貳拾貳萬柒仟元整'), true); // 210000 + 15000 + 2000 = 227000
assert.strictEqual(paymentOrderDoc.includes('民事訴訟法第 508 條'), true);
assert.strictEqual(paymentOrderDoc.includes('臺灣 臺中 地方法院'), true);
console.log('  ✅ 支付命令聲請狀生成全部通過');

// 5. 測試強制執行聲請狀 (含保險與存款扣押)
console.log('\n5. 測試強制執行聲請狀 (generateExecutionDoc)');
const execDoc = generateExecutionDoc({
  creditorName: '有限責任臺中市第一儲蓄互助社',
  debtorName: '張大同',
  principal: 210000,
  courtName: '臺中',
  targets: {
    bankDeposit: true,
    insurance: true,
    salary: true,
    taxData: true,
    realEstate: false
  }
});
assert.strictEqual(execDoc.includes('民事強制執行聲請狀'), true);
assert.strictEqual(execDoc.includes('最高法院 108 年度台抗大字第 897 號'), true);
assert.strictEqual(execDoc.includes('中華民國人壽保險商業同業公會'), true);
assert.strictEqual(execDoc.includes('中華民國銀行商業同業公會全國聯合會'), true);
assert.strictEqual(execDoc.includes('強制執行法第 115 條之 1'), true);
console.log('  ✅ 強制執行聲請狀（保單解約金與金融存款扣押）全部通過');

// 6. 測試換發債權憑證狀生成
console.log('\n6. 測試換發債權憑證狀 (generateRenewCertificateDoc)');
const renewDoc = generateRenewCertificateDoc({
  creditorName: '有限責任臺中市第一儲蓄互助社',
  debtorName: '張大同',
  principal: 210000,
  caseYear: 111,
  caseWord: '司執',
  caseNo: '12345',
  courtName: '臺中'
});
assert.strictEqual(renewDoc.includes('民事聲請換發債權憑證狀'), true);
assert.strictEqual(renewDoc.includes('強制執行法第 27 條'), true);
assert.strictEqual(renewDoc.includes('民法第 137 條第 3 項'), true);
console.log('  ✅ 換發債權憑證狀生成全部通過');

// 7. 測試 iCalendar (.ics) 鬧鐘生成
console.log('\n7. 測試 iCalendar (.ics) 檔案格式');
const icsOutput = generateICSContent([{
  id: 'test_1',
  debtorName: '張大同',
  certNo: '111 司執 12345',
  principal: 210000,
  issueDate: '2022-05-10',
  expiryDateStr: '2027-05-10'
}]);
assert.strictEqual(icsOutput.includes('BEGIN:VCALENDAR'), true);
assert.strictEqual(icsOutput.includes('BEGIN:VALARM'), true);
assert.strictEqual(icsOutput.includes('TRIGGER:-P180D'), true); // 6個月前鬧鐘
assert.strictEqual(icsOutput.includes('TRIGGER:-P90D'), true);  // 3個月前鬧鐘
assert.strictEqual(icsOutput.includes('END:VCALENDAR'), true);
console.log('  ✅ iCalendar (.ics) 鬧鐘推播格式全部通過');

console.log('\n🎉 所有核心單元測試驗證通過！');
