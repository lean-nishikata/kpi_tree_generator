/**
 * KPIツリージェネレーター：テキストフォーマッター
 * 長いテキストを持つノードを検出し、適切なスタイルを適用します
 */

// DOMの準備ができたら実行
document.addEventListener('DOMContentLoaded', function() {
  // 少し遅延させて実行（他のスクリプトよりも後に実行するため）
  setTimeout(function() {
    console.log('長いテキストノードの検出と修正を開始...');
    formatLongTextNodes();
  }, 100);
});

/**
 * 長いテキストを持つノードを検出し、スタイルを適用
 */
function formatLongTextNodes() {
  // すべてのノードテキスト要素を取得
  var nodeTexts = document.querySelectorAll('.node-text');
  
  // 長いテキストの閾値
  var LONG_TEXT_THRESHOLD = 15;
  var VERY_LONG_TEXT_THRESHOLD = 25;
  
  // キーワードリスト
  var keywords = ['長い', '確認', '全部', '表示', 'ああ'];
  
  // 各ノードテキストに対して処理
  nodeTexts.forEach(function(textElement) {
    var text = textElement.textContent;
    var isLongText = text.length > LONG_TEXT_THRESHOLD;
    
    // キーワードを含むか確認
    var containsKeyword = keywords.some(function(keyword) {
      return text.includes(keyword);
    });
    
    // 特別に長いテキストか、キーワードを含む場合
    if (text.length > VERY_LONG_TEXT_THRESHOLD || containsKeyword) {
      console.log('特別に長いテキストを検出:', text);
      
      // 親ノード要素を取得
      var nodeElement = textElement.closest('.node');
      if (nodeElement) {
        // ノードにクラスを追加
        nodeElement.classList.add('node-long-text');
        
        // テキスト要素にもクラスを追加
        textElement.classList.add('node-text-long');
        
        // テキストのスタイルを強制的に設定
        textElement.style.whiteSpace = 'normal';
        textElement.style.wordBreak = 'break-word';
        textElement.style.overflow = 'visible';
        textElement.style.textOverflow = 'clip';
        textElement.style.marginBottom = '10px';
        
        // 値要素のスタイルも調整
        var valueElement = nodeElement.querySelector('.value');
        if (valueElement) {
          valueElement.style.marginTop = 'auto';
          valueElement.style.paddingTop = '5px';
          valueElement.style.borderTop = '1px dotted #ccc';
        }
      }
    }
  });
  
  console.log('長いテキストノードの修正が完了しました');
}
