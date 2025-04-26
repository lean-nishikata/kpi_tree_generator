/**
 * KPIツリージェネレーター：共有機能
 * URLの生成とクリップボードコピー機能を提供します
 */

// ツリー状態が変更されたときにURLを更新
function updateShareUrl() {
  // ツリーの現在の状態を取得
  var state = saveTreeState();
  
  if (state && Object.keys(state).length > 0) {
    // 状態パラメータを生成
    var stateParam = generateStateParam(state);
    
    // クエリパラメータではなくハッシュフラグメントを構築
    var hashFragment = stateParam ? '#state=' + stateParam : '';
    
    // 常にPUBLIC_URLを使うように設定
    if (window.PUBLIC_URL) {
      window._publicBaseUrl = window.PUBLIC_URL;
    }
    
    // 共有URL（ファイル名＋ハッシュフラグメント）を設定
    if (window._publicBaseUrl) {
      window._shareUrl = window._publicBaseUrl + hashFragment;
    } else {
      var fileName = window.location.pathname.split('/').pop() || 'index.html';
      window._shareUrl = fileName + hashFragment;
    }
    
    // ローカルストレージに現在のパラメータを保存
    if (stateParam) {
      try {
        localStorage.setItem('kpiTreeStateParam', stateParam);
      } catch (e) {
        console.error('パラメータ保存エラー:', e);
      }
    }
    
    // ブラウザのURLをハッシュで更新（ページはリロードされない）
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, document.title, hashFragment);
    }
  } else {
    // すべて展開状態の場合
    if (window.PUBLIC_URL) {
      window._publicBaseUrl = window.PUBLIC_URL;
    }
    
    if (window._publicBaseUrl) {
      window._shareUrl = window._publicBaseUrl;
    } else {
      var fileName = window.location.pathname.split('/').pop() || 'index.html';
      window._shareUrl = fileName;
    }
    
    // ブラウザのURLをハッシュなしに更新
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, document.title, window.location.pathname);
    }
  }
  
  // コンソールに現在の共有URLを表示
  console.log('Share URL updated with hash:', window._shareUrl);
}

// 共有ボタンクリック時の処理
function copyToClipboard() {
  // 共有URL更新を確実に実行
  updateShareUrl();
  
  // 常にPUBLIC_URLをベースにした共有URLを使用
  var shareUrl = window._shareUrl;
  
  // 状態パラメータを取得
  var stateParam = '';
  try {
    stateParam = localStorage.getItem('kpiTreeStateParam') || '';
  } catch (e) {
    console.error('ローカルストレージからパラメータ取得エラー:', e);
  }
  
  // PUBLIC_URLが設定されていればそれを使用
  if (window.PUBLIC_URL) {
    var hash = window.location.hash;
    shareUrl = window.PUBLIC_URL + (hash || '');
    console.log('公開URLを使用した共有URL:', shareUrl);
  }
  
  // 共有用URLを生成
  const url = shareUrl;
  
  console.log('コピーするURL:', url);
  
  // クリップボードAPIが使用可能な場合
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url)
      .then(function() {
        showCopyMessage('URLをコピーしました');
        console.log('クリップボードにコピー成功:', url);
      })
      .catch(function(err) {
        console.error('クリップボードへのコピーに失敗:', err);
        // フォールバック: textarea要素を使った古典的なコピー機能
        fallbackCopyToClipboard(url);
      });
  } else {
    // フォールバック: textarea要素を使った古典的なコピー機能
    fallbackCopyToClipboard(url);
  }
}

// 共有ボタンを追加する関数
function addShareButton() {
  // 既存のボタンを確認
  if (document.getElementById('shareButton')) {
    return;
  }
  
  // ボタンコンテナを作成
  var shareDiv = document.createElement('div');
  shareDiv.className = 'share-control';
  shareDiv.style.position = 'fixed';
  shareDiv.style.bottom = '20px';
  shareDiv.style.right = '20px';
  shareDiv.style.zIndex = '1000';
  
  // ボタン要素
  var shareButton = document.createElement('button');
  shareButton.id = 'shareButton';
  shareButton.textContent = '共有URLをコピー';
  shareButton.style.padding = '8px 15px';
  shareButton.style.backgroundColor = '#4285F4';
  shareButton.style.color = 'white';
  shareButton.style.border = 'none';
  shareButton.style.borderRadius = '4px';
  shareButton.style.cursor = 'pointer';
  shareButton.style.fontSize = '14px';
  shareButton.style.fontWeight = 'bold';
  shareButton.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
  shareButton.style.position = 'relative';
  
  // ボタンのホバー効果
  shareButton.onmouseover = function() {
    this.style.backgroundColor = '#3367D6';
  };
  shareButton.onmouseout = function() {
    this.style.backgroundColor = '#4285F4';
  };
  
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
    copyToClipboard();
  };
  
  // DOMに追加
  shareDiv.appendChild(shareButton);
  document.body.appendChild(shareDiv);
}

// コピー成功表示
function showCopySuccess() {
  showCopyMessage('URLをコピーしました');
}

// メッセージ表示
function showCopyMessage(message) {
  // 既存のメッセージ要素を削除
  var oldMessage = document.getElementById('copy-message');
  if (oldMessage) {
    oldMessage.parentNode.removeChild(oldMessage);
  }
  
  // 新しいメッセージ要素を作成
  var messageElement = document.createElement('div');
  messageElement.id = 'copy-message';
  messageElement.style.position = 'fixed';
  messageElement.style.bottom = '20px';
  messageElement.style.left = '50%';
  messageElement.style.transform = 'translateX(-50%)';
  messageElement.style.padding = '10px 20px';
  messageElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  messageElement.style.color = 'white';
  messageElement.style.borderRadius = '4px';
  messageElement.style.zIndex = '9999';
  messageElement.style.opacity = '1';
  messageElement.style.transition = 'opacity 0.3s';
  messageElement.textContent = message;
  
  // DOMに追加
  document.body.appendChild(messageElement);
  
  // 数秒後に非表示
  setTimeout(function() {
    messageElement.style.opacity = '0';
    // アニメーション後に要素を削除
    setTimeout(function() {
      if (messageElement.parentNode) {
        messageElement.parentNode.removeChild(messageElement);
      }
    }, 300);
  }, 3000);
}

// 代替コピー方法
function fallbackCopyToClipboard(text) {
  var tempInput = document.createElement('input');
  tempInput.style.position = 'absolute';
  tempInput.style.left = '-9999px';
  tempInput.value = text;
  document.body.appendChild(tempInput);
  
  tempInput.select();
  tempInput.setSelectionRange(0, 99999); // モバイル対応
  
  var success = document.execCommand('copy');
  document.body.removeChild(tempInput);
  
  if (success) {
    showCopyMessage('URLをコピーしました: ' + text);
  } else {
    showCopyMessage('コピーに失敗しました。手動でコピーしてください: ' + text);
  }
}

// URLをクリップボードにコピー
function copyShareUrlToClipboard() {
  var shareUrl = window._shareUrl;
  if (!shareUrl) return;
  
  var fullUrl;
  if (shareUrl.startsWith('http')) {
    fullUrl = shareUrl;
  } else if (shareUrl.startsWith('?') || shareUrl.startsWith('#')) {
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
