/**
 * カレンダーUI機能
 * 日付をクリックすると該当日付のHTMLにリンク
 * データがある日付には緑のマーカーを表示
 */
document.addEventListener('DOMContentLoaded', function() {
  // リンク修正関数 - 再利用可能なユーティリティ関数
  function fixOldLinks(delay) {
    setTimeout(function() {
      // 可能な限り多くのパターンを対象にする広範なセレクタ
      // カレンダー内の全てのリンクを対象に
      const allLinks = document.querySelectorAll('a');
      console.log(`リンク修正処理[${delay}ms]: 全てのリンクをチェックします (${allLinks.length}個)`);
      
      let fixedCount = 0;
      
      allLinks.forEach(link => {
        const href = link.getAttribute('href');
        // リンクがない場合やreportsを既に含むものはスキップ
        if (!href || href.includes('/reports/')) {
          return;
        }
        
        // GCSやkpi-tree-dataを含むリンクを検出
        if (href.includes('storage.googleapis.com') || href.includes('kpi-tree-data')) {
          fixedCount++;
          console.log(`修正対象リンク: ${href}`);
          
          // 両方の日付形式 (YYYY-MM-DD と YYYYMMDD) を検出する強化された正規表現
          const dateMatch = href.match(/\d{4}-\d{2}-\d{2}|\d{8}/);
          if (dateMatch) {
            let formattedDate = dateMatch[0];
            
            // YYYY-MM-DD 形式の場合、YYYYMMDD形式に変換
            if (formattedDate.includes('-')) {
              const dateParts = formattedDate.split('-');
              formattedDate = dateParts.join('');
            }
            
            console.log(`検出した日付: ${dateMatch[0]}, 変換後: ${formattedDate}`);
            
            // ベースURLを取得
            let baseUrlForLinks = window.PUBLIC_URL || '';
            console.log(`PUBLIC_URL: ${baseUrlForLinks}`);
            baseUrlForLinks = baseUrlForLinks.replace(/\/[^\/]*\.html$/, ''); // 末尾のファイル名を削除
            console.log(`ベースURL: ${baseUrlForLinks}`);
            
            // 新しいリンク形式
            let newUrl = '';
            if (baseUrlForLinks) {
              if (baseUrlForLinks.endsWith('/')) {
                newUrl = `${baseUrlForLinks}reports/${formattedDate}.html`;
              } else {
                newUrl = `${baseUrlForLinks}/reports/${formattedDate}.html`;
              }
            } else {
              // フォールバック
              newUrl = `/reports/${formattedDate}.html`;
            }
            
            link.setAttribute('href', newUrl);
            console.log(`リンク修正: ${href} → ${newUrl}`);
          } else {
            console.log(`日付パターンが見つからないリンク: ${href}`);
          }
        }
      });
      
      console.log(`修正完了: ${fixedCount}個のリンクを処理しました`);
      
      // カレンダー内のリンクが存在し、修正対象があった場合は別のアプローチも適用
      if (document.querySelector('.calendar-day a') && fixedCount === 0) {
        // 直接カレンダー内のすべてのリンクを修正
        console.log('カレンダー内のリンクを直接修正します');
        const calendarLinks = document.querySelectorAll('.calendar-day a');
        
        calendarLinks.forEach(link => {
          const href = link.getAttribute('href');
          // GCSのURLかどうかをチェック
          if (href && href.includes('storage.googleapis.com')) {
            // 日付を検出
            const month = currentMonth + 1;
            const day = link.textContent.trim();
            if (day && !isNaN(parseInt(day))) {
              // 日付を整形
              const dateForUrl = `${currentYear}${String(month).padStart(2, '0')}${String(parseInt(day)).padStart(2, '0')}`;
              
              // 新しいURLを生成
              let baseUrlForLinks = window.PUBLIC_URL || '';
              baseUrlForLinks = baseUrlForLinks.replace(/\/[^\/]*\.html$/, '');
              
              let newUrl = '';
              if (baseUrlForLinks) {
                if (baseUrlForLinks.endsWith('/')) {
                  newUrl = `${baseUrlForLinks}reports/${dateForUrl}.html`;
                } else {
                  newUrl = `${baseUrlForLinks}/reports/${dateForUrl}.html`;
                }
              } else {
                newUrl = `/reports/${dateForUrl}.html`;
              }
              
              link.setAttribute('href', newUrl);
              console.log(`カレンダーリンク修正: ${href} → ${newUrl}`);
            }
          }
        });
      }
    }, delay || 0);
  }
  
  // 初回のリンク修正（ページロード直後）
  fixOldLinks(100);
  
  // 第2回のリンク修正（少し待ってから）
  fixOldLinks(500);
  
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
      
      // すべての日付に対してリンクを有効にする
      dateLink.href = reportUrl;
      dateLink.title = `${formattedDate}のレポートを表示`;
      
      // データがある日付には特別なクラスを追加（スタイリング用）
      if (hasDataForDate(currentYear, currentMonth, i)) {
        dateLink.classList.add('has-data');
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
  
  // カレンダー描画時のフック関数を上書き
  const originalRenderCalendar = renderCalendar;
  renderCalendar = function() {
    // 元の描画関数を呼び出し
    originalRenderCalendar.apply(this, arguments);
    
    // カレンダー描画後にリンク修正を実行（遅延付き）
    console.log('カレンダー描画後のリンク修正をスケジュール');
    fixOldLinks(50);  // カレンダー描画直後
    fixOldLinks(300); // 少し待ってから
  };
  
  //月切り替えボタンのクリック時にも修正を適用
  const originalPrevMonthClick = prevMonthBtn.onclick || function(){};
  prevMonthBtn.onclick = function(e) {
    originalPrevMonthClick.call(this, e);
    fixOldLinks(100);
  };
  
  const originalNextMonthClick = nextMonthBtn.onclick || function(){};
  nextMonthBtn.onclick = function(e) {
    originalNextMonthClick.call(this, e);
    fixOldLinks(100);
  };
});

