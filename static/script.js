// KPI Tree JavaScript
// Using old-school function approach to ensure maximum browser compatibility
function kpiTreeInit() {
  console.log('KPI Tree initializing...');
  console.log('URL:', window.location.href);
  
  // 常に横型レイアウトを使用
  var theme = document.body.getAttribute('data-theme') || 'default';
  var direction = 'horizontal';
  
  console.log('KPI Tree initializing with direction:', direction);
  
  // 方向を設定
  setDirection(direction);
  
  // Add share button for permanent link
  addShareButton();
  
  // DOMContentLoadedイベントが発火した後にセットアップを行う
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      // Initialize toggle buttons
      setupToggleButtons();
      
      // URLパラメータがない場合のみURLを更新
      var urlParams = new URLSearchParams(window.location.search);
      if (!urlParams.has('state')) {
        // 初期化後にシェアURLを更新
        setTimeout(function() {
          updateShareUrl();
        }, 500);
      }
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
  var urlParams = new URLSearchParams(window.location.search);
  var stateParam = urlParams.get('state');
  
  if (!stateParam) {
    console.log('No state parameter in URL');
    return {};
  }
  
  try {
    // URLデコード後、URL-safe base64 decode
    console.log('Raw state param:', stateParam);
    var decodedState = decodeURIComponent(stateParam);
    console.log('URL decoded state:', decodedState);
    decodedState = atob(decodedState.replace(/-/g, '+').replace(/_/g, '/'));
    console.log('Base64 decoded state:', decodedState);
    var parsedState = JSON.parse(decodedState);
    console.log('Parsed state:', parsedState);
    
    // デバッグ: 各ノードIDが存在するか確認
    for (var nodeId in parsedState) {
      var element = document.getElementById(nodeId);
      if (!element) {
        console.warn('Node ID from URL not found in DOM:', nodeId);
      } else {
        console.log('Node ID from URL found in DOM:', nodeId, 'State:', parsedState[nodeId]);
      }
    }
    
    return parsedState;
  } catch (e) {
    console.error('Error parsing state from URL:', e);
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
  
  // Append to body
  document.body.appendChild(shareDiv);
  
  // Initialize share URL
  updateShareUrl();
}

// Update share URL when tree state changes
function updateShareUrl() {
  var state = saveTreeState();
  var stateParam = generateStateParam(state);
  var direction = 'horizontal'; // 常に横型レイアウトを使用
  
  // GCSと互換性のある方法でURLを構築
  // ファイル名のみを取得（パス情報なし）
  var fileName = window.location.pathname.split('/').pop();
  if (!fileName) {
    fileName = 'index.html'; // デフォルト
  }
  
  // クエリ文字列を構築
  var queryString = '?state=' + stateParam;
  
  // Store URL for copy button（相対パスを使用）
  window._shareUrl = fileName + queryString;
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
    } catch (e) {
      console.error('Error updating browser URL:', e);
    }
  }
}

// 初期ロード完了フラグ
window._initialLoadComplete = false;

// Run initialization when page is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    kpiTreeInit();
    // 初期ロード完了をマーク
    setTimeout(function() {
      window._initialLoadComplete = true;
      console.log('Initial load complete');
    }, 1000);
  });
} else {
  kpiTreeInit();
  // 初期ロード完了をマーク
  setTimeout(function() {
    window._initialLoadComplete = true;
    console.log('Initial load complete');
  }, 1000);
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

