// KPI Tree JavaScript
// Using old-school function approach to ensure maximum browser compatibility
function kpiTreeInit() {
  console.log('KPI Tree initializing...');
  console.log('URL:', window.location.href);
  
  // まずURLパラメータから方向を取得
  var urlDirection = getDirectionFromUrl();
  
  // Apply theme and direction from config or URL
  var theme = document.body.getAttribute('data-theme') || 'default';
  var direction = urlDirection || document.body.getAttribute('data-direction') || 'vertical';
  
  console.log('KPI Tree initializing with direction:', direction);
  
  // 方向を設定
  setDirection(direction);
  
  // Add direction toggle control
  addDirectionToggle(direction);
  
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

// URLパラメータから方向を取得
function getDirectionFromUrl() {
  var urlParams = new URLSearchParams(window.location.search);
  var direction = urlParams.get('direction');
  
  if (direction === 'vertical' || direction === 'horizontal') {
    console.log('Direction from URL:', direction);
    return direction;
  }
  
  return null;
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

// Add direction toggle dropdown
function addDirectionToggle(initialDirection) {
  // Create toggle control
  var controlDiv = document.createElement('div');
  controlDiv.className = 'direction-control';
  controlDiv.style.position = 'fixed';
  controlDiv.style.top = '10px';
  controlDiv.style.right = '10px';
  controlDiv.style.zIndex = '1000';
  controlDiv.style.background = '#fff';
  controlDiv.style.padding = '5px 10px';
  controlDiv.style.borderRadius = '4px';
  controlDiv.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
  
  // Create select element
  var select = document.createElement('select');
  select.id = 'directionToggle';
  
  // Add options
  var vertOption = document.createElement('option');
  vertOption.value = 'vertical';
  vertOption.textContent = '縦向きレイアウト';
  vertOption.selected = initialDirection === 'vertical';
  
  var horizOption = document.createElement('option');
  horizOption.value = 'horizontal';
  horizOption.textContent = '横向きレイアウト';
  horizOption.selected = initialDirection === 'horizontal';
  
  select.appendChild(vertOption);
  select.appendChild(horizOption);
  
  // Add event listener using old-school approach
  select.onchange = function() {
    // 新しい方向を設定
    setDirection(this.value);
    
    // Save preference to localStorage
    localStorage.setItem('kpiTreeDirection', this.value);
    
    // Update share URL
    updateShareUrl();
  };
  
  // Add label
  var label = document.createElement('label');
  label.htmlFor = 'directionToggle';
  label.textContent = 'レイアウト: ';
  label.style.marginRight = '5px';
  label.style.fontWeight = 'bold';
  
  // Append to control div
  controlDiv.appendChild(label);
  controlDiv.appendChild(select);
  
  // Append to body
  document.body.appendChild(controlDiv);
  
  // 初期値をセレクトボックスに設定
  select.value = initialDirection;
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
  shareDiv.style.top = '50px';
  shareDiv.style.right = '10px';
  shareDiv.style.zIndex = '1000';
  shareDiv.style.background = '#fff';
  shareDiv.style.padding = '5px 10px';
  shareDiv.style.borderRadius = '4px';
  shareDiv.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
  
  var shareButton = document.createElement('button');
  shareButton.id = 'shareButton';
  shareButton.textContent = '現在の表示状態を共有';
  shareButton.style.padding = '5px 10px';
  shareButton.style.cursor = 'pointer';
  shareButton.style.backgroundColor = '#4CAF50';
  shareButton.style.color = 'white';
  shareButton.style.border = 'none';
  shareButton.style.borderRadius = '4px';
  
  // Add event listener
  shareButton.onclick = function() {
    copyShareUrlToClipboard();
  };
  
  // Add tooltip span
  var tooltip = document.createElement('span');
  tooltip.id = 'shareTooltip';
  tooltip.textContent = '';
  tooltip.style.marginLeft = '10px';
  tooltip.style.fontSize = '12px';
  tooltip.style.opacity = '0';
  tooltip.style.transition = 'opacity 0.3s';
  
  // Append to share div
  shareDiv.appendChild(shareButton);
  shareDiv.appendChild(tooltip);
  
  // Append to body
  document.body.appendChild(shareDiv);
  
  // Initialize share URL
  updateShareUrl();
}

// Update share URL when tree state changes
function updateShareUrl() {
  var state = saveTreeState();
  var stateParam = generateStateParam(state);
  var direction = document.body.getAttribute('data-direction') || 'vertical';
  
  // Create URL with parameters
  var url = new URL(window.location.href);
  // URLのハッシュ部分とクエリパラメータを削除
  url.hash = '';
  url.search = '';
  
  // パラメータを追加
  url.searchParams.set('state', stateParam);
  url.searchParams.set('direction', direction);
  
  // Store URL for copy button
  window._shareUrl = url.toString();
  console.log('Share URL updated:', window._shareUrl);
  
  // 現在のURLパラメータをチェック
  var currentUrlParams = new URLSearchParams(window.location.search);
  var hasStateParam = currentUrlParams.has('state');
  
  // 初期ロード時にURLパラメータがある場合は更新しない
  if (window._initialLoadComplete || !hasStateParam) {
    // ブラウザのURLを動的に更新
    updateBrowserUrl(url.toString());
  } else {
    console.log('Skipping URL update on initial load with state parameters');
  }
}

// Copy share URL to clipboard
function copyShareUrlToClipboard() {
  if (!window._shareUrl) {
    updateShareUrl();
  }
  
  // Create temporary input element
  var tempInput = document.createElement('input');
  tempInput.style.position = 'absolute';
  tempInput.style.left = '-9999px';
  tempInput.value = window._shareUrl;
  document.body.appendChild(tempInput);
  
  // Select and copy
  tempInput.select();
  document.execCommand('copy');
  document.body.removeChild(tempInput);
  
  // Show tooltip
  var tooltip = document.getElementById('shareTooltip');
  tooltip.textContent = 'リンクをコピーしました！';
  tooltip.style.opacity = '1';
  
  // Hide tooltip after 2 seconds
  setTimeout(function() {
    tooltip.style.opacity = '0';
  }, 2000);
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
function updateBrowserUrl(url) {
  // History APIを使用してURLを更新
  if (window.history && window.history.replaceState) {
    try {
      window.history.replaceState({}, document.title, url);
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

