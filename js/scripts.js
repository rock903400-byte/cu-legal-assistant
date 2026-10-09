/**
 * 早期溫情關懷話術庫 (scripts.js)
 * 依協會《儲蓄互助社放款評估損失準備提列及逾期放款呆帳處理辦法》第 11 條催收程序設計：
 * 逾期 1 個月內通知借款人、2 個月內發催告函予借款人及連帶保證人、3 個月以上採取保全措施或著手取得執行名義；
 * 第 12 條：逾期放款按月提報理事會。（「逾期 1~2 個月宜及早關懷協調」為催收實務經驗）
 */

/**
 * 產生電訪話術腳本
 */
function generatePhoneScripts(data) {
  const name = data.debtorName || '○○社員';
  const genderTitle = data.gender === 'female' ? '女士' : (data.gender === 'male' ? '先生' : '');
  const salutation = `${name} ${genderTitle}`.trim();
  const overdueMonths = data.overdueMonths || 1;
  const overdueAmount = Number(data.overdueAmount || 0).toLocaleString();
  const cuName = data.cuName || '儲蓄互助社';

  return {
    empathy: {
      title: '1. 溫情同理心關懷型（適合剛逾期 1 個月、平時信用良好者）',
      script: `
專職／幹部：「${salutation}您好，我是 ${cuName} 的專職○○。今天打電話來，主要是關心一下您最近生活或工作還順利嗎？

因為系統顯示您這個月的放款攤還金（約 ${overdueAmount} 元）好像還沒有入帳，我們擔心是不是扣款帳戶有狀況，或者您最近生活上有遇到什麼突發狀況或困難？

我們儲蓄互助社就像一家人，互助合作是我們的本質。如果您目前手頭剛好比較緊，隨時可以跟我們說，我們一起看看能怎麼協調安排，千萬不要有心理壓力喔！」
`
    },
    negotiation: {
      title: '2. 紓困分期／展延協商型（適合遭遇失業、醫療等重大變故者）',
      script: `
專職／幹部：「${salutation}您好，我是 ${cuName} 的○○。得知您最近家裡/工作遇到一些狀況，辛苦了！

針對目前暫時無法正常繳款的情況（目前累計逾期約 ${overdueMonths} 期，金額約 ${overdueAmount} 元），為了避免逾期影響到您在社內的信用評等與保證人權益，我們社裡有提供紓困協商的機制。

例如我們可以先協助您向放款委員會申請『暫時只繳利息、本金寬限展延』，或者重新調整每月的還款期數，減輕您每月的負擔。

請您這兩天方便的話，帶身分證來社裡一趟，我們當面幫您試算最輕鬆的還款方案，陪伴您一起度過這個難關！」
`
    },
    formal: {
      title: '3. 幹部正式提醒型（適合逾期接近 2 個月、多次催詢未果者）',
      script: `
專職／幹部：「${salutation}您好，我是 ${cuName} 的○○。

向您正式報告，您的放款目前已逾期達 ${overdueMonths} 個月，累計未繳金額為 ${overdueAmount} 元。

依照協會《儲蓄互助社放款評估損失準備提列及逾期放款呆帳處理辦法》，逾期放款須按月提報理事會列管；逾期達 3 個月以上，本社應採取保全措施或著手取得執行名義（向法院聲請支付命令，取得後聲請強制執行）。

我們非常重視社員的信用與彼此的情誼，為了避免後續產生法院訴訟規費及影響保證人，懇請您務必於本週五前至本社補繳或來電辦理還款約定，感謝您的配合與支持！」
`
    }
  };
}

/**
 * 產生 LINE 與簡訊催繳親切通知文案
 */
function generateLineMessages(data) {
  const name = data.debtorName || '社員';
  const overdueAmount = Number(data.overdueAmount || 0).toLocaleString();
  const cuName = data.cuName || '儲蓄互助社';
  const cuPhone = data.cuPhone || '本社電話';

  return {
    gentle: {
      title: '💬 LINE 親切提醒版（逾期 1 個月以內）',
      text: `【${cuName} 溫馨提醒】
親愛的 ${name} 社員您好：
系統提醒您本期貸款攤還金（約 NT$ ${overdueAmount}）尚未完成繳納。
若您近日已完成繳款，請忽略本訊息；若尚未繳納，請撥空至本社或透過轉帳完成繳款。
若遇任何財務困難需要協調，歡迎隨時回傳訊息或來電（${cuPhone}），我們竭誠為您服務！😊`
    },
    formal: {
      title: '⚠️ LINE 正式通知版（逾期逾 1 個月）',
      text: `【${cuName} 催繳通知】
${name} 社員您好：
您於本社之放款截至目前尚有款項 NT$ ${overdueAmount} 逾期未繳。
為維護您的社內信用紀錄與共同保證人之權益，請於 3 日內完成款項補繳。
如需辦理分期展延或協商還款方案，請儘速來電 ${cuPhone} 與專職人員聯繫，謝謝您的合作！`
    },
    finalWarning: {
      title: '🚨 LINE 法催前最後通知（逾期即將滿 3 個月）',
      text: `【${cuName} 重要權益重要告警】
${name} 社員您好：
您的放款已嚴重逾期，累積欠款 NT$ ${overdueAmount}。
依本社放款辦法及協會規定，若於本週五前仍未補清或出面協商，本社將依法向法院聲請「支付命令」，並於取得執行名義後聲請「強制執行（扣押存款/扣薪/查調財產）」，屆時將產生額外法院規費及利息。
請務必正視並於今日內來電 ${cuPhone} 處理，以免權益受損！`
    }
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generatePhoneScripts,
    generateLineMessages
  };
}
