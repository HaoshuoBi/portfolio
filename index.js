// /index.js  —— 首页专用脚本（模块）
// 从 global.js 引入：读取 JSON、渲染项目卡片、获取 GitHub 数据
import { fetchJSON, renderProjects, fetchGitHubData } from './global.js';

// 1) 读取所有项目数据（相对路径：从首页到 /lib/）
const all = await fetchJSON('./lib/projects.json');

// 2) 只取前 3 个（若读取失败返回 null，则给空数组兜底）
const latest = Array.isArray(all) ? all.slice(0, 3) : [];

// 3) 选中首页上的项目容器 <div class="projects">
const homeProjects = document.querySelector('.projects');

// 4) 如果容器存在，就把“最近 3 个项目”渲染进去；标题级别用 <h2>
if (homeProjects) {
  renderProjects(latest, homeProjects, 'h2');
}

// 5) 选中 GitHub 统计信息的容器（稍后在 index.html 里加这个 <div>）
const profileStats = document.querySelector('#profile-stats');

// 6) 如果容器存在，就去 GitHub API 拉你的公开数据（把用户名改成你自己的！）
if (profileStats) {
  const data = await fetchGitHubData('HaoshuoBi'); 
  if (data) {
    // 7) 用模板字符串把数据填进 HTML（<dl> 是“术语-描述”列表）
    profileStats.innerHTML = `
      <h3>GitHub Profile</h3>
      <dl>
        <dt>Public Repos:</dt><dd>${data.public_repos}</dd>
        <dt>Public Gists:</dt><dd>${data.public_gists}</dd>
        <dt>Followers:</dt><dd>${data.followers}</dd>
        <dt>Following:</dt><dd>${data.following}</dd>
      </dl>
    `;
  } else {
    // 读取失败时的简单提示
    profileStats.textContent = 'Failed to load GitHub data.';
  }
}
