import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const CONTENT_DIR = path.join(__dirname, 'content');
const CATEGORIES_FILE = path.join(__dirname, 'categories.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DEFAULT_CATEGORIES = [
  "Hardware",
  "Redes & Conectividade",
  "Sistemas & ERP",
  "E-mail & Comunicação",
  "Impressoras & Periféricos",
  "Segurança & Acessos",
  "Geral"
];

// 1. API: Obter Categorias
app.get('/api/categories', async (req, res) => {
  try {
    const data = await fs.readFile(CATEGORIES_FILE, 'utf-8');
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao ler categorias' });
  }
});

// 2. API: Cadastrar Nova Categoria
app.post('/api/categories', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Nome inválido' });

    const data = await fs.readFile(CATEGORIES_FILE, 'utf-8');
    const categories = JSON.parse(data);

    if (!categories.some(c => c.toLowerCase() === name.trim().toLowerCase())) {
      categories.push(name.trim());
      await fs.writeFile(CATEGORIES_FILE, JSON.stringify(categories, null, 2), 'utf-8');
    }

    res.status(201).json(categories);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar categoria' });
  }
});

// 3. API: Listar Chamados (com Paginação e Busca)
app.get('/api/articles', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = (req.query.search || '').toLowerCase();

    const files = await fs.readdir(CONTENT_DIR);
    
    let articles = await Promise.all(
      files
        .filter(file => file.endsWith('.md'))
        .map(async (file) => {
          const filePath = path.join(CONTENT_DIR, file);
          const fileContent = await fs.readFile(filePath, 'utf-8');
          const { data, content } = matter(fileContent);
          return {
            id: file.replace('.md', ''),
            title: data.title || 'Sem título',
            tags: data.tags || [],
            category: data.category || 'Geral',
            date: data.date || '',
            contentRaw: content,
            contentHtml: marked(content)
          };
        })
    );

    if (search) {
      articles = articles.filter(a => 
        a.title.toLowerCase().includes(search) ||
        a.contentRaw.toLowerCase().includes(search) ||
        a.tags.some(t => t.toLowerCase().includes(search))
      );
    }

    const totalArticles = articles.length;
    const totalPages = Math.ceil(totalArticles / limit) || 1;
    const startIndex = (page - 1) * limit;

    res.json({
      page,
      totalPages,
      totalArticles,
      articles: articles.slice(startIndex, startIndex + limit)
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao ler artigos do disco' });
  }
});

// 4. API: Salvar Novo Artigo .md
app.post('/api/articles', async (req, res) => {
  try {
    const { title, category, tags, problem, solution } = req.body;
    const baseSlug = title
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    const id = `${baseSlug}-${Date.now()}`;
    const filePath = path.join(CONTENT_DIR, `${id}.md`);

    const markdownContent = `---
title: "${title}"
category: "${category}"
tags: [${tags.map(t => `"${t.trim()}"`).join(', ')}]
date: "${new Date().toISOString().split('T')[0]}"
---

## Sintoma / Erro
${problem}

## Solução
${solution}
`;

    await fs.writeFile(filePath, markdownContent, 'utf-8');
    res.status(201).json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar arquivo .md' });
  }
});

// 5. API: Editar Artigo Existente
app.put('/api/articles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, tags, problem, solution } = req.body;
    const filePath = path.join(CONTENT_DIR, `${id}.md`);

    let originalDate = new Date().toISOString().split('T')[0];
    try {
      const existingContent = await fs.readFile(filePath, 'utf-8');
      const { data } = matter(existingContent);
      if (data.date) originalDate = data.date;
    } catch {}

    const updatedContent = `---
title: "${title}"
category: "${category}"
tags: [${tags.map(t => `"${t.trim()}"`).join(', ')}]
date: "${originalDate}"
---

## Sintoma / Erro
${problem}

## Solução
${solution}
`;

    await fs.writeFile(filePath, updatedContent, 'utf-8');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar artigo' });
  }
});

// 6. API: Excluir Artigo
app.delete('/api/articles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await fs.unlink(path.join(CONTENT_DIR, `${id}.md`));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover artigo' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Inicialização segura dentro de função async
async function startServer() {
  try {
    await fs.mkdir(CONTENT_DIR, { recursive: true });
    try {
      await fs.access(CATEGORIES_FILE);
    } catch {
      await fs.writeFile(CATEGORIES_FILE, JSON.stringify(DEFAULT_CATEGORIES, null, 2), 'utf-8');
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n==================================================`);
      console.log(` Wiki de Chamados rodando com sucesso!`);
      console.log(` Acesse: http://localhost:${PORT}`);
      console.log(`==================================================\n`);
    });
  } catch (err) {
    console.error('Erro ao iniciar o servidor:', err);
  }
}

startServer();