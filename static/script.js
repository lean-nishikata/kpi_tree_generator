// KPIツリージェネレーター用JavaScript
// 初期化時に実行される関数
function kpiTreeInit() {
  // グローバル変数の初期化
  window._initialLoadComplete = false;
  window._shareUrl = null;
  
  // リダイレクトパラメータを処理
  handleUrlRedirects();
  
  // 固定で横レイアウトに設定
  setDirection('horizontal');
  
  // 共有ボタンの追加
  addShareButton();
  
  // URLからツリー状態を取得
  var state = getStateFromUrl();
  
  // 状態が空の場合はセッションストレージからそのまま取得を試みる
  if (!state || Object.keys(state).length === 0) {
    try {
      var savedStateParam = sessionStorage.getItem('originalStateParam');
      if (savedStateParam) {
        // 保存されたパラメータから状態をデコード
        var decodedState = decodeURIComponent(savedStateParam.split('.')[0]);
        decodedState = atob(decodedState.replace(/-/g, '+').replace(/_/g, '/'));
        state = JSON.parse(decodedState);
        console.log('セッションストレージから状態を復元:', state);
      }
    } catch (e) {
      console.error('セッションからの状態読み込み失敗:', e);
    }
  }
  
  // ツリー状態を適用
  applyTreeState(state);
  
  // トグルボタンの設定
  setupToggleButtons();
  
  // 共有URLを更新
  setTimeout(updateShareUrl, 500);
  
  // 初期ロード完了フラグをセット
  window._initialLoadComplete = true;
}

// リダイレクト時のパラメータ保持を処理する関数
function handleUrlRedirects() {
  // URLパラメータをセッションストレージに保存する処理
  function saveStateParamToStorage() {
    var urlParams = new URLSearchParams(window.location.search);
    var stateParam = urlParams.get('state');
    
    if (stateParam) {
      try {
        // セッションストレージに保存
        sessionStorage.setItem('originalStateParam', stateParam);
        return true;
      } catch (e) {
        console.error('パラメータの保存に失敗:', e);
      }
    }
    return false;
  }
  
  // Google Storageリダイレクトを検出
  var isGcsRedirect = window.location.href.includes('googleusercontent.com') && 
                     (!document.referrer || document.referrer.includes('storage.cloud.google.com'));
  
  // 1. 最初のアクセス時にパラメータを保存
  if (!isGcsRedirect) {
    saveStateParamToStorage();
  }
  // 2. リダイレクト後なら保存済みパラメータを復元
  else {
    var savedState = sessionStorage.getItem('originalStateParam');
    if (savedState) {
      var currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('state', savedState);
      window.history.replaceState({}, document.title, currentUrl.toString());
      console.log('リダイレクト後にstateパラメータを復元しました:', savedState);
      return true;
    }
  }
  
  return false;
}

// 方向を設定する関数
function setDirection(direction) {
  var treeContainer = document.querySelector('.kpi-tree-container');
  
  // クラスを更新
  treeContainer.classList.remove('direction-vertical');
  treeContainer.classList.remove('direction-horizontal');
  treeContainer.classList.add('direction-' + direction);
  
  // data属性を更新
  document.body.setAttribute('data-direction', direction);
}

// トグルボタンの設定
function setupToggleButtons() {
  // トグルボタンを取得
  var toggleButtons = document.querySelectorAll('.toggle-btn');
  if (!toggleButtons.length) return;
  
  // 保存された状態を読み込む
  var savedStates = loadTreeState();
  
  // 各ボタンにイベントを設定
  toggleButtons.forEach(function(button) {
    var targetId = button.getAttribute('data-target');
    var target = document.getElementById(targetId);
    if (!target) return;
    
    // クリックイベントを設定
    button.onclick = function() {
      target.classList.toggle('collapsed');
      button.classList.toggle('collapsed');
      saveTreeState();
      updateShareUrl();
    };
  });
}

// ツリーの状態を保存
function saveTreeState() {
  var state = {};
  // すべてのトグル可能ノードを取得
  document.querySelectorAll('.children').forEach(function(child) {
    if (child.id) {
      // 明示的にcollapsedまたはexpandedの状態を記録
      state[child.id] = child.classList.contains('collapsed') ? 'collapsed' : 'expanded';
    }
  });
  
  // デフォルト状態と異なるノードのみを取得
  var defaultExpanded = {};
  var filteredState = {};
  var hasChanges = false;
  
  // デフォルト状態はexpanded
  for (var nodeId in state) {
    // collapsedのノードのみを記録する
    if (state[nodeId] === 'collapsed') {
      filteredState[nodeId] = 'collapsed';
      hasChanges = true;
    }
  }
  
  // ローカルストレージに保存
  localStorage.setItem('kpiTreeState', JSON.stringify(state));
  
  // 変更がある場合のみ状態を返す
  return hasChanges ? filteredState : {};
}

// ツリーの状態を読み込む
function loadTreeState() {
  try {
    var savedState = localStorage.getItem('kpiTreeState');
    return savedState ? JSON.parse(savedState) : {};
  } catch (e) {
    return {};
  }
}

// URLパラメータからツリーの状態を取得
function getStateFromUrl() {
  // URLパラメータを確認
  var urlParams = new URLSearchParams(window.location.search);
  var stateParam = urlParams.get('state');
  
  if (!stateParam) {
    // 1. URLから取得できない場合はセッションストレージから取得を試みる
    try {
      var savedStateParam = sessionStorage.getItem('originalStateParam');
      if (savedStateParam) {
        stateParam = savedStateParam;
        console.log('セッションストレージからパラメータを取得:', stateParam);
      } else {
        return {}; // パラメータがなければ空オブジェクトを返す
      }
    } catch (storageError) {
      return {}; // エラー時は空オブジェクトを返す
    }
  } else {
    // 取得したパラメータをセッションに保存
    try {
      sessionStorage.setItem('originalStateParam', stateParam);
    } catch (e) {
      // 保存失敗しても続行
    }
  }
  
  try {
    // ハッシュ部分とデータ部分を分離
    var parts = stateParam.split('.');
    var encodedData = parts[0]; // データ部分
    
    // データ部分をデコード
    var decodedState = decodeURIComponent(encodedData);
    // URL-safe base64を標準base64に変換してデコード
    decodedState = atob(decodedState.replace(/-/g, '+').replace(/_/g, '/'));
    // JSONにパース
    var parsedState = JSON.parse(decodedState);
    
    return parsedState;
  } catch (e) {
    console.error('State decoding error:', e);
    
    // 旧形式のパラメータの場合は直接デコードを試みる
    try {
      var directDecodedState = decodeURIComponent(stateParam);
      directDecodedState = atob(directDecodedState.replace(/-/g, '+').replace(/_/g, '/'));
      var directParsedState = JSON.parse(directDecodedState);
      return directParsedState;
    } catch (directError) {
      return {}; // エラー時は空オブジェクトを返す
    }
  }
}

// ツリー状態をURLパラメータ用にエンコード
function generateStateParam(state) {
  if (!state || Object.keys(state).length === 0) {
    return '';
  }
  
  try {
    // 1. ノードデータの正規化
    var normalizedState = {};
    var nodeIds = Object.keys(state).sort(); // キーをソートして一貫性を確保
    
    // 2. ソートされたキー順に再構築
    for (var i = 0; i < nodeIds.length; i++) {
      var nodeId = nodeIds[i];
      normalizedState[nodeId] = state[nodeId];
    }
    
    // 3. フィンガープリントを生成
    // ノードIDと全体のあり方から一意のハッシュを生成
    var fingerprint = '';
    for (var j = 0; j < nodeIds.length; j++) {
      var id = nodeIds[j];
      var val = state[id];
      fingerprint += id.substring(0, 3) + val.substring(0, 1);
    }
    
    // 4. 状態のチェックサムを計算
    var checksum = 0;
    for (var k = 0; k < fingerprint.length; k++) {
      checksum += fingerprint.charCodeAt(k);
    }
    checksum = checksum % 1000; // 3桁に制限
    
    // 5. 正規化されたJSON文字列に変換
    var jsonString = JSON.stringify(normalizedState);
    
    // 6. Base64にエンコードし、URL安全な形式に変換
    var encoded = btoa(jsonString).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    
    // 7. ユニーク性を確保するハッシュを生成
    var uniqueHash = 's' + checksum + '-n' + nodeIds.length;
    
    // 8. URLエンコード
    return encodeURIComponent(encoded) + '.' + uniqueHash;
  } catch (e) {
    console.error('State encoding error:', e);
    return '';
  }
}

// 共有ボタンを追加する関数
function addShareButton() {
  // ボタンコンテナを作成
  var shareDiv = document.createElement('div');
  shareDiv.className = 'share-control';
  shareDiv.style.position = 'fixed';
  shareDiv.style.top = '10px';
  shareDiv.style.right = '10px';
  shareDiv.style.zIndex = '1000';
  shareDiv.style.background = '#fff';
  shareDiv.style.padding = '5px 10px';
  shareDiv.style.borderRadius = '4px';
  shareDiv.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
  
  // ボタン要素を作成
  var shareButton = document.createElement('button');
  shareButton.id = 'shareButton';
  shareButton.textContent = '現在のURLをコピー';
  shareButton.style.padding = '5px 10px';
  shareButton.style.cursor = 'pointer';
  shareButton.style.backgroundColor = '#4CAF50';
  shareButton.style.color = 'white';
  shareButton.style.border = 'none';
  shareButton.style.borderRadius = '4px';
  shareButton.style.position = 'relative';
  
  // ツールチップ要素
  var tooltip = document.createElement('div');
  tooltip.id = 'shareTooltip';
  tooltip.textContent = '現在のURLをコピーしました';
  tooltip.style.position = 'absolute';
  tooltip.style.top = '100%';
  tooltip.style.left = '50%';
  tooltip.style.transform = 'translateX(-50%)';
  tooltip.style.backgroundColor = '#333';
  tooltip.style.color = 'white';
  tooltip.style.padding = '5px 10px';
  tooltip.style.borderRadius = '4px';
  tooltip.style.fontSize = '12px';
  tooltip.style.whiteSpace = 'nowrap';
  tooltip.style.opacity = '0';
  tooltip.style.transition = 'opacity 0.3s';
  tooltip.style.pointerEvents = 'none';
  tooltip.style.zIndex = '1001';
  shareButton.appendChild(tooltip);
  
  // クリックイベントを設定
  shareButton.onclick = function() {
    copyShareUrlToClipboard();
  };
  
  // DOMに追加
  shareDiv.appendChild(shareButton);
  document.body.appendChild(shareDiv);
}

// ツリー状態が変更されたときにURLを更新
function updateShareUrl() {
  // 現在のツリー状態を取得
  var state = saveTreeState();
  
  // 開閉状態が変更されている場合のみパラメータを生成
  if (state && Object.keys(state).length > 0) {
    var stateParam = generateStateParam(state);
    // クエリパラメータを生成
    var queryString = stateParam ? '?state=' + stateParam : '';
    
    // 共有URLを設定
    if (window._publicBaseUrl) {
      window._shareUrl = window._publicBaseUrl + queryString;
    } else {
      var fileName = window.location.pathname.split('/').pop() || 'index.html';
      window._shareUrl = fileName + queryString;
    }
    
    // ブラウザのURLを更新
    updateBrowserUrl(queryString);
  } else {
    // 変更がない場合はベースURLのみ
    if (window._publicBaseUrl) {
      window._shareUrl = window._publicBaseUrl;
    } else {
      var fileName = window.location.pathname.split('/').pop() || 'index.html';
      window._shareUrl = fileName;
    }
    
    // ブラウザのURLからクエリパラメータを削除
    updateBrowserUrl('');
  }
  
  // コンソールに現在の共有URLを表示
  console.log('Share URL updated:', window._shareUrl);
}

// URLをクリップボードにコピー
function copyShareUrlToClipboard() {
  var shareUrl = window._shareUrl;
  if (!shareUrl) return;
  
  // 完全URLを生成
  var fullUrl;
  if (shareUrl.startsWith('http')) {
    fullUrl = shareUrl;
  } else if (shareUrl.startsWith('?')) {
    fullUrl = window.location.origin + window.location.pathname + shareUrl;
  } else {
    var path = window.location.pathname.split('/');
    path.pop();
    fullUrl = window.location.origin + path.join('/') + '/' + shareUrl;
  }
  
  // クリップボードにコピー
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(fullUrl)
      .then(showCopySuccess)
      .catch(function() {
        fallbackCopyToClipboard(fullUrl);
      });
  } else {
    fallbackCopyToClipboard(fullUrl);
  }
}

// 代替コピー方法
function fallbackCopyToClipboard(text) {
  var tempInput = document.createElement('input');
  tempInput.style.position = 'absolute';
  tempInput.style.left = '-9999px';
  tempInput.value = text;
  document.body.appendChild(tempInput);
  
  tempInput.select();
  var success = document.execCommand('copy');
  document.body.removeChild(tempInput);
  
  if (success) {
    showCopySuccess();
  }
}

// コピー成功表示
function showCopySuccess() {
  var tooltip = document.getElementById('shareTooltip');
  if (!tooltip) return;
  
  tooltip.style.opacity = '1';
  
  setTimeout(function() {
    tooltip.style.opacity = '0';
  }, 1000);
}

// すべてのノードを展開状態にリセット
function resetAllNodes() {
  // すべての子要素とボタンからcollapsedクラスを削除
  document.querySelectorAll('.children').forEach(function(child) {
    child.classList.remove('collapsed');
  });
  
  document.querySelectorAll('.toggle-btn').forEach(function(button) {
    button.classList.remove('collapsed');
  });
}

// ブラウザのURLを更新
function updateBrowserUrl(queryString) {
  if (window.history && window.history.replaceState) {
    try {
      // クエリ文字列だけを更新
      window.history.replaceState({}, document.title, queryString);
      
      // 状態をセッションに保存
      var state = saveTreeState();
      if (Object.keys(state).length > 0) {
        sessionStorage.setItem('kpiTreeState', JSON.stringify(state));
      }
    } catch (e) {
      // URL更新失敗の場合は無視
    }
  }
}

// リダイレクト時のURLパラメータを処理
function handleRedirectParams() {
  var urlParams = new URLSearchParams(window.location.search);
  var hasStateParam = urlParams.has('state');
  
  // 状態パラメータがない場合は何もしない
  if (!hasStateParam) return false;
  
  // 状態パラメータを取得
  var stateParam = urlParams.get('state');
  
  // オリジナルパラメータをグローバル変数に保存
  try {
    window._originalStateParam = stateParam;
  } catch (e) {
    // エラー時は無視
  }

  // 公開URLが設定されている場合
  if (window._publicBaseUrl) {
    // URLが.htmlで終わっていない場合は修正
    if (!window._publicBaseUrl.toLowerCase().endsWith('.html')) {
      if (!window._publicBaseUrl.endsWith('/')) {
        window._publicBaseUrl += '/';
      }
      window._publicBaseUrl += 'index.html';
    }
  }
  
  return false;
}

// ツリー状態を適用
function applyTreeState(state) {
  if (!state || Object.keys(state).length === 0) return;
  
  // まずすべてのノードを展開状態にリセット
  resetAllNodes();
  
  // 各ノードに状態を適用
  for (var nodeId in state) {
    var nodeState = state[nodeId];
    var node = document.getElementById(nodeId);
    
    // 関連するトグルボタンを探す
    var button = null;
    document.querySelectorAll('.toggle-btn').forEach(function(btn) {
      if (btn.getAttribute('data-target') === nodeId) {
        button = btn;
      }
    });
    
    // ノードとボタンの両方が存在する場合のみ状態を適用
    if (node && button) {
      if (nodeState === 'collapsed') {
        node.classList.add('collapsed');
        button.classList.add('collapsed');
      } else if (nodeState === 'expanded') {
        node.classList.remove('collapsed');
        button.classList.remove('collapsed');
      }
    }
  }
  
  // 状態をローカルストレージに保存
  saveTreeState();
  
  // 初期化完了を記録
  window._initialLoadComplete = true;
}

// Capture state parameter before DOMContentLoaded
(function() {
  try {
    // ページが実際にロードされる前に状態パラメータを保存
    var urlParams = new URLSearchParams(window.location.search);
    var stateParam = urlParams.get('state');
    if (stateParam) {
      window._originalStateParam = stateParam;
      if (window.sessionStorage) {
        sessionStorage.setItem('originalStateParam', stateParam);
        console.log('Early state parameter capture success');
      }
    }
  } catch (e) {
    console.error('Early state parameter capture failed:', e);
  }
})();

// ページURLを監視して変更を検出
function monitorUrlChanges() {
  var lastUrl = window.location.href;
  setInterval(function() {
    if (lastUrl !== window.location.href) {
      console.log('URL changed from', lastUrl, 'to', window.location.href);
      lastUrl = window.location.href;
      
      // Googleストレージへのリダイレクトをチェック
      if (window.location.href.includes('googleusercontent.com')) {
        console.log('Google Storage redirect detected');
        var savedState = sessionStorage.getItem('originalStateParam');
        if (savedState) {
          // リダイレクト後は状態を復元
          var state = getStateFromUrl();
          applyTreeState(state);
        }
      }
    }
  }, 500); // 500ms間隔で確認
}

// Run initialization when page is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM content loaded, initializing KPI tree');
  
  // URL監視を開始
  monitorUrlChanges();
  
  // KPIツリーの動作を初期化
  kpiTreeInit();
  
  // 通常のURL処理（リダイレクト処理されていない場合のみ）
  if (!redirectHandled) {
    // URLからツリー状態を取得して適用
    var state = getStateFromUrl();
    
    if (Object.keys(state).length > 0) {
      console.log('Applying state from URL');
      // DOM完全読み込み後に適用を確実に実行
      if (document.readyState === 'loading') {
        console.log('DOM still loading, deferring state application');
        document.addEventListener('DOMContentLoaded', function() {
          console.log('DOM now loaded, applying state');
          setTimeout(function() {
            applyTreeState(state);
          }, 100); // 少し遅延させて確実に適用
        });
      } else {
        // 少し遅延させてツリー状態を適用
        setTimeout(function() {
          applyTreeState(state);
        }, 100);
      }
    }
  }
  
  // 分析ボタン追加
  addShareButton();
  
  // 初期ロード完了フラグをセット
  window._initialLoadComplete = true;
  
  console.log('KPI tree initialization complete');
});

// 最初のページロード時にオリジナルのstateパラメータを保存する関数
function saveOriginalStateParam() {
  // URLの生のパラメータを取得（リダイレクト前に実行）
  var fullUrl = window.location.href;
  var stateIndex = fullUrl.indexOf('state=');
  var urlParams = new URLSearchParams(window.location.search);
  var stateFromParams = urlParams.get('state');
  
  // 状態パラメータを取得する複数の方法を試す
  if (stateFromParams) {
    // 1. 標準のURLSearchParamsで取得できた場合
    window._originalStateParam = stateFromParams;
    console.log('Original state parameter saved from URLSearchParams:', window._originalStateParam);
  } else if (stateIndex !== -1) {
    // 2. パラメータが見つからない場合、URL全体から探索
    var stateSubstring = fullUrl.substring(stateIndex + 6); // 'state='.length = 6
    
    // 次のパラメータがある場合は&までを取得、なければ最後まで
    var nextParamIndex = stateSubstring.indexOf('&');
    if (nextParamIndex !== -1) {
      window._originalStateParam = stateSubstring.substring(0, nextParamIndex);
    } else {
      window._originalStateParam = stateSubstring;
    }
    
    console.log('Original state parameter saved from URL string:', window._originalStateParam);
  }
  
  // オリジナルの状態パラメータが見つかった場合、セッションストレージに保存
  if (window._originalStateParam) {
    // セッションストレージにストリングとして保存
    try {
      // オリジナルパラメータを保存
      sessionStorage.setItem('originalStateParam', window._originalStateParam);
      console.log('Original state param saved to session storage');
      
      // デコードしたオブジェクトも保存しておく
      try {
        var decodedState = decodeURIComponent(window._originalStateParam);
        decodedState = atob(decodedState.replace(/-/g, '+').replace(/_/g, '/'));
        var parsedState = JSON.parse(decodedState);
        
        // オブジェクト状態を保存
        sessionStorage.setItem('kpiTreeState', JSON.stringify(parsedState));
        console.log('Decoded state object saved to session storage');
      } catch (decodeError) {
        console.warn('Could not decode original state parameter:', decodeError);
      }
    } catch (e) {
      console.warn('Could not save original state to sessionStorage:', e);
    }
  } else {
    console.log('No state parameter found in original URL');
  }
}

// デバッグ用：URLパラメータの変更を監視
window.addEventListener('popstate', function(event) {
  console.log('URL changed, reloading state from URL');
  // ページをリロードせずに状態を更新
  var urlStates = getStateFromUrl();
  if (Object.keys(urlStates).length > 0) {
    console.log('Applying new states from URL');
    resetAllNodes();
    
    // 各ノードに状態を適用
    for (var nodeId in urlStates) {
      var target = document.getElementById(nodeId);
      var button = document.querySelector('[data-target="' + nodeId + '"]');
      
      if (target && button && urlStates[nodeId] === 'collapsed') {
        target.classList.add('collapsed');
        button.classList.add('collapsed');
      }
    }
  }
});

