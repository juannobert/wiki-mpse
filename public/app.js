let articles = [];
let currentPage = 1;
const limit = 10;
let editingArticleId = null; // Guarda o ID se estiver editando

const articlesList = document.getElementById('articles-list');
const searchInput = document.getElementById('search');
const modal = document.getElementById('modal');
const form = document.getElementById('article-form');
const categorySelect = document.getElementById('category');
const btnAddCategory = document.getElementById('btn-add-category');

// 1. Carregar Artigos
async function fetchArticles(page = 1, searchQuery = '') {
  try {
    const res = await fetch(`/api/articles?page=${page}&limit=${limit}&search=${encodeURIComponent(searchQuery)}`);
    const data = await res.json();
    
    articles = data.articles || [];
    renderArticles(articles);
    renderPaginationControls(data.page || 1, data.totalPages || 1);
  } catch (err) {
    console.error('Erro ao buscar artigos:', err);
  }
}

// Renderizar cards com botões de Ação (Editar e Apagar)
function renderArticles(items) {
  articlesList.innerHTML = items.length === 0 
    ? '<p>Nenhum artigo encontrado.</p>' 
    : items.map(item => `
      <article class="article-card">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <h3>${item.title}</h3>
          <div style="display: flex; gap: 6px;">
            <button onclick="openEditModal('${item.id}')" class="btn-secondary" style="padding: 4px 8px; font-size: 12px;">Editar</button>
            <button onclick="deleteArticle('${item.id}')" style="background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 12px; cursor: pointer;">Excluir</button>
          </div>
        </div>
        <small>Categoria: <strong>${item.category}</strong> | Criado em: ${item.date}</small>
        <div class="tags">
          ${item.tags.map(t => `<span class="tag">${t}</span>`).join('')}
        </div>
        <hr>
        <div>${item.contentHtml}</div>
      </article>
    `).join('');
}

// Paginação
function renderPaginationControls(page, totalPages) {
  const paginationContainer = document.getElementById('pagination');
  if (!paginationContainer) return;

  paginationContainer.innerHTML = `
    <button ${page <= 1 ? 'disabled' : ''} onclick="changePage(${page - 1})">Anterior</button>
    <span>Página ${page} de ${totalPages || 1}</span>
    <button ${page >= totalPages ? 'disabled' : ''} onclick="changePage(${page + 1})">Próxima</button>
  `;
}

function changePage(newPage) {
  currentPage = newPage;
  fetchArticles(currentPage, searchInput.value);
}

// Busca em tempo real
let searchTimeout;
searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    currentPage = 1;
    fetchArticles(currentPage, e.target.value);
  }, 300);
});

// 2. Categorias
async function loadCategories() {
  try {
    const res = await fetch('/api/categories');
    const categories = await res.json();
    if (categorySelect) {
      categorySelect.innerHTML = categories
        .map(cat => `<option value="${cat}">${cat}</option>`)
        .join('');
    }
  } catch (err) {
    console.error('Erro ao carregar categorias:', err);
  }
}

if (btnAddCategory) {
  btnAddCategory.onclick = async () => {
    const newCat = prompt('Digite o nome da nova categoria:');
    if (newCat && newCat.trim()) {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCat.trim() })
      });
      if (res.ok) {
        await loadCategories();
        categorySelect.value = newCat.trim();
      }
    }
  };
}

// 3. Funções de Abrir Modal (Novo vs Editar)
document.getElementById('btn-toggle-modal').onclick = () => {
  editingArticleId = null;
  form.reset();
  document.querySelector('#modal h2').innerText = 'Novo Artigo de Suporte';
  modal.classList.remove('hidden');
};

document.getElementById('btn-cancel').onclick = () => modal.classList.add('hidden');

function openEditModal(id) {
  const article = articles.find(a => a.id === id);
  if (!article) return;

  editingArticleId = id;
  document.querySelector('#modal h2').innerText = 'Editar Artigo';
  
  document.getElementById('title').value = article.title;
  categorySelect.value = article.category;
  document.getElementById('tags').value = article.tags.join(', ');

  // Extrai Sintoma e Solução do Markdown bruto (se estiver separado por cabeçalhos)
  const parts = article.contentRaw.split('## Solução');
  const problemPart = parts[0] ? parts[0].replace('## Sintoma / Erro', '').trim() : '';
  const solutionPart = parts[1] ? parts[1].trim() : article.contentRaw;

  document.getElementById('problem').value = problemPart;
  document.getElementById('solution').value = solutionPart;

  modal.classList.remove('hidden');
}

// 4. Salvar (POST ou PUT)
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    title: document.getElementById('title').value,
    category: categorySelect.value,
    tags: document.getElementById('tags').value.split(','),
    problem: document.getElementById('problem').value,
    solution: document.getElementById('solution').value,
  };

  const url = editingArticleId ? `/api/articles/${editingArticleId}` : '/api/articles';
  const method = editingArticleId ? 'PUT' : 'POST';

  await fetch(url, {
    method: method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  form.reset();
  editingArticleId = null;
  modal.classList.add('hidden');
  fetchArticles(currentPage, searchInput.value);
});

// 5. Excluir Artigo
async function deleteArticle(id) {
  if (confirm('Tem certeza que deseja apagar este artigo? O arquivo .md será removido permanentemente.')) {
    await fetch(`/api/articles/${id}`, { method: 'DELETE' });
    fetchArticles(currentPage, searchInput.value);
  }
}

// Inicialização
loadCategories();
fetchArticles(currentPage);