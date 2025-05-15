/**
 * カレンダーUI機能
 * 日付をクリックすると該当日付のHTMLにリンク
 */
document.addEventListener('DOMContentLoaded', function() {
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
  
  // 前月ボタン
  prevMonthBtn.addEventListener('click', function() {
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    renderCalendar();
  });
  
  // 翌月ボタン
  nextMonthBtn.addEventListener('click', function() {
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
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
    
    // データがある日（仮のダミーデータ）
    const hasDataDays = [5, 10, 15, 20, 25];
    
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
      if (hasDataDays.includes(i)) {
        dayEl.classList.add('has-data');
      }
      
      // 今日の日付にはスタイルを適用
      if (i === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear()) {
        dayEl.classList.add('today');
      }
      
      // 日付ごとのリンクを作成（ダミーURL）
      const dateLink = document.createElement('a');
      // YYYY-MM-DD 形式
      const formattedDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      // GCSのダミーURL
      dateLink.href = `https://storage.googleapis.com/kpi-tree-data/${formattedDate}.html`;
      dateLink.textContent = i;
      
      // 実際のデータがあるかどうかを確認してスタイルを適用（この例ではランダム）
      if (Math.random() > 0.7) {
        dayEl.classList.add('has-data');
      }
      
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
  
  // 初期カレンダーを描画
  renderCalendar();
});
