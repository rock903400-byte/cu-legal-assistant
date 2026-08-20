/**
 * 司法院標準公文與儲互社法催範本庫 (templates.js)
 * 包含：
 * 1. 民事支付命令聲請狀
 * 2. 民事強制執行聲請狀 (含扣押保險解約金、扣押銀行存款、扣薪、查調所得等)
 * 3. 民事聲請換發債權憑證狀
 * 4. 社員逾期放款以留存股金及股息抵銷借款通知書 (儲蓄互助社法第 14 條)
 * 5. 理監事會審議逾期放款行使股金抵銷權簽呈
 * 6. 向戶政事務所申請除戶戶籍謄本及繼承人戶籍申請書 (社員身故)
 * 7. 民事聲請查詢拋棄繼承或限定繼承狀 (法院家事法庭)
 * 8. 致全體繼承人履行遺產債務催告函
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
 * 1. 產生《民事支付命令聲請狀》
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
 * 2. 產生《民事強制執行聲請狀》
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
 * 3. 產生《民事聲請換發債權憑證狀》
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

/**
 * 4. 產生《社員逾期放款以留存股金及股息抵銷借款通知書》 (儲蓄互助社法第 14 條)
 */
function generateOffsetShareDoc(data) {
  const roc = getRocDateHelper();
  const principal = Number(data.principal) || 0;
  const manualInterest = Number(data.manualInterest) || 0;
  const manualPenalty = Number(data.manualPenalty) || 0;
  const totalDebt = principal + manualInterest + manualPenalty;

  const shareAmount = Number(data.shareAmount) || 0; // 留存股金
  const dividendAmount = Number(data.dividendAmount) || 0; // 歷年未領股息
  const totalOffset = shareAmount + dividendAmount;

  const remainingDebt = Math.max(0, totalDebt - totalOffset);
  const remainingShare = Math.max(0, totalOffset - totalDebt);

  return `【${data.creditorName || '有限責任○○儲蓄互助社'}】
函件文號：${data.docNo || '互社放催字第 ○○○○ 號'}
發文日期：中華民國 ${roc.rocYear} 年 ${roc.month} 月 ${roc.day} 日
受文者：${data.debtorName || '○○○'} 社員
社員編號：${data.debtorMemberNo || '○○○○'}
住址：${data.debtorAddress || ''}

主旨：通知台端於本社之放款逾期未償，本社依法行使留存股金及未領股息抵銷權，請 查照。

說明：
一、依據《儲蓄互助社法》第 14 條規定：「社員有借款餘額或為保證人未清償前，不得申請退社退股；逾期放款催收時，互助社得依法以社員之股金優先抵銷其欠款。」暨本社章程與放款規章辦理。
二、台端於本社之放款截至 ${roc.rocYear} 年 ${roc.month} 月 ${roc.day} 日止，尚欠本金新臺幣 ${toChineseCurrencyHelper(principal)}（${principal.toLocaleString()}元）及約定利息、違約金等，合計欠款總額為新臺幣 ${toChineseCurrencyHelper(totalDebt)}（${totalDebt.toLocaleString()}元）。
三、經查台端目前於本社留存之股金餘額為新臺幣 ${toChineseCurrencyHelper(shareAmount)}（${shareAmount.toLocaleString()}元）、歷年未領股息新臺幣 ${dividendAmount.toLocaleString()} 元，合計得抵銷總額為新臺幣 ${toChineseCurrencyHelper(totalOffset)}（${totalOffset.toLocaleString()}元）。
四、本社已於 ${roc.rocYear} 年 ${roc.month} 月理事會決議通過，自發文日起正式行使法定抵銷權：
    1. 抵銷前欠款總額：新臺幣 ${totalDebt.toLocaleString()} 元整。
    2. 抵銷股金及股息：新臺幣 ${totalOffset.toLocaleString()} 元整。
    3. 抵銷後剩餘欠款：新臺幣 ${remainingDebt.toLocaleString()} 元整（${toChineseCurrencyHelper(remainingDebt)}）。
    ${remainingDebt > 0 ? '五、抵銷後不足之未償餘額新臺幣 ' + remainingDebt.toLocaleString() + ' 元，請台端於文到 7 日內至本社繳清或來電洽商還款方案；逾期仍未清償者，本社將逕向法院聲請支付命令及強制執行，絕不寬貸。' : '五、抵銷後借款本息已全數清償完畢，剩餘股金新臺幣 ' + remainingShare.toLocaleString() + ' 元已轉入台端活期儲蓄帳戶。'}

此致
${data.debtorName || '○○○'} 社員

${data.creditorName || '有限責任○○儲蓄互助社'}
法定代理人（理事長）：${data.creditorRep || ''}
社址：${data.creditorAddress || ''}
電話：${data.creditorPhone || ''}
`;
}

/**
 * 5. 產生《理監事會審議逾期放款行使股金抵銷權簽呈》
 */
function generateOffsetBoardResolutionDoc(data) {
  const roc = getRocDateHelper();
  const principal = Number(data.principal) || 0;
  const shareAmount = Number(data.shareAmount) || 0;
  const dividendAmount = Number(data.dividendAmount) || 0;
  const totalOffset = shareAmount + dividendAmount;

  return `簽 於 放款業務部
發文字號：簽字第 ${roc.rocYear}${String(roc.month).padStart(2, '0')}01 號
日期：中華民國 ${roc.rocYear} 年 ${roc.month} 月 ${roc.day} 日
主旨：建請 理事會審議核准就社員【${data.debtorName || '○○○'}】逾期未償借款行使股金抵銷權案，請 鑒核。

說明：
一、社員【${data.debtorName || '○○○'}】（社員編號：${data.debtorMemberNo || '○○○○'}）於 ${formatRocDateHelper(data.loanDate)} 向本社借款新臺幣 ${Number(data.loanAmount || principal).toLocaleString()} 元，自 ${formatRocDateHelper(data.lastPaymentDate)} 起未依約攤還，累計逾期已逾 ${data.overdueMonths || '3'} 個月。
二、該員目前尚欠未償本金新臺幣 ${toChineseCurrencyHelper(principal)}（${principal.toLocaleString()}元）及利息。經專職人員多次電話催繳、發函催告均未獲具體清償方案。
三、查該員於本社尚有留存股金新臺幣 ${shareAmount.toLocaleString()} 元及未領股息 ${dividendAmount.toLocaleString()} 元，合計新臺幣 ${totalOffset.toLocaleString()} 元。
四、依《儲蓄互助社法》第 14 條及本社章程規定，為保全本社債權及維護全體社員利益，擬依法以其股金全額抵銷借款本息，並發函正式通知該員。

辦法：
奉 核可後，由專職人員辦理傳票會計帳務抵銷沖轉，並寄發《股金抵銷通知書》予借款人及連帶保證人。

擬辦：
請 理事會審議核決。

承辦專職：${data.agentName || '李專職'}      放款委員會召集人：           理事長：${data.creditorRep || '陳理事長'}
`;
}

/**
 * 6. 產生《向戶政事務所申請除戶戶籍謄本及繼承人戶籍申請書》 (社員身故)
 */
function generateHouseholdApplyDoc(data) {
  const roc = getRocDateHelper();
  return `戶籍謄本申請書（利害關係人債權保全專用）
受文機關：${data.householdOffice || '○○市○○區戶政事務所'}
申請日期：中華民國 ${roc.rocYear} 年 ${roc.month} 月 ${roc.day} 日

申請人（債權人）：${data.creditorName || '有限責任○○儲蓄互助社'}
統一編號：${data.creditorTaxId || ''}
法定代理人：${data.creditorRep || ''}
設址：${data.creditorAddress || ''}
聯絡電話：${data.creditorPhone || ''}
受任人（經辦專職）：${data.agentName || '李專職'}，身分證字號：${data.agentId || '○○○○○○○○○○'}

被申請人（即亡故債務人）：
姓名：${data.debtorName || '○○○'}
身分證統一編號：${data.debtorId || ''}
最後戶籍地址：${data.debtorAddress || ''}

申請事由與利害關係證明：
一、緣被申請人 ${data.debtorName || '○○○'} 前向申請人借款新臺幣 ${toChineseCurrencyHelper(data.principal || 0)} 未清償，詎其已於民國 ${data.deceasedDateRoc || '○○ 年 ○ 月 ○ 日'} 亡故。
二、申請人為行使合法債權並依法向其全體法定繼承人行使追索權，特依戶籍法第 65 條第 1 項及民法第 1148 條規定，檢附借據正本（或執行名義）及公文，申請核發被申請人之【除戶全戶戶籍謄本（含記事欄全）】及【全體第一順位繼承人之最新現戶戶籍謄本】各一份，以維權益。

檢附利害關係證明文件：
一、借款申請書兼借據影本一份。
二、放款明細表暨欠款計算書一份。
三、儲蓄互助社法人登記證書影本及法定代理人委任書一份。

此致
${data.householdOffice || '○○市○○區戶政事務所'}

申請人：${data.creditorName || '有限責任○○儲蓄互助社'}
法定代理人：${data.creditorRep || ''}
受任人：${data.agentName || '李專職'} （簽章）
`;
}

/**
 * 7. 產生《民事聲請查詢拋棄繼承或限定繼承狀》 (法院家事法庭)
 */
function generateInheritanceInquiryDoc(data) {
  const roc = getRocDateHelper();
  return `民事聲請查詢拋棄繼承或陳報遺產清冊狀
聲請人（即債權人）：${data.creditorName || '有限責任○○儲蓄互助社'}
統一編號：${data.creditorTaxId || ''}
法定代理人：${data.creditorRep || ''}
設址：${data.creditorAddress || ''}
電話：${data.creditorPhone || ''}

被繼承人（即亡故債務人）：${data.debtorName || '○○○'}
身分證統一編號：${data.debtorId || ''}
生前最後住所：${data.debtorAddress || ''}
死亡日期：民國 ${data.deceasedDateRoc || '○○ 年 ○ 月 ○ 日'}

為聲請查詢繼承事件事：

聲請意旨：
一、緣被繼承人 ${data.debtorName || '○○○'} 生前向聲請人借款尚有新臺幣 ${toChineseCurrencyHelper(data.principal || 0)}（${Number(data.principal || 0).toLocaleString()}元）及利息未償。
二、查被繼承人業於民國 ${data.deceasedDateRoc || '○○ 年 ○ 月 ○ 日'} 亡故，聲請人為依法向其法定繼承人主張債權，特檢附借據及除戶謄本，狀請 鈞院家事法庭准予函覆查詢：
    1. 被繼承人是否有繼承人向 鈞院聲請「拋棄繼承」？其聲請人姓名、案號及准予備查日期？
    2. 是否有繼承人向 鈞院陳報「限定繼承遺產清冊」？
三、懇請 鈞院惠予查覆，以憑辦理後續訴訟及強制執行程序，實感德便。

證物名稱及件數：
一、借據影本一份。
二、被繼承人除戶戶籍謄本一份。
三、聲請人家事訴訟利害關係證明文件一份。

謹  狀
臺灣 ${data.courtName || '臺中'} 地方法院 家事法庭  公鑒

中  華  民  國  ${roc.rocYear}  年  ${roc.month}  月  ${roc.day}  日

具狀人（即聲請人）：${data.creditorName || '有限責任○○儲蓄互助社'}
法定代理人：${data.creditorRep || ''}
`;
}

/**
 * 8. 產生《致全體繼承人履行遺產債務催告函》
 */
function generateInheritanceDemandDoc(data) {
  const roc = getRocDateHelper();
  const principal = Number(data.principal) || 0;
  return `【${data.creditorName || '有限責任○○儲蓄互助社'}】
函件文號：${data.docNo || '互社放催字第 ○○○○ 號'}
發文日期：中華民國 ${roc.rocYear} 年 ${roc.month} 月 ${roc.day} 日
受文者：被繼承人 ${data.debtorName || '○○○'} 之全體法定繼承人（如戶籍名冊）
住址：${data.heirAddress || '各繼承人現戶住址'}

主旨：催告台端等履行被繼承人 ${data.debtorName || '○○○'} 於本社之借款債務，請 查照並於文到 10 日內出面清償或協商。

說明：
一、緣被繼承人 ${data.debtorName || '○○○'}（身分證字號：${data.debtorId || ''}）生前於民國 ${formatRocDateHelper(data.loanDate)} 向本社借款，迄今尚欠未償本金新臺幣 ${toChineseCurrencyHelper(principal)}（${principal.toLocaleString()}元）及約定利息。
二、被繼承人不幸亡故後，依《民法》第 1148 條及第 1153 條規定，繼承人自繼承開始時，除法律另有規定外，承受被繼承人財產上之一切權利、義務，並對被繼承人之債務負清償責任。
三、為保全本社放款債權並維護全體社員資產安全，特此發函催告台端等繼承人。請於文到 10 日內，攜帶身分證件至本社辦理清償或洽談分期協商；若已向法院合法辦理拋棄繼承者，請檢附法院准予備查公文影本寄回本社以利銷案。
四、若逾期未為處理且未合法拋棄繼承者，本社將依法向臺灣地方法院對全體繼承人聲請強制執行（就所得遺產範圍內扣押執行），屆時產生之法律程序費用將一併由繼承人負擔。

此致
被繼承人 ${data.debtorName || '○○○'} 之全體繼承人

${data.creditorName || '有限責任○○儲蓄互助社'}
法定代理人（理事長）：${data.creditorRep || ''}
社址：${data.creditorAddress || ''}
電話：${data.creditorPhone || ''}
`;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generatePaymentOrderDoc,
    generateExecutionDoc,
    generateRenewCertificateDoc,
    generateOffsetShareDoc,
    generateOffsetBoardResolutionDoc,
    generateHouseholdApplyDoc,
    generateInheritanceInquiryDoc,
    generateInheritanceDemandDoc
  };
}
