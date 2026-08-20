/**
 * 司法院標準公文範本庫 (templates.js)
 * 包含：
 * 1. 民事支付命令聲請狀
 * 2. 民事強制執行聲請狀 (含扣押保險解約金、扣押銀行存款、扣薪、查調所得等)
 * 3. 民事聲請換發債權憑證狀
 */

// 相容 Node.js 與瀏覽器環境
let _toChineseCurrency = typeof toChineseCurrency !== 'undefined' ? toChineseCurrency : null;
let _formatRocDate = typeof formatRocDate !== 'undefined' ? formatRocDate : null;
let _getCurrentRocDate = typeof getCurrentRocDate !== 'undefined' ? getCurrentRocDate : null;
let _calculateCourtFees = typeof calculateCourtFees !== 'undefined' ? calculateCourtFees : null;

if (typeof require !== 'undefined') {
  try {
    const core = require('./core-legal');
    if (core) {
      _toChineseCurrency = _toChineseCurrency || core.toChineseCurrency;
      _formatRocDate = _formatRocDate || core.formatRocDate;
      _getCurrentRocDate = _getCurrentRocDate || core.getCurrentRocDate;
      _calculateCourtFees = _calculateCourtFees || core.calculateCourtFees;
    }
  } catch (e) {}
}

function getRocDateHelper() {
  return _getCurrentRocDate ? _getCurrentRocDate() : (typeof getCurrentRocDate === 'function' ? getCurrentRocDate() : { rocYear: 115, month: 1, day: 1 });
}

function formatRocDateHelper(dateStr) {
  return _formatRocDate ? _formatRocDate(dateStr) : (typeof formatRocDate === 'function' ? formatRocDate(dateStr) : dateStr);
}

function toChineseCurrencyHelper(num) {
  return _toChineseCurrency ? _toChineseCurrency(num) : (typeof toChineseCurrency === 'function' ? toChineseCurrency(num) : '新臺幣' + num + '元整');
}

function calculateCourtFeesHelper(amount, type) {
  return _calculateCourtFees ? _calculateCourtFees(amount, type) : (typeof calculateCourtFees === 'function' ? calculateCourtFees(amount, type) : 0);
}

/**
 * 產生《民事支付命令聲請狀》
 */
function generatePaymentOrderDoc(data) {
  const roc = getRocDateHelper();
  const loanDateRoc = formatRocDateHelper(data.loanDate);
  const lastPaymentDateRoc = formatRocDateHelper(data.lastPaymentDate);
  const interestStartDateRoc = formatRocDateHelper(data.interestStartDate || data.lastPaymentDate);

  const principal = Number(data.principal) || 0;
  const manualInterest = Number(data.manualInterest) || 0;
  const manualPenalty = Number(data.manualPenalty) || 0;
  const totalClaim = principal + manualInterest + manualPenalty;

  const principalChinese = toChineseCurrencyHelper(principal);
  const totalClaimChinese = toChineseCurrencyHelper(totalClaim);
  const loanAmountChinese = toChineseCurrencyHelper(Number(data.loanAmount) || principal);
  const manualInterestChinese = manualInterest > 0 ? toChineseCurrencyHelper(manualInterest) : '';
  const manualPenaltyChinese = manualPenalty > 0 ? toChineseCurrencyHelper(manualPenalty) : '';

  // 連帶保證人區塊
  let guarantorSection = '';
  let guarantorClaimText = '連帶';
  if (data.hasGuarantor && data.guarantorName) {
    guarantorSection = `
相對人（即連帶保證人）：${data.guarantorName}
身分證統一編號：${data.guarantorId || '（如附表）'}
住居所：${data.guarantorAddress || '同債務人或詳如借據'}
`;
    guarantorClaimText = '連帶';
  } else {
    guarantorClaimText = '';
  }

  // 請求標的文字組合
  const claims = [];
  let claimItemIdx = 1;

  // 標的一：本金及利息
  let claim1 = `一、相對人應${guarantorClaimText}給付聲請人新臺幣 ${principalChinese}（小寫：${principal.toLocaleString()} 元），及自 ${interestStartDateRoc} 起至清償日止，按年息百分之 ${data.interestRate || '0'} 計算之利息。`;
  if (manualInterest > 0) {
    claim1 += `\n   並給付前已積欠之約定利息新臺幣 ${manualInterestChinese}（小寫：${manualInterest.toLocaleString()} 元）。`;
  }
  claims.push(claim1);
  claimItemIdx++;

  // 標的二：違約金 (若有手動輸入)
  if (manualPenalty > 0) {
    claims.push(`二、相對人應${guarantorClaimText}給付聲請人約定之違約金新臺幣 ${manualPenaltyChinese}（小寫：${manualPenalty.toLocaleString()} 元）。`);
    claimItemIdx++;
  }

  // 標的三：程序費用
  claims.push(`${claimItemIdx === 2 ? '二' : '三'}、督促程序費用新臺幣伍佰元由相對人${guarantorClaimText}負擔。`);

  // 事實及理由
  const docText = `民事支付命令聲請狀
訴訟標的金額：${totalClaimChinese}（小寫：新臺幣 ${totalClaim.toLocaleString()} 元）
聲請規費：新臺幣 500 元

聲請人（即債權人）：${data.creditorName || '有限責任○○儲蓄互助社'}
統一編號：${data.creditorTaxId || ''}
法定代理人：${data.creditorRep || ''}
設址：${data.creditorAddress || ''}
送達代收人：${data.agentName || data.creditorRep || ''}
送達處所：${data.creditorAddress || ''}
電話：${data.creditorPhone || ''}

相對人（即債務人）：${data.debtorName || '○○○'}
身分證統一編號：${data.debtorId || ''}
住居所：${data.debtorAddress || ''}
${guarantorSection}
為聲請核發支付命令事：

請求之標的：
${claims.join('\n')}

事實及理由：
一、緣相對人於 ${loanDateRoc} 向聲請人借款新臺幣 ${loanAmountChinese}（借款金額：${Number(data.loanAmount || principal).toLocaleString()} 元），雙方約定分期按月攤還本息${data.hasGuarantor && data.guarantorName ? '，並由相對人 ' + data.guarantorName + ' 擔任連帶保證人，願負連帶清償之責' : ''}。
二、詎相對人自 ${lastPaymentDateRoc} 起即未依約繳納本息，迭經聲請人屢次催討，相對人均置之不理。迄今尚積欠本金新臺幣 ${principalChinese} 及前揭約定之利息與違約金未為清償，依約已喪失期限利益，債務視為全部到期。
三、依民事訴訟法第 508 條及第 511 條規定，債權人之請求以給付金錢為標的者，得聲請法院依督促程序核發支付命令。為此特狀請 鈞院依督促程序對相對人發支付命令，命其連帶清償如請求標的所示之金額及費用，以維權益，實感德便。

證物名稱及件數：
一、借據（借款申請書兼借據）影本一份。
二、放款明細表暨欠款計算表一份。
${data.hasGuarantor && data.guarantorName ? '三、連帶保證人保證條款影本一份。\n' : ''}
謹  狀
臺灣 ${data.courtName || '臺北'} 地方法院 民事庭  公鑒

中  華  民  國  ${roc.rocYear}  年  ${roc.month}  月  ${roc.day}  日

具狀人（即聲請人）：${data.creditorName || '有限責任○○儲蓄互助社'}
法定代理人：${data.creditorRep || ''}
`;

  return docText;
}

/**
 * 產生《民事強制執行聲請狀》
 * 完整納入扣押保險解約金 (最高法院 108 年度台抗大字第 897 號裁定)、查調金融存款、扣薪、查調國稅局財產等
 */
function generateExecutionDoc(data) {
  const roc = getRocDateHelper();
  const principal = Number(data.principal) || 0;
  const manualInterest = Number(data.manualInterest) || 0;
  const manualPenalty = Number(data.manualPenalty) || 0;
  const totalClaim = principal + manualInterest + manualPenalty;

  const totalClaimChinese = toChineseCurrencyHelper(totalClaim);
  const principalChinese = toChineseCurrencyHelper(principal);
  const executionFee = calculateCourtFeesHelper(totalClaim, 'execution');

  // 連帶保證人區塊
  let guarantorSection = '';
  if (data.hasGuarantor && data.guarantorName) {
    guarantorSection = `
債務人（即連帶保證人）：${data.guarantorName}
身分證統一編號：${data.guarantorId || ''}
住居所：${data.guarantorAddress || '詳如執行名義'}
`;
  }

  // 執行標的動態組合
  const targetClaims = [];
  let itemNum = 1;
  const numChinese = ['一', '二', '三', '四', '五', '六', '七'];

  // 1. 查調金融機構存款並扣押
  if (data.targets && data.targets.bankDeposit) {
    let depositDetail = data.targets.bankName ? `債務人對第三人【${data.targets.bankName}】之存款債權` : `債務人於金融機構之存款債權（含銀行、郵局、信用合作社、農漁會等）`;
    targetClaims.push(`${numChinese[itemNum - 1]}、請准予扣押並收取${depositDetail}；或由 鈞院囑託【中華民國銀行商業同業公會全國聯合會】查調債務人之全部開戶銀行與存款帳號並予扣押。`);
    itemNum++;
  }

  // 2. 查調人壽保險並扣押保單價值準備金 / 解約金 (最高法院 108 年度台抗大字第 897 號裁定)
  if (data.targets && data.targets.insurance) {
    targetClaims.push(`${numChinese[itemNum - 1]}、請准予囑託【中華民國人壽保險商業同業公會】查調債務人為要保人之所有人身保險契約；並依最高法院 108 年度台抗大字第 897 號民事大法庭裁定意旨，扣押債務人對第三人保險公司之保險給付請求權及解約金債權（保單價值準備金），並於執行必要時命終止該保險契約，命第三人保險公司將解約金償付聲請人。`);
    itemNum++;
  }

  // 3. 扣押每月薪資 1/3 (強制執行法第 115 條之 1)
  if (data.targets && data.targets.salary) {
    const employer = data.targets.employerName ? `第三人【${data.targets.employerName}】` : `第三人（待向國稅局查調所得後補陳任職單位）`;
    targetClaims.push(`${numChinese[itemNum - 1]}、請依強制執行法第 115 條之 1 規定，准予就債務人任職於${employer}之每月薪資、獎金、津貼等債權，在扣除生活所必需後於法定限額（或三分之一）範圍內核發扣押及收取（或移轉）命令。`);
    itemNum++;
  }

  // 4. 查調國稅局全年度財產及所得清單
  if (data.targets && data.targets.taxData) {
    targetClaims.push(`${numChinese[itemNum - 1]}、請 鈞院依職權囑託【財政部各地區國稅局】查調債務人${data.hasGuarantor && data.guarantorName ? '及連帶保證人' : ''}最新全年度財產總歸戶清單及各類所得資料清單，以供查報財產並予執行。`);
    itemNum++;
  }

  // 5. 查封拍賣不動產
  if (data.targets && data.targets.realEstate) {
    targetClaims.push(`${numChinese[itemNum - 1]}、請准予查封、拍賣債務人所有之不動產（標示詳如附表），並就賣得價金受清償。`);
    itemNum++;
  }

  // 若使用者完全沒勾選任何標的，預設給予查調財產與存款
  if (targetClaims.length === 0) {
    targetClaims.push(`一、請准予囑託中華民國銀行商業同業公會全國聯合會查調債務人存款帳戶並予扣押。`);
    targetClaims.push(`二、請准予囑託國稅局查調債務人之財產與所得清單。`);
  }

  const docText = `民事強制執行聲請狀
執行標的金額：${totalClaimChinese}（小寫：新臺幣 ${totalClaim.toLocaleString()} 元）
執行規費：新臺幣 ${executionFee.toLocaleString()} 元（按請求金額千分之八計算${executionFee === 0 ? '，未滿五千元免徵' : ''}）

聲請人（即債權人）：${data.creditorName || '有限責任○○儲蓄互助社'}
統一編號：${data.creditorTaxId || ''}
法定代理人：${data.creditorRep || ''}
設址：${data.creditorAddress || ''}
電話：${data.creditorPhone || ''}
送達代收人：${data.agentName || data.creditorRep || ''}
送達處所：${data.creditorAddress || ''}

債務人：${data.debtorName || '○○○'}
身分證統一編號：${data.debtorId || ''}
住居所：${data.debtorAddress || ''}
${guarantorSection}
為聲請強制執行事：

執行名義：
臺灣 ${data.titleCourt || data.courtName || '臺北'} 地方法院 ${data.titleCaseNo || '○○ 年度 ○ 字第 ○○○○ 號'} 確定之支付命令暨確定證明書（或債權憑證）。

實施強制執行之標的及方法：
${targetClaims.join('\n')}

事實及理由：
一、聲請人與債務人間清償借款強制執行事件，前經 鈞院核發 ${data.titleCaseNo || '○○ 年度 ○ 字第 ○○○○ 號'} 確定之執行名義在案，債務人依法應給付聲請人如執行名義所載之本金、利息、違約金及督促程序費用。
二、詎該執行名義確定後，債務人迄未履行清償義務，迄今尚欠本金新臺幣 ${principalChinese} 及約定利息、違約金。為此依強制執行法第 4 條、第 6 條、第 115 條等規定，檢附前開執行名義正本，狀請 鈞院民事執行處依法實施強制執行，以維債權，實感德便。

證物名稱及件數：
一、執行名義正本（確定之支付命令及確定證明書，或債權憑證正本）一份。
二、執行規費繳納收據一份。
${data.targets && data.targets.insurance ? '三、最高法院 108 年度台抗大字第 897 號民事大法庭裁定要旨一份。\n' : ''}
謹  狀
臺灣 ${data.courtName || '臺北'} 地方法院 民事執行處  公鑒

中  華  民  國  ${roc.rocYear}  年  ${roc.month}  月  ${roc.day}  日

具狀人（即聲請人）：${data.creditorName || '有限責任○○儲蓄互助社'}
法定代理人：${data.creditorRep || ''}
`;

  return docText;
}

/**
 * 產生《民事聲請換發債權憑證狀》
 */
function generateRenewCertificateDoc(data) {
  const roc = getRocDateHelper();
  const principal = Number(data.principal) || 0;
  const principalChinese = toChineseCurrencyHelper(principal);

  const docText = `民事聲請換發債權憑證狀
案號：${data.caseYear || roc.rocYear} 年度 ${data.caseWord || '司執'} 字第 ${data.caseNo || '○○○○'} 號
股別：${data.caseSection || '○'} 股

聲請人（即債權人）：${data.creditorName || '有限責任○○儲蓄互助社'}
統一編號：${data.creditorTaxId || ''}
法定代理人：${data.creditorRep || ''}
設址：${data.creditorAddress || ''}
電話：${data.creditorPhone || ''}

債務人：${data.debtorName || '○○○'}
身分證統一編號：${data.debtorId || ''}
住居所：${data.debtorAddress || ''}
${data.hasGuarantor && data.guarantorName ? '連帶保證人：' + data.guarantorName + '，身分證字號：' + (data.guarantorId || '') + '，住居所：' + (data.guarantorAddress || '') : ''}

為聲請換發債權憑證事：

聲請意旨：
聲請人與債務人間清償借款強制執行事件，業經 鈞院以 ${data.caseYear || roc.rocYear} 年度 ${data.caseWord || '司執'} 字第 ${data.caseNo || '○○○○'} 號受理在案。
查債務人目前查無其他可供執行之財產（或經查封執行無實益／拍賣無人應買），為保全聲請人未受償之債權（本金新臺幣 ${principalChinese} 及其利息、違約金），並依民法第 137 條第 3 項及強制執行法第 27 條規定中斷消滅時效，特狀請 鈞院准予發給（或換發）債權憑證，以維權益，實感德便。

謹  狀
臺灣 ${data.courtName || '臺北'} 地方法院 民事執行處  公鑒

中  華  民  國  ${roc.rocYear}  年  ${roc.month}  月  ${roc.day}  日

具狀人（即聲請人）：${data.creditorName || '有限責任○○儲蓄互助社'}
法定代理人：${data.creditorRep || ''}
`;

  return docText;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generatePaymentOrderDoc,
    generateExecutionDoc,
    generateRenewCertificateDoc
  };
}
