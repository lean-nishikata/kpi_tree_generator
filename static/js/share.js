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

/**
 * 共有ボタンクリック時の処理、現在のツリー状態をURL化しクリップボードにコピー
 * 現在のKPIツリー状態を取得し、共有可能なURLを生成してクリップボードにコピーする
 * 環境により最適なクリップボード操作を行う
 * 
 * @returns {void}
 */
function copyToClipboard() {
  try {
    // 共有URLの生成と更新
    updateShareUrl();
    
    // すべての共有元で共通の共有URLを使用
    var shareUrl = window._shareUrl;
    
    // ローカルストレージから状態パラメータを取得
    var stateParam = '';
    try {
      stateParam = localStorage.getItem('kpiTreeStateParam') || '';
    } catch (storageError) {
      console.error('ストレージからパラメータ取得エラー:', storageError);
      // ストレージエラーがあっても処理を継続
    }
    
    // 公開URL設定を優先（GCSなどの環境向け）
    if (window.PUBLIC_URL) {
      // 現在の状態を表すハッシュパラメータを取得
      var currentState = saveTreeState();
      var stateFragment = '';
      
      // ツリー状態があればパラメータを生成
      if (currentState && Object.keys(currentState).length > 0) {
        var stateParam = generateStateParam(currentState);
        if (stateParam) {
          stateFragment = '#state=' + stateParam;
        }
      }
      
      // YAMLで指定された公開URLに現在の状態パラメータを結合
      shareUrl = window.PUBLIC_URL + stateFragment;
      console.log('公開URLと状態パラメータを結合した共有URL:', shareUrl);
    }
    
    // 最終的な共有URLの生成
    const finalUrl = shareUrl;
    
    console.log('クリップボードコピー準備:', finalUrl);
    
    // クリップボード操作時のブラウザ対応処理
    if (navigator.clipboard && navigator.clipboard.writeText) {
      // モダンブラウザのAPIを使用
      navigator.clipboard.writeText(finalUrl)
        .then(function() {
          // コピー成功時のユーザー通知
          showCopyMessage('URLをコピーしました');
          console.log('クリップボードコピー成功');
        })
        .catch(function(clipboardError) {
          // APIエラー時は代替方法でコピー試行
          console.warn('クリップボードAPIエラー、代替方法で試行:', clipboardError);
          fallbackCopyToClipboard(finalUrl);
        });
    } else {
      // 旧ブラウザや制限された環境向けの代替処理
      console.log('従来型クリップボード方式を使用');
      fallbackCopyToClipboard(finalUrl);
    }
  } catch (error) {
    // 予期せぬエラーへの対策
    console.error('共有URL生成・コピー処理エラー:', error);
    alert('共有URLの生成中にエラーが発生しました');
  }
}

// 共有ボタンを追加する関数
/**
 * KPIツリーの状態を共有するためのボタンを画面に追加
 * 画面右下に固定表示される共有ボタンを作成し、DOMに挿入する
 */
function addShareButton() {
  // 既存ボタンがあれば再追加しない
  if (document.getElementById('shareButton')) {
    return;
  }
  
  // ボタンコンテナ要素の作成
  var shareDiv = document.createElement('div');
  shareDiv.className = 'share-control';
  shareDiv.style.position = 'fixed';
  shareDiv.style.top = '20px';
  shareDiv.style.right = '20px';
  shareDiv.style.zIndex = '1000';
  
  // 共有ボタン要素の作成とスタイル設定
  var shareButton = document.createElement('button');
  shareButton.id = 'shareButton';
  shareButton.textContent = '共有URLをコピー';
  
  // ボタンスタイルの設定
  Object.assign(shareButton.style, {
    padding: '8px 15px',
    backgroundColor: '#4285F4',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
    position: 'relative'
  });
  
  // ホバー効果
  shareButton.onmouseover = function() {
    this.style.backgroundColor = '#3367D6'; // 濃い青
  };
  shareButton.onmouseout = function() {
    this.style.backgroundColor = '#4285F4'; // 元の青
  };
  
  // ツールチップ要素の作成
  var tooltip = document.createElement('div');
  tooltip.id = 'shareTooltip';
  tooltip.textContent = '現在のURLをコピーしました';
  
  // ツールチップスタイル設定
  Object.assign(tooltip.style, {
    position: 'absolute',
    top: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#333',
    color: 'white',
    padding: '5px 10px',
    borderRadius: '4px',
    fontSize: '12px',
    whiteSpace: 'nowrap',
    opacity: '0',
    transition: 'opacity 0.3s',
    pointerEvents: 'none',
    zIndex: '1001'
  });
  
  // ツールチップをボタンに追加
  shareButton.appendChild(tooltip);
  
  /**
   * 共有ボタンクリック時のハンドラ
   * 現在のKPIツリー状態をURL化し、クリップボードにコピーする
   */
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

/**
 * コピー成功時に一時的な通知メッセージを表示
 * 画面下部にトーストメッセージを表示し、3秒後に消える
 * 
 * @param {string} message - 表示するメッセージ文字列
 * @returns {void}
 */
function showCopyMessage(message) {
  // 既存のメッセージ要素があれば削除（複数回クリック対応）
  var oldMessage = document.getElementById('copy-message');
  if (oldMessage && oldMessage.parentNode) {
    oldMessage.parentNode.removeChild(oldMessage);
  }
  
  // 新しいメッセージ要素の作成
  var messageElement = document.createElement('div');
  messageElement.id = 'copy-message';
  
  // メッセージのスタイルを設定
  Object.assign(messageElement.style, {
    position: 'fixed',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '10px 20px',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: 'white',
    borderRadius: '4px',
    zIndex: '9999',
    opacity: '1',
    transition: 'opacity 0.3s',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    fontSize: '14px'
  });
  
  // 表示メッセージを設定
  messageElement.textContent = message;
  
  // DOMに追加
  document.body.appendChild(messageElement);
  
  // 3秒後にフェードアウトして消す
  setTimeout(function() {
    // フェードアウトアニメーション
    messageElement.style.opacity = '0';
    
    // アニメーション完了後に要素を削除（メモリリーク防止）
    setTimeout(function() {
      if (messageElement.parentNode) {
        messageElement.parentNode.removeChild(messageElement);
      }
    }, 300); // トランジションの時間と同じか少し長め
  }, 3000); // 3秒間表示
}

/**
 * クリップボードAPIが利用できない環境用の代替コピー機能
 * document.execCommand('copy')を使用した従来型のクリップボード操作
 * 
 * @param {string} text - クリップボードにコピーするテキスト
 * @returns {void}
 */
function fallbackCopyToClipboard(text) {
  try {
    // 一時的な非表示入力フィールドを作成
    var tempInput = document.createElement('input');
    tempInput.style.position = 'absolute';
    tempInput.style.left = '-9999px'; // 画面外に配置
    tempInput.setAttribute('readonly', ''); // 読み取り専用に設定
    tempInput.value = text;
    document.body.appendChild(tempInput);
    
    // テキストを選択状態にする
    tempInput.select();
    tempInput.setSelectionRange(0, 99999); // モバイルデバイス対応
    
    // クリップボードにコピーを実行
    var copySuccess = document.execCommand('copy');
    
    // 一時要素を削除
    document.body.removeChild(tempInput);
    
    // 結果に応じたメッセージを表示
    if (copySuccess) {
      console.log('フォールバックコピー成功');
      showCopyMessage('URLをコピーしました');
    } else {
      console.warn('フォールバックコピー失敗');
      showCopyMessage('コピーに失敗しました。URL: ' + text);
    }
  } catch (error) {
    // どの方法でもコピーが失敗した場合のバックアップ
    console.error('クリップボード操作全般エラー:', error);
    alert('クリップボードへのコピーができませんでした\n' + text);
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
