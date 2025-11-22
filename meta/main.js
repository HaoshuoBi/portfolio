// meta/main.js
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

// ====== 全局状态（Lab 8 用）======
let xScale, yScale;

// 时间滑块相关
let commitProgress = 100; // 0~100
let timeScale;
let commitMaxTime;
let filteredCommits;

// 全量数据（方便 slider / scrolly 共用）
let allData;
let allCommits;

// Step 2: 颜色比例尺（按语言 / type）
const colors = d3.scaleOrdinal(d3.schemeTableau10);

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
  return d3.groups(data, (d) => d.commit).map(([commit, lines]) => {
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
    Object.defineProperty(ret, 'lines', {
      value: lines,
      enumerable: false,
      writable: false,
      configurable: false,
    });
    return ret;
  });
}

// ======= Summary Stats（会随 slider / scrolly 更新）=======
function renderSummaryStats(data, commits) {
  const totalLOC = data.length;
  const totalCommits = commits.length;

  const maxDepth = d3.max(data, (d) => d.depth) ?? 0;
  const longestLine = d3.max(data, (d) => d.length) ?? 0;
  const maxLines = d3.max(commits, (d) => d.totalLines) ?? 0;

  const fileCount = d3.group(data, (d) => d.file).size;

  const stats = [
    { title: 'COMMITS', value: totalCommits },
    { title: 'FILES', value: fileCount },
    { title: 'TOTAL LOC', value: totalLOC },
    { title: 'MAX DEPTH', value: maxDepth },
    { title: 'LONGEST LINE', value: longestLine },
    { title: 'MAX LINES', value: maxLines },
  ];

  const container = d3.select('#summary-stats');
  container.html(''); // 清空旧内容

  const blocks = container
    .selectAll('.stat-block')
    .data(stats)
    .join('div')
    .attr('class', 'stat-block');

  blocks
    .append('div')
    .attr('class', 'stat-title')
    .text((d) => d.title);

  blocks
    .append('div')
    .attr('class', 'stat-value')
    .text((d) => d.value);
}

// ========== Step 2：文件 unit visualization ==========

// 根据 commits 计算 files 列表（按行数降序）
function computeFiles(commits) {
  const lines = commits.flatMap((d) => d.lines ?? []);
  const files = d3
    .groups(lines, (d) => d.file)
    .map(([name, lines]) => {
      // 找每个文件最常见的语言 type，用来上色
      const typeCounts = d3.rollup(
        lines,
        (v) => v.length,
        (d) => d.type,
      );
      let dominantType = 'Other';
      let bestCount = -1;
      for (const [t, c] of typeCounts) {
        if (c > bestCount) {
          bestCount = c;
          dominantType = t ?? 'Other';
        }
      }
      return { name, lines, type: dominantType };
    })
    .sort((a, b) => b.lines.length - a.lines.length); // 按行数降序
  return files;
}

// 用 <dl id="files"> 渲染/更新文件可视化
function updateFileDisplay(commits) {
  const files = computeFiles(commits);
  const container = d3.select('#files');

  // 绑定每个文件一行 div，key 是文件名
  const fileBlocks = container
    .selectAll('div')
    .data(files, (d) => d.name)
    .join(
      (enter) =>
        enter.append('div').call((div) => {
          div.append('dt');
          div.append('dd');
        }),
      (update) => update,
      (exit) => exit.remove(),
    );

  // 更新 dt 部分：文件名 + 总行数
  fileBlocks.select('dt').each(function (d) {
    const dt = d3.select(this);
    dt.html(''); // 清空
    dt.append('code').text(d.name);
    dt.append('small').text(`${d.lines.length} lines`);
  });

  // 更新 dd 部分：一行一个小圆点
  fileBlocks
    .select('dd')
    .attr('style', (d) => `--color: ${colors(d.type)}`)
    .selectAll('div')
    .data((d) => d.lines)
    .join('div')
    .attr('class', 'loc');
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
  tip.style.top = `${event.clientY + 12}px`;
}

function renderTooltipContent(commit) {
  if (!commit) return;
  const link = document.getElementById('commit-link');
  const date = document.getElementById('commit-date');
  const time = document.getElementById('commit-time');
  const auth = document.getElementById('commit-author');
  const lines = document.getElementById('commit-lines');

  link.href = commit.url;
  link.textContent = commit.id.slice(0, 7);
  date.textContent = commit.datetime.toLocaleString('en', {
    dateStyle: 'full',
  });
  time.textContent = commit.datetime.toLocaleTimeString('en', {
    hour: '2-digit',
    minute: '2-digit',
  });
  auth.textContent = commit.author;
  lines.textContent = commit.totalLines;
}

// ========== 散点图 + 网格 + Brush（基础版本） ==========
function renderScatterPlot(commits) {
  const width = 1000,
    height = 600;
  const margin = { top: 10, right: 10, bottom: 30, left: 50 };
  const usable = {
    left: margin.left,
    top: margin.top,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
    right: width - margin.right,
    bottom: height - margin.bottom,
  };

  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  // === 全局比例尺 ===
  xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([usable.left, usable.right])
    .nice();

  yScale = d3
    .scaleLinear()
    .domain([0, 24])
    .range([usable.bottom, usable.top]);

  // 网格线
  svg
    .append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usable.left},0)`)
    .call(d3.axisLeft(yScale).tickFormat('').tickSize(-usable.width));

  // 坐标轴
  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3
    .axisLeft(yScale)
    .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00');

  svg
    .append('g')
    .attr('transform', `translate(0,${usable.bottom})`)
    .attr('class', 'x-axis')
    .call(xAxis);

  svg
    .append('g')
    .attr('transform', `translate(${usable.left},0)`)
    .attr('class', 'y-axis')
    .call(yAxis);

  // 半径比例尺
  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  const rScale = d3
    .scaleSqrt()
    .domain([minLines || 0, maxLines || 1])
    .range([2, 30]);

  // 为了交互，先画大的
  const sorted = d3.sort(commits, (d) => -d.totalLines);

  const dotsGroup = svg.append('g').attr('class', 'dots');

  dotsGroup
    .selectAll('circle')
    .data(sorted, (d) => d.id) // 用 id 当 key（Step 1.3）
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7)
    .on('mouseenter', (event, d) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(d);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mousemove', (event) => updateTooltipPosition(event))
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    });

  // Brush（原 Lab7 功能，先保持不变）
  const brush = d3.brush().on('start brush end', brushed);
  svg.call(brush);

  svg.selectAll('.dots, .overlay ~ *').raise();

  function isCommitSelected(selection, d) {
    if (!selection) return false;
    const [[x0, y0], [x1, y1]] = selection;
    const x = xScale(d.datetime);
    const y = yScale(d.hourFrac);
    return x0 <= x && x <= x1 && y0 <= y && y <= y1;
  }

  function renderSelectionCount(selection) {
    const selected = selection
      ? commits.filter((d) => isCommitSelected(selection, d))
      : [];
    const el = document.getElementById('selection-count');
    el.textContent = `${selected.length || 'No'} commits selected`;
    return selected;
  }

  function renderLanguageBreakdown(selection) {
    const selected = selection
      ? commits.filter((d) => isCommitSelected(selection, d))
      : [];
    const container = document.getElementById('language-breakdown');
    container.innerHTML = '';
    const base = selected.length ? selected : commits;
    const lines = base.flatMap((d) => d.lines);

    const breakdown = d3.rollup(
      lines,
      (v) => v.length,
      (d) => d.type,
    );
    const total = lines.length;

    for (const [lang, count] of breakdown) {
      const prop = count / total;
      const pct = d3.format('.1~%')(prop);
      container.innerHTML += `<dt>${lang}</dt><dd>${count} lines (${pct})</dd>`;
    }
  }

  function brushed(event) {
    const sel = event.selection;
    d3.selectAll('circle').classed('selected', (d) =>
      isCommitSelected(sel, d),
    );
    renderSelectionCount(sel);
    renderLanguageBreakdown(sel);
  }

  // 初始语言分布
  renderLanguageBreakdown(null);
}

// ========== Lab 8：更新散点图（用在滑块 / scrolly） ==========
function updateScatterPlot(commits) {
  const svg = d3.select('#chart').select('svg');
  if (svg.empty()) return;

  const dotsGroup = svg.select('g.dots');

  if (!commits.length) {
    dotsGroup.selectAll('circle').remove();
    return;
  }

  // 更新 xScale domain
  xScale.domain(d3.extent(commits, (d) => d.datetime)).nice();

  // 更新半径比例尺
  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  const rScale = d3
    .scaleSqrt()
    .domain([minLines || 0, maxLines || 1])
    .range([2, 30]);

  // 更新 x 轴
  const xAxis = d3.axisBottom(xScale);
  const xAxisGroup = svg.select('g.x-axis');
  xAxisGroup.selectAll('*').remove();
  xAxisGroup.call(xAxis);

  // 更新圆点
  const sorted = d3.sort(commits, (d) => -d.totalLines);

  dotsGroup
    .selectAll('circle')
    .data(sorted, (d) => d.id) // 用 id 当 key，圆点稳定
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7)
    .on('mouseenter', (event, d) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(d);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mousemove', (event) => updateTooltipPosition(event))
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    });
}

// ========== Step 1 & 2：时间滑块（驱动 files + summary + scatter） ==========
function setupTimeSlider(data, commits) {
  // 0~100 → 时间 的比例尺
  timeScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([0, 100]);

  commitProgress = 100;
  commitMaxTime = timeScale.invert(commitProgress);
  filteredCommits = commits;

  const slider = document.querySelector('#commit-progress');
  const timeEl = document.querySelector('#commit-filter-time');

  function onTimeSliderChange() {
    commitProgress = Number(slider.value);
    commitMaxTime = timeScale.invert(commitProgress);

    // 更新时间文字
    timeEl.textContent = commitMaxTime.toLocaleString('en', {
      dateStyle: 'long',
      timeStyle: 'short',
    });

    // 过滤 commits / data
    filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);
    const filteredData = data.filter((d) => d.datetime <= commitMaxTime);

    // 更新文件可视化 + summary + 散点图
    updateFileDisplay(filteredCommits);
    renderSummaryStats(filteredData, filteredCommits);
    updateScatterPlot(filteredCommits);
  }

  slider.addEventListener('input', onTimeSliderChange);
  onTimeSliderChange(); // 初始化一次
}

// ========== Step 3：生成 commit 文字 + Scrollama ==========
function buildScatterStory(commits) {
  d3.select('#scatter-story')
    .selectAll('.step')
    .data(commits)
    .join('div')
    .attr('class', 'step')
    .html((d, i) => {
      const dateStr = d.datetime.toLocaleString('en', {
        dateStyle: 'full',
        timeStyle: 'short',
      });
      const filesTouched = d3.rollups(
        d.lines,
        (D) => D.length,
        (x) => x.file,
      ).length;

      const linkText =
        i > 0 ? 'another glorious commit' : 'my first commit, and it was glorious';

      return `
        <p><strong>${dateStr}</strong></p>
        <p>I made <a href="${d.url}" target="_blank">${linkText}</a>.</p>
        <p>I edited <strong>${d.totalLines}</strong> lines across
           <strong>${filesTouched}</strong> files.</p>
      `;
    });
}

function setupScrolly(data, commits) {
  const slider = document.querySelector('#commit-progress');
  const timeEl = document.querySelector('#commit-filter-time');

  function onStepEnter(response) {
    const commit = response.element.__data__;
    const cutoff = commit.datetime;

    // 更新 slider 的位置 & 时间文字
  timeEl.textContent = cutoff.toLocaleString('en', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

    // 和 slider 同样的更新逻辑
    const newFilteredCommits = commits.filter((d) => d.datetime <= cutoff);
    const newFilteredData = data.filter((d) => d.datetime <= cutoff);

    updateFileDisplay(newFilteredCommits);
    renderSummaryStats(newFilteredData, newFilteredCommits);
    updateScatterPlot(newFilteredCommits);
  }

  const scroller = scrollama();
  scroller
    .setup({
      container: '#scrolly-1',
      step: '#scrolly-1 .step',
    })
    .onStepEnter(onStepEnter);
}

// ========== 启动：读数据 → 处理 → 渲染 ==========
allData = await loadData();
allCommits = processCommits(allData);

// 初始：显示全量文件、summary、散点图，再挂 slider & scrolly
updateFileDisplay(allCommits);
renderSummaryStats(allData, allCommits);
renderScatterPlot(allCommits);

setupTimeSlider(allData, allCommits);   // slider
buildScatterStory(allCommits);         // scrolly 文字
setupScrolly(allData, allCommits);     // Scrollama
