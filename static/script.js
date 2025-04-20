// KPI Tree JavaScript
// Using old-school function approach to ensure maximum browser compatibility
function kpiTreeInit() {
  // Apply theme and direction from config
  var theme = document.body.getAttribute('data-theme') || 'default';
  var direction = document.body.getAttribute('data-direction') || 'vertical';
  
  console.log('KPI Tree initializing with direction:', direction);
  
  // Add direction toggle control
  addDirectionToggle(direction);
  
  // Add share button for permanent link
  addShareButton();
  
  // Initialize toggle buttons
  setupToggleButtons();
}

// Handle toggle buttons for collapsing/expanding nodes
function setupToggleButtons() {
  console.log('Setting up toggle buttons');
  
  // Get all toggle buttons
  var toggleButtons = document.querySelectorAll('.toggle-btn');
  console.log('Found toggle buttons:', toggleButtons.length);
  
  // First check URL parameters for state
  var urlStates = getStateFromUrl();
  
  // If no URL parameters, load from localStorage
  var savedStates = Object.keys(urlStates).length > 0 ? urlStates : loadTreeState();
  
  // Initialize toggle buttons
  for (var i = 0; i < toggleButtons.length; i++) {
    var button = toggleButtons[i];
    var targetId = button.getAttribute('data-target');
    var target = document.getElementById(targetId);
    
    if (!target) {
      console.error('Target element not found:', targetId);
      continue;
    }
    
    // Apply saved state if exists
    if (savedStates[targetId] === 'collapsed') {
      target.classList.add('collapsed');
      button.classList.add('collapsed');
    }
    
    // Use closure to maintain button and target references
    (function(btn, tgt) {
      btn.onclick = function() {
        console.log('Toggle button clicked for:', tgt.id);
        tgt.classList.toggle('collapsed');
        btn.classList.toggle('collapsed');
        saveTreeState();
        updateShareUrl();
      };
    })(button, target);
  }
}

// Add direction toggle dropdown
function addDirectionToggle(initialDirection) {
  // Create toggle control
  var controlDiv = document.createElement('div');
  controlDiv.className = 'direction-control';
  controlDiv.style.position = 'fixed';
  controlDiv.style.top = '10px';
  controlDiv.style.right = '10px';
  controlDiv.style.zIndex = '1000';
  controlDiv.style.background = '#fff';
  controlDiv.style.padding = '5px 10px';
  controlDiv.style.borderRadius = '4px';
  controlDiv.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
  
  // Create select element
  var select = document.createElement('select');
  select.id = 'directionToggle';
  
  // Add options
  var vertOption = document.createElement('option');
  vertOption.value = 'vertical';
  vertOption.textContent = '縦向きレイアウト';
  vertOption.selected = initialDirection === 'vertical';
  
  var horizOption = document.createElement('option');
  horizOption.value = 'horizontal';
  horizOption.textContent = '横向きレイアウト';
  horizOption.selected = initialDirection === 'horizontal';
  
  select.appendChild(vertOption);
  select.appendChild(horizOption);
  
  // Add event listener using old-school approach
  select.onchange = function() {
    var treeContainer = document.querySelector('.kpi-tree-container');
    var body = document.body;
    
    // Remove old direction class
    treeContainer.classList.remove('direction-vertical');
    treeContainer.classList.remove('direction-horizontal');
    
    // Add new direction class
    treeContainer.classList.add('direction-' + this.value);
    
    // Update data attribute
    body.setAttribute('data-direction', this.value);
    
    // Save preference to localStorage
    localStorage.setItem('kpiTreeDirection', this.value);
    
    // Update share URL
    updateShareUrl();
  };
  
  // Add label
  var label = document.createElement('label');
  label.htmlFor = 'directionToggle';
  label.textContent = 'レイアウト: ';
  label.style.marginRight = '5px';
  label.style.fontWeight = 'bold';
  
  // Append to control div
  controlDiv.appendChild(label);
  controlDiv.appendChild(select);
  
  // Append to body
  document.body.appendChild(controlDiv);
  
  // Check URL parameters first for direction
  var urlParams = new URLSearchParams(window.location.search);
  var directionParam = urlParams.get('direction');
  
  if (directionParam && (directionParam === 'vertical' || directionParam === 'horizontal')) {
    select.value = directionParam;
  } else {
    // If no URL parameter, check localStorage
    var savedDirection = localStorage.getItem('kpiTreeDirection');
    if (savedDirection && savedDirection !== initialDirection) {
      select.value = savedDirection;
    }
  }
  
  // Trigger change event manually for IE compatibility
  if (select.value !== initialDirection) {
    if ("createEvent" in document) {
      var evt = document.createEvent("HTMLEvents");
      evt.initEvent("change", false, true);
      select.dispatchEvent(evt);
    } else {
      select.fireEvent("onchange");
    }
  }
}

// Save tree state to localStorage
function saveTreeState() {
  var state = {};
  var children = document.querySelectorAll('.children');
  
  for (var i = 0; i < children.length; i++) {
    var child = children[i];
    if (child.id) {
      state[child.id] = child.classList.contains('collapsed') ? 'collapsed' : 'expanded';
    }
  }
  
  localStorage.setItem('kpiTreeState', JSON.stringify(state));
  return state;
}

// Load tree state from localStorage
function loadTreeState() {
  var savedState = localStorage.getItem('kpiTreeState');
  return savedState ? JSON.parse(savedState) : {};
}

// Get state from URL parameters
function getStateFromUrl() {
  var urlParams = new URLSearchParams(window.location.search);
  var stateParam = urlParams.get('state');
  
  if (!stateParam) {
    return {};
  }
  
  try {
    // URLデコード後、URL-safe base64 decode
    var decodedState = decodeURIComponent(stateParam);
    decodedState = atob(decodedState.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodedState);
  } catch (e) {
    console.error('Error parsing state from URL:', e);
    return {};
  }
}

// Generate URL-safe state parameter
function generateStateParam(state) {
  // URL-safe base64 encode
  var encoded = btoa(JSON.stringify(state)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  // URLエンコード
  return encodeURIComponent(encoded);
}

// Add share button for permanent link
function addShareButton() {
  var shareDiv = document.createElement('div');
  shareDiv.className = 'share-control';
  shareDiv.style.position = 'fixed';
  shareDiv.style.top = '50px';
  shareDiv.style.right = '10px';
  shareDiv.style.zIndex = '1000';
  shareDiv.style.background = '#fff';
  shareDiv.style.padding = '5px 10px';
  shareDiv.style.borderRadius = '4px';
  shareDiv.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
  
  var shareButton = document.createElement('button');
  shareButton.id = 'shareButton';
  shareButton.textContent = '現在の表示状態を共有';
  shareButton.style.padding = '5px 10px';
  shareButton.style.cursor = 'pointer';
  shareButton.style.backgroundColor = '#4CAF50';
  shareButton.style.color = 'white';
  shareButton.style.border = 'none';
  shareButton.style.borderRadius = '4px';
  
  // Add event listener
  shareButton.onclick = function() {
    copyShareUrlToClipboard();
  };
  
  // Add tooltip span
  var tooltip = document.createElement('span');
  tooltip.id = 'shareTooltip';
  tooltip.textContent = '';
  tooltip.style.marginLeft = '10px';
  tooltip.style.fontSize = '12px';
  tooltip.style.opacity = '0';
  tooltip.style.transition = 'opacity 0.3s';
  
  // Append to share div
  shareDiv.appendChild(shareButton);
  shareDiv.appendChild(tooltip);
  
  // Append to body
  document.body.appendChild(shareDiv);
  
  // Initialize share URL
  updateShareUrl();
}

// Update share URL when tree state changes
function updateShareUrl() {
  var state = saveTreeState();
  var stateParam = generateStateParam(state);
  var direction = document.body.getAttribute('data-direction') || 'vertical';
  
  // Create URL with parameters
  var url = new URL(window.location.href);
  // URLのハッシュ部分とクエリパラメータを削除
  url.hash = '';
  url.search = '';
  
  // パラメータを追加
  url.searchParams.set('state', stateParam);
  url.searchParams.set('direction', direction);
  
  // Store URL for copy button
  window._shareUrl = url.toString();
  console.log('Share URL updated:', window._shareUrl);
}

// Copy share URL to clipboard
function copyShareUrlToClipboard() {
  if (!window._shareUrl) {
    updateShareUrl();
  }
  
  // Create temporary input element
  var tempInput = document.createElement('input');
  tempInput.style.position = 'absolute';
  tempInput.style.left = '-9999px';
  tempInput.value = window._shareUrl;
  document.body.appendChild(tempInput);
  
  // Select and copy
  tempInput.select();
  document.execCommand('copy');
  document.body.removeChild(tempInput);
  
  // Show tooltip
  var tooltip = document.getElementById('shareTooltip');
  tooltip.textContent = 'リンクをコピーしました！';
  tooltip.style.opacity = '1';
  
  // Hide tooltip after 2 seconds
  setTimeout(function() {
    tooltip.style.opacity = '0';
  }, 2000);
}

// Run initialization when page is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', kpiTreeInit);
} else {
  kpiTreeInit();
}