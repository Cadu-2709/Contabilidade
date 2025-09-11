require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const contabilidadeRoutes = require('./routes/contabilidadeRoutes');
const relatorioRoutes = require('./routes/relatorioRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', contabilidadeRoutes);
app.use('/api/relatorios', relatorioRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

