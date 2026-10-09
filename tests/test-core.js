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
  calcPostalLetterLayout,
  validatePenaltyRatio
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
  generatePaymentOrderFinalDoc,
  parseThirdPartiesText,
  generateDemandLetterDoc,
  generateOffsetLetterDoc,
  parsePartiesText
} = require('../js/templates');

const { generateICSContent, generateNoticeDeadlineICS, buildWordDocHtml } = require('../js/storage');
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
  creditorName: '臺中市第一儲蓄互助社',
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
  creditorName: '臺中市第一儲蓄互助社',
  debtorName: '張大同',
  principal: 210000,
  courtName: '臺中',
  targets: { bankDeposit: true, insurance: true, salary: true, taxData: true }
});
assert.strictEqual(execDoc.includes('最高法院 108 年度台抗大字第 897 號'), true);
assert.strictEqual(execDoc.includes('中華民國人壽保險商業同業公會'), true);

// 5.3 換發／核發憑證（依執行名義種類決定）
const renewDoc = generateRenewCertificateDoc({
  creditorName: '臺中市第一儲蓄互助社',
  debtorName: '張大同',
  principal: 210000,
  courtName: '臺中',
  titleType: 'cert'
});
assert.strictEqual(renewDoc.includes('民事聲請換發債權憑證狀'), true);
assert.strictEqual(renewDoc.includes('債權憑證正本一份'), true);
const issueDoc = generateRenewCertificateDoc({
  creditorName: '臺中市第一儲蓄互助社',
  debtorName: '張大同',
  principal: 210000,
  courtName: '臺中',
  titleType: 'payment_order'
});
assert.strictEqual(issueDoc.includes('民事聲請核發債權憑證狀'), true);
assert.strictEqual(issueDoc.includes('支付命令及確定證明書正本各一份'), true);

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
  creditorName: '臺中市第一儲蓄互助社', debtorName: '王小明', principal: 200000, loanAmount: 300000,
  interestRate: 12, loanDate: '2022-01-10', lastPaymentDate: '2023-05-10', interestStartDate: '2023-05-11',
  manualInterest: 5000, manualPenalty: 1000, shareAmount: 60000, dividendAmount: 3000, courtName: '臺中',
  targets: { bankDeposit: true, insurance: true, salary: true, taxData: true }
};
const allGenerators = {
  generatePaymentOrderDoc, generateExecutionDoc, generateRenewCertificateDoc,
  generatePaymentOrderFinalDoc, generateDemandLetterDoc, generateOffsetLetterDoc
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
  creditorName: '臺中市第一儲蓄互助社', creditorRep: '陳理事長', creditorAddress: '臺中市西區民生路 100 號',
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
// 協會《儲蓄互助社章程範例》第 17 條：股金抵充須經理事會討論通過，信函載明決議日（未填以「○」待填）
assert.strictEqual(letter2.includes('經法院訴訟已於執行階段，目前仍有股金尚未扣除貸款，依本社章程十七條，經本社理事會民國○○年○○月○○日討論通過，將以股金扣除貸款後續行執行法催程序，謹此函告　台端若有異議請於函到七日內至本社處理'), true);
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
assert.strictEqual(finalDoc.includes('依民事訴訟法第 521 條第 2 項、第 399 條第 1 項及第 4 項規定，聲請 貴院付與該支付命令確定證明書'), true);
assert.strictEqual(finalDoc.includes('第 521 條、第 399 條第 1 項規定'), false); // 舊寫法（現行 §521 II 才是付與裁定確定證明書）
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

// 11.12 設定：啟用清單涵蓋新公文，且每一種都有對應範本
['demand_letter', 'offset_letter', 'payment_order_final'].forEach(t => {
  assert.strictEqual(APP_CONFIG.ENABLED_DOC_TYPES.includes(t), true, `未啟用 ${t}`);
});
// 股金抵銷通知書、簽呈已移除：股金扣除貸款只出現在已進入執行階段，改以存證信函辦理
['offset_share', 'offset_board'].forEach(t => {
  assert.strictEqual(APP_CONFIG.ENABLED_DOC_TYPES.includes(t), false, `${t} 不應再啟用`);
});
assert.strictEqual(APP_CONFIG.ENABLED_DOC_TYPES[0], 'payment_order'); // 預設仍為支付命令
console.log('  ✅ 第二批功能測試通過');

// 12. 第三批：強制執行狀（單一書狀、依標的補第三人）與債權憑證變體
console.log('\n12. 第三批功能：強制執行狀與債權憑證');

// 12.1 最低生活費 1.2 倍：由地址判斷區域（台／臺皆可），金額與扣薪試算同一份標準
assert.strictEqual(getMinLivingStandard('taichung').standard1_2, 19717);
assert.strictEqual(getMinLivingStandard('taipei').standard1_2, 24893);
assert.strictEqual(getMinLivingStandard('kinmen_lienchiang').standard1_2, 18208);
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
assert.strictEqual(exec1.includes('第三人：中華郵政股份有限公司\n統一編號：03741302'), true); // 附件漏了開頭的 0，依商工登記
assert.strictEqual(exec1.includes('法定代理人：郵政代理人'), true);
assert.strictEqual(exec1.includes('第三人：臺灣集中保管結算所股份有限公司\n統一編號：23474232'), true);
assert.strictEqual(exec1.includes('游芳來') || exec1.includes('林修銘'), false);
const execNoRep = generateExecutionDoc({ ...batch2, targets: { postOffice: true, stock: true } });
assert.strictEqual((execNoRep.match(/法定代理人：○○○/g) || []).length, 2); // 未填的法定代理人以「○○○」待填
assert.strictEqual(execNoRep.includes('第三人：宏達'), false);

// 12.4 薪資：扣 1/3、按月移轉、保留 1.2 倍（金額自動帶入）、起扣月份
assert.strictEqual(exec1.includes('債務人現服務於第三人宏達企業社處，每月領有薪資，請扣押債務人之薪水三分之一，並准將債務人對於第三人之債權自 115 年 11 月份 起按月移轉於債權人，以資清償。'), true);
assert.strictEqual(exec1.includes('債權人同意保留債務人居住地每人每月最低生活費之 1.2 倍（即 19,717 元）供債務人維持生活'), true);
assert.strictEqual(exec1.includes('債權人僅請求就「超過」該數額部分實施扣押'), true); // 附件寫「債務人」是筆誤：請求扣押的是債權人
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

// 13. 回歸：Word 匯出須逸出使用者輸入（姓名或單位名稱含 & < > 時不可被當成 HTML）
console.log('\n13. 回歸：Word 匯出逸出');
const wordHtml = buildWordDocHtml('王&小<明> 法催公文', '債務人：王&小<明>\n公司：A&B <有限公司>');
assert.strictEqual(wordHtml.includes('<明>') || wordHtml.includes('<有限公司>'), false);
assert.strictEqual(wordHtml.includes('債務人：王&amp;小&lt;明&gt;'), true);
assert.strictEqual(wordHtml.includes('公司：A&amp;B &lt;有限公司&gt;'), true);
assert.strictEqual(wordHtml.includes('<title>王&amp;小&lt;明&gt; 法催公文</title>'), true);
assert.strictEqual(wordHtml.includes('<pre>') && wordHtml.includes('標楷體') && wordHtml.includes('size: 595.3pt 841.9pt'), true); // 版面設定維持不變
assert.strictEqual(buildWordDocHtml('t', '').includes('<pre></pre>'), true);
console.log('  ✅ Word 匯出逸出通過');

// 14. 法規核對後的修正（依全國法規資料庫與司法院公告）
console.log('\n14. 法規核對後的修正');
// 14.1 115 年最低生活費與「生活所必需（未扶養）」：與司法院《115 年每月生活所必需數額一覽表》逐區相符
const official115 = {
  taiwan_province: [15515, 18618], taipei: [20744, 24893], kaohsiung: [16970, 20364], new_taipei: [17750, 21300],
  taichung: [16431, 19717], tainan: [15515, 18618], taoyuan: [17186, 20623], kinmen_lienchiang: [15173, 18208]
};
Object.entries(official115).forEach(([region, [base, necessity]]) => {
  assert.strictEqual(MIN_LIVING_EXPENSES_115[region].amount, base, `${region} 最低生活費`);
  assert.strictEqual(getMinLivingStandard(region).standard1_2, necessity, `${region} 1.2 倍`);
});
// 14.2 社名預設：《儲蓄互助社法》第 6 條只要求標明「儲蓄互助社」，不得預設「有限責任」
['generatePaymentOrderDoc', 'generateExecutionDoc', 'generateRenewCertificateDoc', 'generatePaymentOrderFinalDoc',
  'generateDemandLetterDoc', 'generateOffsetLetterDoc'].forEach(name => {
  const out = require('../js/templates')[name]({});
  assert.strictEqual(out.includes('○○縣○○儲蓄互助社'), true, `${name} 未填社名應顯示「○○縣○○儲蓄互助社」`);
  assert.strictEqual(out.includes('有限責任'), false, `${name} 不得預設「有限責任」`);
});
// 14.3 換證狀不得再引用錯誤條文：§137 III 不是中斷規定，§27 是發給憑證規定
const renewClean = generateRenewCertificateDoc({ ...batch2, titleType: 'payment_order' });
assert.strictEqual(renewClean.includes('中斷消滅時效') || renewClean.includes('第 137 條'), false);
assert.strictEqual(renewClean.includes('依強制執行法第 27 條規定'), true);
// 14.4 時效說明：5 年是「利息」請求權時效的預警，不得宣稱憑證 5 年失效或過期
const fs = require('fs');
const expired = calculate5YearExpiry('2015-01-01', new Date('2026-01-01'));
assert.strictEqual(expired.status, 'expired');
assert.strictEqual(expired.statusText.includes('預警') && !expired.statusText.includes('過期'), true);
const icsNew = generateICSContent([{ id: 'x', debtorName: '王小明', certNo: 'c', principal: 1, issueDate: '2022-05-10', expiryDateStr: '2027-05-10' }]);
const icsFlat = icsNew.split('\r\n ').join(''); // 長行依 RFC 5545 摺疊，比對前先展開
assert.strictEqual(icsFlat.includes('變廢紙') || icsFlat.includes('消滅時效今日屆滿'), false);
assert.strictEqual(icsFlat.includes('預警日'), true);
assert.strictEqual(icsFlat.includes('民法第 126 條') && icsFlat.includes('第 125 條'), true);
const html = fs.readFileSync(require('path').join(__dirname, '../index.html'), 'utf8');
assert.strictEqual(html.includes('第 137 條第 3 項'), false);
assert.strictEqual(html.includes('利息請求權時效 5 年（民法第 126 條）、本金 15 年（第 125 條）'), true);
console.log('  ✅ 法規核對後的修正測試通過');

// 15. 保險法 2025 年修正（114/6/18 公布施行）：壽險解約金僅逾額度者可執行；健康險、傷害險不得扣押
console.log('\n15. 強制執行狀：壽險解約金措辭');
const insDoc = generateExecutionDoc({ ...batch2, targets: { insurance: true } });
const insLine = insDoc.split('\n').find(l => l.includes('人壽保險商業同業公會'));
assert.strictEqual(!!insLine, true);
assert.strictEqual(insLine.includes('債務人為要保人之人壽保險契約'), true);
assert.strictEqual(insLine.includes('解約金債權金額逾保險法第 123 條之 1 第 1 項所定額度之契約'), true);
assert.strictEqual(insLine.includes('依同條第 2 項公告不得扣押者除外'), true);
assert.strictEqual(insLine.includes('健康保險、傷害保險契約，其解約金債權依同法第 129 條之 1、第 132 條之 1 規定不得扣押'), true);
assert.strictEqual(insLine.includes('最高法院 108 年度台抗大字第 897 號民事大法庭裁定意旨'), true);
assert.strictEqual(insLine.includes('命第三人保險公司償付解約金'), true); // 大法庭裁定主文用語
// 舊寫法已過時：不得再要求扣押「所有人身保險」，也不得寫成只扣超過額度的「部分」（超過額度的契約仍可全額執行）
assert.strictEqual(insLine.includes('所有人身保險契約'), false);
assert.strictEqual(insLine.includes('逾額度部分') || insLine.includes('超過部分'), false);
assert.strictEqual(insLine.includes('保單價值準備金'), false);
// 未勾選時不得出現任何保險相關文字與證物
const noIns = generateExecutionDoc({ ...batch2, targets: { bankDeposit: true } });
assert.strictEqual(noIns.includes('保險'), false);
assert.strictEqual(noIns.includes('台抗大字第 897 號'), false);
assert.strictEqual(insDoc.includes('最高法院 108 年度台抗大字第 897 號民事大法庭裁定要旨一份'), true); // 證物仍列
console.log('  ✅ 壽險解約金措辭測試通過');

// 16. 2026-10-10 全面 review 與《法規彙編》核對後的修正
// 逐條收集失敗項目再一次回報，方便確認每一條在修正前的程式上都會失敗
console.log('\n16. Review 與協會法規彙編核對後的修正');
const reviewFailures = [];
const check = (desc, fn) => {
  try {
    if (!fn()) reviewFailures.push(desc);
  } catch (e) {
    reviewFailures.push(`${desc}（${e.message}）`);
  }
};
const rv = {
  creditorName: '○○縣○○儲蓄互助社', debtorName: '王小明', debtorAddress: '臺中市西區五權路 50 號',
  principal: 100000, loanAmount: 150000, interestRate: '10', lastPaymentDate: '2024-12-31', interestStartDate: '2025-01-01',
  manualInterest: 17726, manualPenalty: 3000, courtName: '臺中', titleCaseNo: '114 年度司促字第 1 號'
};
const lineOf = (doc, keyword) => doc.split('\n').find(l => l.includes(keyword)) || '';

// 16.1 前欠利息、違約金寫明計算截止日，書狀利息自次日起算，不得同一期間重複請求
const cut = generatePaymentOrderDoc({ ...rv, interestCutoffDate: '2026-10-10' });
check('前欠利息寫明「至某日止已計算未清償」', () => cut.includes('並給付至 民國 115 年 10 月 10 日 止已計算未清償之約定利息新臺幣壹萬柒仟柒佰貳拾陸元整（小寫：17,726 元）'));
check('前欠利息算至截止日時，書狀利息改自次日起算', () => cut.includes('及自 民國 115 年 10 月 11 日 起至清償日止，按年息百分之 10 計算之利息'));
check('前欠利息算至截止日時，不得再從原起算日請求利息', () => !cut.includes('自 民國 114 年 1 月 1 日 起至清償日止'));
check('前欠違約金同樣寫明截止日', () => cut.includes('二、債務人應給付債權人至 民國 115 年 10 月 10 日 止已計算未清償之約定違約金新臺幣參仟元整（小寫：3,000 元）'));
check('不再使用沒有期間的「前已積欠」', () => !cut.includes('前已積欠'));
check('另訂的違約金起算日早於截止日時，改自截止日次日起算', () =>
  generatePaymentOrderDoc({ ...rv, penaltyRatio: '10', penaltyStartDate: '2025-02-01', interestCutoffDate: '2026-10-10' })
    .includes('並自 民國 115 年 10 月 11 日 起至清償日止，按上開利息百分之 10 計算之違約金'));
check('借據約定的起算日晚於截止日次日時，從其約定', () =>
  generatePaymentOrderDoc({ ...rv, interestStartDate: '2027-01-01', interestCutoffDate: '2026-10-10' }).includes('及自 民國 116 年 1 月 1 日 起至清償日止'));
check('有前欠利息但未填截止日時以「○」待填', () =>
  generatePaymentOrderDoc(rv).includes('並給付至 民國 ○○ 年 ○○ 月 ○○ 日 止已計算未清償之約定利息'));
check('沒有前欠利息、違約金時不受截止日影響', () =>
  generatePaymentOrderDoc({ ...rv, manualInterest: 0, manualPenalty: 0, interestCutoffDate: '2026-10-10' }).includes('及自 民國 114 年 1 月 1 日 起至清償日止'));
check('強制執行狀同樣適用截止日', () =>
  generateExecutionDoc({ ...rv, interestCutoffDate: '2026-10-10', targets: {} }).includes('並給付至 民國 115 年 10 月 10 日 止已計算未清償之約定利息'));
// 依日試算（app.js）以「利息起算日～截止日」含頭含尾計息：起算日至截止日次日的日數
check('依日試算的天數含起算日與截止日', () => calculateEstimatedInterest(100000, 10, '2025-01-01', addDaysToDateStr('2026-10-10', 1)).days === 648);

// 16.2 股票條款引用的「聲請執行之事項」款次須與實際款數一致
const stockWithPenalty = lineOf(generateExecutionDoc({ ...rv, targets: { stock: true } }), '臺灣集中保管結算所股份有限公司陳報');
check('有前欠違約金時，費用在事項三', () => stockWithPenalty.includes('以清償聲請執行之事項一至二所示債務人逾欠款，及事項三所示債務人應負擔之執行費用'));
const stockNoPenalty = lineOf(generateExecutionDoc({ ...rv, manualPenalty: 0, targets: { stock: true } }), '臺灣集中保管結算所股份有限公司陳報');
check('沒有前欠違約金時，費用在事項二', () => stockNoPenalty.includes('以清償聲請執行之事項一所示債務人逾欠款，及事項二所示債務人應負擔之執行費用'));

// 16.3 執行名義由其他法院核發時，寫出核發法院全名，不得稱「鈞院」
const otherCourt = generateExecutionDoc({ ...rv, courtName: '彰化', titleCourt: '臺中', targets: { bankDeposit: true } });
check('執行名義列核發法院', () => otherCourt.includes('執行名義：\n臺灣 臺中 地方法院 114 年度司促字第 1 號 支付命令及確定證明書。'));
check('執行名義由他院核發時寫出法院全名', () => otherCourt.includes('前經 臺灣臺中地方法院核發 114 年度司促字第 1 號'));
check('執行名義由他院核發時不得寫「鈞院核發」', () => !otherCourt.includes('鈞院核發'));
check('受理法院仍為執行處所在法院', () => otherCourt.includes('臺灣 彰化 地方法院 民事執行處  公鑒'));
const otherRenew = generateRenewCertificateDoc({ ...rv, courtName: '彰化', titleCourt: '臺中', titleType: 'cert', titleCaseNo: '110 年度司執字第 1 號' });
check('換發債權憑證狀：憑證由他院核發時寫出法院全名', () => otherRenew.includes('業經 臺灣臺中地方法院核發 110 年度司執字第 1 號 債權憑證在案，並經 鈞院以'));
check('同一法院時仍稱「鈞院」', () => generateExecutionDoc({ ...rv, titleCourt: '臺中', targets: {} }).includes('前經 鈞院核發'));

// 16.4 法院對照：平溪屬基隆地院、林口屬新北地院、燕巢屬橋頭地院；新北 29 區、高雄 38 區都要明列
check('新北市平溪區 → 基隆地院', () => findCourtByAddress('新北市平溪區公園街 1 號').name === '基隆');
check('新北市林口區 → 新北地院', () => findCourtByAddress('新北市林口區文化一路 1 號').name === '新北');
check('高雄市燕巢區 → 橋頭地院', () => findCourtByAddress('高雄市燕巢區中民路 1 號').name === '橋頭');
const { TAIWAN_COURTS } = require('../js/court-data');
const listedIn = (district) => TAIWAN_COURTS.filter(c => c.areas.includes(district)).map(c => c.name);
const newTaipei = ['板橋', '三重', '中和', '永和', '新莊', '新店', '樹林', '鶯歌', '三峽', '淡水', '汐止', '瑞芳', '土城', '蘆洲', '五股',
  '泰山', '林口', '深坑', '石碇', '坪林', '三芝', '石門', '八里', '平溪', '雙溪', '貢寮', '金山', '萬里', '烏來'];
const kaohsiung = ['楠梓', '左營', '鼓山', '三民', '鹽埕', '前金', '新興', '苓雅', '前鎮', '旗津', '小港', '鳳山', '大寮', '鳥松', '林園',
  '仁武', '大樹', '大社', '岡山', '路竹', '橋頭', '梓官', '彌陀', '永安', '燕巢', '田寮', '阿蓮', '茄萣', '湖內', '旗山', '美濃',
  '內門', '杉林', '甲仙', '六龜', '茂林', '桃源', '那瑪夏'];
check('新北市 29 區都明列於恰好一所法院', () => newTaipei.length === 29 && newTaipei.every(d => listedIn(`新北市${d}區`).length === 1));
check('高雄市 38 區都明列於恰好一所法院（橋頭 26 區）', () => kaohsiung.length === 38 &&
  kaohsiung.every(d => listedIn(`高雄市${d}區`).length === 1) &&
  kaohsiung.filter(d => listedIn(`高雄市${d}區`)[0] === '橋頭').length === 26);

// 16.5 金門、連江地院為「福建」地方法院
['金門', '連江'].forEach(court => {
  const docs = {
    支付命令: generatePaymentOrderDoc({ ...rv, courtName: court }),
    確定證明書: generatePaymentOrderFinalDoc({ ...rv, courtName: court }),
    強制執行: generateExecutionDoc({ ...rv, courtName: court, targets: {} }),
    債權憑證: generateRenewCertificateDoc({ ...rv, courtName: court })
  };
  Object.entries(docs).forEach(([name, doc]) => {
    check(`${name}：${court}地院抬頭為「福建」`, () => doc.includes(`福建 ${court} 地方法院`) && !doc.includes(`臺灣 ${court}`));
  });
});
check('未選法院時仍以「臺灣 ○○ 地方法院」待填', () => generatePaymentOrderDoc({}).includes('臺灣 ○○ 地方法院'));

// 16.6 薪資條款：請求扣押者為債權人
const salaryDoc = generateExecutionDoc({ ...rv, targets: { salary: true, livingRegion: 'taichung' } });
check('薪資條款主詞為債權人', () => salaryDoc.includes('債權人僅請求就「超過」該數額部分實施扣押') && !salaryDoc.includes('債務人僅請求'));

// 16.7 中華郵政統一編號 8 碼
check('中華郵政統一編號為 03741302', () => generateExecutionDoc({ ...rv, targets: { postOffice: true } }).includes('統一編號：03741302'));

// 16.8 民法第 130 條 6 個月期限：末日當天仍在期限內（民法第 121 條第 1 項）
const lastDay = calculate6MonthNoticeExpiry('2026-04-10', new Date(2026, 9, 10));
check('期限末日當天不算逾期', () => lastDay.expiryDateStr === '2026-10-10' && lastDay.remainingDays === 0 && lastDay.isExpired === false && lastDay.isLastDay === true);
check('末日次日才算逾期', () => calculate6MonthNoticeExpiry('2026-04-10', new Date(2026, 9, 11)).isExpired === true);

// 16.9 債務人已死亡：執行標的為被繼承人遺產，不得稱亡者為「債務人」
const deceasedExec = generateExecutionDoc({
  ...rv, debtorDeceased: true, heirs: '王大明｜C111111111｜臺北市',
  targets: { bankDeposit: true, bankList: '某銀行｜臺中市', stock: true, movables: true, vehiclePlate: 'ABC-1234', realEstate: true }
});
check('存款：被繼承人', () => deceasedExec.includes('請就被繼承人王小明存放於第三人某銀行之存款'));
check('股票：被繼承人', () => deceasedExec.includes('陳報被繼承人王小明應受保管之股票'));
check('動產與車輛：被繼承人', () => deceasedExec.includes('請查封、拍賣被繼承人王小明所有於門牌號碼') && deceasedExec.includes('及被繼承人所有車牌號碼 ABC-1234'));
check('不動產：被繼承人', () => deceasedExec.includes('請求拍賣被繼承人王小明所有之不動產'));
check('亡者不得被稱為「債務人王小明」', () => !deceasedExec.includes('債務人王小明'));

// 16.10 放款利率沒有「年息 12% 為限」的規定（協會《儲蓄互助社章程範例》第 25 條：由理事會決定）
const reviewHtml = fs.readFileSync(require('path').join(__dirname, '../index.html'), 'utf8');
check('移除查無依據的「年息 12% 為限」', () => !reviewHtml.includes('年息 12%（月息 1%）為限'));
check('改依章程範例第 25 條說明', () => reviewHtml.includes('放款利率由理事會決定（協會《儲蓄互助社章程範例》第 25 條）'));

// 16.11 違約利率上限 15%（協會《儲蓄互助社辦理放款實施要點》第 19 條）
check('違約金比例 20% 提醒逾上限', () => validatePenaltyRatio(20).isValid === false && validatePenaltyRatio(20).warning.includes('第 19 條'));
check('違約金比例 15% 不提醒', () => validatePenaltyRatio(15).isValid === true && validatePenaltyRatio('').isValid === true);
check('輸入提示不得再以超過上限的 20% 為例', () => !reviewHtml.includes('placeholder="例：20'));
check('違約金欄位有警示區塊', () => reviewHtml.includes('id="penaltyAlertBox"'));

// 16.12 恢復《呆帳處理辦法》第 11 條引用（全名；上一輪誤當成查無依據刪除）
const scriptsSrc = fs.readFileSync(require('path').join(__dirname, '../js/scripts.js'), 'utf8');
const fullRuleName = '《儲蓄互助社放款評估損失準備提列及逾期放款呆帳處理辦法》第 11 條';
check('話術分頁說明引用呆帳處理辦法第 11 條', () => reviewHtml.includes(fullRuleName));
check('話術程式註解引用呆帳處理辦法第 11 條', () => scriptsSrc.includes(fullRuleName));
check('話術不得再引用不存在的「放款管理辦法」「放款審議委員會」', () => !scriptsSrc.includes('放款管理辦法') && !scriptsSrc.includes('放款審議委員會'));

// 16.13 股金扣除貸款存證信函：載明理事會決議日（章程範例第 17 條）
check('股金扣除信函載明理事會決議日', () =>
  generateOffsetLetterDoc({ ...rv, bylawArticle: '十七', boardResolutionDate: '2026-09-30' }).includes('依本社章程十七條，經本社理事會民國115年9月30日討論通過，將以股金扣除貸款後續行執行法催程序'));
check('理事會決議日未填時以「○」待填', () => generateOffsetLetterDoc(rv).includes('經本社理事會民國○○年○○月○○日討論通過'));
check('理事會決議日欄位只在股金扣除信函出現', () => reviewHtml.includes('id="boardResolutionWrap"') && reviewHtml.includes('id="docBoardResolutionDate"'));
check('執行名義核發法院欄位存在', () => reviewHtml.includes('id="docTitleCourt"'));
check('積欠利息計算至欄位存在', () => reviewHtml.includes('id="docInterestCutoffDate"'));

assert.deepStrictEqual(reviewFailures, [], `Review 修正測試未通過：\n- ${reviewFailures.join('\n- ')}`);
console.log('  ✅ Review 與法規彙編核對後的修正測試通過');

console.log('\n🎉 所有全面升級單元測試全數驗證通過！');
