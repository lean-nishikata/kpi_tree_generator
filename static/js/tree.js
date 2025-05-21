/**
 * KPIツリージェネレーター：ツリー操作機能
 * ツリーノードの操作と状態管理を担当するモジュールです
 * 
 * ツリーの開閉状態の保存、読み込み、適用を管理します。
 * トグルボタンの設定やイベントハンドラの登録も行います。
 */

/**
 * トグルボタンの初期化とイベントハンドラの設定
 * 各ノードの折りたたみ/展開ボタンにクリックイベントを登録します
 */
function setupToggleButtons() {
  // すべてのトグルボタンを取得
  var toggleButtons = document.querySelectorAll('.toggle-btn');
  if (!toggleButtons.length) return;
  
  // 各ボタンにイベントハンドラを設定
  toggleButtons.forEach(function(button) {
    var targetId = button.getAttribute('data-target');
    var target = document.getElementById(targetId);
    if (!target) return;
    
    // クリック時のイベントハンドラ
    button.onclick = function() {
      // トグル動作を実行
      target.classList.toggle('collapsed');
      button.classList.toggle('collapsed');
      
      // 状態を保存してURLを更新
      saveTreeState();
      updateShareUrl();
    };
  });
}

/**
 * ツリーの現在の開閉状態を取得して保存
 * 
 * @returns {Object} 折りたたまれたノードIDとその状態を含むオブジェクト
 */
function saveTreeState() {
  // すべての子ノードとその開閉状態を取得
  var state = {};
  document.querySelectorAll('.children').forEach(function(child) {
    if (child.id) {
      state[child.id] = child.classList.contains('collapsed') ? 'collapsed' : 'expanded';
    }
  });
  
  // 最小データ化: 折りたたまれたノードのみを抽出してURLパラメータを省サイズ化
  var filteredState = {};
  for (var nodeId in state) {
    if (state[nodeId] === 'collapsed') {
      filteredState[nodeId] = 'collapsed';
    }
  }
  
  // 完全な状態をローカルストレージに保存（通常の使用向け）
  try {
    localStorage.setItem('kpiTreeState', JSON.stringify(state));
  } catch (e) {
    console.warn('ローカルストレージへの状態保存失敗:', e);
  }
  
  // 最小化された状態を返す（URLパラメータ用）
  return Object.keys(filteredState).length > 0 ? filteredState : {};
}


/**
 * ノードの開閉状態を初期化（3階層目まで展開、それ以降は折りたたみ）
 */
function initAllNodes() {
  document.querySelectorAll('.children').forEach(function(child) {
    const depth = getNodeDepth(child);

    const toggleBtn = document.querySelector('.toggle-btn[data-target="' + child.id + '"]');
    if (depth <= 2) {
      child.classList.remove('collapsed');
      if (toggleBtn) toggleBtn.classList.remove('collapsed');
    } else {
      child.classList.add('collapsed');
      if (toggleBtn) toggleBtn.classList.add('collapsed');
    }
  });
}

/**
 * 指定されたノード (.children) の階層レベル（深さ）を取得
 * これは、親要素が .node を持つ回数で判定することで、
 * 視覚的に「親→子→孫→ひ孫…」の何段目かを返します。
 *
 * @param {HTMLElement} element - .children UL要素
 * @returns {number} - ノードの階層の深さ（1階層目から始まる）
 */
function getNodeDepth(element) {
  let depth = 0;
  let current = element;

  while (current && current !== document.body) {
    if (current.classList.contains('children')) {
      const parentLi = current.closest('li');
      if (parentLi && parentLi.querySelector('.node')) {
        depth++;
      }
    }
    current = current.parentElement;
  }

  return depth;
}

/**
 * ツリー状態をDOMに適用
 * URLハッシュなどから取得した状態をツリー表示に反映させます
 * 
 * @param {Object} state - 適用するツリー状態のオブジェクト 
 */
function applyTreeState(state) {
  // 状態が空の場合は何もしない
  if (!state || Object.keys(state).length === 0) return;
  
  // 先にすべて展開状態にリセット
  document.querySelectorAll('.children').forEach(function(child) {
    child.classList.remove('collapsed');
  });
  document.querySelectorAll('.toggle-btn').forEach(function(button) {
    button.classList.remove('collapsed');
  });
  
  // 指定された状態を適用
  for (var nodeId in state) {
    var nodeState = state[nodeId];
    var node = document.getElementById(nodeId);
    var button = null;
    
    // 対応するトグルボタンを探す
    document.querySelectorAll('.toggle-btn').forEach(function(btn) {
      if (btn.getAttribute('data-target') === nodeId) {
        button = btn;
      }
    });
    
    // ノードとボタンが見つかった場合は状態を設定
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
  
  // 状態をストレージに保存し、初期化完了フラグを設定
  saveTreeState();
  window._initialLoadComplete = true;
}
