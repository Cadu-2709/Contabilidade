// Adicione este bloco NO TOPO do arquivo src/server.js
require('dotenv').config();
console.log('--- VERIFICANDO VARIÁVEIS DE AMBIENTE ---');
console.log('USUÁRIO LIDO PELO NODE:', process.env.DB_USER);
console.log('SENHA LIDA PELO NODE:', process.env.DB_PASSWORD);
console.log('BANCO DE DADOS LIDO PELO NODE:', process.env.DB_DATABASE);
console.log('-----------------------------------------');

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const contabilidadeRoutes = require('./routes/contabilidadeRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors()); // Permite requisições de outras origens
app.use(express.json()); // Habilita o parsing de body JSON nas requisições POST

// Servir arquivos estáticos do front-end (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Rotas da API
app.use('/api', contabilidadeRoutes);

// Rota principal para servir o index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
