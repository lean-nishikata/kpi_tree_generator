const fs = require('fs-extra');
const YAML = require('yaml');
const path = require('path');

// Constants
const TEMPLATE_PATH = path.join(__dirname, 'template.html');
const STYLE_PATH = path.join(__dirname, '..', 'static', 'style.css');
const SCRIPT_PATH = path.join(__dirname, '..', 'static', 'script.js');

// Main function
async function generateKPITree() {
  try {
    // Get YAML file from command line or use default
    let configName = process.argv[2] || 'config';
    
    // Remove .yaml extension if provided
    if (configName.endsWith('.yaml')) {
      configName = configName.slice(0, -5);
    }
    
    // Check several possible file paths
    const possiblePaths = [
      `/app/config/${configName}.yaml`,
      path.join(process.cwd(), 'config', `${configName}.yaml`),
      path.join(process.cwd(), `${configName}.yaml`)
    ];
    
    let configFile = null;
    
    // Try to find the config file in possible locations
    for (const filePath of possiblePaths) {
      if (await fs.pathExists(filePath)) {
        configFile = filePath;
        break;
      }
    }
    
    // If not found, try to use example.yaml
    if (!configFile) {
      console.log(`Config file '${configName}.yaml' not found, trying example.yaml...`);
      
      const examplePaths = [
        '/app/config/example.yaml',
        path.join(process.cwd(), 'config', 'example.yaml'),
        path.join(process.cwd(), 'example.yaml')
      ];
      
      for (const exPath of examplePaths) {
        if (await fs.pathExists(exPath)) {
          configFile = exPath;
          break;
        }
      }
      
      if (!configFile) {
        console.error('No config file found. Please provide a valid YAML configuration file.');
        process.exit(1);
      }
    }
    
    console.log(`Using configuration file: ${configFile}`);
    
    // Read and parse YAML file
    const configData = await fs.readFile(configFile, 'utf8');
    const config = YAML.parse(configData);
    
    // Set default output filename based on config name
    if (!config.output) {
      // Check if running in Docker or local
      const isDocker = await fs.pathExists('/app');
      if (isDocker) {
        config.output = `/app/output/${configName}.html`;
      } else {
        // Extract just the filename without path
        const fileName = path.basename(configName);
        config.output = path.join(process.cwd(), 'output', `${fileName}.html`);
      }
    }
    
    // Read template file
    const template = await fs.readFile(TEMPLATE_PATH, 'utf8');
    
    // Generate the tree HTML
    const treeHtml = generateTreeHtml(config.root);
    
    // Read style and script files
    const styleContent = await fs.readFile(STYLE_PATH, 'utf8');
    const scriptContent = await fs.readFile(SCRIPT_PATH, 'utf8');
    
    // Replace placeholders in template
    const title = config.title || 'KPI Tree';
    const theme = config.theme || 'default';
    const direction = config.direction || 'vertical';
    
    let html = template
      .replace(/\{\{TITLE\}\}/g, title)
      .replace(/\{\{TREE_HTML\}\}/g, treeHtml)
      .replace(/\{\{STYLE\}\}/g, styleContent)
      .replace(/\{\{SCRIPT\}\}/g, scriptContent)
      .replace(/\{\{THEME\}\}/g, theme)
      .replace(/\{\{DIRECTION\}\}/g, direction);
    
    // Determine output file path
    const outputFile = config.output;
    
    // Ensure output directory exists
    await fs.ensureDir(path.dirname(outputFile));
    
    // Write the output file
    await fs.writeFile(outputFile, html);
    
    console.log(`KPI tree generated successfully: ${outputFile}`);
  } catch (error) {
    console.error('Error generating KPI tree:', error);
    process.exit(1);
  }
}

// Function to generate HTML for the tree
function generateTreeHtml(node, level = 0) {
  const nodeId = `node-${Math.random().toString(36).substr(2, 9)}`;
  const hasChildren = node.children && node.children.length > 0;
  
  // Create node content
  let nodeContent = node.text || '';
  if (node.url) {
    nodeContent = `<a href="${node.url}" target="_blank">${nodeContent}</a>`;
  }
  if (node.value !== undefined) {
    nodeContent += `<div class="value">${node.value}</div>`;
  }
  
  // Start the node HTML
  let html = `
    <li>
      <div class="node" id="${nodeId}">
        ${nodeContent}
      </div>`;
  
  // Add children if any
  if (hasChildren) {
    html += `
      <button class="toggle-btn" data-target="${nodeId}-children"></button>
      <ul id="${nodeId}-children" class="children">`;
    
    // Add each child with operator
    node.children.forEach((child, index) => {
      html += generateTreeHtml(child, level + 1);
      
      // Add operator between nodes if specified (except for the last child)
      if (child.operator && index < node.children.length - 1) {
        // 演算子の表示を変換（*を×、/を÷に）
        let displayOperator = child.operator;
        if (displayOperator === "*") displayOperator = "×";
        if (displayOperator === "/") displayOperator = "÷";
        
        html += `<li class="operator">${displayOperator}</li>`;
      }
    });
    
    html += `
      </ul>`;
  }
  
  html += `
    </li>`;
  
  return html;
}

// Run the generator
generateKPITree();