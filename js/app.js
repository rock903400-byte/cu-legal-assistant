/**
 * 主控制器邏輯 (app.js)
 */

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initCourtSelect();
  initProfileSettings();
  initScriptsGenerator();
  initDocGenerator();
  initLedger();
  initDemoDataButton();
});

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

// 複製純文字至剪貼簿
function copyTextToClipboard(text, successMsg = '已複製至剪貼簿！') {
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
   1. 分頁切換 (Tabs)
   ========================================================================== */
function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');
      switchTab(targetId);
    });
  });
}

function switchTab(tabId) {
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
}

/* ==========================================================================
   2. 法院下拉選單初始化
   ========================================================================== */
function initCourtSelect() {
  const courtSelect = document.getElementById('docCourt');
  if (!courtSelect || typeof TAIWAN_COURTS === 'undefined') return;

  courtSelect.innerHTML = '';
  TAIWAN_COURTS.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.textContent = `${c.fullName}（${c.name}）`;
    courtSelect.appendChild(opt);
  });
}

/* ==========================================================================
   3. 本社資料設定 (記住本社)
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
        agentName: document.getElementById('profileAgentName').value.trim()
      };
      saveCuProfile(updatedProfile);
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
   4. 早期關懷話術生成器
   ========================================================================== */
function initScriptsGenerator() {
  const inputs = ['scriptDebtorName', 'scriptGender', 'scriptOverdueMonths', 'scriptOverdueAmount', 'scriptCuName', 'scriptCuPhone'];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateScriptsPreview);
      el.addEventListener('change', updateScriptsPreview);
    }
  });

  // 複製話術按鈕
  document.querySelectorAll('.btn-copy-script').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const textEl = document.getElementById(targetId);
      if (textEl) {
        copyTextToClipboard(textEl.textContent.trim(), '已複製話術文字！');
      }
    });
  });

  updateScriptFormFromProfile();
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
   5. 司法院標準公文生成器
   ========================================================================== */
function initDocGenerator() {
  const formInputs = [
    'docType', 'docCreditorName', 'docCreditorTaxId', 'docCreditorRep', 'docCreditorAddress', 'docCreditorPhone', 'docAgentName',
    'docDebtorName', 'docDebtorId', 'docDebtorAddress',
    'docHasGuarantor', 'docGuarantorName', 'docGuarantorId', 'docGuarantorAddress',
    'docLoanDate', 'docLoanAmount', 'docPrincipal', 'docInterestRate', 'docLastPaymentDate', 'docInterestStartDate',
    'docManualInterest', 'docManualPenalty', 'docCourt',
    'targetBankDeposit', 'targetBankName', 'targetInsurance', 'targetSalary', 'targetEmployerName', 'targetTaxData', 'targetRealEstate',
    'docTitleCaseNo', 'docTitleCourt', 'docCaseYear', 'docCaseWord', 'docCaseNo', 'docCaseSection'
  ];

  formInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        handleAddressAutoCourt(id);
        updateDocPreview();
      });
      el.addEventListener('change', () => {
        handleAddressAutoCourt(id);
        updateDocTypeVisibility();
        updateDocPreview();
      });
    }
  });

  // 保證人開關
  const guarantorToggle = document.getElementById('docHasGuarantor');
  if (guarantorToggle) {
    guarantorToggle.addEventListener('change', () => {
      const wrap = document.getElementById('guarantorFieldsWrap');
      if (wrap) wrap.style.display = guarantorToggle.checked ? 'block' : 'none';
      updateDocPreview();
    });
  }

  // 輔助試算按鈕
  const calcInterestBtn = document.getElementById('btnEstimateInterest');
  if (calcInterestBtn) {
    calcInterestBtn.addEventListener('click', () => {
      const p = Number(document.getElementById('docPrincipal')?.value) || 0;
      const r = Number(document.getElementById('docInterestRate')?.value) || 0;
      const start = document.getElementById('docInterestStartDate')?.value || document.getElementById('docLastPaymentDate')?.value;
      const end = new Date().toISOString().split('T')[0];
      if (p > 0 && r > 0 && start) {
        const est = calculateEstimatedInterest(p, r, start, end);
        document.getElementById('docManualInterest').value = est.interest;
        showToast(`💡 已為您試算 ${est.days} 天之約定利息：${est.interest.toLocaleString()} 元`);
        updateDocPreview();
      } else {
        alert('請先填寫未償本金、約定年利率與利息起算日');
      }
    });
  }

  // 複製公文
  const copyDocBtn = document.getElementById('btnCopyDoc');
  if (copyDocBtn) {
    copyDocBtn.addEventListener('click', () => {
      const text = document.getElementById('docPreviewText')?.textContent || '';
      copyTextToClipboard(text, '✅ 已複製整份司法院公文書狀！');
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
      const text = document.getElementById('docPreviewText')?.textContent || '';
      const docType = document.getElementById('docType')?.value || 'doc';
      const debtor = document.getElementById('docDebtorName')?.value || '債務人';
      downloadFile(`${debtor}_${docType}_書狀.txt`, text, 'text/plain;charset=utf-8');
    });
  }

  // 將當前公文案件存入 5 年時效台帳
  const saveToLedgerBtn = document.getElementById('btnSaveDocToLedger');
  if (saveToLedgerBtn) {
    saveToLedgerBtn.addEventListener('click', () => {
      const debtorName = document.getElementById('docDebtorName')?.value.trim();
      if (!debtorName) {
        alert('請先填寫債務人姓名');
        return;
      }
      const record = {
        debtorName: debtorName,
        debtorId: document.getElementById('docDebtorId')?.value.trim() || '',
        principal: Number(document.getElementById('docPrincipal')?.value) || 0,
        courtName: document.getElementById('docCourt')?.value || '臺中',
        certNo: document.getElementById('docTitleCaseNo')?.value.trim() || document.getElementById('docCaseNo')?.value.trim() || '新申請案',
        issueDate: document.getElementById('docLastPaymentDate')?.value || new Date().toISOString().split('T')[0],
        guarantorName: document.getElementById('docGuarantorName')?.value.trim() || '',
        note: `自公文助手建立 (${document.getElementById('docType')?.value})`
      };
      saveRecord(record);
      renderLedgerTable();
      showToast('🎉 已成功將案件加入 5 年消滅時效管理台帳！');
      switchTab('tab-statute');
    });
  }

  updateDocFormFromProfile();
  updateDocTypeVisibility();
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
  const execWrap = document.getElementById('executionSpecificFields');
  const renewWrap = document.getElementById('renewCertSpecificFields');

  if (execWrap) execWrap.style.display = (type === 'execution') ? 'block' : 'none';
  if (renewWrap) renewWrap.style.display = (type === 'renew_cert') ? 'block' : 'none';
}

function getDocFormData() {
  const debtorAddr = document.getElementById('docDebtorAddress')?.value.trim() || '';
  let courtName = document.getElementById('docCourt')?.value || '臺中';

  return {
    docType: document.getElementById('docType')?.value || 'payment_order',
    creditorName: document.getElementById('docCreditorName')?.value.trim() || '有限責任臺中市第一儲蓄互助社',
    creditorTaxId: document.getElementById('docCreditorTaxId')?.value.trim() || '',
    creditorRep: document.getElementById('docCreditorRep')?.value.trim() || '陳理事長',
    creditorAddress: document.getElementById('docCreditorAddress')?.value.trim() || '臺中市西區民生路 100 號',
    creditorPhone: document.getElementById('docCreditorPhone')?.value.trim() || '04-22223333',
    agentName: document.getElementById('docAgentName')?.value.trim() || '',

    debtorName: document.getElementById('docDebtorName')?.value.trim() || '張大同',
    debtorId: document.getElementById('docDebtorId')?.value.trim() || 'B123456789',
    debtorAddress: debtorAddr || '臺中市西區五權路 50 號',

    hasGuarantor: document.getElementById('docHasGuarantor')?.checked || false,
    guarantorName: document.getElementById('docGuarantorName')?.value.trim() || '',
    guarantorId: document.getElementById('docGuarantorId')?.value.trim() || '',
    guarantorAddress: document.getElementById('docGuarantorAddress')?.value.trim() || '',

    loanDate: document.getElementById('docLoanDate')?.value || '2023-01-15',
    loanAmount: document.getElementById('docLoanAmount')?.value || 300000,
    principal: document.getElementById('docPrincipal')?.value || 210000,
    interestRate: document.getElementById('docInterestRate')?.value || 6.5,
    lastPaymentDate: document.getElementById('docLastPaymentDate')?.value || '2023-11-20',
    interestStartDate: document.getElementById('docInterestStartDate')?.value || '2023-11-21',
    manualInterest: document.getElementById('docManualInterest')?.value || 0,
    manualPenalty: document.getElementById('docManualPenalty')?.value || 0,
    courtName: courtName,

    targets: {
      bankDeposit: document.getElementById('targetBankDeposit')?.checked ?? true,
      bankName: document.getElementById('targetBankName')?.value.trim() || '',
      insurance: document.getElementById('targetInsurance')?.checked ?? true,
      salary: document.getElementById('targetSalary')?.checked ?? true,
      employerName: document.getElementById('targetEmployerName')?.value.trim() || '',
      taxData: document.getElementById('targetTaxData')?.checked ?? true,
      realEstate: document.getElementById('targetRealEstate')?.checked ?? false
    },

    titleCourt: document.getElementById('docTitleCourt')?.value.trim() || courtName,
    titleCaseNo: document.getElementById('docTitleCaseNo')?.value.trim() || '112 年度司促字第 12345 號',
    caseYear: document.getElementById('docCaseYear')?.value.trim() || (new Date().getFullYear() - 1911),
    caseWord: document.getElementById('docCaseWord')?.value.trim() || '司執',
    caseNo: document.getElementById('docCaseNo')?.value.trim() || '98765',
    caseSection: document.getElementById('docCaseSection')?.value.trim() || '民'
  };
}

function updateDocPreview() {
  const data = getDocFormData();
  let text = '';

  if (data.docType === 'payment_order') {
    text = generatePaymentOrderDoc(data);
  } else if (data.docType === 'execution') {
    text = generateExecutionDoc(data);
  } else if (data.docType === 'renew_cert') {
    text = generateRenewCertificateDoc(data);
  }

  const previewEl = document.getElementById('docPreviewText');
  if (previewEl) {
    previewEl.textContent = text;
  }

  // 更新金額中文大寫提示
  const p = Number(data.principal) || 0;
  const mi = Number(data.manualInterest) || 0;
  const mp = Number(data.manualPenalty) || 0;
  const total = p + mi + mp;
  const chineseEl = document.getElementById('chineseAmountHint');
  if (chineseEl) {
    chineseEl.textContent = `合計：${toChineseCurrency(total)}（本金：${p.toLocaleString()}，利息：${mi.toLocaleString()}，違約金：${mp.toLocaleString()}）`;
  }
}

/* ==========================================================================
   6. 5 年消滅時效鬧鐘與台帳管理
   ========================================================================== */
function initLedger() {
  renderLedgerTable();

  // 搜尋
  const searchInput = document.getElementById('ledgerSearch');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderLedgerTable(searchInput.value.trim());
    });
  }

  // 狀態篩選
  const filterSelect = document.getElementById('ledgerFilter');
  if (filterSelect) {
    filterSelect.addEventListener('change', () => {
      renderLedgerTable(searchInput?.value.trim(), filterSelect.value);
    });
  }

  // 新增憑證按鈕
  const addBtn = document.getElementById('btnAddRecord');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      openRecordModal();
    });
  }

  // 儲存憑證表單
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
      saveRecord(record);
      closeRecordModal();
      renderLedgerTable();
      showToast('✅ 債權憑證案件已儲存！');
    });
  }

  // 匯出全部 ICS
  const exportAllIcsBtn = document.getElementById('btnExportAllICS');
  if (exportAllIcsBtn) {
    exportAllIcsBtn.addEventListener('click', () => {
      const records = loadRecords();
      if (records.length === 0) {
        alert('目前台帳內尚無案件可匯出行事曆');
        return;
      }
      const ics = generateICSContent(records);
      downloadFile(`儲互社_全部憑證5年時效鬧鐘_${new Date().toISOString().split('T')[0]}.ics`, ics, 'text/calendar;charset=utf-8');
      showToast('📅 已匯出全部案件之 .ics 行事曆鬧鐘檔！');
    });
  }

  // 匯出 CSV
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

  // 匯出 JSON
  const exportJsonBtn = document.getElementById('btnExportJSON');
  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
      const records = loadRecords();
      exportRecordsToJSON(records);
    });
  }

  // 匯入 JSON
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
          renderLedgerTable();
        } else {
          alert('匯入失敗：' + res.error);
        }
      };
      reader.readAsText(file);
    });
  }
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
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 24px; color: var(--muted);">目前尚無符合的債權憑證案件</td></tr>`;
    return;
  }

  records.forEach(r => {
    const tr = document.createElement('tr');
    
    let badgeClass = 'badge-success';
    if (r.status === 'warning') badgeClass = 'badge-warning';
    if (r.status === 'urgent') badgeClass = 'badge-danger';
    if (r.status === 'expired') badgeClass = 'badge-dark';

    tr.innerHTML = `
      <td>
        <strong>${r.debtorName || '未填'}</strong>
        <div style="font-size:0.8rem; color:var(--muted);">${r.debtorId || ''}</div>
      </td>
      <td>${r.certNo || '未填'}</td>
      <td>${r.courtName || '臺中'}</td>
      <td>NT$ ${Number(r.principal || 0).toLocaleString()}</td>
      <td>${r.issueDate || ''}</td>
      <td>
        <strong>${r.expiryDateStr || ''}</strong>
        <div style="font-size:0.8rem; color: ${r.color}; font-weight:800;">
          ${r.remainingDays > 0 ? `剩餘 ${r.remainingDays} 天` : `已逾期 ${Math.abs(r.remainingDays)} 天`}
        </div>
      </td>
      <td><span class="badge ${badgeClass}">${r.statusText}</span></td>
      <td>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button type="button" class="btn btn-outline btn-sm" onclick="downloadSingleICS('${r.id}')" title="下載此筆行事曆鬧鐘">📅 鬧鐘</button>
          <button type="button" class="btn btn-primary btn-sm" onclick="triggerRenewDoc('${r.id}')" title="一鍵帶入換發憑證書狀">⚖️ 換證</button>
          <button type="button" class="btn btn-outline btn-sm" onclick="editRecord('${r.id}')">✏️</button>
          <button type="button" class="btn btn-outline btn-sm" style="color:#DC2626;" onclick="handleDeleteRecord('${r.id}')">🗑️</button>
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

// 一鍵換證：帶入資料並切換至公文分頁
function triggerRenewDoc(id) {
  const r = getRecord(id);
  if (!r) return;

  if (document.getElementById('docType')) document.getElementById('docType').value = 'renew_cert';
  if (document.getElementById('docDebtorName')) document.getElementById('docDebtorName').value = r.debtorName || '';
  if (document.getElementById('docDebtorId')) document.getElementById('docDebtorId').value = r.debtorId || '';
  if (document.getElementById('docPrincipal')) document.getElementById('docPrincipal').value = r.principal || 0;
  if (document.getElementById('docCourt')) document.getElementById('docCourt').value = r.courtName || '臺中';
  if (document.getElementById('docGuarantorName')) document.getElementById('docGuarantorName').value = r.guarantorName || '';

  // 解析案號
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
  document.getElementById('modalIssueDate').value = record ? record.issueDate : new Date().toISOString().split('T')[0];
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
    renderLedgerTable();
    showToast('🗑️ 已刪除該筆案件');
  }
}

/* ==========================================================================
   7. Demo 範例資料一鍵填入
   ========================================================================== */
function initDemoDataButton() {
  const demoBtn = document.getElementById('btnLoadDemoData');
  if (!demoBtn) return;

  demoBtn.addEventListener('click', () => {
    // 填入話術
    if (document.getElementById('scriptDebtorName')) document.getElementById('scriptDebtorName').value = '林志明';
    if (document.getElementById('scriptOverdueMonths')) document.getElementById('scriptOverdueMonths').value = 2;
    if (document.getElementById('scriptOverdueAmount')) document.getElementById('scriptOverdueAmount').value = 36000;

    // 填入公文
    if (document.getElementById('docDebtorName')) document.getElementById('docDebtorName').value = '林志明';
    if (document.getElementById('docDebtorId')) document.getElementById('docDebtorId').value = 'B120987654';
    if (document.getElementById('docDebtorAddress')) document.getElementById('docDebtorAddress').value = '臺中市南屯區公益路二段 60 號';
    if (document.getElementById('docLoanDate')) document.getElementById('docLoanDate').value = '2022-06-10';
    if (document.getElementById('docLoanAmount')) document.getElementById('docLoanAmount').value = 500000;
    if (document.getElementById('docPrincipal')) document.getElementById('docPrincipal').value = 320000;
    if (document.getElementById('docInterestRate')) document.getElementById('docInterestRate').value = 6.0;
    if (document.getElementById('docLastPaymentDate')) document.getElementById('docLastPaymentDate').value = '2023-08-10';
    if (document.getElementById('docInterestStartDate')) document.getElementById('docInterestStartDate').value = '2023-08-11';
    if (document.getElementById('docManualInterest')) document.getElementById('docManualInterest').value = 18500;
    if (document.getElementById('docManualPenalty')) document.getElementById('docManualPenalty').value = 3000;
    if (document.getElementById('docCourt')) document.getElementById('docCourt').value = '臺中';

    // 保證人
    const guarantorCheck = document.getElementById('docHasGuarantor');
    if (guarantorCheck) {
      guarantorCheck.checked = true;
      document.getElementById('guarantorFieldsWrap').style.display = 'block';
      document.getElementById('docGuarantorName').value = '林美惠';
      document.getElementById('docGuarantorId').value = 'B220112233';
      document.getElementById('docGuarantorAddress').value = '臺中市南屯區大墩路 80 號';
    }

    // 填入台帳範例 (若目前無資料)
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
      renderLedgerTable();
    }

    updateScriptsPreview();
    updateDocPreview();
    showToast('✨ 已載入儲蓄互助社實務測試範例資料！');
  });
}
