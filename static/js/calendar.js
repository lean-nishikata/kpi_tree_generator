/**
 * カレンダーUI機能
 * 日付をクリックすると該当日付のHTMLにリンク
 * データがある日付には緑のマーカーを表示
 */
document.addEventListener('DOMContentLoaded', function() {
  // 既存リンクの修正処理（遅延実行してレンダリング後に適用）
  setTimeout(function() {
    const oldLinks = document.querySelectorAll('a[href*="kpi-tree-data/2025-"]');
    console.log('値修正処理中: 古い形式のリンクを探して修正します', oldLinks.length);
    
    oldLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href && href.includes('/kpi-tree-data/') && !href.includes('/reports/')) {
        const dateMatch = href.match(/\d{4}-\d{2}-\d{2}/);
        if (dateMatch) {
          const date = dateMatch[0];
          const dateParts = date.split('-');
          const formattedDate = dateParts.join('');
          const newUrl = `https://storage.googleapis.com/kpi-tree-data/reports/${formattedDate}.html`;
          link.setAttribute('href', newUrl);
          console.log(`リンク修正: ${href} → ${newUrl}`);
        }
      }
    });
  }, 500);
  
  // カレンダー要素
  const prevMonthBtn = document.getElementById('prev-month');
  const nextMonthBtn = document.getElementById('next-month');
  const currentMonthEl = document.getElementById('current-month');
  const calendarDaysEl = document.getElementById('calendar-days');
  
  // 現在の日付
  let currentDate = new Date();
  let currentMonth = currentDate.getMonth();
  let currentYear = currentDate.getFullYear();
  
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
          maxDate = parseDate(datesWithData[datesWithData.length - 1]);
          
          console.log('日付範囲:', minDate, maxDate);
          
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
    
    // 複数のパスを試す
    const paths = [
      './static/calendar-data.json',
      '/static/calendar-data.json',
      'calendar-data.json'
    ];
    
    // データ取得試行
    fetch(paths[0])
      .catch(() => fetch(paths[1]))
      .catch(() => fetch(paths[2]))
      .catch(() => {
        console.warn('カレンダーデータの取得に失敗しました。フォールバックデータを使用します。');
        // 全てのパスで失敗した場合はフォールバックを返す
        return { 
          ok: true,
          json: () => Promise.resolve(fallbackData)
        };
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
      const canGoToNextMonth = nextMonth <= new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
      
      // ボタンの表示/非表示を切り替え
      prevMonthBtn.style.visibility = canGoToPrevMonth ? 'visible' : 'hidden';
      nextMonthBtn.style.visibility = canGoToNextMonth ? 'visible' : 'hidden';
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
      
      // 日付ごとのリンクを作成
      const dateLink = document.createElement('a');
      // YYYY-MM-DD 形式
      const formattedDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      // YYYYMMDD形式（URLパス用）
      const dateForUrl = formatDateYYYYMMDD(new Date(currentYear, currentMonth, i));
      
      // リンク先を生成（YAMLのpublic_urlに基づく）
      let reportUrl = '';
      if (baseUrl) {
        // baseURLのドメイン部分とパスを取得（別の例: https://storage.googleapis.com/your-bucket)
        const urlParts = baseUrl.match(/^(https?:\/\/[^/]+)(\/.*)?$/);
        if (urlParts) {
          const domain = urlParts[1]; // 例: https://storage.googleapis.com
          const path = urlParts[2] || ''; // 例: /your-bucket
          
          // ドメインを抽出（例：kpi-tree-data）
          const bucketMatch = path.match(/\/([^\/]+)/);
          const bucket = bucketMatch ? bucketMatch[1] : '';
          
          // 必ずこの形式に強制する（https://storage.googleapis.com/kpi-tree-data/reports/20250515.html）
          // バケット名とパスをハードコードして確実に生成
          reportUrl = `${domain}/kpi-tree-data/reports/${dateForUrl}.html`;
        } else {
          // 他のパターンでもreportsディレクトリを含める
          if (baseUrl.endsWith('/')) {
            reportUrl = `${baseUrl}reports/${dateForUrl}.html`;
          } else {
            reportUrl = `${baseUrl}/reports/${dateForUrl}.html`;
          }
        }
      } else {
        // フォールバック - この場合も必たreportsディレクトリを含める
        reportUrl = `/reports/${dateForUrl}.html`;
      }
      
      // データがある場合のみリンクを有効に
      if (hasDataForDate(currentYear, currentMonth, i)) {
        dateLink.href = reportUrl;
        dateLink.title = `${formattedDate}のレポートを表示`;
      } else {
        dateLink.classList.add('no-data');
        dateLink.title = `${formattedDate}のデータはありません`;
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
});

