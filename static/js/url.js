/**
 * KPIツリージェネレーター：URL処理モジュール
 * 
 * URLハッシュとクエリパラメータを利用したツリー状態の保存と復元を担当します。
 * Google Cloud Storageなどのリダイレクト環境にも対応し、共有可能なリンクを生成します。
 */

/**
 * リダイレクト環境でのパラメータ保持を処理
 * GCSなどのリダイレクト環境で状態パラメータが消失する問題に対応します
 * 
 * @returns {boolean} リダイレクト処理が行われた場合はtrue、それ以外は通常処理のことを示すfalse
 */
function handleUrlRedirects() {
  /**
   * URLパラメータをセッションストレージに保存する内部関数
   * @returns {boolean} 保存が成功した場合はtrue
   */
  function saveStateParamToStorage() {
    var urlParams = new URLSearchParams(window.location.search);
    var stateParam = urlParams.get('state');
    
    if (stateParam) {
      try {
        // 状態パラメータをセッションストレージに一時保存
        sessionStorage.setItem('originalStateParam', stateParam);
        return true;
      } catch (e) {
        console.error('パラメータの保存に失敗:', e);
      }
    }
    return false;
  }
  
  // GCSリダイレクトの検出（googleusercontent.comドメインとリファラー情報から判定）
  var isGcsRedirect = window.location.href.includes('googleusercontent.com') && 
                     (!document.referrer || document.referrer.includes('storage.cloud.google.com'));
  
  if (!isGcsRedirect) {
    // 通常アクセス時：状態パラメータをセッションストレージに保存
    return saveStateParamToStorage();
  } else {
    // リダイレクト後：先ほど保存した状態パラメータをURLに復元
    var savedState = sessionStorage.getItem('originalStateParam');
    if (savedState) {
      var currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('state', savedState);
      window.history.replaceState({}, document.title, currentUrl.toString());
      console.log('リダイレクト後に状態パラメータを復元:', savedState);
      return true;
    }
  }
  
  return false;
}

/**
 * URLクエリパラメータからツリー状態を取得
 * 
 * @returns {Object} デコードされたツリー状態オブジェクト
 */
function getStateFromUrl() {
  // URLクエリパラメータからstateを取得
  var urlParams = new URLSearchParams(window.location.search);
  var stateParam = urlParams.get('state');
  
  if (!stateParam) {
    // URLパラメータにない場合はセッションストレージから取得試行
    try {
      var savedStateParam = sessionStorage.getItem('originalStateParam');
      if (savedStateParam) {
        stateParam = savedStateParam;
        console.log('セッションストレージから状態を取得:', stateParam);
      } else {
        return {}; // 状態が見つからない場合は空オブジェクト
      }
    } catch (storageError) {
      console.warn('セッションストレージアクセスエラー:', storageError);
      return {}; 
    }
  } else {
    // パラメータがあればセッションに保存（リダイレクト対策）
    try {
      sessionStorage.setItem('originalStateParam', stateParam);
    } catch (e) {
      console.warn('セッションストレージ保存エラー:', e);
      // 保存エラーでも続行可能
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

/**
 * ハッシュフラグメントからツリー状態を取得
 * URLハッシュからstate=パラメータを抽出し、デコードして状態オブジェクトを返す
 * 
 * @returns {Object} デコードされたツリー状態オブジェクト
 */
function getStateFromHash() {
  var hash = window.location.hash;
  if (!hash || !hash.includes('state=')) {
    // ハッシュに状態がない場合、ローカルストレージから回復を試みる
    try {
      var savedStateParam = localStorage.getItem('kpiTreeStateParam');
      if (savedStateParam) {
        console.log('ローカルストレージから状態を回復しました');
        return decodeStateParam(savedStateParam);
      }
    } catch (e) {
      console.error('ローカルストレージアクセスエラー:', e);
    }
    return {};
  }
  
  try {
    // ハッシュから状態パラメータを抽出 (state=xxxxx の形式)
    var stateMatch = hash.match(/state=([^&]+)/);
    if (!stateMatch) return {};
    
    var stateParam = stateMatch[1];
    console.log('ハッシュから状態パラメータを検出:', stateParam.substring(0, 20) + '...');
    
    // パラメータをデコード
    return decodeStateParam(stateParam);
  } catch (e) {
    console.error('ハッシュ状態解析エラー:', e);
    return {};
  }
}

/**
 * ハッシュフラグメントから表示モード（日次/月次）を取得
 * 
 * @returns {string|null} 表示モード（'daily'または'monthly'）が見つかった場合はその値、見つからない場合はnull
 */
function getViewModeFromHash() {
  var hash = window.location.hash;
  if (!hash) return null;
  
  try {
    // viewMode=xxxの形式を抽出
    var viewModeMatch = hash.match(/viewMode=([^&#]+)/);
    if (!viewModeMatch) {
      console.log('ハッシュにviewModeパラメータが見つかりません:', hash);
      return null;
    }
    
    var viewMode = viewModeMatch[1];
    
    // 有効な表示モード値か確認
    if (viewMode === 'daily' || viewMode === 'monthly') {
      console.log('ハッシュから表示モードを取得成功:', viewMode);
      return viewMode;
    }
    
    console.warn('無効な表示モード値:', viewMode);
    return null;
  } catch (e) {
    console.error('表示モード取得エラー:', e);
    return null;
  }
}

/**
 * 状態パラメータをデコードする共通関数
 * Base64エンコードされた状態文字列をデコードしてオブジェクトに変換
 * 
 * @param {string} stateParam - デコードするBase64エンコード状態文字列
 * @returns {Object} デコードされた状態オブジェクト
 */
function decodeStateParam(stateParam) {
  try {
    // チェックサムとデータ部分を分離 (データ.チェックサム の形式)
    var parts = stateParam.split('.');
    var encodedData = parts[0]; // データ部分
    
    // URLセーフBase64から標準Base64に変換してデコード
    var decodedState = decodeURIComponent(encodedData);
    decodedState = atob(decodedState.replace(/-/g, '+').replace(/_/g, '/'));
    
    // JSONパースして状態オブジェクトに変換
    var parsedState = JSON.parse(decodedState);
    return parsedState;
  } catch (e) {
    console.error('状態パラメータデコードエラー:', e);
    
    // 互換性対応: 旧形式のパラメータをデコード試行
    try {
      var directDecodedState = decodeURIComponent(stateParam);
      directDecodedState = atob(directDecodedState.replace(/-/g, '+').replace(/_/g, '/'));
      var directParsedState = JSON.parse(directDecodedState);
      console.log('旧形式パラメータを正常にデコードしました');
      return directParsedState;
    } catch (directError) {
      console.error('互換性デコードにも失敗:', directError);
      return {}; // 両方のデコード方法が失敗した場合は空オブジェクト
    }
  }
}

/**
 * ツリー状態をURLハッシュパラメータ用にエンコード
 * 状態をURLセーフなBase64に変換し、チェックサムを付与して一意性を保証
 * 
 * @param {Object} state - エンコードするツリー状態オブジェクト
 * @returns {string} エンコードされた状態パラメータ文字列
 */
function generateStateParam(state) {
  // 状態が空の場合は空文字列を返す
  if (!state || Object.keys(state).length === 0) {
    return '';
  }
  
  // 再現性と一意性のためキーをソート
  var nodeIds = Object.keys(state).sort();
  var normalizedState = {};
  for (var i = 0; i < nodeIds.length; i++) {
    normalizedState[nodeIds[i]] = state[nodeIds[i]];
  }
  
  // 状態まとめ用フィンガープリントの生成
  var fingerprint = nodeIds.map(function(id) {
    return id.substring(0, 3) + state[id].substring(0, 1);
  }).join('');
  
  // 簡易チェックサム生成
  var checksum = 0;
  for (var k = 0; k < fingerprint.length; k++) {
    checksum += fingerprint.charCodeAt(k);
  }
  checksum = checksum % 1000;
  
  // JSON化してBase64エンコード、URLセーフ文字列に置換
  var jsonString = JSON.stringify(normalizedState);
  var encoded = btoa(jsonString)
    .replace(/\+/g, '-')  // URLセーフな文字に置換
    .replace(/\//g, '_')
    .replace(/=+$/, '');   // 末尾のパディング=を削除
  
  // 状態識別用ユニークハッシュを生成
  var uniqueHash = 's' + checksum + '-n' + nodeIds.length;
  
  // データとチェックサムを結合した最終パラメータを返す
  return encodeURIComponent(encoded) + '.' + uniqueHash;
}

/**
 * URL変更を監視して状態の整合性を保証する
 * 特にGoogle Cloud Storageリダイレクトなど、URLの自動変更をトラッキングして状態を維持
 */
function monitorUrlChanges() {
  var lastUrl = window.location.href;
  var checkInterval = 500; // 確認間隔(ミリ秒)
  
  setInterval(function() {
    // URLが変更された場合の処理
    if (lastUrl !== window.location.href) {
      console.log('URL変更を検出:', lastUrl, ' -> ', window.location.href);
      lastUrl = window.location.href;
      
      // GCSリダイレクトを検出した場合
      if (window.location.href.includes('googleusercontent.com')) {
        console.log('Google Cloud Storageリダイレクトを検出');
        
        // セッションから保存してある状態を取得
        var savedState = sessionStorage.getItem('originalStateParam');
        if (savedState) {
          console.log('保存された状態を復元します');
          
          // URLクエリパラメータから状態を取得して適用
          var state = getStateFromUrl();
          
          // 状態が存在する場合はツリーに適用
          if (state && Object.keys(state).length > 0) {
            if (typeof applyTreeState === 'function') {
              applyTreeState(state);
              console.log('リダイレクト後にツリー状態を復元しました');
            }
          }
        }
      }
      
      // URLハッシュ変更を検出した場合
      if (window.location.hash && window.location.hash.includes('state=')) {
        console.log('ハッシュパラメータ変更を検出');
        
        // ハッシュから状態を取得して適用
        var hashState = getStateFromHash();
        if (hashState && Object.keys(hashState).length > 0) {
          if (typeof applyTreeState === 'function') {
            applyTreeState(hashState);
            console.log('ハッシュ変更によりツリー状態を更新しました');
          }
        }
      }
    }
  }, checkInterval);
}

/**
 * ブラウザのURLを更新
 * History APIを使って現在のページURLを更新し、状態を保存
 * 
 * @param {string} queryString - 設定する新しいURLハッシュまたはクエリ文字列
 */
function updateBrowserUrl(queryString) {
  // History APIの存在確認
  if (window.history && window.history.replaceState) {
    try {
      // URLを更新（ページの再読み込みは行わない）
      window.history.replaceState({}, document.title, queryString);
      console.log('ブラウザURL更新:', queryString);
      
      // セッションストレージにも状態を保存（再読み込み時用）
      var state = saveTreeState();
      if (Object.keys(state).length > 0) {
        sessionStorage.setItem('kpiTreeState', JSON.stringify(state));
      }
    } catch (e) {
      console.error('URL更新エラー:', e);
    }
  }
}
