/**
 * 主控制器邏輯 (app.js) - 全面升級版 (專職減負 Wizard、情境導航、白話小抄與 A4 擬真)
 * 整合：4 大情境入口、三步驟摺疊導引、司法院訴狀、股金抵銷、身故繼承、扣薪計算機、時效 KPI 看板、Word 匯出與草稿自動暫存
 */

// 儲存原始純文字供複製與下載
let currentRawDocText = '';

document.addEventListener('DOMContentLoaded', () => {
  applyUiConfig();
  initScenarioNav();
  initTabs();
  initCourtSelect();
  initProfileSettings();
  initScriptsGenerator();
  initDocGenerator();
  initSalaryCalculator();
  initLedger();
  initDemoDataButton();
  restoreDrafts();

  // 管轄法院比對原本只綁在 input 事件上，頁面預填或草稿還原的地址不會觸發，
  // 導致首次載入時法院停在清單第一項而與地址不符。此處補跑一次。
  // 必須排在 restoreDrafts() 之後，才能一併涵蓋草稿還原的地址。
  handleAddressAutoCourt('docDebtorAddress');
  updateDocPreview();
});

/**
 * HTML 逸出：所有寫入 innerHTML 的使用者資料都必須先過這一層
 * 資料來源包含 localStorage 與 importRecordsFromJSON 匯入的外部備份檔，
 * 未逸出即構成儲存型 XSS
 */
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Toast 提示
function showToast(msg) {
  const toast = document.getElementById('toastBox');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2400);
}

// 顯示草稿自動儲存指示
function triggerDraftSavedIndicator() {
  const ind = document.getElementById('draftSaveIndicator');
  if (!ind) return;
  ind.style.display = 'inline-flex';
  setTimeout(() => {
    ind.style.display = 'none';
  }, 2000);
}

// 按鈕微交互：短暫變綠反饋
function triggerButtonFeedback(btn, feedbackText = '✓ 已複製！') {
  if (!btn) return;
  const originalText = btn.innerHTML;
  btn.innerHTML = feedbackText;
  btn.classList.add('btn-feedback-success');
  setTimeout(() => {
    btn.innerHTML = originalText;
    btn.classList.remove('btn-feedback-success');
  }, 1800);
}

// 複製純文字至剪貼簿
function copyTextToClipboard(text, successMsg = '已複製至剪貼簿！', btn = null) {
  if (btn) triggerButtonFeedback(btn);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(successMsg);
    }).catch(() => {
      fallbackCopyText(text, successMsg);
    });
  } else {
    fallbackCopyText(text, successMsg);
  }
}

function fallbackCopyText(text, successMsg) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
    showToast(successMsg);
  } catch (err) {
    showToast('複製失敗，請手動選取文字複製');
  }
  document.body.removeChild(textarea);
}

/* ==========================================================================
   0. 介面功能開關套用 (依 js/config.js 決定顯示哪些分頁與公文)
   ========================================================================== */
/**
 * 依 APP_CONFIG 隱藏未啟用的分頁、公文種類與情境卡片
 * 一律「隱藏」而非「移除」DOM 節點，讓各 init 函式對隱藏區塊內元素的存取仍然有效，
 * 也讓設定改回完整清單後不需要動任何其他程式碼
 */
function applyUiConfig() {
  // 1. 分頁按鈕與內容區
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.hidden = !isTabEnabled(btn.getAttribute('data-tab'));
  });
  document.querySelectorAll('.tab-content').forEach(section => {
    if (!isTabEnabled(section.id)) {
      section.hidden = true;
      section.classList.remove('active');
    }
  });

  // 2. 公文種類下拉：移除未啟用選項，再清掉因此變空的分組標題
  const docSelect = document.getElementById('docType');
  if (docSelect) {
    docSelect.querySelectorAll('option').forEach(opt => {
      if (!isDocTypeEnabled(opt.value)) opt.remove();
    });
    docSelect.querySelectorAll('optgroup').forEach(group => {
      if (group.querySelectorAll('option').length === 0) group.remove();
    });
    if (!isDocTypeEnabled(docSelect.value)) {
      docSelect.value = getDefaultDocType();
    }
  }

  // 3. 頂部情境導航卡片
  const scenarioNav = document.querySelector('.scenario-nav-grid');
  if (scenarioNav && !APP_CONFIG.SHOW_SCENARIO_NAV) {
    scenarioNav.hidden = true;
  }

  // 4. 確保目前展開的分頁是啟用中的分頁
  const activeTab = document.querySelector('.tab-content.active');
  if (!activeTab || !isTabEnabled(activeTab.id)) {
    switchTab(getDefaultTab());
  }
}

/* ==========================================================================
   0-1. 頂部 4 大情境導航大卡片 (Scenario Navigation)
   ========================================================================== */
function initScenarioNav() {
  const scenarioCards = document.querySelectorAll('.scenario-card');
  scenarioCards.forEach(card => {
    card.addEventListener('click', () => {
      const targetTab = card.getAttribute('data-scenario');
      if (targetTab) {
        switchTab(targetTab);
        // 若為公文生成，預設展開第一步
        if (targetTab === 'tab-docs') {
          openNextStep('stepCard1');
        }
      }
    });
  });
}

/* ==========================================================================
   1. 分頁切換 (Tabs)
   ========================================================================== */
function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');
      switchTab(targetId);
    });
  });
}

function switchTab(tabId) {
  // 未啟用的分頁不得被叫出來（見 js/config.js）
  if (!isTabEnabled(tabId)) return;

  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  tabContents.forEach(content => {
    if (content.id === tabId) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });

  if (tabId === 'tab-statute') {
    renderLedgerKpis();
    renderLedgerTable();
  }
}

/* ==========================================================================
   2. 三步驟摺疊導引 (Accordion Step Wizard for Tab 1)
   ========================================================================== */
function toggleAccordion(cardId) {
  const card = document.getElementById(cardId);
  if (!card) return;
  card.classList.toggle('active');
}

function openNextStep(nextCardId) {
  const allSteps = ['stepCard1', 'stepCard2', 'stepCard3'];
  allSteps.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });
  const nextCard = document.getElementById(nextCardId);
  if (nextCard) {
    nextCard.classList.add('active');
    nextCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

/* ==========================================================================
   3. 法院下拉選單初始化
   ========================================================================== */
function initCourtSelect() {
  const courtSelect = document.getElementById('docCourt');
  if (!courtSelect || typeof TAIWAN_COURTS === 'undefined') return;

  courtSelect.innerHTML = '';
  // 第一項留空：地址尚未輸入或比對不到時，書狀上顯示「○○」待填，
  // 而不是默默印成清單第一個法院（臺北）
  const placeholderOpt = document.createElement('option');
  placeholderOpt.value = '';
  placeholderOpt.textContent = '（請輸入地址自動帶入，或手動選擇）';
  courtSelect.appendChild(placeholderOpt);
  TAIWAN_COURTS.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.textContent = `${c.fullName}（${c.name}）`;
    courtSelect.appendChild(opt);
  });
}

/* ==========================================================================
   4. 本社資料設定 (記住本社)
   ========================================================================== */
function initProfileSettings() {
  const profile = loadCuProfile();
  fillProfileToForm(profile);

  const saveProfileBtn = document.getElementById('saveProfileBtn');
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', () => {
      const updatedProfile = {
        cuName: document.getElementById('profileCuName').value.trim(),
        cuTaxId: document.getElementById('profileCuTaxId').value.trim(),
        cuRep: document.getElementById('profileCuRep').value.trim(),
        cuAddress: document.getElementById('profileCuAddress').value.trim(),
        cuPhone: document.getElementById('profileCuPhone').value.trim(),
        agentName: document.getElementById('profileAgentName').value.trim(),
        cuBylawArticle: document.getElementById('profileBylawArticle')?.value.trim() || ''
      };
      if (!saveCuProfile(updatedProfile)) {
        showToast('⚠️ 儲存失敗：瀏覽器儲存空間不足或已停用，請檢查隱私設定');
        return;
      }
      showToast('✅ 已成功儲存本社預設資料！');
      updateDocFormFromProfile();
      updateScriptFormFromProfile();
    });
  }
}

function fillProfileToForm(profile) {
  if (!profile) return;
  if (document.getElementById('profileCuName')) document.getElementById('profileCuName').value = profile.cuName || '';
  if (document.getElementById('profileCuTaxId')) document.getElementById('profileCuTaxId').value = profile.cuTaxId || '';
  if (document.getElementById('profileCuRep')) document.getElementById('profileCuRep').value = profile.cuRep || '';
  if (document.getElementById('profileCuAddress')) document.getElementById('profileCuAddress').value = profile.cuAddress || '';
  if (document.getElementById('profileCuPhone')) document.getElementById('profileCuPhone').value = profile.cuPhone || '';
  if (document.getElementById('profileAgentName')) document.getElementById('profileAgentName').value = profile.agentName || '';
  if (document.getElementById('profileBylawArticle')) document.getElementById('profileBylawArticle').value = profile.cuBylawArticle || '';
}

function updateDocFormFromProfile() {
  const profile = loadCuProfile();
  if (document.getElementById('docCreditorName')) document.getElementById('docCreditorName').value = profile.cuName || '';
  if (document.getElementById('docCreditorTaxId')) document.getElementById('docCreditorTaxId').value = profile.cuTaxId || '';
  if (document.getElementById('docCreditorRep')) document.getElementById('docCreditorRep').value = profile.cuRep || '';
  if (document.getElementById('docCreditorAddress')) document.getElementById('docCreditorAddress').value = profile.cuAddress || '';
  if (document.getElementById('docCreditorPhone')) document.getElementById('docCreditorPhone').value = profile.cuPhone || '';
  if (document.getElementById('docAgentName')) document.getElementById('docAgentName').value = profile.agentName || '';
  updateDocPreview();
}

function updateScriptFormFromProfile() {
  const profile = loadCuProfile();
  if (document.getElementById('scriptCuName')) document.getElementById('scriptCuName').value = profile.cuName || '';
  if (document.getElementById('scriptCuPhone')) document.getElementById('scriptCuPhone').value = profile.cuPhone || '';
  updateScriptsPreview();
}

/* ==========================================================================
   5. 早期關懷話術生成器
   ========================================================================== */
function initScriptsGenerator() {
  const inputs = ['scriptDebtorName', 'scriptGender', 'scriptOverdueMonths', 'scriptOverdueAmount', 'scriptCuName', 'scriptCuPhone'];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        updateScriptsPreview();
        saveScriptsDraft();
      });
      el.addEventListener('change', () => {
        updateScriptsPreview();
        saveScriptsDraft();
      });
    }
  });

  document.querySelectorAll('.btn-copy-script').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const textEl = document.getElementById(targetId);
      if (textEl) {
        copyTextToClipboard(textEl.textContent.trim(), '已複製話術文字！', btn);
      }
    });
  });

  updateScriptFormFromProfile();
}

function saveScriptsDraft() {
  const data = {
    debtorName: document.getElementById('scriptDebtorName')?.value,
    gender: document.getElementById('scriptGender')?.value,
    overdueMonths: document.getElementById('scriptOverdueMonths')?.value,
    overdueAmount: document.getElementById('scriptOverdueAmount')?.value
  };
  saveDraft(STORAGE_KEYS.DRAFT_SCRIPT, data);
}

function updateScriptsPreview() {
  const data = {
    debtorName: document.getElementById('scriptDebtorName')?.value.trim() || '王小明',
    gender: document.getElementById('scriptGender')?.value || 'male',
    overdueMonths: document.getElementById('scriptOverdueMonths')?.value || 1,
    overdueAmount: document.getElementById('scriptOverdueAmount')?.value || 15000,
    cuName: document.getElementById('scriptCuName')?.value.trim() || '臺中第一儲蓄互助社',
    cuPhone: document.getElementById('scriptCuPhone')?.value.trim() || '04-22223333'
  };

  const phoneScripts = generatePhoneScripts(data);
  const lineMsgs = generateLineMessages(data);

  if (document.getElementById('scriptEmpathyText')) document.getElementById('scriptEmpathyText').textContent = phoneScripts.empathy.script;
  if (document.getElementById('scriptNegotiationText')) document.getElementById('scriptNegotiationText').textContent = phoneScripts.negotiation.script;
  if (document.getElementById('scriptFormalText')) document.getElementById('scriptFormalText').textContent = phoneScripts.formal.script;

  if (document.getElementById('scriptLineGentleText')) document.getElementById('scriptLineGentleText').textContent = lineMsgs.gentle.text;
  if (document.getElementById('scriptLineFormalText')) document.getElementById('scriptLineFormalText').textContent = lineMsgs.formal.text;
  if (document.getElementById('scriptLineWarningText')) document.getElementById('scriptLineWarningText').textContent = lineMsgs.finalWarning.text;
}

/* ==========================================================================
   6. 司法院標準法催與抵銷公文生成器 (含實體印鑑盒導引)
   ========================================================================== */
function initDocGenerator() {
  const formInputs = [
    'docType', 'docCreditorName', 'docCreditorTaxId', 'docCreditorRep', 'docCreditorAddress', 'docCreditorPhone', 'docAgentName', 'docAgentId',
    'docDebtorName', 'docDebtorId', 'docDebtorAddress', 'docDebtorMemberNo',
    'docHasGuarantor', 'docGuarantorName', 'docGuarantorId', 'docGuarantorAddress', 'docExtraParties',
    'docDebtorDeceased', 'docHeirs', 'docBasisType', 'docPenaltyRatio', 'docPenaltyStartDate',
    'docRateChanged', 'docOrigRate', 'docOrigPenaltyRatio', 'docRateChangeDate', 'docOrderIssueDate', 'docNoticeDate',
    'docLoanDate', 'docLoanAmount', 'docPrincipal', 'docInterestRate', 'docLastPaymentDate', 'docInterestStartDate',
    'docManualInterest', 'docManualPenalty', 'docCourt',
    'docShareAmount', 'docDividendAmount', 'docDocNo',
    'docDeceasedDate', 'docHouseholdOffice',
    'targetBankDeposit', 'targetBankList', 'targetPostOffice', 'targetPostRep', 'targetSalary', 'targetEmployerName',
    'targetEmployerAddress', 'targetEmployerRep', 'targetSalaryStartMonth', 'docLivingRegion', 'targetLaborInsurance',
    'targetInsurance', 'targetStock', 'targetStockRep', 'targetMovables', 'targetMovablesAddress', 'targetVehiclePlate',
    'targetTaxData', 'targetRealEstate', 'targetRealEstateList', 'docRenewReason', 'docResignedEmployer',
    'docTitleType', 'docTitleCaseNo', 'docTitleCourt', 'docCaseYear', 'docCaseWord', 'docCaseNo', 'docCaseSection'
  ];

  formInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        handleAddressAutoCourt(id);
        validateInterestRateInput();
        updateDocPreview();
        saveDocDraft();
      });
      el.addEventListener('change', () => {
        handleAddressAutoCourt(id);
        validateInterestRateInput();
        updateDocTypeVisibility();
        updateDocPreview();
        saveDocDraft();
      });
    }
  });

  const guarantorToggle = document.getElementById('docHasGuarantor');
  if (guarantorToggle) {
    guarantorToggle.addEventListener('change', () => {
      const wrap = document.getElementById('guarantorFieldsWrap');
      if (wrap) wrap.style.display = guarantorToggle.checked ? 'block' : 'none';
      updateDocPreview();
      saveDocDraft();
    });
  }

  // 輔助試算按鈕
  const calcInterestBtn = document.getElementById('btnEstimateInterest');
  if (calcInterestBtn) {
    calcInterestBtn.addEventListener('click', () => {
      const p = Number(document.getElementById('docPrincipal')?.value) || 0;
      const r = Number(document.getElementById('docInterestRate')?.value) || 0;
      const start = document.getElementById('docInterestStartDate')?.value || document.getElementById('docLastPaymentDate')?.value;
      const end = todayLocalDateStr();
      if (p > 0 && r > 0 && start) {
        const est = calculateEstimatedInterest(p, r, start, end);
        document.getElementById('docManualInterest').value = est.interest;
        showToast(`💡 已為您試算 ${est.days} 天之約定利息：${est.interest.toLocaleString()} 元`);
        updateDocPreview();
        saveDocDraft();
      } else {
        alert('請先填寫未償本金、約定年利率與利息起算日');
      }
    });
  }

  // 複製公文 (複製原始純文字)
  const copyDocBtn = document.getElementById('btnCopyDoc');
  if (copyDocBtn) {
    copyDocBtn.addEventListener('click', () => {
      const text = currentRawDocText || document.getElementById('docPreviewText')?.textContent || '';
      copyTextToClipboard(text, '✅ 已複製整份公文書狀全文！', copyDocBtn);
    });
  }

  // 匯出 Word
  const downloadWordBtn = document.getElementById('btnDownloadWord');
  if (downloadWordBtn) {
    downloadWordBtn.addEventListener('click', () => {
      const text = currentRawDocText || document.getElementById('docPreviewText')?.textContent || '';
      const docType = document.getElementById('docType')?.value || 'doc';
      const debtor = document.getElementById('docDebtorName')?.value || '債務人';
      exportToWordDoc(`${debtor}_${docType}_公文書狀`, `${debtor} 法催公文`, text);
      showToast('📝 已匯出標準 Word (.doc) 檔案！');
    });
  }

  // 列印公文
  const printDocBtn = document.getElementById('btnPrintDoc');
  if (printDocBtn) {
    printDocBtn.addEventListener('click', () => {
      window.print();
    });
  }

  // 下載純文字
  const downloadTxtBtn = document.getElementById('btnDownloadTxt');
  if (downloadTxtBtn) {
    downloadTxtBtn.addEventListener('click', () => {
      const text = currentRawDocText || document.getElementById('docPreviewText')?.textContent || '';
      const docType = document.getElementById('docType')?.value || 'doc';
      const debtor = document.getElementById('docDebtorName')?.value || '債務人';
      downloadFile(`${debtor}_${docType}_書狀.txt`, text, 'text/plain;charset=utf-8');
    });
  }

  // 下載存證信函催告後 6 個月起訴期限鬧鐘
  const noticeIcsBtn = document.getElementById('btnNoticeICS');
  if (noticeIcsBtn) {
    noticeIcsBtn.addEventListener('click', () => {
      const data = getDocFormData();
      const info = data.noticeDate ? calculate6MonthNoticeExpiry(data.noticeDate) : null;
      if (!info) return;
      const ics = generateNoticeDeadlineICS({
        debtorName: data.debtorName,
        noticeDateStr: data.noticeDate,
        expiryDateStr: info.expiryDateStr
      });
      downloadFile(`${data.debtorName || '債務人'}_催告6個月起訴期限.ics`, ics, 'text/calendar;charset=utf-8');
      showToast('📅 已下載 6 個月起訴期限行事曆鬧鐘！');
    });
  }

  // 存入 5 年時效台帳
  // 台帳的 5 年時效是自「債權憑證核發日」起算，書狀表單裡並沒有這個日期
  // （舊版曾直接拿「最後繳息日」代入，算出來的到期日是錯的），
  // 因此改為帶入已知欄位後開啟編輯視窗，由使用者填入憑證核發日再存檔。
  const saveToLedgerBtn = document.getElementById('btnSaveDocToLedger');
  if (saveToLedgerBtn) {
    saveToLedgerBtn.addEventListener('click', () => {
      const debtorName = document.getElementById('docDebtorName')?.value.trim();
      if (!debtorName) {
        alert('請先填寫借款人/債務人姓名');
        return;
      }
      switchTab('tab-statute');
      openRecordModal({
        id: '',
        debtorName: debtorName,
        debtorId: document.getElementById('docDebtorId')?.value.trim() || '',
        principal: Number(document.getElementById('docPrincipal')?.value) || 0,
        courtName: document.getElementById('docCourt')?.value || '臺中',
        certNo: document.getElementById('docTitleCaseNo')?.value.trim() || document.getElementById('docCaseNo')?.value.trim() || '',
        issueDate: '',
        guarantorName: document.getElementById('docGuarantorName')?.value.trim() || '',
        note: `自公文助手建立 (${document.getElementById('docType')?.value})`
      });
      showToast('請填入「憑證核發日期」後儲存，5 年時效由該日起算');
    });
  }

  updateDocFormFromProfile();
  updateDocTypeVisibility();
}

function validateInterestRateInput() {
  const rateInput = document.getElementById('docInterestRate');
  const alertBox = document.getElementById('rateAlertBox');
  const badge = document.getElementById('rateWarningBadge');
  if (!rateInput) return;

  const val = Number(rateInput.value) || 0;
  const res = validateInterestRate(val);

  if (!res.isValid) {
    if (alertBox) {
      alertBox.textContent = res.warning;
      alertBox.style.display = 'block';
    }
    if (badge) badge.style.display = 'inline-block';
  } else {
    if (alertBox) alertBox.style.display = 'none';
    if (badge) badge.style.display = 'none';
  }
}

function saveDocDraft() {
  const data = getDocFormData();
  saveDraft(STORAGE_KEYS.DRAFT_DOC, data);
  triggerDraftSavedIndicator();
}

function handleAddressAutoCourt(inputId) {
  if (inputId === 'docDebtorAddress') {
    const addr = document.getElementById('docDebtorAddress')?.value || '';
    if (addr.length >= 3 && typeof findCourtByAddress === 'function') {
      const matched = findCourtByAddress(addr);
      if (matched && document.getElementById('docCourt')) {
        document.getElementById('docCourt').value = matched.name;
      }
    }
  }
}

function updateDocTypeVisibility() {
  const type = document.getElementById('docType')?.value || 'payment_order';
  const checked = (id) => document.getElementById(id)?.checked || false;
  const show = (id, visible, display = 'block') => {
    const el = document.getElementById(id);
    if (el) el.style.display = visible ? display : 'none';
  };

  const isPayment = type === 'payment_order';
  const isFinal = type === 'payment_order_final';
  const isExec = type === 'execution';
  const isRenew = type === 'renew_cert';
  const isLetter = type === 'demand_letter' || type === 'offset_letter';
  const isInheritanceDoc = type === 'household_apply' || type === 'inheritance_inquiry' || type === 'inheritance_demand';
  const deceasedApplies = isPayment || isFinal || isExec || isRenew;
  const deceased = deceasedApplies && checked('docDebtorDeceased');

  show('executionSpecificFields', isExec);
  show('renewCertSpecificFields', isRenew);
  show('titleTypeWrap', isExec || isRenew);
  show('titleCaseNoWrap', isExec || isFinal || isRenew);
  show('orderIssueWrap', isFinal);
  show('offsetSpecificFields', type === 'offset_share' || type === 'offset_board');
  show('letterSpecificFields', isLetter);

  // 支付命令專屬（債權憑據、違約金比例、利率變動）
  show('paymentOnlyFields', isPayment);
  show('rateChangeWrap', isPayment && checked('docRateChanged'));

  // 債務人死亡：支付命令與確定證明書列繼承人；死亡日期僅支付命令需要
  show('deceasedToggleGroup', deceasedApplies);
  show('heirsFieldsWrap', deceased);
  show('deceasedSpecificFields', isInheritanceDoc || ((isPayment || isRenew) && deceased));

  // 強制執行：勾選標的後才顯示該標的所需的第三人與細部欄位
  show('targetSalaryFields', isExec && checked('targetSalary'));
  show('targetBankFields', isExec && checked('targetBankDeposit'));
  show('targetPostFields', isExec && checked('targetPostOffice'));
  show('targetStockFields', isExec && checked('targetStock'));
  show('targetMovablesFields', isExec && checked('targetMovables'));
  show('targetRealEstateFields', isExec && checked('targetRealEstate'));

  // 債權憑證：債務人已離職時才需填原任職單位
  show('resignedEmployerGroup', isRenew && document.getElementById('docRenewReason')?.value === 'resigned');
  show('docHouseholdOfficeGroup', isInheritanceDoc);
  show('docAgentIdGroup', isInheritanceDoc);

  // 存證信函、股金抵銷公文不送法院，不需管轄法院
  const noCourt = ['offset_share', 'offset_board', 'household_apply', 'demand_letter', 'offset_letter'].includes(type);
  show('courtSelectGroup', !noCourt, 'flex');
  show('guarantorCheckboxGroup', !(type === 'household_apply' || type === 'inheritance_inquiry'));

  // 僅支付命令沿用「已就緒」提示，其餘公文各有專屬欄位區
  show('generalDocHint', isPayment);
}

/**
 * 讀取表單。空白欄位一律回傳空字串，由 templates.js 以「○」標示待填。
 * 這裡絕不可再以看似真實的預設值（假姓名、假身分證、假案號、假日期）補空，
 * 否則漏填的欄位會悄悄印進要送法院的書狀裡。
 */
function getDocFormData() {
  const text = (id) => document.getElementById(id)?.value.trim() || '';
  const raw = (id) => document.getElementById(id)?.value || '';

  const courtName = raw('docCourt');
  const deceasedDateVal = raw('docDeceasedDate');
  const lastPaymentDate = raw('docLastPaymentDate');

  // 債權人（本社）資料來自「本社資料設定」。
  // 書狀表單上並沒有 docCreditor* 這些輸入框；舊版因為讀不到表單就套用寫死的
  // 「臺中市第一儲蓄互助社」，導致使用者儲存的本社設定從未進入書狀。
  const profile = loadCuProfile() || {};

  return {
    docType: raw('docType') || 'payment_order',
    creditorName: (profile.cuName || '').trim(),
    creditorTaxId: (profile.cuTaxId || '').trim(),
    creditorRep: (profile.cuRep || '').trim(),
    creditorAddress: (profile.cuAddress || '').trim(),
    creditorPhone: (profile.cuPhone || '').trim(),
    agentName: (profile.agentName || '').trim(),
    agentId: text('docAgentId'),
    bylawArticle: (profile.cuBylawArticle || '').trim(),

    debtorName: text('docDebtorName'),
    debtorId: text('docDebtorId'),
    debtorAddress: text('docDebtorAddress'),
    debtorMemberNo: text('docDebtorMemberNo'),

    hasGuarantor: document.getElementById('docHasGuarantor')?.checked || false,
    guarantorName: text('docGuarantorName'),
    guarantorId: text('docGuarantorId'),
    guarantorAddress: text('docGuarantorAddress'),
    extraParties: raw('docExtraParties'),
    debtorDeceased: document.getElementById('docDebtorDeceased')?.checked || false,
    heirs: raw('docHeirs'),

    loanDate: raw('docLoanDate'),
    loanAmount: raw('docLoanAmount'),
    principal: raw('docPrincipal'),
    interestRate: raw('docInterestRate'),
    lastPaymentDate: lastPaymentDate,
    // 未另填利息起算日時，依表單說明「自最後繳息日次日起算」
    interestStartDate: raw('docInterestStartDate') || addDaysToDateStr(lastPaymentDate, 1),
    manualInterest: raw('docManualInterest') || 0,
    manualPenalty: raw('docManualPenalty') || 0,
    basisType: raw('docBasisType') || 'loan',
    penaltyRatio: raw('docPenaltyRatio'),
    penaltyStartDate: raw('docPenaltyStartDate'),
    rateChanged: document.getElementById('docRateChanged')?.checked || false,
    origRate: raw('docOrigRate'),
    origPenaltyRatio: raw('docOrigPenaltyRatio'),
    rateChangeDate: raw('docRateChangeDate'),
    orderIssueDate: raw('docOrderIssueDate'),
    noticeDate: raw('docNoticeDate'),
    courtName: courtName,

    shareAmount: raw('docShareAmount'),
    dividendAmount: raw('docDividendAmount'),
    docNo: text('docDocNo'),

    deceasedDate: deceasedDateVal,
    // 範本在前面已寫「民國」，這裡的值不可再帶「民國」前綴
    deceasedDateRoc: deceasedDateVal ? formatRocDate(deceasedDateVal).replace(/^民國\s*/, '') : '',
    householdOffice: text('docHouseholdOffice'),

    renewReason: raw('docRenewReason') || 'no_property',
    resignedEmployer: text('docResignedEmployer'),

    targets: {
      bankDeposit: document.getElementById('targetBankDeposit')?.checked ?? true,
      bankList: raw('targetBankList'),
      postOffice: document.getElementById('targetPostOffice')?.checked ?? false,
      postRep: text('targetPostRep'),
      insurance: document.getElementById('targetInsurance')?.checked ?? true,
      salary: document.getElementById('targetSalary')?.checked ?? true,
      employerName: text('targetEmployerName'),
      employerAddress: text('targetEmployerAddress'),
      employerRep: text('targetEmployerRep'),
      salaryStartMonth: raw('targetSalaryStartMonth'),
      // 保留 1.2 倍最低生活費所依據的區域：未手動指定時，依債務人地址判斷
      livingRegion: raw('docLivingRegion') || deriveLivingRegionFromAddress(text('docDebtorAddress')),
      laborInsurance: document.getElementById('targetLaborInsurance')?.checked ?? false,
      stock: document.getElementById('targetStock')?.checked ?? false,
      stockRep: text('targetStockRep'),
      movables: document.getElementById('targetMovables')?.checked ?? false,
      movablesAddress: text('targetMovablesAddress'),
      vehiclePlate: text('targetVehiclePlate'),
      taxData: document.getElementById('targetTaxData')?.checked ?? true,
      realEstate: document.getElementById('targetRealEstate')?.checked ?? false,
      realEstateList: raw('targetRealEstateList')
    },

    titleType: raw('docTitleType') || 'payment_order',
    titleCourt: text('docTitleCourt') || courtName,
    titleCaseNo: text('docTitleCaseNo'),
    caseYear: text('docCaseYear'),
    caseWord: text('docCaseWord'),
    caseNo: text('docCaseNo'),
    caseSection: text('docCaseSection')
  };
}

function updateDocPreview() {
  const data = getDocFormData();
  let text = '';

  switch (data.docType) {
    case 'payment_order':
      text = generatePaymentOrderDoc(data);
      break;
    case 'payment_order_final':
      text = generatePaymentOrderFinalDoc(data);
      break;
    case 'demand_letter':
      text = generateDemandLetterDoc(data);
      break;
    case 'offset_letter':
      text = generateOffsetLetterDoc(data);
      break;
    case 'execution':
      text = generateExecutionDoc(data);
      break;
    case 'renew_cert':
      text = generateRenewCertificateDoc(data);
      break;
    case 'offset_share':
      text = generateOffsetShareDoc(data);
      break;
    case 'offset_board':
      text = generateOffsetBoardResolutionDoc(data);
      break;
    case 'household_apply':
      text = generateHouseholdApplyDoc(data);
      break;
    case 'inheritance_inquiry':
      text = generateInheritanceInquiryDoc(data);
      break;
    case 'inheritance_demand':
      text = generateInheritanceDemandDoc(data);
      break;
    default:
      text = generatePaymentOrderDoc(data);
  }

  currentRawDocText = text;
  updateLetterAids(data, text);

  const previewEl = document.getElementById('docPreviewText');
  if (previewEl) {
    let escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    escaped = escaped
      .replace(/\[\s*蓋社圖記\s*\(大章\)\s*\]/g, '<span class="stamp-guide-tag">㊞ 蓋社圖記 (大章)</span>')
      .replace(/\[\s*理事長簽章\s*\(小章\)\s*\]/g, '<span class="stamp-guide-tag">㊞ 理事長簽章 (小章)</span>')
      .replace(/\[\s*理事長：.*?\[蓋章\]/g, '<span class="stamp-guide-tag">㊞ 理事長蓋章</span>');

    previewEl.innerHTML = escaped;
  }

  const p = Number(data.principal) || 0;
  const mi = Number(data.manualInterest) || 0;
  const mp = Number(data.manualPenalty) || 0;
  const total = p + mi + mp;
  const chineseEl = document.getElementById('chineseAmountHint');
  if (chineseEl) {
    chineseEl.textContent = `合計：${toChineseCurrency(total)}（本金：${p.toLocaleString()}，利息：${mi.toLocaleString()}，違約金：${mp.toLocaleString()}）`;
  }
}

/**
 * 存證信函輔助：民法第 130 條 6 個月起訴期限提醒、郵局用紙（每行 20 字、每頁 10 行）排版試算
 */
function updateLetterAids(data, text) {
  if (data.docType !== 'demand_letter' && data.docType !== 'offset_letter') return;

  const box = document.getElementById('noticeDeadlineBox');
  const icsBtn = document.getElementById('btnNoticeICS');
  const info = data.noticeDate ? calculate6MonthNoticeExpiry(data.noticeDate) : null;

  if (box) {
    if (!info) {
      box.className = 'alert-box info';
      box.textContent = '填入存證信函送達日後，這裡會顯示民法第 130 條的 6 個月起訴期限。';
    } else if (info.isExpired) {
      box.className = 'alert-box danger';
      box.textContent = `⚠️ 自 ${data.noticeDate} 送達起算，6 個月期限已於 ${info.expiryDateStr} 屆滿；若未於期限內聲請支付命令或起訴，此次催告對時效的中斷視為不中斷。`;
    } else {
      box.className = 'alert-box info';
      box.textContent = `⏰ 須於 ${info.expiryDateStr} 前（尚餘 ${info.remainingDays} 天）聲請支付命令或起訴；逾期未起訴，此次催告對時效的中斷視為不中斷（民法第 130 條）。`;
    }
  }
  if (icsBtn) icsBtn.style.display = (info && !info.isExpired) ? '' : 'none';

  const bodyStart = text.indexOf('內容：\n');
  const layout = calcPostalLetterLayout(bodyStart >= 0 ? text.slice(bodyStart + 4) : '');
  const summary = document.getElementById('letterLayoutSummary');
  const linesEl = document.getElementById('letterLayoutLines');
  if (summary) {
    summary.textContent = `📐 郵局用紙排版：全文 ${layout.charCount} 字，共 ${layout.lineCount} 行（每行 ${layout.charsPerLine} 字），約 ${layout.pageCount} 頁（每頁 ${layout.linesPerPage} 行）— 點此展開逐行抄寫`;
  }
  if (linesEl) {
    const out = [];
    layout.lines.forEach((line, i) => {
      const inPage = i % layout.linesPerPage;
      if (inPage === 0) out.push(`【第 ${Math.floor(i / layout.linesPerPage) + 1} 頁】`);
      out.push(`${String(inPage + 1).padStart(2, ' ')}. ${line}`);
    });
    linesEl.textContent = out.join('\n');
  }
}

/* ==========================================================================
   7. 強制執行薪資扣押計算機模組 (含 100% 薪資結構堆疊圖)
   ========================================================================== */
function initSalaryCalculator() {
  const inputs = ['salaryMonthlyIncome', 'salaryRegion', 'salaryDependents', 'salarySupportRatio'];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', runSalaryCalculation);
      el.addEventListener('change', runSalaryCalculation);
    }
  });

  const calcBtn = document.getElementById('btnCalculateSalary');
  if (calcBtn) {
    calcBtn.addEventListener('click', runSalaryCalculation);
  }

  runSalaryCalculation();
}

function runSalaryCalculation() {
  const salary = Number(document.getElementById('salaryMonthlyIncome')?.value) || 0;
  const region = document.getElementById('salaryRegion')?.value || 'taichung';
  const dependents = Number(document.getElementById('salaryDependents')?.value) || 0;
  const ratio = Number(document.getElementById('salarySupportRatio')?.value) || 1.0;

  const result = calculateSalaryGarnishment({
    monthlySalary: salary,
    regionCode: region,
    dependentCount: dependents,
    supportRatio: ratio
  });

  renderSalaryCalculationResult(result);
}

function renderSalaryCalculationResult(res) {
  const wrap = document.getElementById('salaryCalcResultWrap');
  if (!wrap) return;

  let alertHtml = '';
  if (res.isExempt) {
    alertHtml = `<div class="alert-box danger" style="margin-bottom:14px;">${escapeHtml(res.warningMessage)}</div>`;
  } else if (res.warningMessage) {
    alertHtml = `<div class="alert-box info" style="margin-bottom:14px;">${escapeHtml(res.warningMessage)}</div>`;
  }

  const total = res.salary || 1;
  const personalPct = Math.min(100, Math.round((res.personalCost / total) * 100));
  const dependentsPct = Math.min(100 - personalPct, Math.round((res.dependentsCost / total) * 100));
  const garnishablePct = res.isExempt ? 0 : Math.min(100 - personalPct - dependentsPct, Math.round((res.garnishableAmount / total) * 100));
  const retainedPct = Math.max(0, 100 - personalPct - dependentsPct - garnishablePct);

  let stackedBarHtml = '';
  if (res.isExempt) {
    stackedBarHtml = `
      <div class="salary-stacked-bar-container">
        <div style="font-size:0.88rem; font-weight:800; color:var(--navy-primary); margin-bottom:8px;">
          📊 100% 薪資結構分配視覺圖（全額受法律保障，不可扣押）：
        </div>
        <div class="salary-stacked-bar">
          <div class="stacked-seg seg-exempt" style="width: 100%;">
            100% 全額受法律最低生活保障 (NT$ ${res.salary.toLocaleString()})
          </div>
        </div>
        <div class="stacked-legend">
          <div class="legend-item"><span class="legend-dot" style="background:#64748B;"></span> <span>法定生活保障（豁免扣押）</span></div>
        </div>
      </div>
    `;
  } else {
    stackedBarHtml = `
      <div class="salary-stacked-bar-container">
        <div style="font-size:0.88rem; font-weight:800; color:var(--navy-primary); margin-bottom:8px;">
          📊 100% 薪資結構分配視覺圖：
        </div>
        <div class="salary-stacked-bar">
          <div class="stacked-seg seg-personal" style="width: ${personalPct}%;" title="債務人生活保障：${res.personalCost.toLocaleString()} 元">
            ${personalPct > 12 ? `本人保障 ${personalPct}%` : ''}
          </div>
          ${dependentsPct > 0 ? `
          <div class="stacked-seg seg-dependents" style="width: ${dependentsPct}%;" title="受扶養親屬保障：${res.dependentsCost.toLocaleString()} 元">
            ${dependentsPct > 12 ? `扶養 ${dependentsPct}%` : ''}
          </div>` : ''}
          ${retainedPct > 0 ? `
          <div class="stacked-seg" style="width: ${retainedPct}%; background:#10B981;" title="債務人其他保留餘額：${(res.salary - res.totalProtectedLivingCost - res.garnishableAmount).toLocaleString()} 元">
            ${retainedPct > 12 ? `保留 ${retainedPct}%` : ''}
          </div>` : ''}
          <div class="stacked-seg seg-garnishable" style="width: ${garnishablePct}%;" title="法院合法可扣押：${res.garnishableAmount.toLocaleString()} 元">
            ${garnishablePct > 10 ? `可扣 ${garnishablePct}%` : ''}
          </div>
        </div>
        <div class="stacked-legend">
          <div class="legend-item"><span class="legend-dot" style="background:#2563EB;"></span> <span>債務人生活保障 (NT$ ${res.personalCost.toLocaleString()})</span></div>
          ${res.dependents > 0 ? `<div class="legend-item"><span class="legend-dot" style="background:#D97706;"></span> <span>受扶養親屬保障 (NT$ ${res.dependentsCost.toLocaleString()})</span></div>` : ''}
          <div class="legend-item"><span class="legend-dot" style="background:#DC2626;"></span> <span>法院合法可扣押上限 (NT$ ${res.garnishableAmount.toLocaleString()})</span></div>
        </div>
      </div>
    `;
  }

  wrap.innerHTML = `
    ${alertHtml}
    ${stackedBarHtml}
    <div class="calc-result-box">
      <div class="calc-row">
        <span>債務人每月薪資總額：</span>
        <strong>NT$ ${res.salary.toLocaleString()} 元</strong>
      </div>
      <div class="calc-row">
        <span>所屬縣市 (${escapeHtml(res.regionName)}) 115 年最低生活費：</span>
        <span>NT$ ${res.baseLivingCost.toLocaleString()} 元 / 月</span>
      </div>
      <div class="calc-row">
        <span>個人法定最低生活保障基準 (1.2 倍)：</span>
        <span>NT$ ${res.personalCost.toLocaleString()} 元 / 月</span>
      </div>
      <div class="calc-row">
        <span>受扶養親屬保障支出 (${res.dependents} 人 × 比例 ${res.supportRatio})：</span>
        <span>NT$ ${res.dependentsCost.toLocaleString()} 元 / 月</span>
      </div>
      <div class="calc-row" style="font-weight:700; color:var(--navy-primary);">
        <span>債務人及扶養親屬法定生活保障總額：</span>
        <strong>NT$ ${res.totalProtectedLivingCost.toLocaleString()} 元 / 月</strong>
      </div>
      <div class="calc-row">
        <span>扣除生活費後實質可扣餘額：</span>
        <span>NT$ ${Math.max(0, res.salary - res.totalProtectedLivingCost).toLocaleString()} 元</span>
      </div>
      <div class="calc-row">
        <span>薪資三分之一法定上限 (強制執行法 115-1 條)：</span>
        <span>NT$ ${res.maxOneThird.toLocaleString()} 元</span>
      </div>

      <div class="calc-row-highlight">
        <div style="font-size:0.9rem; color:#064E3B; font-weight:700; margin-bottom:4px;">法院每月合法可扣押金額：</div>
        <div style="font-size:1.85rem; font-weight:900;">NT$ ${res.garnishableAmount.toLocaleString()} 元</div>
        <div style="font-size:0.85rem; color:#047857; margin-top:4px;">
          債務人每月保留生活費：NT$ ${res.retainedAmount.toLocaleString()} 元
        </div>
      </div>
    </div>
  `;
}

/* ==========================================================================
   8. 5 年消滅時效鬧鐘與台帳管理 (可點擊 KPI 與動態進度條)
   ========================================================================== */
function initLedger() {
  renderLedgerKpis();
  renderLedgerTable();

  const ledgerBody = document.getElementById('ledgerTableBody');
  if (ledgerBody) {
    ledgerBody.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-ledger-action]');
      if (!btn) return;
      const id = btn.getAttribute('data-record-id');
      switch (btn.getAttribute('data-ledger-action')) {
        case 'ics': downloadSingleICS(id); break;
        case 'renew': triggerRenewDoc(id); break;
        case 'edit': editRecord(id); break;
        case 'delete': handleDeleteRecord(id); break;
      }
    });
  }

  const searchInput = document.getElementById('ledgerSearch');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderLedgerTable(searchInput.value.trim());
    });
  }

  const filterSelect = document.getElementById('ledgerFilter');
  if (filterSelect) {
    filterSelect.addEventListener('change', () => {
      highlightActiveKpi(filterSelect.value);
      renderLedgerTable(searchInput?.value.trim(), filterSelect.value);
    });
  }

  const kpiCards = document.querySelectorAll('.kpi-card');
  kpiCards.forEach(card => {
    card.addEventListener('click', () => {
      const filterType = card.getAttribute('data-filter') || 'all';
      if (filterSelect) filterSelect.value = filterType;
      highlightActiveKpi(filterType);
      renderLedgerTable(searchInput?.value.trim(), filterType);
    });
  });

  const addBtn = document.getElementById('btnAddRecord');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      openRecordModal();
    });
  }

  const recordForm = document.getElementById('recordForm');
  if (recordForm) {
    recordForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('modalRecordId').value;
      const record = {
        id: id || undefined,
        debtorName: document.getElementById('modalDebtorName').value.trim(),
        debtorId: document.getElementById('modalDebtorId').value.trim(),
        certNo: document.getElementById('modalCertNo').value.trim(),
        courtName: document.getElementById('modalCourtName').value,
        principal: Number(document.getElementById('modalPrincipal').value) || 0,
        issueDate: document.getElementById('modalIssueDate').value,
        guarantorName: document.getElementById('modalGuarantorName').value.trim(),
        note: document.getElementById('modalNote').value.trim()
      };
      if (!saveRecord(record).saved) {
        showToast('⚠️ 儲存失敗：瀏覽器儲存空間不足，請先匯出備份並清理舊案件');
        return;
      }
      closeRecordModal();
      renderLedgerKpis();
      renderLedgerTable();
      showToast('✅ 債權憑證案件已儲存！');
    });
  }

  const exportAllIcsBtn = document.getElementById('btnExportAllICS');
  if (exportAllIcsBtn) {
    exportAllIcsBtn.addEventListener('click', () => {
      const records = loadRecords();
      if (records.length === 0) {
        alert('目前台帳內尚無案件可匯出行事曆');
        return;
      }
      const ics = generateICSContent(records);
      downloadFile(`儲互社_全部憑證5年時效鬧鐘_${todayLocalDateStr()}.ics`, ics, 'text/calendar;charset=utf-8');
      showToast('📅 已匯出全部案件之 .ics 行事曆鬧鐘檔！');
    });
  }

  const exportCsvBtn = document.getElementById('btnExportCSV');
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const records = loadRecords();
      if (records.length === 0) {
        alert('目前尚無資料可匯出');
        return;
      }
      exportRecordsToCSV(records);
    });
  }

  const exportJsonBtn = document.getElementById('btnExportJSON');
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
      const records = loadRecords();
      exportRecordsToJSON(records);
    });
  }

  const importFile = document.getElementById('importJSONFile');
  if (importFile) {
    importFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const res = importRecordsFromJSON(event.target.result);
        if (res.success) {
          showToast(`🎉 成功匯入 ${res.count} 筆台帳資料！`);
          renderLedgerKpis();
          renderLedgerTable();
        } else {
          alert('匯入失敗：' + res.error);
        }
      };
      reader.readAsText(file);
    });
  }
}

function highlightActiveKpi(filterType) {
  document.querySelectorAll('.kpi-card').forEach(c => {
    if (c.getAttribute('data-filter') === filterType) {
      c.classList.add('active');
    } else {
      c.classList.remove('active');
    }
  });
}

function renderLedgerKpis() {
  const metrics = getLedgerMetrics();
  if (document.getElementById('kpiTotalCount')) document.getElementById('kpiTotalCount').textContent = metrics.total;
  if (document.getElementById('kpiTotalPrincipal')) document.getElementById('kpiTotalPrincipal').textContent = `總債權本金 NT$ ${metrics.totalPrincipal.toLocaleString()}`;
  if (document.getElementById('kpiUrgentCount')) document.getElementById('kpiUrgentCount').textContent = metrics.urgent;
  if (document.getElementById('kpiWarningCount')) document.getElementById('kpiWarningCount').textContent = metrics.warning;
  if (document.getElementById('kpiSafeCount')) document.getElementById('kpiSafeCount').textContent = metrics.safe;
  if (document.getElementById('kpiExpiredCount')) document.getElementById('kpiExpiredCount').textContent = metrics.expired;
}

function renderLedgerTable(query = '', filterStatus = 'all') {
  const tbody = document.getElementById('ledgerTableBody');
  if (!tbody) return;

  let records = loadRecords();

  if (query) {
    records = records.filter(r => 
      (r.debtorName && r.debtorName.includes(query)) ||
      (r.debtorId && r.debtorId.includes(query)) ||
      (r.certNo && r.certNo.includes(query))
    );
  }

  if (filterStatus !== 'all') {
    records = records.filter(r => r.status === filterStatus);
  }

  tbody.innerHTML = '';

  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 28px; color: var(--muted);">目前尚無符合條件的債權憑證案件</td></tr>`;
    return;
  }

  records.forEach(r => {
    const tr = document.createElement('tr');
    
    let badgeClass = 'badge-success';
    let progressClass = 'safe';
    if (r.status === 'warning') {
      badgeClass = 'badge-warning';
      progressClass = 'warning';
    }
    if (r.status === 'urgent') {
      badgeClass = 'badge-danger';
      progressClass = 'urgent';
    }
    if (r.status === 'expired') {
      badgeClass = 'badge-dark';
      progressClass = 'expired';
    }

    const totalDays = 1825;
    const daysLeft = Math.max(0, Number(r.remainingDays) || 0);
    const consumedPct = Math.min(100, Math.max(0, Math.round(((totalDays - daysLeft) / totalDays) * 100)));

    tr.innerHTML = `
      <td>
        <strong style="font-size:0.98rem;">${escapeHtml(r.debtorName) || '未填'}</strong>
        <div style="font-size:0.8rem; color:var(--muted);">${escapeHtml(r.debtorId)}</div>
      </td>
      <td>${escapeHtml(r.certNo) || '未填'}</td>
      <td>${escapeHtml(r.courtName) || '臺中'}</td>
      <td><strong>NT$ ${Number(r.principal || 0).toLocaleString()}</strong></td>
      <td>${escapeHtml(r.issueDate)}</td>
      <td style="min-width:180px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong>${escapeHtml(r.expiryDateStr)}</strong>
          <span style="font-size:0.82rem; color:${escapeHtml(r.color)}; font-weight:900;">
            ${daysLeft > 0 ? `剩 ${daysLeft} 天` : `逾期 ${Math.abs(Number(r.remainingDays) || 0)} 天`}
          </span>
        </div>
        <div class="statute-progress-wrap" title="5年時效已流逝 ${consumedPct}%">
          <div class="statute-progress-bar ${progressClass}" style="width: ${consumedPct}%;"></div>
        </div>
      </td>
      <td><span class="badge ${badgeClass}">${escapeHtml(r.statusText)}</span></td>
      <td>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button type="button" class="btn btn-outline btn-sm" data-ledger-action="ics" data-record-id="${escapeHtml(r.id)}" title="下載此筆行事曆鬧鐘">📅 鬧鐘</button>
          <button type="button" class="btn btn-emerald btn-sm" data-ledger-action="renew" data-record-id="${escapeHtml(r.id)}" title="一鍵帶入換發憑證書狀">⚖️ 換證</button>
          <button type="button" class="btn btn-outline btn-sm" data-ledger-action="edit" data-record-id="${escapeHtml(r.id)}">✏️</button>
          <button type="button" class="btn btn-outline btn-sm" style="color:#DC2626;" data-ledger-action="delete" data-record-id="${escapeHtml(r.id)}">🗑️</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function downloadSingleICS(id) {
  const r = getRecord(id);
  if (!r) return;
  const ics = generateICSContent(r);
  downloadFile(`${r.debtorName}_5年時效鬧鐘.ics`, ics, 'text/calendar;charset=utf-8');
  showToast(`📅 已下載 ${r.debtorName} 之行事曆鬧鐘檔！`);
}

function triggerRenewDoc(id) {
  const r = getRecord(id);
  if (!r) return;

  if (document.getElementById('docType')) document.getElementById('docType').value = 'renew_cert';
  if (document.getElementById('docTitleType')) document.getElementById('docTitleType').value = 'cert';
  if (document.getElementById('docDebtorName')) document.getElementById('docDebtorName').value = r.debtorName || '';
  if (document.getElementById('docDebtorId')) document.getElementById('docDebtorId').value = r.debtorId || '';
  if (document.getElementById('docPrincipal')) document.getElementById('docPrincipal').value = r.principal || 0;
  if (document.getElementById('docCourt')) document.getElementById('docCourt').value = r.courtName || '臺中';
  if (document.getElementById('docGuarantorName')) document.getElementById('docGuarantorName').value = r.guarantorName || '';

  if (r.certNo) {
    const m = r.certNo.match(/(\d+)\s*年度?\s*(\S+?)\s*字第?\s*(\d+)/);
    if (m) {
      if (document.getElementById('docCaseYear')) document.getElementById('docCaseYear').value = m[1];
      if (document.getElementById('docCaseWord')) document.getElementById('docCaseWord').value = m[2];
      if (document.getElementById('docCaseNo')) document.getElementById('docCaseNo').value = m[3];
    } else {
      if (document.getElementById('docCaseNo')) document.getElementById('docCaseNo').value = r.certNo;
    }
  }

  updateDocTypeVisibility();
  updateDocPreview();
  switchTab('tab-docs');
  openNextStep('stepCard3');
  showToast(`⚖️ 已將 ${r.debtorName} 憑證資料帶入換發債權憑證狀！`);
}

function openRecordModal(record = null) {
  const modal = document.getElementById('recordModal');
  if (!modal) return;
  
  document.getElementById('modalRecordId').value = record ? record.id : '';
  document.getElementById('modalDebtorName').value = record ? record.debtorName : '';
  document.getElementById('modalDebtorId').value = record ? record.debtorId : '';
  document.getElementById('modalCertNo').value = record ? record.certNo : '';
  document.getElementById('modalCourtName').value = record ? record.courtName : '臺中';
  document.getElementById('modalPrincipal').value = record ? record.principal : '';
  document.getElementById('modalIssueDate').value = record ? record.issueDate : todayLocalDateStr();
  document.getElementById('modalGuarantorName').value = record ? (record.guarantorName || '') : '';
  document.getElementById('modalNote').value = record ? (record.note || '') : '';

  modal.style.display = 'flex';
}

function closeRecordModal() {
  const modal = document.getElementById('recordModal');
  if (modal) modal.style.display = 'none';
}

function editRecord(id) {
  const r = getRecord(id);
  if (r) openRecordModal(r);
}

function handleDeleteRecord(id) {
  if (confirm('確定要刪除這筆債權憑證案件嗎？')) {
    deleteRecord(id);
    renderLedgerKpis();
    renderLedgerTable();
    showToast('🗑️ 已刪除該筆案件');
  }
}

/* ==========================================================================
   9. 草稿自動還原 (Draft Auto-restore)
   ========================================================================== */
function restoreDrafts() {
  const docDraft = loadDraft(STORAGE_KEYS.DRAFT_DOC);
  if (docDraft && docDraft.data) {
    const d = docDraft.data;
    // 舊版草稿可能存了現已停用的公文種類（如 offset_share），
    // 直接套用會讓 #docType 變成下拉中不存在的值，須先驗證
    if (d.docType && isDocTypeEnabled(d.docType) && document.getElementById('docType')) {
      document.getElementById('docType').value = d.docType;
    }
    if (d.debtorName && document.getElementById('docDebtorName')) document.getElementById('docDebtorName').value = d.debtorName;
    if (d.debtorId && document.getElementById('docDebtorId')) document.getElementById('docDebtorId').value = d.debtorId;
    if (d.debtorAddress && document.getElementById('docDebtorAddress')) document.getElementById('docDebtorAddress').value = d.debtorAddress;
    if (d.principal && document.getElementById('docPrincipal')) document.getElementById('docPrincipal').value = d.principal;
    if (d.interestRate && document.getElementById('docInterestRate')) document.getElementById('docInterestRate').value = d.interestRate;
    updateDocTypeVisibility();
    updateDocPreview();
  }
}

/* ==========================================================================
   10. Demo 範例資料一鍵填入
   ========================================================================== */
function initDemoDataButton() {
  const demoBtn = document.getElementById('btnLoadDemoData');
  if (!demoBtn) return;

  demoBtn.addEventListener('click', () => {
    if (document.getElementById('scriptDebtorName')) document.getElementById('scriptDebtorName').value = '林志明';
    if (document.getElementById('scriptOverdueMonths')) document.getElementById('scriptOverdueMonths').value = 2;
    if (document.getElementById('scriptOverdueAmount')) document.getElementById('scriptOverdueAmount').value = 36000;

    // 案號類欄位已不再預填（避免假資料混入真實書狀），示範時由此帶入
    // （本社資料來自「本社資料設定」，示範不改動，以免覆蓋使用者已儲存的設定）
    const demoFields = {
      docAgentId: 'B221133445',
      docInterestStartDate: '',
      docTitleCaseNo: '112 年度司促字第 12345 號',
      docCaseYear: '112',
      docCaseWord: '司執',
      docCaseNo: '98765',
      docCaseSection: '民',
      docDocNo: '中一互社催字第 115001 號',
      docDeceasedDate: '2024-01-10',
      docHouseholdOffice: '臺中市西區戶政事務所'
    };
    Object.entries(demoFields).forEach(([id, v]) => {
      const el = document.getElementById(id);
      if (el) el.value = v;
    });

    if (document.getElementById('docDebtorName')) document.getElementById('docDebtorName').value = '林志明';
    if (document.getElementById('docDebtorId')) document.getElementById('docDebtorId').value = 'B120987654';
    if (document.getElementById('docDebtorAddress')) document.getElementById('docDebtorAddress').value = '臺中市南屯區公益路二段 60 號';
    if (document.getElementById('docLoanDate')) document.getElementById('docLoanDate').value = '2022-06-10';
    if (document.getElementById('docLoanAmount')) document.getElementById('docLoanAmount').value = 500000;
    if (document.getElementById('docPrincipal')) document.getElementById('docPrincipal').value = 320000;
    if (document.getElementById('docInterestRate')) document.getElementById('docInterestRate').value = 6.0;
    if (document.getElementById('docLastPaymentDate')) document.getElementById('docLastPaymentDate').value = '2023-08-10';
    if (document.getElementById('docManualInterest')) document.getElementById('docManualInterest').value = 18500;
    if (document.getElementById('docManualPenalty')) document.getElementById('docManualPenalty').value = 3000;
    if (document.getElementById('docCourt')) document.getElementById('docCourt').value = '臺中';
    if (document.getElementById('docDebtorMemberNo')) document.getElementById('docDebtorMemberNo').value = 'CU-1092';
    if (document.getElementById('docShareAmount')) document.getElementById('docShareAmount').value = 85000;
    if (document.getElementById('docDividendAmount')) document.getElementById('docDividendAmount').value = 3600;

    const guarantorCheck = document.getElementById('docHasGuarantor');
    if (guarantorCheck) {
      guarantorCheck.checked = true;
      document.getElementById('guarantorFieldsWrap').style.display = 'block';
      document.getElementById('docGuarantorName').value = '林美惠';
      document.getElementById('docGuarantorId').value = 'B220112233';
      document.getElementById('docGuarantorAddress').value = '臺中市南屯區大墩路 80 號';
    }

    const existing = loadRecords();
    if (existing.length === 0) {
      saveRecord({
        debtorName: '林志明',
        debtorId: 'B120987654',
        certNo: '111 年度司執字第 33456 號',
        courtName: '臺中',
        principal: 320000,
        issueDate: '2022-03-15',
        guarantorName: '林美惠',
        note: '已扣薪 3 期，後離職'
      });
      saveRecord({
        debtorName: '陳美玲',
        debtorId: 'L298765432',
        certNo: '110 年度司促字第 12890 號',
        courtName: '臺中',
        principal: 150000,
        issueDate: '2021-10-01',
        guarantorName: '',
        note: '時效即將於近期屆滿，需具狀換證'
      });
    }

    renderLedgerKpis();
    renderLedgerTable();
    updateScriptsPreview();
    updateDocPreview();
    showToast('✨ 已載入儲蓄互助社實務測試範例資料！');
  });
}
