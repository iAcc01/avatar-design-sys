import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的目录名（ES模块兼容）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 获取命令行参数
const inputDir = path.join(__dirname, '../_design-context', process.argv[2] || '');

// 确保输入目录是绝对路径
const absoluteInputDir = path.isAbsolute(inputDir) ? inputDir : path.join(process.cwd(), inputDir);

// 检查输入目录是否存在
if (!fs.existsSync(absoluteInputDir)) {
  console.error(`输入目录不存在: ${absoluteInputDir}`);
  process.exit(1);
}

// 检查是否直接包含 figma.html
const directHtmlPath = path.join(absoluteInputDir, 'figma.html');
const hasDirectHtml = fs.existsSync(directHtmlPath);

if (hasDirectHtml) {
  // 直接处理当前目录的 figma.html
  console.log(`正在处理: ${directHtmlPath}`);
  
  const htmlContent = fs.readFileSync(directHtmlPath, 'utf8');
  const componentsInfo: { layerName: string; components: ComponentInfo[] } = {
    layerName: path.basename(absoluteInputDir),
    components: []
  };

  // 解析HTML并提取带有data-x属性的节点
  const dataXNodes = extractDataXNodes(htmlContent);
  componentsInfo.components = dataXNodes;
  
  // 保存组件信息到JSON文件
  const componentInfoFile = path.join(absoluteInputDir, 'component-info.json');
  fs.writeFileSync(componentInfoFile, JSON.stringify(componentsInfo, null, 2), 'utf8');
  
  console.log(`已生成: ${componentInfoFile}`);
  console.log(`找到 ${dataXNodes.length} 个带有data-属性的组件`);
} else {
  // 读取分离的HTML文件（子目录模式）
  const layerDirs = fs.readdirSync(absoluteInputDir).filter(dir => {
    const dirPath = path.join(absoluteInputDir, dir);
    return fs.statSync(dirPath).isDirectory();
  });

  console.log('找到的层目录:', layerDirs);

  // 分析每个HTML文件
  layerDirs.forEach((dirName, index) => {
    const layerDir = path.join(absoluteInputDir, dirName);
    const htmlFilePath = path.join(layerDir, 'figma.html');
    
    if (fs.existsSync(htmlFilePath)) {
      console.log(`正在处理: ${htmlFilePath}`);
      
      const htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
      const componentsInfo: { layerName: string; components: ComponentInfo[] } = {
        layerName: dirName,
        components: []
      };

      // 解析HTML并提取带有data-x属性的节点
      const dataXNodes = extractDataXNodes(htmlContent);
      componentsInfo.components = dataXNodes;
      
      // 保存组件信息到JSON文件
      const layerComponentInfoFile = path.join(layerDir, 'component-info.json');
      fs.writeFileSync(layerComponentInfoFile, JSON.stringify(componentsInfo, null, 2), 'utf8');
      
      console.log(`已生成: ${layerComponentInfoFile}`);
      console.log(`找到 ${dataXNodes.length} 个带有data-x属性的组件`);
    } else {
      console.warn(`figma.html 文件不存在: ${htmlFilePath}`);
    }
  });
}

console.log('处理完成!');

// 组件信息接口定义
interface ComponentInfo {
  componentName: string;
  tagName: string;
  props: Record<string, string>;
  children?: ComponentInfo[];
}

interface ParseResult {
  components: ComponentInfo[];
  nextIndex: number;
}

// 提取带有data-属性的节点
function extractDataXNodes(html: string): ComponentInfo[] {
  const parsedComponents = parseHTMLToComponents(html, 1);
  
  return parsedComponents.components;
}

// 解析HTML为组件树
function parseHTMLToComponents(html, startIndex = 1) {
  const components = [];
  let componentIndex = startIndex;
  let position = 0;
  
  while (position < html.length) {
    // 查找下一个开始标签
    const tagStart = html.indexOf('<', position);
    if (tagStart === -1) break;
    
    // 检查是否是结束标签
    if (html[tagStart + 1] === '/') {
      position = tagStart + 1;
      continue;
    }
    
    // 查找标签结束位置
    const tagEnd = html.indexOf('>', tagStart);
    if (tagEnd === -1) break;
    
    // 检查是否是自闭合标签
    const isSelfClosing = html[tagEnd - 1] === '/';
    
    // 提取标签内容
    const tagContent = html.substring(tagStart + 1, tagEnd);
    const spaceIndex = tagContent.indexOf(' ');
    const tagName = spaceIndex > 0 ? tagContent.substring(0, spaceIndex) : tagContent;
    const attributes = spaceIndex > 0 ? tagContent.substring(spaceIndex + 1) : '';
    
    // 检查是否包含data-属性
    if (attributes.includes('data-')) {
      if (isSelfClosing) {
        // 处理自闭合标签
        const props = extractAllAttributes(attributes);
        const processedDataAttrs = processDataAttributes(attributes);
        Object.assign(props, processedDataAttrs);
        
        // 使用 data-name 作为 componentName，如果没有则使用默认命名
        const dataName = extractDataName(attributes);
        let componentName = dataName || `component_${componentIndex}`;
        
        // 如果是 img 标签且有 icon 属性，使用 icon 的值作为 componentName
        if (tagName === 'img' && props.icon) {
          componentName = props.icon;
        }
        
        // 从 props 中移除 name 属性
        delete props.name;
        
        const component: ComponentInfo = {
          componentName: componentName,
          tagName: tagName,
          props: props
        };
        
        components.push(component);
        componentIndex++;
        position = tagEnd + 1;
      } else {
        // 处理普通标签，查找对应的结束标签
        const closingTag = `</${tagName}>`;
        const closingTagStart = findMatchingClosingTag(html, tagStart, tagName);
        
        if (closingTagStart !== -1) {
          // 提取innerHTML
          const innerHTML = html.substring(tagEnd + 1, closingTagStart);
          
          // 提取所有属性
          const props = extractAllAttributes(attributes);
          const processedDataAttrs = processDataAttributes(attributes);
          Object.assign(props, processedDataAttrs);
          
          // 使用 data-name 作为 componentName，如果没有则使用默认命名
          const dataName = extractDataName(attributes);
          let componentName = dataName || `component_${componentIndex}`;
          
          // 如果是 img 标签且有 icon 属性，使用 icon 的值作为 componentName
          if (tagName === 'img' && props.icon) {
            componentName = props.icon;
          }
          
          // 从 props 中移除 name 属性
          delete props.name;
          
          const component: ComponentInfo = {
            componentName: componentName,
            tagName: tagName,
            props: props
          };
          
          componentIndex++;
          
          // 递归解析子节点
          if (innerHTML && innerHTML.trim().length > 0) {
            const childResult = parseHTMLToComponents(innerHTML, componentIndex);
            if (childResult.components.length > 0) {
              component.children = childResult.components;
            }
            componentIndex = childResult.nextIndex;
          }
          
          components.push(component);
          position = closingTagStart + closingTag.length;
        } else {
          position = tagEnd + 1;
        }
      }
    } else {
      // 没有data属性的标签，但仍需要检查其内容
      if (!isSelfClosing) {
        const closingTagStart = findMatchingClosingTag(html, tagStart, tagName);
        if (closingTagStart !== -1) {
          const innerHTML = html.substring(tagEnd + 1, closingTagStart);
          if (innerHTML && innerHTML.trim().length > 0) {
            const childResult = parseHTMLToComponents(innerHTML, componentIndex);
            components.push(...childResult.components);
            componentIndex = childResult.nextIndex;
          }
          position = closingTagStart + `</${tagName}>`.length;
        } else {
          position = tagEnd + 1;
        }
      } else {
        position = tagEnd + 1;
      }
    }
  }
  
  return {
    components: components,
    nextIndex: componentIndex
  };
}

// 查找匹配的结束标签
function findMatchingClosingTag(html: string, startPos: number, tagName: string): number {
  const openTag = `<${tagName}`;
  const closeTag = `</${tagName}>`;
  let depth = 1;
  let pos = html.indexOf('>', startPos) + 1;
  
  while (pos < html.length && depth > 0) {
    const nextOpen = html.indexOf(openTag, pos);
    const nextClose = html.indexOf(closeTag, pos);
    
    if (nextClose === -1) {
      return -1; // 没有找到结束标签
    }
    
    if (nextOpen !== -1 && nextOpen < nextClose) {
      // 检查这是否是同名标签的开始
      const charAfterTag = html[nextOpen + openTag.length];
      if (charAfterTag === ' ' || charAfterTag === '>') {
        depth++;
      }
      pos = nextOpen + openTag.length;
    } else {
      depth--;
      if (depth === 0) {
        return nextClose;
      }
      pos = nextClose + closeTag.length;
    }
  }
  
  return -1;
}

// 处理data-属性，提取x部分作为属性名
function processDataAttributes(attributeString) {
  const processedAttrs = {};
  
  // 匹配所有data-属性
  const dataPattern = /(data-[^=]+)=["']([^"']*)["']/g;
  let match;
  
  while ((match = dataPattern.exec(attributeString)) !== null) {
    const fullAttrName = match[1]; // 完整的属性名，如 "data-expandtype-展开类型"
    const attrValue = match[2];
    
    // 提取data-x-y格式中的x部分
    const xPart = extractXFromDataAttribute(fullAttrName);
    
    if (xPart) {
      processedAttrs[xPart] = attrValue;
    }
  }
  
  return processedAttrs;
}

// 从data-x-y格式中提取x部分
function extractXFromDataAttribute(dataAttrName) {
  // 移除开头的"data-"
  const withoutDataPrefix = dataAttrName.replace(/^data-/, '');
  
  // 查找第一个"-"的位置，提取x部分
  const firstDashIndex = withoutDataPrefix.indexOf('-');
  
  if (firstDashIndex > 0) {
    return withoutDataPrefix.substring(0, firstDashIndex);
  }
  
  // 如果没有找到"-"，返回整个去掉data-前缀的部分
  return withoutDataPrefix;
}

// 提取所有属性的函数
function extractAllAttributes(attributeString) {
  const props = {};
  
  // 匹配所有属性 attribute="value" 或 attribute='value'
  const attributePattern = /(\w+(?:-\w+)*)=["']([^"']*)["']/g;
  let match;
  
  while ((match = attributePattern.exec(attributeString)) !== null) {
    const attrName = match[1];
    const attrValue = match[2];
    props[attrName] = attrValue;
  }
  
  return props;
}

// 从属性字符串中提取 data-name 的值
function extractDataName(attributeString: string): string | null {
  // 匹配 data-name="xxx" 格式
  const dataNamePattern = /data-name=["']([^"']*)["']/;
  const match = attributeString.match(dataNamePattern);
  
  if (match) {
    return match[1];
  }
  
  return null;
}
