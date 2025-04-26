/**
 * KPIツリージェネレーター：コア機能
 * 初期化、基本機能とメインインターフェースを提供します
 * 
 * このファイルはアプリケーションの入口点となり、他のモジュールを統合します。
 * DOM読み込み後の初期化処理や、グローバルイベントハンドリングを担当します。
 */

/**
 * グローバル状態管理変数
 */
window._initialLoadComplete = false;  // 初期ロード完了フラグ
window._shareUrl = null;            // 現在の共有URL
window._publicBaseUrl = null;       // 公開ベースURL

/**
 * KPIツリーアプリケーションのメイン初期化処理
 * ページ読み込み後に実行され、全モジュールの調整と状態初期化を行う
 * ツリーの表示、共有機能、URLパラメータの処理、初期状態の適用を実施
 * 
 * @returns {void}
 */
function kpiTreeInit() {
  console.log('KPIツリー初期化開始');
  
  // グローバル状態変数のリセット
  window._initialLoadComplete = false;
  window._shareUrl = null;
  
  /**
   * ステップ1: 共有URL設定の初期化
   * YAML設定から公開用URLを取得
   */
  if (window.PUBLIC_URL) {
    window._publicBaseUrl = window.PUBLIC_URL;
    console.log('PUBLIC_URL設定検出:', window._publicBaseUrl);
  }
  
  /**
   * ステップ2: リダイレクト環境の処理
   * GCSなどのリダイレクト環境でパラメータが消失しないよう対応
   */
  handleUrlRedirects();
  
  /**
   * ステップ3: UI設定とレイアウトの初期化
   */
  // ツリーの向きを横方向に固定
  setDirection('horizontal');
  
  // 共有ボタンの設置
  addShareButton();
  
  // ノードハイライト用のスタイルをページに追加
  addHighlightStyle();
  
  /**
   * ステップ4: ツリー状態の取得と適用
   * 優先順位: ハッシュパラメータ > URLクエリパラメータ > ローカルストレージ
   */
  // 1. まずハッシュフラグメントから状態を取得試行
  var state = getStateFromHash();
  
  // 2. ハッシュに状態がなければ、URLクエリパラメータから取得試行
  if (!state || Object.keys(state).length === 0) {
    state = getStateFromUrl();
    
    // 3. URLパラメータにもなければローカルストレージを確認
    if (!state || Object.keys(state).length === 0) {
      try {
        // ローカルストレージから過去の状態の復元試行
        var savedStateParam = localStorage.getItem('kpiTreeStateParam');
        if (savedStateParam) {
          state = decodeStateParam(savedStateParam);
          console.log('ローカル保存状態を復元しました');
        }
      } catch (storageError) {
        console.error('ストレージからの状態読み込み失敗:', storageError);
        // エラー発生時は空の状態で継続
      }
    }
  }
  
  /**
   * ステップ5: 取得した状態に基づくツリーの初期設定
   */
  // 取得した状態をツリーに適用（開閉状態の復元）
  console.log('ツリー状態を適用します');
  applyTreeState(state);
  
  // トグルボタンの機能を設定
  setupToggleButtons();
  
  /**
   * ステップ6: ノードアンカーとリンク機能の初期化
   */
  // 各ノードにリンクアイコンを追加
  addNodeAnchors();
  
  // URLハッシュに指定されたノードがあればそこにスクロール
  setTimeout(function() {
    scrollToAnchorNode();
    console.log('アンカーノードスクロール処理完了');
  }, 500); // DOMが完全にレンダリングされるのを待つ
  
  /**
   * ステップ7: URL更新と初期化完了
   */
  // URLを現在の状態で更新
  setTimeout(function() {
    updateShareUrl();
    console.log('共有URLを更新しました');
  }, 600);
  
  // 初期化完了フラグを設定
  window._initialLoadComplete = true;
  console.log('KPIツリー初期化完了');
}

/**
 * ツリーの表示方向を設定
 * @param {string} direction - 表示方向 ('horizontal' または 'vertical')
 */
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

/**
 * ノードハイライト表示用のスタイルを動的に追加
 * アンカーリンクを使用した場合の強調表示に使用されます
 */
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

/**
 * アプリケーションのエントリーポイント
 * DOM読み込み完了時に実行されるメイン処理
 */
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM読み込み完了、KPIツリー初期化開始');
  
  // URL変更の監視を開始
  monitorUrlChanges();
  
  // KPIツリーの初期化処理を実行
  kpiTreeInit();
  
  console.log('KPIツリーの初期化完了');
});

/**
 * ブラウザのナビゲーションイベントハンドラ（戻るボタンやURL変更時）
 * URLハッシュ変更時にツリーの状態を自動更新します
 */
window.addEventListener('popstate', function(event) {
  console.log('URL変更検出、URLから状態を再読み込み');
  
  // ページの再読み込みなしでハッシュから状態を取得し適用
  var state = getStateFromHash();
  if (Object.keys(state).length > 0) {
    applyTreeState(state);
  }
});
