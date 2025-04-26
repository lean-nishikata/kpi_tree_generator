// KPI Tree JavaScript
// Using old-school function approach to ensure maximum browser compatibility
function kpiTreeInit() {
  // 初期化開始を記録
  var initTime = new Date().toISOString();
  console.log('KPI Tree initializing at ' + initTime);
  console.log('URL:', window.location.href);
  
  // デバッグモード関連のコードを削除しました
  
  // 公開URL情報があればグローバル変数に保存
  if (window.PUBLIC_URL) {
    window._publicBaseUrl = window.PUBLIC_URL;
    console.log('Public URL set from config:', window._publicBaseUrl);
  }
  
  // 常に横型レイアウトを使用
  var theme = document.body.getAttribute('data-theme') || 'default';
  var direction = 'horizontal';
  
  console.log('KPI Tree initializing with direction:', direction);
  
  // 方向を設定
  setDirection(direction);
  
  // Add share button for permanent link
  addShareButton();
  
  // リダイレクト時のURLパラメータを処理（最初に処理）
  var redirectStateApplied = handleRedirectParams();
  
  // リダイレクト処理で状態が適用されなかった場合のみURLから復元
  if (!redirectStateApplied) {
    // URLパラメータから状態を取得
    var stateFromUrl = getStateFromUrl();
    console.log('State from URL:', stateFromUrl);
    
    // ノードの状態を復元（URLパラメータから）
    applyTreeState(stateFromUrl);
  }
  
  // DOMContentLoadedイベントが発火した後にセットアップを行う
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      // Initialize toggle buttons
      setupToggleButtons();
      
      // 初期化後、最初のリンクを生成
      setTimeout(function() {
        updateShareUrl();
      }, 500); // 初期化後に遅延実行
    });
  } else {
    // すでにDOMContentLoadedイベントが発火している場合は直接実行
    setupToggleButtons();
    
    // URLパラメータがない場合のみURLを更新
    var urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.has('state')) {
      // 初期化後にシェアURLを更新
      setTimeout(function() {
        updateShareUrl();
      }, 500);
    }
  }
}

// 方向は常に横型に固定
function getDirectionFromUrl() {
  // 常に横型レイアウトを返す
  return 'horizontal';
}

// 方向を設定する関数
function setDirection(direction) {
  var treeContainer = document.querySelector('.kpi-tree-container');
  var body = document.body;
  
  // Remove old direction class
  treeContainer.classList.remove('direction-vertical');
  treeContainer.classList.remove('direction-horizontal');
  
  // Add new direction class
  treeContainer.classList.add('direction-' + direction);
  
  // Update data attribute
  body.setAttribute('data-direction', direction);
}

// Handle toggle buttons for collapsing/expanding nodes
function setupToggleButtons() {
  console.log('Setting up toggle buttons');
  
  // Get all toggle buttons
  var toggleButtons = document.querySelectorAll('.toggle-btn');
  console.log('Found toggle buttons:', toggleButtons.length);
  
  // First check URL parameters for state
  var urlStates = getStateFromUrl();
  console.log('URL states:', urlStates);
  
  // If no URL parameters, load from localStorage
  var savedStates = Object.keys(urlStates).length > 0 ? urlStates : loadTreeState();
  console.log('Using states:', savedStates);
  
  // ツリーの状態を適用する前に、まずすべてのノードを展開状態にする
  resetAllNodes();
  
  // ノードIDとボタンのマッピングを作成
  var buttonMap = {};
  var targetMap = {};
  
  // Initialize toggle buttons
  for (var i = 0; i < toggleButtons.length; i++) {
    var button = toggleButtons[i];
    var targetId = button.getAttribute('data-target');
    var target = document.getElementById(targetId);
    
    if (!target) {
      console.error('Target element not found:', targetId);
      continue;
    }
    
    // マッピングを保存
    buttonMap[targetId] = button;
    targetMap[targetId] = target;
    
    console.log('Checking state for:', targetId, 'State:', savedStates[targetId]);
    
    // Apply saved state if exists
    if (savedStates[targetId] === 'collapsed') {
      console.log('Collapsing:', targetId);
      target.classList.add('collapsed');
      button.classList.add('collapsed');
    }
    // 展開状態の場合は、既にresetAllNodes()で展開済み
    
    // Use closure to maintain button and target references
    (function(btn, tgt) {
      btn.onclick = function() {
        console.log('Toggle button clicked for:', tgt.id);
        tgt.classList.toggle('collapsed');
        btn.classList.toggle('collapsed');
        saveTreeState();
        updateShareUrl();
      };
    })(button, target);
  }
}

// レイアウト切り替え機能は削除されました
function addDirectionToggle(initialDirection) {
  // 横型レイアウトに固定されているため、何もしない
  console.log('Direction toggle removed, using horizontal layout only');
  return;
}

// Save tree state to localStorage
function saveTreeState() {
  var state = {};
  var children = document.querySelectorAll('.children');
  
  for (var i = 0; i < children.length; i++) {
    var child = children[i];
    if (child.id) {
      state[child.id] = child.classList.contains('collapsed') ? 'collapsed' : 'expanded';
    }
  }
  
  localStorage.setItem('kpiTreeState', JSON.stringify(state));
  return state;
}

// Load tree state from localStorage
function loadTreeState() {
  var savedState = localStorage.getItem('kpiTreeState');
  return savedState ? JSON.parse(savedState) : {};
}

// Get state from URL parameters
function getStateFromUrl() {
  var stateParam;
  var sessionState = sessionStorage.getItem('kpiTreeState');
  
  console.log('Getting state from URL...');
  
  // 1. セッションにすでにパース済みの状態があれば優先使用
  if (sessionState) {
    try {
      var parsedSessionState = JSON.parse(sessionState);
      console.log('Found parsed state in session storage, using it directly');
      return parsedSessionState;
    } catch (e) {
      console.warn('Error parsing session state, falling back to URL params', e);
      // セッション状態のパースに失敗した場合は、次の方法を使用
    }
  }
  
  // 2. オリジナルパラメータが保存されていれば、それを使用
  if (window._originalStateParam) {
    stateParam = window._originalStateParam;
    console.log('Using original state parameter from window object:', stateParam);
  }
  // 3. セッションストレージにオリジナルパラメータがあれば使用
  else if (sessionStorage.getItem('originalStateParam')) {
    stateParam = sessionStorage.getItem('originalStateParam');
    console.log('Using original state parameter from session storage:', stateParam);
  }
  // 4. 通常のURLSearchParamsを試す
  else {
    var urlParams = new URLSearchParams(window.location.search);
    stateParam = urlParams.get('state');
    console.log('Using state parameter from URLSearchParams:', stateParam);
    
    // 5. それでもなければURL全体からstate=を抽出
    if (!stateParam) {
      var fullUrl = window.location.href;
      var stateIndex = fullUrl.indexOf('state=');
      
      if (stateIndex !== -1) {
        var stateSubstring = fullUrl.substring(stateIndex + 6); // 'state='.length = 6
        
        var nextParamIndex = stateSubstring.indexOf('&');
        if (nextParamIndex !== -1) {
          stateParam = stateSubstring.substring(0, nextParamIndex);
        } else {
          stateParam = stateSubstring;
        }
        
        console.log('Found state parameter in full URL string:', stateParam);
      }
    }
  }
  
  if (!stateParam) {
    console.log('No state parameter found using any method, returning empty state');
    return {};
  }
  
  try {
    // URLデコード後、URL-safe base64 decode
    console.log('Processing state param:', stateParam);
    
    var decodedState = decodeURIComponent(stateParam);
    console.log('URL decoded state:', decodedState);
    
    decodedState = atob(decodedState.replace(/-/g, '+').replace(/_/g, '/'));
    console.log('Base64 decoded state:', decodedState);
    
    var parsedState = JSON.parse(decodedState);
    console.log('Parsed state:', parsedState);
    
    // レイアウト状態のDOMIDsの存在を確認
    var existingNodeCount = 0;
    var totalNodeCount = 0;
    
    for (var nodeId in parsedState) {
      totalNodeCount++;
      var element = document.getElementById(nodeId);
      if (!element) {
        console.warn('Node ID from URL not found in DOM:', nodeId);
      } else {
        existingNodeCount++;
        console.log('Node ID from URL found in DOM:', nodeId, 'State:', parsedState[nodeId]);
      }
    }
    
    console.log(`Found ${existingNodeCount} of ${totalNodeCount} nodes in the DOM`);
    
    // 復元した状態をセッションストレージに保存
    if (Object.keys(parsedState).length > 0) {
      sessionStorage.setItem('kpiTreeState', JSON.stringify(parsedState));
      console.log('State saved to session storage for future reference');
      
      try {
        localStorage.setItem('kpiTreeStateDebug', JSON.stringify(parsedState));
        console.log('State also saved to local storage for debug purposes');
      } catch (e) {
        console.warn('Could not save state to localStorage:', e);
      }
    }
    
    return parsedState;
  } catch (e) {
    console.error('Error parsing state from URL parameter:', e);
    return {};
  }
}

// Generate URL-safe state parameter
function generateStateParam(state) {
  // URL-safe base64 encode
  var encoded = btoa(JSON.stringify(state)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  // URLエンコード
  return encodeURIComponent(encoded);
}

// Add share button for permanent link
function addShareButton() {
  var shareDiv = document.createElement('div');
  shareDiv.className = 'share-control';
  shareDiv.style.position = 'fixed';
  shareDiv.style.top = '10px'; // 右上に配置
  shareDiv.style.right = '10px';
  shareDiv.style.zIndex = '1000';
  shareDiv.style.background = '#fff';
  shareDiv.style.padding = '5px 10px';
  shareDiv.style.borderRadius = '4px';
  shareDiv.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
  shareDiv.style.display = 'flex'; // フレックスボックスを使用
  shareDiv.style.alignItems = 'flex-start'; // 上詰め
  
  var shareButton = document.createElement('button');
  shareButton.id = 'shareButton';
  shareButton.textContent = '現在のURLをコピー';
  shareButton.style.padding = '5px 10px';
  shareButton.style.cursor = 'pointer';
  shareButton.style.backgroundColor = '#4CAF50';
  shareButton.style.color = 'white';
  shareButton.style.border = 'none';
  shareButton.style.borderRadius = '4px';
  shareButton.style.position = 'relative'; // ツールチップの配置のため
  shareButton.style.overflow = 'hidden'; // エフェクトのため
  
  // ボタン内にチェックマークアニメーション用の要素を追加
  var checkmark = document.createElement('span');
  checkmark.id = 'checkmarkEffect';
  checkmark.style.position = 'absolute';
  checkmark.style.width = '20px';
  checkmark.style.height = '20px';
  checkmark.style.top = '50%';
  checkmark.style.left = '50%';
  checkmark.style.transform = 'translate(-50%, -50%) scale(0)';
  checkmark.style.opacity = '0';
  checkmark.style.transition = 'transform 0.3s, opacity 0.3s';
  checkmark.style.pointerEvents = 'none'; // クリックイベントを通過
  
  // SVGチェックマークを作成
  var svgNS = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.style.fill = 'none';
  svg.style.stroke = 'white';
  svg.style.strokeWidth = '3';
  svg.style.strokeLinecap = 'round';
  svg.style.strokeLinejoin = 'round';
  
  var path = document.createElementNS(svgNS, 'path');
  path.setAttribute('d', 'M20 6L9 17l-5-5');
  svg.appendChild(path);
  checkmark.appendChild(svg);
  
  shareButton.appendChild(checkmark);
  
  // Add event listener
  shareButton.onclick = function(e) {
    // チェックマークアニメーションを表示
    var checkmark = document.getElementById('checkmarkEffect');
    
    // チェックマークを表示
    checkmark.style.transform = 'translate(-50%, -50%) scale(1)';
    checkmark.style.opacity = '1';
    
    // ボタンのテキストを一時的に非表示
    var originalText = shareButton.textContent;
    shareButton.style.color = 'rgba(255, 255, 255, 0)';
    
    // アニメーションが終わったらリセット
    setTimeout(function() {
      checkmark.style.transform = 'translate(-50%, -50%) scale(0)';
      checkmark.style.opacity = '0';
      shareButton.style.color = 'white';
    }, 1000);
    
    // URLをコピー
    copyShareUrlToClipboard();
  };
  
  // ツールチップ要素を作成
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
  
  // Append to share div
  shareDiv.appendChild(shareButton);
  
  // 共有ボタンを追加
  document.body.appendChild(shareDiv);
  
  // Initialize share URL
  updateShareUrl();
}

// Update share URL when tree state changes
function updateShareUrl() {
  var state = saveTreeState();
  var stateParam = generateStateParam(state);
  
  // クエリ文字列を構築
  var queryString = '?state=' + stateParam;
  
  // 公開URLが設定されているか確認
  var baseUrl = '';
  if (window._publicBaseUrl) {
    // 設定ファイルから読み込んだ公開URLを使用
    baseUrl = window._publicBaseUrl;
    console.log('Using public URL from config:', baseUrl);
    
    // 公開URLにパラメータを追加
    window._shareUrl = baseUrl + queryString;
  } else {
    // GCSと互換性のある方法でURLを構築
    // ファイル名のみを取得（パス情報なし）
    var fileName = window.location.pathname.split('/').pop();
    if (!fileName) {
      fileName = 'index.html'; // デフォルト
    }
    
    // 相対パスを使用
    window._shareUrl = fileName + queryString;
  }
  
  console.log('Share URL updated:', window._shareUrl);
  
  // 現在のURLパラメータをチェック
  var currentUrlParams = new URLSearchParams(window.location.search);
  var hasStateParam = currentUrlParams.has('state');
  
  // 初期ロード時にURLパラメータがある場合は更新しない
  if (window._initialLoadComplete || !hasStateParam) {
    // ブラウザのURLを動的に更新
    updateBrowserUrl(queryString);
  } else {
    console.log('Skipping URL update on initial load with state parameters');
  }
}

// Copy share URL to clipboard
function copyShareUrlToClipboard() {
  var shareUrl = window._shareUrl;
  
  if (!shareUrl) {
    console.error('No share URL available');
    return;
  }
  
  // 完全なURLを構築（可能な場合）
  var fullUrl;
  if (shareUrl.startsWith('http')) {
    // すでに完全URLの場合
    fullUrl = shareUrl;
  } else {
    // ドメイン部分を追加
    var baseUrl = window.location.origin;
    var pathParts = window.location.pathname.split('/');
    pathParts.pop(); // ファイル名を削除
    var currentPath = pathParts.join('/');
    
    // GCSのURLパスを保持するため、クエリ文字列のみを更新
    if (shareUrl.startsWith('?')) {
      fullUrl = window.location.origin + window.location.pathname + shareUrl;
    } else {
      // ファイル名が含まれている場合
      fullUrl = window.location.origin + currentPath + '/' + shareUrl;
    }
  }
  
  console.log('Copying full URL to clipboard:', fullUrl);
  
  // Try to use the modern Clipboard API
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(fullUrl)
      .then(function() {
        console.log('Share URL copied to clipboard successfully');
        showCopySuccess();
      })
      .catch(function(err) {
        console.error('Could not copy text: ', err);
        fallbackCopyToClipboard(fullUrl);
      });
  } else {
    // Use fallback method
    fallbackCopyToClipboard(fullUrl);
  }
}

// 従来のクリップボードコピー方法
function fallbackCopyToClipboard(text) {
  // Create temporary input element
  var tempInput = document.createElement('input');
  tempInput.style.position = 'absolute';
  tempInput.style.left = '-9999px';
  tempInput.value = text; // 引数で受け取ったtextを使用
  document.body.appendChild(tempInput);
  
  // Select and copy
  tempInput.select();
  var success = document.execCommand('copy');
  document.body.removeChild(tempInput);
  
  if (success) {
    showCopySuccess();
    console.log('URL copied using fallback method:', text);
  } else {
    console.error('Failed to copy URL using fallback method');
  }
}

// コピー成功時の表示
function showCopySuccess() {
  // Show tooltip
  var tooltip = document.getElementById('shareTooltip');
  tooltip.style.opacity = '1';
  
  // ツールチップを非表示にする
  setTimeout(function() {
    tooltip.style.opacity = '0';
  }, 1000); // チェックマークアニメーションと同じタイミング
}

// すべてのノードを展開状態にリセットする関数
function resetAllNodes() {
  var children = document.querySelectorAll('.children');
  var buttons = document.querySelectorAll('.toggle-btn');
  
  // すべての子ノードを展開状態にする
  for (var i = 0; i < children.length; i++) {
    children[i].classList.remove('collapsed');
  }
  
  // すべてのボタンを展開状態にする
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].classList.remove('collapsed');
  }
  
  console.log('All nodes reset to expanded state');
}

// ブラウザのURLを動的に更新する関数
function updateBrowserUrl(queryString) {
  // History APIを使用してURLを更新
  if (window.history && window.history.replaceState) {
    try {
      // GCSと互換性を持たせるため、クエリ文字列のみを変更
      window.history.replaceState({}, document.title, queryString);
      console.log('Browser URL updated with query string:', queryString);
      
      // 状態をセッションストレージに保存（リダイレクト対応用）
      var state = saveTreeState();
      if (Object.keys(state).length > 0) {
        sessionStorage.setItem('kpiTreeState', JSON.stringify(state));
        console.log('Tree state saved to session storage');
      }
    } catch (e) {
      console.error('Error updating browser URL:', e);
    }
  }
}

// リダイレクト時のURLパラメータを処理する関数
function handleRedirectParams() {
  // URLパラメータを確認
  var urlParams = new URLSearchParams(window.location.search);
  var hasStateParam = urlParams.has('state');
  var originalParamFromSession = sessionStorage.getItem('originalStateParam');
  var savedTreeState = sessionStorage.getItem('kpiTreeState');
  
  console.log('Checking for redirect params:', {
    hasStateInUrl: hasStateParam,
    hasOriginalParam: !!originalParamFromSession,
    hasSavedState: !!savedTreeState
  });
  
  // 1. URLに状態パラメータがあるが、セッションに元の値がある場合 （GCSリダイレクト後）
  if (hasStateParam && originalParamFromSession) {
    console.log('Detected potential redirect scenario - comparing URL state with original state');
    var currentStateParam = urlParams.get('state');
    
    // URLパラメータが元の値と異なる場合は、元の値を優先
    if (currentStateParam !== originalParamFromSession) {
      console.log('URL state param changed after redirect, restoring original state');
      var savedState = null;
      
      // 元のオブジェクト状態を操作
      if (savedTreeState) {
        try {
          savedState = JSON.parse(savedTreeState);
          console.log('Using pre-parsed state object from session storage');
        } catch (parseError) {
          console.warn('Error parsing saved state:', parseError);
        }
      }
      
      // パース済み状態がない場合、オリジナルパラメータからデコード
      if (!savedState) {
        try {
          var decodedState = decodeURIComponent(originalParamFromSession);
          decodedState = atob(decodedState.replace(/-/g, '+').replace(/_/g, '/'));
          savedState = JSON.parse(decodedState);
          console.log('Successfully decoded original state from session storage');
        } catch (decodeError) {
          console.error('Failed to decode original state:', decodeError);
          return false; // デコード失敗時は何もしない
        }
      }
      
      // URLを更新
      if (savedState && Object.keys(savedState).length > 0) {
        var queryString = '?state=' + originalParamFromSession;
        console.log('Restoring original state in URL:', queryString);
        
        // ブラウザのURLを更新（History APIを使用）
        if (window.history && window.history.replaceState) {
          window.history.replaceState({}, document.title, window.location.pathname + queryString);
          console.log('Browser URL updated with original state param');
        }
        
        // 状態を適用
        if (document.readyState === 'loading') {
          console.log('DOM not yet ready, setting up listener for state application');
          document.addEventListener('DOMContentLoaded', function() {
            console.log('DOM now ready, applying original state');
            // 少し遅延させて確実に適用
            setTimeout(function() {
              applyTreeState(savedState);
            }, 200);
          });
        } else {
          console.log('DOM already ready, applying original state now');
          // 少し遅延させて確実に適用
          setTimeout(function() {
            applyTreeState(savedState);
          }, 200);
        }
        
        return true; // 状態適用済みを返す
      }
    }
  }
  // 2. URLにステートパラメータがなく、セッションストレージにステートがある場合
  else if (!hasStateParam && savedTreeState) {
    try {
      // セッションストレージから状態を取得
      var savedState = JSON.parse(savedTreeState);
      console.log('Found saved state in session storage:', savedState);
      
      if (savedState && Object.keys(savedState).length > 0) {
        // 状態パラメータを生成
        var stateParam = generateStateParam(savedState);
        
        // URLを更新
        var queryString = '?state=' + stateParam;
        console.log('Restoring state from session storage, updating URL to:', queryString);
        
        // ブラウザのURLを更新（History APIを使用）
        if (window.history && window.history.replaceState) {
          window.history.replaceState({}, document.title, window.location.pathname + queryString);
          console.log('Browser URL updated with session state');
        }
        
        // DOMに状態を適用
        if (document.readyState === 'loading') {
          console.log('DOM not yet ready, setting up listener for state application');
          document.addEventListener('DOMContentLoaded', function() {
            console.log('DOM now ready, applying session state');
            applyTreeState(savedState);
          });
        } else {
          console.log('DOM already ready, applying session state now');
          applyTreeState(savedState);
        }
        
        return true; // 状態適用済みを返す
      }
    } catch (e) {
      console.error('Error handling redirect params:', e);
    }
  }
  
  return false; // 状態未適用を返す
}

// ツリー状態を適用する関数
function applyTreeState(state) {
  // 状態が空でないか確認
  if (!state || Object.keys(state).length === 0) {
    console.log('No state to apply');
    return;
  }
  
  console.log('Applying tree state to', Object.keys(state).length, 'nodes');
  var appliedCount = 0;
  var missingCount = 0;
  
  // 再帰的にツリーを展開する処理
  function ensureParentNodesExpanded(element) {
    // 親要素が.kpi-tree liである場合、その子供の宛先なのでチェック
    var parent = element.parentElement;
    while (parent) {
      if (parent.classList && parent.classList.contains('kpi-tree')) {
        // ツリールートに到達したので終了
        break;
      }
      
      // 親要素がノードで、その子要素コンテナがあれば展開する
      if (parent.tagName.toLowerCase() === 'li') {
        var childrenContainer = parent.querySelector('ul');
        if (childrenContainer && childrenContainer.id) {
          // 親ノードの子供コンテナを展開する
          childrenContainer.classList.remove('collapsed');
          
          // ボタンもトグル
          var button = document.querySelector('[data-target="' + childrenContainer.id + '"]');
          if (button) {
            button.classList.remove('collapsed');
          }
          
          console.log('Ensuring parent container is expanded:', childrenContainer.id);
        }
      }
      
      parent = parent.parentElement;
    }
  }
  
  // 各ノードに状態を適用
  for (var nodeId in state) {
    var element = document.getElementById(nodeId);
    var nodeState = state[nodeId];
    
    if (element && nodeState) {
      // 直接的な親ノードを展開状態にすることで、子供要素が見えるようにする
      ensureParentNodesExpanded(element);
      
      // ノード自体の状態を適用
      if (nodeState === 'collapsed') {
        // collapsedクラスを追加
        element.classList.add('collapsed');
        
        // 対応するボタンもトグル
        var button = document.querySelector('[data-target="' + nodeId + '"]');
        if (button) {
          button.classList.add('collapsed');
        }
      } else if (nodeState === 'expanded') {
        // expandedの場合は確実にcollapsedクラスを削除
        element.classList.remove('collapsed');
        
        // 対応するボタンもトグル
        var button = document.querySelector('[data-target="' + nodeId + '"]');
        if (button) {
          button.classList.remove('collapsed');
        }
      }
      
      appliedCount++;
    } else {
      console.warn('Element not found for nodeId:', nodeId);
      missingCount++;
    }
  }
  
  console.log(`Tree state applied successfully: ${appliedCount} nodes applied, ${missingCount} nodes not found`);
  
  // すべての状態適用後に、スクロール位置をトップに戻す
  window.scrollTo(0, 0);
}

// 初期ロード完了フラグ
window._initialLoadComplete = false;

// オリジナルのstateパラメータを保存するグローバル変数
window._originalStateParam = null;

// Run initialization when page is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM content loaded, initializing KPI tree');
  
  // 最初のページロード時にオリジナルのURLパラメータを保存
  saveOriginalStateParam();
  
  // KPIツリーの動作を初期化
  kpiTreeInit();
  
  // リダイレクトパラメータの処理
  var redirectHandled = handleRedirectParams();
  
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

