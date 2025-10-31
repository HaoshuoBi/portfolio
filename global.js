// Step 1: 基础工具
console.log("IT’S ALIVE!");

export function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}
// 导航铺垫 .current
const navLinks = Array.from(document.querySelectorAll("nav a"));

const currentLink = navLinks.find(
  (a) => a.host === location.host && a.pathname === location.pathname
);

if (currentLink) {
  currentLink.classList.add("current");
}


//全新导航
// Step 3: 自动导航
let pages = [
  { url: "", title: "Home" },
  { url: "project/", title: "Project" },
  { url: "contact/", title: "Contact" },
  { url: "resume/", title: "Resume" },
  { url: "https://github.com/HaoshuoBi", title: "GitHub" },
  
];

// GitHub Pages /"
const BASE_PATH =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "/"
    : "/portfolio/"; // 

const nav = document.createElement("nav");
document.body.prepend(nav);

for (let p of pages) {
  let url = p.url;
  if (!url.startsWith("http")) url = BASE_PATH + url;

  const a = document.createElement("a");
  a.href = url;
  a.textContent = p.title;

  // 外链新标签
  a.toggleAttribute("target", a.host !== location.host);
  if (a.hasAttribute("target")) a.target = "_blank";

  // 当前页高亮
  a.classList.toggle(
    "current",
    a.host === location.host && a.pathname === location.pathname
  );

  nav.append(a);
}
// 插入主题选择器
document.body.insertAdjacentHTML(
  "afterbegin",
  `
  <label class="color-scheme">
    Theme:
    <select id="theme-select">
      <option value="light dark">Automatic</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>
`
);

// 切换主题并持久化 不怕刷新
const select = document.querySelector("#theme-select");

function setColorScheme(value) {
  document.documentElement.style.setProperty("color-scheme", value);
  select.value = value;
  localStorage.colorScheme = value;
}

if ("colorScheme" in localStorage) {
  setColorScheme(localStorage.colorScheme);
} else {
  document.documentElement.style.setProperty("color-scheme", "light dark");
}

select.addEventListener("input", (e) => {
  setColorScheme(e.target.value);
});


// ========= Lab 4 工具：选择器小助手（如果你没有 $，就保留；若已存在就不要重复定义） =========
export function $(selector, context = document) {
  return context.querySelector(selector);
}

// ========= Lab 4 工具：读取 JSON =========
export async function fetchJSON(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (err) {
    console.error('Error fetching or parsing JSON data:', err);
    return null;
  }
}

// ========= Lab 4 工具：渲染项目卡片 =========
// ========= Lab 4 工具：渲染项目卡片（加入年份） =========
export function renderProjects(projectsArray, containerElement, headingLevel = 'h2') {
  if (!containerElement) return;

  const validHeadings = new Set(['h1','h2','h3','h4','h5','h6']);
  const H = validHeadings.has(headingLevel) ? headingLevel : 'h2';

  containerElement.innerHTML = '';

  if (!Array.isArray(projectsArray) || projectsArray.length === 0) {
    containerElement.innerHTML = '<p>No projects to display.</p>';
    return;
  }

  for (const project of projectsArray) {
    const article = document.createElement('article');
    article.className = 'project-card'; // 方便统一样式

    const title = project?.title ?? 'Untitled';
    const rawImg = project?.image ?? 'https://dsc106.com/labs/lab02/images/empty.svg';
    const img = /^(https?:)?\/\//.test(rawImg) ? rawImg : (BASE_PATH + rawImg);
    const desc = project?.description ?? '';
    const yearText = project?.year != null ? String(project.year) : ''; // 可能是数字或字符串

    // 描述 + 年份 放在同一个 wrap，避免网格重叠
    const wrap = document.createElement('div');
    const p = document.createElement('p');
    p.textContent = desc;

    const year = document.createElement('div');
    year.className = 'project-meta';     // 在 CSS 里设置为灰色、oldstyle-nums 等
    year.textContent = yearText;         // 没有年份就会是空字符串

    wrap.append(p, year);

    article.innerHTML = `
      <${H}>${title}</${H}>
      <img src="${img}" alt="${title}">
    `;
    article.appendChild(wrap);

    containerElement.appendChild(article);
  }
}


// ========= Lab 4 工具：GitHub API（后面首页会用到） =========
export async function fetchGitHubData(username) {
  return fetchJSON(`https://api.github.com/users/${encodeURIComponent(username)}`);
}
