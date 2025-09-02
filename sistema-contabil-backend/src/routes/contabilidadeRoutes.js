const express = require('express');
const router = express.Router();
const { getPlanoContas, createLancamento } = require('../controllers/lancamentoController');

// Rota para buscar o plano de contas completo
router.get('/plano-contas', getPlanoContas);

// Rota para criar um novo lançamento
router.post('/lancamentos', createLancamento);

module.exports = router;