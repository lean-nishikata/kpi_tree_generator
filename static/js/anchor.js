/**
 * KPIツリージェネレーター：アンカー機能モジュール
 * 
 * ノードにパーマリンク機能を提供し、特定ノードへの直接リンクを可能にします。
 * 各ノードにリンクアイコンを追加し、クリップボードコピー機能、スクロール機能を提供します。
 */

/**
 * 各ノードにアンカーアイコンを追加
 * クリックすると、そのノードを指すURLの生成とコピーを行います
 */
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
      
      /**
       * ノードアンカーアイコンのクリックハンドラ
       * 現在のツリー状態とノードIDを含むURLをクリップボードにコピー
       */
      anchorIcon.onclick = function(event) {
        // イベントの伸幅を防止（親要素へのバブリング防止）
        event.stopPropagation();
        
        // 現在のツリー状態を保存し、パラメータ化
        var state = saveTreeState();
        var stateParam = '';
        if (state && Object.keys(state).length > 0) {
          stateParam = generateStateParam(state);
        }
        
        // ノードIDを含むURLハッシュフラグメントを生成
        var nodeId = node.id;
        var hashFragment = '#';
        
        // 状態パラメータがあれば追加
        if (stateParam) {
          hashFragment += 'state=' + stateParam + '&'; // ノードIDと結合するため&で終わる
        }
        
        // ノードIDパラメータを追加
        hashFragment += 'node=' + nodeId;
        
        // 共有に使用するベースURLの取得（設定された公開URLまたは現在のパス）
        var baseUrl = window.PUBLIC_URL || window.location.pathname;
        var fullUrl = baseUrl + hashFragment;
        
        console.log('ノードリンク生成:', fullUrl);
        
        // クリップボードAPIの対応確認とURLコピー
        if (navigator.clipboard && navigator.clipboard.writeText) {
          // 新しいClipboard APIを使用
          navigator.clipboard.writeText(fullUrl)
            .then(function() {
              showCopyMessage('ノードへのリンクをコピーしました');
            })
            .catch(function(err) {
              console.error('クリップボードAPIエラー:', err);
              // フォールバック方式でコピー試行
              fallbackCopyToClipboard(fullUrl);
            });
        } else {
          // 旧環境対応のフォールバックコピー処理
          fallbackCopyToClipboard(fullUrl);
        }
      };
      
      // ノードのポジショニング確認（アイコンの位置決めに必要）
      if (getComputedStyle(node).position === 'static') {
        node.style.position = 'relative'; // 絶対配置アイコンの基準点にするために必要
      }
      
      // アンカーアイコンをノードにDOM挿入
      node.appendChild(anchorIcon);
      console.log('アンカーアイコンを追加:', node.id);
    }
  });
  
  // アンカーノード用のスタイルを追加
  addHighlightStyle();
}

/**
 * URLハッシュのノードパラメータから指定ノードにスクロールしてハイライト表示する
 * URLハッシュに node=<ノードID> パラメータが含まれている場合、そのノードに自動スクロールする
 */
function scrollToAnchorNode() {
  var hash = window.location.hash;
  // ノードパラメータがなければ何もしない
  if (!hash || !hash.includes('node=')) return;
  
  try {
    // ハッシュからノードIDを正規表現で抽出 (node=xxx の形式)
    var nodeMatch = hash.match(/node=([^&]+)/);
    if (!nodeMatch) return;
    
    var nodeId = nodeMatch[1];
    console.log('アンカーノード検出:', nodeId);
    var targetNode = document.getElementById(nodeId);
    
    if (targetNode) {
      // DOMが完全にレンダリングされるまで少し待つ
      setTimeout(function() {
        // 指定ノードにスムーズにスクロール
        targetNode.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
        
        // 視認性向上のためハイライトアニメーション
        targetNode.classList.add('highlight-node');
        console.log('ノードをハイライト表示しました:', nodeId);
        
        // 一定時間後にハイライトを解除
        setTimeout(function() {
          targetNode.classList.remove('highlight-node');
        }, 2000); // 2秒間ハイライト
      }, 500); // DOMレンダリング完了まで500ms待機
    } else {
      console.warn('指定されたノードIDが見つかりません:', nodeId);
    }
  } catch (e) {
    console.error('アンカーノードスクロール処理エラー:', e);
  }
}

/**
 * ノードハイライト用のスタイルを動的に追加
 * ノードがハイライトされたときのパルスアニメーション用CSSを挿入
 */
function addHighlightStyle() {
  // 既にスタイルが存在する場合は再挿入しない
  if (document.getElementById('kpi-tree-highlight-style')) return;
  
  // スタイル要素を作成
  var style = document.createElement('style');
  style.id = 'kpi-tree-highlight-style';
  
  // ハイライトのパルスアニメーションを定義
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
  
  // スタイルを文書にDOM挿入
  document.head.appendChild(style);
  console.log('ノードハイライトスタイルを追加しました');
}
