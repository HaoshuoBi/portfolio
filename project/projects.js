import { fetchJSON, renderProjects } from '../global.js';

const projects = await fetchJSON('../lib/projects.json');
const container = document.querySelector('.projects');

if (Array.isArray(projects) && container) {
  renderProjects(projects, container, 'h2');
}

const titleEl = document.querySelector('.projects-title');
if (titleEl && Array.isArray(projects)) {
  titleEl.textContent = `Projects (${projects.length})`;
}
