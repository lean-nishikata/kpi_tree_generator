/**
 * カレンダーUI機能
 * 日付をクリックすると該当日付のHTMLにリンク
 * データがある日付には緑のマーカーを表示
 */
document.addEventListener('DOMContentLoaded', function() {
  // 全てのリンクが適切に生成されるようになったので、
  // 古いGCS URLパターン修正は不要になりました。
  // (yyyy/mm/dd 古いURL修正コードを削除しました)
  
  // カレンダー要素
  const prevMonthBtn = document.getElementById('prev-month');
  const nextMonthBtn = document.getElementById('next-month');
  const currentMonthEl = document.getElementById('current-month');
  const calendarDaysEl = document.getElementById('calendar-days');
  
  // 現在の日付
  let currentDate = new Date();
  let currentMonth = currentDate.getMonth();
  let currentYear = currentDate.getFullYear();
  
  // target_dateパラメータを確認
  let targetDate = null;
  
  // まず、data-target-date属性が設定されているか確認
  const dataTargetDateEl = document.querySelector('[data-target-date]');
  if (dataTargetDateEl) {
    const dataTargetDateStr = dataTargetDateEl.getAttribute('data-target-date');
    if (dataTargetDateStr && dataTargetDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const parts = dataTargetDateStr.split('-');
      targetDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      console.log('data-target-date属性から対象日付を検出:', dataTargetDateStr);
    }
  }
  
  // 現在のデータ表示から取得
  if (!targetDate) {
    const dataDateEl = document.querySelector('.data-date');
    if (dataDateEl) {
      const dateText = dataDateEl.textContent;
      const datePattern = /\d{4}年\d{2}月\d{2}日/;
      const dateMatch = dateText.match(datePattern);
      if (dateMatch) {
        const dateStr = dateMatch[0]; // 例: '2025年05月21日'
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(5, 7)) - 1; // 0-11
        const day = parseInt(dateStr.substring(8, 10));
        targetDate = new Date(year, month, day);
        console.log('日付表示から対象日付を検出:', dateStr);
      }
    }
  }
  
  // 現在開いているページの日付を取得（YYYYMMDD.html または reports/YYYYMMDD.html）
  let currentPageDate = null;
  try {
    const currentPath = window.location.pathname;
    // reports/YYYYMMDD.html または YYYYMMDD.html パターンを検出
    const dateMatch = currentPath.match(/\/(\d{8})\.html$/) || currentPath.match(/\/reports\/(\d{8})\.html$/);
    if (dateMatch && dateMatch[1]) {
      // YYYYMMDD形式を解析
      const dateStr = dateMatch[1];
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1; // 0-11
      const day = parseInt(dateStr.substring(6, 8));
      currentPageDate = new Date(year, month, day);
      console.log('現在のページ日付を検出:', currentPageDate);
      
      // target_dateが未設定の場合は、現在のページ日付をtarget_dateとして使用
      if (!targetDate) {
        targetDate = currentPageDate;
      }
    }
  } catch (e) {
    console.error('ページ日付の解析エラー:', e);
  }
  
  // target_dateが見つかった場合、その日付の月を表示するように設定
  if (targetDate) {
    currentYear = targetDate.getFullYear();
    currentMonth = targetDate.getMonth();
    console.log(`カレンダーを対象日付（${targetDate.getFullYear()}年${targetDate.getMonth() + 1}月${targetDate.getDate()}日）の月に設定しました`);
  }
  
  // 月の名前（日本語）
  const monthNames = [
    '1月', '2月', '3月', '4月', '5月', '6月',
    '7月', '8月', '9月', '10月', '11月', '12月'
  ];
  
  // データがある日付の配列
  let datesWithData = [];
  // データの期間の境界（最小日付と最大日付）
  let minDate = null;
  let maxDate = null;
  
  // デバッグ：初期状態の出力
  console.log('【デバッグ】カレンダー初期化時のdatesWithData:', [...datesWithData]);
  // ベースURL（YAMLから取得）
  let baseUrl = '';
  
  // 日付を文字列からDateオブジェクトに変換する関数
  function parseDate(dateString) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  
  // 日付をYYYYMMDD形式の文字列に変換する関数
  function formatDateYYYYMMDD(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }
  
  // 日付がデータがある日付かどうかをチェック
  function hasDataForDate(year, month, day) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const hasData = datesWithData.includes(dateStr);
    
    // デバッグ：緑ポッチの対象になる日付を出力
    if (hasData) {
      console.log(`【デバッグ】緑ポッチ対象の日付: ${dateStr}`);
    }
    
    return hasData;
  }
  
  // 日付がデータ期間内かどうかをチェック
  function isDateInRange(year, month) {
    if (!minDate || !maxDate) return true;
    
    const checkDate = new Date(year, month, 1);
    const checkMonthEnd = new Date(year, month + 1, 0);
    
    return (
      (checkDate >= new Date(minDate.getFullYear(), minDate.getMonth(), 1)) &&
      (checkMonthEnd <= new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0))
    );
  }
  
  // YAMLからのベースURLとJSONからの日付データを取得
  function fetchCalendarData(userTargetDate) {
    // targetDateパラメータが指定されているか確認
    const hasTargetDate = userTargetDate instanceof Date && !isNaN(userTargetDate.getTime());
    console.log(`カレンダーデータ取得関数が呼ばれました，ターゲット日付: ${hasTargetDate ? userTargetDate.toISOString() : '未指定'}`);
    
    // baseURLをページのグローバル変数から取得
    if (window.PUBLIC_URL) {
      baseUrl = window.PUBLIC_URL;
      baseUrl = baseUrl.replace(/\/[^\/]*\.html$/, ''); // 末尾のHTML名を削除
    }
    
    // 日付データをJSONファイルから取得
    // フォールバックとして空のデータを使用
    const fallbackData = {
      datesWithData: []
    };
    console.log('【デバッグ】フォールバックデータ:', fallbackData);
    
    // データ処理関数
    function processJsonData(data) {
      console.log('【デバッグ】processJsonData受け取ったデータ:', data);
      
      if (data && Array.isArray(data.datesWithData)) {
        // 日付データを保存
        datesWithData = data.datesWithData;
        console.log('【デバッグ】datesWithDataを設定:', [...datesWithData]);
        
        // 最小日付と最大日付を取得
        if (datesWithData.length > 0) {
          // 日付を昇順でソート
          datesWithData.sort();
          minDate = parseDate(datesWithData[0]);
          
          // 昨日の日付を最大日付として設定
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          maxDate = yesterday;
          
          console.log('日付範囲:', minDate, maxDate, '(昨日までに制限)');
          
          // ターゲット日付が指定されている場合は、その日付の月を優先表示
          if (hasTargetDate && userTargetDate) {
            // ターゲット日付が有効範囲（最小日付から最大日付）内か確認
            const targetYearMonth = new Date(userTargetDate.getFullYear(), userTargetDate.getMonth(), 1);
            const minYearMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
            const maxYearMonth = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
            
            if (targetYearMonth >= minYearMonth && targetYearMonth <= maxYearMonth) {
              // 有効範囲内の場合はターゲット日付の月を使用
              currentMonth = userTargetDate.getMonth();
              currentYear = userTargetDate.getFullYear();
              console.log(`指定されたターゲット日付の月を表示します: ${currentYear}年${currentMonth + 1}月`);
            } else {
              console.log(`ターゲット日付が有効範囲外です: ${userTargetDate.toISOString()}, 範囲: ${minYearMonth.toISOString()} - ${maxYearMonth.toISOString()}`);
              // デフォルトの処理を実行
              setDefaultMonth();
            }
          } else {
            // ターゲット日付が未指定の場合はデフォルトの月設定を使用
            setDefaultMonth();
          }
          
          // デフォルトの月設定を行う関数
          function setDefaultMonth() {
            // 現在の表示月を、最小日付と最大日付の間にある今日の月、
            // または単に最小日付の月に設定
            const today = new Date();
            if (
              today >= new Date(minDate.getFullYear(), minDate.getMonth(), 1) &&
              today <= new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0)
            ) {
              currentMonth = today.getMonth();
              currentYear = today.getFullYear();
            } else {
              currentMonth = minDate.getMonth();
              currentYear = minDate.getFullYear();
            }
          }
          
          // ボタンの有効/無効を更新
          updateNavigationButtons();
          // カレンダーを描画
          renderCalendar();
        }
      }
    }
    
    // 検索パス
    // public_urlに基づいて外部カレンダーデータのURLを生成
    let externalCalendarUrl = '';
    if (baseUrl) {
      const baseUrlWithoutFile = baseUrl.replace(/\/[^\/]*\.html$/, '');
      if (baseUrlWithoutFile.endsWith('/')) {
        externalCalendarUrl = `${baseUrlWithoutFile}static/calendar-data.json`;
      } else {
        externalCalendarUrl = `${baseUrlWithoutFile}/static/calendar-data.json`;
      }
    }
    
    // ローカルバックアップパス
    const localPaths = [
      './static/calendar-data.json',
      '/static/calendar-data.json',
      'calendar-data.json'
    ];
    
    // キャッシュを回避するためのタイムスタンプパラメータを追加
    const timestamp = new Date().getTime();
    const urlWithCache = externalCalendarUrl ? `${externalCalendarUrl}?t=${timestamp}` : '';
    
    // まず外部URLから取得を試みる（URLが設定されている場合）
    const initialFetch = externalCalendarUrl 
      ? fetch(urlWithCache)
      : Promise.reject(new Error('外部URLが設定されていません'));
      
    // 外部URLから取得を試みる、失敗したらローカルパスを試す
    initialFetch
      .catch(() => {
        console.warn('外部URLからのカレンダーデータ取得に失敗しました。ローカルのパスを試します。');
        // 外部URLから失敗した場合、ローカルのパスを順に試す
        return fetch(localPaths[0])
          .catch(() => fetch(localPaths[1]))
          .catch(() => fetch(localPaths[2]))
          .catch(() => {
            console.warn('すべてのパスでカレンダーデータの取得に失敗しました。フォールバックデータを使用します。');
            // 全てのパスで失敗した場合はフォールバックを返す
            return { 
              ok: true,
              json: () => Promise.resolve(fallbackData)
            };
          });
      })
      .then(response => {
        if (!response.ok && response.ok !== undefined) {
          console.error('応答が正しくありません');
          return Promise.resolve(fallbackData);
        }
        return response.json();
      })
      .then(data => {
        console.log('カレンダーデータを取得しました', data);
        // 空のJSONファイルの場合も適切に処理
        if (!data || !data.datesWithData || !Array.isArray(data.datesWithData)) {
          console.warn('カレンダーデータが正しい形式ではありません。空のデータを使用します。');
          console.log('【デバッグ】フォールバックデータに切り替え');
          return processJsonData(fallbackData);
        }
        processJsonData(data);
      })
      .catch(error => {
        console.error('日付データの読み込みエラー:', error);
        // エラー時はフォールバックデータを使用
        processJsonData(fallbackData);
      });
  }
  
  // ナビゲーションボタンの表示/非表示を更新
  function updateNavigationButtons() {
    if (minDate && maxDate) {
      // 【デバッグ強化】関数内の現在の状態を詳細に出力
      console.log('【NAV-DEBUG】updateNavigationButtons呼び出し時の状態:', {
        現在表示中の月: currentMonth + 1,
        現在表示中の年: currentYear,
        分岐ポイント: new Error().stack.split('\n')[1]
      });
      
      // 前月ボタンを制御
      const prevMonth = new Date(currentYear, currentMonth - 1, 1);
      const canGoToPrevMonth = prevMonth >= new Date(minDate.getFullYear(), minDate.getMonth(), 1);
      
      // 次月ボタンを制御
      const nextMonth = new Date(currentYear, currentMonth + 1, 1);
      
      // 今日の月を取得
      const today = new Date();
      const todayMonth = today.getMonth();
      const todayYear = today.getFullYear();
      const currentMonthFirst = new Date(today.getFullYear(), today.getMonth(), 1);
      
      // 【デバッグ強化】日付比較情報を詳細に出力
      console.log('【NAV-DEBUG】日付比較情報:', {
        現在の月: currentMonth + 1,
        現在の年: currentYear,
        今日の月: todayMonth + 1,
        今日の年: todayYear,
        次の月: (nextMonth.getMonth() + 1),
        次の月の年: nextMonth.getFullYear(),
        今日の月先頭: currentMonthFirst.toISOString().split('T')[0]
      });
      
      // 次月ボタンを完全に無効化: 現在表示している月が今月の場合または次の月が今月より後の場合
      let canGoToNextMonth = false;
      if (currentMonth === todayMonth && currentYear === todayYear) {
        // 今月を表示している場合は次月に進めない
        canGoToNextMonth = false;
        console.log('【NAV-DEBUG】今月表示中なので次月ボタンは無効化');
      } else {
        // 【修正】今月以外の月を表示している場合、次の月が今月以下なら切り替え可能
        // 次の月の年と月を計算
        let nextMonthNumber = currentMonth + 1;
        let nextYearNumber = currentYear;
        if (nextMonthNumber > 11) {
          nextMonthNumber = 0;
          nextYearNumber++;
        }
        
        // 【決定的な修正】要素を比較して判定、次の月が今日の月より小さいか、または同じ月なら可能
        const canNavigateToNextMonth = (
          nextYearNumber < todayYear || 
          (nextYearNumber === todayYear && nextMonthNumber <= todayMonth)
        );
        
        // 【判定ロジック確認用】
        console.log('【NAV-DEBUG】次月ボタンの判定情報 (修正後):', {
          現在表示月: currentMonth + 1,
          次の月: nextMonthNumber + 1,
          次の年: nextYearNumber,
          今日の月: todayMonth + 1,
          今日の年: todayYear,
          結果: canNavigateToNextMonth,
          判定式: `${nextYearNumber} < ${todayYear} || (${nextYearNumber} === ${todayYear} && ${nextMonthNumber} <= ${todayMonth})`
        });
        
        canGoToNextMonth = canNavigateToNextMonth;
      }

      // ボタンの表示/非表示を切り替え
      prevMonthBtn.style.visibility = canGoToPrevMonth ? 'visible' : 'hidden';
      nextMonthBtn.style.visibility = canGoToNextMonth ? 'visible' : 'hidden';
      nextMonthBtn.disabled = !canGoToNextMonth;
      
      // 今月表示中の場合は強制的に次月ボタンを無効化
      if (currentMonth === todayMonth && currentYear === todayYear) {
        nextMonthBtn.style.visibility = 'hidden';
        nextMonthBtn.disabled = true;
      }
      
      console.log('ナビゲーションボタン更新: 今月=', (currentMonth === todayMonth && currentYear === todayYear),
                  '前月=', canGoToPrevMonth, '次月=', canGoToNextMonth);
    }
  }
  
  // 前月ボタン
  prevMonthBtn.addEventListener('click', function() {
    if (this.disabled) return;
    
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    
    updateNavigationButtons();
    renderCalendar();
  });
  
  // 翻月ボタン - 完全に修正したバージョン
  nextMonthBtn.addEventListener('click', function() {
    if (this.disabled || this.style.visibility === 'hidden') return;
    
    // デバッグ情報追加
    console.log('【月移動-修正版】クリック前状態:', {
      現在月: currentMonth + 1,
      現在年: currentYear
    });
    
    // 今日の日付を取得
    const today = new Date();
    const todayMonth = today.getMonth();
    const todayYear = today.getFullYear();
    
    // 次の月への移動処理
    let targetMonth = currentMonth + 1;
    let targetYear = currentYear;
    
    // 年をまたぐ場合の処理
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear++;
    }
    
    console.log('【月移動-修正版】計算結果:', {
      現在月: currentMonth + 1,
      移動先月: targetMonth + 1,
      現在年: currentYear,
      移動先年: targetYear,
      今日の月: todayMonth + 1,
      今日の年: todayYear
    });
    
    // 未来の月への移動を制限
    if (targetYear > todayYear || (targetYear === todayYear && targetMonth > todayMonth)) {
      console.log('【月移動-修正版】移動先が未来の月のため移動をキャンセル');
      return;
    }
    
    // 実際に月を移動
    console.log('【月移動-修正版】移動実行:', {
      移動前: currentMonth + 1 + '月' + currentYear + '年',
      移動後: targetMonth + 1 + '月' + targetYear + '年'
    });
    
    // 移動先を設定
    currentMonth = targetMonth;
    currentYear = targetYear;
    
    // 再度確認: 進めた後の月が今月以下かチェック
    if (currentYear > todayYear || (currentYear === todayYear && currentMonth > todayMonth)) {
      // 間違って未来に進んでしまった場合は今月に戻す
      console.log('未来の月に移動してしまったので今月に戻します');
      currentMonth = todayMonth;
      currentYear = todayYear;
    }
    
    updateNavigationButtons();
    renderCalendar();
  });
  
  // カレンダー描画関数
  function renderCalendar() {
    // 月表示の更新
    currentMonthEl.textContent = `${currentYear}年 ${monthNames[currentMonth]}`;
    
    // カレンダーをクリア
    calendarDaysEl.innerHTML = '';
    
    // 月初めの日
    const firstDay = new Date(currentYear, currentMonth, 1);
    // 月末の日
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    
    // 前月の最終日
    const prevLastDay = new Date(currentYear, currentMonth, 0);
    const prevDays = prevLastDay.getDate();
    
    // 月初めの曜日（0: 日曜日, 1: 月曜日, ..., 6: 土曜日）
    const firstDayIndex = firstDay.getDay();
    
    // 月末の曜日
    const lastDayIndex = lastDay.getDay();
    
    // 翌月の日数（カレンダーの最後の行を埋めるため）
    const nextDays = 7 - lastDayIndex - 1;
    
    // 今日の日付
    const today = new Date();
    
    // 前月の日を表示
    for (let x = firstDayIndex; x > 0; x--) {
      const day = prevDays - x + 1;
      const dayEl = document.createElement('div');
      dayEl.className = 'calendar-day other-month';
      dayEl.textContent = day;
      calendarDaysEl.appendChild(dayEl);
    }
    
    // 当月の日を表示
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const dayEl = document.createElement('div');
      dayEl.className = 'calendar-day';
      
      // データがある日付にはマーカーを表示
      if (hasDataForDate(currentYear, currentMonth, i)) {
        dayEl.classList.add('has-data');
      }
      
      // 今日の日付にはスタイルを適用
      if (i === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear()) {
        dayEl.classList.add('today');
      }
      
      // target_dateには特別なハイライトを適用
      if (targetDate && i === targetDate.getDate() && 
          currentMonth === targetDate.getMonth() && 
          currentYear === targetDate.getFullYear()) {
        dayEl.classList.add('target-date');
        // 要素にデータ属性を追加して後でJavaScriptで参照できるようにする
        dayEl.setAttribute('data-is-target-date', 'true');
      }
      
      // 現在のページ日付があれば、その日付にハイライトを適用
      if (currentPageDate && i === currentPageDate.getDate() && 
          currentMonth === currentPageDate.getMonth() && 
          currentYear === currentPageDate.getFullYear()) {
        dayEl.classList.add('current-page-date');
      }
      
      // 日付ごとのリンクを作成
      const dateLink = document.createElement('a');
      // YYYY-MM-DD 形式
      const formattedDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      // YYYYMMDD形式（URLパス用）
      const dateForUrl = formatDateYYYYMMDD(new Date(currentYear, currentMonth, i));
      
      // 対象の日付
      const dateObj = new Date(currentYear, currentMonth, i);
      // 昨日までの日付かどうかをチェック
      const isDateAvailable = dateObj <= maxDate;
      
      // リンク先を生成（YAMLのpublic_urlに基づく）
      let reportUrl = '';
      if (baseUrl) {
        // baseUrlからindex.htmlなどのファイル名を削除
        const baseUrlWithoutFile = baseUrl.replace(/\/[^\/]*\.html$/, '');
        
        // reports/YYYYMMDD.html 形式のURLを生成
        if (baseUrlWithoutFile.endsWith('/')) {
          reportUrl = `${baseUrlWithoutFile}reports/${dateForUrl}.html`;
        } else {
          reportUrl = `${baseUrlWithoutFile}/reports/${dateForUrl}.html`;
        }
      } else {
        // フォールバック
        reportUrl = `/reports/${dateForUrl}.html`;
      }
      
      // 昨日までの日付に対してのみリンクを有効にする
      if (isDateAvailable) {
        // 現在の表示モードを取得
        const currentViewMode = window._viewMode || 'daily';
        
        // 【デバッグ強化】日付リンク生成時の表示モード情報
        console.log(`【LINK-MODE-DEBUG】${formattedDate}の日付リンク作成時の表示モード:`, {
          グローバルモード: window._viewMode,
          使用するモード: currentViewMode,
          元のURL: reportUrl
        });
        
        // URLの処理
        let urlWithViewMode = reportUrl;
        
        // URLがハッシュを含むか確認
        if (urlWithViewMode.includes('#')) {
          // ハッシュがある場合は、ハッシュの前にクエリパラメータを追加
          const parts = urlWithViewMode.split('#');
          urlWithViewMode = `${parts[0]}?viewMode=${currentViewMode}#${parts[1]}`;
        } else {
          // ハッシュがない場合は通常のクエリパラメータを追加
          urlWithViewMode = `${urlWithViewMode}?viewMode=${currentViewMode}`;
        }
        
        // 【デバッグ強化】生成したURLを確認
        console.log(`【LINK-MODE-DEBUG】${formattedDate}の日付リンクの最終URL:`, urlWithViewMode);
        
        dateLink.href = urlWithViewMode;
        dateLink.title = `${formattedDate}のレポートを${currentViewMode === 'daily' ? '日次' : '月次'}モードで表示`;
        
        // データがある日付には特別なクラスを追加（スタイリング用）
        if (hasDataForDate(currentYear, currentMonth, i)) {
          dateLink.classList.add('has-data');
        }
      } else {
        // 将来の日付の場合は無効なリンクにする
        dateLink.classList.add('no-data');
        dateLink.title = `${formattedDate}のデータはまだ利用できません`;
      }
      
      dateLink.textContent = i;
      dayEl.appendChild(dateLink);
      calendarDaysEl.appendChild(dayEl);
    }
    
    // 翌月の日を表示
    for (let j = 1; j <= nextDays; j++) {
      const dayEl = document.createElement('div');
      dayEl.className = 'calendar-day other-month';
      dayEl.textContent = j;
      calendarDaysEl.appendChild(dayEl);
    }
    
    // レンダリング後にターゲット日付があればそこにスクロール
    if (targetDate) {
      // 少し遅延させてレンダリング完了後にスクロールする
      setTimeout(() => {
        const targetElement = document.querySelector('.calendar-day.target-date');
        if (targetElement) {
          // スクロールする
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // 注目を引くためのアニメーションを追加
          targetElement.style.animation = 'highlight-pulse 1.5s ease-in-out 2';
          console.log(`対象日付 ${targetDate.getFullYear()}年${targetDate.getMonth() + 1}月${targetDate.getDate()}日 にスクロールしました`)
        }
      }, 300);
    }
  }
  
  // target-dateのスタイルを追加
  const style = document.createElement('style');
  style.textContent = `
    .calendar-day.target-date {
      background-color: #ffe0b2;
      border: 2px solid #ff9800;
      font-weight: bold;
      position: relative;
      z-index: 1;
    }
    
    @keyframes highlight-pulse {
      0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 152, 0, 0.7); }
      50% { transform: scale(1.1); box-shadow: 0 0 10px 5px rgba(255, 152, 0, 0.5); }
      100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 152, 0, 0); }
    }
  `;
  document.head.appendChild(style);
  
  // 初期データの読み込みとカレンダー描画
  fetchCalendarData(targetDate);
  
  // リンク修正関数が不要になったため、フックも削除しました
  // 必要に応じて後で再実装することができます
});

