// KPI Tree JavaScript
// Using old-school function approach to ensure maximum browser compatibility
function kpiTreeInit() {
  // Apply theme and direction from config
  var theme = document.body.getAttribute('data-theme') || 'default';
  var direction = document.body.getAttribute('data-direction') || 'vertical';
  
  console.log('KPI Tree initializing with direction:', direction);
  
  // Add direction toggle control
  addDirectionToggle(direction);
  
  // Initialize toggle buttons
  setupToggleButtons();
}

// Handle toggle buttons for collapsing/expanding nodes
function setupToggleButtons() {
  console.log('Setting up toggle buttons');
  
  // Get all toggle buttons
  var toggleButtons = document.querySelectorAll('.toggle-btn');
  console.log('Found toggle buttons:', toggleButtons.length);
  
  // Load saved state from localStorage
  var savedStates = loadTreeState();
  
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
  vertOption.textContent = 'Vertical Direction';
  vertOption.selected = initialDirection === 'vertical';
  
  var horizOption = document.createElement('option');
  horizOption.value = 'horizontal';
  horizOption.textContent = 'Horizontal Direction';
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
  };
  
  // Add label
  var label = document.createElement('label');
  label.htmlFor = 'directionToggle';
  label.textContent = 'Layout: ';
  label.style.marginRight = '5px';
  label.style.fontWeight = 'bold';
  
  // Append to control div
  controlDiv.appendChild(label);
  controlDiv.appendChild(select);
  
  // Append to body
  document.body.appendChild(controlDiv);
  
  // Check if user has a saved preference
  var savedDirection = localStorage.getItem('kpiTreeDirection');
  if (savedDirection && savedDirection !== initialDirection) {
    select.value = savedDirection;
    
    // Trigger change event manually for IE compatibility
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
}

// Load tree state from localStorage
function loadTreeState() {
  var savedState = localStorage.getItem('kpiTreeState');
  return savedState ? JSON.parse(savedState) : {};
}

// Run initialization when page is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', kpiTreeInit);
} else {
  kpiTreeInit();
}