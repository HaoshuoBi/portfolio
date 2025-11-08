// meta/main.js
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// ========== Step 1.1 读取 CSV 并做类型转换 ==========
async function loadData() {
  const data = await d3.csv('loc.csv', (row) => ({
    ...row,
    line: +row.line,
    depth: +row.depth,
    length: +row.length,
    date: new Date(row.date + 'T00:00' + row.timezone), 
    datetime: new Date(row.datetime),                   
  }));
  return data;
}

// ========== Step 1.2 处理 commits（分组＋派生字段） ==========
function processCommits(data) {
  return d3.groups(data, d => d.commit).map(([commit, lines]) => {
    const first = lines[0];
    const { author, date, datetime, time, timezone } = first;
    const ret = {
      id: commit,
      url: 'https://github.com/HaoshuoBi/portfolio/commit/' + commit,
      author,
      date,
      time,
      timezone,
      datetime,
      hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
      totalLines: lines.length,
    };
    // 把原始行挂到不可枚举属性上（不污染 console 展示）
    Object.defineProperty(ret, 'lines', { value: lines, enumerable: false, writable: false, configurable: false });
    return ret;
  });
}

// ========== Step 1.3 渲染汇总统计 ==========
function renderCommitInfo(data, commits) {
  const dl = d3.select('#stats').append('dl').attr('class', 'stats');

  // 基本统计
  dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
  dl.append('dd').text(data.length);

  dl.append('dt').text('Total commits');
  dl.append('dd').text(commits.length);

  // 可以再加 3–4 个：示例
  const maxDepth = d3.max(data, d => d.depth);
  dl.append('dt').text('Max depth');
  dl.append('dd').text(maxDepth);

  const avgDepth = d3.mean(data, d => d.depth);
  dl.append('dt').text('Average depth');
  dl.append('dd').text(avgDepth.toFixed(2));

  const files = d3.group(data, d => d.file).size;
  dl.append('dt').text('Distinct files');
  dl.append('dd').text(files);

  // 平均文件长度（先每文件求长度，再平均）
  const fileLengths = d3.rollups(
    data,
    v => d3.max(v, w => w.line),
    d => d.file
  );
  const avgFileLen = d3.mean(fileLengths, d => d[1]);
  dl.append('dt').text('Average file length (lines)');
  dl.append('dd').text(Math.round(avgFileLen));
}

// ========== Tooltip 工具 ==========
function updateTooltipVisibility(isVisible) {
  const tip = document.getElementById('commit-tooltip');
  tip.hidden = !isVisible;
  tip.style.opacity = isVisible ? '1' : '0';
}

function updateTooltipPosition(event) {
  const tip = document.getElementById('commit-tooltip');
  tip.style.left = `${event.clientX + 12}px`;
  tip.style.top  = `${event.clientY + 12}px`;
}
function renderTooltipContent(commit) {
  if (!commit) return;
  const link = document.getElementById('commit-link');
  const date = document.getElementById('commit-date');
  const time = document.getElementById('commit-time');
  const auth = document.getElementById('commit-author');
  const lines= document.getElementById('commit-lines');

  link.href = commit.url;
  link.textContent = commit.id.slice(0, 7);
  date.textContent = commit.datetime.toLocaleString('en', { dateStyle: 'full' });
  time.textContent = commit.datetime.toLocaleTimeString('en', { hour: '2-digit', minute:'2-digit' });
  auth.textContent = commit.author;
  lines.textContent = commit.totalLines;
}

// ========== Step 2–5 散点图 + 轴 + 网格 + 大小 + Brush ==========
function renderScatterPlot(commits) {
  const width = 1000, height = 600;
  const margin = { top: 10, right: 10, bottom: 30, left: 50 };
  const usable = {
    left: margin.left,
    top: margin.top,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
    right: width - margin.right,
    bottom: height - margin.bottom,
  };

  const svg = d3.select('#chart').append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  const xScale = d3.scaleTime()
    .domain(d3.extent(commits, d => d.datetime))
    .range([usable.left, usable.right])
    .nice();

  const yScale = d3.scaleLinear()
    .domain([0, 24])
    .range([usable.bottom, usable.top]);

  // 网格线（先画）
  const grid = svg.append('g').attr('class', 'gridlines')
    .attr('transform', `translate(${usable.left},0)`)
    .call(d3.axisLeft(yScale).tickFormat('').tickSize(-usable.width));

  // 轴
  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3.axisLeft(yScale).tickFormat(d => String(d % 24).padStart(2,'0') + ':00');

  svg.append('g')
    .attr('transform', `translate(0,${usable.bottom})`)
    .call(xAxis);

  svg.append('g')
    .attr('transform', `translate(${usable.left},0)`)
    .call(yAxis);

  // 点大小：√比例（面积感知正确）
  const [minLines, maxLines] = d3.extent(commits, d => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines || 0, maxLines || 1]).range([2, 30]);

  // 为了重叠交互更好，先按大到小排，先画大的
  const sorted = d3.sort(commits, d => -d.totalLines);

  const dots = svg.append('g').attr('class', 'dots')
    .selectAll('circle')
    .data(sorted)
    .join('circle')
    .attr('cx', d => xScale(d.datetime))
    .attr('cy', d => yScale(d.hourFrac))
    .attr('r',  d => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', .7)
    .on('mouseenter', (event, d) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(d);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mousemove', (event) => updateTooltipPosition(event))
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', .7);
      updateTooltipVisibility(false);
    });

  // Brush（选择框）
  const brush = d3.brush().on('start brush end', brushed);
  svg.call(brush);

  // 重要：把覆盖层放到前面后，再把点及其后的元素 raise 回来，保证 hover 可用
  svg.selectAll('.dots, .overlay ~ *').raise();

  // 供 isCommitSelected 使用的闭包变量
  function isCommitSelected(selection, d) {
    if (!selection) return false;
    const [[x0, y0], [x1, y1]] = selection;
    const x = xScale(d.datetime);
    const y = yScale(d.hourFrac);
    return x0 <= x && x <= x1 && y0 <= y && y <= y1;
  }

  function renderSelectionCount(selection) {
    const selected = selection ? commits.filter(d => isCommitSelected(selection, d)) : [];
    const el = document.getElementById('selection-count');
    el.textContent = `${selected.length || 'No'} commits selected`;
    return selected;
  }

  function renderLanguageBreakdown(selection) {
    const selected = selection ? commits.filter(d => isCommitSelected(selection, d)) : [];
    const container = document.getElementById('language-breakdown');
    container.innerHTML = '';
    const base = selected.length ? selected : commits;
    const lines = base.flatMap(d => d.lines);

    // 统计每种语言（type）行数
    const breakdown = d3.rollup(lines, v => v.length, d => d.type);
    const total = lines.length;

    for (const [lang, count] of breakdown) {
      const prop = count / total;
      const pct = d3.format('.1~%')(prop);
      container.innerHTML += `<dt>${lang}</dt><dd>${count} lines (${pct})</dd>`;
    }
  }

  function brushed(event) {
    const sel = event.selection;
    // 设置 selected 类
    d3.selectAll('circle').classed('selected', d => isCommitSelected(sel, d));
    renderSelectionCount(sel);
    renderLanguageBreakdown(sel);
  }

  // 初始渲染一次语言分布（无选择时显示全体）
  renderLanguageBreakdown(null);
}

// ========== 启动：读数据 → 处理 → 渲染 ==========
const data = await loadData();
const commits = processCommits(data);
renderCommitInfo(data, commits);
renderScatterPlot(commits);
