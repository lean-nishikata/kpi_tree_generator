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
window._viewMode = 'daily';         // 表示モード（daily または monthly）

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
  
  // ノードハイライト用のスタイルはanchor.jsで追加される
  
  /**
   * ステップ4: ツリー状態の取得と適用
   * 優先順位: ハッシュパラメータ > URLクエリパラメータ > ローカルストレージ
   */
  // 1. まずハッシュフラグメントから状態を取得試行
  var state = getStateFromHash();
  
  // 【デバッグ強化】現在のURLとクエリパラメータを確認
  console.log('【DEBUG】初期化時のURL情報:', {
    fullUrl: window.location.href,
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    rawQueryParams: window.location.search.substring(1),
    urlSearchParams: new URLSearchParams(window.location.search).toString()
  });
  
  // 1.5 ハッシュから表示モードを取得試行
  var viewModeParam = getViewModeFromHash();
  console.log('【DEBUG】getViewModeFromHashの結果:', viewModeParam);
  
  // ハッシュから取得できなければ、URLクエリパラメータから表示モードを取得試行
  if (!viewModeParam) {
    try {
      viewModeParam = getViewModeFromUrl();
      console.log('【DEBUG】getViewModeFromUrlの結果:', viewModeParam);
    } catch (e) {
      console.error('【DEBUG】getViewModeFromUrlエラー発生:', e);
    }
    
    if (viewModeParam) {
      console.log('【成功】URLクエリパラメータから表示モードを取得:', viewModeParam);
    } else {
      console.warn('【注意】URLクエリパラメータから表示モードを取得できませんでした');
    }
  } else {
    console.log('【成功】ハッシュから表示モードを取得:', viewModeParam);
  }
  
  // 有効な表示モードが取得できた場合は適用
  if (viewModeParam) {
    window._viewMode = viewModeParam;
    
    // 重要: 表示モードを実際に適用する処理を追加
    console.log('初期ロード時に表示モードを設定します:', viewModeParam);
    
    // 重要: 変数を定義してDOMContentLoaded完了後に確実にモードを適用できるようにする
    window._initialViewMode = viewModeParam;
    
    // DOM読み込み完了後に表示モードを確実に切り替える
    document.addEventListener('DOMContentLoaded', function() {
      // トグル読み込み後に少し遅延させて実行
      setTimeout(function() {
        console.log('初期読み込み後に表示モードを切り替え:', viewModeParam);
        switchViewMode(viewModeParam);
      }, 100);
    });
  }
  
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
  // 日次・月次トグル状態の復元
  if (state && state._viewMode) {
    console.log('URLから表示モードを復元:', state._viewMode);
    switchViewMode(state._viewMode);
    // _viewModeはツリー状態ではないので実行後に削除
    delete state._viewMode;
  }
  
  // 取得した状態をツリーに適用（開閉状態の復元）
  console.log('ツリー状態を適用します');
  // applyTreeState(state);
  if (state && Object.keys(state).length > 0) {
    applyTreeState(state); // 取得した状態があればそれを適用
  } else {
    initAllNodes(); // 状態がなければ初期展開（3段目まで）
  }
  
  // トグルボタンの機能を設定
  setupToggleButtons();
  
  // DOMレンダリング後にハッシュから取得したモードを確実に適用
  setTimeout(function() {
    if (window._initialViewMode) {
      console.log('ハッシュから取得した表示モードを確実に適用します:', window._initialViewMode);
      
      // トグルボタンを該当モードに合わせて活性化
      const dailyButton = document.querySelector('.toggle-option.daily');
      const monthlyButton = document.querySelector('.toggle-option.monthly');
      
      if (dailyButton && monthlyButton) {
        dailyButton.classList.toggle('active', window._initialViewMode === 'daily');
        monthlyButton.classList.toggle('active', window._initialViewMode === 'monthly');
      }
      
      // 入力値を特定モードに合わせて更新
      updateAllNodeValues();
      
      console.log('表示モード初期化完了:', window._initialViewMode);
    }
  }, 300);
  
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
 * ナビゲーションドロワーの初期化とイベント設定
 */
function setupNavigationDrawer() {
  const menuToggle = document.getElementById('menu-toggle');
  const drawer = document.getElementById('drawer-menu');
  const overlay = document.getElementById('drawer-overlay');
  const mainContent = document.querySelector('.main-content');
  const drawerClose = document.getElementById('drawer-close');
  
  // 要素が見つからない場合のエラーハンドリング
  if (!menuToggle || !drawer) {
    console.error('ナビゲーションドロワーの必要な要素が見つかりません');
    return;
  }
  
  // オーバーレイ要素がない場合は作成
  let overlayElement = overlay;
  if (!overlayElement) {
    console.log('オーバーレイ要素を作成します');
    overlayElement = document.createElement('div');
    overlayElement.id = 'drawer-overlay';
    overlayElement.className = 'drawer-overlay';
    document.body.appendChild(overlayElement);
  }
  
  // ドロワーを開く関数
  function openDrawer() {
    drawer.classList.add('open');
    menuToggle.classList.add('open');
    overlay.classList.add('visible');
    mainContent.classList.add('drawer-open');
    
    // ARIA属性を更新
    menuToggle.setAttribute('aria-expanded', 'true');
    drawer.setAttribute('aria-hidden', 'false');
    
    // メニューボタンのラベルを更新
    menuToggle.setAttribute('aria-label', 'メニューを閉じる');
    
    console.log('ドロワーを開きました');
  }
  
  // ドロワーを閉じる関数
  function closeDrawer() {
    drawer.classList.remove('open');
    menuToggle.classList.remove('open');
    overlay.classList.remove('visible');
    mainContent.classList.remove('drawer-open');
    
    // ARIA属性を更新
    menuToggle.setAttribute('aria-expanded', 'false');
    drawer.setAttribute('aria-hidden', 'true');
    
    // メニューボタンのラベルを更新
    menuToggle.setAttribute('aria-label', 'メニューを開く');
    
    console.log('ドロワーを閉じました');
  }
  
  // メニューボタンのクリックイベント
  menuToggle.addEventListener('click', function() {
    if (drawer.classList.contains('open')) {
      closeDrawer();
    } else {
      openDrawer();
    }
  });
  
  // ドロワー内の閉じるボタンのクリックイベント
  if (drawerClose) {
    drawerClose.addEventListener('click', closeDrawer);
  }
  
  // オーバーレイのクリックイベント
  overlayElement.addEventListener('click', closeDrawer);
  
  // ESCキーでドロワーを閉じる
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && drawer.classList.contains('open')) {
      closeDrawer();
    }
  });
  
  // ドロワー内に共有ボタンを配置
  moveShareButtonToDrawer();
  
  console.log('ナビゲーションドロワーの初期化完了');
}

/**
 * 共有ボタンをドロワー内に移動する関数
 */
function moveShareButtonToDrawer() {
  const shareButton = document.getElementById('shareButton');
  const drawerShareContainer = document.getElementById('drawer-share-btn-container');
  
  // 共有ボタンが存在する場合はドロワー内に移動
  if (shareButton && drawerShareContainer) {
    // 元の親要素からボタンを削除
    if (shareButton.parentNode) {
      shareButton.parentNode.removeChild(shareButton);
    }
    
    // ドロワー内のコンテナに追加
    drawerShareContainer.appendChild(shareButton);
    
    // ドロワー内での表示にふさわしいスタイルに調整
    shareButton.style.width = '100%';
    shareButton.style.marginTop = '8px';
    
    console.log('共有ボタンをドロワーに移動しました');
  } else {
    console.warn('共有ボタンまたはドロワー内コンテナが見つかりません');
  }
}

/**
 * アプリケーションのエントリーポイント
 * DOM読み込み完了時に実行されるメイン処理
 */
document.addEventListener('DOMContentLoaded', function() {
  // ページ読み込み完了時に実行される初期化処理
  console.log('ページ読み込み完了');

  // 共有ボタンの追加
  addShareButton();
  
  // 日次/月次切り替えボタンの設定
  setupViewModeToggle();

  // ツリーの開閉ボタンの初期化
  setupToggleButtons();
  
  // ナビゲーションドロワーの設定
  setupNavigationDrawer();
  
  // 前日比・前月比の色を初期状態で適用
  applyInitialDiffStyles();
  
  // 全ノードの値を更新
  updateAllNodeValues();
  
  // 初回読み込み時に前日比・前月比の色を適用
  applyInitialDiffStyles();
  
  // 初期データ読み込み完了を通知
  document.dispatchEvent(new Event('kpi-tree-loaded'));
  
  // URL変更の監視を開始
  monitorUrlChanges();
  
  // KPIツリーの初期化処理を実行
  kpiTreeInit();
  
  // 初回読み込み時に前日比・前月比の色を適用
  applyInitialDiffStyles();
  
  // 日次/月次切り替えボタンのイベントリスナーを設定
  setupViewModeToggle();
  
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

/**
 * 表示モード（日次/月次）を切り替える関数
 * @param {string} mode - 表示モード ('daily' または 'monthly')
 */
function switchViewMode(mode) {
  // 【デバッグ強化】引数と現在の状態を詳細に出力
  console.log('【VIEW-MODE-DEBUG】表示モード切り替え関数が呼ばれました:', {
    要求モード: mode,
    現在モード: window._viewMode,
    URL: window.location.href,
    URLパラメータ: new URLSearchParams(window.location.search).toString(),
    呼び出し元: new Error().stack.split('\n')[1]
  });
  
  // モードパラメータを検証
  if (mode !== 'daily' && mode !== 'monthly') {
    console.error('【SWITCH-MODE】無効なモードパラメータが指定されました:', mode);
    console.error('無効な表示モード:', mode);
    return;
  }
  
  // 既に同じモードなら何もしない
  if (window._viewMode === mode) {
    console.log('【SWITCH-MODE】既に同じモードなので何もしません:', mode);
    console.log('既に同じモードなので何もしません:', mode);
    return;
  }
  
  // グローバル状態を更新
  console.log('表示モードを切り替え:', mode);
  window._viewMode = mode;
  
  // まず全てのnode要素にデータ属性があるか確認
  const allNodes = document.querySelectorAll('.node');
  const nodesWithDailyValue = document.querySelectorAll('.node[data-value-daily]').length;
  const nodesWithMonthlyValue = document.querySelectorAll('.node[data-value-monthly]').length;
  console.log(`データ属性統計: 全ノード数=${allNodes.length}, daily属性あり=${nodesWithDailyValue}, monthly属性あり=${nodesWithMonthlyValue}`);
  
  // ボタンの状態を更新
  try {
    const dailyButton = document.querySelector('.toggle-option.daily');
    const monthlyButton = document.querySelector('.toggle-option.monthly');
    
    if (dailyButton && monthlyButton) {
      dailyButton.classList.toggle('active', mode === 'daily');
      monthlyButton.classList.toggle('active', mode === 'monthly');
      console.log('ボタンの状態を更新しました');
    } else {
      console.error('トグルボタン要素が見つかりません');
    }
  } catch (e) {
    console.error('ボタン状態更新中にエラー:', e);
  }

  // 重要: URLを更新する処理
  try {
    // 現在のツリー状態を取得
    var treeState = saveTreeState();
    var viewModeParam = mode;
    
    // ハッシュフラグメントの生成
    var hashFragment = '';
    var stateParam = '';
    
    if (treeState && Object.keys(treeState).length > 0) {
      stateParam = generateStateParam(treeState);
    }
    
    // 表示モードを必ず含める
    if (stateParam) {
      hashFragment = '#state=' + stateParam + '&viewMode=' + viewModeParam;
    } else {
      hashFragment = '#viewMode=' + viewModeParam;
    }
    
    console.log('生成されたURLハッシュ:', hashFragment);
    
    // ブラウザのURL更新
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, document.title, hashFragment);
      console.log('URLを更新しました');
    }
    
    // _shareUrlをリセットして新しいモードで再生成されるように
    window._shareUrl = null;
  } catch (urlError) {
    console.error('URL更新中にエラー:', urlError);
  }
  
  // URLを更新し、現在の状態を反映させる
  window.history.replaceState({}, '', hashFragment);
  console.log('ハッシュを更新しました:', hashFragment);
  
  // カレンダーの日付リンクを更新
  // モード切替後に既存のカレンダー日付リンクを更新する
  try {
    // カレンダーの日付リンクを取得
    const calendarLinks = document.querySelectorAll('.calendar-day a');
    if (calendarLinks && calendarLinks.length > 0) {
      // 各日付リンクのURLを更新
      calendarLinks.forEach(function(link) {
        if (link.href) {
          const urlObj = new URL(link.href);
          
          // 既存のviewModeパラメータを削除
          urlObj.searchParams.delete('viewMode');
          
          // 新しいモードを設定
          urlObj.searchParams.set('viewMode', mode);
          
          // URLを更新
          link.href = urlObj.toString();
        }
      });
    }
  } catch (e) {
    console.error('カレンダーリンク更新エラー:', e);
  }
  
  // 全てのノードの値を更新
  updateAllNodeValues();
  
  // 日付表示を更新
  updateDateDisplay(mode);
  
  // コンソールで簡単に確認できるようにログを出力
  console.log('■■■ switchViewMode処理完了');
}

/**
 * 表示モードに応じて日付表示を更新する
 * @param {string} mode - 表示モード ('daily' または 'monthly')
 */
function updateDateDisplay(mode) {
  // 日付表示要素を取得
  const dateDisplay = document.querySelector('.data-date');
  if (!dateDisplay) {
    console.warn('日付表示要素が見つかりません');
    return;
  }
  
  // 現在の日付表示テキストを取得
  const currentText = dateDisplay.textContent;
  
  // 「現在のデータ: 」の後に来るテキストを抽出
  const prefixPattern = /現在のデータ: /;
  let mainContent = currentText.replace(prefixPattern, '');
  
  // 追加情報を折り返し文字や特殊文字で分割して抽出
  let additionalInfo = '';
  let dateContent = mainContent;
  
  // 「/」や「～」などで分割されている場合
  if (mainContent.includes('/')) {
    const parts = mainContent.split('/');
    dateContent = parts[0].trim();
    additionalInfo = '/' + parts.slice(1).join('/');
  } else if (mainContent.includes('～')) { // 月次モードの場合
    // 月初～指定日付の形式から指定日付部分を抽出
    const parts = mainContent.split('～');
    if (parts.length > 1) {
      dateContent = parts[1].trim();
    }
    
    // さらに追加情報がある場合は抽出
    if (dateContent.includes('/')) {
      const moreParts = dateContent.split('/');
      dateContent = moreParts[0].trim();
      additionalInfo = '/' + moreParts.slice(1).join('/');
    }
  }
  
  // 日付部分を抽出するパターン
  const datePattern = /\d{4}年\d{2}月\d{2}日/;
  const dateMatch = dateContent.match(datePattern);
  
  if (!dateMatch) {
    console.warn('日付パターンが見つかりません:', dateContent);
    return;
  }
  
  const dateStr = dateMatch[0]; // 例: '2025年05月21日'
  
  // 日付を分解
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(5, 7);
  const day = dateStr.substring(8, 10);
  
  let newDateDisplay = '';
  
  // モードに応じて日付表示を変更
  if (mode === 'monthly') {
    // 月次モード: 「月初～指定日付」の形式
    newDateDisplay = `現在のデータ: ${year}年${month}月01日～${year}年${month}月${day}日`;
  } else {
    // 日次モード: 元の日付表示を維持
    newDateDisplay = `現在のデータ: ${dateStr}`;
  }
  
  // 日付表示を更新
  dateDisplay.textContent = newDateDisplay + additionalInfo;
  console.log('日付表示を更新しました:', mode, newDateDisplay + additionalInfo);
}

/**
 * 差分値に応じて適切なスタイルを適用する
 * @param {HTMLElement} element - スタイルを適用する要素
 * @param {string} diffValue - 差分値
 */
function updateDiffStyle(element, diffValue) {
  // まず既存のスタイルクラスを削除
  element.classList.remove('diff-positive', 'diff-negative', 'diff-neutral');
  
  if (!diffValue) return;
  
  // 日次モードか月次モードかを判定
  const isMonthly = element.textContent.includes('前月比');
  
  // 数値化する前に文字列を整形
  let valueStr = diffValue.toString().trim();
  // 「+」記号が付いているかチェック
  const isPositive = valueStr.startsWith('+');
  
  // 付いている場合は削除して値を取り出す
  if (isPositive) {
    valueStr = valueStr.substring(1);
  }
  
  // パーセント値を取り扱う場合
  const isPercent = valueStr.endsWith('%');
  if (isPercent) {
    valueStr = valueStr.replace('%', '');
  }
  
  // 数値化して比較
  const numValue = parseFloat(valueStr);
  
  if (isNaN(numValue)) {
    // 数値でない場合はデフォルトスタイル
    element.classList.add('diff-neutral');
    return;
  }
  
  // 月次モードと日次モードで条件を変える
  if (isMonthly) {
    // 月次モード: 100%以上なら緑、100%未満なら赤
    if (numValue >= 100) {
      element.classList.add('diff-positive');
    } else {
      element.classList.add('diff-negative');
    }
  } else {
    // 日次モード: プラス値は緑、マイナス値は赤
    if (isPositive || numValue > 0) {
      element.classList.add('diff-positive');
    } else if (numValue < 0) {
      element.classList.add('diff-negative');
    } else {
      element.classList.add('diff-neutral');
    }
  }
}

/**
 * 日次/月次切り替えボタンのイベントリスナーを設定する
 */
function setupViewModeToggle() {
  // ボタン要素を取得
  const dailyBtn = document.getElementById('daily-mode-btn');
  const monthlyBtn = document.getElementById('monthly-mode-btn');
  const modeIndicator = document.querySelector('.mode-indicator');
  
  if (!dailyBtn || !monthlyBtn || !modeIndicator) {
    console.error('表示モード切り替え要素が見つかりません:', {
      dailyBtn: !!dailyBtn,
      monthlyBtn: !!monthlyBtn,
      modeIndicator: !!modeIndicator
    });
    return;
  }
  
  // 初期化時に正しいモードを選択状態にする
  if (window._viewMode === 'daily') {
    // 日次モードの場合
    modeIndicator.style.transform = 'translateX(0)';
    dailyBtn.classList.add('active');
    monthlyBtn.classList.remove('active');
  } else if (window._viewMode === 'monthly') {
    // 月次モードの場合
    modeIndicator.style.transform = 'translateX(67px)';
    dailyBtn.classList.remove('active');
    monthlyBtn.classList.add('active');
  }
  
  console.log('現在のモード:', window._viewMode);
  
  // 日次ボタンのクリックイベント
  dailyBtn.addEventListener('click', function() {
    console.log('日次モードに切り替え');
    modeIndicator.style.transform = 'translateX(0)';
    dailyBtn.classList.add('active');
    monthlyBtn.classList.remove('active');
    switchViewMode('daily');
  });
  
  // 月次ボタンのクリックイベント
  monthlyBtn.addEventListener('click', function() {
    console.log('月次モードに切り替え');
    modeIndicator.style.transform = 'translateX(67px)';
    dailyBtn.classList.remove('active');
    monthlyBtn.classList.add('active');
    switchViewMode('monthly');
  });
  
  console.log('表示モード切り替えリスナーを設定しました');
}

/**
 * 初回ページ読み込み時に前日比・前月比の色を適用する
 */
function applyInitialDiffStyles() {
  // 現在のモードをグローバル変数から取得
  const currentMode = window._viewMode || 'daily';
  console.log('ページ読み込み時の表示モード:', currentMode);
  
  // 全ての差分表示要素を取得
  const diffElements = document.querySelectorAll('.diff-value');
  
  diffElements.forEach(element => {
    // 初期化前に既存のクラスを削除
    element.classList.remove('diff-positive', 'diff-negative', 'diff-neutral');
    
    // データ属性から値を取得
    const diffDaily = element.getAttribute('data-diff-daily');
    const diffMonthly = element.getAttribute('data-diff-monthly');
    
    // HTML構造を修正
    if (currentMode === 'daily' && diffDaily) {
      // 数値変換
      let numValue = parseFloat(diffDaily);
      let displayValue = diffDaily;
      
      // プラスの値に「+」を付ける
      if (numValue > 0 && !displayValue.toString().startsWith('+')) {
        displayValue = '+' + displayValue;
      }
      
      // HTML再構築
      element.innerHTML = `
        <span class="diff-label">前日比: </span>
        <span class="diff-number">${displayValue}</span>
      `;
      
      // スタイルクラスを適用
      if (numValue > 0) {
        element.classList.add('diff-positive');
      } else if (numValue < 0) {
        element.classList.add('diff-negative');
      } else {
        element.classList.add('diff-neutral');
      }
    } else if (currentMode === 'monthly' && diffMonthly) {
      // パーセント削除して数値化
      let displayValue = diffMonthly;
      let numValue = parseFloat(displayValue.toString().replace('%', ''));
      
      // パーセントがない場合は付ける
      if (!displayValue.toString().endsWith('%')) {
        displayValue = displayValue + '%';
      }
      
      // プラスの値には「+」を、マイナスの値には「-」を付けるようにする
      if (numValue > 100 && !displayValue.toString().startsWith('+')) {
        displayValue = '+' + displayValue;
      } else if (numValue < 100 && !displayValue.toString().startsWith('-')) {
        // パーセント値を一時的に取り外す
        let tempValue = displayValue;
        if (tempValue.endsWith('%')) {
          tempValue = tempValue.slice(0, -1);
        }
        // マイナス記号を追加して再度パーセント記号を付ける
        displayValue = '-' + tempValue + '%';
      }
      
      // HTML再構築
      element.innerHTML = `
        <span class="diff-label">前月比: </span>
        <span class="diff-number">${displayValue}</span>
      `;
      
      // スタイルクラスを適用
      if (numValue >= 100) {
        element.classList.add('diff-positive');
      } else {
        element.classList.add('diff-negative');
      }
    }
  });
}

/**
 * 全てのノードの値を現在のモードに応じて更新
 */
function updateAllNodeValues() {
  // 現在の表示モードを確認
  const currentMode = window._viewMode || 'daily'; // デフォルトは日次
  console.log('現在の表示モード:', currentMode);
  
  // 全ノードを取得
  const allNodes = document.querySelectorAll('.node');
  console.log('ノード値の更新 - モード:', currentMode, 'ノード数:', allNodes.length);
  
  // 値が変更されたノード数を記録
  let changedNodes = 0;
  let missingValueNodes = 0;
  let unchangedFixedNodes = 0;
  
  allNodes.forEach((node, index) => {
    // 値を表示する要素を取得
    const valueElement = node.querySelector('.value');
    if (!valueElement) {
      // console.log(`ノード#${index}: .value要素が見つかりません`);
      return;
    }
    
    // 前日比・前月比の要素を取得
    const diffElement = node.querySelector('.diff-value');
    if (diffElement) {
      // 表示モードに応じて差分表示を切り替え
      const diffDaily = diffElement.getAttribute('data-diff-daily');
      const diffMonthly = diffElement.getAttribute('data-diff-monthly');
      
      if (currentMode === 'daily' && diffDaily) {
        // 日次モードの場合は前日比を表示
        let displayValue = diffDaily;
        // 数値に変換
        let numValue = parseFloat(displayValue);
        
        // プラスの値には「+」を付けるようにする
        if (numValue > 0 && !displayValue.toString().startsWith('+')) {
          displayValue = '+' + displayValue;
        }
        
        // HTMLを再構築
        diffElement.innerHTML = `
          <span class="diff-label">前日比: </span>
          <span class="diff-number">${displayValue}</span>
        `;
        diffElement.setAttribute('title', `前日比: ${displayValue}`);
        
        // 親要素にスタイルクラスを適用
        diffElement.classList.remove('diff-positive', 'diff-negative', 'diff-neutral');
        if (numValue > 0) {
          diffElement.classList.add('diff-positive');
        } else if (numValue < 0) {
          diffElement.classList.add('diff-negative');
        } else {
          diffElement.classList.add('diff-neutral');
        }
        
      } else if (currentMode === 'monthly' && diffMonthly) {
        // 月次モードの場合は前月比を表示
        let displayValue = diffMonthly;
        // パーセント文字を削除して数値化
        let numValue = parseFloat(displayValue.toString().replace('%', ''));
        
        // 前月比はスプレッドシートの内容をそのまま表示
        // パーセントがない場合は付ける
        if (!displayValue.toString().endsWith('%')) {
          displayValue = displayValue + '%';
        }
        // 前月比は+や-を自動付加しないようにする
        
        // HTMLを再構築
        diffElement.innerHTML = `
          <span class="diff-label">前月比: </span>
          <span class="diff-number">${displayValue}</span>
        `;
        diffElement.setAttribute('title', `前月比: ${displayValue}`);
        
        // 100%を基準に色分け
        diffElement.classList.remove('diff-positive', 'diff-negative', 'diff-neutral');
        if (numValue >= 100) {
          diffElement.classList.add('diff-positive');
        } else {
          diffElement.classList.add('diff-negative');
        }
      }
    }
    
    // 各モードの値を取得 - .value要素から直接取得するように修正
    const dailyValue = valueElement.getAttribute('data-value-daily');
    const monthlyValue = valueElement.getAttribute('data-value-monthly');
    const defaultValue = valueElement.getAttribute('data-value-default');
    
    // デバッグ用に最初の数ノードの情報を表示
    if (index < 3) {
      console.log(`ノード#${index} ID:${node.id} 属性確認:`, {
        現在表示値: valueElement.textContent,
        daily属性: dailyValue,
        monthly属性: monthlyValue,
        default属性: defaultValue,
        切替可能か: !!(dailyValue && monthlyValue)
      });
    }
    
    // 属性が設定されているか確認
    if (!dailyValue && !monthlyValue && !defaultValue) {
      missingValueNodes++;
      // どの属性もない場合はスキップ
      return;
    }
    
    const oldValue = valueElement.textContent;
    let newValue = oldValue; // デフォルトは現在の値を維持
    
    // dailyとmonthlyの両方が設定されている場合のみ切替えの対象にする
    if (dailyValue && monthlyValue) {
      // 現在のモードに応じて値を設定
      if (window._viewMode === 'daily') {
        newValue = dailyValue;
      } else if (window._viewMode === 'monthly') {
        newValue = monthlyValue;
      }
    } else {
      // valueのみ設定されているノードは常にその値を表示
      if (defaultValue) {
        newValue = defaultValue;
        unchangedFixedNodes++;
      }
    }
    
    // 値が変更された場合のみ更新
    if (oldValue !== newValue) {
      valueElement.textContent = newValue;
      changedNodes++;
    }
    
    // 日本語テキストの切り替え処理を追加
    const textElement = node.querySelector('.node-text');
    if (textElement) {
      // 月次モードでtext_monthly属性があれば切り替え
      const textMonthly = textElement.getAttribute('data-text-monthly');
      const textDaily = textElement.getAttribute('data-text-daily');
      const textDefault = textElement.getAttribute('data-text-default');
      
      if (currentMode === 'monthly' && textMonthly) {
        // 月次モードで月次テキストがあれば表示
        textElement.textContent = textMonthly;
        textElement.setAttribute('title', textMonthly);
        changedNodes++;
      } else if (currentMode === 'daily' && textDaily) {
        // 日次モードで日次テキストがあれば表示
        textElement.textContent = textDaily;
        textElement.setAttribute('title', textDaily);
        changedNodes++;
      } else if (textDefault) {
        // デフォルトテキストがあれば表示
        textElement.textContent = textDefault;
        textElement.setAttribute('title', textDefault);
        changedNodes++;
      }
    }
    
    // text_enの切り替え処理を追加
    const textEnElement = node.querySelector('.text-en');
    if (textEnElement) {
      // 月次モードでtext_en_monthly属性があれば切り替え
      const textEnMonthly = textEnElement.getAttribute('data-text-en-monthly');
      const textEnDefault = textEnElement.getAttribute('title'); // title属性に元の値が保存されている
      
      if (currentMode === 'monthly' && textEnMonthly) {
        // 月次モードでtext_en_monthly属性があれば表示
        textEnElement.textContent = textEnMonthly;
        changedNodes++;
      } else if (currentMode === 'daily' && textEnDefault) {
        // 日次モードでは元の英語表記（title属性の値）に戻す
        textEnElement.textContent = textEnDefault;
        changedNodes++;
      }
    }
  });
  
  console.log(`値の更新完了: ${changedNodes}個のノードを更新、${missingValueNodes}個のノードに属性なし、${unchangedFixedNodes}個は固定値`);
}
