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
