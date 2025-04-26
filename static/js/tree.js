/**
 * KPIツリージェネレーター：ツリー操作機能
 * ツリーノードの操作と状態管理機能を提供します
 */

// トグルボタンの設定
function setupToggleButtons() {
  var toggleButtons = document.querySelectorAll('.toggle-btn');
  if (!toggleButtons.length) return;
  
  toggleButtons.forEach(function(button) {
    var targetId = button.getAttribute('data-target');
    var target = document.getElementById(targetId);
    if (!target) return;
    
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
  
  document.querySelectorAll('.children').forEach(function(child) {
    if (child.id) {
      state[child.id] = child.classList.contains('collapsed') ? 'collapsed' : 'expanded';
    }
  });
  
  // collapsedのみ抽出して省サイズ化
  var filteredState = {};
  for (var nodeId in state) {
    if (state[nodeId] === 'collapsed') {
      filteredState[nodeId] = 'collapsed';
    }
  }
  
  // 状態をローカルストレージに保存（通常の使用向け）
  localStorage.setItem('kpiTreeState', JSON.stringify(state));
  
  return Object.keys(filteredState).length > 0 ? filteredState : {};
}

// ツリーの状態を読み込む
function loadTreeState() {
  try {
    var savedState = localStorage.getItem('kpiTreeState');
    return savedState ? JSON.parse(savedState) : {};
  } catch (e) {
    console.error('ツリー状態の読み込みエラー:', e);
    return {};
  }
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

// ツリー状態を適用
function applyTreeState(state) {
  if (!state || Object.keys(state).length === 0) return;
  
  resetAllNodes();
  
  for (var nodeId in state) {
    var nodeState = state[nodeId];
    var node = document.getElementById(nodeId);
    var button = null;
    
    document.querySelectorAll('.toggle-btn').forEach(function(btn) {
      if (btn.getAttribute('data-target') === nodeId) {
        button = btn;
      }
    });
    
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
  
  saveTreeState();
  window._initialLoadComplete = true;
}
