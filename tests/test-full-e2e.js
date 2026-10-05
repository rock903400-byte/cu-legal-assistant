/**
 * 全端完整深度驗證腳本 (test-full-e2e.js)
 * 涵蓋：8大公文、115年全台扣薪試算、5年時效與多重推播鬧鐘、話術生成、防呆檢核
 */

const fs = require('fs');
const path = require('path');

// 模擬瀏覽器環境
global.window = {};
global.document = {};
global.localStorage = {
  store: {},
  getItem(key) { return this.store[key] || null; },
  setItem(key, val) { this.store[key] = String(val); },
  removeItem(key) { delete this.store[key]; }
};

// 載入模組
eval(fs.readFileSync(path.join(__dirname, '../js/court-data.js'), 'utf8'));
eval(fs.readFileSync(path.join(__dirname, '../js/core-legal.js'), 'utf8'));
eval(fs.readFileSync(path.join(__dirname, '../js/salary-calc.js'), 'utf8'));
eval(fs.readFileSync(path.join(__dirname, '../js/templates.js'), 'utf8'));
eval(fs.readFileSync(path.join(__dirname, '../js/scripts.js'), 'utf8'));
eval(fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8'));

let passedCount = 0;
let totalCount = 0;

function assert(condition, desc) {
  totalCount++;
  if (condition) {
    passedCount++;
    console.log(`  ✅ [PASS] ${desc}`);
  } else {
    console.error(`  ❌ [FAIL] ${desc}`);
    process.exitCode = 1;
  }
}

console.log('🚀 開始執行「儲互社智慧法催助手」全端深度邏輯驗證...\n');

// 1. 驗證 8 大公文產出與內容關鍵字
console.log('【模組一：8 大司法院標準書狀與抵銷公文生成驗證】');
const testDocData = {
  creditorName: '有限責任臺中市第一儲蓄互助社',
  creditorTaxId: '04123456',
  creditorRep: '陳理事長',
  creditorAddress: '臺中市西區民生路 100 號',
  creditorPhone: '04-22223333',
  agentName: '李專職',
  agentId: 'B221133445',
  debtorName: '張大同',
  debtorId: 'B123456789',
  debtorAddress: '臺中市西區五權路 50 號',
  debtorMemberNo: 'CU-0886',
  hasGuarantor: true,
  guarantorName: '李小華',
  guarantorId: 'L223456789',
  guarantorAddress: '臺中市西區民權路 120 號',
  loanDate: '2023-01-15',
  loanAmount: 300000,
  principal: 210000,
  interestRate: 6.5,
  lastPaymentDate: '2023-11-20',
  interestStartDate: '2023-11-21',
  manualInterest: 12000,
  manualPenalty: 2500,
  courtName: '臺中',
  shareAmount: 50000,
  dividendAmount: 2500,
  docNo: '中一互社催字第 115001 號',
  deceasedDate: '2024-01-10',
  deceasedDateRoc: '113 年 1 月 10 日',
  householdOffice: '臺中市西區戶政事務所',
  targets: {
    bankDeposit: true,
    bankName: '合作金庫',
    insurance: true,
    salary: true,
    employerName: '宏達企業社',
    taxData: true,
    realEstate: false
  },
  titleCourt: '臺中',
  titleCaseNo: '112 年度司促字第 12345 號',
  caseYear: '112',
  caseWord: '司執',
  caseNo: '98765',
  caseSection: '民',
  bylawArticle: '十七',
  extraParties: '',
  orderIssueDate: '2023-08-15',
  noticeDate: '2026-10-05'
};

const doc1 = generatePaymentOrderDoc(testDocData);
assert(doc1.includes('民事支付命令聲請狀') && doc1.includes('張大同') && doc1.includes('貳拾貳萬肆仟伍佰元整'), '1. 支付命令聲請狀正確包含訴之聲明與中文大寫合計');

const doc2 = generateExecutionDoc(testDocData);
assert(doc2.includes('民事強制執行聲請狀') && doc2.includes('最高法院 108 年度台抗大字第 897 號') && doc2.includes('保單價值準備金'), '2. 強制執行狀正確包含人身保險大法庭裁定與存款扣押');

// 強制執行狀：e2e 資料含單一指名銀行（舊欄位 bankName）與雇主，須列為第三人
assert(doc2.includes('第三人：合作金庫') && doc2.includes('第三人：宏達企業社') && doc2.includes('聲請執行之事項'), '2-2. 強制執行狀列出第三人（銀行、雇主）與聲請執行之事項');

const doc3 = generateRenewCertificateDoc({ ...testDocData, titleType: 'cert' });
assert(doc3.includes('民事聲請換發債權憑證狀') && doc3.includes('強制執行法第 27 條') && doc3.includes('債權憑證正本一份'), '3. 換發債權憑證狀（執行名義為債權憑證）法規、案號與證物符合規範');
const doc3b = generateRenewCertificateDoc({ ...testDocData, titleType: 'payment_order' });
assert(doc3b.includes('民事聲請核發債權憑證狀') && doc3b.includes('支付命令及確定證明書正本各一份'), '3-2. 執行名義為支付命令時，債權憑證狀為首次「核發」');

const doc4 = generateOffsetShareDoc(testDocData);
assert(doc4.includes('本社章程第 十七 條') && !doc4.includes('儲蓄互助社法') && doc4.includes('抵銷權') && doc4.includes('50,000'), '4. 股金抵銷通知書依本社章程條次辦理（不誤引儲蓄互助社法第 14 條）並帶入股金金額');

const doc5 = generateOffsetBoardResolutionDoc(testDocData);
assert(doc5.includes('理事會審議') && doc5.includes('行使股金抵銷權案') && doc5.includes('210,000'), '5. 理事會股金抵銷簽呈格式完整');

const doc6 = generateHouseholdApplyDoc(testDocData);
assert(doc6.includes('戶籍謄本申請書') && doc6.includes('繼承人') && doc6.includes('戶籍法第 65 條'), '6. 戶政事務所除戶與繼承人謄本申請書正確');

const doc7 = generateInheritanceInquiryDoc(testDocData);
assert(doc7.includes('家事法庭') && doc7.includes('拋棄繼承') && doc7.includes('限定繼承'), '7. 家事法庭拋棄繼承查詢狀正確');

const doc8 = generateInheritanceDemandDoc(testDocData);
assert(doc8.includes('全體法定繼承人') && doc8.includes('民法》第 1148 條') && doc8.includes('210,000'), '8. 致全體繼承人催告函正確引用民法第 1148 條');

// 未設定本社資料時不得回傳示範用的假社名／統編
assert(Object.keys(loadCuProfile()).length === 0, '尚未儲存本社資料時，loadCuProfile 回傳空白而非示範假資料');

const doc9 = generateDemandLetterDoc(testDocData);
assert(doc9.includes('郵局存證信函') && doc9.includes('函到七日內至本社處理') && doc9.includes('三、副本收件人') && doc9.includes('李小華'), '9. 存證信函（清償債務催告）沿用附件原文並列副本收件人');

const doc10 = generateOffsetLetterDoc(testDocData);
assert(doc10.includes('依本社章程十七條') && doc10.includes('已於執行階段'), '10. 存證信函（股金扣除貸款）引用本社章程十七條');

const doc11 = generatePaymentOrderFinalDoc(testDocData);
assert(doc11.includes('民事聲請支付命令確定證明書狀') && doc11.includes('112 年度司促字第 12345 號') && doc11.includes('民事訴訟法第 521 條'), '11. 支付命令確定證明書狀帶入案號與法條');

// 2. 驗證 115 年度全台扣薪試算與極值防呆
console.log('\n【模組二：115 年度全台最低生活費扣薪計算機驗證】');
const regions = ['taichung', 'taipei', 'new_taipei', 'taoyuan', 'tainan', 'kaohsiung', 'taiwan_province', 'kinmen_lienchiang'];
regions.forEach(r => {
  const res = calculateSalaryGarnishment({ monthlySalary: 45000, regionCode: r, dependentCount: 1, supportRatio: 0.5 });
  assert(res.baseLivingCost > 14000 && res.garnishableAmount > 0 && res.personalCost === Math.round(res.baseLivingCost * 1.2), `縣市 ${r} 115年最低生活費 ${res.baseLivingCost} 與 1.2倍基準計算正確`);
});

// 測試免扣押防呆 (月薪低於生活費)
const exemptRes = calculateSalaryGarnishment({ monthlySalary: 22000, regionCode: 'taipei', dependentCount: 2, supportRatio: 1.0 });
assert(exemptRes.isExempt === true && exemptRes.garnishableAmount === 0 && exemptRes.retainedAmount === 22000, '月薪低於法定最低生活費時，正確觸發 100% 豁免扣押防呆');

// 3. 驗證 5 年消滅時效與多重行事曆推播鬧鐘
console.log('\n【模組三：5 年消滅時效與 .ics 行事曆推播鬧鐘驗證】');
const ledgerRecord = {
  id: 'rec-test-1',
  debtorName: '王小明',
  certNo: '111年度司執字第12345號',
  courtName: '臺灣臺中地方法院',
  principal: 200000,
  issueDate: '2021-08-01',
  expiryDateStr: '2026-08-01',
  note: '測試案件'
};
const icsContent = generateICSContent([ledgerRecord]);
assert(icsContent.includes('BEGIN:VCALENDAR') && icsContent.includes('BEGIN:VALARM') && icsContent.includes('TRIGGER:-P180D') && icsContent.includes('TRIGGER:-P90D') && icsContent.includes('TRIGGER:-P30D'), '5年憑證 .ics 鬧鐘正確包含 180天前、90天前、30天前三階段推播提醒');

// 4. 驗證 16% 約定利率上限防呆
console.log('\n【模組四：民法第 205 條約定利率 16% 上限防呆驗證】');
const rateCheckSafe = validateInterestRate(12);
assert(rateCheckSafe.isValid === true, '年息 12% 通過合法檢核');

const rateCheckBoundary = validateInterestRate(16.0);
assert(rateCheckBoundary.isValid === true, '年息 16.0% 邊界值通過檢核');

const rateCheckExcess = validateInterestRate(18.5);
assert(rateCheckExcess.isValid === false && rateCheckExcess.warning.includes('民法第 205 條'), '年息 18.5% 正確觸發 16% 超標警示與法條提示');

// 5. 驗證早期關懷話術與 LINE 文案
console.log('\n【模組五：早期溫情關懷電訪與 LINE 文案生成驗證】');
const scriptData = {
  debtorName: '林美華',
  gender: 'female',
  overdueMonths: 2,
  overdueAmount: 24000,
  cuName: '臺中第一互助社',
  cuPhone: '04-22223333'
};
const phoneScripts = generatePhoneScripts(scriptData);
const lineMsgs = generateLineMessages(scriptData);
assert(phoneScripts.empathy.script.includes('林美華') && phoneScripts.empathy.script.includes('女士'), '電訪腳本稱謂與姓名正確帶入');
assert(lineMsgs.gentle.text.includes('臺中第一互助社') && lineMsgs.gentle.text.includes('24,000'), 'LINE 催繳文案社名與金額正確帶入');

console.log(`\n==================================================`);
console.log(passedCount === totalCount
  ? `🎉 全端深度邏輯驗證全部完成：通過 ${passedCount} / ${totalCount} 項測試（100% 通過）！`
  : `❌ 全端深度邏輯驗證未全數通過：${passedCount} / ${totalCount} 項通過，請檢視上方 FAIL 項目。`);
console.log(`==================================================\n`);
