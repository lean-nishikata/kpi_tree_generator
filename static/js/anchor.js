/**
 * KPIツリージェネレーター：アンカー機能
 * ノードにアンカーリンクを追加し、パーマリンク機能を提供します
 */

// ノードにアンカーアイコンを追加する関数
function addNodeAnchors() {
  document.querySelectorAll('.node').forEach(function(node) {
    if (node.id) {
      // すでにアンカーが設定されている場合はスキップ
      if (node.querySelector('.node-anchor')) return;
      
      var anchorIcon = document.createElement('a');
      anchorIcon.className = 'node-anchor';
      anchorIcon.innerHTML = '🔗'; // リンクアイコン
      anchorIcon.title = 'このノードへのリンクをコピー';
      anchorIcon.style.position = 'absolute';
      anchorIcon.style.top = '5px';
      anchorIcon.style.right = '5px';
      anchorIcon.style.fontSize = '14px';
      anchorIcon.style.cursor = 'pointer';
      anchorIcon.style.textDecoration = 'none';
      anchorIcon.style.opacity = '0.6';
      anchorIcon.style.transition = 'opacity 0.2s';
      
      anchorIcon.onmouseover = function() {
        this.style.opacity = '1';
      };
      
      anchorIcon.onmouseout = function() {
        this.style.opacity = '0.6';
      };
      
      anchorIcon.onclick = function(event) {
        event.stopPropagation();
        
        // 現在の状態パラメータを取得
        var state = saveTreeState();
        var stateParam = '';
        if (state && Object.keys(state).length > 0) {
          stateParam = generateStateParam(state);
        }
        
        // ノードIDを含むハッシュを構築
        var nodeId = node.id;
        var hashFragment = '#';
        if (stateParam) {
          hashFragment += 'state=' + stateParam + '&';
        }
        hashFragment += 'node=' + nodeId;
        
        // 完全なURLを構築
        var url = window.PUBLIC_URL || window.location.pathname;
        url = url + hashFragment;
        
        // URLをクリップボードにコピー
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url)
            .then(function() {
              showCopyMessage('ノードへのリンクをコピーしました');
            })
            .catch(function() {
              fallbackCopyToClipboard(url);
            });
        } else {
          fallbackCopyToClipboard(url);
        }
      };
      
      // 必要に応じてノードのスタイルを調整
      if (getComputedStyle(node).position === 'static') {
        node.style.position = 'relative';
      }
      
      node.appendChild(anchorIcon);
    }
  });
}

// アンカーノードにスクロールする関数
function scrollToAnchorNode() {
  var hash = window.location.hash;
  if (!hash || !hash.includes('node=')) return;
  
  try {
    // ハッシュからノードIDを抽出
    var nodeMatch = hash.match(/node=([^&]+)/);
    if (!nodeMatch) return;
    
    var nodeId = nodeMatch[1];
    var targetNode = document.getElementById(nodeId);
    
    if (targetNode) {
      // アクセラレーションが終わった後にスクロール
      setTimeout(function() {
        targetNode.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
        
        // ハイライト効果を追加
        targetNode.classList.add('highlight-node');
        setTimeout(function() {
          targetNode.classList.remove('highlight-node');
        }, 2000);
      }, 500);
    }
  } catch (e) {
    console.error('アンカーノードへのスクロールエラー:', e);
  }
}
