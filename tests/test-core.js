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
  formatRocDate,
  addDaysToDateStr,
  calcPostalLetterLayout
} = require('../js/core-legal');

const { findCourtByAddress } = require('../js/court-data');

const {
  MIN_LIVING_EXPENSES_115,
  calculateSalaryGarnishment,
  getMinLivingStandard,
  deriveLivingRegionFromAddress
} = require('../js/salary-calc');

const {
  generatePaymentOrderDoc,
  generateExecutionDoc,
  generateRenewCertificateDoc,
  generateOffsetShareDoc,
  generateOffsetBoardResolutionDoc,
  generatePaymentOrderFinalDoc,
  parseThirdPartiesText,
  generateDemandLetterDoc,
  generateOffsetLetterDoc,
  parsePartiesText
} = require('../js/templates');

const { generateICSContent, generateNoticeDeadlineICS } = require('../js/storage');
const { APP_CONFIG } = require('../js/config');

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

// 5. 測試公文書狀生成 (司法訴訟與股金抵銷公文)
console.log('\n5. 測試公文範本庫');

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

// 5.3 換發／核發憑證（依執行名義種類決定）
const renewDoc = generateRenewCertificateDoc({
  creditorName: '有限責任臺中市第一儲蓄互助社',
  debtorName: '張大同',
  principal: 210000,
  courtName: '臺中',
  titleType: 'cert'
});
assert.strictEqual(renewDoc.includes('民事聲請換發債權憑證狀'), true);
assert.strictEqual(renewDoc.includes('債權憑證正本一份'), true);
const issueDoc = generateRenewCertificateDoc({
  creditorName: '有限責任臺中市第一儲蓄互助社',
  debtorName: '張大同',
  principal: 210000,
  courtName: '臺中',
  titleType: 'payment_order'
});
assert.strictEqual(issueDoc.includes('民事聲請核發債權憑證狀'), true);
assert.strictEqual(issueDoc.includes('支付命令及確定證明書正本各一份'), true);

// 5.4 股金抵銷通知書（依本社章程；《儲蓄互助社法》第 14 條是退股程序，不可引為抵銷依據）
const offsetDoc = generateOffsetShareDoc({
  creditorName: '有限責任臺中市第一儲蓄互助社',
  debtorName: '張大同',
  principal: 100000,
  shareAmount: 60000,
  dividendAmount: 3000,
  bylawArticle: '第十七條'
});
assert.strictEqual(offsetDoc.includes('本社章程第 十七 條'), true);
assert.strictEqual(offsetDoc.includes('儲蓄互助社法'), false);
assert.strictEqual(offsetDoc.includes('抵銷後剩餘欠款：新臺幣 37,000 元整'), true);

// 5.5 股金抵銷簽呈
const boardDoc = generateOffsetBoardResolutionDoc({
  creditorName: '有限責任臺中市第一儲蓄互助社',
  debtorName: '張大同',
  principal: 100000,
  shareAmount: 60000
});
assert.strictEqual(boardDoc.includes('行使股金抵銷權案'), true);

console.log('  ✅ 公文範本生成全部通過');

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

// 10. 迴歸測試：金額／日期前綴重複、假資料、管轄法院、利息起算日
console.log('\n10. 迴歸測試：書狀內容正確性');

const fullData = {
  creditorName: '有限責任臺中市第一儲蓄互助社', debtorName: '王小明', principal: 200000, loanAmount: 300000,
  interestRate: 12, loanDate: '2022-01-10', lastPaymentDate: '2023-05-10', interestStartDate: '2023-05-11',
  manualInterest: 5000, manualPenalty: 1000, shareAmount: 60000, dividendAmount: 3000, courtName: '臺中',
  targets: { bankDeposit: true, insurance: true, salary: true, taxData: true }
};
const allGenerators = {
  generatePaymentOrderDoc, generateExecutionDoc, generateRenewCertificateDoc, generateOffsetShareDoc,
  generateOffsetBoardResolutionDoc, generatePaymentOrderFinalDoc, generateDemandLetterDoc, generateOffsetLetterDoc
};
// 10.1 toChineseCurrency 已含「新臺幣」，範本不得再加一次；「民國」亦同
Object.entries(allGenerators).forEach(([name, gen]) => {
  [fullData, {}].forEach(data => {
    const out = gen(data);
    assert.strictEqual(/新臺幣\s*新臺幣/.test(out), false, `${name} 出現「新臺幣 新臺幣」`);
    assert.strictEqual(/民國\s*民國/.test(out), false, `${name} 出現「民國 民國」`);
    assert.strictEqual(out.includes('undefined') || out.includes('NaN'), false, `${name} 輸出含 undefined/NaN`);
  });
});

// 10.2 欄位全空時以「○」待填，不得印出假資料或默默採用預設值
const blankPay = generatePaymentOrderDoc({});
['張大同', 'B123456789', '12345 號', '臺北', '臺中'].forEach(fake => {
  assert.strictEqual(blankPay.includes(fake), false, `空白支付命令不應出現預設值「${fake}」`);
});
assert.strictEqual(blankPay.includes('民國 ○○ 年 ○○ 月 ○○ 日'), true);
assert.strictEqual(blankPay.includes('臺灣 ○○ 地方法院'), true);
assert.strictEqual(blankPay.includes('年息百分之 ○○'), true);
assert.strictEqual(blankPay.includes('年息百分之 0 '), false);
const blankExec = generateExecutionDoc({});
assert.strictEqual(blankExec.includes('執行規費：新臺幣 ○○○ 元'), true);
assert.strictEqual(blankExec.includes('未滿五千元免徵'), false);
const blankRenew = generateRenewCertificateDoc({});
assert.strictEqual(blankRenew.includes('○○ 年度 ○○ 字第 ○○○○ 號'), true);

// 10.3 沒有保證人時不得寫「連帶」
const noGuarantor = generatePaymentOrderDoc({ ...fullData, hasGuarantor: false });
assert.strictEqual(noGuarantor.includes('連帶'), false);
const withGuarantor = generatePaymentOrderDoc({ ...fullData, hasGuarantor: true, guarantorName: '李小華' });
assert.strictEqual(withGuarantor.includes('命其連帶清償'), true);

// 10.4 利息起算日：使用傳入值，未傳入時退回最後繳息日（不得固定成某個日期）
const payA = generatePaymentOrderDoc({ ...fullData, interestStartDate: '2024-03-02' });
assert.strictEqual(payA.includes('民國 113 年 3 月 2 日 起至清償日止'), true);
assert.strictEqual(addDaysToDateStr('2023-11-20', 1), '2023-11-21');
assert.strictEqual(addDaysToDateStr('2023-12-31', 1), '2024-01-01');
assert.strictEqual(addDaysToDateStr('2024-02-28', 1), '2024-02-29');
assert.strictEqual(addDaysToDateStr('', 1), '');

// 10.5 執行名義種類與殘留的「（或…）」選項
const execCert = generateExecutionDoc({ ...fullData, titleType: 'cert', titleCaseNo: '110 年度司執字第 1 號' });
assert.strictEqual(execCert.includes('債權憑證正本一份'), true);
// 執行名義與證物不得再留「（或…）」讓使用者自行刪改（薪資條款內的「（或…）」留待依附件重寫）
const titleSection = execCert.split('執行名義：')[1].split('實施強制執行之標的')[0];
assert.strictEqual(titleSection.includes('（或'), false);
assert.strictEqual(titleSection.includes('債權憑證'), true);
assert.strictEqual(generateExecutionDoc(fullData).includes('支付命令及確定證明書正本各一份'), true);
assert.strictEqual(renewDoc.includes('（或'), false);
assert.strictEqual(renewDoc.includes('證物名稱及件數'), true);

// 10.6 管轄法院比對：「台」「臺」皆可；查無時回傳 null，不得預設臺北
assert.strictEqual(findCourtByAddress('臺中市西區五權路 50 號').name, '臺中');
assert.strictEqual(findCourtByAddress('台中市西區五權路 50 號').name, '臺中');
assert.strictEqual(findCourtByAddress('台南市東區').name, '臺南');
assert.strictEqual(findCourtByAddress('台北市大安區').name, '臺北');
assert.strictEqual(findCourtByAddress('某某路 1 號'), null);
assert.strictEqual(findCourtByAddress(''), null);
console.log('  ✅ 書狀內容正確性迴歸測試通過');

// 11. 第二批：存證信函、確定證明書、支付命令變體、股金抵銷
console.log('\n11. 第二批功能：存證信函與書狀變體');

const batch2 = {
  creditorName: '有限責任臺中市第一儲蓄互助社', creditorRep: '陳理事長', creditorAddress: '臺中市西區民生路 100 號',
  debtorName: '王小明', debtorId: 'B123456789', debtorAddress: '臺中市西區五權路 50 號',
  principal: 200000, loanAmount: 300000, loanDate: '2022-01-10', lastPaymentDate: '2023-05-10', interestStartDate: '2023-05-11',
  interestRate: '12', courtName: '臺中', manualInterest: 5000, manualPenalty: 1000, bylawArticle: '第十七條'
};
const withGuarantor2 = { ...batch2, hasGuarantor: true, guarantorName: '李小華', guarantorId: 'L223456789', guarantorAddress: '臺中市南屯區大墩路 80 號' };

// 11.1 存證信函（清償債務催告）：內文須與附件原文一致
const letter1 = generateDemandLetterDoc(withGuarantor2);
assert.strictEqual(letter1.includes('敬啟者　台端於民國111年1月10日向本社借貸新台幣參拾萬元整，至今仍有本金新台幣貳拾萬元整及利息、違約金尚未清償，'), true);
assert.strictEqual(letter1.includes('謹此函告　台端請於函到七日內至本社處理，否則將依法訴訟請求，事涉台端權益，請惠予配合為禱，以免訟累。'), true);
assert.strictEqual(letter1.includes('三、副本收件人\n姓名：李小華'), true);
assert.strictEqual(generateDemandLetterDoc(batch2).includes('副本收件人'), false);
assert.strictEqual(generateDemandLetterDoc({}).includes('民國○○年○○月○○日'), true);

// 11.2 存證信函（股金扣除貸款）：含章程條次，條次未填時以「○○」待填
const letter2 = generateOffsetLetterDoc(batch2);
assert.strictEqual(letter2.includes('經法院訴訟已於執行階段，目前仍有股金尚未扣除貸款，依本社章程十七條，將以股金扣除貸款後續行執行法催程序，謹此函告　台端若有異議請於函到七日內至本社處理'), true);
assert.strictEqual(generateOffsetLetterDoc({ ...batch2, bylawArticle: '十七' }).includes('本社章程十七條'), true);
assert.strictEqual(generateOffsetLetterDoc({ ...batch2, bylawArticle: '' }).includes('本社章程○○條'), true);
assert.strictEqual(letter2.includes('儲蓄互助社法'), false);

// 11.3 郵局用紙排版試算：每行 20 字、每頁 10 行，段落另起一行，半形空白不佔格
const l200 = calcPostalLetterLayout('字'.repeat(200));
assert.strictEqual(l200.lineCount, 10);
assert.strictEqual(l200.pageCount, 1);
assert.strictEqual(calcPostalLetterLayout('字'.repeat(201)).pageCount, 2);
assert.strictEqual(calcPostalLetterLayout('一二三\n四五六').lineCount, 2);
assert.strictEqual(calcPostalLetterLayout('一 二 三').charCount, 3);
assert.strictEqual(calcPostalLetterLayout('敬啟者　台端').charCount, 6); // 全形空白佔一格
assert.strictEqual(calcPostalLetterLayout('').pageCount, 1);

// 11.4 催告 6 個月起訴期限鬧鐘
const noticeIcs = generateNoticeDeadlineICS({ debtorName: '王,小明', noticeDateStr: '2026-10-05', expiryDateStr: '2027-04-05' });
assert.strictEqual(noticeIcs.includes('DTSTART;VALUE=DATE:20270405'), true);
assert.strictEqual(noticeIcs.includes('TRIGGER:-P30D') && noticeIcs.includes('TRIGGER:-P7D'), true);
assert.strictEqual(noticeIcs.includes('王\\,小明'), true); // 逗號須逸出
noticeIcs.split('\r\n').forEach(l => assert.strictEqual(Buffer.byteLength(l, 'utf8') <= 76, true));

// 11.5 確定證明書狀
const finalDoc = generatePaymentOrderFinalDoc({ ...withGuarantor2, titleCaseNo: '112 年度司促字第 123 號', orderIssueDate: '2023-08-15' });
assert.strictEqual(finalDoc.includes('民事聲請支付命令確定證明書狀'), true);
assert.strictEqual(finalDoc.includes('聲請人與王小明、李小華間因 112 年度司促字第 123 號 事件，經 貴院於 民國 112 年 8 月 15 日 核發支付命令，並已確定在案'), true);
assert.strictEqual(finalDoc.includes('依民事訴訟法第 521 條、第 399 條第 1 項規定，聲請 貴院付與該支付命令確定證明書'), true);
const finalDeceased = generatePaymentOrderFinalDoc({ ...batch2, debtorDeceased: true, heirs: '王大明｜C111111111｜臺北市\n王小華' });
assert.strictEqual(finalDeceased.includes('聲請人與王大明、王小華間'), true);

// 11.6 支付命令：稱謂、違約金比例
const pay1 = generatePaymentOrderDoc({ ...withGuarantor2, penaltyRatio: '20' });
assert.strictEqual(pay1.includes('債權人：') && pay1.includes('債務人（即連帶保證人）：李小華'), true);
assert.strictEqual(pay1.includes('相對人') || pay1.includes('聲請人（即債權人）'), false);
assert.strictEqual(pay1.includes('按年息百分之 12 計算之利息，並按上開利息百分之 20 計算之違約金。'), true);
const pay1b = generatePaymentOrderDoc({ ...batch2, penaltyRatio: '20', penaltyStartDate: '2023-06-01' });
assert.strictEqual(pay1b.includes('並自 民國 112 年 6 月 1 日 起至清償日止，按上開利息百分之 20 計算之違約金'), true);
assert.strictEqual(generatePaymentOrderDoc(batch2).includes('上開利息百分之'), false); // 未填違約金比例就不寫
assert.strictEqual(pay1.includes('500 元郵局匯票一紙'), true);

// 11.7 支付命令：利率經理事會調整（證物編號須與內文引用一致）
const pay2 = generatePaymentOrderDoc({ ...withGuarantor2, penaltyRatio: '10', rateChanged: true, origRate: '10', origPenaltyRatio: '10', rateChangeDate: '2022-09-01' });
assert.strictEqual(pay2.includes('原借據約定借款利率為按年息百分之 10 計算之利息，並按上開利息百分之 10 計算之違約金，惟債權人理事會於 民國 111 年 9 月 1 日 決議調整借款利率為按年息百分之 12'), true);
assert.strictEqual(pay2.includes('（見證物二）'), true);
assert.strictEqual(pay2.includes('二、債權人利息、違約金變動理事會紀錄影本一份。'), true);
assert.strictEqual(generatePaymentOrderDoc(batch2).includes('理事會'), false);

// 11.8 支付命令：以切結書為憑
const pay3 = generatePaymentOrderDoc({ ...withGuarantor2, basisType: 'affidavit' });
assert.strictEqual(pay3.includes('與債權人簽立切結書，願分期按月償還'), true);
assert.strictEqual(pay3.includes('還款切結書影本一份'), true);
assert.strictEqual(pay3.includes('借款新臺幣'), false);

// 11.9 支付命令：債務人死亡，繼承人於遺產範圍內連帶（附件〈支付命令（債務人死亡）〉）
const pay4 = generatePaymentOrderDoc({ ...withGuarantor2, debtorDeceased: true, deceasedDate: '2024-01-10', heirs: '王大明｜C111111111｜臺北市大安區\n王小華｜D222222222｜新北市板橋區' });
assert.strictEqual(pay4.includes('債務人：王大明（即 王小明 之繼承人）'), true);
assert.strictEqual(pay4.includes('債務人 王大明、王小華 應於繼承被繼承人 王小明 所得遺產範圍內與債務人 李小華 連帶給付債權人'), true);
assert.strictEqual(pay4.includes('命其於繼承所得遺產範圍內連帶清償'), true);
assert.strictEqual(pay4.includes('已於 民國 113 年 1 月 10 日 死亡'), true);
assert.strictEqual(pay4.includes('家事事件公告網路查詢資料一份'), true);
// 證物順序：借據、匯票、家事公告；內文引用的證物編號須對得上
assert.strictEqual(pay4.includes('詳證物三') && pay4.includes('三、家事事件公告網路查詢資料一份。'), true);
// 沒有保證人時，繼承人之間仍為連帶
const pay4b = generatePaymentOrderDoc({ ...batch2, debtorDeceased: true, heirs: '王大明' });
assert.strictEqual(pay4b.includes('於繼承被繼承人 王小明 所得遺產範圍內連帶給付'), true);

// 11.10 多位連帶保證人（欄位 + 其他保證人文字框）
const pay5 = generatePaymentOrderDoc({ ...withGuarantor2, extraParties: '陳大文｜A123456789｜臺中市北區三民路 1 號' });
assert.strictEqual(pay5.includes('債務人（即連帶保證人）：陳大文'), true);
assert.strictEqual(pay5.includes('並有債務人 李小華、陳大文 為連帶保證人，依法應負連帶清償責任'), true);
assert.strictEqual(generateExecutionDoc({ ...withGuarantor2, extraParties: '陳大文' }).includes('債務人（即連帶保證人）：陳大文'), true);
assert.strictEqual(generateRenewCertificateDoc({ ...withGuarantor2, extraParties: '陳大文' }).includes('債務人（即連帶保證人）：陳大文'), true);
assert.strictEqual(generatePaymentOrderDoc({ ...batch2, hasGuarantor: false, extraParties: '陳大文' }).includes('陳大文'), false); // 未勾選保證人不帶入
assert.deepStrictEqual(parsePartiesText('甲｜A1｜台北\n\n乙, B2 ,新北\n丙'), [
  { name: '甲', id: 'A1', address: '台北' }, { name: '乙', id: 'B2', address: '新北' }, { name: '丙', id: '', address: '' }
]);

// 11.11 股金抵銷簽呈：不得有假專職姓名、假逾期月數
const boardBlank = generateOffsetBoardResolutionDoc({});
assert.strictEqual(boardBlank.includes('李專職') || boardBlank.includes('陳理事長'), false);
assert.strictEqual(boardBlank.includes('累計逾期已逾 ○ 個月'), true);
assert.strictEqual(/累計逾期已逾 \d+ 個月/.test(generateOffsetBoardResolutionDoc({ lastPaymentDate: '2020-01-01' })), true);
assert.strictEqual(generateOffsetBoardResolutionDoc({ bylawArticle: '十七' }).includes('本社章程第 十七 條'), true);
assert.strictEqual(generateOffsetBoardResolutionDoc({ bylawArticle: '十七' }).includes('儲蓄互助社法'), false);

// 11.12 設定：啟用清單涵蓋新公文，且每一種都有對應範本
['demand_letter', 'offset_letter', 'payment_order_final', 'offset_share', 'offset_board'].forEach(t => {
  assert.strictEqual(APP_CONFIG.ENABLED_DOC_TYPES.includes(t), true, `未啟用 ${t}`);
});
assert.strictEqual(APP_CONFIG.ENABLED_DOC_TYPES[0], 'payment_order'); // 預設仍為支付命令
console.log('  ✅ 第二批功能測試通過');

// 12. 第三批：強制執行狀（單一書狀、依標的補第三人）與債權憑證變體
console.log('\n12. 第三批功能：強制執行狀與債權憑證');

// 12.1 最低生活費 1.2 倍：由地址判斷區域（台／臺皆可），金額與扣薪試算同一份標準
assert.strictEqual(getMinLivingStandard('taichung').standard1_2, 19717);
assert.strictEqual(getMinLivingStandard('taipei').standard1_2, 24893);
assert.strictEqual(getMinLivingStandard('不存在'), null);
assert.strictEqual(deriveLivingRegionFromAddress('台中市西區五權路 50 號'), 'taichung');
assert.strictEqual(deriveLivingRegionFromAddress('臺北市大安區'), 'taipei');
assert.strictEqual(deriveLivingRegionFromAddress('新北市板橋區'), 'new_taipei');
assert.strictEqual(deriveLivingRegionFromAddress('高雄市左營區'), 'kaohsiung');
assert.strictEqual(deriveLivingRegionFromAddress('金門縣金城鎮'), 'kinmen_lienchiang');
assert.strictEqual(deriveLivingRegionFromAddress('彰化縣員林市'), 'taiwan_province');
assert.strictEqual(deriveLivingRegionFromAddress('嘉義市東區'), 'taiwan_province');
assert.strictEqual(deriveLivingRegionFromAddress(''), '');
assert.strictEqual(deriveLivingRegionFromAddress('某某路 1 號'), '');

const allTargets = {
  bankDeposit: true, bankList: '合作金庫商業銀行臺中分行｜臺中市西區某路 1 號\n玉山銀行臺中分行',
  postOffice: true, postRep: '郵政代理人', salary: true, employerName: '宏達企業社', employerAddress: '臺中市北區某路 2 號',
  employerRep: '雇主代理人', salaryStartMonth: '2026-11', livingRegion: 'taichung', laborInsurance: true, insurance: true,
  stock: true, stockRep: '集保代理人', movables: true, vehiclePlate: 'ABC-1234', taxData: false,
  realEstate: true, realEstateList: '土地：臺中市西區某段 1 地號，權利範圍：全部'
};
const exec1 = generateExecutionDoc({ ...withGuarantor2, penaltyRatio: '20', titleCaseNo: '112 年度司促字第 123 號', targets: allTargets });

// 12.2 聲請執行之事項（沿用附件結構）：債務、違約金、費用
assert.strictEqual(exec1.includes('聲請執行之事項：\n一、債務人等應連帶給付債權人新臺幣貳拾萬元整（小寫：200,000 元），及自 民國 112 年 5 月 11 日 起至清償日止，按年息百分之 12 計算之利息，並按上開利息百分之 20 計算之違約金。'), true);
assert.strictEqual(exec1.includes('三、執行程序費用由債務人等連帶負擔。'), true);

// 12.3 第三人當事人：雇主、各銀行、中華郵政、集保；郵政與集保的法定代理人由使用者填，不內建
assert.strictEqual(exec1.includes('第三人：宏達企業社\n設址：臺中市北區某路 2 號\n法定代理人：雇主代理人'), true);
assert.strictEqual(exec1.includes('第三人：合作金庫商業銀行臺中分行\n設址：臺中市西區某路 1 號'), true);
assert.strictEqual(exec1.includes('第三人：玉山銀行臺中分行'), true);
assert.strictEqual(exec1.includes('第三人：中華郵政股份有限公司\n統一編號：3741302'), true);
assert.strictEqual(exec1.includes('法定代理人：郵政代理人'), true);
assert.strictEqual(exec1.includes('第三人：臺灣集中保管結算所股份有限公司\n統一編號：23474232'), true);
assert.strictEqual(exec1.includes('游芳來') || exec1.includes('林修銘'), false);
const execNoRep = generateExecutionDoc({ ...batch2, targets: { postOffice: true, stock: true } });
assert.strictEqual((execNoRep.match(/法定代理人：○○○/g) || []).length, 2); // 未填的法定代理人以「○○○」待填
assert.strictEqual(execNoRep.includes('第三人：宏達'), false);

// 12.4 薪資：扣 1/3、按月移轉、保留 1.2 倍（金額自動帶入）、起扣月份
assert.strictEqual(exec1.includes('債務人現服務於第三人宏達企業社處，每月領有薪資，請扣押債務人之薪水三分之一，並准將債務人對於第三人之債權自 115 年 11 月份 起按月移轉於債權人，以資清償。'), true);
assert.strictEqual(exec1.includes('債權人同意保留債務人居住地每人每月最低生活費之 1.2 倍（即 19,717 元）供債務人維持生活'), true);
assert.strictEqual(exec1.includes('債務人僅請求就「超過」該數額部分實施扣押'), true);
const execSalaryBlank = generateExecutionDoc({ ...batch2, targets: { salary: true } });
assert.strictEqual(execSalaryBlank.includes('自 ○○ 年 ○ 月份 起'), true);
assert.strictEqual(execSalaryBlank.includes('（即 ○○○ 元）'), true); // 區域未知時不得猜金額
assert.strictEqual(execSalaryBlank.includes('第三人○○○處'), true);

// 12.5 各標的措辭
assert.strictEqual(exec1.includes('請就債務人王小明存放於第三人合作金庫商業銀行臺中分行之存款，於債權人聲請執行之債權範圍內予以扣押。'), true);
assert.strictEqual(exec1.includes('請惠允函詢第三人中華郵政股份有限公司覆明債務人持有存款之受託存款郵局資料後，准向查得之郵局執行債務人持有之存款。'), true);
assert.strictEqual(exec1.includes('請准予以勞動部勞工保險局電子閘門網路資料查明債務人任職之投保單位'), true);
assert.strictEqual(exec1.includes('行政院勞工委員會'), false); // 機關已更名
assert.strictEqual(exec1.includes('函囑第三人臺灣集中保管結算所股份有限公司陳報債務人王小明應受保管之股票及有價證券名稱'), true);
assert.strictEqual(exec1.includes('且囑令不得對債務人為清償，僅得對債權人清償'), true);
assert.strictEqual(exec1.includes('請查封、拍賣債務人王小明所有於門牌號碼 臺中市西區五權路 50 號 內之動產，及債務人所有車牌號碼 ABC-1234 之車輛一輛。'), true);
assert.strictEqual(exec1.includes('土地：臺中市西區某段 1 地號，權利範圍：全部') && exec1.includes('亦應一併查封'), true);
assert.strictEqual(exec1.includes('最高法院 108 年度台抗大字第 897 號'), true);
// 未指名銀行時，改為囑託銀行公會查調
assert.strictEqual(generateExecutionDoc({ ...batch2, targets: { bankDeposit: true } }).includes('囑託【中華民國銀行商業同業公會全國聯合會】'), true);
// 舊欄位 bankName 仍相容
assert.strictEqual(generateExecutionDoc({ ...batch2, targets: { bankDeposit: true, bankName: '合作金庫' } }).includes('第三人：合作金庫'), true);

// 12.6 證物：依所勾標的產生，編號與內文「詳證物」一致
const exhibitSection = exec1.split('證物名稱及件數：\n')[1].split('\n\n')[0];
assert.strictEqual(exhibitSection, [
  '一、支付命令及確定證明書正本各一份。', '二、債務人國稅局所得（財產）清單影本一份。', '三、第三人公示查詢資料一份。',
  '四、債務人戶籍謄本一份。', '五、債務人所有土地（建物）登記簿謄本一份。', '六、最高法院 108 年度台抗大字第 897 號民事大法庭裁定要旨一份。'
].join('\n'));
assert.strictEqual(exec1.includes('（詳證物五）'), true);
assert.strictEqual(exec1.includes('執行規費繳納收據'), false);
// 勾選國稅局查調時，債權人手上還沒有所得清單，不列為證物
assert.strictEqual(generateExecutionDoc({ ...batch2, targets: { salary: true, taxData: true } }).includes('國稅局所得（財產）清單影本'), false);

// 12.7 項目超過十項時序號仍正確（多家存款銀行）
const manyBanks = Array.from({ length: 12 }, (_, i) => `銀行${i + 1}｜地址`).join('\n');
const execMany = generateExecutionDoc({ ...batch2, targets: { bankDeposit: true, bankList: manyBanks } });
assert.strictEqual(execMany.includes('undefined'), false);
assert.strictEqual(execMany.includes('十二、請就債務人王小明存放於第三人銀行12之存款'), true);
assert.deepStrictEqual(parseThirdPartiesText('甲銀行｜台北市\n\n乙銀行'), [
  { name: '甲銀行', address: '台北市', rep: '' }, { name: '乙銀行', address: '', rep: '' }
]);

// 12.8 強執狀：債務人死亡，繼承人為債務人
const execDeceased = generateExecutionDoc({ ...batch2, debtorDeceased: true, heirs: '王大明｜C111111111｜臺北市', targets: { bankDeposit: true } });
assert.strictEqual(execDeceased.includes('債務人：王大明（即 王小明 之繼承人）'), true);
assert.strictEqual(execDeceased.includes('應於繼承被繼承人 王小明 所得遺產範圍內連帶給付債權人'), true);
assert.strictEqual(execDeceased.includes('家事事件公告網路查詢資料一份'), true);

// 12.9 債權憑證：聲請原因（查無財產／已離職）、債務人死亡、核發與換發
const renewBase = { ...batch2, caseYear: '113', caseWord: '司執', caseNo: '12345', caseSection: '忠', titleCaseNo: '110 年度司執字第 1 號' };
const renewResigned = generateRenewCertificateDoc({ ...renewBase, titleType: 'cert', renewReason: 'resigned', resignedEmployer: '宏達企業社' });
assert.strictEqual(renewResigned.includes('民事聲請換發債權憑證狀'), true);
assert.strictEqual(renewResigned.includes('其原任職於第三人宏達企業社，業已離職，又目前查無其他可供強制執行之財產'), true);
assert.strictEqual(renewResigned.includes('業經 鈞院核發 110 年度司執字第 1 號 債權憑證在案'), true);
const renewDefault = generateRenewCertificateDoc({ ...renewBase, titleType: 'payment_order' });
assert.strictEqual(renewDefault.includes('又目前查無可供強制執行之財產'), true);
assert.strictEqual(renewDefault.includes('業已離職'), false);
assert.strictEqual(renewDefault.includes('民事聲請核發債權憑證狀'), true);
const renewDeceased = generateRenewCertificateDoc({ ...renewBase, titleType: 'payment_order', debtorDeceased: true, deceasedDate: '2024-01-10', heirs: '王大明｜C111111111｜臺北市' });
assert.strictEqual(renewDeceased.includes('債務人：王大明（即 王小明 之繼承人）'), true);
assert.strictEqual(renewDeceased.includes('惟原債務人 王小明 已於 民國 113 年 1 月 10 日 死亡，於其繼承人未為相關權利主張時（詳證物二）'), true);
assert.strictEqual(renewDeceased.includes('二、家事事件公告網路查詢資料一份。'), true);
assert.strictEqual(renewDefault.includes('（或'), false);
console.log('  ✅ 第三批功能測試通過');

console.log('\n🎉 所有全面升級單元測試全數驗證通過！');
