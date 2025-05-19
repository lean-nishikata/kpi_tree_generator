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
    }
  } catch (e) {
    console.error('ページ日付の解析エラー:', e);
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
    return datesWithData.includes(dateStr);
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
  function fetchCalendarData() {
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
    
    // データ処理関数
    function processJsonData(data) {
      if (data && Array.isArray(data.datesWithData)) {
        // 日付データを保存
        datesWithData = data.datesWithData;
        
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
      // 前月ボタンを制御
      const prevMonth = new Date(currentYear, currentMonth - 1, 1);
      const canGoToPrevMonth = prevMonth >= new Date(minDate.getFullYear(), minDate.getMonth(), 1);
      
      // 次月ボタンを制御
      const nextMonth = new Date(currentYear, currentMonth + 1, 1);
      
      // 今日の月を取得
      const today = new Date();
      const currentMonthFirst = new Date(today.getFullYear(), today.getMonth(), 1);
      
      // 昨日の月までしか行けないようにする（今日の月より先の月には進めない）
      // 昨日の月 = 今日と同じ月
      const canGoToNextMonth = nextMonth <= currentMonthFirst;
      
      // 先月ボタンの表示/非表示はそのまま処理
      
      // ボタンの表示/非表示を切り替え
      prevMonthBtn.style.visibility = canGoToPrevMonth ? 'visible' : 'hidden';
      
      // 今月の場合は強制非表示、それ以外の場合は条件に基づいて表示/非表示
      if (currentMonth === today.getMonth() && currentYear === today.getFullYear()) {
        // display:noneではなくvisibility:hiddenを使用して要素の配置を維持
        nextMonthBtn.style.visibility = 'hidden';
      } else {
        nextMonthBtn.style.visibility = canGoToNextMonth ? 'visible' : 'hidden';
      }
      
      console.log('ナビゲーションボタン更新: 前月=', canGoToPrevMonth, '次月=', canGoToNextMonth);
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
  
  // 翌月ボタン
  nextMonthBtn.addEventListener('click', function() {
    if (this.disabled) return;
    
    // 現在の日付を取得
    const today = new Date();
    const todayMonth = today.getMonth();
    const todayYear = today.getFullYear();
    
    // 次の月が今月以下の場合だけ移動可能
    let nextMonth = currentMonth + 1;
    let nextYear = currentYear;
    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear++;
    }
    
    // 日付比較（次の月が今月より後は移動不可）
    if (nextYear > todayYear || (nextYear === todayYear && nextMonth > todayMonth)) {
      console.log('未来の月には移動できません');
      return;
    }
    
    // 条件を通過した場合のみ月を進める
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
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
        dateLink.href = reportUrl;
        dateLink.title = `${formattedDate}のレポートを表示`;
        
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
  }
  
  // 初期データの読み込みとカレンダー描画
  fetchCalendarData();
  
  // リンク修正関数が不要になったため、フックも削除しました
  // 必要に応じて後で再実装することができます
});

