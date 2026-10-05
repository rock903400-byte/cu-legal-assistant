/**
 * 司法院標準公文與儲互社法催範本庫 (templates.js)
 * 包含：
 * 1. 民事支付命令聲請狀 (含用印指引)
 * 2. 民事強制執行聲請狀 (含扣押保險解約金、扣押銀行存款、扣薪、查調所得等與用印指引)
 * 3. 民事聲請核發／換發債權憑證狀 (依執行名義種類決定)
 * 4. 社員逾期放款以留存股金及股息抵銷借款通知書 (依本社章程)
 * 5. 理監事會審議逾期放款行使股金抵銷權簽呈
 * 6. 向戶政事務所申請除戶戶籍謄本及繼承人戶籍申請書 (社員身故)
 * 7. 民事聲請查詢拋棄繼承或限定繼承狀 (法院家事法庭)
 * 8. 致全體繼承人履行遺產債務催告函
 * 9. 郵局存證信函（清償債務催告）
 * 10. 郵局存證信函（股金扣除貸款）
 * 11. 民事聲請支付命令確定證明書狀
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
 * 待填欄位一律以「○」標示，不得以看似真實的預設值代替
 * （書狀是要送法院的，漏填時必須一眼看得出來，而不是印出假的日期或金額）
 */
const BLANK_ROC_DATE = '民國 ○○ 年 ○○ 月 ○○ 日';

function rocDateOrBlankHelper(dateStr) {
  return formatRocDateHelper(dateStr) || BLANK_ROC_DATE;
}

/** 注意：toChineseCurrency 的回傳值已含「新臺幣」前綴，使用處不可再自行加綴 */
function chineseMoneyOrBlankHelper(num) {
  return Number(num) > 0 ? toChineseCurrencyHelper(num) : '新臺幣○○○元整';
}

function numberOrBlankHelper(num) {
  return Number(num) > 0 ? Number(num).toLocaleString() : '○○○';
}

function textOrBlankHelper(value, placeholder = '○○') {
  return (value === undefined || value === null || String(value).trim() === '') ? placeholder : value;
}

/** 執行名義種類：決定強制執行狀的「執行名義」、證物，以及債權憑證狀是「核發」或「換發」 */
const TITLE_TYPES = {
  payment_order: { label: '支付命令及確定證明書', exhibit: '支付命令及確定證明書正本各一份', isCert: false },
  judgment: { label: '民事判決及確定證明書', exhibit: '民事判決及確定證明書正本各一份', isCert: false },
  cert: { label: '債權憑證', exhibit: '債權憑證正本一份', isCert: true }
};

function resolveTitleType(key) {
  return TITLE_TYPES[key] || TITLE_TYPES.payment_order;
}

const CN_ORDINALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

/**
 * 解析「其他連帶保證人」「繼承人」文字框：每行一位，欄位以「｜」「|」「,」或 Tab 分隔
 * 格式：姓名｜身分證字號｜住居所（後兩欄可省略）
 */
function parsePartiesText(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [name, id, address] = line.split(/[|｜,，\t]/).map(x => (x || '').trim());
      return { name: name || '', id: id || '', address: address || '' };
    })
    .filter(p => p.name);
}

/** 連帶保證人清單：單一欄位填寫的保證人 + 「其他連帶保證人」文字框；未勾選保證人時為空 */
function collectGuarantors(data) {
  if (!data.hasGuarantor) return [];
  const list = [];
  if (data.guarantorName) {
    list.push({ name: data.guarantorName, id: data.guarantorId || '', address: data.guarantorAddress || '' });
  }
  return list.concat(parsePartiesText(data.extraParties));
}

function joinNames(list) {
  return list.map(p => p.name).join('、');
}

function renderPartyBlocks(list, label, fallbackAddress = '') {
  return list
    .map(p => `${label}：${p.name}\n身分證統一編號：${p.id || ''}\n住居所：${p.address || fallbackAddress}`)
    .join('\n');
}

/** 存證信函用日期（每字佔一格，不含空白），例：民國112年5月10日 */
function rocDateCompactHelper(dateStr) {
  const blank = '民國○○年○○月○○日';
  if (!dateStr) return blank;
  const [y, m, d] = String(dateStr).split('-').map(Number);
  if (!y || !m || !d) return blank;
  return `民國${y - 1911}年${m}月${d}日`;
}

/** 存證信函沿用附件原文慣用的「新台幣」 */
function taiwanDollarHelper(num) {
  return Number(num) > 0
    ? toChineseCurrencyHelper(num).replace(/^新臺幣/, '新台幣')
    : '新台幣○○○○○元整';
}

/** 本社章程條次：容許輸入「十七」或「第十七條」，統一成「十七」；未填以「○○」待填 */
function bylawArticleHelper(value) {
  const v = String(value || '').trim().replace(/^第/, '').replace(/條$/, '').trim();
  return v || '○○';
}

/** 自某日起算至今已逾幾整月（簽呈「累計逾期已逾 N 個月」）；日期未填回傳「○」 */
function overdueMonthsHelper(dateStr) {
  if (!dateStr) return '○';
  const [y, m, d] = String(dateStr).split('-').map(Number);
  if (!y || !m || !d) return '○';
  const now = new Date();
  let months = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
  if (now.getDate() < d) months -= 1;
  return Math.max(0, months);
}

/**
 * 1. 產生《民事支付命令聲請狀》
 * 依附件實務範本：債權人／債務人稱謂；違約金按利息百分之 N 計算；
 * 可選：利率經理事會決議調整、以切結書為憑、債務人死亡（繼承人於遺產範圍內連帶）、多位連帶保證人
 */
function generatePaymentOrderDoc(data) {
  const roc = getRocDateHelper();
  const loanDateRoc = rocDateOrBlankHelper(data.loanDate);
  const lastPaymentDateRoc = rocDateOrBlankHelper(data.lastPaymentDate);
  const interestStartDateRoc = rocDateOrBlankHelper(data.interestStartDate || data.lastPaymentDate);

  const principal = Number(data.principal) || 0;
  const manualInterest = Number(data.manualInterest) || 0;
  const manualPenalty = Number(data.manualPenalty) || 0;
  const totalClaim = principal + manualInterest + manualPenalty;

  const principalChinese = chineseMoneyOrBlankHelper(principal);
  const totalClaimChinese = chineseMoneyOrBlankHelper(totalClaim);
  const loanAmountChinese = chineseMoneyOrBlankHelper(Number(data.loanAmount) || principal);
  const loanAmountNum = numberOrBlankHelper(Number(data.loanAmount) || principal);
  const manualInterestChinese = manualInterest > 0 ? toChineseCurrencyHelper(manualInterest) : '';
  const manualPenaltyChinese = manualPenalty > 0 ? toChineseCurrencyHelper(manualPenalty) : '';

  const creditorName = data.creditorName || '有限責任○○儲蓄互助社';
  const debtorName = data.debtorName || '○○○';
  const isDeceased = !!data.debtorDeceased;
  const guarantors = collectGuarantors(data);
  const guarantorNames = joinNames(guarantors);
  const heirs = isDeceased ? parsePartiesText(data.heirs) : [];
  const heirNames = heirs.length ? joinNames(heirs) : '○○○';

  // 請求主體與「連帶」措辭
  const subject = isDeceased ? `債務人 ${heirNames} ` : (guarantors.length ? '債務人等' : '債務人');
  const scope = isDeceased
    ? `於繼承被繼承人 ${debtorName} 所得遺產範圍內${guarantors.length ? '與債務人 ' + guarantorNames + ' ' : ''}`
    : '';
  const joint = (isDeceased || guarantors.length) ? '連帶' : '';
  const sueVerb = isDeceased ? '於繼承所得遺產範圍內連帶' : joint;
  const costSubject = isDeceased ? `債務人 ${heirNames} ${scope}連帶` : (guarantors.length ? '債務人等連帶' : '債務人');

  // 違約金：按上開利息百分之 N 計算（可另訂起算日）
  const penaltyTail = (ratio, startRoc) => ratio
    ? (startRoc
      ? `，並自 ${startRoc} 起至清償日止，按上開利息百分之 ${ratio} 計算之違約金`
      : `，並按上開利息百分之 ${ratio} 計算之違約金`)
    : '';
  const penaltyRatio = String(data.penaltyRatio ?? '').trim();
  const penaltyStartRoc = data.penaltyStartDate ? rocDateOrBlankHelper(data.penaltyStartDate) : '';
  const currentPenaltyTail = penaltyTail(penaltyRatio, penaltyStartRoc);

  // 當事人區塊
  const guarantorBlocks = renderPartyBlocks(guarantors, '債務人（即連帶保證人）', '同債務人或詳如借據');
  let debtorBlocks;
  if (isDeceased) {
    const list = heirs.length ? heirs : [{ name: '○○○', id: '', address: '' }];
    debtorBlocks = list
      .map(h => `債務人：${h.name}（即 ${debtorName} 之繼承人）\n身分證統一編號：${h.id}\n住居所：${h.address}`)
      .join('\n');
  } else {
    debtorBlocks = `債務人：${debtorName}\n身分證統一編號：${data.debtorId || ''}\n住居所：${data.debtorAddress || ''}`;
  }
  const partySection = debtorBlocks + (guarantorBlocks ? '\n' + guarantorBlocks : '');

  // 請求之標的
  const claims = [];
  let claim1 = `一、${subject}應${scope}${joint}給付債權人${principalChinese}（小寫：${numberOrBlankHelper(principal)} 元），及自 ${interestStartDateRoc} 起至清償日止，按年息百分之 ${textOrBlankHelper(data.interestRate)} 計算之利息${currentPenaltyTail}。`;
  if (manualInterest > 0) {
    claim1 += `\n   並給付前已積欠之約定利息${manualInterestChinese}（小寫：${manualInterest.toLocaleString()} 元）。`;
  }
  claims.push(claim1);
  if (manualPenalty > 0) {
    claims.push(`二、${subject}應${scope}${joint}給付債權人前已積欠之約定違約金${manualPenaltyChinese}（小寫：${manualPenalty.toLocaleString()} 元）。`);
  }
  claims.push(`${manualPenalty > 0 ? '三' : '二'}、督促程序費用由${costSubject}負擔。`);

  // 證物（編號依實際附件順序）
  const basisIsAffidavit = data.basisType === 'affidavit';
  const basisName = basisIsAffidavit ? '還款切結書' : '借據';
  const exhibits = [`${basisName}影本一份。`];
  if (data.rateChanged) exhibits.push('債權人利息、違約金變動理事會紀錄影本一份。');
  exhibits.push('500 元郵局匯票一紙。');
  if (isDeceased) exhibits.push('家事事件公告網路查詢資料一份。');
  const exhibitNo = (keyword) => CN_ORDINALS[exhibits.findIndex(e => e.includes(keyword))];

  // 事實及理由
  const originalDebtor = isDeceased ? '被繼承人' : '債務人';
  const guarantorClause = guarantors.length ? `，並有債務人 ${guarantorNames} 為連帶保證人，依法應負連帶清償責任` : '';
  const loanClause = basisIsAffidavit
    ? `與債權人簽立切結書，願分期按月償還${loanAmountChinese}（切結金額：${loanAmountNum} 元）`
    : `向債權人借款${loanAmountChinese}（借款金額：${loanAmountNum} 元），雙方約定分期按月攤還本息`;

  const reasons = [];
  reasons.push(`緣${originalDebtor} ${debtorName} 於 ${loanDateRoc} ${loanClause}${guarantorClause}，此有${basisName}乙紙可憑（見證物一）。`);
  if (data.rateChanged) {
    const origTail = penaltyTail(String(data.origPenaltyRatio ?? '').trim(), '');
    reasons.push(`債權人原借據約定借款利率為按年息百分之 ${textOrBlankHelper(data.origRate)} 計算之利息${origTail}，惟債權人理事會於 ${rocDateOrBlankHelper(data.rateChangeDate)} 決議調整借款利率為按年息百分之 ${textOrBlankHelper(data.interestRate)} 計算之利息${currentPenaltyTail}（見證物${exhibitNo('理事會')}）。`);
  }
  reasons.push(`詎${originalDebtor}自 ${lastPaymentDateRoc} 起即未依約繳納本息${isDeceased ? '。' : '，迭經債權人屢次催討，債務人均置之不理。'}迄今尚積欠本金${principalChinese}及前揭約定之利息與違約金未為清償，依約已喪失期限利益，債務視為全部到期。`);
  if (isDeceased) {
    reasons.push(`惟被繼承人 ${debtorName} 已於 ${rocDateOrBlankHelper(data.deceasedDate)} 死亡，於繼承人未為相關權利主張時（詳證物${exhibitNo('家事事件')}），其被繼承人之債權債務關係應由繼承人繼承，並依法應負連帶清償責任，未料屆期不為清償，經債權人一再催索，仍置之不理。`);
  }
  reasons.push(`依民事訴訟法第 508 條及第 511 條規定，債權人之請求以給付金錢為標的者，得聲請法院依督促程序核發支付命令。為此特狀請 鈞院依督促程序對債務人發支付命令，命其${sueVerb}清償如請求標的所示之金額及費用，以維權益，實感德便。`);

  const docText = `民事支付命令聲請狀
訴訟標的金額：${totalClaimChinese}（小寫：新臺幣 ${numberOrBlankHelper(totalClaim)} 元）
聲請規費：新臺幣 500 元

債權人：${creditorName}
統一編號：${data.creditorTaxId || ''}
法定代理人：${data.creditorRep || ''}
設址：${data.creditorAddress || ''}
送達代收人：${data.agentName || data.creditorRep || ''}
送達處所：${data.creditorAddress || ''}
電話：${data.creditorPhone || ''}

${partySection}

為聲請核發支付命令事：

請求之標的：
${claims.join('\n')}

事實及理由：
${reasons.map((t, i) => `${CN_ORDINALS[i]}、${t}`).join('\n')}

證物名稱及件數：
${exhibits.map((e, i) => `${CN_ORDINALS[i]}、${e}`).join('\n')}

謹  狀
臺灣 ${textOrBlankHelper(data.courtName)} 地方法院 民事庭  公鑒

中  華  民  國  ${roc.rocYear}  年  ${roc.month}  月  ${roc.day}  日

具狀人：${creditorName}  [ 蓋社圖記 (大章) ]
法定代理人：${data.creditorRep || ''}  [ 理事長簽章 (小章) ]
`;

  return docText;
}

/**
 * 1-2. 產生《民事聲請支付命令確定證明書狀》（民事訴訟法第 521 條、第 399 條第 1 項）
 * 支付命令送達債務人、逾 20 日未異議而確定後，須先取得確定證明書，才能聲請強制執行
 */
function generatePaymentOrderFinalDoc(data) {
  const roc = getRocDateHelper();
  const principal = Number(data.principal) || 0;
  const totalClaim = principal + (Number(data.manualInterest) || 0) + (Number(data.manualPenalty) || 0);
  const creditorName = data.creditorName || '有限責任○○儲蓄互助社';
  const titleCaseNo = data.titleCaseNo || '○○ 年度 ○ 字第 ○○○○ 號';

  // 「聲請人與○○○間」：一般為債務人與連帶保證人；債務人死亡時為繼承人與連帶保證人
  const guarantors = collectGuarantors(data);
  const heirs = data.debtorDeceased ? parsePartiesText(data.heirs) : [];
  const obligors = (data.debtorDeceased ? heirs : [{ name: data.debtorName || '○○○' }]).concat(guarantors);
  const obligorNames = obligors.length ? joinNames(obligors) : '○○○';

  return `民事聲請支付命令確定證明書狀
案號：${titleCaseNo}
承辦股別：
訴訟標的金額或價額：${chineseMoneyOrBlankHelper(totalClaim)}（小寫：新臺幣 ${numberOrBlankHelper(totalClaim)} 元）

聲請人（即債權人）：${creditorName}
營利事業統一編號：${data.creditorTaxId || ''}
設址：${data.creditorAddress || ''}
電話：${data.creditorPhone || ''}
送達代收人：${data.agentName || data.creditorRep || ''}
送達處所：${data.creditorAddress || ''}
法定代理人：${data.creditorRep || ''}

為聲請付與支付命令確定證明書事：

一、聲請人與${obligorNames}間因 ${titleCaseNo} 事件，經 貴院於 ${rocDateOrBlankHelper(data.orderIssueDate)} 核發支付命令，並已確定在案。
二、依民事訴訟法第 521 條、第 399 條第 1 項規定，聲請 貴院付與該支付命令確定證明書。

此致
臺灣 ${textOrBlankHelper(data.courtName)} 地方法院  公鑒

證物名稱及件數：

中  華  民  國  ${roc.rocYear}  年  ${roc.month}  月  ${roc.day}  日

具狀人（即聲請人）：${creditorName}  [ 蓋社圖記 (大章) ]
法定代理人：${data.creditorRep || ''}  [ 理事長簽章 (小章) ]
`;
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

  const totalClaimChinese = chineseMoneyOrBlankHelper(totalClaim);
  const principalChinese = chineseMoneyOrBlankHelper(principal);
  const executionFee = calculateCourtFeesHelper(totalClaim, 'execution');
  const executionFeeText = totalClaim > 0
    ? `新臺幣 ${executionFee.toLocaleString()} 元（按請求金額千分之八計算${executionFee === 0 ? '，未滿五千元免徵' : ''}）`
    : '新臺幣 ○○○ 元';
  const titleType = resolveTitleType(data.titleType);

  // 連帶保證人區塊（可多位）
  const guarantors = collectGuarantors(data);
  const guarantorSection = guarantors.length
    ? '\n' + renderPartyBlocks(guarantors, '債務人（即連帶保證人）', '詳如執行名義') + '\n'
    : '';

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
    targetClaims.push(`${numChinese[itemNum - 1]}、請 鈞院依職權囑託【財政部各地區國稅局】查調債務人${guarantors.length ? '及連帶保證人' : ''}最新全年度財產總歸戶清單及各類所得資料清單，以供查報財產並予執行。`);
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
執行標的金額：${totalClaimChinese}（小寫：新臺幣 ${numberOrBlankHelper(totalClaim)} 元）
執行規費：${executionFeeText}

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
臺灣 ${textOrBlankHelper(data.titleCourt || data.courtName)} 地方法院 ${data.titleCaseNo || '○○ 年度 ○ 字第 ○○○○ 號'} ${titleType.label}。

實施強制執行之標的及方法：
${targetClaims.join('\n')}

事實及理由：
一、聲請人與債務人間清償借款強制執行事件，前經 鈞院核發 ${data.titleCaseNo || '○○ 年度 ○ 字第 ○○○○ 號'} 確定之執行名義在案，債務人依法應給付聲請人如執行名義所載之本金、利息、違約金及督促程序費用。
二、詎該執行名義確定後，債務人迄未履行清償義務，迄今尚欠本金${principalChinese}及約定利息、違約金。為此依強制執行法第 4 條、第 6 條、第 115 條等規定，檢附前開執行名義正本，狀請 鈞院民事執行處依法實施強制執行，以維債權，實感德便。

證物名稱及件數：
一、${titleType.exhibit}。
二、執行規費繳納收據一份。
${data.targets && data.targets.insurance ? '三、最高法院 108 年度台抗大字第 897 號民事大法庭裁定要旨一份。\n' : ''}
謹  狀
臺灣 ${textOrBlankHelper(data.courtName)} 地方法院 民事執行處  公鑒

中  華  民  國  ${roc.rocYear}  年  ${roc.month}  月  ${roc.day}  日

具狀人（即聲請人）：${data.creditorName || '有限責任○○儲蓄互助社'}  [ 蓋社圖記 (大章) ]
法定代理人：${data.creditorRep || ''}  [ 理事長簽章 (小章) ]
`;

  return docText;
}

/**
 * 3. 產生《民事聲請換發債權憑證狀》
 */
function generateRenewCertificateDoc(data) {
  const roc = getRocDateHelper();
  const principal = Number(data.principal) || 0;
  const principalChinese = chineseMoneyOrBlankHelper(principal);

  // 執行名義為債權憑證 → 換發；為支付命令／判決 → 首次核發
  const titleType = resolveTitleType(data.titleType);
  const action = titleType.isCert ? '換發' : '核發';
  const caseNoText = `${textOrBlankHelper(data.caseYear)} 年度 ${textOrBlankHelper(data.caseWord)} 字第 ${textOrBlankHelper(data.caseNo, '○○○○')} 號`;

  const docText = `民事聲請${action}債權憑證狀
案號：${caseNoText}
股別：${textOrBlankHelper(data.caseSection, '○')} 股

聲請人（即債權人）：${data.creditorName || '有限責任○○儲蓄互助社'}
統一編號：${data.creditorTaxId || ''}
法定代理人：${data.creditorRep || ''}
設址：${data.creditorAddress || ''}
電話：${data.creditorPhone || ''}

債務人：${data.debtorName || '○○○'}
身分證統一編號：${data.debtorId || ''}
住居所：${data.debtorAddress || ''}
${collectGuarantors(data).map(g => '連帶保證人：' + g.name + '，身分證字號：' + (g.id || '') + '，住居所：' + (g.address || '')).join('\n')}

為聲請${action}債權憑證事：

聲請意旨：
聲請人與債務人間清償借款強制執行事件，業經 鈞院以 ${caseNoText} 受理在案。
查債務人目前查無可供執行之財產，為保全聲請人未受償之債權（本金${principalChinese}及其利息、違約金），並依民法第 137 條第 3 項及強制執行法第 27 條規定中斷消滅時效，特狀請 鈞院准予${action}債權憑證，以維權益，實感德便。

證物名稱及件數：
一、${titleType.exhibit}。

謹  狀
臺灣 ${textOrBlankHelper(data.courtName)} 地方法院 民事執行處  公鑒

中  華  民  國  ${roc.rocYear}  年  ${roc.month}  月  ${roc.day}  日

具狀人（即聲請人）：${data.creditorName || '有限責任○○儲蓄互助社'}  [ 蓋社圖記 (大章) ]
法定代理人：${data.creditorRep || ''}  [ 理事長簽章 (小章) ]
`;

  return docText;
}

/**
 * 4. 產生《社員逾期放款以留存股金及股息抵銷借款通知書》
 * 抵銷依據為「本社章程」條文（《儲蓄互助社法》第 14 條是退股程序，並無抵銷規定，不可引用）
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

主旨：通知台端於本社之放款逾期未償，本社依本社章程以台端留存之股金及未領股息抵銷借款，請 查照。

說明：
一、依本社章程第 ${bylawArticleHelper(data.bylawArticle)} 條規定，台端借款逾期未清償時，本社得以台端留存之股金扣除（抵銷）所欠借款，爰依此辦理。
二、台端於本社之放款截至 ${roc.rocYear} 年 ${roc.month} 月 ${roc.day} 日止，尚欠本金${chineseMoneyOrBlankHelper(principal)}（${numberOrBlankHelper(principal)}元）及約定利息、違約金等，合計欠款總額為${chineseMoneyOrBlankHelper(totalDebt)}（${numberOrBlankHelper(totalDebt)}元）。
三、經查台端目前於本社留存之股金餘額為${chineseMoneyOrBlankHelper(shareAmount)}（${numberOrBlankHelper(shareAmount)}元）、歷年未領股息新臺幣 ${dividendAmount.toLocaleString()} 元，合計得抵銷總額為${chineseMoneyOrBlankHelper(totalOffset)}（${numberOrBlankHelper(totalOffset)}元）。
四、本社理事會已決議通過，自發文日起正式行使抵銷權：
    1. 抵銷前欠款總額：新臺幣 ${totalDebt.toLocaleString()} 元整。
    2. 抵銷股金及股息：新臺幣 ${totalOffset.toLocaleString()} 元整。
    3. 抵銷後剩餘欠款：新臺幣 ${remainingDebt.toLocaleString()} 元整（${toChineseCurrencyHelper(remainingDebt)}）。
    ${remainingDebt > 0 ? '五、抵銷後不足之未償餘額新臺幣 ' + remainingDebt.toLocaleString() + ' 元，請台端於文到 7 日內至本社繳清或來電洽商還款方案；逾期仍未清償者，本社將逕向法院聲請支付命令及強制執行，絕不寬貸。' : '五、抵銷後借款本息已全數清償完畢，剩餘股金新臺幣 ' + remainingShare.toLocaleString() + ' 元已轉入台端活期儲蓄帳戶。'}

此致
${data.debtorName || '○○○'} 社員

${data.creditorName || '有限責任○○儲蓄互助社'}  [ 蓋社圖記 (大章) ]
法定代理人（理事長）：${data.creditorRep || ''}  [ 理事長簽章 (小章) ]
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
一、社員【${data.debtorName || '○○○'}】（社員編號：${data.debtorMemberNo || '○○○○'}）於 ${rocDateOrBlankHelper(data.loanDate)} 向本社借款新臺幣 ${numberOrBlankHelper(Number(data.loanAmount) || principal)} 元，自 ${rocDateOrBlankHelper(data.lastPaymentDate)} 起未依約攤還，累計逾期已逾 ${overdueMonthsHelper(data.lastPaymentDate)} 個月。
二、該員目前尚欠未償本金${chineseMoneyOrBlankHelper(principal)}（${numberOrBlankHelper(principal)}元）及利息。經專職人員多次電話催繳、發函催告均未獲具體清償方案。
三、查該員於本社尚有留存股金新臺幣 ${shareAmount.toLocaleString()} 元及未領股息 ${dividendAmount.toLocaleString()} 元，合計新臺幣 ${totalOffset.toLocaleString()} 元。
四、依本社章程第 ${bylawArticleHelper(data.bylawArticle)} 條規定，為保全本社債權及維護全體社員利益，擬以其股金全額抵銷借款本息，並發函正式通知該員。

辦法：
奉 核可後，由專職人員辦理傳票會計帳務抵銷沖轉，並寄發《股金抵銷通知書》予借款人及連帶保證人。

擬辦：
請 理事會審議核決。

承辦專職：${data.agentName || '○○○'} [簽名]      放款委員會召集人： [簽名]          理事長：${data.creditorRep || '○○○'} [蓋章]
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
受任人（經辦專職）：${data.agentName || '○○○'}，身分證字號：${data.agentId || '○○○○○○○○○○'}

被申請人（即亡故債務人）：
姓名：${data.debtorName || '○○○'}
身分證統一編號：${data.debtorId || ''}
最後戶籍地址：${data.debtorAddress || ''}

申請事由與利害關係證明：
一、緣被申請人 ${data.debtorName || '○○○'} 前向申請人借款${toChineseCurrencyHelper(data.principal || 0)}未清償，詎其已於民國 ${data.deceasedDateRoc || '○○ 年 ○ 月 ○ 日'} 亡故。
二、申請人為行使合法債權並依法向其全體法定繼承人行使追索權，特依戶籍法第 65 條第 1 項及民法第 1148 條規定，檢附借據正本（或執行名義）及公文，申請核發被申請人之【除戶全戶戶籍謄本（含記事欄全）】及【全體第一順位繼承人之最新現戶戶籍謄本】各一份，以維權益。

檢附利害關係證明文件：
一、借款申請書兼借據影本一份。
二、放款明細表暨欠款計算書一份。
三、儲蓄互助社法人登記證書影本及法定代理人委任書一份。

此致
${data.householdOffice || '○○市○○區戶政事務所'}

申請人：${data.creditorName || '有限責任○○儲蓄互助社'}  [ 蓋社圖記 (大章) ]
法定代理人：${data.creditorRep || ''}  [ 理事長簽章 (小章) ]
受任人：${data.agentName || '○○○'} （簽章）
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
一、緣被繼承人 ${data.debtorName || '○○○'} 生前向聲請人借款尚有${toChineseCurrencyHelper(data.principal || 0)}（${Number(data.principal || 0).toLocaleString()}元）及利息未償。
二、查被繼承人業於民國 ${data.deceasedDateRoc || '○○ 年 ○ 月 ○ 日'} 亡故，聲請人為依法向其法定繼承人主張債權，特檢附借據及除戶謄本，狀請 鈞院家事法庭准予函覆查詢：
    1. 被繼承人是否有繼承人向 鈞院聲請「拋棄繼承」？其聲請人姓名、案號及准予備查日期？
    2. 是否有繼承人向 鈞院陳報「限定繼承遺產清冊」？
三、懇請 鈞院惠予查覆，以憑辦理後續訴訟及強制執行程序，實感德便。

證物名稱及件數：
一、借據影本一份。
二、被繼承人除戶戶籍謄本一份。
三、聲請人家事訴訟利害關係證明文件一份。

謹  狀
臺灣 ${textOrBlankHelper(data.courtName)} 地方法院 家事法庭  公鑒

中  華  民  國  ${roc.rocYear}  年  ${roc.month}  月  ${roc.day}  日

具狀人（即聲請人）：${data.creditorName || '有限責任○○儲蓄互助社'}  [ 蓋社圖記 (大章) ]
法定代理人：${data.creditorRep || ''}  [ 理事長簽章 (小章) ]
`;
}

/**
 * 8. 產生《致全體繼承人履行遺產債務催告函》
 */
function generateInheritanceDemandDoc(data) {
  const roc = getRocDateHelper();
  const principal = Number(data.principal) || 0;
  return `【${data.creditorName || '有限責任○○儲蓄互助社'}】
函件文號：${data.docNo || '互社放催字第 ○○○事 號'}
發文日期：中華民國 ${roc.rocYear} 年 ${roc.month} 月 ${roc.day} 日
受文者：被繼承人 ${data.debtorName || '○○○'} 之全體法定繼承人（如戶籍名冊）
住址：${data.heirAddress || '各繼承人現戶住址'}

主旨：催告台端等履行被繼承人 ${data.debtorName || '○○○'} 於本社之借款債務，請 查照並於文到 10 日內出面清償或協商。

說明：
一、緣被繼承人 ${data.debtorName || '○○○'}（身分證字號：${data.debtorId || ''}）生前於 ${rocDateOrBlankHelper(data.loanDate)} 向本社借款，迄今尚欠未償本金${toChineseCurrencyHelper(principal)}（${principal.toLocaleString()}元）及約定利息。
二、被繼承人不幸亡故後，依《民法》第 1148 條及第 1153 條規定，繼承人自繼承開始時，除法律另有規定外，承受被繼承人財產上之一切權利、義務，並對被繼承人之債務負清償責任。
三、為保全本社放款債權並維護全體社員資產安全，特此發函催告台端等繼承人。請於文到 10 日內，攜帶身分證件至本社辦理清償或洽談分期協商；若已向法院合法辦理拋棄繼承者，請檢附法院准予備查公文影本寄回本社以利銷案。
四、若逾期未為處理且未合法拋棄繼承者，本社將依法向臺灣地方法院對全體繼承人聲請強制執行（就所得遺產範圍內扣押執行），屆時產生之法律程序費用將一併由繼承人負擔。

此致
被繼承人 ${data.debtorName || '○○○'} 之全體繼承人

${data.creditorName || '有限責任○○儲蓄互助社'}  [ 蓋社圖記 (大章) ]
法定代理人（理事長）：${data.creditorRep || ''}  [ 理事長簽章 (小章) ]
社址：${data.creditorAddress || ''}
電話：${data.creditorPhone || ''}
`;
}


/**
 * 9. 郵局存證信函（清償債務催告）— 內容沿用附件〈存證信函（清償債務）〉原文
 * 寄件人／收件人／副本收件人依郵局存證信函用紙欄位；「內容：」以下為每格一字之正文
 */
function postalLetterHeader(data, title) {
  const guarantors = collectGuarantors(data);
  const copyBlock = guarantors.length
    ? '\n三、副本收件人\n' + guarantors.map(g => `姓名：${g.name}\n詳細地址：${g.address || ''}`).join('\n') + '\n'
    : '';
  return `${title}

一、寄件人
姓名：${data.creditorName || '有限責任○○儲蓄互助社'}　法定代理人：${data.creditorRep || '○○○'}  [ 蓋社圖記 (大章) ]
詳細地址：${data.creditorAddress || ''}

二、收件人
姓名：${data.debtorName || '○○○'}
詳細地址：${data.debtorAddress || ''}
${copyBlock}
內容：
`;
}

function generateDemandLetterDoc(data) {
  const principal = Number(data.principal) || 0;
  const body = `敬啟者　台端於${rocDateCompactHelper(data.loanDate)}向本社借貸${taiwanDollarHelper(Number(data.loanAmount) || principal)}，至今仍有本金${taiwanDollarHelper(principal)}及利息、違約金尚未清償，謹此函告　台端請於函到七日內至本社處理，否則將依法訴訟請求，事涉台端權益，請惠予配合為禱，以免訟累。`;
  return postalLetterHeader(data, '郵局存證信函（清償債務催告）') + body + '\n';
}

/**
 * 10. 郵局存證信函（股金扣除貸款）— 內容沿用附件〈存證信函（股金扣除貸款）〉原文
 * 適用：已經法院訴訟、進入執行階段，社員仍有股金尚未扣除貸款
 */
function generateOffsetLetterDoc(data) {
  const principal = Number(data.principal) || 0;
  const body = `敬啟者　台端於${rocDateCompactHelper(data.loanDate)}向本社借貸${taiwanDollarHelper(Number(data.loanAmount) || principal)}，至今仍有本金${taiwanDollarHelper(principal)}及利息、違約金尚未清償，經法院訴訟已於執行階段，目前仍有股金尚未扣除貸款，依本社章程${bylawArticleHelper(data.bylawArticle)}條，將以股金扣除貸款後續行執行法催程序，謹此函告　台端若有異議請於函到七日內至本社處理，事涉台端權益，請惠予配合為禱，以免訟累。`;
  return postalLetterHeader(data, '郵局存證信函（股金扣除貸款）') + body + '\n';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generatePaymentOrderDoc,
    generatePaymentOrderFinalDoc,
    generateDemandLetterDoc,
    generateOffsetLetterDoc,
    parsePartiesText,
    collectGuarantors,
    generateExecutionDoc,
    generateRenewCertificateDoc,
    generateOffsetShareDoc,
    generateOffsetBoardResolutionDoc,
    generateHouseholdApplyDoc,
    generateInheritanceInquiryDoc,
    generateInheritanceDemandDoc
  };
}
