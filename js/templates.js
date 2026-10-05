/**
 * 司法院標準公文與儲互社法催範本庫 (templates.js)
 * 包含：
 * 1. 民事支付命令聲請狀 (含用印指引)
 * 2. 民事強制執行聲請狀 (含扣押保險解約金、扣押銀行存款、扣薪、查調所得等與用印指引)
 * 3. 民事聲請核發／換發債權憑證狀 (依執行名義種類決定)
 * 4. 郵局存證信函（清償債務催告）
 * 5. 郵局存證信函（股金扣除貸款，限已進入執行階段）
 * 1-2. 民事聲請支付命令確定證明書狀
 */

// 相容 Node.js 與瀏覽器環境
let _toChineseCurrency = typeof toChineseCurrency !== 'undefined' ? toChineseCurrency : null;
let _formatRocDate = typeof formatRocDate !== 'undefined' ? formatRocDate : null;
let _getCurrentRocDate = typeof getCurrentRocDate !== 'undefined' ? getCurrentRocDate : null;
let _calculateCourtFees = typeof calculateCourtFees !== 'undefined' ? calculateCourtFees : null;
let _getMinLivingStandard = typeof getMinLivingStandard !== 'undefined' ? getMinLivingStandard : null;

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
  try {
    const sal = require('./salary-calc');
    if (sal) {
      _getMinLivingStandard = _getMinLivingStandard || sal.getMinLivingStandard;
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

/** 中文序數（一、二…十、十一…二十、二十一…），供條列項目編號；項目多時（例如多家存款銀行）也不會出現 undefined */
const CN_ORDINALS = (() => {
  const d = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const list = [];
  for (let n = 1; n <= 99; n++) {
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    list.push((tens === 0 ? '' : (tens === 1 ? '十' : d[tens - 1] + '十')) + (ones === 0 ? (tens === 0 ? '' : '') : d[ones - 1]));
  }
  return list;
})();

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


/**
 * 當事人與「連帶」措辭（支付命令、確定證明書、強制執行、債權憑證共用）
 * - 一般：債務人 + 連帶保證人
 * - 債務人已死亡：以繼承人為債務人，於繼承所得遺產範圍內連帶（繼承人對被繼承人債務負連帶責任）
 * @param {string} fallbackAddress 連帶保證人未填住居所時的替代文字
 */
function resolveParties(data, fallbackAddress = '') {
  const debtorName = data.debtorName || '○○○';
  const isDeceased = !!data.debtorDeceased;
  const guarantors = collectGuarantors(data);
  const guarantorNames = joinNames(guarantors);
  const heirs = isDeceased ? parsePartiesText(data.heirs) : [];
  const heirNames = heirs.length ? joinNames(heirs) : '○○○';

  const subject = isDeceased ? `債務人 ${heirNames} ` : (guarantors.length ? '債務人等' : '債務人');
  const scope = isDeceased
    ? `於繼承被繼承人 ${debtorName} 所得遺產範圍內${guarantors.length ? '與債務人 ' + guarantorNames + ' ' : ''}`
    : '';
  const joint = (isDeceased || guarantors.length) ? '連帶' : '';
  const sueVerb = isDeceased ? '於繼承所得遺產範圍內連帶' : joint;
  const costSubject = isDeceased ? `債務人 ${heirNames} ${scope}連帶` : (guarantors.length ? '債務人等連帶' : '債務人');

  const guarantorBlocks = renderPartyBlocks(guarantors, '債務人（即連帶保證人）', fallbackAddress);
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

  return { debtorName, isDeceased, guarantors, guarantorNames, heirs, heirNames, subject, scope, joint, sueVerb, costSubject, partySection };
}

/** 違約金：按上開利息百分之 N 計算（可另訂起算日） */
function penaltyTailHelper(ratio, startRoc) {
  if (!ratio) return '';
  return startRoc
    ? `，並自 ${startRoc} 起至清償日止，按上開利息百分之 ${ratio} 計算之違約金`
    : `，並按上開利息百分之 ${ratio} 計算之違約金`;
}

/**
 * 「請求之標的」（支付命令）／「聲請執行之事項」（強制執行）：本金及利息、違約金、前欠利息與違約金、程序費用
 * @param {string} costLabel 督促程序費用／執行程序費用
 */
function buildClaimItems(data, p, costLabel) {
  const principal = Number(data.principal) || 0;
  const manualInterest = Number(data.manualInterest) || 0;
  const manualPenalty = Number(data.manualPenalty) || 0;
  const penaltyRatio = String(data.penaltyRatio ?? '').trim();
  const penaltyStartRoc = data.penaltyStartDate ? rocDateOrBlankHelper(data.penaltyStartDate) : '';
  const interestStartDateRoc = rocDateOrBlankHelper(data.interestStartDate || data.lastPaymentDate);

  const claims = [];
  let claim1 = `一、${p.subject}應${p.scope}${p.joint}給付債權人${chineseMoneyOrBlankHelper(principal)}（小寫：${numberOrBlankHelper(principal)} 元），及自 ${interestStartDateRoc} 起至清償日止，按年息百分之 ${textOrBlankHelper(data.interestRate)} 計算之利息${penaltyTailHelper(penaltyRatio, penaltyStartRoc)}。`;
  if (manualInterest > 0) {
    claim1 += `\n   並給付前已積欠之約定利息${toChineseCurrencyHelper(manualInterest)}（小寫：${manualInterest.toLocaleString()} 元）。`;
  }
  claims.push(claim1);
  if (manualPenalty > 0) {
    claims.push(`二、${p.subject}應${p.scope}${p.joint}給付債權人前已積欠之約定違約金${toChineseCurrencyHelper(manualPenalty)}（小寫：${manualPenalty.toLocaleString()} 元）。`);
  }
  claims.push(`${manualPenalty > 0 ? '三' : '二'}、${costLabel}由${p.costSubject}負擔。`);
  return claims;
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

  const principal = Number(data.principal) || 0;
  const totalClaim = principal + (Number(data.manualInterest) || 0) + (Number(data.manualPenalty) || 0);

  const principalChinese = chineseMoneyOrBlankHelper(principal);
  const totalClaimChinese = chineseMoneyOrBlankHelper(totalClaim);
  const loanAmountChinese = chineseMoneyOrBlankHelper(Number(data.loanAmount) || principal);
  const loanAmountNum = numberOrBlankHelper(Number(data.loanAmount) || principal);

  const creditorName = data.creditorName || '○○縣○○儲蓄互助社';
  const p = resolveParties(data, '同債務人或詳如借據');
  const claims = buildClaimItems(data, p, '督促程序費用');
  const penaltyRatio = String(data.penaltyRatio ?? '').trim();
  const penaltyStartRoc = data.penaltyStartDate ? rocDateOrBlankHelper(data.penaltyStartDate) : '';
  const currentPenaltyTail = penaltyTailHelper(penaltyRatio, penaltyStartRoc);

  // 證物（編號依實際附件順序）
  const basisIsAffidavit = data.basisType === 'affidavit';
  const basisName = basisIsAffidavit ? '還款切結書' : '借據';
  const exhibits = [`${basisName}影本一份。`];
  if (data.rateChanged) exhibits.push('債權人利息、違約金變動理事會紀錄影本一份。');
  exhibits.push('500 元郵局匯票一紙。');
  if (p.isDeceased) exhibits.push('家事事件公告網路查詢資料一份。');
  const exhibitNo = (keyword) => CN_ORDINALS[exhibits.findIndex(e => e.includes(keyword))];

  // 事實及理由
  const originalDebtor = p.isDeceased ? '被繼承人' : '債務人';
  const guarantorClause = p.guarantors.length ? `，並有債務人 ${p.guarantorNames} 為連帶保證人，依法應負連帶清償責任` : '';
  const loanClause = basisIsAffidavit
    ? `與債權人簽立切結書，願分期按月償還${loanAmountChinese}（切結金額：${loanAmountNum} 元）`
    : `向債權人借款${loanAmountChinese}（借款金額：${loanAmountNum} 元），雙方約定分期按月攤還本息`;

  const reasons = [];
  reasons.push(`緣${originalDebtor} ${p.debtorName} 於 ${loanDateRoc} ${loanClause}${guarantorClause}，此有${basisName}乙紙可憑（見證物一）。`);
  if (data.rateChanged) {
    const origTail = penaltyTailHelper(String(data.origPenaltyRatio ?? '').trim(), '');
    reasons.push(`債權人原借據約定借款利率為按年息百分之 ${textOrBlankHelper(data.origRate)} 計算之利息${origTail}，惟債權人理事會於 ${rocDateOrBlankHelper(data.rateChangeDate)} 決議調整借款利率為按年息百分之 ${textOrBlankHelper(data.interestRate)} 計算之利息${currentPenaltyTail}（見證物${exhibitNo('理事會')}）。`);
  }
  reasons.push(`詎${originalDebtor}自 ${lastPaymentDateRoc} 起即未依約繳納本息${p.isDeceased ? '。' : '，迭經債權人屢次催討，債務人均置之不理。'}迄今尚積欠本金${principalChinese}及前揭約定之利息與違約金未為清償，依約已喪失期限利益，債務視為全部到期。`);
  if (p.isDeceased) {
    reasons.push(`惟被繼承人 ${p.debtorName} 已於 ${rocDateOrBlankHelper(data.deceasedDate)} 死亡，於繼承人未為相關權利主張時（詳證物${exhibitNo('家事事件')}），其被繼承人之債權債務關係應由繼承人繼承，並依法應負連帶清償責任，未料屆期不為清償，經債權人一再催索，仍置之不理。`);
  }
  reasons.push(`依民事訴訟法第 508 條及第 511 條規定，債權人之請求以給付金錢為標的者，得聲請法院依督促程序核發支付命令。為此特狀請 鈞院依督促程序對債務人發支付命令，命其${p.sueVerb}清償如請求標的所示之金額及費用，以維權益，實感德便。`);

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

${p.partySection}

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
 * 1-2. 產生《民事聲請支付命令確定證明書狀》（民事訴訟法第 521 條第 2 項、第 399 條第 1 項及第 4 項）
 * 支付命令送達債務人、逾 20 日未異議而確定後，須先取得確定證明書，才能聲請強制執行
 */
function generatePaymentOrderFinalDoc(data) {
  const roc = getRocDateHelper();
  const principal = Number(data.principal) || 0;
  const totalClaim = principal + (Number(data.manualInterest) || 0) + (Number(data.manualPenalty) || 0);
  const creditorName = data.creditorName || '○○縣○○儲蓄互助社';
  const titleCaseNo = data.titleCaseNo || '○○ 年度 ○ 字第 ○○○○ 號';

  // 「聲請人與○○○間」：一般為債務人與連帶保證人；債務人死亡時為繼承人與連帶保證人
  const p = resolveParties(data);
  const obligors = (p.isDeceased ? p.heirs : [{ name: p.debtorName }]).concat(p.guarantors);
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
二、依民事訴訟法第 521 條第 2 項、第 399 條第 1 項及第 4 項規定，聲請 貴院付與該支付命令確定證明書。

此致
臺灣 ${textOrBlankHelper(data.courtName)} 地方法院  公鑒

證物名稱及件數：

中  華  民  國  ${roc.rocYear}  年  ${roc.month}  月  ${roc.day}  日

具狀人（即聲請人）：${creditorName}  [ 蓋社圖記 (大章) ]
法定代理人：${data.creditorRep || ''}  [ 理事長簽章 (小章) ]
`;
}

/**
 * 固定第三人（出處：附件〈強執聲請狀-郵局存款〉〈查封扣押股票狀〉）
 * 名稱、設址、統一編號取自附件；法定代理人常有異動，不內建，由使用者查詢全國商工行政入口網後填寫
 */
const FIXED_THIRD_PARTIES = {
  post: { name: '中華郵政股份有限公司', address: '臺北市大安區永康里金山南路2段55號', taxId: '3741302' },
  stock: { name: '臺灣集中保管結算所股份有限公司', address: '臺北市松山區復興北路363號11樓', taxId: '23474232' }
};

/** 解析第三人文字框：每行一個，格式「名稱｜設址｜法定代理人」（後兩欄可省略） */
function parseThirdPartiesText(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [name, address, rep] = line.split(/[|｜,，\t]/).map(x => (x || '').trim());
      return { name: name || '', address: address || '', rep: rep || '' };
    })
    .filter(tp => tp.name);
}

/** 存款銀行清單：文字框每行一家；舊欄位 bankName（單一銀行）仍相容 */
function collectBanks(targets) {
  const banks = parseThirdPartiesText(targets.bankList);
  if (!banks.length && targets.bankName) {
    banks.push({ name: targets.bankName, address: targets.bankAddress || '', rep: '' });
  }
  return banks;
}

/** 強制執行狀需列為「第三人」當事人者：雇主、存款銀行、中華郵政、集保 */
function collectThirdParties(targets) {
  const list = [];
  if (targets.salary) {
    list.push({ name: textOrBlankHelper(targets.employerName, '○○○'), address: targets.employerAddress || '', rep: targets.employerRep || '', withRep: true });
  }
  if (targets.bankDeposit) {
    collectBanks(targets).forEach(b => list.push({ name: b.name, address: b.address, withRep: false }));
  }
  if (targets.postOffice) {
    list.push({ ...FIXED_THIRD_PARTIES.post, rep: targets.postRep || '', withRep: true });
  }
  if (targets.stock) {
    list.push({ ...FIXED_THIRD_PARTIES.stock, rep: targets.stockRep || '', withRep: true });
  }
  return list;
}

function renderThirdPartyBlock(tp) {
  const lines = [`第三人：${tp.name}`];
  if (tp.taxId) lines.push(`統一編號：${tp.taxId}`);
  lines.push(`設址：${tp.address || ''}`);
  if (tp.withRep) lines.push(`法定代理人：${tp.rep || '○○○'}`);
  return lines.join('\n');
}

/** 民國年月（YYYY-MM → 115 年 11 月份）；未填以「○」待填 */
function rocYearMonthHelper(monthStr) {
  const m = /^(\d{4})-(\d{1,2})$/.exec(String(monthStr || ''));
  return m ? `${Number(m[1]) - 1911} 年 ${Number(m[2])} 月份` : '○○ 年 ○ 月份';
}

function getLivingStandardHelper(regionCode) {
  return _getMinLivingStandard ? _getMinLivingStandard(regionCode) : null;
}

/**
 * 2. 產生《民事強制執行聲請狀》（單一書狀，勾選標的後自動補上各標的對應的第三人與證物）
 * 標的措辭沿用附件：薪資（1/3、按月移轉、保留 1.2 倍最低生活費）、銀行存款、郵局存款、
 * 股票（集保）、勞保局查投保單位、動產、不動產；另保留人身保險解約金、國稅局查調
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
  const creditorName = data.creditorName || '○○縣○○儲蓄互助社';
  const titleCaseNo = data.titleCaseNo || '○○ 年度 ○ 字第 ○○○○ 號';

  const p = resolveParties(data, '詳如執行名義');
  const t = data.targets || {};
  const debtor = p.debtorName;
  const claims = buildClaimItems(data, p, '執行程序費用');

  // 第三人當事人
  const thirdParties = collectThirdParties(t);
  const thirdPartySection = thirdParties.length ? '\n\n' + thirdParties.map(renderThirdPartyBlock).join('\n') : '';

  // 證物（依所勾標的決定；編號依實際順序）
  const exhibits = [{ key: 'title', text: `${titleType.exhibit}。` }];
  if (!t.taxData && (t.salary || t.bankDeposit || t.stock || t.laborInsurance || t.movables)) {
    exhibits.push({ key: 'tax', text: '債務人國稅局所得（財產）清單影本一份。' });
  }
  if (t.salary || t.stock) exhibits.push({ key: 'public', text: '第三人公示查詢資料一份。' });
  if (t.movables) exhibits.push({ key: 'household', text: '債務人戶籍謄本一份。' });
  if (t.realEstate) exhibits.push({ key: 'land', text: '債務人所有土地（建物）登記簿謄本一份。' });
  if (t.insurance) exhibits.push({ key: 'ruling', text: '最高法院 108 年度台抗大字第 897 號民事大法庭裁定要旨一份。' });
  if (p.isDeceased) exhibits.push({ key: 'heirs', text: '家事事件公告網路查詢資料一份。' });
  const exhibitNo = (key) => CN_ORDINALS[exhibits.findIndex(e => e.key === key)];

  // 執行標的
  const items = [];
  const push = (text) => items.push(`${CN_ORDINALS[items.length]}、${text}`);

  // 銀行存款
  if (t.bankDeposit) {
    const banks = collectBanks(t);
    if (banks.length) {
      banks.forEach(b => push(`請就債務人${debtor}存放於第三人${b.name}之存款，於債權人聲請執行之債權範圍內予以扣押。`));
    } else {
      push(`請准予扣押並收取債務人於金融機構之存款債權（含銀行、郵局、信用合作社、農漁會等）；或由 鈞院囑託【中華民國銀行商業同業公會全國聯合會】查調債務人之全部開戶銀行與存款帳號並予扣押。`);
    }
  }

  // 郵局存款（函詢中華郵政）
  if (t.postOffice) {
    push(`請惠允函詢第三人${FIXED_THIRD_PARTIES.post.name}覆明債務人持有存款之受託存款郵局資料後，准向查得之郵局執行債務人持有之存款。`);
  }

  // 薪資：扣 1/3 並按月移轉，同時保留 1.2 倍最低生活費（強制執行法第 115 條之 1）
  if (t.salary) {
    const living = getLivingStandardHelper(t.livingRegion);
    const amount = living ? living.standard1_2.toLocaleString() : '○○○';
    push(`債務人現服務於第三人${textOrBlankHelper(t.employerName, '○○○')}處，每月領有薪資，請扣押債務人之薪水三分之一，並准將債務人對於第三人之債權自 ${rocYearMonthHelper(t.salaryStartMonth)} 起按月移轉於債權人，以資清償。\n   債權人同意保留債務人居住地每人每月最低生活費之 1.2 倍（即 ${amount} 元）供債務人維持生活，以便繼續工作清償債務，如果扣押後所餘的金額不足上開數額，債務人僅請求就「超過」該數額部分實施扣押。`);
  }

  // 勞保局電子閘門：查調任職投保單位（雇主不明時）
  if (t.laborInsurance) {
    push(`今債權人發覺債務人${debtor}有薪資收入，惟查調國稅局所得資料清單查無債務人現任職的公司，請准予以勞動部勞工保險局電子閘門網路資料查明債務人任職之投保單位，並即對第三人核發執行命令，如第三人未於法定期間內異議，並請即發收取命令，若查無可供執行之財產或為職業工會、農漁會等，請 鈞院逕依職權核發債權憑證，倘查得資料非在 鈞院管轄區內請提供電子閘門資料並核發債權憑證以利債權回收。`);
  }

  // 人身保險解約金（最高法院 108 年度台抗大字第 897 號裁定）
  if (t.insurance) {
    push(`請准予囑託【中華民國人壽保險商業同業公會】查調債務人為要保人之所有人身保險契約；並依最高法院 108 年度台抗大字第 897 號民事大法庭裁定意旨，扣押債務人對第三人保險公司之保險給付請求權及解約金債權（保單價值準備金），並於執行必要時命終止該保險契約，命第三人保險公司將解約金償付債權人。`);
  }

  // 股票（集保）
  if (t.stock) {
    push(`祈請 鈞院函囑第三人${FIXED_THIRD_PARTIES.stock.name}陳報債務人${debtor}應受保管之股票及有價證券名稱、數量、開戶之證券商等資料，並就該等股票及有價證券予以扣押及拍賣，以清償聲請執行之事項一所示債務人逾欠款，及事項二所示債務人應負擔之執行費用，且囑令不得對債務人為清償，僅得對債權人清償。`);
  }

  // 動產、車輛
  if (t.movables) {
    const addr = t.movablesAddress || data.debtorAddress || '○○市○○路○○號';
    const plate = t.vehiclePlate ? `，及債務人所有車牌號碼 ${t.vehiclePlate} 之車輛一輛` : '';
    push(`請查封、拍賣債務人${debtor}所有於門牌號碼 ${addr} 內之動產${plate}。`);
  }

  // 國稅局查調財產及所得
  if (t.taxData) {
    push(`請 鈞院依職權囑託【財政部各地區國稅局】查調債務人${p.guarantors.length ? '及連帶保證人' : ''}最新全年度財產總歸戶清單及各類所得資料清單，以供查報財產並予執行。`);
  }

  // 不動產
  if (t.realEstate) {
    const lines = String(t.realEstateList || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const estate = lines.length ? lines : ['土地：○○縣市○○段○○小段○○地號，權利範圍：○○。', '建物：○○縣市○○段○○小段○○建號，權利範圍：○○。'];
    push(`請求拍賣債務人${debtor}所有之不動產（詳證物${exhibitNo('land')}）：\n${estate.map(l => '    ' + l).join('\n')}\n   若於現場發現其他未保存登記之增建物、搭建物等，亦應一併查封。`);
  }

  if (items.length === 0) {
    push('請准予囑託中華民國銀行商業同業公會全國聯合會查調債務人存款帳戶並予扣押。');
    push('請准予囑託國稅局查調債務人之財產與所得清單。');
  }

  const docText = `民事強制執行聲請狀
執行標的金額：${totalClaimChinese}（小寫：新臺幣 ${numberOrBlankHelper(totalClaim)} 元）
執行規費：${executionFeeText}

債權人：${creditorName}
統一編號：${data.creditorTaxId || ''}
法定代理人：${data.creditorRep || ''}
設址：${data.creditorAddress || ''}
電話：${data.creditorPhone || ''}
送達代收人：${data.agentName || data.creditorRep || ''}
送達處所：${data.creditorAddress || ''}

${p.partySection}${thirdPartySection}

為聲請強制執行事：

聲請執行之事項：
${claims.join('\n')}

執行名義：
臺灣 ${textOrBlankHelper(data.titleCourt || data.courtName)} 地方法院 ${titleCaseNo} ${titleType.label}。

實施強制執行之標的及方法：
${items.join('\n')}

事實及理由：
一、債權人與債務人間清償借款強制執行事件，前經 鈞院核發 ${titleCaseNo} 確定之執行名義在案，債務人依法應給付債權人如執行名義所載之本金、利息、違約金及程序費用。
二、詎該執行名義確定後，債務人迄未履行清償義務，迄今尚欠本金${principalChinese}及約定利息、違約金。為此依強制執行法第 4 條、第 6 條、第 115 條等規定，檢附前開執行名義正本，狀請 鈞院民事執行處依法實施強制執行，以維債權，實感德便。

證物名稱及件數：
${exhibits.map((e, i) => `${CN_ORDINALS[i]}、${e.text}`).join('\n')}

謹  狀
臺灣 ${textOrBlankHelper(data.courtName)} 地方法院 民事執行處  公鑒

中  華  民  國  ${roc.rocYear}  年  ${roc.month}  月  ${roc.day}  日

具狀人：${creditorName}  [ 蓋社圖記 (大章) ]
法定代理人：${data.creditorRep || ''}  [ 理事長簽章 (小章) ]
`;

  return docText;
}

/**
 * 3. 產生《民事聲請核發／換發債權憑證狀》
 * 執行名義為債權憑證 → 換發；為支付命令或判決 → 首次核發。
 * 聲請原因可選：查無財產（預設）、債務人已離職；另支援債務人死亡（繼承人於遺產範圍內連帶）。
 */
function generateRenewCertificateDoc(data) {
  const roc = getRocDateHelper();
  const principal = Number(data.principal) || 0;
  const principalChinese = chineseMoneyOrBlankHelper(principal);

  const titleType = resolveTitleType(data.titleType);
  const action = titleType.isCert ? '換發' : '核發';
  const caseNoText = `${textOrBlankHelper(data.caseYear)} 年度 ${textOrBlankHelper(data.caseWord)} 字第 ${textOrBlankHelper(data.caseNo, '○○○○')} 號`;
  const titleCaseNo = data.titleCaseNo || '○○ 年度 ○ 字第 ○○○○ 號';
  const p = resolveParties(data, '詳如執行名義');

  const exhibits = [`${titleType.exhibit}。`];
  if (p.isDeceased) exhibits.push('家事事件公告網路查詢資料一份。');

  const noPropertyText = data.renewReason === 'resigned'
    ? `其原任職於第三人${textOrBlankHelper(data.resignedEmployer, '○○○')}，業已離職，又目前查無其他可供強制執行之財產`
    : '又目前查無可供強制執行之財產';

  const reasons = [];
  reasons.push(`債權人與債務人間之債權債務關係，業經 鈞院核發 ${titleCaseNo} ${titleType.label}在案，並經 鈞院以 ${caseNoText} 受理強制執行在案。`);
  if (p.isDeceased) {
    reasons.push(`惟原債務人 ${p.debtorName} 已於 ${rocDateOrBlankHelper(data.deceasedDate)} 死亡，於其繼承人未為相關權利主張時（詳證物二），其被繼承人之債權債務關係應由繼承人繼承，並依法應負連帶清償責任。`);
  }
  reasons.push(`茲因債務人迄未履行，${noPropertyText}，為保全聲請人未受償之債權（本金${principalChinese}及其利息、違約金），爰檢同執行名義，依強制執行法第 27 條規定，特狀請 鈞院准予${action}債權憑證，以維權益，實感德便。`);

  const docText = `民事聲請${action}債權憑證狀
案號：${caseNoText}
股別：${textOrBlankHelper(data.caseSection, '○')} 股

聲請人（即債權人）：${data.creditorName || '○○縣○○儲蓄互助社'}
統一編號：${data.creditorTaxId || ''}
法定代理人：${data.creditorRep || ''}
設址：${data.creditorAddress || ''}
電話：${data.creditorPhone || ''}

${p.partySection}

為聲請${action}債權憑證事：

聲請意旨：
${reasons.map((t, i) => `${CN_ORDINALS[i]}、${t}`).join('\n')}

證物名稱及件數：
${exhibits.map((e, i) => `${CN_ORDINALS[i]}、${e}`).join('\n')}

謹  狀
臺灣 ${textOrBlankHelper(data.courtName)} 地方法院 民事執行處  公鑒

中  華  民  國  ${roc.rocYear}  年  ${roc.month}  月  ${roc.day}  日

具狀人（即聲請人）：${data.creditorName || '○○縣○○儲蓄互助社'}  [ 蓋社圖記 (大章) ]
法定代理人：${data.creditorRep || ''}  [ 理事長簽章 (小章) ]
`;

  return docText;
}

/**
 * 4. 郵局存證信函（清償債務催告）— 內容沿用附件〈存證信函（清償債務）〉原文
 * 寄件人／收件人／副本收件人依郵局存證信函用紙欄位；「內容：」以下為每格一字之正文
 */
function postalLetterHeader(data, title) {
  const guarantors = collectGuarantors(data);
  const copyBlock = guarantors.length
    ? '\n三、副本收件人\n' + guarantors.map(g => `姓名：${g.name}\n詳細地址：${g.address || ''}`).join('\n') + '\n'
    : '';
  return `${title}

一、寄件人
姓名：${data.creditorName || '○○縣○○儲蓄互助社'}　法定代理人：${data.creditorRep || '○○○'}  [ 蓋社圖記 (大章) ]
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
 * 5. 郵局存證信函（股金扣除貸款）— 內容沿用附件〈存證信函（股金扣除貸款）〉原文
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
    parseThirdPartiesText,
    collectGuarantors,
    collectThirdParties,
    generateExecutionDoc,
    generateRenewCertificateDoc,
  };
}
