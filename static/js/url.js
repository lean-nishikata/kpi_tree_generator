/**
 * KPIツリージェネレーター：URL処理機能
 * URLハッシュとパラメータを処理する機能を提供します
 */

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

// ハッシュフラグメントからツリー状態を取得する関数
function getStateFromHash() {
  var hash = window.location.hash;
  if (!hash || !hash.includes('state=')) {
    // ハッシュから状態が取得できなかった場合、ローカルストレージをチェック
    try {
      var savedStateParam = localStorage.getItem('kpiTreeStateParam');
      if (savedStateParam) {
        // 保存されたパラメータから状態をデコード
        return decodeStateParam(savedStateParam);
      }
    } catch (e) {
      console.error('ローカルストレージからの取得エラー:', e);
    }
    return {};
  }
  
  try {
    // ハッシュから状態パラメータを抽出
    var stateMatch = hash.match(/state=([^&]+)/);
    if (!stateMatch) return {};
    
    var stateParam = stateMatch[1];
    
    // パラメータをデコード
    return decodeStateParam(stateParam);
  } catch (e) {
    console.error('ハッシュからの状態復元エラー:', e);
    return {};
  }
}

// 状態パラメータをデコードする共通関数
function decodeStateParam(stateParam) {
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
    console.error('パラメータデコードエラー:', e);
    
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
  
  // ノードIDをソート
  var nodeIds = Object.keys(state).sort();
  var normalizedState = {};
  for (var i = 0; i < nodeIds.length; i++) {
    normalizedState[nodeIds[i]] = state[nodeIds[i]];
  }
  
  // フィンガープリントとチェックサム
  var fingerprint = '';
  for (var j = 0; j < nodeIds.length; j++) {
    var id = nodeIds[j];
    var val = state[id];
    fingerprint += id.substring(0, 3) + val.substring(0, 1);
  }
  
  var checksum = 0;
  for (var k = 0; k < fingerprint.length; k++) {
    checksum += fingerprint.charCodeAt(k);
  }
  checksum = checksum % 1000;
  
  var jsonString = JSON.stringify(normalizedState);
  var encoded = btoa(jsonString).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  var uniqueHash = 's' + checksum + '-n' + nodeIds.length;
  
  return encodeURIComponent(encoded) + '.' + uniqueHash;
}

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
      console.error('ブラウザURLの更新エラー:', e);
    }
  }
}
