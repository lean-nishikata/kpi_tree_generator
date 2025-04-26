/**
 * KPIツリージェネレーター：コア機能
 * 初期化と基本機能を提供します
 */

// グローバル変数
window._initialLoadComplete = false;
window._shareUrl = null;
window._publicBaseUrl = null;

// 初期化時に実行される関数
function kpiTreeInit() {
  window._initialLoadComplete = false;
  window._shareUrl = null;
  
  // PUBLIC_URLが設定されていれば保存
  if (window.PUBLIC_URL) {
    window._publicBaseUrl = window.PUBLIC_URL;
    console.log('PUBLIC_URL設定:', window._publicBaseUrl);
  }
  
  // リダイレクトパラメータを処理
  handleUrlRedirects();
  
  // 固定で横レイアウトに設定
  setDirection('horizontal');
  
  // 共有ボタンの追加
  addShareButton();
  
  // ハイライトスタイルを追加
  addHighlightStyle();
  
  // まずハッシュから状態を取得
  var state = getStateFromHash();
  
  // ハッシュに状態がなければURLパラメータから取得
  if (!state || Object.keys(state).length === 0) {
    state = getStateFromUrl();
    
    // URLパラメータにもなければローカルストレージにアクセス
    if (!state || Object.keys(state).length === 0) {
      try {
        var savedStateParam = localStorage.getItem('kpiTreeStateParam');
        if (savedStateParam) {
          state = decodeStateParam(savedStateParam);
          console.log('ローカルストレージから状態を復元:', state);
        }
      } catch (e) {
        console.error('ローカルストレージからの状態読み込み失敗:', e);
      }
    }
  }
  
  // ツリー状態を適用
  applyTreeState(state);
  
  // トグルボタンの設定
  setupToggleButtons();
  
  // 各ノードにアンカーアイコンを追加
  addNodeAnchors();
  
  // アンカーノードへのスクロール
  setTimeout(function() {
    scrollToAnchorNode();
  }, 500);
  
  // 共有URLを更新
  setTimeout(updateShareUrl, 500);
  
  // 初期ロード完了フラグをセット
  window._initialLoadComplete = true;
}

// 方向を設定する関数
function setDirection(direction) {
  if (direction === 'horizontal') {
    document.body.setAttribute('data-direction', 'horizontal');
    document.querySelector('.kpi-tree-container').classList.add('direction-horizontal');
    document.querySelector('.kpi-tree-container').classList.remove('direction-vertical');
  } else {
    document.body.setAttribute('data-direction', 'vertical');
    document.querySelector('.kpi-tree-container').classList.add('direction-vertical');
    document.querySelector('.kpi-tree-container').classList.remove('direction-horizontal');
  }
}

// ハイライト用のスタイルを追加
function addHighlightStyle() {
  // 既存のスタイル要素があれば追加しない
  if (document.getElementById('kpi-tree-highlight-style')) return;
  
  var style = document.createElement('style');
  style.id = 'kpi-tree-highlight-style';
  style.textContent = `
    .highlight-node {
      animation: nodeHighlight 2s;
    }
    @keyframes nodeHighlight {
      0% { box-shadow: 0 0 0 0 rgba(66, 133, 244, 0.7); }
      70% { box-shadow: 0 0 0 10px rgba(66, 133, 244, 0); }
      100% { box-shadow: 0 0 0 0 rgba(66, 133, 244, 0); }
    }
  `;
  document.head.appendChild(style);
}

// Run initialization when page is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM content loaded, initializing KPI tree');
  
  // URL監視を開始
  monitorUrlChanges();
  
  // KPIツリーの動作を初期化
  kpiTreeInit();
  
  console.log('KPI tree initialization complete');
});

// ページURL変更時の対応
window.addEventListener('popstate', function(event) {
  console.log('URL changed, reloading state from URL');
  // ページをリロードせずに状態を更新
  var state = getStateFromHash();
  if (Object.keys(state).length > 0) {
    applyTreeState(state);
  }
});
