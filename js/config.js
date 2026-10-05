/**
 * 介面功能開關 (config.js)
 *
 * 本系統預設呈現「法催」主線：存證信函催告 → 支付命令 → 確定證明書 → 強制執行 → 債權憑證，
 * 其餘功能（早期關懷話術、法規問答）的程式碼與版型
 * 全部保留在專案中，僅由本檔決定是否顯示 —— 改這裡的清單即可隨時開回來。
 *
 * 完整功能的設定值（貼回下方即恢復原本 5 分頁與全部公文）：
 *   ENABLED_TABS: ['tab-docs', 'tab-salary', 'tab-statute', 'tab-scripts', 'tab-faq']
 *   ENABLED_DOC_TYPES: ['payment_order', 'payment_order_final', 'execution', 'renew_cert',
 *                       'demand_letter', 'offset_letter']
 *   SHOW_SCENARIO_NAV: true
 */

const APP_CONFIG = {
  // 要顯示的分頁（順序即畫面順序，第一個為預設開啟的分頁）
  ENABLED_TABS: ['tab-docs', 'tab-salary', 'tab-statute'],

  // 公文種類下拉可選的項目
  // 預設主線：支付命令 → 確定證明書 → 強制執行 → 債權憑證，另含存證信函（催告、股金扣除貸款）
  ENABLED_DOC_TYPES: ['payment_order', 'payment_order_final', 'execution', 'renew_cert',
                      'demand_letter', 'offset_letter'],

  // 頂部 4 張情境導航大卡片
  SHOW_SCENARIO_NAV: false
};

/** 分頁是否啟用 */
function isTabEnabled(tabId) {
  return APP_CONFIG.ENABLED_TABS.includes(tabId);
}

/** 公文種類是否啟用 */
function isDocTypeEnabled(docType) {
  return APP_CONFIG.ENABLED_DOC_TYPES.includes(docType);
}

/** 預設分頁 */
function getDefaultTab() {
  return APP_CONFIG.ENABLED_TABS[0];
}

/** 預設公文種類 */
function getDefaultDocType() {
  return APP_CONFIG.ENABLED_DOC_TYPES[0];
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    APP_CONFIG,
    isTabEnabled,
    isDocTypeEnabled,
    getDefaultTab,
    getDefaultDocType
  };
}
