// project/projects.js  —— Lab 5 完整版
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import { fetchJSON, renderProjects } from '../global.js';

// ======== DOM ========
const svg = d3.select('#projects-pie-plot');     // 饼图
const legend = d3.select('.legend');             // 图例
const projectsContainer = document.querySelector('.projects-list'); // 列表容器
const searchInput = document.querySelector('.searchBar');           // 搜索框

// ======== 全局状态 ========
let ALL_PROJECTS = [];
let query = '';
let selectedLabel = null;   // -1 表示未选择任何扇区
let sliceMeta = [];       // [{label: '2024', value: 3}, …] 与扇区一一对应

// 颜色尺
// 颜色尺（先声明，等拿到所有年份后再设定 domain）
let color;


// ======== 统一过滤：先搜再按年份（修复“不能同时过滤”的问题） ========
function applyFilters() {
  let filtered = ALL_PROJECTS.filter(p => {
    const hay = Object.values(p).join('\n').toLowerCase();
    return hay.includes((query || '').toLowerCase());
  });

  if (selectedLabel) { // ★ 用年份值过滤
    filtered = filtered.filter(p => String(p.year) === String(selectedLabel));
  }
  return filtered;
}


// ======== 饼图 + 图例渲染（对传入的 projects 重绘） ========
function renderPieChart(projectsGiven) {
  // 分组：每年计数
  const rolled = d3.rollups(
    projectsGiven,
    v => v.length,
    d => String(d.year)
  );

  const data = rolled.map(([year, count]) => ({ label: year, value: count }));
  data.sort((a, b) => a.label.localeCompare(b.label)); // 年份排序（可选）
  sliceMeta = data; // 保存供点击时反查

  // 生成扇区数据
  const pie = d3.pie().value(d => d.value).sort(null);
  const arcData = pie(data);
  const arc = d3.arc().innerRadius(0).outerRadius(50);

  // 清空旧图
  svg.selectAll('*').remove();
  legend.selectAll('*').remove();

  // 画扇区
  svg.selectAll('path')
  .data(arcData)
  .enter()
  .append('path')
  .attr('d', arc)
  .attr('fill', d => color(d.data.label))
  .attr('class', d => (d.data.label === selectedLabel ? 'selected' : null))
  .on('click', (_, d) => {
    const label = d.data.label; // ★ 这个扇区代表的年份
    selectedLabel = (selectedLabel === label) ? null : label; // ★ 切换
    renderAll();
  });

legend.selectAll('li')
  .data(data)
  .enter()
  .append('li')
  .attr('style', d => `--color:${color(d.label)}`)
  .attr('class', d => (d.label === selectedLabel ? 'selected' : null))
  .html(d => `<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`)
  .on('click', (_, d) => {
    const label = d.label; // ★ 图例项的年份
    selectedLabel = (selectedLabel === label) ? null : label; // ★ 切换
    renderAll();
  });


  // 图例
  legend.selectAll('li')
    .data(data)
    .enter()
    .append('li')
    .attr('style', d => `--color:${color(d.label)}`)  // d.label 是年份

    .attr('class', (_, i) => (i === selectedIndex ? 'selected' : null))
    .html(d => `<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`)
    .on('click', (_, d) => {
      const i = data.indexOf(d);
      selectedIndex = (selectedIndex === i ? -1 : i);
      renderAll();
    });
}

// ======== 页面统一渲染（列表 + 饼图） ========
function renderAll() {
  const filtered = applyFilters();
  // 用你 global.js 的渲染器（包含“年份”）
  renderProjects(filtered, projectsContainer, 'h2');
  renderPieChart(filtered);
}

// ======== 搜索事件（input 实时触发；用 change 也行） ========
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    query = e.target.value || '';
    renderAll();
  });
}

// ======== 初始化 ========
async function init() {
  const data = await fetchJSON('../lib/projects.json');
  ALL_PROJECTS = Array.isArray(data) ? data : [];

  // ☆ 用“所有出现过的年份”做 domain——保证同一年份始终同色
  const allYears = [...new Set(ALL_PROJECTS.map(p => String(p.year)))].sort();
  color = d3.scaleOrdinal(d3.schemeTableau10).domain(allYears);

  renderAll();

  const counter = document.querySelector('#proj-count');
  if (counter) counter.textContent = `(${ALL_PROJECTS.length})`;
}

init();
